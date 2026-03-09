const CFG = {
  SERVER: location.origin,
  WS: `ws://${location.host}/ws`,
  API_GESTURE: "/api/gesture",

  MAX_HP: 100,
  MOVES: {
    punch:       { dmg: 15, range: 300, cd: 500,  icon: "👊", color: "#ff4466" },
    shield:      { dmg: 0,  dur: 1500,  cd: 300,  icon: "🛡️", color: "#00ff88" },
    speed_boost: { dmg: 0,  dur: 2000,  cd: 300,  icon: "⚡",  color: "#ffd700" },
  },

  GESTURE_MS: 120,          // detection interval
  PING_MS: 2000,
  PLAYER_W: 55, PLAYER_H: 95,
};