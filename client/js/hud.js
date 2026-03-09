/**
 * HUD — updates DOM HP bars, gesture badge, network stats, action feed.
 */
const HUD = {
  els: {},

  init() {
    const g = id => document.getElementById(id);
    this.els = {
      hpL:g("hud-hp-l"), hpR:g("hud-hp-r"),
      valL:g("hud-val-l"), valR:g("hud-val-r"),
      nameL:g("hud-name-l"), nameR:g("hud-name-r"),
      gIcon:g("g-icon"), gLabel:g("g-label"), gBadge:g("gesture-badge"),
      camRing:g("cam-ring"),
      rtt:g("ns-rtt"), jit:g("ns-jit"), fps:g("ns-fps"),
      feed:g("feed"),
    };
  },

  update(engine, net) {
    const { me, foe, fps } = engine;
    const e = this.els;

    // HP bars
    e.hpL.style.width = me.hp + "%";
    e.hpR.style.width = foe.hp + "%";
    e.valL.textContent = me.hp;
    e.valR.textContent = foe.hp;
    e.hpL.classList.toggle("critical", me.hp <= 25);
    e.hpR.classList.toggle("critical", foe.hp <= 25);

    // net
    e.rtt.textContent = Math.round(net.rtt);
    e.jit.textContent = net.jitter().toFixed(1);
    e.fps.textContent = fps;
  },

  gesture(name, conf) {
    const e = this.els;
    const icons = {idle:"🤚",punch:"👊",shield:"🛡️",speed_boost:"⚡"};
    e.gIcon.textContent = icons[name] || "🤚";
    e.gLabel.textContent = name.replace("_"," ").toUpperCase();
    e.gBadge.className = name === "idle" ? "" : `active ${name}`;
    // cam flash
    e.camRing.classList.add("flash");
    setTimeout(() => e.camRing.classList.remove("flash"), 250);
  },

  log(text, cls = "") {
    const li = document.createElement("li");
    li.textContent = text;
    if (cls) li.className = cls;
    this.els.feed.prepend(li);
    while (this.els.feed.children.length > 8) this.els.feed.lastChild.remove();
    setTimeout(() => { li.style.opacity = 0; setTimeout(() => li.remove(), 300); }, 4000);
  },

  names(l, r) { this.els.nameL.textContent = l; this.els.nameR.textContent = r; },
};