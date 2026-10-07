<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=1920, height=1080" />
    <title>DisplayAds — Instructivo Core Pro</title>
    <script src="assets/vendor/gsap.min.js"></script>
    <script src="assets/brand/kit.js"></script>
    <link rel="stylesheet" href="assets/brand/displayads.css" />
    <link rel="stylesheet" href="assets/brand/tutorial.css" />
    <style>
      @font-face { font-family: "Outfit"; src: url("assets/fonts/outfit-latin-wght-normal.woff2") format("woff2"); font-weight: 100 900; }
      @font-face { font-family: "Geist"; src: url("assets/fonts/geist-latin-wght-normal.woff2") format("woff2"); font-weight: 100 900; }
      @font-face { font-family: "Geist Mono"; src: url("assets/fonts/geist-mono-latin-wght-normal.woff2") format("woff2"); font-weight: 100 900; }

      #hero-glow { left: 940px; top: 120px; }
      #hero { left: 900px; top: 250px; width: 900px; }
      #intro-copy { left: 140px; top: 330px; width: 760px; }
      #intro-copy h1 { font-size: 150px; margin-top: 24px; }
      #intro-copy p { font-size: 40px; color: var(--da-text-2); margin-top: 26px; }

      .step.top { top: 150px; width: 1640px; }
      .step.top h2 { font-size: 72px; margin-top: 22px; }
      #diagram .tv { left: 960px; top: 300px; width: 780px; height: 450px; }
      #diagram .tv-foot { left: 1230px; top: 750px; }
      #core { left: 250px; top: 560px; width: 440px; }
      #led { left: 640px; top: 640px; width: 14px; height: 14px; border-radius: 50%; background: #ef4444; box-shadow: 0 0 16px 4px rgba(239,68,68,0.9); }
      #wires { left: 0; top: 0; width: 1920px; height: 1080px; }
      .box { position: absolute; display: flex; align-items: center; gap: 16px; padding: 18px 24px; border-radius: 18px; background: #18181b; border: 1px solid var(--da-border-strong); font-family: var(--da-font-display); font-size: 26px; font-weight: 600; }
      .box .da-icon { font-size: 40px; color: var(--da-sky-400); }
      #router { left: 140px; top: 900px; }
      #psu { left: 700px; top: 930px; }
      #lbl-hdmi { left: 600px; top: 420px; }
      #lbl-lan { left: 140px; top: 820px; }
      #lbl-psu { left: 700px; top: 860px; }
      .tv-msg { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px; }
      #tv-nosignal { font-family: var(--da-font-mono); font-size: 28px; color: var(--da-text-3); letter-spacing: 0.14em; }
      #tv-logo img { width: 46%; }
      #tv-ad { position: absolute; inset: 0; display: flex; flex-direction: column; justify-content: flex-end; padding: 40px 46px; gap: 4px; }
      #tv-ad .p { font-family: var(--da-font-display); font-weight: 800; font-size: 120px; letter-spacing: -0.05em; line-height: 0.88; }
      #tv-ad .s { font-family: var(--da-font-display); font-weight: 600; font-size: 38px; }

      #ph { left: 1300px; top: 170px; }
      .scr { position: absolute; inset: 0; }
      .row-set { display: flex; align-items: center; gap: 14px; padding: 18px; border-radius: 16px; background: #1b1b1f; border: 1px solid var(--da-border); font-size: 22px; }
      .row-set .toggle { margin-left: auto; width: 64px; height: 36px; border-radius: 20px; background: #34d399; position: relative; flex: none; }
      .row-set .toggle i { position: absolute; left: 32px; top: 4px; width: 28px; height: 28px; border-radius: 50%; background: #fff; }
      .urlbar { display: flex; align-items: center; gap: 10px; padding: 16px 18px; border-radius: 14px; background: #0c0c0e; border: 1px solid var(--da-border-strong); font-family: var(--da-font-mono); font-size: 22px; }
      #addr { left: 140px; top: 560px; padding: 30px 40px; font-family: var(--da-font-mono); font-size: 76px; letter-spacing: -0.01em; }
      #addr-k { left: 140px; top: 500px; }
      #mobile-off { left: 140px; top: 760px; }
      #mini-tv { left: 140px; top: 480px; width: 640px; height: 370px; }
      #mini-online { left: 160px; top: 880px; }

      .wcard { position: absolute; top: 420px; width: 780px; padding: 44px 48px; box-sizing: border-box; display: flex; flex-direction: column; gap: 20px; }
      .wcard h3 { margin: 0; font-family: var(--da-font-display); font-weight: 600; font-size: 46px; letter-spacing: -0.03em; line-height: 1.05; }
      .wcard .da-chip { align-self: flex-start; font-size: 24px; }
      #w-bad { left: 140px; border-color: rgba(244,63,94,0.45); }
      #w-good { left: 1000px; border-color: rgba(52,211,153,0.45); }
      .big-ico { font-size: 70px; }

      #status { left: 140px; top: 470px; width: 1640px; padding: 34px 44px; box-sizing: border-box; display: grid; grid-template-columns: 30px 1.4fr 1fr 1fr; gap: 24px; align-items: center; font-size: 30px; }
      #status .n { font-family: var(--da-font-display); font-weight: 600; }
      #status .st { font-family: var(--da-font-mono); color: var(--da-emerald); letter-spacing: 0.1em; }
      #end-logo { left: 0; right: 0; top: 340px; display: flex; justify-content: center; }
      #end-logo img { width: 820px; }
      #end-row { left: 0; right: 0; top: 680px; display: flex; justify-content: center; gap: 22px; }
    </style>
  </head>
  <body>
    <svg width="0" height="0" style="position: absolute">
      <symbol id="i-plug" viewBox="0 0 24 24"><path d="M12 22v-5" /><path d="M9 8V2" /><path d="M15 8V2" /><path d="M18 8v5a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V8Z" /></symbol>
      <symbol id="i-router" viewBox="0 0 24 24"><rect width="20" height="8" x="2" y="14" rx="2" /><path d="M6.01 18H6" /><path d="M10.01 18H10" /><path d="M15 10v4" /><path d="M17.84 7.17a4 4 0 0 0-5.66 0" /><path d="M20.66 4.34a8 8 0 0 0-11.31 0" /></symbol>
      <symbol id="i-wifi" viewBox="0 0 24 24"><path d="M12 20h.01" /><path d="M2 8.82a15 15 0 0 1 20 0" /><path d="M5 12.859a10 10 0 0 1 14 0" /><path d="M8.5 16.429a5 5 0 0 1 7 0" /></symbol>
      <symbol id="i-check" viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5" /></symbol>
      <symbol id="i-x" viewBox="0 0 24 24"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></symbol>
      <symbol id="i-alert" viewBox="0 0 24 24"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" /><path d="M12 9v4" /><path d="M12 17h.01" /></symbol>
      <symbol id="i-cable" viewBox="0 0 24 24"><path d="M17 21v-2a1 1 0 0 1-1-1v-1a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v1a1 1 0 0 1-1 1" /><path d="M19 15V6.5a1 1 0 0 0-7 0v11a1 1 0 0 1-7 0V9" /><path d="M21 21v-2h-4" /><path d="M3 5h4V3" /><path d="M7 5a1 1 0 0 1 1 1v1a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a1 1 0 0 1 1-1V3" /></symbol>
      <symbol id="i-lock" viewBox="0 0 24 24"><rect width="18" height="11" x="3" y="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></symbol>
      <symbol id="i-msg" viewBox="0 0 24 24"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" /></symbol>
      <symbol id="i-signal" viewBox="0 0 24 24"><path d="M2 20h.01" /><path d="M7 20v-4" /><path d="M12 20v-8" /><path d="M17 20V8" /></symbol>
    </svg>

    <div id="root" data-composition-id="core-pro" data-start="0" data-width="1920" data-height="1080" data-duration="{{duration}}">
      <div class="layer" id="bg-layer" data-layout-allow-overflow>
        <div class="da-bg"></div>
        <div class="da-dots" id="dots"></div>
        <div class="da-glow" id="glow-a"></div>
        <div class="da-glow teal" id="glow-b"></div>
      </div>

      <section id="intro" class="clip scene" data-start="{{start:intro}}" data-duration="{{dur:intro}}" data-track-index="1">
        <div class="scene-in" id="intro-in">
          <div class="abs da-glow" id="hero-glow"></div>
          <img class="abs" id="hero" src="assets/img/core-pro.png" alt="Core Pro" />
          <div class="abs" id="intro-copy">
            <span class="da-label">Instructivo · equipos</span>
            <h1 class="da-title">Core <span class="da-grad">Pro</span></h1>
            <p>Convierte cualquier televisor en una pantalla de DisplayAds.</p>
          </div>
        </div>
      </section>

      <div class="layer" id="diagram">
        <svg class="abs" id="wires" viewBox="0 0 1920 1080">
          <path id="w-hdmi" class="cable" d="M690 640 C 820 640, 820 520, 960 520" stroke="#38bdf8" />
          <path id="w-lan" class="cable" d="M300 900 C 300 830, 300 800, 330 780" stroke="#14b8a6" />
          <path id="w-psu" class="cable" d="M780 930 C 780 860, 700 820, 640 790" stroke="#a1a1aa" />
        </svg>
        <div class="tv"><div class="face">
          <div class="tv-msg" id="tv-nosignal">SIN SEÑAL</div>
          <div class="tv-msg" id="tv-logo"><img src="assets/img/logo.svg" alt="" /></div>
          <div class="fill-sky" id="tv-ad"><span class="da-label" style="color: #e0f2fe">Promo primavera</span><span class="p">-20%</span><span class="s">en toda la tienda</span></div>
        </div></div>
        <div class="tv-foot"></div>
        <img class="abs" id="core" src="assets/img/core-pro.png" alt="Core Pro" />
        <div class="abs" id="led"></div>
        <div class="box" id="router"><svg class="da-icon"><use href="#i-router" /></svg>Router del local</div>
        <div class="box" id="psu"><svg class="da-icon"><use href="#i-plug" /></svg>Fuente USB-C</div>
        <span class="abs da-chip" id="lbl-hdmi">Micro HDMI · puerto HDMI 0</span>
        <span class="abs da-chip" id="lbl-lan">Cable de red · lo más estable</span>
        <span class="abs da-chip" id="lbl-psu">5 V · 5 A</span>
      </div>

      <section id="hdmi" class="clip scene" data-start="{{start:hdmi}}" data-duration="{{dur:hdmi}}" data-track-index="1">
        <div class="scene-in" id="hdmi-in"><div class="abs step top"><div class="k"><span class="n">01</span><span class="da-label">Video</span></div><h2 class="da-title">Conectá el <span class="da-grad">HDMI al televisor</span></h2></div></div>
      </section>
      <section id="lan" class="clip scene" data-start="{{start:lan}}" data-duration="{{dur:lan}}" data-track-index="1">
        <div class="scene-in" id="lan-in"><div class="abs step top"><div class="k"><span class="n">02</span><span class="da-label">Red (recomendado)</span></div><h2 class="da-title">Sumá el <span class="da-grad">cable de red</span></h2></div></div>
      </section>
      <section id="power" class="clip scene" data-start="{{start:power}}" data-duration="{{dur:power}}" data-track-index="1">
        <div class="scene-in" id="power-in"><div class="abs step top"><div class="k"><span class="n">03</span><span class="da-label">Energía</span></div><h2 class="da-title">Enchufá la <span class="da-grad">fuente</span></h2></div></div>
      </section>

      <div class="layer" id="phone-stage">
        <div class="phone" id="ph"><div class="face"><div class="notch"></div>
          <div class="scr ui" id="s-wifi">
            <span class="sub">Ajustes</span><h4>Wi-Fi</h4>
            <div class="net" id="n-setup"><svg class="da-icon"><use href="#i-wifi" /></svg>DisplayAds-Setup-7F3A<span class="lock"><svg class="da-icon" style="font-size: 18px"><use href="#i-lock" /></svg></span></div>
            <div class="net"><svg class="da-icon"><use href="#i-wifi" /></svg>Local_Palermo<span class="lock"><svg class="da-icon" style="font-size: 18px"><use href="#i-lock" /></svg></span></div>
            <div class="net"><svg class="da-icon"><use href="#i-wifi" /></svg>Fibertel-3F2A<span class="lock"><svg class="da-icon" style="font-size: 18px"><use href="#i-lock" /></svg></span></div>
            <div class="net" id="n-connected" style="border-color: rgba(52,211,153,0.6)"><svg class="da-icon" style="color: #34d399"><use href="#i-check" /></svg>Conectado al equipo</div>
          </div>
          <div class="scr ui" id="s-browser">
            <span class="sub">Ajustes</span><h4>Red móvil</h4>
            <div class="row-set"><svg class="da-icon" style="font-size: 26px; color: var(--da-text-2)"><use href="#i-signal" /></svg>Datos móviles<div class="toggle" id="tg-data"><i id="tg-data-k"></i></div></div>
            <div style="height: 30px"></div>
            <span class="sub">Navegador</span>
            <div class="urlbar"><span id="url-typed"></span></div>
          </div>
          <div class="scr ui" id="s-portal">
            <span class="sub">DisplayAds · Configuración</span><h4>Conectá tu pantalla</h4>
            <div class="net" id="p-net"><svg class="da-icon"><use href="#i-wifi" /></svg>Local_Palermo</div>
            <div class="net"><svg class="da-icon"><use href="#i-wifi" /></svg>Fibertel-3F2A</div>
            <div class="net" style="color: var(--da-text-2); font-size: 19px">Ingresar red manualmente…</div>
            <div class="field"><span id="p-pwd"></span></div>
            <div class="da-btn" id="p-btn">Conectar Dispositivo</div>
          </div>
          <div class="tap" id="tap-a" style="left: 164px; top: 182px"></div>
          <div class="tap" id="tap-b" style="left: 280px; top: 214px"></div>
          <div class="tap" id="tap-c" style="left: 164px; top: 182px"></div>
          <div class="tap" id="tap-d" style="left: 164px; top: 482px"></div>
        </div></div>
      </div>

      <section id="hotspot" class="clip scene" data-start="{{start:hotspot}}" data-duration="{{dur:hotspot}}" data-track-index="1">
        <div class="scene-in" id="hotspot-in">
          <div class="abs step"><div class="k"><span class="n">04</span><span class="da-label">Sin cable: wifi</span></div><h2 class="da-title">El equipo crea <span class="da-grad">su propia red</span></h2>
            <p>Aparece como <b style="color: var(--da-text)">DisplayAds-Setup</b> y un código del equipo.</p>
            <div class="chips"><span class="da-chip" id="hs-c1"><svg class="da-icon"><use href="#i-lock" /></svg>Contraseña única de cada equipo</span></div>
          </div>
        </div>
      </section>

      <section id="browser" class="clip scene" data-start="{{start:browser}}" data-duration="{{dur:browser}}" data-track-index="1">
        <div class="scene-in" id="browser-in">
          <div class="abs step" style="top: 180px"><div class="k"><span class="n">05</span><span class="da-label">Desde tu celular</span></div><h2 class="da-title">Abrí la <span class="da-grad">configuración</span></h2></div>
          <span class="abs da-label" id="addr-k">En el navegador</span>
          <div class="abs da-glass" id="addr">http://10.42.0.1</div>
          <span class="abs da-chip" id="mobile-off"><svg class="da-icon" style="color: var(--da-amber)"><use href="#i-signal" /></svg>Apagá los datos móviles</span>
        </div>
      </section>

      <section id="portal" class="clip scene" data-start="{{start:portal}}" data-duration="{{dur:portal}}" data-track-index="1">
        <div class="scene-in" id="portal-in">
          <div class="abs step" style="top: 180px"><div class="k"><span class="n">06</span><span class="da-label">Red del local</span></div><h2 class="da-title">Elegí la red y <span class="da-grad">conectá</span></h2></div>
          <div class="tv" id="mini-tv"><div class="face"><div class="tv-msg" style="color: var(--da-text-3); font-family: var(--da-font-mono); font-size: 22px; letter-spacing: 0.12em" id="mini-wait">CONECTANDO…</div><div class="fill-sky" id="mini-ad" style="position: absolute; inset: 0; display: flex; flex-direction: column; justify-content: flex-end; padding: 30px"><span class="da-label" style="color: #e0f2fe; font-size: 16px">Promo primavera</span><span style="font-family: var(--da-font-display); font-weight: 800; font-size: 96px; letter-spacing: -0.05em; line-height: 0.9">-20%</span></div></div></div>
          <span class="abs da-chip" id="mini-online"><span class="da-dot"></span>Reproduciendo tu campaña</span>
        </div>
      </section>

      <section id="warn" class="clip scene" data-start="{{start:warn}}" data-duration="{{dur:warn}}" data-track-index="1">
        <div class="scene-in" id="warn-in">
          <div class="abs step top"><div class="k"><span class="n">07</span><span class="da-label">Atención</span></div><h2 class="da-title">Qué redes <span class="da-grad">sirven</span></h2></div>
          <div class="wcard da-glass" id="w-bad"><svg class="da-icon big-ico" style="color: var(--da-rose)"><use href="#i-alert" /></svg><h3>Redes con página de inicio de sesión</h3><span class="da-chip no"><svg class="da-icon"><use href="#i-x" /></svg>Hoteles, shoppings, wifi público</span></div>
          <div class="wcard da-glass" id="w-good"><svg class="da-icon big-ico" style="color: var(--da-emerald)"><use href="#i-check" /></svg><h3>Red privada con contraseña, o cable</h3><span class="da-chip ok"><svg class="da-icon"><use href="#i-check" /></svg>Wi-Fi WPA2 del local</span><span class="da-chip ok"><svg class="da-icon"><use href="#i-check" /></svg>Cable de red</span></div>
        </div>
      </section>

      <section id="check" class="clip scene" data-start="{{start:check}}" data-duration="{{dur:check}}" data-track-index="1">
        <div class="scene-in" id="check-in">
          <div id="check-a" class="layer">
            <div class="abs step top"><div class="k"><span class="n">08</span><span class="da-label">Verificación</span></div><h2 class="da-title">Fijate que figure <span class="da-grad">en línea</span></h2></div>
            <div class="abs da-glass" id="status"><span class="da-dot"></span><span class="n">Core Pro · Vidriera</span><span style="color: var(--da-text-2)">Palermo</span><span class="st">EN LÍNEA</span></div>
          </div>
          <div id="check-b" class="layer">
            <div class="abs" id="end-logo"><img src="assets/img/logo.svg" alt="DisplayAds" /></div>
            <div class="abs" id="end-row"><span class="da-chip"><svg class="da-icon" style="color: var(--da-sky-400)"><use href="#i-msg" /></svg>¿Dudas? Escribile a soporte</span><span class="da-chip">displayads.com.ar</span></div>
          </div>
        </div>
      </section>

      <div class="layer" id="hud">
        <div id="bug"><img src="assets/img/isotipo.svg" alt="" /><span>DisplayAds</span><em>Core Pro</em></div>
        <div id="chapter"></div>
        <div id="beat-ticks"><i></i><i></i><i></i><i></i></div>
        <div id="credit">Música: {{music_credit}}</div>
      </div>
      <div class="layer da-vignette"></div>
      <div class="layer da-grain"></div>
      <div id="progress"></div>

      <audio id="music" src="assets/audio/music.wav" data-start="0" data-duration="{{duration}}" data-track-index="10" data-volume="0.8" data-automation='{{music_automation}}'></audio>
      {{voice_tracks}}
      {{whoosh_tracks}}
    </div>

    <script>
      const T = {{timeline_json}};
      const W = {{words_json}};
      const chapters = [["intro", "00", "Core Pro"], ["hdmi", "01", "Video"], ["lan", "02", "Red"], ["power", "03", "Energía"], ["hotspot", "04", "Wifi del equipo"], ["browser", "05", "Configuración"], ["portal", "06", "Red del local"], ["warn", "07", "Atención"], ["check", "08", "Verificación"]];
      const { tl, S, E, wordAt, beatAfter, enter, leave } = createDisplayAdsKit(T, W, chapters);
      const L = T.beatLength;
      const draw = (sel, at, dur = 0.8) => tl.fromTo(sel, { strokeDasharray: 700, strokeDashoffset: 700 }, { strokeDashoffset: 0, duration: dur, ease: "power2.inOut" }, at);

      /* intro */
      tl.fromTo("#hero-glow", { opacity: 0, scale: 0.6 }, { opacity: 1, scale: 1, duration: 1.2, ease: "power2.out" }, S("intro"));
      tl.fromTo("#hero", { opacity: 0, y: 80, rotate: -6, scale: 0.9 }, { opacity: 1, y: 0, rotate: -2, scale: 1, duration: 1.1, ease: "power3.out" }, S("intro") + 0.1);
      tl.fromTo("#hero", { y: 0 }, { y: -16, duration: E("intro") - S("intro") - 1.2, ease: "sine.inOut", immediateRender: false }, S("intro") + 1.2);
      enter("#intro-copy", S("intro") + 0.3, { x: -60 });
      leave("#intro-in", "intro");

      /* diagrama de conexiones: vive de hdmi a power */
      {
        const h = S("hdmi");
        tl.fromTo("#diagram", { opacity: 0 }, { opacity: 1, duration: 0.4 }, h);
        tl.fromTo("#core", { opacity: 0, x: -60 }, { opacity: 1, x: 0, duration: 0.6, ease: "power3.out" }, h + 0.05);
        tl.fromTo("#diagram .tv", { opacity: 0, x: 80 }, { opacity: 1, x: 0, duration: 0.6, ease: "power3.out" }, h + 0.15);
        tl.fromTo("#diagram .tv-foot", { opacity: 0 }, { opacity: 1, duration: 0.6 }, h + 0.15);
        tl.set(["#tv-logo", "#tv-ad", "#led", "#router", "#psu", "#lbl-lan", "#lbl-psu", "#w-lan", "#w-psu"], { opacity: 0 }, 0);
        draw("#w-hdmi", wordAt("hdmi", "micro") - 0.1);
        enter("#lbl-hdmi", wordAt("hdmi", "puerto"), { y: 20 });
        const lan = wordAt("lan", "cable");
        enter("#router", S("lan") + 0.2, { x: -40 });
        tl.set("#w-lan", { opacity: 1 }, lan - 0.1);
        draw("#w-lan", lan - 0.1, 0.6);
        enter("#lbl-lan", wordAt("lan", "estable") - 0.3, { y: 20 });
        const psu = wordAt("power", "fuente");
        enter("#psu", S("power") + 0.2, { y: 40 });
        tl.set("#w-psu", { opacity: 1 }, psu - 0.2);
        draw("#w-psu", psu - 0.2, 0.6);
        enter("#lbl-psu", psu + 0.2, { y: 20 });
        tl.fromTo("#led", { opacity: 0 }, { opacity: 1, duration: 0.05, immediateRender: false }, psu + 0.5);
        tl.to("#tv-nosignal", { opacity: 0, duration: 0.2 }, psu + 0.7);
        tl.fromTo("#tv-logo", { opacity: 0, scale: 0.8 }, { opacity: 1, scale: 1, duration: 0.5, ease: "back.out(2)", immediateRender: false }, psu + 0.8);
        const play = wordAt("power", "reproducir");
        tl.fromTo("#tv-ad", { opacity: 0, clipPath: "inset(0 100% 0 0)" }, { opacity: 1, clipPath: "inset(0 0% 0 0)", duration: 0.6, ease: "power3.inOut", immediateRender: false }, play);
        leave("#hdmi-in", "hdmi");
        leave("#lan-in", "lan");
        leave("#power-in", "power");
        tl.to("#diagram", { opacity: 0, y: -30, duration: 0.4, ease: "power2.in" }, E("power") - 0.4);
      }

      /* celular: de hotspot a portal */
      {
        const hs = S("hotspot");
        tl.set(["#s-browser", "#s-portal", "#n-connected", "#tap-a", "#tap-b", "#tap-c", "#tap-d"], { opacity: 0 }, 0);
        tl.fromTo("#phone-stage", { opacity: 0 }, { opacity: 1, duration: 0.01 }, hs);
        tl.fromTo("#ph", { opacity: 0, y: 120, rotate: 5 }, { opacity: 1, y: 0, rotate: 0, duration: 0.8, ease: "power4.out" }, hs + 0.1);
        const red = wordAt("hotspot", "setup") - 0.3;
        tl.to("#n-setup", { borderColor: "rgba(56,189,248,0.9)", backgroundColor: "rgba(14,165,233,0.18)", duration: 0.25 }, red);
        enter("#hs-c1", wordAt("hotspot", "contrasena") - 0.2, { y: 20 });
        enter("#hotspot-in .step", hs + 0.05, { x: -60 });
        leave("#hotspot-in", "hotspot");

        const b = S("browser");
        const tapNet = wordAt("browser", "conectate");
        tl.fromTo("#tap-a", { opacity: 0, scale: 0.4 }, { opacity: 1, scale: 1, duration: 0.2 }, tapNet);
        tl.to("#tap-a", { opacity: 0, scale: 1.6, duration: 0.4 }, tapNet + 0.25);
        tl.to("#n-connected", { opacity: 1, duration: 0.3 }, tapNet + 0.3);
        const dataOff = wordAt("browser", "apaga");
        tl.to("#s-wifi", { opacity: 0, duration: 0.25 }, dataOff - 0.35);
        tl.to("#s-browser", { opacity: 1, duration: 0.25 }, dataOff - 0.3);
        tl.fromTo("#tap-b", { opacity: 0, scale: 0.4 }, { opacity: 1, scale: 1, duration: 0.2 }, dataOff + 0.1);
        tl.to("#tap-b", { opacity: 0, scale: 1.6, duration: 0.4 }, dataOff + 0.35);
        tl.to("#tg-data", { backgroundColor: "#3f3f46", duration: 0.2 }, dataOff + 0.25);
        tl.to("#tg-data-k", { x: -28, duration: 0.25, ease: "back.out(2)" }, dataOff + 0.25);
        enter("#mobile-off", dataOff, { x: -30 });
        const url = "http://10.42.0.1";
        const typed = { i: 0 };
        const nav = wordAt("browser", "navegador");
        tl.to(typed, { i: url.length, duration: 1.0, ease: "none", onUpdate: () => { document.getElementById("url-typed").textContent = url.slice(0, Math.round(typed.i)); } }, nav);
        enter("#addr-k", wordAt("browser", "direccion") - 0.2, { y: 20 });
        enter("#addr", wordAt("browser", "direccion"), { y: 30 });
        enter("#browser-in .step", b + 0.05, { x: -60 });
        leave("#browser-in", "browser");

        const p = S("portal");
        tl.to("#s-browser", { opacity: 0, duration: 0.25 }, p);
        tl.to("#s-portal", { opacity: 1, duration: 0.3 }, p + 0.1);
        enter("#portal-in .step", p + 0.05, { x: -60 });
        tl.fromTo("#mini-tv", { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 0.6, ease: "power3.out" }, p + 0.3);
        tl.set("#mini-ad", { opacity: 0 }, 0);
        const pick = wordAt("portal", "elegi");
        tl.fromTo("#tap-c", { opacity: 0, scale: 0.4 }, { opacity: 1, scale: 1, duration: 0.2 }, pick + 0.2);
        tl.to("#tap-c", { opacity: 0, scale: 1.6, duration: 0.4 }, pick + 0.45);
        tl.to("#p-net", { borderColor: "rgba(56,189,248,0.9)", backgroundColor: "rgba(14,165,233,0.18)", duration: 0.2 }, pick + 0.35);
        const dots = { n: 0 };
        tl.to(dots, { n: 9, duration: 0.9, ease: "none", onUpdate: () => { document.getElementById("p-pwd").textContent = "•".repeat(Math.round(dots.n)); } }, wordAt("portal", "escribi"));
        const press = wordAt("portal", "toca");
        tl.fromTo("#tap-d", { opacity: 0, scale: 0.4 }, { opacity: 1, scale: 1, duration: 0.2 }, press + 0.2);
        tl.to("#tap-d", { opacity: 0, scale: 1.6, duration: 0.4 }, press + 0.45);
        tl.to("#p-btn", { scale: 0.94, duration: 0.1 }, press + 0.3);
        tl.to("#p-btn", { scale: 1, duration: 0.3, ease: "back.out(3)" }, press + 0.4);
        const on = wordAt("portal", "reproducir");
        tl.to("#mini-wait", { opacity: 0, duration: 0.2 }, on - 0.4);
        tl.fromTo("#mini-ad", { opacity: 0, clipPath: "inset(0 100% 0 0)" }, { opacity: 1, clipPath: "inset(0 0% 0 0)", duration: 0.6, ease: "power3.inOut", immediateRender: false }, on - 0.3);
        enter("#mini-online", on, { y: 20 });
        leave("#portal-in", "portal");
        tl.to("#phone-stage", { opacity: 0, x: 120, duration: 0.4, ease: "power2.in" }, E("portal") - 0.4);
      }

      /* warn */
      enter("#warn-in .step", S("warn") + 0.05, { x: -60 });
      enter("#w-bad", wordAt("warn", "redes") - 0.1, { y: 60 });
      enter("#w-good", wordAt("warn", "privada") - 0.2, { y: 60 });
      leave("#warn-in", "warn");

      /* check */
      {
        const c = S("check");
        enter("#check-a .step", c + 0.05, { x: -60 });
        enter("#status", wordAt("check", "linea") - 0.4, { y: 40 });
        tl.fromTo("#status", { borderColor: "rgba(255,255,255,0.07)" }, { borderColor: "rgba(52,211,153,0.7)", duration: 0.4, immediateRender: false }, wordAt("check", "linea"));
        const sup = wordAt("check", "ayuda") - 0.6;
        tl.to("#check-a", { opacity: 0, duration: 0.4 }, sup);
        tl.set("#check-b", { opacity: 0 }, 0);
        tl.to("#check-b", { opacity: 1, duration: 0.01 }, sup + 0.3);
        tl.fromTo("#end-logo", { opacity: 0, scale: 0.85, filter: "blur(14px)" }, { opacity: 1, scale: 1, filter: "blur(0px)", duration: 0.9, ease: "expo.out" }, sup + 0.3);
        enter("#end-row", sup + 0.7, { y: 30 });
        tl.to("#check-in", { opacity: 0, duration: 1.0, ease: "power2.in" }, E("check") - 1.1);
      }

      window.__timelines["core-pro"] = tl;
    </script>
  </body>
</html>
