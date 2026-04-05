# GestureStrike — Neural P2P Combat

A real-time, peer-to-peer browser fighting game controlled entirely by hand gestures. No keyboard needed — your webcam is the controller.

Built for **INE2 SmartICT — IP et Multimédia** (2025-2026, Project 4).

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

Opens `http://localhost:8080` automatically. For a two-player match, open a second tab (or connect from another machine on the same network) using the same room code.

## Key Engineering Features

- **AI Gesture Engine** — MediaPipe HandLandmarker extracts 21 3D hand landmarks per frame. A heuristic distance classifier maps finger extension patterns to game actions.
- **Frame skipping** — The server-side engine processes every 3rd frame (~10 fps inference at 30 fps input), cutting CPU load by 66% with no perceptible loss of gesture accuracy.
- **Low-latency delivery** — Action packets are fire-and-forget (no retries, no buffering), equivalent to a WebRTC DataChannel with `maxRetransmits: 0`.
- **Client-side prediction** — Actions are applied locally before the network packet is sent, making the game feel lag-free regardless of RTT.
- **NTP-style RTT & jitter measurement** — Ping/pong packets measure round-trip time with exponential smoothing (α = 0.3). Jitter (std dev of last 12 samples) is displayed live in the HUD.

See [DOCS.md](DOCS.md) for the full technical breakdown.
