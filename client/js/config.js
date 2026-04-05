const CFG = {
  SERVER: location.origin,
  WS: `ws://${location.host}/ws`,
  // API_GESTURE removed — gesture detection now runs in-browser via MediaPipe WASM

  MAX_HP: 100,
  MOVES: {
    punch:       { dmg: 15, range: 1000, cd: 500,  icon: "👊", color: "#ff4466" },
    shield:      { dmg: 0,  dur: 1500,  cd: 300,  icon: "🛡️", color: "#00ff88" },
    speed_boost: { dmg: 0,  dur: 2000,  cd: 300,  icon: "⚡",  color: "#ffd700" },
  },

  // GESTURE_MS removed — detection now runs every rAF frame (~16 ms) via MediaPipe
  PING_MS: 2000,
  PLAYER_W: 55, PLAYER_H: 95,
};