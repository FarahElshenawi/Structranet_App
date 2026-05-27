"""
chat_orchestrator.py — LLM Tool-Calling Orchestrator for StructuraNet AI.

Architecture: NO FSM. NO Intent Router. The LLM IS the orchestrator.

The LLM receives the conversation history + 4 tool definitions and decides
autonomously which tools to call (if any). This handles:
  - Simple chat (no tools needed)
  - Compound intents ("design a network AND apply enterprise security")
  - Context switching (user interrupts a flow)
  - Clarifying questions (LLM asks if security profile is missing)

Execution Flow:
  1. Append user message to conversation history.
  2. Call LLM with messages + tool definitions.
  3. If LLM returns text → broadcast to user. Done.
  4. If LLM triggers tool_call(s) → execute the Python backend function.
     - Tool handlers broadcast their own SSE events (topology_ready, etc.)
     - Append tool result as role="tool" message.
     - Loop back to step 2 (LLM reads tool result, may call more tools or reply).
  5. When LLM finally returns text (no more tool_calls), broadcast and return.

Tools:
  - generate_new_topology(requirements) → Phase 1
  - modify_current_topology(feedback)   → Phase 1 (edit)
  - apply_security_and_export(security_profile) → Phase 2 + GNS3 export
  - search_cisco_knowledge(topic)       → QA handler
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
from pathlib import Path
from typing import Any, Dict, List, Optional

from structranet.core.session import Session, SessionStore
from structranet.core.pipeline import (
    build_topology_data,
    build_requirements_json,
    run_phase2_and_export,
)
from structranet.ai.agent import (
    generate_network_topology,
    process_and_save_topology,
    generate_image_manifest,
)
from structranet.ai.llm_utils import _call_with_retry, _get_client
from structranet.ai.qa_handler import answer_qa
from structranet.core.thought_parser import parse_thinking_text
from structranet.utils import _build_design_review
from structranet.generation.preflight import check_topology_compatibility
from structranet.api.models import TopologySummary

from structranet.constants.agent_schemas import (
    AgentResponse,
    AgentSessionData,
    TOOL_DEFINITIONS,
)

logger = logging.getLogger("structranet.chat_orchestrator")

_MAX_EDIT_ITERATIONS = 10
_MAX_TOOL_ROUNDS = 6   # Safety: prevent infinite tool-call loops
_MAX_HISTORY_TURNS = 30  # Keep conversation bounded for token limits


# ═══════════════════════════════════════════════════════════════════════════════
#  Agent session data helpers
# ═══════════════════════════════════════════════════════════════════════════════

def _get_agent_data(session: Session) -> AgentSessionData:
    """Retrieve or initialise AgentSessionData stored on the Session object."""
    raw = getattr(session, "_agent_data", None)
    if raw is None or not isinstance(raw, AgentSessionData):
        raw = AgentSessionData()
        session._agent_data = raw  # type: ignore[attr-defined]
    return raw


def _save_agent_data(session: Session, data: AgentSessionData) -> None:
    session._agent_data = data  # type: ignore[attr-defined]


def _trim_history(data: AgentSessionData) -> None:
    """Keep conversation bounded to avoid token overflow.

    We preserve tool_call / tool message pairs (they must stay together).
    Simple heuristic: drop the oldest messages until we're under the limit.
    Never drop the last 4 messages (current exchange).
    """
    history = data.conversation_history
    if len(history) <= _MAX_HISTORY_TURNS:
        return

    # Keep the most recent messages
    data.conversation_history = history[-_MAX_HISTORY_TURNS:]


# ═══════════════════════════════════════════════════════════════════════════════
#  System Prompt Builder
# ═══════════════════════════════════════════════════════════════════════════════

def _build_system_prompt(data: AgentSessionData) -> str:
    """Build a context-aware system prompt that tells the LLM the current state
    of the session so it can make intelligent tool-calling decisions."""

    has_topology = data.topology_dict is not None
    topo_info = ""
    if has_topology:
        topo = data.topology_dict.get("topology", {})
        nodes = topo.get("nodes", [])
        links = topo.get("links", [])
        node_names = [n.get("name", "?") for n in nodes[:10]]
        topo_info = (
            f"\n  - A topology draft EXISTS with {len(nodes)} nodes and {len(links)} links."
            f"\n  - Devices: {', '.join(node_names)}"
            f"\n  - The user can modify it (modify_current_topology) or approve it."
        )
        if data.topology_approved:
            topo_info += (
                "\n  - The topology has been APPROVED by the user."
                "\n  - The next step is to call apply_security_and_export."
            )
        else:
            topo_info += (
                "\n  - The topology has NOT been approved yet."
                "\n  - Wait for the user to approve before calling apply_security_and_export."
            )
    else:
        topo_info = (
            "\n  - No topology draft exists yet."
            "\n  - The user must first request a design (generate_new_topology)."
        )

    return f"""You are StructuraNet AI, an expert network engineer and GNS3 topology designer.

