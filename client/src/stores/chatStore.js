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
      const { session, topology, exportJob } = await sessionApi.get(sessionId);
      // Attach the loaded topology to the last assistant message that
      // produced it (generate/edit_topology), so it renders inline in the
      // correct chronological position — not floating at the bottom.
      const loadedMessages = session.messages || [];
      if (topology) {
        const topoData = {
          topologyId: topology._id,
          topology_dict: topology.topologyDict,
          topology_data: { name: topology.name, node_count: topology.nodeCount, link_count: topology.linkCount },
          name: topology.name,
          nodeCount: topology.nodeCount,
          linkCount: topology.linkCount,
        };
        for (let i = loadedMessages.length - 1; i >= 0; i--) {
          if (loadedMessages[i].role === 'assistant' &&
              (loadedMessages[i].tool === 'generate_topology' || loadedMessages[i].tool === 'edit_topology')) {
            loadedMessages[i] = { ...loadedMessages[i], topology: topoData };
            break;
          }
        }
      }
      // Reconstruct the exportKit from the loaded export job and attach it
      // to the last assistant message — so the download buttons persist
      // across session switches and page reloads. The export job from the
      // server has a different shape than the deployment_ready SSE event,
      // so we rebuild the files array + deviceConfigs here.
      if (exportJob && exportJob.status === 'complete') {
        const gns3Name = exportJob.files?.gns3Project
          ? exportJob.files.gns3Project.split(/[\\/]/).pop()
          : 'project.gns3project';
        // Derive device count from finalDict if available
        const deviceNames = exportJob.finalDict?.topology?.nodes
          ?.filter(n => n.node_type === 'dynamips' || n.node_type === 'iou' || n.node_type === 'qemu')
          .map(n => n.name) || [];
        const exportKitData = {
          exportId: exportJob._id,
          files: [
            { name: gns3Name, type: 'gns3project', size: null },
            { name: 'configs.zip', type: 'configs', size: null },
            { name: 'requirements.txt', type: 'manifest', size: null },
          ],
          securityProfile: exportJob.securityProfile,
          validation: exportJob.validation,
          deviceConfigs: deviceNames,
        };
        for (let i = loadedMessages.length - 1; i >= 0; i--) {
          if (loadedMessages[i].role === 'assistant') {
            loadedMessages[i] = { ...loadedMessages[i], exportKit: exportKitData };
            break;
          }
        }
      }
      set((s) => ({
        messages: { ...s.messages, [sessionId]: loadedMessages },
        topology: null,  // floating state stays null — topology is on the message
        exportKit: null, // floating state stays null — exportKit is on the message
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
        // Attach the pending topology to a message so it renders inline.
        //
        // Two cases:
        //  (a) streamingText is non-empty: the LLM's pre-tool text hasn't been
        //      saved yet (agent_message hasn't fired). Save it as a new message
        //      with the topology attached.
        //  (b) streamingText is empty: agent_message already fired and saved the
        //      pre-tool text as a message. Attach the topology to THAT last
        //      assistant message instead — otherwise the topology never gets
        //      attached and never renders.
        const pendingTopo = (data.tool === 'generate_topology' || data.tool === 'edit_topology')
          ? get().topology : null;

        if (get().streamingText) {
          // Case (a): save the streaming text as a new message with topology
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
                topology: pendingTopo,
                createdAt: new Date().toISOString(),
              }],
            },
            topology: pendingTopo ? null : s.topology,
          }));
        } else if (pendingTopo) {
          // Case (b): agent_message already saved the text — attach topology
          // to the last assistant message in the array.
          set((s) => {
            const msgs = s.messages[sessionId] ? [...s.messages[sessionId]] : [];
            for (let i = msgs.length - 1; i >= 0; i--) {
              if (msgs[i].role === 'assistant') {
                msgs[i] = { ...msgs[i], topology: pendingTopo };
                break;
              }
            }
            return {
              messages: { ...s.messages, [sessionId]: msgs },
              topology: null,
            };
          });
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
        // Attach the export kit to the LAST assistant message in the active
        // session, so it renders inline with that message (in the correct
        // chronological position) instead of floating at the bottom of the
        // conversation. This keeps the download buttons anchored to the
        // assistant message that produced them, even when the user sends
        // more messages afterward.
        set((s) => {
          const msgs = s.messages[sessionId] ? [...s.messages[sessionId]] : [];
          // Find the last assistant message (the one that triggered the export)
          for (let i = msgs.length - 1; i >= 0; i--) {
            if (msgs[i].role === 'assistant') {
              msgs[i] = { ...msgs[i], exportKit: data };
              break;
            }
          }
          return {
            messages: { ...s.messages, [sessionId]: msgs },
            exportKit: null,  // clear floating state — it's now on the message
          };
        });
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
