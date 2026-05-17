"""
pipeline_runner.py — Async wrappers that run the existing synchronous pipeline
modules in background threads and broadcast SSE events.

All long-running work (LLM calls, file I/O) is dispatched via
asyncio.to_thread() so the FastAPI event loop stays responsive.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
from pathlib import Path
from typing import Any, Dict, List, Optional

from structranet.ai.agent import (
    SessionState,
    _APPLIANCE_NODE_TYPES,
    _BUILTIN_NODE_TYPES,
    generate_image_manifest,
    generate_network_topology,
    process_and_save_topology,
)
from structranet.api.models import (
    ConfigTextChunk,
    ExportResponse,
    RequiredAppliance,
    ThoughtChunk,
    TopologyData,
    TopologyLink,
    TopologyNode,
    TopologySummary,
)
from structranet.ai.config_agent import run_phase2
from structranet.export.gns3_exporter import convert as export_gns3project
from structranet.export.validator import GNS3ProjectValidator
from structranet.utils import _build_design_review
from structranet.generation.preflight import check_topology_compatibility
from structranet.core.session import Session, SessionStore
from structranet.core.thought_parser import parse_thinking_text

logger = logging.getLogger("structranet.pipeline_runner")

# ═══════════════════════════════════════════════════════════════════════════════
#  Config streaming constants
# ═══════════════════════════════════════════════════════════════════════════════

# Characters per SSE chunk — small enough for smooth streaming,
# large enough to not flood the event queue.
CONFIG_CHUNK_SIZE = 6

# Delay between chunks (seconds) — controls streaming speed.
# 6 chars * 50/s ≈ 300 chars/sec (comfortable reading pace).
CONFIG_CHUNK_DELAY = 0.02

# Keys that carry configuration text inside node.properties.
_CONFIG_CONTENT_KEYS = (
    "startup_config_content",  # dynamips / iou / qemu routers
    "startup_script",          # vpcs hosts
    "start_command",           # docker containers
)


# ═══════════════════════════════════════════════════════════════════════════════
#  Data extraction helpers
# ═══════════════════════════════════════════════════════════════════════════════

_EMULATOR_CATEGORY = {
    "dynamips": "dynamips",
    "iou": "iou",
    "qemu": "qemu",
    "docker": "docker",
    "virtualbox": "qemu",
    "vmware": "qemu",
}


def build_topology_data(topology_dict: Dict[str, Any]) -> TopologyData:
    topo = topology_dict.get("topology", {})
    nodes_raw = topo.get("nodes", [])
    links_raw = topo.get("links", [])

    link_counts: Dict[str, int] = {}
    for link in links_raw:
        for ep in link.get("nodes", []):
            nid = ep.get("node_id", "")
            link_counts[nid] = link_counts.get(nid, 0) + 1

    topo_nodes = []
    for n in nodes_raw:
        topo_nodes.append(TopologyNode(
            node_id=n.get("node_id", ""),
            name=n.get("name", ""),
            node_type=n.get("node_type", ""),
            template_name=n.get("template_name", ""),
            link_count=link_counts.get(n.get("node_id", ""), 0),
        ))

    topo_links = []
    for link in links_raw:
        eps = link.get("nodes", [])
        if len(eps) >= 2:
            topo_links.append(TopologyLink(
                from_node=eps[0].get("node_id", ""),
                to_node=eps[1].get("node_id", ""),
                link_type=link.get("link_type", "ethernet"),
            ))

    return TopologyData(
        name=topology_dict.get("name", "Untitled"),
        nodes=topo_nodes,
        links=topo_links,
        node_count=len(topo_nodes),
        link_count=len(topo_links),
    )


def build_requirements_json(
    topology_dict: Dict[str, Any],
    template_image_map: Dict[str, str],
) -> List[RequiredAppliance]:
    topo = topology_dict.get("topology", {})
    nodes = topo.get("nodes", [])
    result: List[RequiredAppliance] = []

    for node in nodes:
        nid = node.get("node_id", "?")
        name = node.get("name", "?")
        ntype = node.get("node_type", "")
        template = node.get("template_name", "")

        if ntype in _BUILTIN_NODE_TYPES:
            result.append(RequiredAppliance(
                node_id=nid, name=name, node_type=ntype,
                template_name=template, category="builtin",
                image_required=False, image_file=None, status="builtin",
            ))
        elif ntype in _APPLIANCE_NODE_TYPES:
            image_file = template_image_map.get(template)
            cat = _EMULATOR_CATEGORY.get(ntype, "qemu")
            result.append(RequiredAppliance(
                node_id=nid, name=name, node_type=ntype,
                template_name=template, category=cat,
                image_required=True, image_file=image_file,
                status="ok" if image_file else "missing",
            ))
        else:
            result.append(RequiredAppliance(
                node_id=nid, name=name, node_type=ntype,
                template_name=template, category="builtin",
                image_required=False, image_file=None, status="builtin",
            ))

    return result


def _build_summary(
    thinking_text: str,
    thoughts: List[ThoughtChunk],
    topology_dict: Dict[str, Any],
    profile: Any,
    compatibility_issues: List[str],
) -> TopologySummary:
    design_review, assumptions = _build_design_review(
        topology_dict, profile, compatibility_issues,
    )
    return TopologySummary(
        thinking_text=thinking_text,
        thoughts=thoughts,
        design_review=design_review,
        assumptions=assumptions,
    )


# ═══════════════════════════════════════════════════════════════════════════════
#  Phase 1 — generate + enrich + manifest
# ═══════════════════════════════════════════════════════════════════════════════

async def run_phase1(
    session: Session,
    store: SessionStore,
    user_request: str,
) -> bool:
    session.phase = "generating"
    session.sub_phase = "thinking"
    session.error = None
    await store.broadcast(session, {
        "event": "phase_change",
        "data": {"phase": "generating", "sub_phase": "thinking"},
    })

    try:
        result, thinking_text, updated_history = await asyncio.to_thread(
            generate_network_topology,
            user_request,
            session.filtered_inventory,
            disallowed_node_types=session.blocked_types,
            security_profile=session.profile.security_profile,
            chat_history=session.state.chat_history,
        )
    except Exception as exc:
        logger.error("Phase 1 LLM call failed: %s", exc)
        session.phase = "error"
        session.sub_phase = None
        session.error = str(exc)
        await store.broadcast(session, {
            "event": "error",
            "data": {"message": str(exc), "phase": "generating"},
        })
        return False

    session.state.chat_history = updated_history
    session.state.thinking_text = thinking_text
    session.state.iteration += 1

    if result is None:
        session.phase = "error"
        session.sub_phase = None
        session.error = "AI generation failed after all retries"
        await store.broadcast(session, {
            "event": "error",
            "data": {"message": session.error, "phase": "generating"},
        })
        return False

    thoughts = parse_thinking_text(thinking_text)
    for thought in thoughts:
        await store.broadcast(session, {
            "event": "thought",
            "data": thought.model_dump(),
        })

    session.sub_phase = "building"
    await store.broadcast(session, {
        "event": "phase_change",
        "data": {"phase": "generating", "sub_phase": "building"},
    })

    session.raw_topology = result
    phase1_file = os.path.join(session.output_dir, "_topology.json")
    enriched = await asyncio.to_thread(
        process_and_save_topology, result, phase1_file,
    )

    if enriched is None:
        session.phase = "error"
        session.sub_phase = None
        session.error = "Hardware injection failed"
        await store.broadcast(session, {
            "event": "error",
            "data": {"message": session.error, "phase": "generating"},
        })
        return False

    session.topology_dict = enriched.model_dump()

    manifest_file = os.path.join(session.output_dir, "image_manifest.txt")
    await asyncio.to_thread(
        generate_image_manifest,
        session.topology_dict,
        session.profile.normalized_template_image_map,
        manifest_file,
    )

    session.topology_data = build_topology_data(session.topology_dict)
    await store.broadcast(session, {
        "event": "topology_ready",
        "data": session.topology_data.model_dump(),
    })

    session.requirements = build_requirements_json(
        session.topology_dict,
        session.profile.normalized_template_image_map,
    )
    await store.broadcast(session, {
        "event": "requirements_ready",
        "data": [r.model_dump() for r in session.requirements],
    })

    compatibility_issues = check_topology_compatibility(
        session.topology_dict, session.profile,
    )
    session.summary = _build_summary(
        thinking_text, thoughts, session.topology_dict,
        session.profile, compatibility_issues,
    )
    await store.broadcast(session, {
        "event": "summary_ready",
        "data": session.summary.model_dump(),
    })

    session.phase = "review"
    session.sub_phase = None
    await store.broadcast(session, {
        "event": "phase_change",
        "data": {"phase": "review", "sub_phase": None},
    })

    return True


# ═══════════════════════════════════════════════════════════════════════════════
#  Config text extraction + streaming
# ═══════════════════════════════════════════════════════════════════════════════

def _extract_device_configs(final_dict: Dict[str, Any]) -> List[Dict[str, str]]:
    """Pull configuration text from every node that has a config.

    Returns a list of dicts: [{"device_name": ..., "device_type": ..., "config_text": ...}]
    ordered so that routers come first, then hosts, then everything else.
    """
    topo = final_dict.get("topology", {}) if isinstance(final_dict, dict) else {}
    nodes = topo.get("nodes", []) if isinstance(topo, dict) else []

    _ROUTER_TYPES = {"dynamips", "iou", "qemu"}
    _HOST_TYPES = {"vpcs", "traceng"}

    routers: List[Dict[str, str]] = []
    hosts: List[Dict[str, str]] = []
    other: List[Dict[str, str]] = []

    for node in nodes:
        ntype = node.get("node_type", "")
        props = node.get("properties", {})
        name = node.get("name", node.get("node_id", ""))

        config_text = ""
        for key in _CONFIG_CONTENT_KEYS:
            val = props.get(key)
            if val and isinstance(val, str):
                config_text = val
                break

        if not config_text:
            continue

        entry = {
            "device_name": name,
            "device_type": ntype,
            "config_text": config_text,
        }

        if ntype in _ROUTER_TYPES:
            routers.append(entry)
        elif ntype in _HOST_TYPES:
            hosts.append(entry)
        else:
            other.append(entry)

    return routers + hosts + other


async def _stream_config_texts(
    session: Session,
    store: SessionStore,
    final_dict: Dict[str, Any],
) -> None:
    """Stream each device's config text chunk-by-chunk via SSE.

    After Phase 2 generates all configs, we simulate character-by-character
    streaming so the frontend can render configs as they arrive, just like
    Claude streams text.

    The configs are already complete (Phase 2 LLM call finished), so we are
    not waiting on the model — we are just delivering the text at a
    comfortable reading pace.
    """
    device_configs = _extract_device_configs(final_dict)

    if not device_configs:
        logger.info("No device configs found — skipping config streaming")
        return

    # Announce streaming phase
    session.sub_phase = "streaming_configs"
    await store.broadcast(session, {
        "event": "phase_change",
        "data": {"phase": "exporting", "sub_phase": "streaming_configs"},
    })

    for device in device_configs:
        name = device["device_name"]
        ntype = device["device_type"]
        text = device["config_text"]

        # Store in session for later download
        session.config_texts[name] = text

        # Stream chunk-by-chunk
        for i in range(0, len(text), CONFIG_CHUNK_SIZE):
            chunk = text[i : i + CONFIG_CHUNK_SIZE]
            await store.broadcast(session, {
                "event": "config_text",
                "data": ConfigTextChunk(
                    device_name=name,
                    device_type=ntype,
                    chunk=chunk,
                    start=(i == 0),
                    done=False,
                ).model_dump(),
            })
            await asyncio.sleep(CONFIG_CHUNK_DELAY)

        # Signal this device's config is complete
        await store.broadcast(session, {
            "event": "config_text",
            "data": ConfigTextChunk(
                device_name=name,
                device_type=ntype,
                chunk="",
                start=False,
                done=True,
            ).model_dump(),
        })

    logger.info(
        "Config streaming complete: %d device(s), %d total chars",
        len(device_configs),
        sum(len(d["config_text"]) for d in device_configs),
    )


# ═══════════════════════════════════════════════════════════════════════════════
#  Phase 2 + Export
# ═══════════════════════════════════════════════════════════════════════════════

async def run_phase2_and_export(
    session: Session,
    store: SessionStore,
) -> bool:
    session.phase = "exporting"
    session.sub_phase = "finalizing"
    session.error = None
    await store.broadcast(session, {
        "event": "phase_change",
        "data": {"phase": "exporting", "sub_phase": "finalizing"},
    })

    phase1_file = os.path.join(session.output_dir, "_topology.json")
    final_file = os.path.join(session.output_dir, "final_topology.json")

    await store.broadcast(session, {
        "event": "phase2_progress",
        "data": {"status": "generating_configs"},
    })

    try:
        final_dict = await asyncio.to_thread(
            run_phase2,
            phase1_file,
            final_file,
            security_profile=session.profile.security_profile,
        )
    except Exception as exc:
        logger.error("Phase 2 failed: %s", exc)
        session.phase = "error"
        session.sub_phase = None
        session.error = f"Phase 2 failed: {exc}"
        await store.broadcast(session, {
            "event": "error",
            "data": {"message": session.error, "phase": "exporting"},
        })
        return False

    if final_dict is None:
        logger.warning("Phase 2 returned None — falling back to Phase 1 topology")
        final_dict = session.topology_dict
        Path(final_file).write_text(
            json.dumps(final_dict, indent=2), encoding="utf-8",
        )

    session.final_dict = final_dict

    # ── Stream config texts via SSE before export ──────────────────────
    await _stream_config_texts(session, store, final_dict)

    # ── Update sub_phase back to finalizing for export ─────────────────
    session.sub_phase = "finalizing"
    await store.broadcast(session, {
        "event": "phase_change",
        "data": {"phase": "exporting", "sub_phase": "finalizing"},
    })

    await store.broadcast(session, {
        "event": "export_progress",
        "data": {"step": "exporting"},
    })

    project_output = os.path.join(session.output_dir, "final_topology.gns3project")
    config_review_dir = os.path.join(session.output_dir, "configs_review")

    try:
        project_path = await asyncio.to_thread(
            export_gns3project,
            final_dict,
            project_output,
            image_map=session.profile.normalized_template_image_map,
            config_review_dir=config_review_dir,
        )
    except Exception as exc:
        logger.error("GNS3 export failed: %s", exc)
        session.phase = "error"
        session.sub_phase = None
        session.error = f"Export failed: {exc}"
        await store.broadcast(session, {
            "event": "error",
            "data": {"message": session.error, "phase": "exporting"},
        })
        return False

    session.gns3project_path = project_path

    await store.broadcast(session, {
        "event": "export_progress",
        "data": {"step": "validating"},
    })

    try:
        validator = GNS3ProjectValidator(project_path, verbose=False)
        session.validator_passed = await asyncio.to_thread(validator.validate)
    except Exception as exc:
        logger.warning("Validation failed: %s", exc)
        session.validator_passed = None

    topo = final_dict.get("topology", {}) if isinstance(final_dict, dict) else {}
    nodes_list = topo.get("nodes", [])
    links_list = topo.get("links", [])
    configured = sum(
        1 for n in nodes_list
        if n.get("properties") and any(
            k in n["properties"]
            for k in ("startup_config_content", "startup_script", "start_command")
        )
    )

    file_size = 0
    try:
        file_size = Path(project_path).stat().st_size
    except OSError:
        pass

    session.phase = "success"
    session.sub_phase = None

    complete_data = ExportResponse(
        download_url=f"/api/sessions/{session.session_id}/download",
        validator_passed=session.validator_passed,
        file_size_bytes=file_size,
        node_count=len(nodes_list),
        link_count=len(links_list),
        configured_count=configured,
    )

    await store.broadcast(session, {
        "event": "complete",
        "data": complete_data.model_dump(),
    })
    await store.broadcast(session, {
        "event": "phase_change",
        "data": {"phase": "success", "sub_phase": None},
    })

    return True
