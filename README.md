# GestureStrike — Neural P2P Combat

A real-time, peer-to-peer browser fighting game controlled entirely by hand gestures. No keyboard
needed — your webcam is the controller.

**Stack:** Python 3.10+ · aiohttp · WebSockets · MediaPipe HandLandmarker · Canvas 2D · Web Audio API

---

## Engineering highlights

The game is the demo; the latency work is the project.

- **Gesture recognition** — MediaPipe HandLandmarker extracts 21 3D hand landmarks per frame; a
  heuristic distance classifier maps finger-extension patterns to combat actions.
- **Frame skipping** — the server-side engine processes every 3rd frame (~10 fps inference on 30 fps
  input), cutting CPU load by 66% with no perceptible loss of gesture accuracy.
- **Fire-and-forget delivery** — action packets carry no retries and no buffering, equivalent to a
  WebRTC DataChannel with `maxRetransmits: 0`. Late is worse than lost in a fighting game.
- **Client-side prediction** — actions apply locally before the packet leaves, so the game feels
  lag-free regardless of RTT.
- **Live RTT and jitter measurement** — NTP-style ping/pong with exponential smoothing (α = 0.3);
  jitter is the standard deviation of the last 12 samples, displayed in the HUD.

---

## How it works

Each player's webcam is processed locally by a MediaPipe AI that detects hand poses. Recognised gestures are sent as JSON packets to the opponent over a WebSocket relay. All game logic runs client-side for zero-latency local feedback.

## Combat Moves

| Gesture | Action | Effect |
|---|---|---|
| ✊ Closed fist | Punch | 15 HP damage if in range |
| 🖐️ Open palm | Shield | Blocks next punch for 1.5 s |
| ✌️ V-sign | Speed Boost | Extends punch reach for 2 s |

Keyboard fallback: `1`/`p` → punch, `2`/`s` → shield, `3`/`b` → speed boost.

## Project Structure

```
gesturestrike/
├── run.py                  # Convenience launcher
├── DOCS.md                 # Full technical documentation
├── server/
│   ├── app.py              # aiohttp server (WebSocket relay + gesture API + static)
│   ├── gesture_engine.py   # Server-side MediaPipe gesture recogniser
│   ├── requirements.txt
│   └── models/             # MediaPipe model (auto-downloaded on first run)
└── client/
    ├── index.html
    ├── css/style.css
    └── js/
        ├── config.js       # Game constants
        ├── app.js          # App orchestrator
        ├── gesture.js      # In-browser MediaPipe hand detection
        ├── engine.js       # Game state & hit detection
        ├── network.js      # WebSocket client + RTT/jitter measurement
        ├── renderer.js     # Canvas drawing
        ├── hud.js          # HP bars, gesture badge, net stats
        ├── audio.js        # Web Audio sound effects
        └── particles.js    # Menu background particles
```

## Getting Started

**Requirements:** Python 3.10+, a modern browser, a webcam.

```bash
# 1. Install dependencies
pip install -r server/requirements.txt

# 2. Start the server
python run.py
```

Opens `https://localhost:8080` automatically. For a two-player match, open a second tab or connect from another machine on the same network. The server will natively generate an SSL certificate on the first run and provide an `https://[YOUR_IP]:8080` address in the console. Using HTTPS ensures that peer browsers permit webcam access across the LAN (`getUserMedia` strictly requires a Secure Context).

## Course context

Built for **INE2 SmartICT — IP et Multimédia** (2025-2026, Project 4), implementing the brief's
Hybrid Edge-Peer architecture and its `{"action": ..., "power": ...}` data-channel concept.

See [DOCS.md](DOCS.md) for the full technical breakdown.
