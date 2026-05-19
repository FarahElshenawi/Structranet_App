"""
intent_router.py — LLM-powered intent classifier for the Conversational Agent.

Responsibilities:
  1. Build a context-aware system prompt that includes the current session state
     so the classifier knows which intents are legal right now.
  2. Call the LLM with a strict JSON output schema.
  3. Parse and validate the result into IntentClassification.
  4. Apply a state-aware override table so the LLM cannot emit illegal intents
     (e.g., APPROVE_TOPOLOGY while state is IDLE).

Design: The classifier is a *separate* LLM call from the main generator.
It uses a tiny, fast prompt — the main generation work happens in Phase 1/2.
"""

from __future__ import annotations

import json
import logging
import re
from typing import List, Optional

from structranet.ai.llm_utils import _call_with_retry, _extract_json, _get_client

from structranet.constants.agent_schemas import (
    ConversationMessage,
    IntentClassification,
    IntentType,
    SessionState,
)

logger = logging.getLogger("structranet.intent_router")

# ── Intents that are legal in each state ──────────────────────────────────────
_LEGAL_INTENTS: dict[SessionState, list[IntentType]] = {
    SessionState.IDLE: [
        IntentType.CHAT,
        IntentType.QA,
        IntentType.GENERATE_TOPOLOGY,
    ],
    SessionState.REVIEWING_TOPOLOGY: [
        IntentType.CHAT,
        IntentType.QA,
        IntentType.EDIT_TOPOLOGY,
        IntentType.APPROVE_TOPOLOGY,
    ],
    SessionState.CHOOSING_SECURITY: [
        IntentType.CHAT,
        IntentType.SECURITY_CHOICE,
    ],
    # Transient states — should never reach the router, but be safe
    SessionState.GENERATING: [IntentType.CHAT],
    SessionState.EXPORTING:  [IntentType.CHAT],
}

# ── Keywords for fast-path security profile normalisation ─────────────────────
_SECURITY_KEYWORDS: dict[str, str] = {
    "none":       "none",
    "no":         "none",
    "basic":      "basic",
    "minimal":    "basic",
    "simple":     "basic",
    "enterprise": "enterprise",
    "full":       "enterprise",
    "advanced":   "enterprise",
    "max":        "enterprise",
}


def _build_router_prompt(
    current_state: SessionState,
    history_summary: str,
) -> str:
    legal = [i.value for i in _LEGAL_INTENTS.get(current_state, list(IntentType))]

    state_context = {
        SessionState.IDLE: (
            "The user has not started a topology design yet. "
            "They may chat, ask networking questions, or request a new topology design."
        ),
        SessionState.REVIEWING_TOPOLOGY: (
            "A topology draft has been generated and is being shown to the user. "
            "The user may ask for edits, approve the design, chat, or ask networking questions. "
            "Words like 'looks good', 'approve', 'continue', 'export', 'proceed' signal APPROVE. "
            "Words like 'change', 'add', 'remove', 'modify', 'fix', 'instead' signal EDIT."
        ),
        SessionState.CHOOSING_SECURITY: (
            "The topology was approved. The AI has asked the user to choose a security profile: "
            "'none', 'basic', or 'enterprise'. The user's reply is almost certainly a security choice."
        ),
        SessionState.GENERATING: "Pipeline is running. Treat any message as CHAT.",
        SessionState.EXPORTING:  "Pipeline is running. Treat any message as CHAT.",
    }.get(current_state, "")

    return f"""You are an intent classifier for StructuraNet AI, a GNS3 network topology generator.

CURRENT SESSION STATE: {current_state.value}
STATE CONTEXT: {state_context}

LEGAL INTENTS IN THIS STATE: {legal}

RECENT CONVERSATION:
{history_summary}

INTENT DEFINITIONS:
- chat              → General greeting, small talk, or off-topic message
- qa                → Question about networking commands, protocols, or configuration
- generate_topology → Request to design / create a NEW network topology
- edit_topology     → Request to CHANGE / MODIFY the current topology draft
- approve_topology  → User accepts the current topology draft as-is
- security_choice   → User picks a security profile: none, basic, or enterprise

OUTPUT FORMAT — return ONLY raw JSON, no markdown:
{{
  "intent": "<one of the legal intents above>",
  "confidence": <0.0-1.0>,
  "qa_topic": "<protocol or command topic, only for qa>",
  "topology_requirement": "<verbatim user requirement, only for generate_topology>",
  "edit_feedback": "<verbatim user feedback, only for edit_topology>",
  "security_profile": "<none|basic|enterprise, only for security_choice>",
  "chat_reply": "<a short friendly reply, only for chat intent>",
  "reasoning": "<one sentence why you chose this intent>"
}}

RULES:
1. Only emit an intent from the LEGAL INTENTS list above.
2. If the state is CHOOSING_SECURITY and the user says a profile name, always use security_choice.
3. If confidence < 0.7, default to 'chat'.
4. For security_choice: map 'enterprise'/'full'/'advanced' → enterprise, 'basic'/'minimal' → basic, 'none'/'no' → none.
"""


