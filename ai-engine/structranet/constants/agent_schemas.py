"""
agent_schemas.py — Pydantic v2 schemas for the Tool-Calling Conversational Agent.

Architecture: NO FSM. NO IntentType enum. The LLM itself is the orchestrator —
it decides which tools to call based on the conversation context and history.

Defines:
  - AgentSessionData: per-session context (conversation history + topology artifacts)
  - AgentResponse:    unified response envelope returned to the FastAPI layer
  - TOOL_DEFINITIONS: OpenAI-compatible function schemas for the 4 backend tools

Pipeline:
  User message → LLM (with tools) → tool_calls? → execute → loop → text reply

The FSM-era SessionState / IntentType / ConversationMessage types have been
removed. The chat_orchestrator.py module replaced them with direct LLM tool
calling, which handles compound intents, context switching, and clarifying
questions without a hand-written state machine.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


# ═══════════════════════════════════════════════════════════════════════════════
#  Per-Session Agent State
# ═══════════════════════════════════════════════════════════════════════════════

class AgentSessionData(BaseModel):
    """
    All mutable state the agent needs to continue a multi-turn conversation.

    The LLM reads ``conversation_history`` and the topology context fields
    via a dynamically constructed system prompt to decide what to do next.
    No state machine is stored here — the LLM is the orchestrator.

    Attributes
    ----------
    conversation_history:
        Full OpenAI-compatible message list (user / assistant / tool roles).
        Includes ``tool_calls`` and ``tool_call_id`` fields where applicable.
        The system prompt is built dynamically and is NOT stored here.
    topology_dict:
        The most recent hardware-injected topology dict produced by a
        generate or modify tool call.  Persisted across conversation turns.
    phase1_file:
        Filesystem path to the Phase 1 JSON file written by
        ``process_and_save_topology``.  Required by ``run_phase2_and_export``.
    original_request:
        The user's original design requirement string.  Used as the anchor
        when re-running Phase 1 during edit iterations.
    edit_iterations:
        How many ``modify_current_topology`` calls have been made this session.
    max_edit_iterations:
        Hard cap on edit iterations to prevent infinite loops.
    topology_approved:
        ``True`` once the user has accepted the topology and called
        ``apply_security_and_export``.  Reset to ``False`` after every edit.
    """

    conversation_history: List[Dict[str, Any]] = Field(default_factory=list)
    topology_dict: Optional[Dict[str, Any]] = None
    phase1_file: Optional[str] = None
    original_request: Optional[str] = None
    edit_iterations: int = 0
    max_edit_iterations: int = 10
    topology_approved: bool = False


# ═══════════════════════════════════════════════════════════════════════════════
#  Agent Response
# ═══════════════════════════════════════════════════════════════════════════════

class AgentResponse(BaseModel):
    """
    Unified envelope the chat orchestrator returns for every user turn.

    The FastAPI ``/agent/chat`` endpoint serialises this directly.
    Topology data, config text streaming, and progress events are delivered
    separately via the SSE ``/sessions/{id}/events`` stream — they do NOT
    appear in this envelope.

    Attributes
    ----------
    message:
        The LLM's final natural-language reply after all tool calls complete.
    tool_calls_made:
        Ordered list of tool names invoked during this turn (empty for pure
        chat responses).  Used by the frontend to show activity indicators.
    """

    message: str
    tool_calls_made: List[str] = Field(default_factory=list)


# ═══════════════════════════════════════════════════════════════════════════════
#  Tool Definitions  (OpenAI Function Calling schema)
# ═══════════════════════════════════════════════════════════════════════════════

TOOL_DEFINITIONS: List[Dict[str, Any]] = [
    {
        "type": "function",
        "function": {
            "name": "generate_new_topology",
            "description": (
                "Design and generate a new network topology from scratch based on "
                "the user's requirements. This creates the logical topology, assigns "
                "hardware, patches VLANs, and produces a GNS3-compatible draft. "
                "Call this whenever the user wants to create or design a new network. "
                "If the user also mentions a security profile in the same message "
                "(e.g., 'design X with enterprise security'), call this tool first, "
                "wait for the result, then call apply_security_and_export."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "requirements": {
                        "type": "string",
                        "description": (
                            "The user's network design requirements in natural language. "
                            "Include all details: topology type, number of devices, "
                            "connections, protocols, etc."
                        ),
                    },
                },
                "required": ["requirements"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "modify_current_topology",
            "description": (
                "Modify the current topology draft based on user feedback. "
                "Only call this when a topology draft already exists and the user "
                "wants to change, add, or remove something. If no topology exists, "
                "call generate_new_topology instead."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "feedback": {
                        "type": "string",
                        "description": (
                            "The specific changes the user wants to make to the "
                            "current topology. Be precise about what to add, remove, "
                            "or modify."
                        ),
                    },
                },
                "required": ["feedback"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "apply_security_and_export",
            "description": (
                "Apply a security hardening profile to the approved topology, "
                "generate full device configurations (IP addressing, routing, "
                "security configs), and export the complete GNS3 project file. "
                "Call this when the user is satisfied with the topology design and "
                "wants to finalize and export. You must specify which security "
                "profile to use. If the user has not specified one, ask them first."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "security_profile": {
                        "type": "string",
                        "enum": ["none", "basic", "enterprise"],
                        "description": (
                            "The security hardening profile to apply:\n"
                            "- 'none': No hardening — pure lab topology\n"
                            "- 'basic': SSH, AAA, banners, NTP, Syslog\n"
                            "- 'enterprise': Full ZBF, ACLs, DAI, DHCP Snooping, "
                            "SNMPv3, HSRP, uRPF, OSPF auth"
                        ),
                    },
                },
                "required": ["security_profile"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "search_cisco_knowledge",
            "description": (
                "Search the Cisco IOS knowledge base for specific commands, "
                "protocol configurations, troubleshooting steps, or security hardening/features "
                "(e.g., Port Security, AAA, VPN, ZBF). Call this when "
                "the user asks about how to configure something on a Cisco device "
                "(e.g., OSPF, VLANs, ACLs, NAT, HSRP, Zone-Based Firewall). Returns formatted Markdown "
                "with IOS command examples."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "topic": {
                        "type": "string",
                        "description": (
                            "The networking topic, protocol, or security feature to search for. "
                            "Examples: 'OSPF configuration', 'VLAN trunking', "
                            "'HSRP setup', 'NAT overload', 'access-list', 'Port Security', 'IKEv2 VPN'"
                        ),
                    },
                },
                "required": ["topic"],
            },
        },
    },
]