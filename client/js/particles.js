/**
 * Lightweight particle system for backgrounds & effects.
 */
class Particles {
  constructor(canvas, count = 60) {
    this.c = canvas;
    this.ctx = canvas.getContext("2d");
    this.pts = [];
    this._resize();
    for (let i = 0; i < count; i++) this.pts.push(this._spawn());
    window.addEventListener("resize", () => this._resize());
  }
  _resize() {
    this.c.width = this.c.parentElement?.offsetWidth || innerWidth;
    this.c.height = this.c.parentElement?.offsetHeight || innerHeight;
  }
  _spawn() {
    return {
      x: Math.random() * this.c.width,
      y: Math.random() * this.c.height,
      r: Math.random() * 2 + .5,
      vx: (Math.random() - .5) * .3,
      vy: (Math.random() - .5) * .3,
      a: Math.random() * .35 + .05,
    };
  }
  tick() {
    const { ctx, c, pts } = this;
    ctx.clearRect(0, 0, c.width, c.height);
    for (const p of pts) {
      p.x += p.vx; p.y += p.vy;
      if (p.x < 0) p.x = c.width;
      if (p.x > c.width) p.x = 0;
      if (p.y < 0) p.y = c.height;
      if (p.y > c.height) p.y = 0;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(0,200,255,${p.a})`;
      ctx.fill();
    }
    // lines between close points
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        const dx = pts[i].x - pts[j].x, dy = pts[i].y - pts[j].y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < 120) {
          ctx.beginPath();
          ctx.moveTo(pts[i].x, pts[i].y);
          ctx.lineTo(pts[j].x, pts[j].y);
          ctx.strokeStyle = `rgba(0,200,255,${.08 * (1 - d / 120)})`;
          ctx.stroke();
        }
      }
    }
  }
}