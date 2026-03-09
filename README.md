# GestureStrike

Prototype structure for a gesture-controlled game using a Python backend and a browser-based client.

## Layout

- **server**: Flask app and isolated gesture engine (`gesture_engine.py`). Place downloadable ML / MediaPipe models inside `server/models/`.
- **client**: Static web client with a clear split between networking, gesture detection, game engine, renderer, HUD, audio, and particles.
- **run.py**: Convenience entry point that runs the Flask server.

## Getting started

1. Create a virtual environment and install backend dependencies:

   ```bash
   cd server
   python -m venv .venv
   source .venv/bin/activate  # On Windows: .venv\Scripts\activate
   pip install -r requirements.txt
   ```

2. Launch the server from the project root:

   ```bash
   python run.py
   ```

3. Open `client/index.html` in a browser (or serve the `client` directory with any static file server).
