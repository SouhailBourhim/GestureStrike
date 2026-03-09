/**
 * Tiny audio manager using Web Audio API oscillators (no files needed).
 */
class Audio {
  constructor() {
    this.ctx = null;
    this._init = false;
  }
  _ensure() {
    if (!this._init) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this._init = true;
    }
  }
  _beep(freq, dur, type = "square", vol = .12) {
    this._ensure();
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.value = vol;
    g.gain.exponentialRampToValueAtTime(.001, this.ctx.currentTime + dur);
    o.connect(g).connect(this.ctx.destination);
    o.start(); o.stop(this.ctx.currentTime + dur);
  }
  punch()    { this._beep(220, .12, "sawtooth", .15); }
  shield()   { this._beep(600, .2,  "sine",     .08); }
  speed()    { this._beep(880, .15, "triangle",  .1); }
  hit()      { this._beep(120, .2,  "sawtooth", .2);  }
  block()    { this._beep(400, .1,  "sine",     .06); }
  miss()     { this._beep(180, .08, "triangle", .05); }
  win()      { [523,659,784].forEach((f,i)=>setTimeout(()=>this._beep(f,.3,"sine",.12),i*150)); }
  lose()     { [300,250,200].forEach((f,i)=>setTimeout(()=>this._beep(f,.3,"sawtooth",.1),i*200)); }
}