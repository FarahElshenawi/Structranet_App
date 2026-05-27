"""
wrapper.py — Thin CLI entry point for Node.js → Python bridge (MVP).

Architecture:
  Node.js (chat_orchestrator.js) spawns this script via child_process:
    python wrapper.py generate --request "campus network with 3 routers"

  All output is JSON printed to stdout. Node.js parses it and handles
  sessions, SSE streaming, auth, DB, etc.

  Errors are printed to stderr as JSON so Node.js can distinguish them
  from normal output.

  IMPORTANT: This wrapper ONLY imports from surviving Python modules:
    - structranet.ai.*          (agent, config_agent, qa_handler, context_builder)
    - structranet.catalog.*     (appliance_catalog, hw_config, port_assigner)
    - structranet.export.*      (gns3_exporter, validator)
    - structranet.generation.*  (preflight, topology_finalizer)
    - structranet.constants.*   (schema, appliances, hardware, etc.)
    - structranet.utils         (catalog_to_inventory, _build_design_review)

  It does NOT import from deleted modules:
    - structranet.api.*        (DELETED — Node.js handles REST/SSE/models)
    - structranet.core.*       (DELETED — Node.js handles sessions/pipeline/thoughts)
    - structranet.ai.chat_orchestrator (DELETED — Node.js handles LLM tool-calling)
    - structuranet.orchestrator (DELETED — was CLI-only pipeline)

Commands (MVP):
  generate    — Generate topology from natural language

Future commands (not yet implemented):
  edit        — Re-generate with edit feedback
  export      — Phase 2 + GNS3 export
  qa          — Cisco knowledge base search
  brief       — Build configuration brief (debugging / inspection)
  manifest    — Generate image requirements checklist
  validate    — Validate a topology JSON file

Usage examples:
  python wrapper.py generate --request "campus network"
  python wrapper.py generate --request "campus network" --profile '{"gns3_version": "2.2"}'
  python wrapper.py generate --request "campus network" --inventory '[...]' --profile '{...}'
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import sys
import tempfile
from pathlib import Path
from typing import Any, Dict, List, Optional

# ─── Ensure ai-engine root is on sys.path so `structranet` is importable ─────
# This allows the wrapper to resolve the structranet package regardless of
# where Node.js spawns the process from (CWD may be the backend/ dir).
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from dotenv import load_dotenv
load_dotenv()


# ═══════════════════════════════════════════════════════════════════════════════
#  OUTPUT HELPERS — The contract with Node.js
# ═══════════════════════════════════════════════════════════════════════════════
#
# The contract is simple:
#   - SUCCESS: Print exactly one JSON object to stdout, then exit 0.
#   - FAILURE: Print a JSON error object to stderr, then exit 1.
#
# This separation lets Node.js:
#   1. Read stdout cleanly (no interleaved log noise).
#   2. Detect errors by checking the exit code OR by reading stderr.
#   3. Route logs to its own logging infrastructure.

def _output_json(data: Any) -> None:
    """
    Print a JSON result to stdout for Node.js to parse.

    Uses indent=2 for human-readable output during debugging.
    In production, you may want to remove indent for smaller payloads.
    The `default=str` fallback serializes types like datetime that aren't
    natively JSON-serializable.
    """
    print(json.dumps(data, indent=2, default=str))


def _output_error(message: str, details: str = "") -> None:
    """
    Print an error JSON to stderr and exit with code 1.

    Node.js reads stderr when the exit code is non-zero.
    The JSON structure is intentionally simple:
      { "error": "<human-readable message>", "details": "<optional stack/trace>" }

    This function calls sys.exit(1) immediately — it never returns.
    """
    err = {"error": message}
    if details:
        err["details"] = details
    print(json.dumps(err), file=sys.stderr)
    sys.exit(1)


# ═══════════════════════════════════════════════════════════════════════════════
#  LAZY IMPORTS — Only load heavy modules when the command needs them
# ═══════════════════════════════════════════════════════════════════════════════
#
# WHY LAZY?
#   1. Speed: If the user runs `wrapper.py --help`, we don't want to
#      load Pydantic, the LLM client, and the entire catalog just to
#      print a help message.
#   2. Isolation: If one module has an import error, it only fails
#      when that specific command is invoked — not on every invocation.
#   3. Memory: Python's AI modules (openai, pydantic) are heavy.
#      Lazy loading keeps the baseline footprint small.

def _import_agent():
    """
    Import the core AI agent module (structranet.ai.agent).

    This module contains:
      - SessionState: Tracks the LLM conversation state.
      - generate_network_topology: The main Phase 1 LLM call.
      - generate_image_manifest: Builds the requirements checklist.
      - process_and_save_topology: Hardware injection + VLAN patching.

    Returns a tuple for convenient unpacking in the command handler.
    """
    from structranet.ai.agent import (
        SessionState,
        generate_network_topology,
        generate_image_manifest,
        process_and_save_topology,
    )
    return SessionState, generate_network_topology, generate_image_manifest, process_and_save_topology


def _import_catalog():
    """
    Import the appliance catalog and inventory builder.

    The catalog defines every device template StructuraNet knows about
    (Cisco 7200, IOSv, ASAv, etc.). The inventory builder converts
    the catalog into the format the AI agent expects.
    """
    from structranet.catalog.appliance_catalog import load_catalog
    from structranet.utils import catalog_to_inventory
    return load_catalog, catalog_to_inventory


def _import_preflight():
    """
    Import preflight profile utilities.

    Preflight profiles control what device types are allowed based on
    the user's GNS3 environment (e.g., "no IOU" or "QEMU only").
    """
    from structranet.generation.preflight import (
        PreflightProfile,
        filter_inventory_by_profile,
        profile_from_dict,
    )
    return PreflightProfile, filter_inventory_by_profile, profile_from_dict


def _import_design_review():
    """
    Import design review and compatibility check utilities.

    The design review produces a human-readable summary of the
    topology's design decisions and assumptions. Compatibility
    checks flag issues like missing appliance images.
    """
    from structranet.utils import _build_design_review
    from structranet.generation.preflight import check_topology_compatibility
    return _build_design_review, check_topology_compatibility


def _import_appliance_types():
    """
    Import appliance/builtin type sets from agent.py.

    These sets classify node types into two categories:
      - _APPLIANCE_NODE_TYPES: Require a disk image (IOSv, ASAv, etc.)
      - _BUILTIN_NODE_TYPES: Built into GNS3 (Ethernet switch, etc.)
    Used when building the image requirements manifest.
    """
    from structranet.ai.agent import _APPLIANCE_NODE_TYPES, _BUILTIN_NODE_TYPES
    return _APPLIANCE_NODE_TYPES, _BUILTIN_NODE_TYPES


# ═══════════════════════════════════════════════════════════════════════════════
#  SHARED HELPERS — Used across multiple commands
# ═══════════════════════════════════════════════════════════════════════════════

def _load_json_arg(value: str) -> Any:
    """
    Parse a JSON string passed as a CLI argument.

    Returns None on failure (instead of crashing) so callers can
    apply default values. This is intentional — CLI args from Node.js
    may be empty strings or malformed JSON in edge cases.
    """
    if not value or value.strip() == "":
        return None
    try:
        return json.loads(value)
    except json.JSONDecodeError:
        return None


def _load_json_file(path: str) -> Dict[str, Any]:
    """Load a JSON file from disk and return the parsed dict."""
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def _setup_logging(verbose: bool = False):
    """
    Configure Python's logging system.

    CRITICAL: All logs go to stderr. stdout is reserved exclusively
    for the JSON response payload. Mixing logs into stdout would
    corrupt the JSON and cause Node.js parsing failures.
    """
    level = logging.DEBUG if verbose else logging.WARNING
    logging.basicConfig(
        level=level,
        format="%(name)s [%(levelname)s] %(message)s",
        stream=sys.stderr,  # ← NEVER stdout
    )


def _resolve_profile_and_inventory(args):
    """
    Build a PreflightProfile and filtered inventory from CLI args.

    This is the "environment context" — what the user's GNS3 setup
    actually supports. The profile controls:
      - Which emulator types are allowed (QEMU, IOU, Docker, etc.)
      - Which security hardening profile to apply
      - Custom image-to-template mappings
      - Validation strictness

    The inventory is filtered against the profile so the AI agent
    only generates topologies the user's environment can actually run.
    """
    _, filter_inventory_by_profile, profile_from_dict = _import_preflight()
    load_catalog, catalog_to_inventory = _import_catalog()

    # Load the built-in appliance catalog (or a custom one if provided)
    catalog_path = getattr(args, "catalog_path", None)
    catalog = load_catalog(catalog_path)
    inventory = catalog_to_inventory(catalog)

    # Build the preflight profile from the user's JSON config
    profile_json = _load_json_arg(getattr(args, "profile", "{}") or "{}")
    if profile_json is None:
        profile_json = {}

    profile = profile_from_dict({
        "gns3_version": profile_json.get("gns3_version", "2.2"),
        "supports_iou": profile_json.get("supports_iou", False),
        "supports_qemu": profile_json.get("supports_qemu", True),
        "supports_docker": profile_json.get("supports_docker", False),
        "strict_validation": profile_json.get("strict_validation", True),
        "require_template_image_map": profile_json.get("require_template_image_map", False),
        "template_image_map": profile_json.get("template_image_map"),
        "security_profile": profile_json.get("security_profile", "none"),
    })

    # Filter out device types the profile doesn't support
    filtered_inventory, blocked_types = filter_inventory_by_profile(inventory, profile)

    return catalog, inventory, filtered_inventory, blocked_types, profile


# ═══════════════════════════════════════════════════════════════════════════════
#  TOPOLOGY SUMMARY BUILDER — Enriches raw topology with metadata
# ═══════════════════════════════════════════════════════════════════════════════

def _build_topology_summary(topology_dict: Dict[str, Any], profile: Any) -> Dict[str, Any]:
    """
    Build topology data, requirements, and summary from a topology dict.

    This function takes the raw LLM output (a GNS3Project-compatible dict)
    and produces three enriched data structures that the Node.js layer needs:

    1. topology_data: A simplified view with node/link counts for the
       frontend's topology viewer and review cards.

    2. requirements: An image requirements manifest showing which devices
       need which disk images, and whether those images are available.

    3. design_review + assumptions: Human-readable analysis of the
       topology's design decisions, produced by the AI agent.

    All outputs are plain dicts (not Pydantic models) because Node.js
    doesn't need Python type objects — it just needs JSON.
    """
    _build_design_review, check_topology_compatibility = _import_design_review()
    _APPLIANCE_NODE_TYPES, _BUILTIN_NODE_TYPES = _import_appliance_types()

    from structranet.constants.appliances import APPLIANCE_CATALOG

    topo = topology_dict.get("topology", {})
    nodes_raw = topo.get("nodes", [])
    links_raw = topo.get("links", [])

    # ── Count links per node (for the topology viewer badges) ────────────
    link_counts: Dict[str, int] = {}
    for link in links_raw:
        for ep in link.get("nodes", []):
            nid = ep.get("node_id", "")
            link_counts[nid] = link_counts.get(nid, 0) + 1

    # ── Build simplified TopologyData (for frontend viewer) ──────────────
    topo_nodes = []
    for n in nodes_raw:
        topo_nodes.append({
            "node_id": n.get("node_id", ""),
            "name": n.get("name", ""),
            "node_type": n.get("node_type", ""),
            "template_name": n.get("template_name", ""),
            "link_count": link_counts.get(n.get("node_id", ""), 0),
        })

    topo_links = []
    for link in links_raw:
        eps = link.get("nodes", [])
        if len(eps) >= 2:
            topo_links.append({
                "from_node": eps[0].get("node_id", ""),
                "to_node": eps[1].get("node_id", ""),
                "link_type": link.get("link_type", "ethernet"),
            })

    topology_data = {
        "name": topology_dict.get("name", "Untitled"),
        "nodes": topo_nodes,
        "links": topo_links,
        "node_count": len(topo_nodes),
        "link_count": len(topo_links),
    }

    # ── Build image requirements manifest ────────────────────────────────
    # Each node is classified as either:
    #   - "builtin": No image needed (e.g., Ethernet switch)
    #   - An emulator category (qemu, dynamips, iou, docker):
    #     Image required — check if the user's profile provides one
    _EMULATOR_CATEGORY = {
        "dynamips": "dynamips", "iou": "iou", "qemu": "qemu",
        "docker": "docker", "virtualbox": "qemu", "vmware": "qemu",
    }
    template_image_map = getattr(profile, "normalized_template_image_map", {}) or {}

    def _resolve_image(template: str, node_type: str) -> Optional[str]:
        """
        Resolve the disk image filename for a given template + emulator type.

        Priority order:
          1. User's custom mapping (from Profile modal in the frontend)
          2. Default image from the appliance catalog (appliances.py)
          3. None (image is missing — flagged in the manifest)
        """
        user_image = template_image_map.get(template)
        if user_image:
            return user_image
        catalog_entry = APPLIANCE_CATALOG.get(template, {})
        if not catalog_entry:
            return None
        if node_type == "dynamips":
            return catalog_entry.get("image")
        elif node_type == "iou":
            return catalog_entry.get("path")
        elif node_type == "qemu":
            return catalog_entry.get("hda_disk_image")
        elif node_type == "docker":
            return catalog_entry.get("image")
        else:
            return catalog_entry.get("image") or catalog_entry.get("hda_disk_image") or catalog_entry.get("path")

    requirements = []
    for node in nodes_raw:
        nid = node.get("node_id", "?")
        name = node.get("name", "?")
        ntype = node.get("node_type", "")
        template = node.get("template_name", "")

        if ntype in _BUILTIN_NODE_TYPES:
            # Built-in GNS3 nodes (Ethernet switch, etc.) — no image needed
            requirements.append({
                "node_id": nid,
                "name": name,
                "node_type": ntype,
                "template_name": template,
                "category": "builtin",
                "image_required": False,
                "image_file": None,
                "status": "builtin",
            })
        elif ntype in _APPLIANCE_NODE_TYPES:
            # Appliance nodes (routers, firewalls, etc.) — image required
            image_file = _resolve_image(template, ntype)
            cat = _EMULATOR_CATEGORY.get(ntype, "qemu")
            requirements.append({
                "node_id": nid,
                "name": name,
                "node_type": ntype,
                "template_name": template,
                "category": cat,
                "image_required": True,
                "image_file": image_file,
                "status": "ok" if image_file else "missing",
            })
        else:
            # Unknown type — treat as builtin (lenient fallback)
            requirements.append({
                "node_id": nid,
                "name": name,
                "node_type": ntype,
                "template_name": template,
                "category": "builtin",
                "image_required": False,
                "image_file": None,
                "status": "builtin",
            })

    # ── Design review + compatibility checks ─────────────────────────────
    compatibility_issues = check_topology_compatibility(topology_dict, profile)
    design_review, assumptions = _build_design_review(topology_dict, profile, compatibility_issues)

    return {
        "topology_data": topology_data,
        "requirements": requirements,
        "design_review": design_review,
        "assumptions": assumptions,
        "compatibility_issues": compatibility_issues,
    }


# ═══════════════════════════════════════════════════════════════════════════════
#  COMMAND: generate (MVP — the core bridge command)
# ═══════════════════════════════════════════════════════════════════════════════
#
# This is the heart of the Node.js ↔ Python bridge. When the user types
# "Design a campus network with 3 routers" in the chat, the Node.js
# chat_orchestrator detects a `generate_new_topology` tool call and
# spawns this command:
#
#   python wrapper.py generate --request "Design a campus network with 3 routers"
#
# The flow is:
#   1. Parse the --request arg (the user's network description).
#   2. Load the appliance catalog and build a filtered inventory.
#   3. Call the LLM via generate_network_topology().
#   4. Enrich the LLM output with hardware info (process_and_save_topology).
#   5. Build the image manifest.
#   6. Build the topology summary (topology_data + requirements + design_review).
#   7. Print everything as a single JSON object to stdout.
#   8. Node.js parses the JSON and uses it to update the frontend.

def cmd_generate(args: argparse.Namespace) -> None:
    """
    Phase 1: Generate a topology from natural language.

    Input:  request text, inventory, profile
    Output: JSON with topology_dict, topology_data, requirements, thinking_text, etc.
    """
    SessionState, generate_network_topology, generate_image_manifest, process_and_save_topology = _import_agent()

    # ── Validate required argument ────────────────────────────────────────
    user_request = args.request
    if not user_request:
        _output_error("--request is required for generate command")

    # ── Resolve environment context (profile + inventory) ────────────────
    catalog, inventory, filtered_inventory, blocked_types, profile = _resolve_profile_and_inventory(args)

    if not filtered_inventory:
        _output_error("Profile blocks all available node types in inventory")

    # ── Parse optional arguments ──────────────────────────────────────────
    chat_history = _load_json_arg(getattr(args, "chat_history", "[]") or "[]") or []
    security_profile = getattr(args, "security_profile", "none") or "none"
    output_dir = getattr(args, "output_dir", None) or tempfile.mkdtemp(prefix="structuranet_")

    os.makedirs(output_dir, exist_ok=True)

    # ── Phase 1 LLM call ──────────────────────────────────────────────────
    # This is the expensive call — it sends the user's request + inventory
    # to the LLM and gets back a structured GNS3Project-compatible topology.
    # The LLM uses chain-of-thought reasoning (thinking_text) and returns
    # the topology as a JSON envelope inside its response.
    result, thinking_text, updated_history = generate_network_topology(
        user_request,
        filtered_inventory,
        disallowed_node_types=blocked_types,
        security_profile=security_profile,
        chat_history=chat_history,
    )

    if result is None:
        _output_error("AI generation failed after all retries. Check API key and model config.")

    # ── Hardware injection + VLAN patching ─────────────────────────────────
    # The LLM only produces the logical topology (names, links, IPs).
    # process_and_save_topology enriches it with:
    #   - Slot/port assignments (from the hardware catalog)
    #   - VLAN patching (ensuring trunk/access ports are consistent)
    #   - Default properties for each node type
    # The enriched topology is saved to disk for later export.
    phase1_file = os.path.join(output_dir, "_topology.json")
    enriched = process_and_save_topology(result, phase1_file)

    if enriched is None:
        _output_error("Hardware injection failed. Check logs for details.")

    topology_dict = enriched.model_dump()

    # ── Image manifest ────────────────────────────────────────────────────
    # Generates a text file listing all required disk images and their
    # status (available/missing). This is shown in the frontend's
    # Requirements panel.
    manifest_file = os.path.join(output_dir, "image_manifest.txt")
    template_image_map = getattr(profile, "normalized_template_image_map", {}) or {}
    generate_image_manifest(
        topology_dict,
        template_image_map,
        manifest_file,
        catalog,
    )

    # ── Build response data ───────────────────────────────────────────────
    # This enriches the raw topology with viewer-friendly data.
    summary = _build_topology_summary(topology_dict, profile)

    # NOTE: We return raw thinking_text. Node.js handles thought classification
    # (the old core/thought_parser.py is deleted).
    _output_json({
        "success": True,
        "phase": "review",
        "thinking_text": thinking_text,
        "chat_history": updated_history,
        "topology_dict": topology_dict,
        "phase1_file": phase1_file,
        "manifest_file": manifest_file,
        **summary,
    })


# ═══════════════════════════════════════════════════════════════════════════════
#  CLI ARGUMENT PARSER — Defines the command-line interface
# ═══════════════════════════════════════════════════════════════════════════════
#
# Uses Python's argparse library with subparsers for multi-command support.
# Each command (generate, edit, export, etc.) gets its own subparser with
# specific arguments.
#
# Node.js constructs the CLI invocation by concatenating:
#   python wrapper.py <command> --arg1 val1 --arg2 val2 ...

def build_parser() -> argparse.ArgumentParser:
    """
    Build and return the argparse parser for wrapper.py.

    MVP: Only the 'generate' command is implemented.
    Future commands will be added as the pipeline matures.
    """
    parser = argparse.ArgumentParser(
        description="StructuraNet AI — Python wrapper for Node.js",
    )
    parser.add_argument(
        "--verbose", "-v",
        action="store_true",
        help="Enable debug logging to stderr (useful during development)",
    )

    subparsers = parser.add_subparsers(dest="command", help="Command to run")

    # ── generate ──────────────────────────────────────────────────────────
    p_gen = subparsers.add_parser(
        "generate",
        help="Phase 1: Generate topology from natural language",
    )
    p_gen.add_argument(
        "--request", "-r",
        required=True,
        help="Network description in natural language (e.g., 'campus network with 3 routers')",
    )
    p_gen.add_argument(
        "--inventory",
        type=str,
        default=None,
        help="JSON array of inventory items (or omit to use built-in catalog)",
    )
    p_gen.add_argument(
        "--profile",
        type=str,
        default="{}",
        help="JSON object with GNS3 profile settings (version, features, image map)",
    )
    p_gen.add_argument(
        "--chat-history",
        type=str,
        default="[]",
        help="JSON array of previous chat messages (for multi-turn conversations)",
    )
    p_gen.add_argument(
        "--security-profile",
        type=str,
        default="none",
        choices=["none", "basic", "enterprise"],
        help="Security hardening profile: none (default), basic, or enterprise",
    )
    p_gen.add_argument(
        "--catalog-path",
        type=str,
        default=None,
        help="Path to custom appliance catalog JSON (defaults to built-in catalog)",
    )
    p_gen.add_argument(
        "--output-dir",
        type=str,
        default=None,
        help="Output directory for generated files (defaults to temp directory)",
    )

    return parser


# ═══════════════════════════════════════════════════════════════════════════════
#  COMMAND MAP — Maps command names to handler functions
# ═══════════════════════════════════════════════════════════════════════════════
#
# To add a new command:
#   1. Write a cmd_<name>(args) function above.
#   2. Add it to this map.
#   3. Add a subparser in build_parser().
# That's it — the main() function handles the rest.

COMMAND_MAP = {
    "generate": cmd_generate,
}


# ═══════════════════════════════════════════════════════════════════════════════
#  MAIN — Entry point
# ═══════════════════════════════════════════════════════════════════════════════

def main():
    """
    Parse CLI arguments and dispatch to the appropriate command handler.

    This function is the single entry point for all Python execution.
    Node.js always invokes: python wrapper.py <command> [options]

    Error handling strategy:
      - If the command is missing or unknown → print help + exit 1.
      - If the command handler raises an exception → catch it, print
        a JSON error to stderr, and exit 1.
      - This ensures Node.js ALWAYS gets a structured error response,
        never a raw Python traceback on stdout.
    """
    parser = build_parser()
    args = parser.parse_args()

    _setup_logging(getattr(args, "verbose", False))

    command = getattr(args, "command", None)
    if not command or command not in COMMAND_MAP:
        parser.print_help()
        sys.exit(1)

    try:
        COMMAND_MAP[command](args)
    except Exception as exc:
        # Catch-all: ensure any unhandled exception becomes a structured
        # JSON error on stderr, not a raw traceback on stdout.
        _output_error(f"Unhandled exception: {exc}", details=str(exc.__class__.__name__))


if __name__ == "__main__":
    main()
