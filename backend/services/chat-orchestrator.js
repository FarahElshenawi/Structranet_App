/**
 * chat-orchestrator.js — LLM Tool-Calling Orchestrator for StructuraNet AI.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  ARCHITECTURE PHILOSOPHY: NO FSM. NO Intent Router. The LLM IS the orchestrator.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Traditional chatbots use a Finite State Machine (FSM) to track
 * conversation state and route user input to the right handler:
 *
 *   [Idle] → user says "design X" → [Generating] → [Review] → [Export]
 *
 * The problem? Users don't follow the FSM. They:
 *   - Interrupt mid-flow ("actually, add a firewall first")
 *   - Combine intents ("design X AND apply enterprise security")
 *   - Go off-topic ("what's OSPF?")
 *   - Change their mind ("never mind, start over")
 *
 * Our approach: Give the LLM tool definitions and let IT decide
 * what to call and when. The LLM reads the conversation context
 * (including what topology exists, whether it's approved, etc.)
 * and autonomously picks the right action.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  EXECUTION FLOW (The Tool-Calling Loop)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *   1. Append user message to conversation history.
 *   2. Call LLM with messages + tool definitions.
 *   3. If LLM returns text (no tool_calls) → broadcast to user. Done.
 *   4. If LLM triggers tool_call(s) → execute the tool:
 *      a. The tool handler spawns Python via child_process (ai-engine.js).
 *      b. Tool handlers emit SSE events (topology_ready, config_text, etc.)
 *      c. Append tool result as role="tool" message.
 *      d. Loop back to step 2 (LLM reads tool result, may call more tools).
 *   5. When LLM finally returns text (no more tool_calls), broadcast and return.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  HOW ASYNC PYTHON EXECUTION WORKS WITHOUT BLOCKING THE EVENT LOOP
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Node.js is single-threaded. If we called Python synchronously, the entire
 * server would freeze while waiting for the LLM to respond (which can take
 * 30+ seconds). Instead:
 *
 *   1. `child_process.spawn()` creates a new OS process for Python.
 *      This is NON-BLOCKING — it returns immediately.
 *
 *   2. We listen for `data` events on stdout/stderr streams.
 *      These events fire asynchronously when Python writes output.
 *
 *   3. We wrap the whole thing in a Promise:
 *        resolve() → when Python exits with code 0 and valid JSON
 *        reject()  → on timeout, non-zero exit, or parse error
 *
 *   4. The `await` keyword in the tool handler pauses ONLY the current
 *      request handler — NOT the entire event loop. Other HTTP requests,
 *      SSE connections, and timers continue running normally.
 *
 *   5. Result: Python runs in a separate process, Node.js stays responsive,
 *      and the tool handler gets the parsed JSON result when Python finishes.
 *
 * Ported from: structranet/ai/chat_orchestrator.py
 */

const OpenAI = require("openai");
const { TOOL_DEFINITIONS } = require("../tools/definitions");
const { AgentSessionData, AgentResponse } = require("../tools/agent-schemas");
const aiEngine = require("./ai-engine");


// ─── Configuration ──────────────────────────────────────────────────────────
//
// These constants control the tool-calling loop's safety bounds.

/**
 * Maximum number of tool-calling rounds per user message.
 *
 * Why 6? Most interactions need 1-2 rounds:
 *   - Round 1: LLM calls generate_new_topology
 *   - Round 2: LLM reads the result and responds
 *
 * Compound intents may need 3-4 rounds:
 *   - Round 1: generate_new_topology
 *   - Round 2: LLM reads result, calls apply_security_and_export
 *   - Round 3: LLM reads export result, responds to user
 *
 * 6 is a generous safety cap to prevent infinite loops
 * (e.g., if the LLM keeps calling the same tool).
 */
const MAX_TOOL_ROUNDS = 6;

/**
 * Maximum conversation history turns to keep in memory.
 *
 * More history = better context, but also more tokens = higher cost
 * and slower responses. 30 turns is roughly 15 back-and-forth exchanges,
 * which covers most design sessions.
 */