def _summarise_history(history: List[ConversationMessage], max_turns: int = 6) -> str:
    """Produce a compact text summary of recent turns for the router prompt."""
    recent = history[-max_turns * 2:]
    lines = []
    for msg in recent:
        prefix = "User" if msg.role == "user" else "AI"
        # Truncate long messages
        content = msg.content[:200] + "…" if len(msg.content) > 200 else msg.content
        lines.append(f"{prefix}: {content}")
    return "\n".join(lines) if lines else "(no history)"


def _fast_path_security_choice(text: str) -> Optional[str]:
    """
    Keyword-based fallback for security profile detection.
    Returns the normalised profile name or None.
    """
    lowered = text.lower().strip()
    for keyword, profile in _SECURITY_KEYWORDS.items():
        if keyword in lowered:
            return profile
    return None


def classify_intent(
    user_message: str,
    current_state: SessionState,
    history: List[ConversationMessage],
) -> IntentClassification:
    """
    Main entry point: classify the user's message given the current state.

    Uses a two-pass strategy:
      1. Fast-path rules (no LLM, deterministic)
      2. LLM classification (JSON output)

    Always returns a valid IntentClassification — never raises.
    """

    # ── Fast-path: security profile in CHOOSING_SECURITY state ───────────────
    if current_state == SessionState.CHOOSING_SECURITY:
        profile = _fast_path_security_choice(user_message)
        if profile:
            logger.info("Fast-path security choice: %s", profile)
            return IntentClassification(
                intent=IntentType.SECURITY_CHOICE,
                confidence=0.97,
                security_profile=profile,  # type: ignore[arg-type]
                reasoning="Fast-path keyword match for security profile.",
            )

    # ── LLM classification ────────────────────────────────────────────────────
    client = _get_client()
    system_prompt = _build_router_prompt(current_state, _summarise_history(history))

    try:
        def _call():
            return client.chat.completions.create(
                model=__import__("os").getenv("AI_MODEL", "openrouter/owl-alpha"),
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user",   "content": user_message},
                ],
                max_tokens=512,
                response_format={"type": "json_object"},
            )

        response = _call_with_retry(_call)
        if not response or not response.choices:
            raise RuntimeError("Empty response from LLM")

        raw = response.choices[0].message.content or "{}"
        data = json.loads(_extract_json(raw))

    except Exception as exc:
        logger.warning("Intent classification failed: %s — defaulting to CHAT", exc)
        return IntentClassification(
            intent=IntentType.CHAT,
            confidence=0.5,
            chat_reply="I had trouble understanding that. Could you rephrase?",
            reasoning=f"Classification error: {exc}",
        )

    # ── Validate and clamp to legal intents ───────────────────────────────────
    raw_intent = data.get("intent", "chat")
    legal = _LEGAL_INTENTS.get(current_state, list(IntentType))
    legal_values = [i.value for i in legal]

    if raw_intent not in legal_values:
        logger.warning(
            "LLM emitted illegal intent '%s' in state %s — clamping to CHAT",
            raw_intent, current_state.value,
        )
        raw_intent = IntentType.CHAT.value
        data["chat_reply"] = data.get("chat_reply", "Let me know how I can help.")
        data["confidence"] = 0.5

    # ── Confidence gate ────────────────────────────────────────────────────────
    confidence = float(data.get("confidence", 1.0))
    if confidence < 0.65 and raw_intent not in (IntentType.CHAT.value,):
        logger.info("Low confidence (%.2f) — downgrading intent %s to CHAT", confidence, raw_intent)
        raw_intent = IntentType.CHAT.value
        data["chat_reply"] = data.get(
            "chat_reply",
            "I'm not entirely sure what you need — could you clarify?",
        )

    try:
        result = IntentClassification(
            intent=IntentType(raw_intent),
            confidence=confidence,
            qa_topic=data.get("qa_topic"),
            topology_requirement=data.get("topology_requirement"),
            edit_feedback=data.get("edit_feedback"),
            security_profile=data.get("security_profile"),  # type: ignore[arg-type]
            chat_reply=data.get("chat_reply"),
            reasoning=data.get("reasoning"),
        )
    except Exception as exc:
        logger.error("Failed to build IntentClassification: %s", exc)
        result = IntentClassification(
            intent=IntentType.CHAT,
            confidence=0.5,
            chat_reply="Sorry, something went wrong on my end.",
        )

    logger.info(
        "Intent classified: %s (conf=%.2f) | state=%s",
        result.intent.value, result.confidence, current_state.value,
    )
    return result
