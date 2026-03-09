/**
 * App — ties everything together.
 */
(() => {
  /* instances */
  let net      = null;
  let gest     = null;
  let engine   = null;
  let renderer = null;
  let audio    = new Audio();
  let particles= null;
  let raf      = null;
  let myName   = "Player";

  /* DOM */
  const $ = id => document.getElementById(id);

  function view(name) {
    document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
    $(`view-${name}`).classList.add("active");
  }

  /* ── menu particles ──────────────────── */
  (function bootParticles() {
    const el = $("menu-particles");
    if (!el) return;
    const cv = document.createElement("canvas");
    cv.style.cssText = "width:100%;height:100%";
    el.appendChild(cv);
    particles = new Particles(cv, 50);
    (function loop() { particles.tick(); requestAnimationFrame(loop); })();
  })();

  /* ── buttons ─────────────────────────── */
  $("btn-host").onclick = () => go(true);
  $("btn-join").onclick = () => go(false);
  $("btn-cancel").onclick = cancel;
  $("btn-again").onclick = rematch;
  $("btn-home").onclick  = home;

  async function go(host) {
    const room = $("in-room").value.trim() || "arena1";
    myName = $("in-name").value.trim() || "Player";
    $("menu-status").textContent = "Connecting …";
    $("menu-status").className = "status";

    try {
      /* camera */
      gest = new Gesture();
      await gest.start($("cam"));
      gest.onGesture = onLocalGesture;

      /* network */
      net = new Network();
      net.onOpen  = onConnected;
      net.onData  = onData;
      net.onClose = onPeerLeft;

      $("lobby-room").textContent = room;
      view("lobby");

      await net.connect(room, host);
    } catch (e) {
      $("menu-status").textContent = e.message;
      $("menu-status").className = "status err";
      view("menu");
      cleanup();
    }
  }

  /* ── connected ───────────────────────── */
  function onConnected() {
    engine   = new Engine();
    renderer = new Renderer($("arena"));
    engine.layout(innerWidth, innerHeight);
    window.addEventListener("resize", () => engine.layout(innerWidth, innerHeight));

    HUD.init();
    HUD.names(myName, "Enemy");

    net.send({ t:"info", name: myName });

    view("fight");
    loop();
  }

  /* ── game loop ───────────────────────── */
  function loop() {
    if (!engine) return;
    engine.tick();
    renderer.draw(engine);
    HUD.update(engine, net);
    if (engine.over) { endGame(); return; }
    raf = requestAnimationFrame(loop);
  }

  /* ── local gesture ───────────────────── */
  function onLocalGesture(name, conf) {
    if (!engine || engine.over) return;
    const res = engine.doLocal(name);
    net.action(name, conf);
    HUD.gesture(name, conf);

    if (res === "hit")   { audio.hit();    HUD.log(`You PUNCH → HIT! -${CFG.MOVES.punch.dmg}`, "hit"); }
    if (res === "miss")  { audio.miss();   HUD.log("You PUNCH → miss"); }
    if (res === "block") { audio.block();  HUD.log("You PUNCH → blocked"); }
    if (res === "shield"){ audio.shield(); HUD.log("You raise SHIELD"); }
    if (res === "speed") { audio.speed();  HUD.log("You activate SPEED"); }
  }

  /* ── network messages ────────────────── */
  function onData(d) {
    if (!engine) return;
    if (d.t === "act") {
      const res = engine.doRemote(d.a);
      HUD.gesture("idle", 0);

      if (res === "hit")   { audio.hit();    HUD.log(`Enemy PUNCH → HIT! -${CFG.MOVES.punch.dmg}`, "remote hit"); }
      if (res === "miss")  { audio.miss();   HUD.log("Enemy PUNCH → miss", "remote"); }
      if (res === "block") { audio.block();  HUD.log("Enemy PUNCH → blocked", "remote"); }
      if (res === "shield"){ audio.shield(); HUD.log("Enemy raises SHIELD", "remote"); }
      if (res === "speed") { audio.speed();  HUD.log("Enemy activates SPEED", "remote"); }
    }
    if (d.t === "info") {
      HUD.names(myName, d.name || "Enemy");
      engine.foe.name = d.name || "Enemy";
    }
    if (d.t === "rematch_ok") doRematch();
  }

  /* ── end game ────────────────────────── */
  function endGame() {
    cancelAnimationFrame(raf);
    const won = engine.winner === "me";
    if (won) audio.win(); else audio.lose();

    $("res-title").textContent = won ? "VICTORY" : "DEFEAT";
    $("res-title").className = won ? "win" : "lose";
    $("res-sub").textContent = won ? "You knocked out the opponent!" : "You were defeated …";
    $("res-hp-l").textContent = engine.me.hp;
    $("res-hp-r").textContent = engine.foe.hp;
    $("res-rtt").textContent = Math.round(net.rtt);

    view("result");
  }

  function rematch() {
    if (net?.connected) { net.send({t:"rematch"}); doRematch(); }
  }
  function doRematch() {
    engine.reset();
    engine.layout(innerWidth, innerHeight);
    $("feed").innerHTML = "";
    view("fight");
    loop();
  }

  function onPeerLeft() {
    HUD.log("Opponent disconnected", "remote");
    if (engine && !engine.over) {
      engine.over = true;
      engine.winner = "me";
      endGame();
    }
  }

  function cancel() { cleanup(); view("menu"); }
  function home()   { cleanup(); view("menu"); }

  function cleanup() {
    cancelAnimationFrame(raf);
    gest?.stop(); gest = null;
    net?.close();  net  = null;
    engine = null; renderer = null;
  }

  /* ── keyboard (testing) ──────────────── */
  document.addEventListener("keydown", e => {
    if (!engine || engine.over) return;
    const map = { "1":"punch","p":"punch", "2":"shield","s":"shield", "3":"speed_boost","b":"speed_boost" };
    const act = map[e.key];
    if (act) onLocalGesture(act, 1);
  });

  /* ── boot ────────────────────────────── */
  fetch("/health").then(r=>r.json()).then(d=>{
    console.log("✅ Server:", d);
  }).catch(()=>{
    $("menu-status").textContent = "⚠️ Server offline — start it first";
    $("menu-status").className = "status err";
  });

  console.log("⚔️ GestureStrike loaded");
})();