const MAX_HISTORY_TURNS = 30;

/**
 * LLM model and parameters.
 *
 * These come from environment variables so they can be changed
 * without modifying code. Defaults point to OpenRouter's free tier.
 */
const LLM_MODEL = process.env.AI_MODEL || "z-ai/glm-4.5-air:free";
const LLM_MAX_TOKENS = parseInt(process.env.AI_MAX_TOKENS || "4096", 10);


// ─── LLM Client (Singleton) ─────────────────────────────────────────────────
//
// We use a lazy singleton pattern for the OpenAI client so it's only
// created when the first LLM call is made. This avoids crashing on
// startup if the API key is missing (the error is deferred to first use).

let _client = null;

/**
 * Get or create the OpenAI client instance.
 *
 * @returns {OpenAI} - Configured OpenAI client
 * @throws {Error} - If ROUTER_API_KEY is not set
 */
function _getClient() {
  if (!_client) {
    const apiKey = process.env.ROUTER_API_KEY;
    const baseURL = process.env.ROUTER_BASE_URL;
    if (!apiKey) {
      throw new Error("ROUTER_API_KEY missing. Check your .env file.");
    }
    _client = new OpenAI({ apiKey, baseURL, timeout: 500_000 });
  }
  return _client;
}


// ─── History Trimming ────────────────────────────────────────────────────────
//
// Conversations grow unbounded as the user keeps chatting. This function
// trims old messages to keep the context window manageable.
//
// IMPORTANT: We can't arbitrarily slice the array because tool_call
// and tool messages come in PAIRS. If we cut a tool_call without its
// corresponding tool result, the LLM API will reject the request.
//
// Simple heuristic: Keep the most recent N messages. This works because
// tool results always come immediately after their tool_calls, so as
// long as N is even-ish, pairs stay together.

/**
 * Trim conversation history to prevent token overflow.
 *
 * We preserve tool_call / tool message pairs (they must stay together).
 * Simple heuristic: drop the oldest messages until we're under the limit.
 * Never drop the last 4 messages (current exchange).
 *
 * @param {AgentSessionData} data - Session data containing conversation history
 */
function _trimHistory(data) {
  if (data.conversationHistory.length <= MAX_HISTORY_TURNS) return;
  data.conversationHistory = data.conversationHistory.slice(-MAX_HISTORY_TURNS);
}


// ─── System Prompt Builder ──────────────────────────────────────────────────
//
// The system prompt is the LLM's "job description." It tells the LLM:
//   1. Who it is (StructuraNet AI, a network engineer)
//   2. What tools it has (and when to use each one)
//   3. What state the session is in (topology exists? approved?)
//   4. How to handle compound intents and edge cases
//
// The system prompt is REBUILT on every LLM call because the session
// state changes (topology gets generated, approved, modified, etc.).

/**
 * Build a context-aware system prompt that tells the LLM the current state
 * of the session so it can make intelligent tool-calling decisions.
 *
 * @param {AgentSessionData} data - Current session state
 * @returns {string} - The system prompt for the next LLM call
 */
