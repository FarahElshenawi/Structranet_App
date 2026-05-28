/**
 * chat-orchestrator.js — LLM Tool-Calling Orchestrator for StructuraNet AI.
 *
 * ARCHITECTURE: NO FSM. The LLM IS the orchestrator.
 *
 * EXECUTION FLOW (The Tool-Calling Loop):
 *   1. Append user message to conversation history.
 *   2. Call LLM with messages + tool definitions.
 *   3. If LLM returns text (no tool_calls) → broadcast to user. Done.
 *   4. If LLM triggers tool_call(s) → execute the tool:
 *      a. The tool handler spawns Python via child_process (ai-engine.js).
 *      b. Tool handlers emit SSE events (topology_ready, config_text, etc.)
 *      c. Append tool result as role="tool" message.
 *      d. Loop back to step 2.
 *   5. When LLM finally returns text, broadcast and return.
 */

import OpenAI from "openai";
import { TOOL_DEFINITIONS } from "../tools/definitions.js";
import { AgentSessionData, AgentResponse } from "../tools/agent-schemas.js";
import aiEngine from "./ai-engine.js";

const MAX_TOOL_ROUNDS = 6;
const MAX_HISTORY_TURNS = 30;
const LLM_MODEL = process.env.AI_MODEL || "z-ai/glm-4.5-air:free";
const LLM_MAX_TOKENS = parseInt(process.env.AI_MAX_TOKENS || "4096", 10);

let _client = null;

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

function _trimHistory(data) {
  if (data.conversationHistory.length <= MAX_HISTORY_TURNS) return;
  data.conversationHistory = data.conversationHistory.slice(-MAX_HISTORY_TURNS);
}

