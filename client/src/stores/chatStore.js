/**
 * Chat store — sessions, messages, streaming, topology, tools.
 * The single source of truth for the chat UI.
 */
import { create } from 'zustand';
import { sessionApi } from '../services/endpoints.js';
import { sseManager } from '../services/sse.js';

export const useChatStore = create((set, get) => ({
  // ── State ──────────────────────────────────────────────
  sessions: [],
  activeSessionId: null,
  messages: {},          // sessionId → Message[]
  streamingText: '',     // Live LLM token stream
  isStreaming: false,
  activeTool: null,      // { tool, args, steps: [] }
  topology: null,        // { topologyId, topology_dict, ... }
  exportKit: null,       // { exportId, files, ... }
  error: null,
  loadingSession: false,

  // ── Actions ────────────────────────────────────────────

  loadSessions: async () => {
    try {
      const { sessions } = await sessionApi.list();
      set({ sessions });
    } catch (err) {
      console.error('Failed to load sessions:', err);
    }
  },

  createSession: async () => {
    const { sessionId } = await sessionApi.create();
    set((s) => ({
      sessions: [{ _id: sessionId, title: 'New Chat', createdAt: new Date().toISOString() }, ...s.sessions],
      activeSessionId: sessionId,
      messages: { ...s.messages, [sessionId]: [] },
      streamingText: '',
      isStreaming: false,
      activeTool: null,
      topology: null,
      exportKit: null,
      error: null,
    }));
    sseManager.connect(sessionId, get().handleSSEEvent);
    return sessionId;
  },

  selectSession: async (sessionId) => {
    set({ activeSessionId: sessionId, loadingSession: true, streamingText: '', isStreaming: false, activeTool: null, error: null });
    try {
      const { session, topology } = await sessionApi.get(sessionId);
      set((s) => ({
        messages: { ...s.messages, [sessionId]: session.messages || [] },
        topology: topology ? {
          topologyId: topology._id,
          topology_dict: topology.topologyDict,
          name: topology.name,
          nodeCount: topology.nodeCount,
          linkCount: topology.linkCount,
        } : null,
        loadingSession: false,
      }));
      sseManager.connect(sessionId, get().handleSSEEvent);
    } catch (err) {
      set({ loadingSession: false, error: 'Failed to load session' });
    }
  },

  deleteSession: async (sessionId) => {
    await sessionApi.delete(sessionId);
    set((s) => {
      const newMessages = { ...s.messages };
      delete newMessages[sessionId];
      const newSessions = s.sessions.filter(x => x._id !== sessionId);
      return {
        sessions: newSessions,
        messages: newMessages,
        activeSessionId: s.activeSessionId === sessionId ? null : s.activeSessionId,
      };
    });
  },

  sendMessage: async (content) => {
    const sessionId = get().activeSessionId;
    if (!sessionId || !content.trim()) return;

    // Append user message locally
    set((s) => ({
      messages: {
        ...s.messages,
        [sessionId]: [...(s.messages[sessionId] || []), { role: 'user', content, createdAt: new Date().toISOString() }],
      },
      streamingText: '',
      isStreaming: true,
      activeTool: null,
      error: null,
    }));

    try {
      await sessionApi.sendMessage(sessionId, content);
    } catch (err) {
      set({ isStreaming: false, error: 'Failed to send message' });
    }
  },

  // ── SSE event handler — THE single entry point ────────
  handleSSEEvent: (event, data) => {
    const sessionId = get().activeSessionId;
    if (!sessionId) return;

    switch (event) {
      case 'token_delta':
        set((s) => ({
          streamingText: s.streamingText + (data.token || ''),
          isStreaming: true,
        }));
        break;

      case 'tool_start':
        set({ activeTool: { tool: data.tool, args: data.args, steps: [] } });
        break;

      case 'tool_progress':
        set((s) => {
          if (!s.activeTool) return {};
          return {
            activeTool: {
              ...s.activeTool,
              steps: [...s.activeTool.steps, data.step],
            },
          };
        });
        break;

      case 'tool_result':
        set((s) => ({
          messages: data.summary ? {
            ...s.messages,
            [sessionId]: [
              ...(s.messages[sessionId] || []),
              ...(s.streamingText ? [] : []), // streaming text already converted below
            ],
          } : s.messages,
          activeTool: null,
        }));
        // If there was streaming text before tool_result, save it as a message
        if (get().streamingText) {
          const text = get().streamingText;
          set((s) => ({
            streamingText: '',
            messages: {
              ...s.messages,
              [sessionId]: [...(s.messages[sessionId] || []), {
                role: 'assistant',
                content: text,
                tool: data.tool,
                toolSummary: data.summary,
                createdAt: new Date().toISOString(),
              }],
            },
          }));
        }
        break;

      case 'topology_ready':
        set({ topology: {
          topologyId: data.topologyId,
          topology_dict: data.topology_dict,
          topology_data: data.topology_data,
          requirements: data.requirements,
          design_review: data.design_review,
          assumptions: data.assumptions,
          thinking_text: data.thinking_text,
        }});
        break;

      case 'deployment_ready':
        set({ exportKit: data });
        break;

      case 'agent_message':
        // Final message replaces streaming text
        set((s) => ({
          messages: {
            ...s.messages,
            [sessionId]: [...(s.messages[sessionId] || []), {
              role: 'assistant',
              content: data.message,
              createdAt: new Date().toISOString(),
            }],
          },
          streamingText: '',
        }));
        // Reload sessions to pick up auto-title
        get().loadSessions();
        break;

      case 'complete':
        set({ isStreaming: false, activeTool: null });
        // If there's leftover streaming text that wasn't followed by tool_result or agent_message, save it
        if (get().streamingText) {
          const text = get().streamingText;
          set((s) => ({
            streamingText: '',
            messages: {
              ...s.messages,
              [sessionId]: [...(s.messages[sessionId] || []), {
                role: 'assistant',
                content: text,
                createdAt: new Date().toISOString(),
              }],
            },
          }));
        }
        break;

      case 'error':
        set({ isStreaming: false, activeTool: null, error: data.message });
        break;

      case 'keepalive':
        // No-op, just keeps connection alive
        break;

      default:
        // Unknown event — log for debugging
        console.debug('[SSE] Unknown event:', event, data);
    }
  },

  reset: () => {
    sseManager.disconnect();
    set({
      streamingText: '',
      isStreaming: false,
      activeTool: null,
      topology: null,
      exportKit: null,
      error: null,
    });
  },
}));
