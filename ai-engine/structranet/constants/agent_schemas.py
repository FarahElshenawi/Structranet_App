"""
agent_schemas.py — Pydantic v2 schemas for the Tool-Calling Conversational Agent.

NO FSM. NO IntentType enum. The LLM itself is the orchestrator — it decides
which tools to call based on the conversation context.

Defines:
  - AgentSessionData: per-session context (history + topology artifacts)
  - AgentResponse: unified response envelope returned to FastAPI
  - TOOL_DEFINITIONS: OpenAI-compatible function schemas for the 4 tools

Architecture:
  User message → LLM (with tools) → tool_calls? → execute → loop → text reply
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


# ═══════════════════════════════════════════════════════════════════════════════
#  Per-Session Agent State
# ═══════════════════════════════════════════════════════════════════════════════

class AgentSessionData(BaseModel):
    """
    Everything the agent needs to continue a multi-turn conversation.

    NO state machine — the LLM reads the conversation history and topology
    context variables to decide what to do next.
    """
    # Full OpenAI-compatible conversation history.
    # Includes user / assistant / tool messages (with tool_calls, tool_call_id).
    # The system prompt is built dynamically and NOT stored here.
    conversation_history: List[Dict[str, Any]] = Field(default_factory=list)

    # ── Topology context (set by tool handlers, read by system prompt) ────
    # The topology dict produced by generate/modify (persisted across turns)
    topology_dict: Optional[Dict[str, Any]] = None

    # Path to the Phase 1 JSON file on disk (needed by Phase 2)
    phase1_file: Optional[str] = None

    # The original user request (used for edit re-runs)
    original_request: Optional[str] = None

    # Edit iteration counter (guard against infinite edit loops)
    edit_iterations: int = 0
    max_edit_iterations: int = 10

    # Whether the current topology has been approved by the user
    topology_approved: bool = False


# ═══════════════════════════════════════════════════════════════════════════════
#  Agent Response  (returned to FastAPI → SSE → frontend)
# ═══════════════════════════════════════════════════════════════════════════════

class AgentResponse(BaseModel):
    """
    Unified envelope the orchestrator returns for every user turn.

    Much simpler than the FSM version — the LLM handles all routing logic.
    The frontend gets:
      - message: the LLM's natural-language reply
      - tool_calls_made: which backend tools were invoked (for UI feedback)
    Topology data, config streaming, etc. arrive via SSE events
    (broadcast by the tool handlers), NOT in this envelope.
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
                "(e.g., 'design X with enterprise security'), you should still call "
                "this tool first, wait for the result, and then call "
                "apply_security_and_export in the next turn."
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
                "profile to use. If the user hasn't specified one, ask them first."
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
                "protocol configurations, or troubleshooting steps. Call this when "
                "the user asks about how to configure something on a Cisco device "
                "(e.g., OSPF, VLANs, ACLs, NAT, HSRP). Returns formatted Markdown "
                "with IOS command examples."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "topic": {
                        "type": "string",
                        "description": (
                            "The networking topic or protocol to search for. "
                            "Examples: 'OSPF configuration', 'VLAN trunking', "
                            "'HSRP setup', 'NAT overload', 'access-list'"
                        ),
                    },
                },
                "required": ["topic"],
            },
        },
    },
]
