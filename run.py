#!/usr/bin/env python3
import os, sys, time, subprocess, webbrowser, signal, socket

def get_lan_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("8.8.8.8", 80))
        return s.getsockname()[0]
    except Exception:
        return "127.0.0.1"
    finally:
        s.close()

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

    lan_ip = get_lan_ip()
    cert_path = os.path.join(srv, "cert.pem")
    key_path = os.path.join(srv, "key.pem")
    
    if not os.path.exists(cert_path) or not os.path.exists(key_path):
        print("  🔒 Generating self-signed SSL certificate for LAN play...")
        try:
            env = os.environ.copy()
            env["RANDFILE"] = ".rnd"
            subprocess.run([
                "openssl", "req", "-x509", "-newkey", "rsa:2048", "-nodes",
                "-out", cert_path, "-keyout", key_path, "-days", "365",
                "-subj", f"/CN={lan_ip}"
            ], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, env=env)
            print("  ✅ SSL Certificate generated")
        except Exception as e:
            print(f"  ⚠️ Could not generate SSL certificate: {e}\n  → LAN play might not work due to browser security policies.")
    else:
        print("  ✅ SSL Certificate found")

    proc = subprocess.Popen([sys.executable, "app.py"], cwd=srv)
    time.sleep(2)
    if proc.poll() is not None:
        print("  ❌ Server failed"); sys.exit(1)

    # Determine URL scheme
    scheme = "https" if os.path.exists(cert_path) else "http"
    local_url = f"{scheme}://localhost:8080"
    lan_url = f"{scheme}://{lan_ip}:8080"
    
    webbrowser.open(local_url)
    print(f"  🌐 Browser opened — {local_url}")
    print(f"  🤝 To play on LAN, open this on Player 2's device:\n     → {lan_url}\n")

    signal.signal(signal.SIGINT, lambda *_: (proc.terminate(), sys.exit(0)))
    try:
        proc.wait()
    except KeyboardInterrupt:
        proc.terminate()

if __name__ == "__main__":
    main()