/**
 * Renderer — draws the arena, fighters, effects onto a <canvas>.
 */
class Renderer {
  constructor(canvas) {
    this.c = canvas;
    this.x = canvas.getContext("2d");
    this._resize();
    window.addEventListener("resize", () => this._resize());
  }

  _resize() {
    this.c.width  = innerWidth;
    this.c.height = innerHeight;
  }

  draw(engine) {
    const { x, c } = this;
    const W = c.width, H = c.height;

    /* background */
    const bg = x.createLinearGradient(0,0,0,H);
    bg.addColorStop(0,"#08081a"); bg.addColorStop(1,"#141428");
    x.fillStyle = bg; x.fillRect(0,0,W,H);

    /* grid lines (subtle) */
    x.strokeStyle = "rgba(255,255,255,.03)"; x.lineWidth = 1;
    for (let i=0;i<W;i+=80){ x.beginPath(); x.moveTo(i,0); x.lineTo(i,H); x.stroke(); }
    for (let i=0;i<H;i+=80){ x.beginPath(); x.moveTo(0,i); x.lineTo(W,i); x.stroke(); }

    /* ground */
    const gy = H - 100;
    const ground = x.createLinearGradient(0,gy,0,H);
    ground.addColorStop(0,"#1e1e3a"); ground.addColorStop(1,"#12122a");
    x.fillStyle = ground; x.fillRect(0,gy,W,100);
    x.strokeStyle = "rgba(0,200,255,.15)"; x.lineWidth = 2;
    x.beginPath(); x.moveTo(0,gy); x.lineTo(W,gy); x.stroke();

    /* players */
    this._drawFighter(engine.me);
    this._drawFighter(engine.foe);

    /* range indicator */
    this._drawRange(engine);

    /* effects */
    for (const f of engine.fx) {
      x.globalAlpha = f.a;
      x.font = "bold 26px Orbitron, sans-serif";
      x.textAlign = "center";
      x.fillStyle = f.col;
      x.fillText(f.txt, f.x, f.y);
    }
    x.globalAlpha = 1;
  }

  _drawFighter(p) {
    const { x } = this;
    const px = p.x, py = p.y, w = p.w, h = p.h;

    /* shadow */
    x.fillStyle = "rgba(0,0,0,.35)";
    x.beginPath(); x.ellipse(px,py+8,w*.7,12,0,0,Math.PI*2); x.fill();

    /* body – gradient */
    const grad = x.createLinearGradient(px-w/2, py-h, px+w/2, py);
    const c1 = p.local ? "rgba(0,180,255,.9)" : "rgba(255,60,90,.9)";
    const c2 = p.local ? "rgba(0,100,200,.7)" : "rgba(180,30,60,.7)";
    grad.addColorStop(0, c1); grad.addColorStop(1, c2);
    x.fillStyle = grad;

    /* rounded body */
    this._roundRect(px - w/2, py - h, w, h, 8);
    x.fill();

    /* highlight edge */
    x.strokeStyle = p.local ? "rgba(100,220,255,.4)" : "rgba(255,120,140,.4)";
    x.lineWidth = 2;
    this._roundRect(px - w/2, py - h, w, h, 8);
    x.stroke();

    /* head */
    x.beginPath(); x.arc(px, py-h-22, 22, 0, Math.PI*2);
    x.fillStyle = grad; x.fill();
    x.strokeStyle = p.local ? "rgba(100,220,255,.3)" : "rgba(255,120,140,.3)";
    x.stroke();

    /* eye */
    const ed = p.local ? 1 : -1;
    x.fillStyle = "#fff";
    x.beginPath(); x.arc(px+ed*7, py-h-27, 4.5, 0, Math.PI*2); x.fill();
    x.fillStyle = "#111";
    x.beginPath(); x.arc(px+ed*8, py-h-27, 2, 0, Math.PI*2); x.fill();

    /* shield bubble */
    if (p.shielded) {
      x.strokeStyle = "rgba(0,255,136,.7)"; x.lineWidth = 3;
      x.beginPath(); x.ellipse(px, py-h/2, w+22, h/2+35, 0, 0, Math.PI*2); x.stroke();
      x.fillStyle = "rgba(0,255,136,.06)"; x.fill();
    }

    /* speed trails */
    if (p.fast) {
      const dir = p.local ? -1 : 1;
      for (let i=1;i<=4;i++) {
        x.fillStyle = `rgba(255,215,0,${.25 - i*.05})`;
        x.fillRect(px + dir*i*18 - 6, py-h+8, 12, h-16);
      }
    }

    /* punch FX */
    if (p.act === "punch") {
      const dir = p.local ? 1 : -1;
      const fx = px + dir*(w+32);
      x.fillStyle = "#ffd700";
      x.beginPath(); x.arc(fx, py-h/2, 20, 0, Math.PI*2); x.fill();
      x.strokeStyle = "#ffd700"; x.lineWidth = 2.5;
      for (let i=0;i<6;i++) {
        const a = (Math.PI/3)*i;
        x.beginPath(); x.moveTo(fx,py-h/2);
        x.lineTo(fx+Math.cos(a)*28, py-h/2+Math.sin(a)*28); x.stroke();
      }
    }

    /* name plate */
    x.font = "bold 13px Orbitron, sans-serif";
    x.textAlign = "center";
    x.fillStyle = p.color;
    x.fillText(p.name, px, py+32);
  }

  _drawRange(eng) {
    const d = Math.abs(eng.me.x - eng.foe.x);
    const inR = d <= CFG.MOVES.punch.range;
    const { x, c } = this;
    x.font = "13px Rajdhani, sans-serif";
    x.textAlign = "center";
    x.fillStyle = inR ? "#00ff88" : "#444";
    x.fillText(`${Math.round(d)}px ${inR?"◆ IN RANGE":"— out of range"}`, c.width/2, c.height-55);
  }

  _roundRect(rx,ry,rw,rh,r) {
    const { x } = this;
    x.beginPath();
    x.moveTo(rx+r,ry);
    x.lineTo(rx+rw-r,ry); x.quadraticCurveTo(rx+rw,ry,rx+rw,ry+r);
    x.lineTo(rx+rw,ry+rh-r); x.quadraticCurveTo(rx+rw,ry+rh,rx+rw-r,ry+rh);
    x.lineTo(rx+r,ry+rh); x.quadraticCurveTo(rx,ry+rh,rx,ry+rh-r);
    x.lineTo(rx,ry+r); x.quadraticCurveTo(rx,ry,rx+r,ry);
    x.closePath();
  }
}