You help users design, review, modify, and export GNS3 network topologies. You also answer Cisco IOS configuration questions.

CURRENT SESSION CONTEXT:{topo_info}
  - Edit iterations used: {data.edit_iterations}/{data.max_edit_iterations}

YOUR PERSONALITY:
  - Professional yet friendly. You speak like a senior network engineer.
  - You are decisive — when the user gives you requirements, you design.
  - You explain your reasoning briefly before and after taking actions.
  - NEVER use placeholder names like 'OWL' or reference AI models.

TOOL USAGE RULES:

1. **generate_new_topology**: Call when the user wants a NEW network design.
   - Include ALL user requirements in the 'requirements' parameter.
   - After the tool succeeds, describe the topology to the user and ask if they want changes.

2. **modify_current_topology**: Call ONLY when a topology draft exists and the user wants changes.
   - If no topology exists, call generate_new_topology instead.
   - Include the specific change request in the 'feedback' parameter.

3. **apply_security_and_export**: Call when the user has approved the topology and wants to export.
   - You MUST specify a security_profile: 'none', 'basic', or 'enterprise'.
   - If the user approves but doesn't mention a security profile, ASK them to choose before calling this tool.
   - Describe what each profile offers so they can make an informed choice:
     * 'none': No hardening — pure lab topology, universal compatibility
     * 'basic': SSH, AAA, banners, NTP, Syslog on every router
     * 'enterprise': Full Zone-Based Firewall, ACLs, DAI, DHCP Snooping, SNMPv3, HSRP, uRPF, OSPF auth

4. **search_cisco_knowledge**: Call when the user asks about Cisco IOS commands, protocol configuration, or security hardening/features (e.g., Port Security, AAA, VPN, ZBF).
   - Returns Markdown with code blocks showing exact IOS commands.
   - Use this for "how do I configure X" or "how to secure Y" questions, not for topology design.

COMPOUND INTENTS:
If the user combines multiple actions in one message (e.g., "Design a campus network and apply enterprise security"), handle them sequentially:
  1. Call generate_new_topology first.
  2. Wait for the result.
  3. Then immediately call apply_security_and_export with the requested profile.
  4. Respond to the user with a summary of both actions.

CLARIFYING QUESTIONS:
- If the user approves a topology but doesn't specify a security profile, ASK before calling apply_security_and_export.
- If the user's requirements are too vague for topology generation, ask for more details.
- If the user's request is ambiguous, ask a brief clarifying question.

