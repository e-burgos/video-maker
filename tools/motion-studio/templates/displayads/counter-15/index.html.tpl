<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=1920, height=1080" />
    <title>DisplayAds — Instructivo Counter 15</title>
    <script src="assets/vendor/gsap.min.js"></script>
    <script src="assets/brand/kit.js"></script>
    <link rel="stylesheet" href="assets/brand/displayads.css" />
    <link rel="stylesheet" href="assets/brand/tutorial.css" />
    <style>
      @font-face { font-family: "Outfit"; src: url("assets/fonts/outfit-latin-wght-normal.woff2") format("woff2"); font-weight: 100 900; }
      @font-face { font-family: "Geist"; src: url("assets/fonts/geist-latin-wght-normal.woff2") format("woff2"); font-weight: 100 900; }
      @font-face { font-family: "Geist Mono"; src: url("assets/fonts/geist-mono-latin-wght-normal.woff2") format("woff2"); font-weight: 100 900; }

      #dev { left: 1100px; top: 150px; }
      #dev-glow { left: 980px; top: 140px; }
      #intro-copy { left: 140px; top: 330px; width: 800px; }
      #intro-copy h1 { font-size: 150px; margin-top: 24px; }
      #intro-copy p { font-size: 40px; color: var(--da-text-2); margin-top: 26px; }

      #place-photo { left: 980px; top: 150px; width: 800px; height: 800px; border-radius: 34px; overflow: hidden; border: 1px solid var(--da-border-strong); box-shadow: 0 40px 100px rgba(0,0,0,0.6); }
      #place-photo img { width: 100%; height: 100%; object-fit: cover; }
      #place-pin { left: 1480px; top: 560px; }

      #plug { left: 1240px; top: 990px; }
      #plug-cable { left: 0; top: 0; width: 1920px; height: 1080px; }

      #panel { left: 140px; top: 560px; width: 760px; padding: 28px 30px; box-sizing: border-box; display: flex; flex-direction: column; gap: 14px; }
      .camp { display: flex; align-items: center; gap: 18px; padding: 16px 18px; border-radius: 16px; background: #1b1b1f; border: 1px solid var(--da-border); }
      .camp .sw { width: 64px; height: 64px; border-radius: 12px; flex: none; }
      .camp b { font-family: var(--da-font-display); font-size: 26px; font-weight: 600; display: block; }
      .camp i { font-style: normal; font-family: var(--da-font-mono); font-size: 16px; color: var(--da-text-3); }
      .toggle { margin-left: auto; width: 64px; height: 36px; border-radius: 20px; background: #3f3f46; position: relative; flex: none; }
      .toggle i { position: absolute; left: 4px; top: 4px; width: 28px; height: 28px; border-radius: 50%; background: #fff; }

      #timer { left: 140px; top: 590px; display: flex; align-items: center; gap: 30px; }
      #timer svg { width: 170px; height: 170px; }
      #timer-ring { fill: none; stroke: var(--da-sky-400); stroke-width: 10; stroke-linecap: round; transform: rotate(-90deg); transform-origin: 50% 50%; }
      #timer-bg { fill: none; stroke: rgba(255,255,255,0.08); stroke-width: 10; }
      #timer-num { font-family: var(--da-font-mono); font-size: 84px; font-weight: 600; letter-spacing: -0.03em; position: relative; width: 260px; height: 90px; }
      #timer-num span { position: absolute; left: 0; top: 0; }
      #wifi-x { left: 1660px; top: 190px; width: 110px; height: 110px; border-radius: 50%; display: flex; align-items: center; justify-content: center; background: rgba(9,9,11,0.9); border: 2px solid rgba(245,158,11,0.6); }
      #wifi-x .da-icon { font-size: 56px; color: var(--da-amber); }
      #retry { left: 1250px; top: 860px; border-color: rgba(245,158,11,0.5); }

      #tab { left: 1180px; top: 110px; }
      #rec-ok { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 20px; background: #0c0c0e; }
      #rec-ok .da-icon { font-size: 120px; color: var(--da-emerald); }
      #rec-ok b { font-family: var(--da-font-display); font-size: 40px; }
      #rec-content { position: absolute; inset: 0; display: flex; flex-direction: column; justify-content: flex-end; padding: 40px; gap: 8px; }
      #rec-content .p { font-family: var(--da-font-display); font-weight: 800; font-size: 110px; letter-spacing: -0.05em; line-height: 0.9; }
      #rec-content .s { font-family: var(--da-font-display); font-weight: 600; font-size: 34px; }

      #shield { left: 1180px; top: 250px; width: 560px; height: 560px; display: flex; align-items: center; justify-content: center; }
      #shield .da-icon { font-size: 360px; color: var(--da-sky-400); stroke-width: 1.2; }
      #shield-ring { left: 1160px; top: 230px; width: 600px; height: 600px; border-radius: 50%; border: 2px solid rgba(56,189,248,0.4); }
      #rules { left: 140px; top: 560px; display: flex; flex-direction: column; gap: 16px; }
      #rules .da-chip { font-size: 26px; padding: 14px 24px; }

      #cycle { left: 1180px; top: 220px; width: 600px; height: 600px; }
      #cycle svg.ring { position: absolute; inset: 0; width: 600px; height: 600px; }
      #cyc-ring { fill: none; stroke: var(--da-sky-400); stroke-width: 14; stroke-linecap: round; transform: rotate(-90deg); transform-origin: 50% 50%; }
      #cyc-bg { fill: none; stroke: rgba(255,255,255,0.07); stroke-width: 14; }
      #cyc-center { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; }
      #cyc-num { font-family: var(--da-font-mono); font-size: 150px; font-weight: 600; line-height: 1; }
      #cyc-plug { font-size: 90px; color: var(--da-text-2); }
      #end-logo { left: 0; right: 0; top: 340px; display: flex; justify-content: center; }
      #end-logo img { width: 820px; }
      #end-row { left: 0; right: 0; top: 680px; display: flex; justify-content: center; gap: 22px; }
    </style>
  </head>
  <body>
    <svg width="0" height="0" style="position: absolute">
      <symbol id="i-plug" viewBox="0 0 24 24"><path d="M12 22v-5" /><path d="M9 8V2" /><path d="M15 8V2" /><path d="M18 8v5a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V8Z" /></symbol>
      <symbol id="i-wifi" viewBox="0 0 24 24"><path d="M12 20h.01" /><path d="M2 8.82a15 15 0 0 1 20 0" /><path d="M5 12.859a10 10 0 0 1 14 0" /><path d="M8.5 16.429a5 5 0 0 1 7 0" /></symbol>
      <symbol id="i-wifi-off" viewBox="0 0 24 24"><path d="M12 20h.01" /><path d="M8.5 16.429a5 5 0 0 1 7 0" /><path d="M5 12.859a10 10 0 0 1 5.17-2.69" /><path d="M19 12.859a10 10 0 0 0-2.007-1.523" /><path d="M2 8.82a15 15 0 0 1 4.177-2.643" /><path d="M22 8.82a15 15 0 0 0-11.288-3.764" /><path d="m2 2 20 20" /></symbol>
      <symbol id="i-check" viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5" /></symbol>
      <symbol id="i-x" viewBox="0 0 24 24"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></symbol>
      <symbol id="i-shield" viewBox="0 0 24 24"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" /><path d="m9 12 2 2 4-4" /></symbol>
      <symbol id="i-pin" viewBox="0 0 24 24"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" /></symbol>
      <symbol id="i-box" viewBox="0 0 24 24"><path d="M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z" /><path d="M12 22V12" /><path d="m3.3 7 8.7 5 8.7-5" /></symbol>
      <symbol id="i-msg" viewBox="0 0 24 24"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" /></symbol>
      <symbol id="i-lock" viewBox="0 0 24 24"><rect width="18" height="11" x="3" y="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></symbol>
    </svg>

    <div id="root" data-composition-id="counter-15" data-start="0" data-width="1920" data-height="1080" data-duration="{{duration}}">
      <div class="layer" id="bg-layer" data-layout-allow-overflow>
        <div class="da-bg"></div>
        <div class="da-dots" id="dots"></div>
        <div class="da-glow" id="glow-a"></div>
        <div class="da-glow teal" id="glow-b"></div>
      </div>

      <div class="layer" id="device-stage">
        <div class="abs da-glow" id="dev-glow"></div>
        <div class="c15" id="dev">
          <img src="assets/img/counter-15.png" alt="Counter 15" />
          <div class="c15-screen">
            <div class="c15-layer fill-sky" id="scr-brand"><div class="c15-ad"><span class="k">BIENVENIDOS</span><span class="p">Menú</span><span class="s">del día · $ 8.900</span></div></div>
            <div class="c15-layer fill-boot" id="scr-off"></div>
            <div class="c15-layer fill-boot" id="scr-boot"><img src="assets/img/isotipo.svg" alt="" style="width: 26%; transform: skewY(6deg) rotate(4deg)" id="boot-logo" /></div>
            <div class="c15-layer fill-warm" id="scr-new"><div class="c15-ad"><span class="k">MERIENDA</span><span class="p">2x1</span><span class="s">en licuados</span></div></div>
          </div>
        </div>
      </div>

      <section id="intro" class="clip scene" data-start="{{start:intro}}" data-duration="{{dur:intro}}" data-track-index="1">
        <div class="scene-in" id="intro-in">
          <div class="abs" id="intro-copy">
            <span class="da-label">Instructivo · equipos</span>
            <h1 class="da-title">Counter <span class="da-grad">15</span></h1>
            <p>Cómo se instala y cómo funciona en tu local.</p>
          </div>
        </div>
      </section>

      <section id="place" class="clip scene" data-start="{{start:place}}" data-duration="{{dur:place}}" data-track-index="1">
        <div class="scene-in" id="place-in">
          <div class="abs step" id="place-step">
            <div class="k"><span class="n">01</span><span class="da-label">Instalación</span></div>
            <h2 class="da-title">Sobre el <span class="da-grad">mostrador</span></h2>
            <p>De frente al público. La base viene integrada al equipo.</p>
            <div class="chips"><span class="da-chip" id="pl-c1"><svg class="da-icon"><use href="#i-box" /></svg>Nada que armar</span><span class="da-chip" id="pl-c2"><svg class="da-icon"><use href="#i-pin" /></svg>De frente al público</span></div>
          </div>
          <div class="abs" id="place-photo"><img src="assets/img/escena-04.png" alt="" id="place-img" /></div>
        </div>
      </section>

      <section id="power" class="clip scene" data-start="{{start:power}}" data-duration="{{dur:power}}" data-track-index="1">
        <div class="scene-in" id="power-in">
          <div class="abs step">
            <div class="k"><span class="n">02</span><span class="da-label">Encendido</span></div>
            <h2 class="da-title">Enchufala y <span class="da-grad">dejala conectada</span></h2>
            <p>Arranca sola en la aplicación de cartelería.</p>
            <div class="chips"><span class="da-chip ok" id="pw-c1"><svg class="da-icon"><use href="#i-check" /></svg>Sin instalar nada</span><span class="da-chip ok" id="pw-c2"><svg class="da-icon"><use href="#i-check" /></svg>Sin iniciar sesión</span></div>
          </div>
          <svg class="abs" id="plug-cable" viewBox="0 0 1920 1080"><path id="cable-path" class="cable" d="M1420 1080 C 1420 1020, 1430 975, 1445 935" stroke="#3f3f46" /></svg>
        </div>
      </section>

      <section id="content" class="clip scene" data-start="{{start:content}}" data-duration="{{dur:content}}" data-track-index="1">
        <div class="scene-in" id="content-in">
          <div class="abs step" style="top: 220px">
            <div class="k"><span class="n">03</span><span class="da-label">Contenido</span></div>
            <h2 class="da-title">Lo elegís <span class="da-grad">desde el panel</span></h2>
          </div>
          <div class="abs da-glass" id="panel">
            <span class="da-label" style="font-size: 18px">Campañas · Counter 15 · Caja</span>
            <div class="camp"><div class="sw fill-sky"></div><div><b>Menú del día</b><i>08:00–15:00</i></div><div class="toggle" id="tg-1" style="background: #0ea5e9"><i style="left: 32px"></i></div></div>
            <div class="camp" id="camp-2"><div class="sw fill-warm"></div><div><b>Merienda 2x1</b><i>15:00–20:00</i></div><div class="toggle" id="tg-2"><i id="tg-2k"></i></div></div>
          </div>
        </div>
      </section>

      <section id="wifi" class="clip scene" data-start="{{start:wifi}}" data-duration="{{dur:wifi}}" data-track-index="1">
        <div class="scene-in" id="wifi-in">
          <div class="abs step" style="top: 220px">
            <div class="k"><span class="n">04</span><span class="da-label">Si cambia el wifi</span></div>
            <h2 class="da-title">Sigue mostrando <span class="da-grad">tu contenido</span></h2>
          </div>
          <div class="abs" id="timer">
            <svg viewBox="0 0 170 170"><circle id="timer-bg" cx="85" cy="85" r="70" /><circle id="timer-ring" cx="85" cy="85" r="70" pathLength="1" /></svg>
            <div><div id="timer-num"><span id="tn-0">00:00</span><span id="tn-1">00:30</span><span id="tn-2">01:00</span><span id="tn-3">01:30</span></div><span class="da-label">Reintenta sola</span></div>
          </div>
          <div class="abs" id="wifi-x"><svg class="da-icon"><use href="#i-wifi-off" /></svg></div>
          <div class="abs da-chip" id="retry"><span class="da-dot off"></span>Sin conexión — reintentando</div>
        </div>
      </section>

      <section id="recover" class="clip scene" data-start="{{start:recover}}" data-duration="{{dur:recover}}" data-track-index="1">
        <div class="scene-in" id="recover-in">
          <div class="abs step" style="top: 220px">
            <div class="k"><span class="n">05</span><span class="da-label">Reconectar</span></div>
            <h2 class="da-title">Lo hace <span class="da-grad">el personal del local</span></h2>
            <div class="chips" style="margin-top: 40px; flex-direction: column; align-items: flex-start">
              <span class="da-chip" id="rc-1"><span class="n" style="width: 34px; height: 34px; font-size: 18px; border-radius: 10px">1</span>Tocá la red del local</span>
              <span class="da-chip" id="rc-2"><span class="n" style="width: 34px; height: 34px; font-size: 18px; border-radius: 10px">2</span>Escribí la contraseña</span>
              <span class="da-chip ok" id="rc-3"><svg class="da-icon"><use href="#i-check" /></svg>Vuelve sola a tu contenido</span>
            </div>
          </div>
          <div class="tablet" id="tab">
            <div class="face">
              <div class="ui">
                <span class="sub">Recuperación de red</span>
                <h4>Elegí una red Wi-Fi</h4>
                <div class="net" id="net-1"><svg class="da-icon"><use href="#i-wifi" /></svg>Local_Palermo<span class="lock">WPA2</span></div>
                <div class="net"><svg class="da-icon"><use href="#i-wifi" /></svg>Fibertel-3F2A<span class="lock">WPA2</span></div>
                <div class="net"><svg class="da-icon"><use href="#i-wifi" /></svg>Personal-WiFi-88<span class="lock">WPA2</span></div>
                <div class="net" style="color: var(--da-text-2)">Ingresar el nombre a mano…</div>
                <div style="margin-top: 10px" class="sub">Contraseña · Local_Palermo</div>
                <div class="field"><span id="pwd"></span></div>
                <div class="da-btn" id="conn-btn">Conectar</div>
              </div>
              <div id="rec-ok"><svg class="da-icon"><use href="#i-check" /></svg><b>Conectada</b><span class="da-label">Local_Palermo</span></div>
              <div id="rec-content" class="fill-warm"><span class="da-label" style="color: #fff7ed">Merienda</span><span class="p">2x1</span><span class="s">en licuados</span></div>
              <div class="tap" id="tap-1" style="left: 160px; top: 205px"></div>
              <div class="tap" id="tap-2" style="left: 238px; top: 678px"></div>
            </div>
          </div>
        </div>
      </section>

      <section id="kiosk" class="clip scene" data-start="{{start:kiosk}}" data-duration="{{dur:kiosk}}" data-track-index="1">
        <div class="scene-in" id="kiosk-in">
          <div class="abs step" style="top: 220px">
            <div class="k"><span class="n">06</span><span class="da-label">Modo kiosco</span></div>
            <h2 class="da-title">Siempre <span class="da-grad">protegida</span></h2>
          </div>
          <div class="abs" id="rules">
            <span class="da-chip ok" id="ru-1"><svg class="da-icon"><use href="#i-check" /></svg>Reconectar el wifi</span>
            <span class="da-chip no" id="ru-2"><svg class="da-icon"><use href="#i-x" /></svg>Salir de la aplicación</span>
            <span class="da-chip no" id="ru-3"><svg class="da-icon"><use href="#i-x" /></svg>Abrir otras apps</span>
            <span class="da-chip no" id="ru-4"><svg class="da-icon"><use href="#i-x" /></svg>Cambiar ajustes de la tablet</span>
          </div>
          <div class="abs" id="shield-ring"></div>
          <div class="abs" id="shield"><svg class="da-icon"><use href="#i-shield" /></svg></div>
        </div>
      </section>

      <section id="help" class="clip scene" data-start="{{start:help}}" data-duration="{{dur:help}}" data-track-index="1">
        <div class="scene-in" id="help-in">
          <div id="help-a" class="layer">
            <div class="abs step" style="top: 220px">
              <div class="k"><span class="n">07</span><span class="da-label">Si se congela</span></div>
              <h2 class="da-title">Desenchufá, <span class="da-grad">10 segundos</span>, enchufá</h2>
            </div>
            <div class="abs" id="cycle">
              <svg class="ring" viewBox="0 0 600 600"><circle id="cyc-bg" cx="300" cy="300" r="270" /><circle id="cyc-ring" cx="300" cy="300" r="270" pathLength="1" /></svg>
              <div id="cyc-center"><svg class="da-icon" id="cyc-plug"><use href="#i-plug" /></svg><div id="cyc-num" style="position: relative; width: 300px; height: 150px; text-align: center"></div><span class="da-label">segundos</span></div>
            </div>
          </div>
          <div id="help-b" class="layer">
            <div class="abs" id="end-logo"><img src="assets/img/logo.svg" alt="DisplayAds" /></div>
            <div class="abs" id="end-row"><span class="da-chip"><svg class="da-icon" style="color: var(--da-sky-400)"><use href="#i-msg" /></svg>¿Dudas? Escribile a soporte</span><span class="da-chip">displayads.com.ar</span></div>
          </div>
        </div>
      </section>

      <div class="layer" id="hud">
        <div id="bug"><img src="assets/img/isotipo.svg" alt="" /><span>DisplayAds</span><em>Counter 15</em></div>
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
      const chapters = [["intro", "00", "Counter 15"], ["place", "01", "Instalación"], ["power", "02", "Encendido"], ["content", "03", "Contenido"], ["wifi", "04", "Si cambia el wifi"], ["recover", "05", "Reconectar"], ["kiosk", "06", "Modo kiosco"], ["help", "07", "Ayuda"]];
      const { tl, S, E, wordAt, beatAfter, enter, leave } = createDisplayAdsKit(T, W, chapters);
      const L = T.beatLength;

      /* escenario del equipo: aparece en intro, se oculta en place, vuelve en power y se va en recover */
      tl.fromTo("#dev-glow", { opacity: 0, scale: 0.6 }, { opacity: 1, scale: 1, duration: 1.2, ease: "power2.out" }, S("intro"));
      tl.fromTo("#dev", { opacity: 0, x: 140, rotate: 3 }, { opacity: 1, x: 0, rotate: 0, duration: 1.1, ease: "power3.out" }, S("intro") + 0.15);
      tl.to("#device-stage", { opacity: 0, x: 120, duration: 0.4, ease: "power2.in" }, E("intro") - 0.4);
      tl.to("#device-stage", { opacity: 1, x: 0, duration: 0.6, ease: "power3.out" }, S("power") + 0.1);
      tl.to("#device-stage", { opacity: 0, scale: 0.94, duration: 0.4, ease: "power2.in" }, E("wifi") - 0.4);
      tl.fromTo("#dev", { y: 0 }, { y: -14, duration: 3, ease: "sine.inOut", yoyo: true, repeat: Math.ceil(T.duration / 3), immediateRender: false }, 1.4);

      tl.set("#scr-off", { opacity: 0 }, 0);
      tl.set("#scr-boot", { opacity: 0 }, 0);
      tl.set("#scr-new", { opacity: 0 }, 0);

      /* intro */
      tl.fromTo("#intro-copy", { opacity: 0, x: -60 }, { opacity: 1, x: 0, duration: 0.8, ease: "power3.out" }, S("intro") + 0.3);
      leave("#intro-in", "intro");

      /* place */
      enter("#place-step", S("place") + 0.05, { x: -60 });
      enter("#place-photo", S("place") + 0.1, { x: 80 });
      tl.fromTo("#place-img", { scale: 1.15 }, { scale: 1, duration: E("place") - S("place"), ease: "none" }, S("place"));
      enter("#pl-c1", wordAt("place", "base") - 0.1, { y: 20 });
      enter("#pl-c2", wordAt("place", "frente") - 0.1, { y: 20 });
      leave("#place-in", "place");

      /* power: pantalla apagada, cable, arranque y contenido */
      {
        const p = S("power");
        tl.set("#scr-off", { opacity: 1 }, p);
        tl.fromTo("#cable-path", { strokeDasharray: 400, strokeDashoffset: 400 }, { strokeDashoffset: 0, duration: 0.8, ease: "power2.out" }, wordAt("power", "enchufala"));
        const boot = wordAt("power", "encenderse");
        tl.to("#cable-path", { stroke: "#38bdf8", duration: 0.3 }, boot - 0.3);
        tl.set("#scr-boot", { opacity: 1 }, boot);
        tl.set("#scr-off", { opacity: 0 }, boot);
        tl.fromTo("#boot-logo", { opacity: 0, scale: 0.7 }, { opacity: 1, scale: 1, duration: 0.6, ease: "back.out(2)" }, boot + 0.1);
        tl.to("#scr-boot", { opacity: 0, duration: 0.4 }, wordAt("power", "cartel") + 0.2);
        enter("#pw-c1", wordAt("power", "instalar") - 0.1, { y: 20 });
        enter("#pw-c2", wordAt("power", "sesion") - 0.2, { y: 20 });
        leave("#power-in", "power");
      }

      /* content */
      {
        enter("#panel", S("content") + 0.2, { x: -60 });
        const pick = wordAt("content", "campanas");
        tl.to("#tg-2", { backgroundColor: "#0ea5e9", duration: 0.2 }, pick);
        tl.to("#tg-2k", { x: 28, duration: 0.25, ease: "back.out(2)" }, pick);
        tl.to("#camp-2", { borderColor: "rgba(56,189,248,0.7)", duration: 0.2 }, pick);
        tl.fromTo("#scr-new", { opacity: 0, clipPath: "inset(0 0 100% 0)" }, { opacity: 1, clipPath: "inset(0 0 0% 0)", duration: 0.6, ease: "power3.inOut" }, wordAt("content", "reproduce"));
        leave("#content-in", "content");
      }

      /* wifi */
      {
        const w = S("wifi");
        tl.fromTo("#wifi-x", { opacity: 0, scale: 0 }, { opacity: 1, scale: 1, duration: 0.4, ease: "back.out(3)" }, wordAt("wifi", "wifi"));
        enter("#timer", wordAt("wifi", "primer") - 0.3, { x: -40 });
        const t0 = wordAt("wifi", "primer");
        tl.fromTo("#timer-ring", { strokeDasharray: "0 1" }, { strokeDasharray: "1 0", duration: 3.2, ease: "none" }, t0);
        ["#tn-0", "#tn-1", "#tn-2", "#tn-3"].forEach((n, i) => {
          tl.fromTo(n, { opacity: 0 }, { opacity: 1, duration: 0.05 }, t0 + i * 1.05);
          if (i < 3) tl.to(n, { opacity: 0, duration: 0.05 }, t0 + (i + 1) * 1.05);
        });
        tl.fromTo("#retry", { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.4, ease: "back.out(2)" }, wordAt("wifi", "reconectarse") - 0.2);
        leave("#wifi-in", "wifi");
      }

      /* recover */
      {
        const r = S("recover");
        tl.fromTo("#tab", { opacity: 0, y: 80, rotate: 4 }, { opacity: 1, y: 0, rotate: 0, duration: 0.7, ease: "power3.out" }, r + 0.1);
        tl.set(["#rec-ok", "#rec-content"], { opacity: 0 }, 0);
        const tap1 = wordAt("recover", "toca");
        enter("#rc-1", tap1 - 0.2, { x: -30 });
        tl.fromTo("#tap-1", { opacity: 0, scale: 0.4 }, { opacity: 1, scale: 1, duration: 0.2 }, tap1 + 0.2);
        tl.to("#tap-1", { opacity: 0, scale: 1.6, duration: 0.4 }, tap1 + 0.45);
        tl.to("#net-1", { borderColor: "rgba(56,189,248,0.9)", backgroundColor: "rgba(14,165,233,0.18)", duration: 0.2 }, tap1 + 0.3);
        const pwd = wordAt("recover", "escribi");
        enter("#rc-2", pwd - 0.2, { x: -30 });
        const dots = { n: 0 };
        tl.to(dots, { n: 10, duration: 1.0, ease: "none", onUpdate: () => { document.getElementById("pwd").textContent = "•".repeat(Math.round(dots.n)); } }, pwd + 0.1);
        const ok = wordAt("recover", "listo");
        tl.fromTo("#tap-2", { opacity: 0, scale: 0.4 }, { opacity: 1, scale: 1, duration: 0.2 }, ok - 0.5);
        tl.to("#tap-2", { opacity: 0, scale: 1.6, duration: 0.4 }, ok - 0.25);
        tl.to("#conn-btn", { scale: 0.94, duration: 0.1 }, ok - 0.4);
        tl.to("#conn-btn", { scale: 1, duration: 0.3, ease: "back.out(3)" }, ok - 0.3);
        tl.fromTo("#rec-ok", { opacity: 0 }, { opacity: 1, duration: 0.3, immediateRender: false }, ok);
        tl.fromTo("#rec-ok .da-icon", { scale: 0 }, { scale: 1, duration: 0.5, ease: "back.out(3)" }, ok);
        const back = wordAt("recover", "contenido");
        tl.fromTo("#rec-content", { opacity: 0, clipPath: "inset(100% 0 0 0)" }, { opacity: 1, clipPath: "inset(0% 0 0 0)", duration: 0.6, ease: "power3.inOut", immediateRender: false }, back - 0.3);
        enter("#rc-3", back - 0.3, { x: -30 });
        leave("#recover-in", "recover");
      }

      /* kiosk */
      {
        const k = S("kiosk");
        tl.fromTo("#shield", { opacity: 0, scale: 0.7 }, { opacity: 1, scale: 1, duration: 0.7, ease: "back.out(1.6)" }, k + 0.1);
        tl.fromTo("#shield-ring", { opacity: 0.9, scale: 0.6 }, { opacity: 0, scale: 1.5, duration: 1.6, ease: "power2.out" }, k + 0.3);
        enter("#ru-1", wordAt("kiosk", "reconectar") - 0.1, { x: -30 });
        ["#ru-2", "#ru-3", "#ru-4"].forEach((r, i) => enter(r, beatAfter(wordAt("kiosk", "nadie")) + i * L, { x: -30 }));
        leave("#kiosk-in", "kiosk");
      }

      /* help */
      {
        const h = S("help");
        const pull = wordAt("help", "desenchufala");
        const wait = wordAt("help", "espera");
        const back = wordAt("help", "volve");
        tl.fromTo("#cycle", { opacity: 0, scale: 0.8 }, { opacity: 1, scale: 1, duration: 0.6, ease: "power3.out" }, h + 0.1);
        tl.fromTo("#cyc-plug", { opacity: 1, y: 0 }, { opacity: 0.25, y: -30, duration: 0.4, ease: "power2.in" }, pull);
        const holder = document.getElementById("cyc-num");
        for (let i = 10; i >= 0; i--) {
          const el = document.createElement("span");
          el.textContent = i;
          el.style.cssText = "position:absolute;left:0;right:0;top:0;opacity:0";
          el.id = `cyc-${i}`;
          holder.appendChild(el);
        }
        const step = (back - wait) / 10;
        for (let i = 10; i >= 0; i--) {
          const at = wait + (10 - i) * step;
          tl.fromTo(`#cyc-${i}`, { opacity: 0 }, { opacity: 1, duration: 0.04 }, at);
          if (i > 0) tl.to(`#cyc-${i}`, { opacity: 0, duration: 0.04 }, at + step);
        }
        tl.fromTo("#cyc-ring", { strokeDasharray: "0 1" }, { strokeDasharray: "1 0", duration: back - wait, ease: "none" }, wait);
        tl.to("#cyc-plug", { opacity: 1, y: 0, color: "#34d399", duration: 0.4, ease: "back.out(2)" }, back);
        const sup = wordAt("help", "soporte") - 1.2;
        tl.to("#help-a", { opacity: 0, duration: 0.4 }, sup);
        tl.set("#help-b", { opacity: 0 }, 0);
        tl.fromTo("#end-logo", { opacity: 0, scale: 0.85, filter: "blur(14px)" }, { opacity: 1, scale: 1, filter: "blur(0px)", duration: 0.9, ease: "expo.out" }, sup + 0.3);
        tl.to("#help-b", { opacity: 1, duration: 0.01 }, sup + 0.3);
        enter("#end-row", sup + 0.7, { y: 30 });
        tl.to("#help-in", { opacity: 0, duration: 1.0, ease: "power2.in" }, E("help") - 1.1);
      }

      window.__timelines["counter-15"] = tl;
    </script>
  </body>
</html>
