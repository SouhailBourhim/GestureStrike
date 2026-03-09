/**
 * Engine — authoritative game-state (HP, cooldowns, hit detection).
 */
class Engine {
  constructor() { this.reset(); }

  reset() {
    const mk = (local) => ({
      hp: CFG.MAX_HP, x:0, y:0,
      w: CFG.PLAYER_W, h: CFG.PLAYER_H,
      local, shielded:false, shieldEnd:0,
      fast:false, fastEnd:0,
      act:"idle", actEnd:0,
      color: local ? "#00c8ff" : "#ff4466",
      name: local ? "YOU" : "ENEMY",
    });
    this.me = mk(true);
    this.foe = mk(false);
    this.over = false;
    this.winner = null;
    this.fx = [];
    this.t = performance.now();
    this.fps = 0; this._fc = 0; this._ft = performance.now();
  }

  layout(w, h) {
    const gy = h - 140;
    this.me.x  = w * .28; this.me.y  = gy;
    this.foe.x = w * .72; this.foe.y = gy;
  }

  /* ── actions ──────────────────────────── */
  doLocal(act) { return this._act(this.me, this.foe, act); }
  doRemote(act) { return this._act(this.foe, this.me, act); }

  _act(src, tgt, act) {
    if (this.over) return "none";
    const now = performance.now();
    src.act = act; src.actEnd = now + 300;

    if (act === "punch") {
      const d = Math.abs(src.x - tgt.x);
      if (d <= CFG.MOVES.punch.range) {
        if (tgt.shielded) { this._fx(tgt.x, tgt.y-60, "BLOCKED", "#00ff88"); return "block"; }
        tgt.hp = Math.max(0, tgt.hp - CFG.MOVES.punch.dmg);
        this._fx(tgt.x, tgt.y-60, `-${CFG.MOVES.punch.dmg}`, "#ff4466");
        this._checkEnd();
        return "hit";
      }
      this._fx(src.x + (src.local?60:-60), src.y-50, "MISS", "#666");
      return "miss";
    }
    if (act === "shield") {
      src.shielded = true;
      src.shieldEnd = now + CFG.MOVES.shield.dur;
      this._fx(src.x, src.y-80, "🛡️", "#00ff88");
      return "shield";
    }
    if (act === "speed_boost") {
      src.fast = true;
      src.fastEnd = now + CFG.MOVES.speed_boost.dur;
      this._fx(src.x, src.y-80, "⚡", "#ffd700");
      return "speed";
    }
    return "none";
  }

  _fx(x,y,txt,col) {
    this.fx.push({x,y,txt,col,a:1,vy:-1.8});
  }
  _checkEnd() {
    if (this.me.hp<=0)  { this.over=true; this.winner="foe"; }
    if (this.foe.hp<=0) { this.over=true; this.winner="me";  }
  }

  /* ── tick ─────────────────────────────── */
  tick() {
    const now = performance.now();
    this._fc++;
    if (now - this._ft >= 1000) { this.fps = this._fc; this._fc = 0; this._ft = now; }
    this._upd(this.me, now);
    this._upd(this.foe, now);
    this.fx = this.fx.filter(f => { f.y += f.vy; f.a -= .014; return f.a > 0; });
  }
  _upd(p, now) {
    if (p.shielded && now > p.shieldEnd) p.shielded = false;
    if (p.fast && now > p.fastEnd) p.fast = false;
    if (p.act !== "idle" && now > p.actEnd) p.act = "idle";
  }
}