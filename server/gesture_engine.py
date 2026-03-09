"""
Gesture Engine — Isolated AI module for hand gesture recognition.
Uses MediaPipe Tasks API (0.10.30+).
"""

import sys
import urllib.request
from pathlib import Path

import cv2
import numpy as np

MODEL_DIR = Path(__file__).parent / "models"
MODEL_PATH = MODEL_DIR / "hand_landmarker.task"
MODEL_URL = (
    "https://storage.googleapis.com/mediapipe-models/"
    "hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task"
)

# ── import mediapipe ──────────────────────────────────────
try:
    import mediapipe as mp
    from mediapipe.tasks.python import BaseOptions
    from mediapipe.tasks.python.vision import (
        HandLandmarker,
        HandLandmarkerOptions,
        RunningMode,
    )
    MP_OK = True
except ImportError:
    MP_OK = False


def _ensure_model() -> bool:
    MODEL_DIR.mkdir(exist_ok=True)
    if MODEL_PATH.exists():
        return True
    print("  📥  Downloading hand‑landmarker model …")
    try:
        urllib.request.urlretrieve(MODEL_URL, MODEL_PATH)
        print("  ✅  Model downloaded")
        return True
    except Exception as exc:
        print(f"  ❌  Download failed: {exc}")
        return False


class GestureEngine:
    """
    Stateful gesture recogniser.

    Recognised gestures:
        punch       – closed fist
        shield      – open palm (≥ 4 fingers extended)
        speed_boost – V‑sign (index + middle only)

    All other hand poses map to ``idle``.
    """

    GESTURES = ("idle", "punch", "shield", "speed_boost")

    def __init__(self, *, skip_frames: int = 3, cooldown_frames: int = 18):
        self.skip = skip_frames
        self.cooldown_max = cooldown_frames
        self._frame_no = 0
        self._cooldown = 0
        self._last = "idle"
        self._detector = None
        self.ready = False

        if not MP_OK:
            print("  ⚠️  MediaPipe unavailable → keyboard‑only mode")
            return
        if not _ensure_model():
            return

        try:
            opts = HandLandmarkerOptions(
                base_options=BaseOptions(model_asset_path=str(MODEL_PATH)),
                running_mode=RunningMode.IMAGE,
                num_hands=1,
                min_hand_detection_confidence=0.55,
                min_hand_presence_confidence=0.55,
                min_tracking_confidence=0.45,
            )
            self._detector = HandLandmarker.create_from_options(opts)
            self.ready = True
            print("  ✅  GestureEngine ready")
        except Exception as exc:
            print(f"  ❌  GestureEngine init failed: {exc}")

    # ── public ────────────────────────────────────────────
    def process(self, frame: np.ndarray) -> dict:
        if not self.ready:
            return self._result("idle", 0)

        self._frame_no += 1
        if self._frame_no % self.skip:
            return self._result(self._last, 0, skipped=True)
        if self._cooldown > 0:
            self._cooldown -= 1
            return self._result("idle", 0, cooldown=True)

        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        mp_img = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
        det = self._detector.detect(mp_img)

        if not det.hand_landmarks:
            self._last = "idle"
            return self._result("idle", 0)

        lm = np.array([[p.x, p.y, p.z] for p in det.hand_landmarks[0]])
        gesture, conf = self._classify(lm)

        if gesture != "idle" and gesture != self._last:
            self._cooldown = self.cooldown_max
            self._last = gesture
            return self._result(gesture, conf, new=True)

        self._last = gesture
        return self._result(gesture, conf)

    def close(self):
        if self._detector:
            self._detector.close()

    # ── internals ─────────────────────────────────────────
    @staticmethod
    def _result(gesture, conf, **flags):
        r = {"gesture": gesture, "confidence": round(conf, 3)}
        r.update(flags)
        return r

    def _classify(self, lm):
        ext = self._extended(lm)
        n = sum(ext)
        if n <= 1:
            return ("punch", 0.92)
        if n >= 4:
            return ("shield", 0.88)
        if n == 2 and ext[1] and ext[2] and not ext[3] and not ext[4]:
            return ("speed_boost", 0.87)
        return ("idle", 0.0)

    @staticmethod
    def _extended(lm):
        w = lm[0]
        out = [np.linalg.norm(lm[4] - w) > np.linalg.norm(lm[3] - w)]
        for t, p in zip([8, 12, 16, 20], [6, 10, 14, 18]):
            out.append(np.linalg.norm(lm[t] - w) > np.linalg.norm(lm[p] - w))
        return out