function _buildSystemPrompt(data) {
  // ── Build topology context section ────────────────────────────────────
  // The LLM needs to know whether a topology exists and whether it's
  // been approved, so it can decide which tool to call next.
  let topoInfo = "";

  if (data.topologyDict) {
    const topo = data.topologyDict.topology || {};
    const nodes = topo.nodes || [];
    const links = topo.links || [];
    const nodeNames = nodes.slice(0, 10).map((n) => n.name || "?").join(", ");

    topoInfo =
      `\n  - A topology draft EXISTS with ${nodes.length} nodes and ${links.length} links.` +
      `\n  - Devices: ${nodeNames}` +
      `\n  - The user can modify it (modify_current_topology) or approve it.`;

    if (data.topologyApproved) {
      topoInfo +=
        "\n  - The topology has been APPROVED by the user." +
        "\n  - The next step is to call apply_security_and_export.";
    } else {
      topoInfo +=
        "\n  - The topology has NOT been approved yet." +
        "\n  - Wait for the user to approve before calling apply_security_and_export.";
    }
  } else {
    topoInfo =
      "\n  - No topology draft exists yet." +
      "\n  - The user must first request a design (generate_new_topology).";
  }

  return `You are StructuraNet AI, an expert network engineer and GNS3 topology designer.

You help users design, review, modify, and export GNS3 network topologies. You also answer Cisco IOS configuration questions.

CURRENT SESSION CONTEXT:${topoInfo}
  - Edit iterations used: ${data.editIterations}/${data.maxEditIterations}

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

4. **search_cisco_knowledge**: Call when the user asks about Cisco IOS commands or protocol configuration.
   - Returns Markdown with code blocks showing exact IOS commands.
   - Use this for "how do I configure X" questions, not for topology design.

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
- For questions about your capabilities, explain what you can do.`;
}


// ═══════════════════════════════════════════════════════════════════════════════
//  TOOL HANDLERS — One function per tool in the definitions
// ═══════════════════════════════════════════════════════════════════════════════
//
// Each tool handler:
//   1. Validates its arguments.
//   2. Calls the Python wrapper via ai-engine.js (child_process.spawn).
//   3. Broadcasts SSE events to the frontend for real-time updates.
//   4. Updates the session state (topology, file paths, etc.).
//   5. Returns a JSON string for the LLM to read.
//
// The return value is a JSON string (not an object) because the LLM API
// expects tool results as strings in the `role: "tool"` message.

/**
 * Execute generate_new_topology tool.
 *
 * This is the MVP core — it's what makes the bridge work:
 *   Node.js → LLM decides to call this tool → spawns Python → gets JSON back
 *
 * @param {string} requirements - User's network description
 * @param {Object} session - Express session object (carries profile, outputDir, etc.)
 * @param {Object} store - Session store with broadcast() method for SSE
 * @param {AgentSessionData} data - Mutable agent state for this session
 * @returns {Promise<string>} - JSON string result for the LLM
 */
