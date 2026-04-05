const CFG = {
  SERVER: location.origin,
  WS: `${location.protocol === "https:" ? "wss:" : "ws:"}//${location.host}/ws`,

  MAX_HP: 100,
  MOVES: {
    // reachFrac: |dx| cap as fraction of stage width (fighter gap ≈ 0.44); speed_boost widens reach
    punch: {
      dmg: 15,
      reachFrac: 0.438,
      reachFracFast: 0.49,
      cd: 500,
      icon: "👊",
      color: "#ff4466",
    },
    shield:      { dmg: 0,  dur: 1500,  cd: 300,  icon: "🛡️", color: "#00ff88" },
    speed_boost: { dmg: 0,  dur: 2000,  cd: 300,  icon: "⚡",  color: "#ffd700" },
  },

  GESTURE_STABLE_FRAMES: 3,

  PING_MS: 2000,
  PLAYER_W: 55, PLAYER_H: 95,
};