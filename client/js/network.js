/**
 * WebSocket signaling relay (server forwards JSON between two peers per room).
 */
class Network {
  constructor() {
    this.ws = null;
    this.connected = false;
    this.onOpen = null;
    this.onData = null;
    this.onClose = null;

    this.rtt = 0;
    this._pingTimer = null;
    this._pingId = 0;
    this._pending = new Map();
    this._rttSamples = [];
    this._maxRttSamples = 12;
  }

  jitter() {
    if (this._rttSamples.length < 2) return 0;
    const m = this._rttSamples.reduce((a, b) => a + b, 0) / this._rttSamples.length;
    const v =
      this._rttSamples.reduce((s, x) => s + (x - m) * (x - m), 0) /
      this._rttSamples.length;
    return Math.sqrt(v);
  }

  _wsUrl(room) {
    const proto = location.protocol === "https:" ? "wss:" : "ws:";
    return `${proto}//${location.host}/ws/${encodeURIComponent(room)}`;
  }

  /**
   * Opens the room WebSocket and resolves when the server broadcasts { t: "ready" }
   * (second player joined). Calls onOpen right before resolving.
   */
  connect(room, _host) {
    return new Promise((resolve, reject) => {
      const url = this._wsUrl(room);
      let settled = false;

      const finish = () => {
        if (settled) return;
        settled = true;
        this.connected = true;
        this._startPing();
        if (typeof this.onOpen === "function") this.onOpen();
        resolve();
      };

      try {
        this.ws = new WebSocket(url);
      } catch (e) {
        reject(e);
        return;
      }

      this.ws.onopen = () => {};

      this.ws.onmessage = (ev) => {
        let d;
        try {
          d = JSON.parse(ev.data);
        } catch {
          return;
        }

        if (d.t === "error") {
          if (!settled) reject(new Error(d.msg || "room error"));
          return;
        }

        if (d.t === "ready") {
          finish();
          return;
        }

        if (d.t === "peer_left") {
          if (typeof this.onClose === "function") this.onClose();
          return;
        }

        if (d.t === "ping") {
          this.send({ t: "pong", id: d.id, at: d.at });
          return;
        }
        if (d.t === "pong" && d.id != null && this._pending.has(d.id)) {
          const sent = this._pending.get(d.id);
          this._pending.delete(d.id);
          const rtt = performance.now() - sent;
          this.rtt = this.rtt === 0 ? rtt : this.rtt * 0.7 + rtt * 0.3;
          this._rttSamples.push(rtt);
          if (this._rttSamples.length > this._maxRttSamples) this._rttSamples.shift();
          return;
        }

        if (typeof this.onData === "function") this.onData(d);
      };

      this.ws.onerror = () => {
        if (!settled) reject(new Error("WebSocket error"));
      };

      this.ws.onclose = () => {
        this.connected = false;
        this._stopPing();
        if (typeof this.onClose === "function") this.onClose();
      };
    });
  }

  _startPing() {
    this._stopPing();
    this._pingTimer = setInterval(() => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
      const id = ++this._pingId;
      const at = performance.now();
      this._pending.set(id, at);
      this.send({ t: "ping", id, at });
      setTimeout(() => this._pending.delete(id), 5000);
    }, CFG.PING_MS);
  }

  _stopPing() {
    if (this._pingTimer) {
      clearInterval(this._pingTimer);
      this._pingTimer = null;
    }
    this._pending.clear();
  }

  send(d) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(d));
    }
  }

  action(name, conf) {
    this.send({ t: "act", a: name, c: conf });
  }

  close() {
    this._stopPing();
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.close();
      this.ws = null;
    }
    this.connected = false;
  }
}
