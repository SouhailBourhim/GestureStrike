#!/usr/bin/env python3
import os, sys, time, subprocess, webbrowser, signal

def main():
    root = os.path.dirname(os.path.abspath(__file__))
    srv  = os.path.join(root, "server")

    print("\n  ⚔️  GestureStrike — Neural P2P Combat\n")

    # check deps
    try:
        import aiohttp, cv2, numpy, mediapipe  # noqa
        print("  ✅ Dependencies OK")
    except ImportError as e:
        print(f"  ❌ {e}\n  → pip install -r server/requirements.txt")
        sys.exit(1)

    proc = subprocess.Popen([sys.executable, "app.py"], cwd=srv)
    time.sleep(2)
    if proc.poll() is not None:
        print("  ❌ Server failed"); sys.exit(1)

    webbrowser.open("http://localhost:8080")
    print("  🌐 Browser opened — http://localhost:8080")
    print("  Open a second tab for Player 2\n")

    signal.signal(signal.SIGINT, lambda *_: (proc.terminate(), sys.exit(0)))
    try:
        proc.wait()
    except KeyboardInterrupt:
        proc.terminate()

if __name__ == "__main__":
    main()