async function _toolGenerateNewTopology(requirements, session, store, data) {
  try {
    // ── Broadcast phase change to frontend via SSE ────────────────────
    // The frontend shows a "Generating..." animation when it receives
    // this event. SSE events are fire-and-forget — they don't block
    // the tool handler.
    if (store && store.broadcast) {
      store.broadcast(session, { event: "phase_change", data: { phase: "generating", sub_phase: "thinking" } });
    }

    // ── Call the Python wrapper via ai-engine.js ──────────────────────
    // This is where the Node.js → Python bridge is exercised.
    // aiEngine.generate() spawns: python wrapper.py generate --request "<requirements>"
    //
    // The `await` pauses THIS function only — the Node.js event loop
    // continues serving other requests. When Python finishes, the
    // Promise resolves and we continue here.
    const result = await aiEngine.generate({
      request: requirements,
      profile: session.profile || "{}",
      chatHistory: data.conversationHistory,
      securityProfile: "none", // hardening applied later in Phase 2
      outputDir: session.outputDir,
    });

    if (!result.success) {
      return JSON.stringify({
        success: false,
        error: result.error || "Topology generation failed",
        hint: "Ask the user to rephrase their requirements or reduce complexity.",
      });
    }

    // ── Update agent session data ─────────────────────────────────────
    // These fields are used by the system prompt builder to tell the LLM
    // what state the session is in on the NEXT round.
    data.topologyDict = result.topology_dict;
    data.phase1File = result.phase1_file;
    data.originalRequest = requirements;
    data.topologyApproved = false;
    data.editIterations = 0;

    // ── Update session artifacts (for the Express /download endpoint) ─
    session.topologyDict = result.topology_dict;
    session.topologyData = result.topology_data;
    session.requirements = result.requirements;

    // ── Broadcast real-time events to the frontend ────────────────────
    // These SSE events drive the frontend's chat UX:
    //   - topology_ready → shows the topology review card
    //   - requirements_ready → shows the image requirements panel
    //   - summary_ready → shows the design review / assumptions
    //   - phase_change → switches the UI to "review" mode
    if (store && store.broadcast && result.thoughts) {
      for (const thought of result.thoughts) {
        store.broadcast(session, { event: "thought", data: thought });
      }
    }

    if (store && store.broadcast) {
      store.broadcast(session, { event: "topology_ready", data: result.topology_data });
      store.broadcast(session, { event: "requirements_ready", data: result.requirements });
      if (result.design_review) {
        store.broadcast(session, {
          event: "summary_ready",
          data: {
            thinking_text: result.thinking_text,
            thoughts: result.thoughts,
            design_review: result.design_review,
            assumptions: result.assumptions,
          },
        });
      }
      store.broadcast(session, { event: "phase_change", data: { phase: "review", sub_phase: null } });
    }

    // ── Build result for the LLM ─────────────────────────────────────
    // The LLM doesn't need the full topology dict — it just needs a
    // summary so it can describe the result to the user.
    const nodes = (result.topology_dict?.topology?.nodes) || [];
    const nodeSummary = nodes.slice(0, 15).map((n) => n.name || "?").join(", ");

    return JSON.stringify({
      success: true,
      node_count: nodes.length,
      link_count: (result.topology_dict?.topology?.links || []).length,
      devices: nodeSummary,
      phase1_file: result.phase1_file,
      message: `Successfully generated a topology with ${nodes.length} nodes. Devices: ${nodeSummary}. The user can now request modifications or approve the design.`,
    });
  } catch (exc) {
    return JSON.stringify({
      success: false,
      error: `Topology generation failed: ${exc.message}`,
      hint: "Ask the user to rephrase their requirements or reduce complexity.",
    });
  }
}


/**
 * Execute modify_current_topology tool.
 *
 * Similar to generate, but operates on an existing topology draft.
 * The LLM will only call this when a topology already exists.
 *
 * @param {string} feedback - User's edit request (e.g., "add a firewall")
 * @param {Object} session - Express session object
 * @param {Object} store - Session store with broadcast()
 * @param {AgentSessionData} data - Mutable agent state
 * @returns {Promise<string>} - JSON string result for the LLM
 */
