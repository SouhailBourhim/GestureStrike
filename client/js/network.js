/**
 * Network — WebRTC DataChannel with NTP clock-sync & jitter tracking.
 */
class Network {
  constructor() {
    this.pc = null;
    this.dc = null;
    this.ws = null;
    this.host = false;
    this.connected = false;

    this.onOpen = null;
    this.onData = null;
    this.onClose = null;

    // clock sync
    this.offset = 0;
    this.rtt = 0;
    this._pings = {};
    this._pingTimer = null;

    // jitter
    this._jBuf = [];
    this._lastRecv = 0;
  }

  /* ── connect ─────────────────────────── */
  connect(room, isHost) {
    this.host = isHost;
    return new Promise((ok, fail) => {
      this.ws = new WebSocket(`${CFG.WS}/${room}`);
      this.ws.onmessage = e => this._sig(JSON.parse(e.data), ok, fail);
      this.ws.onerror = fail;
      this.ws.onclose = () => { if (this.onClose) this.onClose(); };
    });
  }

  async _sig(d, ok, fail) {
    switch (d.t || d.type) {
      case "joined": break;
      case "error":  fail(new Error(d.msg)); break;
      case "ready":  await this._setup(); if (this.host) await this._offer(); break;
      case "offer":  if (!this.host) await this._answer(d); break;
      case "answer": if (this.host) await this.pc.setRemoteDescription({type:"answer",sdp:d.sdp}); break;
      case "ice":    if (d.candidate) this.pc.addIceCandidate(d.candidate).catch(()=>{}); break;
      case "peer_left": if (this.onClose) this.onClose(); break;
    }
  }

  async _setup() {
    this.pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
    });
    this.pc.onicecandidate = e => {
      if (e.candidate) this.ws.send(JSON.stringify({ type:"ice", candidate:e.candidate.toJSON() }));
    };
    if (this.host) {
      this.dc = this.pc.createDataChannel("g", { ordered:false, maxRetransmits:0 });
      this._wire(this.dc);
    } else {
      this.pc.ondatachannel = e => { this.dc = e.channel; this._wire(this.dc); };
    }
  }

  async _offer() {
    const o = await this.pc.createOffer();
    await this.pc.setLocalDescription(o);
    this.ws.send(JSON.stringify({ type:"offer", sdp:o.sdp }));
  }

  async _answer(d) {
    await this.pc.setRemoteDescription({ type:"offer", sdp:d.sdp });
    const a = await this.pc.createAnswer();
    await this.pc.setLocalDescription(a);
    this.ws.send(JSON.stringify({ type:"answer", sdp:a.sdp }));
  }

  _wire(ch) {
    ch.onopen = () => {
      this.connected = true;
      this._startSync();
      if (this.onOpen) this.onOpen();
    };
    ch.onclose = () => { this.connected = false; if (this.onClose) this.onClose(); };
    ch.onmessage = e => {
      const now = performance.now();
      if (this._lastRecv) { this._jBuf.push(now - this._lastRecv); if (this._jBuf.length > 60) this._jBuf.shift(); }
      this._lastRecv = now;
      const d = JSON.parse(e.data);
      if (d.t === "ping") { this.send({t:"pong",id:d.id,t1:d.t1,t2:now,t3:performance.now()}); return; }
      if (d.t === "pong") { this._pong(d, now); return; }
      if (this.onData) this.onData(d);
    };
  }

  send(o) { if (this.dc?.readyState === "open") this.dc.send(JSON.stringify(o)); }
  action(name, conf) { this.send({ t:"act", a:name, p:conf, ts:this.now() }); }

  /* clock sync */
  _startSync() {
    this._ping();
    this._pingTimer = setInterval(() => this._ping(), CFG.PING_MS);
  }
  _ping() {
    const id = performance.now().toString(36);
    this._pings[id] = performance.now();
    this.send({ t:"ping", id, t1:performance.now() });
  }
  _pong(d, t4) {
    const t1 = this._pings[d.id]; if (!t1) return; delete this._pings[d.id];
    this.offset = ((d.t2 - t1) + (d.t3 - t4)) / 2;
    this.rtt = Math.max(0, (t4 - t1) - (d.t3 - d.t2));
  }
  now() { return performance.now() + this.offset; }
  jitter() {
    if (this._jBuf.length < 2) return 0;
    const m = this._jBuf.reduce((a,b)=>a+b,0)/this._jBuf.length;
    return Math.sqrt(this._jBuf.reduce((s,v)=>s+(v-m)**2,0)/this._jBuf.length);
  }

  close() {
    clearInterval(this._pingTimer);
    this.dc?.close(); this.pc?.close(); this.ws?.close();
    this.connected = false;
  }
}