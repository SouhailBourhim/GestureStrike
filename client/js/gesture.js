/**
 * Gesture — In-browser hand gesture recognition via MediaPipe Tasks Vision.
 *
 * Replaces the old HTTP-polling approach with direct WASM inference running
 * on every animation frame (~16 ms loop instead of 120 ms HTTP round-trip).
 *
 * Recognised gestures (mirrors gesture_engine.py logic):
 *   punch       – closed fist   (≤ 1 finger extended)
 *   shield      – open palm     (≥ 4 fingers extended)
 *   speed_boost – V-sign        (index + middle only)
 *   idle        – everything else
 */

const MP_TASKS_VISION =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.34/+esm";
const MP_VISION_URL =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.34/wasm";

let _mpTasksCache = null;
async function loadMediaPipeTasks() {
  if (_mpTasksCache) return _mpTasksCache;
  const mod = await import(MP_TASKS_VISION);
  const FilesetResolver = mod.FilesetResolver;
  const HandLandmarker = mod.HandLandmarker;
  if (!FilesetResolver || !HandLandmarker) {
    throw new Error(
      "MediaPipe Tasks Vision: missing exports (FilesetResolver / HandLandmarker)"
    );
  }
  _mpTasksCache = { FilesetResolver, HandLandmarker };
  return _mpTasksCache;
}

class Gesture {
  constructor() {
    this.video       = null;
    this.stream      = null;
    this.onGesture   = null;

    this.current     = "idle";
    this.conf        = 0;
    this.ready       = false;   // true once MediaPipe has loaded

    this._landmarker = null;
    this._raf        = null;    // requestAnimationFrame handle
    this._cd         = false;   // per-gesture cooldown flag
    this._last       = "idle";  // previous non-idle result (for edge detection)
    this._lastTs     = -1;      // last timestamp sent to MediaPipe (must be strictly increasing)
  }

  /* ── public API ──────────────────────────────────────────────────────── */

  /**
   * Initialise MediaPipe, start the camera, begin the rAF detection loop.
   * Mirrors the old `start(videoEl)` signature so app.js needs no changes.
   */
  async start(videoEl) {
    this.video = videoEl;

    // 1. Load MediaPipe Tasks Vision (dynamic import avoids race with deferred <script type="module">)
    const { FilesetResolver, HandLandmarker } = await loadMediaPipeTasks();
    const vision = await FilesetResolver.forVisionTasks(MP_VISION_URL);

    // 2. Create the HandLandmarker in VIDEO mode (streaming, timestamp-based)
    this._landmarker = await HandLandmarker.createFromOptions(
      vision,
      {
        baseOptions: {
          modelAssetPath:
            "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
          delegate: "GPU",   // falls back to CPU automatically if unavailable
        },
        runningMode:                  "VIDEO",
        numHands:                     1,
        minHandDetectionConfidence:   0.55,
        minHandPresenceConfidence:    0.55,
        minTrackingConfidence:        0.45,
      }
    );

    // 3. Open the camera
    this.stream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" },
    });
    videoEl.srcObject = this.stream;
    await videoEl.play();

    this.ready = true;
    console.log("✅ GestureEngine (browser) ready");

    // 4. Start the detection loop
    this._loop();
  }

  stop() {
    if (this._raf) cancelAnimationFrame(this._raf);
    this._raf = null;
    this.stream?.getTracks().forEach(t => t.stop());
    this._landmarker?.close();
    this.ready = false;
  }

  /* ── detection loop ──────────────────────────────────────────────────── */

  _loop() {
    if (!this.ready) return;
    this._raf = requestAnimationFrame(() => this._detect());
  }

  _detect() {
    if (!this.ready || !this.video || this.video.readyState < 2) {
      this._loop(); return;
    }

    // MediaPipe VIDEO mode requires a strictly-increasing timestamp (ms)
    const ts = performance.now();
    if (ts <= this._lastTs) { this._loop(); return; }
    this._lastTs = ts;

    // Run inference synchronously (WASM, ~5-15 ms on most machines)
    const result = this._landmarker.detectForVideo(this.video, ts);

    if (result.landmarks && result.landmarks.length > 0) {
      const lm = result.landmarks[0];           // array of {x,y,z} objects
      const { gesture, confidence } = this._classify(lm);
      this._handleGesture(gesture, confidence);
    } else {
      this._last = "idle";
      this.current = "idle";
    }

    this._loop();
  }

  /* ── gesture classification ──────────────────────────────────────────── */
  // Ports the Python _classify() + _extended() logic 1-to-1.

  _classify(lm) {
    const ext = this._extended(lm);
    const n   = ext.filter(Boolean).length;

    if (n <= 1) return { gesture: "punch", confidence: 0.92 };
    if (n >= 4) return { gesture: "shield", confidence: 0.88 };
    // V-sign: index + middle up, ring + pinky down (thumb may be up — do not require n === 2)
    if (ext[1] && ext[2] && !ext[3] && !ext[4]) {
      return { gesture: "speed_boost", confidence: 0.87 };
    }
    return { gesture: "idle", confidence: 0.0 };
  }

  /**
   * Returns [thumb, index, middle, ring, pinky] extended booleans.
   * A finger is "extended" when its tip is farther from the wrist than its pip.
   * Uses Euclidean distance in normalised (x,y,z) space — same logic as Python.
   */
  _extended(lm) {
    const dist = (a, b) => {
      const dx = a.x - b.x, dy = a.y - b.y, dz = a.z - b.z;
      return Math.sqrt(dx*dx + dy*dy + dz*dz);
    };
    const w = lm[0]; // wrist
    // thumb: tip=4, pip=3
    const thumb = dist(lm[4], w) > dist(lm[3], w);
    // fingers: [tip, pip] pairs
    const pairs = [[8,6],[12,10],[16,14],[20,18]];
    const fingers = pairs.map(([t,p]) => dist(lm[t], w) > dist(lm[p], w));
    return [thumb, ...fingers];
  }

  /* ── edge-detection + cooldown ───────────────────────────────────────── */

  _handleGesture(gesture, confidence) {
    this.current = gesture;
    this.conf    = confidence;

    // Only fire callback on the leading edge of a new non-idle gesture
    if (gesture === "idle" || gesture === this._last || this._cd) return;

    this._last = gesture;
    this._cd   = true;

    // Release cooldown after the move's configured cd (ms)
    setTimeout(() => {
      this._cd      = false;
      this._last    = "idle";
      this.current  = "idle";
    }, CFG.MOVES[gesture]?.cd ?? 500);

    if (this.onGesture) this.onGesture(gesture, confidence);
  }
}