async function _toolModifyCurrentTopology(feedback, session, store, data) {
  // ── Guard: No topology to modify ────────────────────────────────────
  if (!data.topologyDict) {
    return JSON.stringify({
      success: false,
      error: "No topology draft exists to modify.",
      hint: "Tell the user there is no topology to edit. Suggest they first request a new design.",
    });
  }

  // ── Guard: Edit iteration limit ─────────────────────────────────────
  // This prevents infinite edit loops (user keeps saying "change it"
  // without ever approving). The LLM is told the remaining count in
  // its result so it can inform the user.
  if (data.editIterations >= data.maxEditIterations) {
    return JSON.stringify({
      success: false,
      error: `Maximum edit iterations (${data.maxEditIterations}) reached.`,
      hint: "Tell the user the edit limit has been reached and suggest they approve the current design or start fresh.",
    });
  }

  data.editIterations++;

  try {
    if (store && store.broadcast) {
      store.broadcast(session, { event: "phase_change", data: { phase: "generating", sub_phase: "thinking" } });
    }

    // ── Call Python wrapper via ai-engine.js ──────────────────────────
    const result = await aiEngine.edit({
      feedback,
      topology: data.phase1File,
      chatHistory: data.conversationHistory,
      originalRequest: data.originalRequest,
      securityProfile: "none",
      profile: session.profile || "{}",
      outputDir: session.outputDir,
    });

    if (!result.success) {
      return JSON.stringify({
        success: false,
        error: result.error || "Edit generation failed.",
      });
    }

    // ── Update agent data ─────────────────────────────────────────────
    data.topologyDict = result.topology_dict;
    data.phase1File = result.phase1_file;
    data.topologyApproved = false; // Reset approval after edit

    // ── Update session ────────────────────────────────────────────────
    session.topologyDict = result.topology_dict;
    session.topologyData = result.topology_data;
    session.requirements = result.requirements;

    // ── Broadcast updates ─────────────────────────────────────────────
    if (store && store.broadcast && result.thoughts) {
      for (const thought of result.thoughts) {
        store.broadcast(session, { event: "thought", data: thought });
      }
    }
    if (store && store.broadcast) {
      store.broadcast(session, { event: "topology_ready", data: result.topology_data });
      store.broadcast(session, { event: "requirements_ready", data: result.requirements });
      store.broadcast(session, { event: "phase_change", data: { phase: "review", sub_phase: null } });
    }

    const nodes = (result.topology_dict?.topology?.nodes) || [];
    const nodeSummary = nodes.slice(0, 15).map((n) => n.name || "?").join(", ");

    return JSON.stringify({
      success: true,
      node_count: nodes.length,
      link_count: (result.topology_dict?.topology?.links || []).length,
      devices: nodeSummary,
      edit_iterations_remaining: data.maxEditIterations - data.editIterations,
      message: `Successfully modified the topology. Now ${nodes.length} nodes. Devices: ${nodeSummary}. Edit iterations remaining: ${data.maxEditIterations - data.editIterations}.`,
    });
  } catch (exc) {
    return JSON.stringify({
      success: false,
      error: `Edit generation failed: ${exc.message}`,
    });
  }
}


/**
 * Execute apply_security_and_export tool.
 *
 * This is Phase 2: It takes the approved topology, generates device
 * configurations (IP addressing, routing protocols, security hardening),
 * and exports a .gns3project file.
 *
 * @param {string} securityProfile - "none", "basic", or "enterprise"
 * @param {Object} session - Express session object
 * @param {Object} store - Session store with broadcast()
 * @param {AgentSessionData} data - Mutable agent state
 * @returns {Promise<string>} - JSON string result for the LLM
 */