GENERAL CONVERSATION:
- For greetings, small talk, or off-topic messages, respond conversationally.
- You may gently steer the conversation toward network design if appropriate.
- For questions about your capabilities, explain what you can do.
"""


# ═══════════════════════════════════════════════════════════════════════════════
#  LLM Call Helper
# ═══════════════════════════════════════════════════════════════════════════════

async def _call_llm(
    messages: List[Dict[str, Any]],
    tools: List[Dict[str, Any]],
) -> Any:
    """Call the LLM with messages + tool definitions. Returns the raw response."""
    client = _get_client()

    model = "openai/gpt-oss-120b:free"

    def _api_call():
        return client.chat.completions.create(
            model=model,
            messages=messages,
            tools=tools,
            tool_choice="auto",
            max_tokens=int(os.getenv("AI_MAX_TOKENS", "4096")),
        )

    return await asyncio.to_thread(_call_with_retry, _api_call)


# ═══════════════════════════════════════════════════════════════════════════════
#  Tool Handlers — each returns a JSON string (tool result for the LLM)
# ═══════════════════════════════════════════════════════════════════════════════

async def _tool_generate_new_topology(
    requirements: str,
    session: Session,
    store: SessionStore,
    data: AgentSessionData,
) -> str:
    """Execute Phase 1 topology generation and return a structured result."""

    # Update session phase for frontend compatibility
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
            requirements,
            session.filtered_inventory,
            disallowed_node_types=session.blocked_types,
            security_profile="none",  # hardening applied later in Phase 2
            chat_history=session.state.chat_history,
        )
    except Exception as exc:
        logger.error("Phase 1 generation error: %s", exc)
        session.phase = "error"
        session.error = str(exc)
        await store.broadcast(session, {
            "event": "error",
            "data": {"message": str(exc), "phase": "generating"},
        })
        return json.dumps({
            "success": False,
            "error": f"Topology generation failed: {exc}",
            "hint": "Ask the user to rephrase their requirements or reduce complexity.",
        })

    if result is None:
        session.phase = "error"
        session.error = "AI generation failed after all retries"
        await store.broadcast(session, {
            "event": "error",
            "data": {"message": session.error, "phase": "generating"},
        })
        return json.dumps({
            "success": False,
            "error": "Generation failed after multiple attempts.",
            "hint": "Ask the user to simplify their requirements.",
        })

    # Update pipeline chat history
    session.state.chat_history = updated_history
    session.state.thinking_text = thinking_text
    session.state.iteration += 1

    # Broadcast thought events
    thoughts = parse_thinking_text(thinking_text)
    for thought in thoughts:
        await store.broadcast(session, {
            "event": "thought",
            "data": thought.model_dump(),
        })

    # Hardware injection + VLAN patching
    session.sub_phase = "building"
    await store.broadcast(session, {
        "event": "phase_change",
        "data": {"phase": "generating", "sub_phase": "building"},
    })

    session.raw_topology = result
    phase1_file = os.path.join(session.output_dir, "_topology.json")
    enriched = await asyncio.to_thread(process_and_save_topology, result, phase1_file)

    if enriched is None:
        session.phase = "error"
        session.error = "Hardware injection failed"
        await store.broadcast(session, {
            "event": "error",
            "data": {"message": session.error, "phase": "generating"},
        })
        return json.dumps({
            "success": False,
            "error": "Hardware configuration injection failed.",
            "hint": "Ask the user to simplify the topology.",
        })

    topology_dict = enriched.model_dump()

    # Persist on agent data
    data.topology_dict = topology_dict
    data.phase1_file = phase1_file
    data.original_request = requirements
    data.topology_approved = False  # new draft, not yet approved
    data.edit_iterations = 0

    # Update session artifacts
    session.topology_dict = topology_dict
    session.topology_data = build_topology_data(topology_dict)
    session.requirements = build_requirements_json(
        topology_dict,
        session.profile.normalized_template_image_map,
    )

    # Image manifest
    manifest_file = os.path.join(session.output_dir, "image_manifest.txt")
    await asyncio.to_thread(
        generate_image_manifest,
        session.topology_dict,
        session.profile.normalized_template_image_map,
        manifest_file,
    )

    # Design summary
    compatibility_issues = check_topology_compatibility(session.topology_dict, session.profile)
    design_review, assumptions = _build_design_review(
        topology_dict, session.profile, compatibility_issues,
    )
    session.summary = TopologySummary(
        thinking_text=thinking_text,
        thoughts=thoughts,
        design_review=design_review,
        assumptions=assumptions,
    )

    # Broadcast topology + requirements + summary
    await store.broadcast(session, {
        "event": "topology_ready",
        "data": session.topology_data.model_dump(),
    })
    await store.broadcast(session, {
        "event": "requirements_ready",
        "data": [r.model_dump() for r in session.requirements],
    })
    await store.broadcast(session, {
        "event": "summary_ready",
        "data": session.summary.model_dump(),
    })

    # Update session phase
    session.phase = "review"
    session.sub_phase = None
    await store.broadcast(session, {
        "event": "phase_change",
        "data": {"phase": "review", "sub_phase": None},
    })

    # Build result for LLM
    topo = topology_dict.get("topology", {})
    nodes = topo.get("nodes", [])
    links = topo.get("links", [])
    node_summary = ", ".join(n.get("name", "?") for n in nodes[:15])

    return json.dumps({
        "success": True,
        "node_count": len(nodes),
        "link_count": len(links),
        "devices": node_summary,
        "phase1_file": phase1_file,
        "message": (
            f"Successfully generated a topology with {len(nodes)} nodes and "
            f"{len(links)} links. Devices: {node_summary}. "
            f"The user can now request modifications or approve the design."
        ),
    })


async def _tool_modify_current_topology(
    feedback: str,
    session: Session,
    store: SessionStore,
    data: AgentSessionData,
) -> str:
    """Execute Phase 1 with edit feedback and return a structured result."""

    if data.topology_dict is None:
        return json.dumps({
            "success": False,
            "error": "No topology draft exists to modify.",
            "hint": "Tell the user there is no topology to edit. Suggest they first request a new design.",
        })

    if data.edit_iterations >= data.max_edit_iterations:
        return json.dumps({
            "success": False,
            "error": f"Maximum edit iterations ({data.max_edit_iterations}) reached.",
            "hint": "Tell the user the edit limit has been reached and suggest they approve the current design or start fresh.",
        })

    # Append edit feedback to the pipeline's chat history
    session.state.chat_history.append({
        "role": "user",
        "content": (
            f"Please modify the topology based on this feedback: {feedback}\n"
            "Return the complete updated design in the same CoT JSON envelope format."
        ),
    })

    data.edit_iterations += 1

    # Re-run Phase 1 with the same original request (the edit feedback is in chat_history)
    requirement = data.original_request or feedback

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
            requirement,
            session.filtered_inventory,
            disallowed_node_types=session.blocked_types,
            security_profile="none",
            chat_history=session.state.chat_history,
        )
    except Exception as exc:
        logger.error("Phase 1 edit error: %s", exc)
        session.phase = "error"
        session.error = str(exc)
        await store.broadcast(session, {
            "event": "error",
            "data": {"message": str(exc), "phase": "generating"},
        })
        return json.dumps({
            "success": False,
            "error": f"Edit generation failed: {exc}",
        })

    if result is None:
        session.phase = "error"
        await store.broadcast(session, {
            "event": "error",
            "data": {"message": "Edit generation failed after retries", "phase": "generating"},
        })
        return json.dumps({
            "success": False,
            "error": "Edit generation failed after multiple attempts.",
        })

    session.state.chat_history = updated_history
    session.state.thinking_text = thinking_text
    session.state.iteration += 1

    # Broadcast thoughts
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
    phase1_file = data.phase1_file or os.path.join(session.output_dir, "_topology.json")
    enriched = await asyncio.to_thread(process_and_save_topology, result, phase1_file)

    if enriched is None:
        session.phase = "error"
        await store.broadcast(session, {
            "event": "error",
            "data": {"message": "Hardware injection failed during edit", "phase": "generating"},
        })
        return json.dumps({
            "success": False,
            "error": "Hardware injection failed during edit.",
        })

    topology_dict = enriched.model_dump()

    # Update agent data
    data.topology_dict = topology_dict
    data.phase1_file = phase1_file
    data.topology_approved = False  # reset approval after edit

    # Update session artifacts
    session.topology_dict = topology_dict
    session.topology_data = build_topology_data(topology_dict)
    session.requirements = build_requirements_json(
        topology_dict,
        session.profile.normalized_template_image_map,
    )

    # Design summary
    compatibility_issues = check_topology_compatibility(session.topology_dict, session.profile)
    design_review, assumptions = _build_design_review(
        topology_dict, session.profile, compatibility_issues,
    )
    session.summary = TopologySummary(
        thinking_text=thinking_text,
        thoughts=thoughts,
        design_review=design_review,
        assumptions=assumptions,
    )

    # Broadcast updated topology
    await store.broadcast(session, {
        "event": "topology_ready",
        "data": session.topology_data.model_dump(),
    })
    await store.broadcast(session, {
        "event": "requirements_ready",
        "data": [r.model_dump() for r in session.requirements],
    })
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

    topo = topology_dict.get("topology", {})
    nodes = topo.get("nodes", [])
    links = topo.get("links", [])
    node_summary = ", ".join(n.get("name", "?") for n in nodes[:15])

    return json.dumps({
        "success": True,
        "node_count": len(nodes),
        "link_count": len(links),
        "devices": node_summary,
        "edit_iterations_remaining": data.max_edit_iterations - data.edit_iterations,
        "message": (
            f"Successfully modified the topology. Now {len(nodes)} nodes and "
            f"{len(links)} links. Devices: {node_summary}. "
            f"Edit iterations remaining: {data.max_edit_iterations - data.edit_iterations}."
        ),
    })


async def _tool_apply_security_and_export(
    security_profile: str,
    session: Session,
    store: SessionStore,
    data: AgentSessionData,
) -> str:
    """Apply security profile, run Phase 2, export GNS3 project."""

    if data.topology_dict is None:
        return json.dumps({
            "success": False,
            "error": "No topology exists to configure and export.",
            "hint": "Tell the user they need to design a topology first.",
        })

    if security_profile not in ("none", "basic", "enterprise"):
        return json.dumps({
            "success": False,
            "error": f"Invalid security profile: '{security_profile}'. Must be 'none', 'basic', or 'enterprise'.",
            "hint": "Ask the user to choose one of the three profiles.",
        })

    # Mark topology as approved
    data.topology_approved = True

    # Apply the chosen profile to the session
    session.profile.security_profile = security_profile

    # Delegate to the existing pipeline runner (handles all SSE broadcasts)
    success = await run_phase2_and_export(session, store)

    if not success:
        data.topology_approved = False  # revert
        return json.dumps({
            "success": False,
            "error": "Configuration generation or GNS3 export failed.",
            "hint": "Tell the user the export failed. The topology draft is still available for edits or retry.",
        })

    profile_labels = {
        "none":       "no hardening (pure lab)",
        "basic":      "basic hardening (SSH, AAA, NTP, Syslog)",
        "enterprise": "enterprise-grade hardening (ZBF, ACLs, SNMPv3, HSRP)",
    }

    return json.dumps({
        "success": True,
        "security_profile": security_profile,
        "profile_description": profile_labels.get(security_profile, security_profile),
        "download_url": f"/sessions/{session.session_id}/download",
        "validator_passed": session.validator_passed,
        "message": (
            f"Successfully exported GNS3 project with '{profile_labels.get(security_profile, security_profile)}' "
            f"security profile. The user can download the .gns3project file, device configurations, "
            f"and requirements manifest."
        ),
    })


async def _tool_search_cisco_knowledge(
    topic: str,
    session: Session,
    store: SessionStore,
    data: AgentSessionData,
) -> str:
    """Search the Cisco knowledge base and return a Markdown answer."""

    try:
        answer = await asyncio.to_thread(answer_qa, topic, topic)
    except Exception as exc:
        logger.error("QA handler error: %s", exc)
        return json.dumps({
            "success": False,
            "error": f"Knowledge search failed: {exc}",
        })

    return json.dumps({
        "success": True,
        "topic": topic,
        "answer": answer,
        "message": f"Found information about '{topic}'. Use the answer to respond to the user.",
    })


# ═══════════════════════════════════════════════════════════════════════════════
#  Tool Execution Router
# ═══════════════════════════════════════════════════════════════════════════════

async def _execute_tool_call(
    tool_name: str,
    tool_args: Dict[str, Any],
    session: Session,
    store: SessionStore,
    data: AgentSessionData,
) -> str:
    """Route a tool call to the correct handler. Returns JSON string result."""

    if tool_name == "generate_new_topology":
        requirements = tool_args.get("requirements", "")
        return await _tool_generate_new_topology(requirements, session, store, data)

    elif tool_name == "modify_current_topology":
        feedback = tool_args.get("feedback", "")
        return await _tool_modify_current_topology(feedback, session, store, data)

    elif tool_name == "apply_security_and_export":
        profile = tool_args.get("security_profile", "none")
        return await _tool_apply_security_and_export(profile, session, store, data)

    elif tool_name == "search_cisco_knowledge":
        topic = tool_args.get("topic", "")
        return await _tool_search_cisco_knowledge(topic, session, store, data)

    else:
        return json.dumps({
            "success": False,
            "error": f"Unknown tool: {tool_name}",
        })


# ═══════════════════════════════════════════════════════════════════════════════
#  Main Dispatch Function
# ═══════════════════════════════════════════════════════════════════════════════

async def dispatch(
    user_message: str,
    session: Session,
    store: SessionStore,
) -> AgentResponse:
    """
    Central dispatcher — called by the FastAPI /agent/chat endpoint.

    Uses LLM Tool Calling (Function Calling) instead of a rigid FSM.
    The LLM decides which tools to call based on the conversation context.

    Flow:
      1. Append user message to history.
      2. Call LLM with messages + tools.
      3. If text response → broadcast and return.
      4. If tool_calls → execute → append result → loop to step 2.
      5. Return final LLM text response.
    """
    data = _get_agent_data(session)

    logger.info(
        "[session=%s] dispatch: '%s' (history_len=%d, has_topology=%s)",
        session.session_id,
        user_message[:80],
        len(data.conversation_history),
        data.topology_dict is not None,
    )

    # ── 1. Append user message to conversation history ────────────────────────
    data.conversation_history.append({"role": "user", "content": user_message})
    _trim_history(data)

    # ── 2. Tool-calling loop ─────────────────────────────────────────────────
    tool_calls_made: List[str] = []
    final_text = ""

    for round_num in range(1, _MAX_TOOL_ROUNDS + 1):
        # Build messages array: system prompt + conversation history
        system_prompt = _build_system_prompt(data)
        messages = [{"role": "system", "content": system_prompt}] + data.conversation_history

        logger.info(
            "[session=%s] LLM call round %d (messages=%d)",
            session.session_id, round_num, len(messages),
        )

        # Call LLM
        try:
            response = await _call_llm(messages, TOOL_DEFINITIONS)
        except Exception as exc:
            logger.error("LLM call failed: %s", exc)
            final_text = (
                "I'm having trouble connecting to my reasoning engine right now. "
                "Please try again in a moment."
            )
            break

        if not response or not response.choices:
            final_text = "I couldn't generate a response. Please try again."
            break

        choice = response.choices[0]
        assistant_message = choice.message

        # ── Store the assistant message in history ────────────────────────────
        # Convert to dict, preserving tool_calls if present
        msg_dict: Dict[str, Any] = {"role": "assistant"}
        if assistant_message.content:
            msg_dict["content"] = assistant_message.content
        if assistant_message.tool_calls:
            msg_dict["tool_calls"] = [
                {
                    "id": tc.id,
                    "type": "function",
                    "function": {
                        "name": tc.function.name,
                        "arguments": tc.function.arguments,
                    },
                }
                for tc in assistant_message.tool_calls
            ]
        # Ensure content key exists (OpenAI API expects it)
        if "content" not in msg_dict:
            msg_dict["content"] = None

        data.conversation_history.append(msg_dict)

        # ── No tool calls → LLM is done, this is the final text response ─────
        if not assistant_message.tool_calls:
            final_text = assistant_message.content or ""
            break

        # ── Execute each tool call ────────────────────────────────────────────
        for tool_call in assistant_message.tool_calls:
            tool_name = tool_call.function.name
            tool_args_str = tool_call.function.arguments
            tool_call_id = tool_call.id

            logger.info(
                "[session=%s] Tool call: %s(%s)",
                session.session_id, tool_name, tool_args_str[:200],
            )

            # Parse arguments
            try:
                tool_args = json.loads(tool_args_str)
            except json.JSONDecodeError:
                tool_args = {}

            tool_calls_made.append(tool_name)

            # Execute the tool
            try:
                result_str = await _execute_tool_call(
                    tool_name, tool_args, session, store, data,
                )
            except Exception as exc:
                logger.error("Tool execution error (%s): %s", tool_name, exc, exc_info=True)
                result_str = json.dumps({
                    "success": False,
                    "error": f"Tool execution failed: {exc}",
                })

            # Append tool result to history
            tool_msg = {
                "role": "tool",
                "tool_call_id": tool_call_id,
                "content": result_str,
            }
            data.conversation_history.append(tool_msg)

            logger.info(
                "[session=%s] Tool result: %s",
                session.session_id,
                result_str[:200],
            )

        # ── Trim history and loop back for next LLM call ──────────────────────
        _trim_history(data)

    else:
        # Safety: we hit _MAX_TOOL_ROUNDS
        logger.warning(
            "[session=%s] Hit max tool rounds (%d)",
            session.session_id, _MAX_TOOL_ROUNDS,
        )
        if not final_text:
            final_text = (
                "I've completed several actions but may not have finished everything. "
                "Let me know if you'd like me to continue or if something is missing."
            )

    # ── 3. Broadcast final message and save state ────────────────────────────
    if not final_text:
        final_text = "I'm here to help! What would you like to do?"

    await store.broadcast(session, {
        "event": "agent_message",
        "data": {
            "message": final_text,
            "tool_calls_made": tool_calls_made,
        },
    })

    _save_agent_data(session, data)

    logger.info(
        "[session=%s] Response: tools=%s, text_len=%d",
        session.session_id,
        tool_calls_made,
        len(final_text),
    )

    return AgentResponse(
        message=final_text,
        tool_calls_made=tool_calls_made,
    )
