"""
structranet/constants/__init__.py

Public constants package for Structranet AI.

Module layout
─────────────
  hardware.py      — SSOT for all Dynamips hardware constants (modules,
                     port counts, RAM defaults, slot configs, compat matrix).
  gns3.py          — GNS3 node-type taxonomy, scene geometry, symbol maps,
                     port-name format strings, and file-config triplets.
  validation.py    — Backward-compatible re-exports from hardware.py / gns3.py.
                     Import directly from the SSOT modules in new code.
  schema.py        — Pydantic v2 models for the topology pipeline domain
                     (TopologyRequest, GNS3Project, Node, Link, …).
  phase2.py        — Phase 2 whitelist keys and value-type constraints.
  ai.py            — AI-side conservative link limits and retry settings.
  appliances.py    — Static appliance catalog (templates, images, defaults).
  agent_schemas.py — Pydantic schemas for the conversational agent
                     (AgentSessionData, AgentResponse, TOOL_DEFINITIONS).

Import directly from the submodule you need rather than from this package
to keep dependency edges explicit and avoid circular imports.
"""