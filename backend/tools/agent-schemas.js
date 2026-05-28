/**
 * agent-schemas.js — Session data models for the StructuraNet AI conversational agent.
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
    this.conversationHistory = conversationHistory;
    this.topologyDict = topologyDict;
    this.phase1File = phase1File;
    this.originalRequest = originalRequest;
    this.editIterations = editIterations;
    this.maxEditIterations = maxEditIterations;
    this.topologyApproved = topologyApproved;
  }

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

class AgentResponse {
  constructor({ message, toolCallsMade = [] }) {
    this.message = message;
    this.toolCallsMade = toolCallsMade;
  }

  toJSON() {
    return { message: this.message, toolCallsMade: this.toolCallsMade };
  }
}

export { AgentSessionData, AgentResponse };
