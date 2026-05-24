# StructuraNet AI - Interaction Cases Analysis

This document outlines the various user intents (User Cases) that the StructuraNet AI orchestrator must handle, categorized by pipeline interaction and system logic.

## 1. Core Intent Clusters
* **Direct Design Request**
  - **Input:** "Build a network with 2 routers and 3 switches."
  - **System Action:** Route to `generate_new_topology`. Initiates the full pipeline: Phase 1 (Thinking) -> Phase 2 (Config/Topology).
* **Modification Request**
  - **Input:** "Add a firewall between the routers," or "Change VLAN IDs to 100."
  - **System Action:** Route to `modify_current_topology`. The system leverages conversation history to maintain context of existing nodes and links.
* **Technical Query (Knowledge Base)**
  - **Input:** "What is the command to enable OSPF?"
  - **System Action:** Route to `search_cisco_knowledge`. Returns a Markdown response without initiating topology pipeline cycles.
* **Compound Intents**
  - **Input:** "Design a branch network and apply enterprise security profile."
  - **System Action:** Sequential execution: `generate_new_topology` -> then `apply_security_and_export`.

## 2. Control and Edge Cases
* **Ambiguous Requests**
  - **Input:** "I want a network."
  - **System Action:** Triggers the "Clarification Protocol" via the `system_prompt`. The AI must request specific details (scale, purpose, node count) before proceeding.
* **Conflicting Constraints**
  - **Input:** "Connect 500 nodes to a single 24-port switch."
  - **System Action:** The backend Validator flags the physical constraint failure; the AI interprets this error as feedback to suggest a logical topology optimization to the user.
* **Out-of-Scope Requests**
  - **Input:** "Write a poem about network engineering."
  - **System Action:** Polite refusal dictated by `system_prompt` constraints, redirecting the user back to network design topics.
* **Repetitive Requests**
  - **Input:** "Generate the network again."
  - **System Action:** Logic checks if a topology currently exists. If so, it prompts the user to confirm discarding the current state before initiating a new one.

## 3. Automation and Future Cases
* **Automation Request (Configs Only)**
  - **Input:** "I have a router with IP 10.0.0.1, provide OSPF configs."
  - **System Action:** Route to `generate_configs_directly`. Skips visual topology generation to provide immediate configuration code.
* **Automation Export Request**
  - **Input:** "Export the configuration as an Ansible playbook."
  - **System Action:** Triggers the `AutomationGenerator` during the final Export Phase to bundle `.yml` or `.py` files into the final output ZIP.

## 4. System Integrity Cases
* **Connectivity Interruption**
  - **Condition:** Loss of WebSocket or SSE stream.
  - **System Action:** Frontend detects `error` state via `useSSE.js` and provides a "Retry" mechanism to resume from the last saved state.
* **Malformed/Nonsensical Input**
  - **Input:** Random characters or unintelligible strings.
  - **System Action:** Categorized as "Ambiguous" by the LLM, triggering the Clarification Protocol.

## 5. Advanced System Logic: Unsupported Hardware Handling
* **Intent/Case:** User requests a specific device not currently present in the `appliance_catalog` (e.g., "I need a Cisco ASR 9000").
* **System Action:** 
  1. **Preflight Check:** The `preflight.py` script identifies that the requested appliance is missing from the catalog.
  2. **Intelligent Substitution:** The LLM Orchestrator analyzes the device's functional role. If it is a Router, it attempts to substitute it with a supported Router (e.g., Cisco 7200). 
  3. **User Communication:** The AI responds to the user: *"The requested device (X) is not currently in our library. I have substituted it with (Y) which provides similar routing capabilities. Is this acceptable?"*
  4. **Fallback Option:** If no logical substitute exists, the AI triggers the "Generic Node" fallback (e.g., Alpine/FRR) and informs the user that they may need to configure the specific image manually.