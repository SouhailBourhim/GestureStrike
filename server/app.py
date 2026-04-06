"""
GestureStrike — Main server.
Signaling (WebSocket) + Gesture API + Static files.
"""

import json, base64, sys, ssl
from pathlib import Path

import cv2, numpy as np
from aiohttp import web

try:
    import aiohttp_cors
    _CORS = True
except ImportError:
    _CORS = False

from gesture_engine import GestureEngine

# ── paths ──────────────────────────────────────────────────
ROOT   = Path(__file__).parent.parent.absolute()
CLIENT = ROOT / "client"

# ── gesture detector (singleton) ──────────────────────────
_engine: GestureEngine | None = None

def engine() -> GestureEngine:
    global _engine
    if _engine is None:
        _engine = GestureEngine()
    return _engine

# ── rooms ──────────────────────────────────────────────────
rooms: dict[str, list[web.WebSocketResponse]] = {}

async def ws_handler(req):
    rid = req.match_info["room"]
    ws  = web.WebSocketResponse()
    await ws.prepare(req)

    if rid not in rooms:
        rooms[rid] = []
    if len(rooms[rid]) >= 2:
        await ws.send_json({"t": "error", "msg": "full"})
        await ws.close()
        return ws

    rooms[rid].append(ws)
    pn = len(rooms[rid])
    print(f"[room:{rid}] player {pn} joined")
    await ws.send_json({"t": "joined", "player": pn, "room": rid})

    if len(rooms[rid]) == 2:
        for p in rooms[rid]:
            await p.send_json({"t": "ready"})

    try:
        async for msg in ws:
            if msg.type == web.WSMsgType.TEXT:
                d = json.loads(msg.data)
                for p in rooms[rid]:
                    if p is not ws and not p.closed:
                        await p.send_json(d)
    except Exception as exc:
        print(f"[ws] {exc}")
    finally:
        if rid in rooms and ws in rooms[rid]:
            rooms[rid].remove(ws)
            for p in rooms[rid]:
                if not p.closed:
                    await p.send_json({"t": "peer_left"})
            if not rooms[rid]:
                del rooms[rid]
    return ws

# ── gesture API ────────────────────────────────────────────
async def gesture_api(req):
    try:
        body = await req.json()
        img_b64 = body.get("image", "")
        if "," in img_b64:
            img_b64 = img_b64.split(",", 1)[1]
        buf = base64.b64decode(img_b64)
        arr = np.frombuffer(buf, np.uint8)
        frame = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        if frame is None:
            return web.json_response({"error": "bad image"}, status=400)
        return web.json_response(engine().process(frame))
    except Exception as exc:
        return web.json_response({"error": str(exc)}, status=500)

# ── static ─────────────────────────────────────────────────
CT = {".html": "text/html", ".css": "text/css",
      ".js": "application/javascript", ".json": "application/json",
      ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml",
      ".ico": "image/x-icon", ".woff2": "font/woff2"}

async def index(req):
    p = CLIENT / "index.html"
    return web.FileResponse(p) if p.exists() else web.Response(text="client missing")

async def static(req):
    p = CLIENT / req.match_info["path"]
    if p.is_file():
        return web.FileResponse(p, headers={"Content-Type": CT.get(p.suffix, "application/octet-stream")})
    return web.Response(status=404)

async def health(req):
    e = engine()
    return web.json_response({"ok": True, "ai": e.ready,
        "rooms": {k: len(v) for k, v in rooms.items()}})

# ── cors middleware (fallback) ─────────────────────────────
@web.middleware
async def cors_mw(req, handler):
    if req.method == "OPTIONS":
        r = web.Response()
    else:
        r = await handler(req)
    r.headers["Access-Control-Allow-Origin"] = "*"
    r.headers["Access-Control-Allow-Headers"] = "Content-Type"
    r.headers["Access-Control-Allow-Methods"] = "GET,POST,OPTIONS"
    return r

# ── app factory ────────────────────────────────────────────
def create():
    app = web.Application(middlewares=[] if _CORS else [cors_mw])
    app.router.add_get("/",            index)
    app.router.add_get("/health",      health)
    app.router.add_get("/ws/{room}",   ws_handler)
    app.router.add_post("/api/gesture", gesture_api)
    app.router.add_get("/{path:.+}",   static)

    if _CORS:
        c = aiohttp_cors.setup(app, defaults={
            "*": aiohttp_cors.ResourceOptions(
                allow_credentials=True, expose_headers="*",
                allow_headers="*", allow_methods="*")})
        for r in list(app.router.routes()):
            try: c.add(r)
            except ValueError: pass

    async def shutdown(a):
        engine().close()
        for ps in rooms.values():
            for w in ps:
                await w.close()
    app.on_shutdown.append(shutdown)
    return app

if __name__ == "__main__":
    print("\n" + "═" * 56)
    print("   ⚔️  GestureStrike  — Neural P2P Combat")
    print("═" * 56)
    engine()  # warm‑up
    app = create()
    PORT = 8080

    cert_path = ROOT / "server" / "cert.pem"
    key_path = ROOT / "server" / "key.pem"
    ssl_context = None
    scheme = "http"
    if cert_path.exists() and key_path.exists():
        ssl_context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
        ssl_context.load_cert_chain(cert_path, key_path)
        scheme = "https"

    print(f"\n   🌐  {scheme}://localhost:{PORT}")
    print(f"   📡  {'wss' if scheme == 'https' else 'ws'}://localhost:{PORT}/ws/{{room}}")
    print(f"   🤖  AI: {'ready' if engine().ready else 'off (keyboard mode)'}")
    print(f"\n   Ctrl+C to stop\n" + "═" * 56 + "\n")
    web.run_app(app, host="0.0.0.0", port=PORT, print=None, ssl_context=ssl_context)