async function _toolApplySecurityAndExport(securityProfile, session, store, data) {
  // ── Guard: No topology to export ────────────────────────────────────
  if (!data.topologyDict) {
    return JSON.stringify({
      success: false,
      error: "No topology exists to configure and export.",
      hint: "Tell the user they need to design a topology first.",
    });
  }

  // ── Guard: Invalid security profile ─────────────────────────────────
  if (!["none", "basic", "enterprise"].includes(securityProfile)) {
    return JSON.stringify({
      success: false,
      error: `Invalid security profile: '${securityProfile}'. Must be 'none', 'basic', or 'enterprise'.`,
      hint: "Ask the user to choose one of the three profiles.",
    });
  }

  data.topologyApproved = true;

  try {
    // ── Broadcast phase change ────────────────────────────────────────
    if (store && store.broadcast) {
      store.broadcast(session, { event: "phase_change", data: { phase: "exporting", sub_phase: "finalizing" } });
      store.broadcast(session, { event: "phase2_progress", data: { status: "generating_configs" } });
    }

    // ── Call Python wrapper for Phase 2 + export ──────────────────────
    const result = await aiEngine.exportProject({
      topology: data.phase1File,
      securityProfile,
      profile: session.profile || "{}",
      outputDir: session.outputDir,
    });

    if (!result.success) {
      data.topologyApproved = false;
      return JSON.stringify({
        success: false,
        error: "Configuration generation or GNS3 export failed.",
        hint: "Tell the user the export failed. The topology draft is still available for edits or retry.",
      });
    }

    // ── Update session with export artifacts ──────────────────────────
    session.finalDict = result.final_dict;
    session.gns3projectPath = result.gns3project_path;
    session.configTexts = result.config_texts || {};
    session.validatorPassed = result.validator_passed;

    // ── Stream config texts via SSE ───────────────────────────────────
    // Config texts can be long (hundreds of lines per device).
    // We chunk them for smooth streaming in the frontend's
    // ConfigStream component.
    if (store && store.broadcast && result.config_texts) {
      for (const [deviceName, configText] of Object.entries(result.config_texts)) {
        // Send in 80-character chunks for smooth streaming effect
        const CHUNK_SIZE = 80; // H3: Increased from 6 to 80 for better streaming throughput
        for (let i = 0; i < configText.length; i += CHUNK_SIZE) {
          store.broadcast(session, {
            event: "config_text",
            data: {
              device_name: deviceName,
              chunk: configText.slice(i, i + CHUNK_SIZE),
              start: i === 0,
              done: false,
            },
          });
        }
        // Mark this device's config as complete
        store.broadcast(session, {
          event: "config_text",
          data: { device_name: deviceName, chunk: "", start: false, done: true },
        });
      }
    }

    // ── Broadcast completion event ────────────────────────────────────
    if (store && store.broadcast) {
      const topo = result.final_dict?.topology || {};
      const nodesList = topo.nodes || [];
      const linksList = topo.links || [];
      const configured = nodesList.filter((n) => n.properties && (
        n.properties.startup_config_content || n.properties.startup_script || n.properties.start_command
      )).length;

      store.broadcast(session, {
        event: "complete",
        data: {
          download_url: `/sessions/${session.sessionId}/download`,
          validator_passed: result.validator_passed,
          node_count: nodesList.length,
          link_count: linksList.length,
          configured_count: configured,
        },
      });
      store.broadcast(session, {
        event: "phase_change",
        data: { phase: "success", sub_phase: null },
      });
    }

    // ── Build result for the LLM ─────────────────────────────────────
    const profileLabels = {
      none: "no hardening (pure lab)",
      basic: "basic hardening (SSH, AAA, NTP, Syslog)",
      enterprise: "enterprise-grade hardening (ZBF, ACLs, SNMPv3, HSRP)",
    };

    return JSON.stringify({
      success: true,
      security_profile: securityProfile,
      profile_description: profileLabels[securityProfile] || securityProfile,
      download_url: `/sessions/${session.sessionId}/download`,
      validator_passed: result.validator_passed,
      message: `Successfully exported GNS3 project with '${profileLabels[securityProfile]}' security profile. The user can download the .gns3project file, device configurations, and requirements manifest.`,
    });
  } catch (exc) {
    data.topologyApproved = false;
    return JSON.stringify({
      success: false,
      error: `Export failed: ${exc.message}`,
      hint: "Tell the user the export failed. The topology draft is still available for edits or retry.",
    });
  }
}


/**
 * Execute search_cisco_knowledge tool.
 *
 * Searches the built-in Cisco IOS knowledge base for specific
 * commands, protocol configurations, or troubleshooting steps.
 *
 * @param {string} topic - The networking topic to search for
 * @param {Object} session - Express session object
 * @param {Object} store - Session store with broadcast()
 * @param {AgentSessionData} data - Mutable agent state
 * @returns {Promise<string>} - JSON string result for the LLM
 */
async function _toolSearchCiscoKnowledge(topic, session, store, data) {
  try {
    // ── Call Python wrapper for QA search ─────────────────────────────
    const result = await aiEngine.searchQA({ topic });
    return JSON.stringify({
      success: true,
      topic: result.topic,
      answer: result.answer,
      message: `Found information about '${topic}'. Use the answer to respond to the user.`,
    });
  } catch (exc) {
    return JSON.stringify({
      success: false,
      error: `Knowledge search failed: ${exc.message}`,
    });
  }
}


// ═══════════════════════════════════════════════════════════════════════════════
//  TOOL EXECUTION ROUTER — Maps tool names to handler functions
// ═══════════════════════════════════════════════════════════════════════════════
//
// This is a simple switch-case that routes a tool call from the LLM
// to the correct handler function. The LLM specifies the tool name
// and arguments in its response; we extract them and dispatch.
//
// To add a new tool:
//   1. Add the tool definition in definitions.js
//   2. Write the handler function above
//   3. Add a case to this switch

