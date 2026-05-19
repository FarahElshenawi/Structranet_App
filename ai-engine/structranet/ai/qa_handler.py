"""
qa_handler.py — Configuration QA using a local Cisco knowledge base.

Reads cisco_knowledge_base.txt (or a pre-built index) and answers
protocol/command questions. Returns formatted Markdown with code blocks.

Strategy:
  1. Load the knowledge base text once at module import (lazy singleton).
  2. For each QA request, extract the relevant section(s) via keyword search.
  3. Pass the extracted context + user question to the LLM with a strict
     "answer in Markdown with IOS code blocks" prompt.
  4. If the knowledge base has no relevant content, fall back to the LLM's
     own knowledge (it still knows Cisco IOS).

The PDF uploaded by the user ("Cisco_General_Commands.pdf") has already been
parsed into text elsewhere. This module expects a plain-text version at:
  structranet/knowledge/cisco_knowledge_base.txt
"""

from __future__ import annotations

import logging
import os
import re
from functools import lru_cache
from pathlib import Path
from typing import Optional

from structranet.ai.llm_utils import _call_with_retry, _get_client

logger = logging.getLogger("structranet.qa_handler")

# Default path — override via env var QA_KNOWLEDGE_BASE_PATH
# qa_handler.py lives at structranet/ai/qa_handler.py
# parent = ai/, parent.parent = structranet/, so knowledge/ is structranet/knowledge/
_DEFAULT_KB_PATH = Path(__file__).parent.parent / "knowledge" / "cisco_knowledge_base.txt"
_KB_PATH = Path(os.getenv("QA_KNOWLEDGE_BASE_PATH", str(_DEFAULT_KB_PATH)))


# ═══════════════════════════════════════════════════════════════════════════════
#  Knowledge base loader  (lazy, cached)
# ═══════════════════════════════════════════════════════════════════════════════

@lru_cache(maxsize=1)
def _load_knowledge_base() -> str:
    """Load the knowledge base text once and cache it. Returns empty string on failure."""
    if not _KB_PATH.exists():
        logger.warning("Knowledge base not found at %s — QA will use LLM memory only.", _KB_PATH)
        return ""
    try:
        text = _KB_PATH.read_text(encoding="utf-8")
        logger.info("Knowledge base loaded: %d chars from %s", len(text), _KB_PATH)
        return text
    except Exception as exc:
        logger.error("Failed to load knowledge base: %s", exc)
        return ""


def _extract_relevant_sections(kb_text: str, topic: str, max_chars: int = 4000) -> str:
    """
    Simple keyword-based section extractor.

    Splits the knowledge base into sections delimited by '■' headings,
    then ranks sections by keyword overlap with the topic query.
    Returns up to max_chars of the most relevant content.
    """
    if not kb_text:
        return ""

    # Split on section headers (lines starting with ■ or Layer N |)
    sections = re.split(r"(?=^■ |^Layer \d+ \|)", kb_text, flags=re.MULTILINE)

    topic_words = set(re.findall(r"\w+", topic.lower()))

    # Score each section by keyword overlap
    scored: list[tuple[int, str]] = []
    for section in sections:
        section_words = set(re.findall(r"\w+", section.lower()))
        score = len(topic_words & section_words)
        if score > 0:
            scored.append((score, section))

    scored.sort(key=lambda x: x[0], reverse=True)

    # Collect top sections up to max_chars
    collected = []
    total = 0
    for _, section in scored[:5]:
        if total + len(section) > max_chars:
            remaining = max_chars - total
            if remaining > 200:
                collected.append(section[:remaining])
            break
        collected.append(section)
        total += len(section)

    return "\n\n".join(collected)


def _build_qa_prompt(topic: str, context: str) -> str:
    has_context = bool(context.strip())
    context_block = (
        f"REFERENCE MATERIAL FROM KNOWLEDGE BASE:\n```\n{context}\n```\n"
        if has_context
        else "No specific reference material found — use your own IOS knowledge.\n"
    )

    return f"""You are StructuraNet AI, a Cisco IOS expert assistant.
The user is asking about: {topic}

{context_block}

Answer the user's question clearly and concisely.
RULES:
1. Always put IOS commands inside a Markdown fenced code block with the 'ios' language tag.
2. Group related commands logically with short explanatory headings.
3. If the exact answer isn't in the reference, use your own IOS knowledge.
4. Keep explanatory prose brief — the commands are the star.
5. End with a tip or warning if relevant.

Respond with clean Markdown. No preamble like "Sure!" or "Great question!".
"""


# ═══════════════════════════════════════════════════════════════════════════════
#  Public API
# ═══════════════════════════════════════════════════════════════════════════════

def answer_qa(user_message: str, topic: Optional[str] = None) -> str:
    """
    Answer a Cisco configuration / command question.

    Args:
        user_message: The full user question.
        topic:        The extracted topic from intent classification (e.g. "OSPF").
                      If None, the full user_message is used as the topic.

    Returns:
        Markdown-formatted answer string.
    """
    effective_topic = topic or user_message
    kb_text = _load_knowledge_base()
    context = _extract_relevant_sections(kb_text, effective_topic)

    if context:
        logger.info(
            "QA: found %d chars of relevant context for topic '%s'",
            len(context), effective_topic,
        )
    else:
        logger.info("QA: no context found for topic '%s' — using LLM memory", effective_topic)

    client = _get_client()
    system_prompt = _build_qa_prompt(effective_topic, context)

    try:
        def _call():
            return client.chat.completions.create(
                model=os.getenv("AI_MODEL", "openrouter/owl-alpha"),
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user",   "content": user_message},
                ],
                max_tokens=2048,
            )

        response = _call_with_retry(_call)
        if response and response.choices:
            return response.choices[0].message.content or "_No answer generated._"

    except Exception as exc:
        logger.error("QA LLM call failed: %s", exc)

    return (
        "_Sorry, I couldn't retrieve the answer right now. "
        "Please check the Cisco documentation for details._"
    )


def build_cisco_kb_from_pdf_text(pdf_text: str, output_path: Optional[str] = None) -> str:
    """
    Utility: persist extracted PDF text as the knowledge base file.

    Call this once during setup if you're bootstrapping from the uploaded PDF.
    """
    path = Path(output_path or str(_KB_PATH))
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(pdf_text, encoding="utf-8")
    # Clear the LRU cache so next call re-reads
    _load_knowledge_base.cache_clear()
    logger.info("Knowledge base written to %s (%d chars)", path, len(pdf_text))
    return str(path)