function _buildSystemPrompt(data) {
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

4. **search_cisco_knowledge**: Call when the user asks about Cisco IOS commands or protocol configuration.

COMPOUND INTENTS:
If the user combines multiple actions in one message, handle them sequentially.

CLARIFYING QUESTIONS:
- If the user approves a topology but doesn't specify a security profile, ASK before calling apply_security_and_export.
- If the user's requirements are too vague, ask for more details.

GENERAL CONVERSATION:
- For greetings, small talk, or off-topic messages, respond conversationally.`;
}

async function _toolGenerateNewTopology(requirements, session, store, data) {
  try {
    if (store && store.broadcast) {
      store.broadcast(session, { event: "phase_change", data: { phase: "generating", sub_phase: "thinking" } });
    }
    const result = await aiEngine.generate({
      request: requirements,
      profile: session.profile || "{}",
      chatHistory: data.conversationHistory,
      securityProfile: "none",
      outputDir: session.outputDir,
    });
    if (!result.success) {
      return JSON.stringify({
        success: false,
        error: result.error || "Topology generation failed",
        hint: "Ask the user to rephrase their requirements or reduce complexity.",
      });
    }
    data.topologyDict = result.topology_dict;
    data.phase1File = result.phase1_file;
    data.originalRequest = requirements;
    data.topologyApproved = false;
    data.editIterations = 0;
    session.topologyDict = result.topology_dict;
    session.topologyData = result.topology_data;
    session.requirements = result.requirements;
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
          data: { thinking_text: result.thinking_text, thoughts: result.thoughts, design_review: result.design_review, assumptions: result.assumptions },
        });
      }
      store.broadcast(session, { event: "phase_change", data: { phase: "review", sub_phase: null } });
    }
    const nodes = (result.topology_dict?.topology?.nodes) || [];
    const nodeSummary = nodes.slice(0, 15).map((n) => n.name || "?").join(", ");
    return JSON.stringify({
      success: true,
      node_count: nodes.length,
      link_count: (result.topology_dict?.topology?.links || []).length,
      devices: nodeSummary,
      phase1_file: result.phase1_file,
      message: `Successfully generated a topology with ${nodes.length} nodes. Devices: ${nodeSummary}.`,
    });
  } catch (exc) {
    return JSON.stringify({ success: false, error: `Topology generation failed: ${exc.message}` });
  }
}

async function _toolModifyCurrentTopology(feedback, session, store, data) {
  if (!data.topologyDict) {
    return JSON.stringify({ success: false, error: "No topology draft exists to modify." });
  }
  if (data.editIterations >= data.maxEditIterations) {
    return JSON.stringify({ success: false, error: `Maximum edit iterations (${data.maxEditIterations}) reached.` });
  }
  data.editIterations++;
  try {
    if (store && store.broadcast) {
      store.broadcast(session, { event: "phase_change", data: { phase: "generating", sub_phase: "thinking" } });
    }
    const result = await aiEngine.edit({
      feedback, topology: data.phase1File, chatHistory: data.conversationHistory,
      originalRequest: data.originalRequest, securityProfile: "none",
      profile: session.profile || "{}", outputDir: session.outputDir,
    });
    if (!result.success) {
      return JSON.stringify({ success: false, error: result.error || "Edit generation failed." });
    }
    data.topologyDict = result.topology_dict;
    data.phase1File = result.phase1_file;
    data.topologyApproved = false;
    session.topologyDict = result.topology_dict;
    session.topologyData = result.topology_data;
    session.requirements = result.requirements;
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
      success: true, node_count: nodes.length,
      link_count: (result.topology_dict?.topology?.links || []).length,
      devices: nodeSummary,
      edit_iterations_remaining: data.maxEditIterations - data.editIterations,
      message: `Successfully modified the topology. Now ${nodes.length} nodes.`,
    });
  } catch (exc) {
    return JSON.stringify({ success: false, error: `Edit generation failed: ${exc.message}` });
  }
}

async function _toolApplySecurityAndExport(securityProfile, session, store, data) {
  if (!data.topologyDict) {
    return JSON.stringify({ success: false, error: "No topology exists to configure and export." });
  }
  if (!["none", "basic", "enterprise"].includes(securityProfile)) {
    return JSON.stringify({ success: false, error: `Invalid security profile: '${securityProfile}'.` });
  }
  data.topologyApproved = true;
  try {
    if (store && store.broadcast) {
      store.broadcast(session, { event: "phase_change", data: { phase: "exporting", sub_phase: "finalizing" } });
      store.broadcast(session, { event: "phase2_progress", data: { status: "generating_configs" } });
    }
    const result = await aiEngine.exportProject({
      topology: data.phase1File, securityProfile,
      profile: session.profile || "{}", outputDir: session.outputDir,
    });
    if (!result.success) {
      data.topologyApproved = false;
      return JSON.stringify({ success: false, error: "Configuration generation or GNS3 export failed." });
    }
    session.finalDict = result.final_dict;
    session.gns3projectPath = result.gns3project_path;
    session.configTexts = result.config_texts || {};
    session.validatorPassed = result.validator_passed;
    if (store && store.broadcast && result.config_texts) {
      for (const [deviceName, configText] of Object.entries(result.config_texts)) {
        const CHUNK_SIZE = 80;
        for (let i = 0; i < configText.length; i += CHUNK_SIZE) {
          store.broadcast(session, {
            event: "config_text",
            data: { device_name: deviceName, chunk: configText.slice(i, i + CHUNK_SIZE), start: i === 0, done: false },
          });
        }
        store.broadcast(session, {
          event: "config_text",
          data: { device_name: deviceName, chunk: "", start: false, done: true },
        });
      }
    }
    if (store && store.broadcast) {
      const topo = result.final_dict?.topology || {};
      const nodesList = topo.nodes || [];
      const linksList = topo.links || [];
      const configured = nodesList.filter((n) => n.properties && (
        n.properties.startup_config_content || n.properties.startup_script || n.properties.start_command
      )).length;
      store.broadcast(session, {
        event: "complete",
        data: { download_url: `/sessions/${session.sessionId}/download`, validator_passed: result.validator_passed, node_count: nodesList.length, link_count: linksList.length, configured_count: configured },
      });
      store.broadcast(session, { event: "phase_change", data: { phase: "success", sub_phase: null } });
    }
    const profileLabels = { none: "no hardening (pure lab)", basic: "basic hardening (SSH, AAA, NTP, Syslog)", enterprise: "enterprise-grade hardening (ZBF, ACLs, SNMPv3, HSRP)" };
    return JSON.stringify({
      success: true, security_profile: securityProfile,
      profile_description: profileLabels[securityProfile] || securityProfile,
      download_url: `/sessions/${session.sessionId}/download`,
      validator_passed: result.validator_passed,
      message: `Successfully exported GNS3 project with '${profileLabels[securityProfile]}' security profile.`,
    });
  } catch (exc) {
    data.topologyApproved = false;
    return JSON.stringify({ success: false, error: `Export failed: ${exc.message}` });
  }
}

async function _toolSearchCiscoKnowledge(topic, session, store, data) {
  try {
    const result = await aiEngine.searchQA({ topic });
    return JSON.stringify({ success: true, topic: result.topic, answer: result.answer, message: `Found information about '${topic}'.` });
  } catch (exc) {
    return JSON.stringify({ success: false, error: `Knowledge search failed: ${exc.message}` });
  }
}

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

async function dispatch(userMessage, session, store) {
  let data;
  if (session._agentData && session._agentData instanceof AgentSessionData) {
    data = session._agentData;
  } else {
    data = new AgentSessionData();
    session._agentData = data;
  }
  data.conversationHistory.push({ role: "user", content: userMessage });
  _trimHistory(data);

  const toolCallsMade = [];
  let finalText = "";

  for (let roundNum = 1; roundNum <= MAX_TOOL_ROUNDS; roundNum++) {
    const systemPrompt = _buildSystemPrompt(data);
    const messages = [{ role: "system", content: systemPrompt }, ...data.conversationHistory];

    let response;
    try {
      const client = _getClient();
      response = await client.chat.completions.create({
        model: LLM_MODEL, messages, tools: TOOL_DEFINITIONS,
        tool_choice: "auto", max_tokens: LLM_MAX_TOKENS,
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

    const msgDict = { role: "assistant" };
    if (assistantMessage.content) msgDict.content = assistantMessage.content;
    if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
      msgDict.tool_calls = assistantMessage.tool_calls.map((tc) => ({
        id: tc.id, type: "function", function: { name: tc.function.name, arguments: tc.function.arguments },
      }));
    }
    if (!msgDict.content) msgDict.content = null;

    data.conversationHistory.push(msgDict);

    if (!assistantMessage.tool_calls || assistantMessage.tool_calls.length === 0) {
      finalText = assistantMessage.content || "";
      break;
    }

    for (const toolCall of assistantMessage.tool_calls) {
      const toolName = toolCall.function.name;
      const toolArgsStr = toolCall.function.arguments;
      const toolCallId = toolCall.id;
      let toolArgs = {};
      try { toolArgs = JSON.parse(toolArgsStr); } catch { toolArgs = {}; }
      toolCallsMade.push(toolName);

      let resultStr;
      try {
        resultStr = await _executeToolCall(toolName, toolArgs, session, store, data);
      } catch (exc) {
        resultStr = JSON.stringify({ success: false, error: `Tool execution failed: ${exc.message}` });
      }
      data.conversationHistory.push({ role: "tool", tool_call_id: toolCallId, content: resultStr });
    }
    _trimHistory(data);
  }

  if (!finalText) {
    finalText = "I've completed several actions but may not have finished everything. Let me know if you'd like me to continue.";
  }

  if (store && store.broadcast) {
    store.broadcast(session, { event: "agent_message", data: { message: finalText, tool_calls_made: toolCallsMade } });
  }

  session._agentData = data;
  return new AgentResponse({ message: finalText, toolCallsMade });
}

export { dispatch, AgentSessionData, AgentResponse, _buildSystemPrompt, _executeToolCall };
