/**
 * agent-schemas.js — Session data models for the StructuraNet AI conversational agent.
 *
 * Ported from: structranet/constants/agent_schemas.py → AgentSessionData, AgentResponse
 *
 * These classes track the mutable state the LLM needs to continue a
 * multi-turn conversation and produce structured responses.
 */

/**
 * All mutable state the agent needs to continue a multi-turn conversation.
 *
 * The LLM reads `conversationHistory` and the topology context fields
 * via a dynamically constructed system prompt to decide what to do next.
 * No state machine is stored here — the LLM is the orchestrator.
 */
class AgentSessionData {
  constructor({
    conversationHistory = [],
    topologyDict = null,
    phase1File = null,
    originalRequest = null,
    editIterations = 0,
    maxEditIterations = 10,
    topologyApproved = false,
  } = {}) {
    /**
     * Full OpenAI-compatible message list (user / assistant / tool roles).
     * Includes `tool_calls` and `tool_call_id` fields where applicable.
     * The system prompt is built dynamically and is NOT stored here.
     * @type {Array<Object>}
     */
    this.conversationHistory = conversationHistory;

    /**
     * The most recent hardware-injected topology dict produced by a
     * generate or modify tool call. Persisted across conversation turns.
     * @type {Object|null}
     */
    this.topologyDict = topologyDict;

    /**
     * Filesystem path to the Phase 1 JSON file written by the Python wrapper.
     * Required by the export tool.
     * @type {string|null}
     */
    this.phase1File = phase1File;

    /**
     * The user's original design requirement string. Used as the anchor
     * when re-running Phase 1 during edit iterations.
     * @type {string|null}
     */
    this.originalRequest = originalRequest;

    /**
     * How many `modify_current_topology` calls have been made this session.
     * @type {number}
     */
    this.editIterations = editIterations;

    /**
     * Hard cap on edit iterations to prevent infinite loops.
     * @type {number}
     */
    this.maxEditIterations = maxEditIterations;

    /**
     * `true` once the user has accepted the topology and called
     * `apply_security_and_export`. Reset to `false` after every edit.
     * @type {boolean}
     */
    this.topologyApproved = topologyApproved;
  }

  /**
   * Serialize to a plain object (for storing in DB or session).
   * @returns {Object}
   */
  toJSON() {
    return {
      conversationHistory: this.conversationHistory,
      topologyDict: this.topologyDict,
      phase1File: this.phase1File,
      originalRequest: this.originalRequest,
      editIterations: this.editIterations,
      maxEditIterations: this.maxEditIterations,
      topologyApproved: this.topologyApproved,
    };
  }

  /**
   * Deserialize from a plain object.
   * @param {Object} data
   * @returns {AgentSessionData}
   */
  static fromJSON(data) {
    if (!data) return new AgentSessionData();
    return new AgentSessionData({
      conversationHistory: data.conversationHistory || [],
      topologyDict: data.topologyDict || null,
      phase1File: data.phase1File || null,
      originalRequest: data.originalRequest || null,
      editIterations: data.editIterations || 0,
      maxEditIterations: data.maxEditIterations || 10,
      topologyApproved: data.topologyApproved || false,
    });
  }
}

/**
 * Unified response envelope the chat orchestrator returns for every user turn.
 *
 * Topology data, config text streaming, and progress events are delivered
 * separately via SSE — they do NOT appear in this envelope.
 */
class AgentResponse {
  /**
   * @param {Object} opts
   * @param {string} opts.message - The LLM's final natural-language reply after all tool calls complete.
   * @param {string[]} [opts.toolCallsMade=[]] - Ordered list of tool names invoked during this turn.
   */
  constructor({ message, toolCallsMade = [] }) {
    this.message = message;
    this.toolCallsMade = toolCallsMade;
  }

  toJSON() {
    return {
      message: this.message,
      toolCallsMade: this.toolCallsMade,
    };
  }
}

module.exports = { AgentSessionData, AgentResponse };