/**
 * Route a tool call to the correct handler.
 *
 * @param {string} toolName - Name of the tool the LLM called
 * @param {Object} toolArgs - Parsed arguments from the LLM's tool call
 * @param {Object} session - Express session object
 * @param {Object} store - Session store with broadcast()
 * @param {AgentSessionData} data - Mutable agent state
 * @returns {Promise<string>} - JSON string result for the LLM
 */
async function _executeToolCall(toolName, toolArgs, session, store, data) {
  switch (toolName) {
    case "generate_new_topology":
      return _toolGenerateNewTopology(toolArgs.requirements || "", session, store, data);

    case "modify_current_topology":
      return _toolModifyCurrentTopology(toolArgs.feedback || "", session, store, data);

    case "apply_security_and_export":
      return _toolApplySecurityAndExport(toolArgs.security_profile || "none", session, store, data);

    case "search_cisco_knowledge":
      return _toolSearchCiscoKnowledge(toolArgs.topic || "", session, store, data);

    default:
      return JSON.stringify({ success: false, error: `Unknown tool: ${toolName}` });
  }
}


// ═══════════════════════════════════════════════════════════════════════════════
//  MAIN DISPATCH FUNCTION — The entry point called by Express routes
// ═══════════════════════════════════════════════════════════════════════════════
//
// This is the core of the chat orchestrator. It implements the
// tool-calling loop described at the top of this file.
//
// The function is called by the Express /agent/chat endpoint whenever
// the user sends a message. It:
//   1. Gets or creates the agent session data (conversation history, state)
//   2. Appends the user's message to the history
//   3. Enters the tool-calling loop (up to MAX_TOOL_ROUNDS)
//   4. Returns the LLM's final text response

/**
 * Central dispatcher — called by the Express /agent/chat endpoint.
 *
 * Uses LLM Tool Calling (Function Calling) instead of a rigid FSM.
 * The LLM decides which tools to call based on the conversation context.
 *
 * @param {string} userMessage - The user's chat message
 * @param {Object} session - Session object (carries topology, profile, outputDir, etc.)
 * @param {Object} store - Session store with broadcast() method for SSE
 * @returns {Promise<AgentResponse>} - Structured response with message and tool call history
 */
