"""
wrapper.py — Thin CLI entry point for Node.js to call StructuraNet AI pipeline.

Architecture:
  Node.js (Express) spawns this script via child_process:
    python wrapper.py <command> --arg1 val1 --arg2 val2 ...

  All output is JSON printed to stdout. Node.js parses it and handles
  sessions, SSE streaming, auth, DB, etc.

  Errors are printed to stderr as JSON so Node.js can distinguish them
  from normal output.

  IMPORTANT: This wrapper ONLY imports from surviving Python modules:
    - structranet.ai.*          (agent, config_agent, qa_handler, context_builder)
    - structuranet.catalog.*    (appliance_catalog, hw_config, port_assigner)
    - structuranet.export.*     (gns3_exporter, validator)
    - structuranet.generation.* (preflight, topology_finalizer)
    - structuranet.constants.*  (schema, appliances, hardware, etc.)
    - structuranet.utils        (catalog_to_inventory, _build_design_review)

  It does NOT import from deleted modules:
    - structuranet.api.*        (DELETED — Node.js handles REST/SSE/models)
    - structuranet.core.*       (DELETED — Node.js handles sessions/pipeline/thoughts)
    - structuranet.ai.chat_orchestrator (DELETED — Node.js handles LLM tool-calling)
    - structuranet.orchestrator (DELETED — was CLI-only pipeline)

Commands:
  generate    — Phase 1: generate topology from natural language
  edit        — Phase 1: re-generate with edit feedback
  export      — Phase 2 + GNS3 export
  qa          — Cisco knowledge base search
  brief       — Build configuration brief (debugging / inspection)
  manifest    — Generate image requirements checklist
  validate    — Validate a topology JSON file

Usage examples:
  python wrapper.py generate --request "campus network" --inventory '[...]' --profile '{...}'
  python wrapper.py edit --feedback "add a firewall" --topology ./output/_topology.json --chat-history '[...]'
  python wrapper.py export --topology ./output/_topology.json --security basic --output-dir ./output
  python wrapper.py qa --topic "OSPF configuration"
  python wrapper.py brief --topology ./output/_topology.json
  python wrapper.py manifest --topology ./output/_topology.json --template-image-map '{...}'
  python wrapper.py validate --topology ./output/_topology.json
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

# Ensure the ai-engine root is on sys.path so `structranet` is importable
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from dotenv import load_dotenv
load_dotenv()

# ─── Output helpers ─────────────────────────────────────────────────────────

def _output_json(data: Any) -> None:
    """Print a JSON result to stdout (Node.js reads this)."""
    print(json.dumps(data, indent=2, default=str))


def _output_error(message: str, details: str = "") -> None:
    """Print an error JSON to stderr and exit with code 1."""
    err = {"error": message}
    if details:
        err["details"] = details
    print(json.dumps(err), file=sys.stderr)
    sys.exit(1)


# ─── Lazy imports (only loaded when the command needs them) ──────────────────
# All imports are from SURVIVING modules only. No api/ or core/ references.

def _import_agent():
    from structranet.ai.agent import (
        SessionState,
        generate_network_topology,
        generate_image_manifest,
        process_and_save_topology,
    )
    return SessionState, generate_network_topology, generate_image_manifest, process_and_save_topology


def _import_config_agent():
    from structranet.ai.config_agent import run_phase2
    return run_phase2


def _import_export():
    from structranet.export.gns3_exporter import convert as export_gns3project
    from structranet.export.validator import GNS3ProjectValidator
    return export_gns3project, GNS3ProjectValidator


def _import_qa():
    from structranet.ai.qa_handler import answer_qa
    return answer_qa


def _import_catalog():
    from structranet.catalog.appliance_catalog import load_catalog
    from structranet.utils import catalog_to_inventory
    return load_catalog, catalog_to_inventory


def _import_preflight():
    from structranet.generation.preflight import (
        PreflightProfile,
        filter_inventory_by_profile,
        profile_from_dict,
    )
    return PreflightProfile, filter_inventory_by_profile, profile_from_dict


def _import_context_builder():
    from structranet.ai.context_builder import build_configuration_brief
    return build_configuration_brief


def _import_schema():
    from structranet.constants.schema import GNS3Project
    return GNS3Project


def _import_design_review():
    from structranet.utils import _build_design_review
    from structranet.generation.preflight import check_topology_compatibility
    return _build_design_review, check_topology_compatibility


def _import_appliance_types():
    """Import appliance/builtin type sets from agent.py for requirements building."""
    from structranet.ai.agent import _APPLIANCE_NODE_TYPES, _BUILTIN_NODE_TYPES
    return _APPLIANCE_NODE_TYPES, _BUILTIN_NODE_TYPES


# ─── Shared helpers ─────────────────────────────────────────────────────────

def _load_json_arg(value: str) -> Any:
    """Parse a JSON string argument; return empty structure on failure."""
    if not value or value.strip() == "":
        return None
    try:
        return json.loads(value)
    except json.JSONDecodeError:
        return None


def _load_json_file(path: str) -> Dict[str, Any]:
    """Load a JSON file and return the dict."""
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def _setup_logging(verbose: bool = False):
    level = logging.DEBUG if verbose else logging.WARNING
    logging.basicConfig(
        level=level,
        format="%(name)s [%(levelname)s] %(message)s",
        stream=sys.stderr,  # logs go to stderr so they don't pollute stdout JSON
    )


def _resolve_profile_and_inventory(args):
    """Build PreflightProfile and filtered_inventory from CLI args."""
    _, filter_inventory_by_profile, profile_from_dict = _import_preflight()
    load_catalog, catalog_to_inventory = _import_catalog()

    # Load catalog
    catalog_path = getattr(args, "catalog_path", None)
    catalog = load_catalog(catalog_path)
    inventory = catalog_to_inventory(catalog)

    # Build profile
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

    filtered_inventory, blocked_types = filter_inventory_by_profile(inventory, profile)

    return catalog, inventory, filtered_inventory, blocked_types, profile


def _build_topology_summary(topology_dict: Dict[str, Any], profile: Any) -> Dict[str, Any]:
    """
    Build topology data, requirements, and summary from topology dict.

    Returns plain dicts — no Pydantic models from api/models.py.
    Node.js will format/structure the data as needed.
    """
    _build_design_review, check_topology_compatibility = _import_design_review()
    _APPLIANCE_NODE_TYPES, _BUILTIN_NODE_TYPES = _import_appliance_types()

    from structranet.constants.appliances import APPLIANCE_CATALOG

    topo = topology_dict.get("topology", {})
    nodes_raw = topo.get("nodes", [])
    links_raw = topo.get("links", [])

    # ── Link counts per node ──────────────────────────────────────────────
    link_counts: Dict[str, int] = {}
    for link in links_raw:
        for ep in link.get("nodes", []):
            nid = ep.get("node_id", "")
            link_counts[nid] = link_counts.get(nid, 0) + 1

    # ── TopologyData (plain dict, not Pydantic) ───────────────────────────
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

    # ── Requirements / image manifest (plain dicts) ───────────────────────
    _EMULATOR_CATEGORY = {
        "dynamips": "dynamips", "iou": "iou", "qemu": "qemu",
        "docker": "docker", "virtualbox": "qemu", "vmware": "qemu",
    }
    template_image_map = getattr(profile, "normalized_template_image_map", {}) or {}

    def _resolve_image(template: str, node_type: str) -> Optional[str]:
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

    # ── Design review ─────────────────────────────────────────────────────
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
#  COMMAND: generate
# ═══════════════════════════════════════════════════════════════════════════════

def cmd_generate(args: argparse.Namespace) -> None:
    """
    Phase 1: Generate a topology from natural language.

    Input:  request text, inventory, profile
    Output: JSON with topology_dict, topology_data, requirements, thinking_text, etc.
    """
    SessionState, generate_network_topology, generate_image_manifest, process_and_save_topology = _import_agent()

    user_request = args.request
    if not user_request:
        _output_error("--request is required for generate command")

    catalog, inventory, filtered_inventory, blocked_types, profile = _resolve_profile_and_inventory(args)

    if not filtered_inventory:
        _output_error("Profile blocks all available node types in inventory")

    # Parse chat history
    chat_history = _load_json_arg(getattr(args, "chat_history", "[]") or "[]") or []
    security_profile = getattr(args, "security_profile", "none") or "none"
    output_dir = getattr(args, "output_dir", None) or tempfile.mkdtemp(prefix="structuranet_")

    os.makedirs(output_dir, exist_ok=True)

    # ── Phase 1 LLM call ──────────────────────────────────────────────────
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
    phase1_file = os.path.join(output_dir, "_topology.json")
    enriched = process_and_save_topology(result, phase1_file)

    if enriched is None:
        _output_error("Hardware injection failed. Check logs for details.")

    topology_dict = enriched.model_dump()

    # ── Image manifest ────────────────────────────────────────────────────
    manifest_file = os.path.join(output_dir, "image_manifest.txt")
    template_image_map = getattr(profile, "normalized_template_image_map", {}) or {}
    generate_image_manifest(
        topology_dict,
        template_image_map,
        manifest_file,
        catalog,
    )

    # ── Build response data ───────────────────────────────────────────────
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
#  COMMAND: edit
# ═══════════════════════════════════════════════════════════════════════════════

def cmd_edit(args: argparse.Namespace) -> None:
    """
    Phase 1 (edit): Re-generate topology with feedback.

    Input:  feedback text, existing topology JSON path, chat history
    Output: Same as generate
    """
    SessionState, generate_network_topology, generate_image_manifest, process_and_save_topology = _import_agent()

    feedback = args.feedback
    if not feedback:
        _output_error("--feedback is required for edit command")

    topology_path = args.topology
    if not topology_path:
        _output_error("--topology path is required for edit command")

    # Load existing topology to get context
    topology_dict = _load_json_file(topology_path)

    # Parse args
    chat_history = _load_json_arg(getattr(args, "chat_history", "[]") or "[]") or []
    original_request = getattr(args, "original_request", None) or ""
    security_profile = getattr(args, "security_profile", "none") or "none"
    output_dir = getattr(args, "output_dir", None) or os.path.dirname(topology_path)

    catalog, inventory, filtered_inventory, blocked_types, profile = _resolve_profile_and_inventory(args)

    # Append edit feedback to chat history
    chat_history.append({
        "role": "user",
        "content": (
            f"Please modify the topology based on this feedback: {feedback}\n"
            "Return the complete updated design in the same CoT JSON envelope format."
        ),
    })

    # Use original request as anchor, or feedback if no original
    requirement = original_request or feedback

    # ── Phase 1 LLM call (edit iteration) ─────────────────────────────────
    result, thinking_text, updated_history = generate_network_topology(
        requirement,
        filtered_inventory,
        disallowed_node_types=blocked_types,
        security_profile=security_profile,
        chat_history=chat_history,
    )

    if result is None:
        _output_error("Edit generation failed after all retries.")

    # ── Hardware injection ─────────────────────────────────────────────────
    phase1_file = os.path.join(output_dir, "_topology.json")
    enriched = process_and_save_topology(result, phase1_file)

    if enriched is None:
        _output_error("Hardware injection failed during edit.")

    topology_dict = enriched.model_dump()

    # ── Image manifest ────────────────────────────────────────────────────
    manifest_file = os.path.join(output_dir, "image_manifest.txt")
    template_image_map = getattr(profile, "normalized_template_image_map", {}) or {}
    generate_image_manifest(
        topology_dict,
        template_image_map,
        manifest_file,
        catalog,
    )

    # ── Build response data ───────────────────────────────────────────────
    summary = _build_topology_summary(topology_dict, profile)

    # NOTE: We return raw thinking_text. Node.js handles thought classification.
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
#  COMMAND: export
# ═══════════════════════════════════════════════════════════════════════════════

def cmd_export(args: argparse.Namespace) -> None:
    """
    Phase 2 + GNS3 export: generate configs and export .gns3project file.

    Input:  topology JSON path, security profile
    Output: JSON with final_dict, gns3project_path, config_texts, validator_passed
    """
    run_phase2 = _import_config_agent()
    export_gns3project, GNS3ProjectValidator = _import_export()

    topology_path = args.topology
    if not topology_path:
        _output_error("--topology path is required for export command")

    security_profile = getattr(args, "security_profile", "none") or "none"
    output_dir = getattr(args, "output_dir", None) or os.path.dirname(topology_path)
    os.makedirs(output_dir, exist_ok=True)

    # Resolve profile for image map
    _, _, _, _, profile = _resolve_profile_and_inventory(args)
    template_image_map = getattr(profile, "normalized_template_image_map", {}) or {}

    # ── Phase 2 ───────────────────────────────────────────────────────────
    phase1_file = topology_path
    final_file = os.path.join(output_dir, "final_topology.json")

    final_dict = run_phase2(
        phase1_file,
        final_file,
        security_profile=security_profile,
    )

    if final_dict is None:
        # Fall back to Phase 1 topology (no configs)
        final_dict = _load_json_file(topology_path)
        import shutil
        shutil.copy2(topology_path, final_file)

    # ── Export GNS3 project ───────────────────────────────────────────────
    project_output = os.path.join(output_dir, "final_topology.gns3project")
    config_review_dir = os.path.join(output_dir, "configs_review")

    try:
        project_path = export_gns3project(
            final_dict,
            project_output,
            image_map=template_image_map,
            config_review_dir=config_review_dir,
        )
    except Exception as exc:
        _output_error(f"GNS3 export failed: {exc}")

    # ── Validate ──────────────────────────────────────────────────────────
    validator_passed = None
    if not getattr(args, "no_validate", False):
        try:
            validator = GNS3ProjectValidator(project_path, verbose=False)
            validator_passed = validator.validate()
        except Exception:
            validator_passed = None

    # ── Extract config texts ──────────────────────────────────────────────
    _CONFIG_CONTENT_KEYS = ("startup_config_content", "startup_script", "start_command")
    config_texts: Dict[str, str] = {}

    topo = final_dict.get("topology", {})
    for node in topo.get("nodes", []):
        props = node.get("properties", {})
        name = node.get("name", node.get("node_id", ""))
        for key in _CONFIG_CONTENT_KEYS:
            val = props.get(key)
            if val and isinstance(val, str):
                config_texts[name] = val
                break

    # ── Build response ────────────────────────────────────────────────────
    _output_json({
        "success": True,
        "phase": "success",
        "final_dict": final_dict,
        "final_file": final_file,
        "gns3project_path": project_path,
        "config_texts": config_texts,
        "validator_passed": validator_passed,
        "config_review_dir": config_review_dir,
    })


# ═══════════════════════════════════════════════════════════════════════════════
#  COMMAND: qa
# ═══════════════════════════════════════════════════════════════════════════════

def cmd_qa(args: argparse.Namespace) -> None:
    """Search Cisco knowledge base and answer a question."""
    answer_qa = _import_qa()

    topic = args.topic
    if not topic:
        _output_error("--topic is required for qa command")

    try:
        answer = answer_qa(topic, topic)
        _output_json({
            "success": True,
            "topic": topic,
            "answer": answer,
        })
    except Exception as exc:
        _output_error(f"QA search failed: {exc}")


# ═══════════════════════════════════════════════════════════════════════════════
#  COMMAND: brief
# ═══════════════════════════════════════════════════════════════════════════════

def cmd_brief(args: argparse.Namespace) -> None:
    """Build a configuration brief from a topology JSON (debugging/inspection)."""
    build_configuration_brief = _import_context_builder()

    topology_path = args.topology
    if not topology_path:
        _output_error("--topology path is required for brief command")

    topology_dict = _load_json_file(topology_path)

    try:
        brief = build_configuration_brief(topology_dict)
        _output_json({
            "success": True,
            "brief": brief,
            "brief_length": len(brief),
        })
    except Exception as exc:
        _output_error(f"Brief generation failed: {exc}")


# ═══════════════════════════════════════════════════════════════════════════════
#  COMMAND: manifest
# ═══════════════════════════════════════════════════════════════════════════════

def cmd_manifest(args: argparse.Namespace) -> None:
    """Generate image requirements checklist."""
    _, _, generate_image_manifest, _ = _import_agent()

    topology_path = args.topology
    if not topology_path:
        _output_error("--topology path is required for manifest command")

    topology_dict = _load_json_file(topology_path)

    template_image_map = _load_json_arg(getattr(args, "template_image_map", "{}") or "{}") or {}
    output_path = getattr(args, "output", None) or os.path.join(
        os.path.dirname(topology_path), "image_manifest.txt"
    )

    # Load catalog
    load_catalog, _ = _import_catalog()
    catalog = load_catalog(None)

    try:
        manifest_path = generate_image_manifest(
            topology_dict,
            template_image_map,
            output_path,
            catalog,
        )
        # Read the manifest file content
        with open(manifest_path, encoding="utf-8") as f:
            manifest_content = f.read()

        _output_json({
            "success": True,
            "manifest_path": manifest_path,
            "manifest_content": manifest_content,
        })
    except Exception as exc:
        _output_error(f"Manifest generation failed: {exc}")


# ═══════════════════════════════════════════════════════════════════════════════
#  COMMAND: validate
# ═══════════════════════════════════════════════════════════════════════════════

def cmd_validate(args: argparse.Namespace) -> None:
    """Validate a topology JSON file against the GNS3Project schema."""
    GNS3Project = _import_schema()

    topology_path = args.topology
    if not topology_path:
        _output_error("--topology path is required for validate command")

    topology_dict = _load_json_file(topology_path)

    try:
        validated = GNS3Project.model_validate(topology_dict)
        _output_json({
            "success": True,
            "valid": True,
            "node_count": len(validated.topology.nodes),
            "link_count": len(validated.topology.links),
        })
    except Exception as exc:
        _output_json({
            "success": True,
            "valid": False,
            "error": str(exc),
        })


# ═══════════════════════════════════════════════════════════════════════════════
#  CLI Argument Parser
# ═══════════════════════════════════════════════════════════════════════════════

def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="StructuraNet AI — Python wrapper for Node.js",
    )
    parser.add_argument("--verbose", "-v", action="store_true", help="Enable debug logging to stderr")

    subparsers = parser.add_subparsers(dest="command", help="Command to run")

    # ── generate ──────────────────────────────────────────────────────────
    p_gen = subparsers.add_parser("generate", help="Phase 1: Generate topology from natural language")
    p_gen.add_argument("--request", "-r", required=True, help="Network description in natural language")
    p_gen.add_argument("--inventory", type=str, default=None, help="JSON array of inventory items (or omit to use catalog)")
    p_gen.add_argument("--profile", type=str, default="{}", help="JSON object with profile settings")
    p_gen.add_argument("--chat-history", type=str, default="[]", help="JSON array of chat history messages")
    p_gen.add_argument("--security-profile", type=str, default="none", choices=["none", "basic", "enterprise"])
    p_gen.add_argument("--catalog-path", type=str, default=None, help="Path to custom appliance catalog JSON")
    p_gen.add_argument("--output-dir", type=str, default=None, help="Output directory for generated files")

    # ── edit ──────────────────────────────────────────────────────────────
    p_edit = subparsers.add_parser("edit", help="Phase 1 (edit): Re-generate with feedback")
    p_edit.add_argument("--feedback", "-f", required=True, help="Edit feedback from user")
    p_edit.add_argument("--topology", "-t", required=True, help="Path to current topology JSON")
    p_edit.add_argument("--chat-history", type=str, default="[]", help="JSON array of chat history messages")
    p_edit.add_argument("--original-request", type=str, default=None, help="Original user request string")
    p_edit.add_argument("--security-profile", type=str, default="none", choices=["none", "basic", "enterprise"])
    p_edit.add_argument("--profile", type=str, default="{}", help="JSON object with profile settings")
    p_edit.add_argument("--catalog-path", type=str, default=None, help="Path to custom appliance catalog JSON")
    p_edit.add_argument("--output-dir", type=str, default=None, help="Output directory")

    # ── export ────────────────────────────────────────────────────────────
    p_export = subparsers.add_parser("export", help="Phase 2 + GNS3 export")
    p_export.add_argument("--topology", "-t", required=True, help="Path to Phase 1 topology JSON")
    p_export.add_argument("--security-profile", type=str, default="none", choices=["none", "basic", "enterprise"])
    p_export.add_argument("--profile", type=str, default="{}", help="JSON object with profile settings")
    p_export.add_argument("--catalog-path", type=str, default=None, help="Path to custom appliance catalog JSON")
    p_export.add_argument("--output-dir", type=str, default=None, help="Output directory")
    p_export.add_argument("--no-validate", action="store_true", help="Skip GNS3 project validation")

    # ── qa ────────────────────────────────────────────────────────────────
    p_qa = subparsers.add_parser("qa", help="Cisco knowledge base search")
    p_qa.add_argument("--topic", required=True, help="Topic to search (e.g. 'OSPF configuration')")

    # ── brief ─────────────────────────────────────────────────────────────
    p_brief = subparsers.add_parser("brief", help="Build configuration brief")
    p_brief.add_argument("--topology", "-t", required=True, help="Path to topology JSON")

    # ── manifest ──────────────────────────────────────────────────────────
    p_manifest = subparsers.add_parser("manifest", help="Generate image requirements checklist")
    p_manifest.add_argument("--topology", "-t", required=True, help="Path to topology JSON")
    p_manifest.add_argument("--template-image-map", type=str, default="{}", help="JSON object: template_name -> image_filename")
    p_manifest.add_argument("--output", type=str, default=None, help="Output path for manifest .txt")

    # ── validate ──────────────────────────────────────────────────────────
    p_validate = subparsers.add_parser("validate", help="Validate topology JSON")
    p_validate.add_argument("--topology", "-t", required=True, help="Path to topology JSON")

    return parser


# ═══════════════════════════════════════════════════════════════════════════════
#  Main
# ═══════════════════════════════════════════════════════════════════════════════

COMMAND_MAP = {
    "generate": cmd_generate,
    "edit": cmd_edit,
    "export": cmd_export,
    "qa": cmd_qa,
    "brief": cmd_brief,
    "manifest": cmd_manifest,
    "validate": cmd_validate,
}


def main():
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
        _output_error(f"Unhandled exception: {exc}", details=str(exc.__class__.__name__))


if __name__ == "__main__":
    main()
