/**
 * SSE Service — singleton event bus.
 * Manages client connections per session and broadcasts events.
 */
import logger from '../utils/logger.js';

class SSEService {
  constructor() {
    /** @type {Map<string, Set<import('express').Response>>} */
    this.clients = new Map();
    this.heartbeats = new Map();  // sessionId → intervalId
  }

  /**
   * Subscribe a client (Express Response) to a session's events.
   * Sets proper SSE headers, starts heartbeat, cleans up on disconnect.
   */
  subscribe(sessionId, res) {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',  // disable nginx buffering
      'Access-Control-Allow-Origin': '*',
    });
    res.write(':ok\n\n');  // initial comment to flush headers

    let clients = this.clients.get(sessionId);
    if (!clients) {
      clients = new Set();
      this.clients.set(sessionId, clients);
    }
    clients.add(res);
    this._startHeartbeat(sessionId);
    logger.debug(`SSE client subscribed to session ${sessionId} (${clients.size} total)`);

    // Clean up on client disconnect
    res.on('close', () => this.unsubscribe(sessionId, res));
    res.on('error', (err) => {
      logger.warn(`SSE client error on session ${sessionId}:`, err.message);
      this.unsubscribe(sessionId, res);
    });
  }

  /**
   * Unsubscribe a client. Cleans up empty sessions.
   */
  unsubscribe(sessionId, res) {
    const clients = this.clients.get(sessionId);
    if (!clients) return;
    clients.delete(res);
    if (clients.size === 0) {
      this.clients.delete(sessionId);
      this._stopHeartbeat(sessionId);
    }
    if (!res.writableEnded) res.end();
    logger.debug(`SSE client unsubscribed from session ${sessionId} (${clients.size} remaining)`);
  }

  /**
   * Broadcast an event to ALL clients subscribed to a session.
   * @param {string} sessionId
   * @param {string} event  — event name (e.g. 'token_delta')
   * @param {*} data        — JSON-serializable data
   */
  broadcast(sessionId, event, data) {
    const clients = this.clients.get(sessionId);
    if (!clients || clients.size === 0) return;
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const res of clients) {
      try {
        res.write(payload);
      } catch (err) {
        logger.warn(`SSE write failed for session ${sessionId}:`, err.message);
        this.unsubscribe(sessionId, res);
      }
    }
  }

  /**
   * Returns true if any client is listening on this session.
   */
  hasListeners(sessionId) {
    const c = this.clients.get(sessionId);
    return !!c && c.size > 0;
  }

  // ── Heartbeat: send keepalive every 30s to keep connection alive ──
  _startHeartbeat(sessionId) {
    if (this.heartbeats.has(sessionId)) return;
    const intervalId = setInterval(() => {
      const clients = this.clients.get(sessionId);
      if (!clients || clients.size === 0) {
        this._stopHeartbeat(sessionId);
        return;
      }
      this.broadcast(sessionId, 'keepalive', { ts: Date.now() });
    }, 30_000);
    this.heartbeats.set(sessionId, intervalId);
  }

  _stopHeartbeat(sessionId) {
    const id = this.heartbeats.get(sessionId);
    if (id) {
      clearInterval(id);
      this.heartbeats.delete(sessionId);
    }
  }
}

// Singleton
const sseService = new SSEService();
export default sseService;