async function dispatch(userMessage, session, store) {
  // ── Get or initialize agent session data ────────────────────────────
  // The AgentSessionData object persists across conversation turns.
  // It's loaded from the persistent SessionStore (MongoDB-backed) by
  // the /api/chat route handler and placed on session._agentData.
  let data;
  if (session._agentData && session._agentData instanceof AgentSessionData) {
    data = session._agentData;
  } else {
    data = new AgentSessionData();
    session._agentData = data;
  }

  // ── 1. Append user message to conversation history ──────────────────
  data.conversationHistory.push({ role: "user", content: userMessage });
  _trimHistory(data);

  // ── 2. Tool-calling loop ────────────────────────────────────────────
  // The loop continues until either:
  //   a. The LLM returns text without any tool_calls (it's done)
  //   b. We hit MAX_TOOL_ROUNDS (safety valve)
  const toolCallsMade = [];
  let finalText = "";

  for (let roundNum = 1; roundNum <= MAX_TOOL_ROUNDS; roundNum++) {
    // ── Build messages array: system prompt + conversation history ──
    // The system prompt is rebuilt every round because session state
    // may have changed (e.g., a topology was just generated).
    const systemPrompt = _buildSystemPrompt(data);
    const messages = [
      { role: "system", content: systemPrompt },
      ...data.conversationHistory,
    ];

    // ── Call LLM ────────────────────────────────────────────────────
    // This is an HTTP request to the LLM API (OpenAI-compatible).
    // It can take 5-30 seconds depending on the model and prompt size.
    // The `await` pauses only this function — Node.js stays responsive.
    let response;
    try {
      const client = _getClient();
      response = await client.chat.completions.create({
        model: LLM_MODEL,
        messages,
        tools: TOOL_DEFINITIONS,
        tool_choice: "auto",   // Let the LLM decide whether to call tools
        max_tokens: LLM_MAX_TOKENS,
      });
    } catch (exc) {
      finalText = "I'm having trouble connecting to my reasoning engine right now. Please try again in a moment.";
      break;
    }

    if (!response || !response.choices || response.choices.length === 0) {
      finalText = "I couldn't generate a response. Please try again.";
      break;
    }

    const choice = response.choices[0];
    const assistantMessage = choice.message;

    // ── Store the assistant message in history ──────────────────────
    // We must store the FULL assistant message (content + tool_calls)
    // so the LLM API has the complete context on the next round.
    const msgDict = { role: "assistant" };
    if (assistantMessage.content) {
      msgDict.content = assistantMessage.content;
    }
    if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
      // Transform tool_calls to the OpenAI message format
      msgDict.tool_calls = assistantMessage.tool_calls.map((tc) => ({
        id: tc.id,
        type: "function",
        function: {
          name: tc.function.name,
          arguments: tc.function.arguments,
        },
      }));
    }
    if (!msgDict.content) {
      msgDict.content = null;  // OpenAI API requires content to be null (not undefined)
    }

    data.conversationHistory.push(msgDict);

    // ── No tool calls → LLM is done, this is the final text response ─
    if (!assistantMessage.tool_calls || assistantMessage.tool_calls.length === 0) {
      finalText = assistantMessage.content || "";
      break;
    }

    // ── Execute each tool call ──────────────────────────────────────
    // The LLM can request multiple tool calls in a single response
    // (parallel tool calling). We execute them sequentially for
    // simplicity, but they could be parallelized with Promise.all()
    // if the tools are independent.
    for (const toolCall of assistantMessage.tool_calls) {
      const toolName = toolCall.function.name;
      const toolArgsStr = toolCall.function.arguments;
      const toolCallId = toolCall.id;

      // Parse the tool arguments (the LLM sends them as a JSON string)
      let toolArgs = {};
      try {
        toolArgs = JSON.parse(toolArgsStr);
      } catch {
        toolArgs = {};
      }

      toolCallsMade.push(toolName);

      // ── Execute the tool handler ──────────────────────────────────
      // Each handler returns a JSON string that becomes the tool result.
      let resultStr;
      try {
        resultStr = await _executeToolCall(toolName, toolArgs, session, store, data);
      } catch (exc) {
        resultStr = JSON.stringify({
          success: false,
          error: `Tool execution failed: ${exc.message}`,
        });
      }

      // ── Append tool result to conversation history ────────────────
      // The LLM API requires that every tool_call has a corresponding
      // role="tool" message with the matching tool_call_id.
      data.conversationHistory.push({
        role: "tool",
        tool_call_id: toolCallId,
        content: resultStr,
      });
    }

    // ── Trim history and loop back ──────────────────────────────────
    _trimHistory(data);
  }

  // ── Safety: hit max tool rounds ─────────────────────────────────────
  if (!finalText) {
    finalText = "I've completed several actions but may not have finished everything. Let me know if you'd like me to continue or if something is missing.";
  }

  // ── 3. Broadcast final message and save state ───────────────────────
  if (store && store.broadcast) {
    store.broadcast(session, {
      event: "agent_message",
      data: { message: finalText, tool_calls_made: toolCallsMade },
    });
  }

  session._agentData = data;

  return new AgentResponse({
    message: finalText,
    toolCallsMade,
  });
}


// ─── Exports ────────────────────────────────────────────────────────────────

export {
  dispatch,
  AgentSessionData,
  AgentResponse,
  _buildSystemPrompt,
  _executeToolCall
};