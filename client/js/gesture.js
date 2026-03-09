/**
 * Gesture — sends camera frames to Python backend for AI detection.
 */
class Gesture {
  constructor() {
    this.video = null;
    this._c = document.createElement("canvas");
    this._c.width = 320; this._c.height = 240;
    this._ctx = this._c.getContext("2d");
    this.stream = null;
    this._timer = null;
    this._cd = false;
    this.current = "idle";
    this.conf = 0;
    this.onGesture = null;
  }

  async start(videoEl) {
    this.video = videoEl;
    this.stream = await navigator.mediaDevices.getUserMedia({
      video: { width:{ideal:640}, height:{ideal:480}, facingMode:"user" }
    });
    videoEl.srcObject = this.stream;
    await videoEl.play();
    this._timer = setInterval(() => this._tick(), CFG.GESTURE_MS);
  }

  async _tick() {
    if (!this.video || this.video.readyState < 2 || this._cd) return;
    this._ctx.drawImage(this.video, 0, 0, 320, 240);
    const img = this._c.toDataURL("image/jpeg", .6);
    try {
      const r = await fetch(CFG.API_GESTURE, {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({image:img})
      });
      const d = await r.json();
      if (d.new && d.gesture !== "idle") {
        this.current = d.gesture;
        this.conf = d.confidence;
        this._cd = true;
        setTimeout(() => { this._cd = false; this.current = "idle"; },
          CFG.MOVES[d.gesture]?.cd || 500);
        if (this.onGesture) this.onGesture(d.gesture, d.confidence);
      }
    } catch(e) { /* silent */ }
  }

  stop() {
    clearInterval(this._timer);
    this.stream?.getTracks().forEach(t => t.stop());
  }
}