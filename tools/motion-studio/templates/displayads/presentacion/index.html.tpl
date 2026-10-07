<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=1920, height=1080" />
    <title>DisplayAds — Presentación de la plataforma</title>
    <script src="assets/runtime/gsap.min.js"></script>
    <link rel="stylesheet" href="assets/brand/displayads.css" />
    <style>
      @font-face { font-family: "Outfit"; src: url("assets/brand/fonts/outfit-latin-wght-normal.woff2") format("woff2"); font-weight: 100 900; }
      @font-face { font-family: "Geist"; src: url("assets/brand/fonts/geist-latin-wght-normal.woff2") format("woff2"); font-weight: 100 900; }
      @font-face { font-family: "Geist Mono"; src: url("assets/brand/fonts/geist-mono-latin-wght-normal.woff2") format("woff2"); font-weight: 100 900; }

      .layer { position: absolute; inset: 0; }
      .scene { position: absolute; inset: 0; }
      .scene-in { position: absolute; inset: 0; }
      .abs { position: absolute; }

      #glow-a { left: -180px; top: -260px; }
      #glow-b { right: -260px; bottom: -340px; }
      #progress { position: absolute; left: 0; bottom: 0; height: 4px; width: 1920px; background: linear-gradient(90deg, var(--da-sky-600), var(--da-sky-400)); transform-origin: 0 50%; opacity: 0.8; }

      #bug { position: absolute; left: 72px; top: 56px; display: flex; align-items: center; gap: 14px; }
      #bug img { height: 46px; }
      #bug span { font-family: var(--da-font-display); font-weight: 600; font-size: 28px; letter-spacing: -0.02em; }
      #chapter { position: absolute; left: 72px; bottom: 56px; width: 700px; height: 30px; }
      .chap { position: absolute; left: 0; top: 0; display: flex; gap: 18px; align-items: center; white-space: nowrap; opacity: 0; }
      #chapter .num { color: var(--da-sky-400); }
      #beat-ticks { position: absolute; right: 72px; bottom: 60px; display: flex; gap: 10px; }
      #beat-ticks i { display: block; width: 10px; height: 10px; border-radius: 3px; background: rgba(255,255,255,0.18); }
      #flash { position: absolute; inset: 0; background: radial-gradient(circle at 50% 50%, rgba(125, 211, 252, 0.95), rgba(14, 165, 233, 0.45) 35%, transparent 70%); opacity: 0; }
      #credit { position: absolute; right: 72px; top: 62px; font-family: var(--da-font-mono); font-size: 16px; color: var(--da-text-3); letter-spacing: 0.04em; }

      /* hook */
      .hook-copy { left: 140px; top: 290px; width: 900px; }
      .hook-copy h1 { font-size: 108px; }
      .hook-swap { position: absolute; left: 0; top: 0; width: 900px; }
      #hook-screen { left: 1080px; top: 250px; width: 700px; height: 440px; padding: 18px; box-sizing: border-box; }
      .tv-face { position: relative; width: 100%; height: 100%; border-radius: 16px; overflow: hidden; background: linear-gradient(135deg, #0b3a52 0%, #0e1f2b 60%, #09090b 100%); }
      .tv-promo { position: absolute; inset: 0; padding: 44px; display: flex; flex-direction: column; justify-content: flex-end; gap: 14px; }
      .tv-promo .big { font-family: var(--da-font-display); font-size: 96px; font-weight: 800; letter-spacing: -0.05em; line-height: 0.9; }
      #hook-off { position: absolute; inset: 0; background: #000; opacity: 0; }
      #hook-line { position: absolute; left: 0; right: 0; top: 50%; height: 4px; margin-top: -2px; background: #e0f2fe; box-shadow: 0 0 30px #7dd3fc; opacity: 0; }
      #hook-stamp { left: 1330px; top: 330px; padding: 14px 30px; border: 5px solid var(--da-rose); color: var(--da-rose); border-radius: 14px; font-family: var(--da-font-mono); font-weight: 700; font-size: 44px; letter-spacing: 0.12em; background: rgba(9,9,11,0.6); }
      #hook-stand { left: 1355px; top: 690px; width: 150px; height: 14px; border-radius: 0 0 10px 10px; background: #27272a; }

      /* pain */
      #pain-row { left: 160px; right: 160px; top: 330px; display: flex; gap: 48px; justify-content: center; }
      .pain-card { width: 480px; height: 360px; box-sizing: border-box; padding: 46px; display: flex; flex-direction: column; justify-content: space-between; position: relative; overflow: hidden; }
      .pain-card .da-icon { font-size: 92px; color: var(--da-text-2); }
      .pain-card h3 { margin: 0; font-family: var(--da-font-display); font-weight: 600; font-size: 54px; letter-spacing: -0.03em; line-height: 1; }
      .pain-strike { position: absolute; left: 30px; right: 30px; top: 50%; height: 6px; background: var(--da-rose); border-radius: 3px; transform-origin: 0 50%; box-shadow: 0 0 20px rgba(244,63,94,0.6); }
      #pain-kicker { left: 0; right: 0; top: 200px; text-align: center; }
      #pain-dot { left: 940px; top: 520px; width: 40px; height: 40px; border-radius: 50%; background: var(--da-sky-400); box-shadow: 0 0 80px 30px rgba(14,165,233,0.6); }

      /* reveal */
      #reveal-logo { left: 0; right: 0; top: 300px; display: flex; justify-content: center; }
      #reveal-logo img { width: 980px; }
      #reveal-tag { left: 0; right: 0; top: 660px; text-align: center; font-size: 78px; }
      #reveal-sub { left: 0; right: 0; top: 790px; display: flex; justify-content: center; gap: 22px; }
      #reveal-ring { left: 610px; top: 190px; width: 700px; height: 700px; border-radius: 50%; border: 2px solid rgba(56,189,248,0.5); }

      /* remote */
      .headline { left: 140px; top: 150px; width: 1640px; }
      .headline h2 { font-size: 84px; }
      #phone { left: 200px; top: 330px; width: 330px; height: 660px; border-radius: 52px; padding: 16px; box-sizing: border-box; background: #0c0c0e; border: 2px solid rgba(255,255,255,0.12); box-shadow: 0 40px 100px rgba(0,0,0,0.7); }
      .phone-screen { width: 100%; height: 100%; border-radius: 38px; background: #111114; overflow: hidden; padding: 34px 22px; box-sizing: border-box; display: flex; flex-direction: column; gap: 16px; }
      .phone-card { border-radius: 18px; background: #1b1b1f; border: 1px solid var(--da-border); padding: 18px; }
      .phone-card .t { font-family: var(--da-font-display); font-size: 26px; font-weight: 600; }
      .phone-card .m { font-family: var(--da-font-mono); font-size: 15px; color: var(--da-text-2); margin-top: 6px; }
      .phone-thumb { height: 150px; border-radius: 14px; background: linear-gradient(135deg, #0ea5e9, #14b8a6); display: flex; align-items: flex-end; padding: 14px; box-sizing: border-box; font-family: var(--da-font-display); font-weight: 800; font-size: 40px; letter-spacing: -0.04em; }
      #phone-btn { margin-top: auto; font-size: 26px; padding: 18px; border-radius: 16px; }
      #remote-net { left: 0; top: 0; width: 1920px; height: 1080px; }
      .screen { width: 560px; height: 190px; padding: 12px; box-sizing: border-box; }
      .screen .tv-face { border-radius: 14px; }
      .screen-label { position: absolute; left: 22px; top: -44px; display: flex; gap: 12px; align-items: center; font-family: var(--da-font-mono); font-size: 20px; color: var(--da-text-2); }
      .scr-old, .scr-new { position: absolute; inset: 0; display: flex; align-items: flex-end; padding: 22px 28px; box-sizing: border-box; font-family: var(--da-font-display); font-weight: 800; letter-spacing: -0.04em; }
      .scr-old { background: linear-gradient(135deg, #27272a, #18181b); color: #52525b; font-size: 44px; }
      .scr-new { background: linear-gradient(120deg, #0369a1 0%, #0ea5e9 55%, #2dd4bf 100%); font-size: 50px; flex-direction: column; align-items: flex-start; justify-content: flex-end; gap: 4px; }
      .scr-new small { font-family: var(--da-font-mono); font-weight: 500; font-size: 18px; letter-spacing: 0.12em; opacity: 0.85; }
      .scr-ok { position: absolute; right: 12px; top: -50px; padding: 6px 16px; font-size: 18px; }
      #scr-1 { left: 1180px; top: 345px; }
      #scr-2 { left: 1180px; top: 605px; }
      #scr-3 { left: 1180px; top: 865px; }

      /* schedule */
      #sched-panel { left: 140px; top: 360px; width: 1640px; height: 560px; padding: 48px 56px; box-sizing: border-box; }
      #sched-days { display: flex; gap: 14px; }
      .day { width: 92px; height: 56px; border-radius: 14px; display: flex; align-items: center; justify-content: center; font-family: var(--da-font-mono); font-size: 22px; border: 1px solid var(--da-border-strong); color: var(--da-text-3); }
      .day.on { color: #fff; background: rgba(14,165,233,0.18); border-color: rgba(56,189,248,0.6); }
      #sched-track { position: absolute; left: 56px; right: 56px; top: 200px; height: 250px; }
      .hour { position: absolute; top: 0; bottom: 0; width: 1px; background: rgba(255,255,255,0.08); }
      .hour span { position: absolute; top: -34px; left: -22px; font-family: var(--da-font-mono); font-size: 18px; color: var(--da-text-3); }
      .block { position: absolute; height: 92px; border-radius: 18px; padding: 16px 22px; box-sizing: border-box; display: flex; flex-direction: column; justify-content: center; gap: 4px; transform-origin: 0 50%; }
      .block b { font-family: var(--da-font-display); font-weight: 600; font-size: 28px; letter-spacing: -0.02em; }
      .block i { font-style: normal; font-family: var(--da-font-mono); font-size: 17px; opacity: 0.85; }
      .b-sky { background: linear-gradient(135deg, rgba(14,165,233,0.95), rgba(2,132,199,0.9)); }
      .b-teal { background: linear-gradient(135deg, rgba(20,184,166,0.95), rgba(13,148,136,0.9)); }
      .b-zinc { background: #27272a; border: 1px solid var(--da-border-strong); }
      #playhead { position: absolute; top: -12px; bottom: -12px; width: 3px; background: #fff; box-shadow: 0 0 18px rgba(255,255,255,0.8); }
      #sched-branches { position: absolute; right: 56px; top: 44px; display: flex; gap: 12px; }

      /* monitor */
      #mon-panel { left: 140px; top: 330px; width: 1080px; padding: 34px 40px; box-sizing: border-box; }
      .row { display: grid; grid-template-columns: 30px 1.25fr 1fr 1.25fr; align-items: center; gap: 20px; padding: 22px 6px; border-bottom: 1px solid var(--da-border); font-size: 26px; }
      .row:last-child { border-bottom: 0; }
      .row .n { font-family: var(--da-font-display); font-weight: 600; }
      .row .loc { color: var(--da-text-2); }
      .row .now { font-family: var(--da-font-mono); font-size: 20px; color: var(--da-sky-300); white-space: nowrap; }
      .row.head { font-family: var(--da-font-mono); font-size: 18px; color: var(--da-text-3); letter-spacing: 0.1em; text-transform: uppercase; padding-top: 0; }
      #mon-stat { left: 1290px; top: 330px; width: 490px; height: 360px; padding: 40px; box-sizing: border-box; display: flex; flex-direction: column; justify-content: space-between; }
      #mon-count { font-family: var(--da-font-mono); font-size: 150px; font-weight: 600; letter-spacing: -0.04em; line-height: 1; }
      #mon-toast { left: 1290px; top: 730px; width: 490px; padding: 26px 30px; box-sizing: border-box; display: flex; gap: 20px; align-items: flex-start; border-color: rgba(245,158,11,0.45); }
      #mon-toast .da-icon { font-size: 40px; color: var(--da-amber); flex: none; }
      #mon-toast b { display: block; font-family: var(--da-font-display); font-size: 28px; font-weight: 600; }
      #mon-toast span { font-family: var(--da-font-mono); font-size: 19px; color: var(--da-text-2); }

      /* ai */
      .ai-part { position: absolute; inset: 0; }
      #ai-prompt { left: 140px; top: 420px; width: 820px; padding: 34px 38px; box-sizing: border-box; }
      #ai-prompt .q { font-size: 38px; line-height: 1.3; min-height: 100px; }
      #ai-caret { display: inline-block; width: 3px; height: 40px; background: var(--da-sky-400); vertical-align: -6px; margin-left: 4px; }
      #ai-gen { left: 1060px; top: 270px; width: 720px; height: 720px; border-radius: 34px; overflow: hidden; }
      .ad { position: absolute; inset: 0; background: radial-gradient(circle at 75% 25%, #fbbf24 0%, #b45309 35%, #431407 75%); }
      .ad-cup { position: absolute; right: 70px; top: 120px; width: 260px; height: 230px; border-radius: 0 0 110px 110px; background: linear-gradient(180deg, #fef3c7, #fde68a); box-shadow: inset -20px -20px 40px rgba(146,64,14,0.35); }
      .ad-cup::after { content: ""; position: absolute; right: -70px; top: 40px; width: 90px; height: 110px; border-radius: 50%; border: 22px solid #fde68a; border-left-color: transparent; }
      .ad-steam { position: absolute; width: 14px; height: 90px; border-radius: 10px; background: rgba(255,255,255,0.35); filter: blur(4px); }
      .ad-copy { position: absolute; left: 56px; bottom: 60px; }
      .ad-copy .k { font-family: var(--da-font-mono); font-size: 24px; letter-spacing: 0.16em; color: #fff7ed; }
      .ad-copy .p { font-family: var(--da-font-display); font-weight: 800; font-size: 170px; line-height: 0.85; letter-spacing: -0.06em; color: #fff; }
      .ad-copy .s { font-family: var(--da-font-display); font-weight: 600; font-size: 52px; letter-spacing: -0.03em; color: #fff7ed; }
      #ai-scan { position: absolute; left: 0; right: 0; top: 0; height: 160px; background: linear-gradient(180deg, transparent, rgba(125,211,252,0.55), transparent); }
      #ai-gen-mask { position: absolute; inset: 0; background: #0c0c0e; }
      #ai-badge { left: 1090px; top: 210px; }
      #ai-radar { left: 1040px; top: 220px; width: 720px; height: 720px; }
      .ring { position: absolute; border-radius: 50%; border: 2px solid rgba(56,189,248,0.35); }
      .pin { position: absolute; width: 22px; height: 22px; margin: -11px 0 0 -11px; border-radius: 50%; background: var(--da-amber); box-shadow: 0 0 20px rgba(245,158,11,0.8); }
      .pin.me { background: var(--da-sky-400); box-shadow: 0 0 30px rgba(56,189,248,1); width: 30px; height: 30px; margin: -15px 0 0 -15px; }
      #radar-sweep { position: absolute; inset: 0; border-radius: 50%; background: conic-gradient(from 0deg, rgba(56,189,248,0.35), transparent 22%); }
      #ai-ctx { left: 140px; top: 400px; display: flex; flex-direction: column; gap: 26px; }
      #ai-ctx .da-chip { font-size: 30px; padding: 20px 30px; }
      #ai-ctx .da-icon { font-size: 34px; color: var(--da-sky-400); }
      #ai-sug { left: 360px; top: 330px; width: 1200px; padding: 52px 60px; box-sizing: border-box; border-color: rgba(56,189,248,0.35); }
      #ai-sug .hd { display: flex; align-items: center; gap: 16px; }
      #ai-sug .hd .da-icon { font-size: 38px; color: var(--da-sky-400); }
      #ai-sug p { font-family: var(--da-font-display); font-size: 56px; font-weight: 500; letter-spacing: -0.03em; line-height: 1.1; margin: 30px 0 40px; }
      #ai-sug .act { display: flex; gap: 20px; align-items: center; }

      /* devices */
      .dev-part { position: absolute; inset: 0; }
      #dev-core { left: 820px; top: 200px; width: 960px; }
      #dev-core-glow { left: 900px; top: 200px; width: 820px; height: 820px; }
      #dev-counter { left: 1060px; top: 150px; height: 800px; width: 646px; }
      #c15-screen { position: absolute; inset: 0; clip-path: polygon(22.6% 9.9%, 63.8% 12.1%, 81.1% 86.2%, 39.6% 89.3%); background: linear-gradient(160deg, #0369a1 0%, #0ea5e9 45%, #14b8a6 100%); }
      .c15-ad { position: absolute; left: 37%; top: 44%; width: 40%; display: flex; flex-direction: column; gap: 6px; transform-origin: 0 0; transform: skewY(6deg) rotate(4deg); }
      .c15-ad .k { font-family: var(--da-font-mono); font-size: 15px; letter-spacing: 0.14em; }
      .c15-ad .p { font-family: var(--da-font-display); font-weight: 800; font-size: 54px; letter-spacing: -0.05em; line-height: 0.9; }
      .c15-ad .s { font-family: var(--da-font-display); font-weight: 600; font-size: 20px; }
      #dev-counter-glow { left: 960px; top: 160px; width: 820px; height: 820px; }
      .dev-copy { left: 140px; top: 330px; width: 760px; }
      .dev-copy h2 { font-size: 104px; }
      .dev-copy p { font-size: 34px; color: var(--da-text-2); line-height: 1.35; margin: 28px 0 34px; }
      .spec { display: flex; gap: 14px; flex-wrap: wrap; }
      #dev-offline { left: 0; right: 0; top: 0; bottom: 0; }
      #dev-off-tv { left: 560px; top: 210px; width: 800px; height: 470px; padding: 16px; box-sizing: border-box; }
      #dev-off-tv .tv-face { background: url("assets/brand/img/escena-06.jpg") center/cover; }
      #dev-wifi { left: 1200px; top: 160px; width: 120px; height: 120px; border-radius: 50%; display: flex; align-items: center; justify-content: center; background: rgba(9,9,11,0.85); border: 2px solid rgba(245,158,11,0.6); }
      #dev-wifi .da-icon { font-size: 60px; color: var(--da-amber); }
      #dev-off-copy { left: 0; right: 0; top: 760px; text-align: center; }
      #dev-off-copy h2 { font-size: 86px; }
      .gal { position: absolute; overflow: hidden; border-radius: 30px; border: 1px solid var(--da-border-strong); box-shadow: 0 40px 100px rgba(0,0,0,0.6); }
      .gal img { width: 100%; height: 100%; object-fit: cover; display: block; }
      #gal-1 { left: 140px; top: 170px; width: 860px; height: 740px; }
      #gal-2 { left: 1040px; top: 170px; width: 740px; height: 350px; }
      #gal-3 { left: 1040px; top: 560px; width: 350px; height: 350px; }
      #gal-4 { left: 1430px; top: 560px; width: 350px; height: 350px; }
      #gal-cap { left: 140px; top: 950px; }

      /* cta */
      #cta-logo { left: 0; right: 0; top: 250px; display: flex; justify-content: center; }
      #cta-logo img { width: 900px; }
      #cta-tag { left: 0; right: 0; top: 590px; text-align: center; font-size: 80px; }
      #cta-row { left: 0; right: 0; top: 760px; display: flex; justify-content: center; gap: 28px; align-items: center; }
      #cta-url { font-family: var(--da-font-mono); font-size: 40px; color: var(--da-text); padding: 18px 34px; border-radius: 16px; border: 1px solid var(--da-border-strong); background: rgba(9,9,11,0.7); }
    </style>
  </head>
  <body>
    <svg width="0" height="0" style="position: absolute">
      <symbol id="i-usb" viewBox="0 0 24 24"><circle cx="10" cy="7" r="1" /><circle cx="4" cy="20" r="1" /><path d="M4.7 19.3 19 5" /><path d="m21 3-3 1 2 2Z" /><path d="M9.26 7.68 5 12l2 5" /><path d="m10 14 5 2 3.5-3.5" /><path d="m18 12 1-1 1 1-1 1Z" /></symbol>
      <symbol id="i-phone" viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" /></symbol>
      <symbol id="i-monitor-off" viewBox="0 0 24 24"><path d="M17 17H4a2 2 0 0 1-2-2V5c0-1.5 1-2 1-2" /><path d="M22 15V5a2 2 0 0 0-2-2H9" /><path d="M8 21h8" /><path d="M12 17v4" /><path d="m2 2 20 20" /></symbol>
      <symbol id="i-wifi-off" viewBox="0 0 24 24"><path d="M12 20h.01" /><path d="M8.5 16.429a5 5 0 0 1 7 0" /><path d="M5 12.859a10 10 0 0 1 5.17-2.69" /><path d="M19 12.859a10 10 0 0 0-2.007-1.523" /><path d="M2 8.82a15 15 0 0 1 4.177-2.643" /><path d="M22 8.82a15 15 0 0 0-11.288-3.764" /><path d="m2 2 20 20" /></symbol>
      <symbol id="i-sun" viewBox="0 0 24 24"><circle cx="12" cy="12" r="4" /><path d="M12 2v2" /><path d="M12 20v2" /><path d="m4.93 4.93 1.41 1.41" /><path d="m17.66 17.66 1.41 1.41" /><path d="M2 12h2" /><path d="M20 12h2" /><path d="m6.34 17.66-1.41 1.41" /><path d="m19.07 4.93-1.41 1.41" /></symbol>
      <symbol id="i-calendar" viewBox="0 0 24 24"><rect width="18" height="18" x="3" y="4" rx="2" /><path d="M16 2v4" /><path d="M8 2v4" /><path d="M3 10h18" /></symbol>
      <symbol id="i-pin" viewBox="0 0 24 24"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" /></symbol>
      <symbol id="i-sparkles" viewBox="0 0 24 24"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" /></symbol>
      <symbol id="i-check" viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5" /></symbol>
      <symbol id="i-bell" viewBox="0 0 24 24"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></symbol>
      <symbol id="i-tv" viewBox="0 0 24 24"><rect width="20" height="15" x="2" y="7" rx="2" /><path d="m17 2-5 5-5-5" /></symbol>
    </svg>

    <div id="root" data-composition-id="presentacion" data-start="0" data-width="1920" data-height="1080" data-duration="{{duration}}">
      <div class="layer" id="bg-layer" data-layout-allow-overflow>
        <div class="da-bg"></div>
        <div class="da-dots" id="dots"></div>
        <div class="da-glow" id="glow-a"></div>
        <div class="da-glow teal" id="glow-b"></div>
      </div>

      <section id="hook" class="clip scene" data-start="{{start:hook}}" data-duration="{{dur:hook}}" data-track-index="1">
        <div class="scene-in" id="hook-in">
          <div class="abs hook-copy">
            <div class="hook-swap" id="hook-a">
              <h1 class="da-title" id="hook-a1">¿Cuánto te cuesta</h1>
              <h1 class="da-title"><span class="da-grad" id="hook-a2">una pantalla apagada?</span></h1>
            </div>
            <div class="hook-swap" id="hook-b">
              <h1 class="da-title" id="hook-b1">¿Y la promo que</h1>
              <h1 class="da-title"><span class="da-grad" id="hook-b2">venció hace dos semanas?</span></h1>
            </div>
          </div>
          <div class="abs da-glass" id="hook-screen">
            <div class="tv-face" id="hook-face">
              <div class="tv-promo">
                <span class="da-label">Promo de invierno · válida hasta el 21/09</span>
                <div class="big">2x1 en cafés</div>
              </div>
              <div id="hook-off"></div>
              <div id="hook-line"></div>
            </div>
          </div>
          <div class="abs" id="hook-stand"></div>
          <div class="abs" id="hook-stamp">VENCIDA</div>
        </div>
      </section>

      <section id="pain" class="clip scene" data-start="{{start:pain}}" data-duration="{{dur:pain}}" data-track-index="1">
        <div class="scene-in" id="pain-in">
          <div class="abs da-label" id="pain-kicker">Así se manejan hoy las pantallas de un local</div>
          <div class="abs" id="pain-row">
            <div class="pain-card da-glass" id="pain-1"><svg class="da-icon"><use href="#i-usb" /></svg><h3>Pendrives</h3><div class="pain-strike" id="pain-s1"></div></div>
            <div class="pain-card da-glass" id="pain-2"><svg class="da-icon"><use href="#i-phone" /></svg><h3>Llamadas al local</h3><div class="pain-strike" id="pain-s2"></div></div>
            <div class="pain-card da-glass" id="pain-3"><svg class="da-icon"><use href="#i-monitor-off" /></svg><h3>Pantallas sin control</h3><div class="pain-strike" id="pain-s3"></div></div>
          </div>
          <div class="abs" id="pain-dot"></div>
        </div>
      </section>

      <section id="reveal" class="clip scene" data-start="{{start:reveal}}" data-duration="{{dur:reveal}}" data-track-index="1">
        <div class="scene-in" id="reveal-in">
          <div class="abs" id="reveal-ring"></div>
          <div class="abs" id="reveal-logo"><img src="assets/brand/img/logo.svg" alt="DisplayAds" id="reveal-logo-img" /></div>
          <h2 class="abs da-title" id="reveal-tag">Cada pantalla, bajo control. <span class="da-grad">Con IA.</span></h2>
          <div class="abs" id="reveal-sub">
            <span class="da-chip" id="reveal-c1">Cartelería digital en la nube</span>
            <span class="da-chip" id="reveal-c2"><svg class="da-icon" style="color: var(--da-sky-400)"><use href="#i-sparkles" /></svg>IA generativa integrada</span>
          </div>
        </div>
      </section>

      <section id="remote" class="clip scene" data-start="{{start:remote}}" data-duration="{{dur:remote}}" data-track-index="1">
        <div class="scene-in" id="remote-in">
          <div class="abs headline" id="remote-h"><h2 class="da-title">Cambiá el contenido de <span class="da-grad">todas tus sucursales</span></h2></div>
          <svg class="abs" id="remote-net" viewBox="0 0 1920 1080">
            <defs><linearGradient id="net-g" x1="0" x2="1"><stop offset="0" stop-color="#38bdf8" stop-opacity="0.1" /><stop offset="1" stop-color="#38bdf8" /></linearGradient></defs>
            <path id="net-1" d="M540 760 C 820 760, 900 440, 1180 440" stroke="url(#net-g)" stroke-width="3" fill="none" />
            <path id="net-2" d="M540 760 C 820 760, 900 700, 1180 700" stroke="url(#net-g)" stroke-width="3" fill="none" />
            <path id="net-3" d="M540 760 C 820 760, 900 960, 1180 960" stroke="url(#net-g)" stroke-width="3" fill="none" />
          </svg>
          <div class="abs" id="phone">
            <div class="phone-screen">
              <span class="da-label" style="font-size: 15px">Campañas</span>
              <div class="phone-card">
                <div class="phone-thumb">-20%</div>
                <div class="t" style="margin-top: 14px">Promo Primavera 2026</div>
                <div class="m">3 sucursales · 08:00–22:00</div>
              </div>
              <div class="phone-card"><div class="t" style="font-size: 22px; color: var(--da-text-2)">Menú del día</div><div class="m">Borrador</div></div>
              <div class="da-btn" id="phone-btn">Publicar</div>
            </div>
          </div>
          <div class="abs screen da-glass" id="scr-1"><div class="screen-label"><span class="da-dot"></span>Sucursal Palermo</div><div class="tv-face"><div class="scr-old">Promo invierno</div><div class="scr-new" id="scr-1n"><small>Promo primavera</small>-20% en toda la tienda</div></div><div class="scr-ok da-chip" id="scr-1k"><svg class="da-icon" style="color: var(--da-emerald)"><use href="#i-check" /></svg>actualizada</div></div>
          <div class="abs screen da-glass" id="scr-2"><div class="screen-label"><span class="da-dot"></span>Córdoba Centro</div><div class="tv-face"><div class="scr-old">Promo invierno</div><div class="scr-new" id="scr-2n"><small>Promo primavera</small>-20% en toda la tienda</div></div><div class="scr-ok da-chip" id="scr-2k"><svg class="da-icon" style="color: var(--da-emerald)"><use href="#i-check" /></svg>actualizada</div></div>
          <div class="abs screen da-glass" id="scr-3"><div class="screen-label"><span class="da-dot"></span>Rosario · Mostrador</div><div class="tv-face"><div class="scr-old">Promo invierno</div><div class="scr-new" id="scr-3n"><small>Promo primavera</small>-20%</div></div><div class="scr-ok da-chip" id="scr-3k"><svg class="da-icon" style="color: var(--da-emerald)"><use href="#i-check" /></svg>actualizada</div></div>
        </div>
      </section>

      <section id="schedule" class="clip scene" data-start="{{start:schedule}}" data-duration="{{dur:schedule}}" data-track-index="1">
        <div class="scene-in" id="schedule-in">
          <div class="abs headline" id="sched-h"><h2 class="da-title">Programá por <span class="da-grad">horario, día o sucursal</span></h2></div>
          <div class="abs da-glass" id="sched-panel">
            <div id="sched-days">
              <div class="day on">LUN</div><div class="day on">MAR</div><div class="day on">MIÉ</div><div class="day on">JUE</div><div class="day on">VIE</div><div class="day" id="day-sat">SÁB</div><div class="day" id="day-sun">DOM</div>
            </div>
            <div id="sched-branches"><span class="da-chip" id="br-1"><svg class="da-icon"><use href="#i-pin" /></svg>Palermo</span><span class="da-chip" id="br-2"><svg class="da-icon"><use href="#i-pin" /></svg>Córdoba Centro</span></div>
            <div id="sched-track">
              <div class="hour" style="left: 0%"><span>08:00</span></div>
              <div class="hour" style="left: 21.4%"><span>11:00</span></div>
              <div class="hour" style="left: 50%"><span>15:00</span></div>
              <div class="hour" style="left: 85.7%"><span>20:00</span></div>
              <div class="hour" style="left: 100%"><span>22:00</span></div>
              <div class="block b-zinc" id="blk-1" style="left: 0%; width: 21%; top: 24px"><b>Desayuno</b><i>08–11</i></div>
              <div class="block b-sky" id="blk-2" style="left: 21.4%; width: 28.2%; top: 24px"><b>Menú almuerzo</b><i>11–15</i></div>
              <div class="block b-teal" id="blk-3" style="left: 50%; width: 35.3%; top: 24px"><b>Promo de la tarde</b><i>15–20</i></div>
              <div class="block b-sky" id="blk-4" style="left: 85.7%; width: 14.3%; top: 24px"><b>Happy hour</b><i>20–22</i></div>
              <div class="block b-teal" id="blk-5" style="left: 21.4%; width: 64%; top: 140px"><b>Fin de semana · Brunch y postres</b><i>SÁB–DOM · 11–20</i></div>
              <div id="playhead" style="left: 0%"></div>
            </div>
          </div>
        </div>
      </section>

      <section id="monitor" class="clip scene" data-start="{{start:monitor}}" data-duration="{{dur:monitor}}" data-track-index="1">
        <div class="scene-in" id="monitor-in">
          <div class="abs headline" id="mon-h"><h2 class="da-title">Sabés <span class="da-grad">qué pasa en cada pantalla</span></h2></div>
          <div class="abs da-glass" id="mon-panel">
            <div class="row head"><span></span><span>Equipo</span><span>Ubicación</span><span>Reproduciendo</span></div>
            <div class="row" id="mr-1"><span class="da-dot"></span><span class="n">Core Pro · Vidriera</span><span class="loc">Palermo</span><span class="now">Promo Primavera</span></div>
            <div class="row" id="mr-2"><span class="da-dot"></span><span class="n">Core Pro · Salón</span><span class="loc">Córdoba Centro</span><span class="now">Menú almuerzo</span></div>
            <div class="row" id="mr-3"><span class="da-dot" id="mr-3-dot"></span><span class="n">Counter 15 · Caja 2</span><span class="loc">Rosario</span><span class="now" style="position: relative"><span id="mr-3-now">Happy hour</span><span id="mr-3-off" style="position: absolute; left: 0; top: 0; color: #fbbf24; opacity: 0">Sin conexión</span></span></div>
            <div class="row" id="mr-4"><span class="da-dot"></span><span class="n">Counter 15 · Recepción</span><span class="loc">Palermo</span><span class="now">Promo Primavera</span></div>
          </div>
          <div class="abs da-glass" id="mon-stat">
            <span class="da-label">Pantallas en línea</span>
            <div id="mon-count"><span id="mon-n">0</span><span class="da-muted">/12</span></div>
            <span class="da-chip" style="align-self: flex-start"><span class="da-dot"></span>En tiempo real</span>
          </div>
          <div class="abs da-glass" id="mon-toast"><svg class="da-icon"><use href="#i-bell" /></svg><div><b>Counter 15 · Caja 2 sin conexión</b><span>Rosario · hace 1 min</span></div></div>
        </div>
      </section>

      <section id="ai" class="clip scene" data-start="{{start:ai}}" data-duration="{{dur:ai}}" data-track-index="1">
        <div class="scene-in" id="ai-in">
          <div class="ai-part" id="ai-p1">
            <div class="abs headline" id="ai-h1"><h2 class="da-title">Contenido con <span class="da-grad">IA, en segundos</span></h2></div>
            <div class="abs da-glass" id="ai-prompt">
              <span class="da-label" style="display: flex; gap: 12px; align-items: center"><svg class="da-icon" style="color: var(--da-sky-400)"><use href="#i-sparkles" /></svg>Generar imagen</span>
              <div class="q" style="margin-top: 20px"><span id="ai-typed"></span><span id="ai-caret"></span></div>
            </div>
            <div class="abs" id="ai-gen">
              <div class="ad">
                <div class="ad-cup"></div>
                <div class="ad-steam" style="right: 230px; top: 30px" id="st-1"></div>
                <div class="ad-steam" style="right: 190px; top: 10px" id="st-2"></div>
                <div class="ad-steam" style="right: 150px; top: 34px" id="st-3"></div>
                <div class="ad-copy"><div class="k">CAFÉ DE ESPECIALIDAD</div><div class="p">-20%</div><div class="s">en todos los cafés</div></div>
              </div>
              <div id="ai-gen-mask"></div>
              <div id="ai-scan"></div>
            </div>
            <div class="abs da-chip" id="ai-badge"><svg class="da-icon" style="color: var(--da-sky-400)"><use href="#i-sparkles" /></svg>Generada en 28 s</div>
          </div>
          <div class="ai-part" id="ai-p2">
            <div class="abs headline" id="ai-h2"><h2 class="da-title">Entiende <span class="da-grad">el contexto de tu local</span></h2></div>
            <div class="abs" id="ai-ctx">
              <span class="da-chip" id="cx-1"><svg class="da-icon"><use href="#i-sun" /></svg>31° · calor extremo en Córdoba</span>
              <span class="da-chip" id="cx-2"><svg class="da-icon"><use href="#i-calendar" /></svg>Lunes feriado nacional</span>
              <span class="da-chip" id="cx-3"><svg class="da-icon"><use href="#i-pin" /></svg>3 competidores a menos de 500 m</span>
            </div>
            <div class="abs" id="ai-radar">
              <div class="ring" style="inset: 0"></div>
              <div class="ring" style="inset: 120px"></div>
              <div class="ring" style="inset: 240px"></div>
              <div id="radar-sweep"></div>
              <div class="pin me" style="left: 360px; top: 360px"></div>
              <div class="pin" id="pin-1" style="left: 210px; top: 250px"></div>
              <div class="pin" id="pin-2" style="left: 560px; top: 300px"></div>
              <div class="pin" id="pin-3" style="left: 430px; top: 600px"></div>
              <span class="abs da-label" style="left: 470px; top: 20px">500 m</span>
            </div>
          </div>
          <div class="ai-part" id="ai-p3">
            <div class="abs da-glass" id="ai-sug">
              <div class="hd"><svg class="da-icon"><use href="#i-sparkles" /></svg><span class="da-label" style="color: var(--da-sky-300)">Sugerencia de la IA · para mañana</span></div>
              <p>Mañana hay <span class="da-grad">31° en Córdoba</span>: activá la campaña de bebidas frías en las 4 pantallas del local.</p>
              <div class="act"><span class="da-btn" id="sug-btn" style="position: relative"><span id="sug-a">Activar campaña</span><span id="sug-b" style="position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; opacity: 0">Campaña activa</span></span><span class="da-chip">Ver detalle</span></div>
            </div>
          </div>
        </div>
      </section>

      <section id="devices" class="clip scene" data-start="{{start:devices}}" data-duration="{{dur:devices}}" data-track-index="1">
        <div class="scene-in" id="devices-in">
          <div class="dev-part" id="dv-1">
            <div class="abs da-glow" id="dev-core-glow"></div>
            <img class="abs" id="dev-core" src="assets/brand/img/core-pro.png" alt="Core Pro" />
            <div class="abs dev-copy" id="dv-1c">
              <span class="da-label">Equipos propios · listos de fábrica</span>
              <h2 class="da-title" style="margin-top: 22px">Core <span class="da-grad">Pro</span></h2>
              <p>Se conecta por HDMI y convierte cualquier televisor en una pantalla inteligente.</p>
              <div class="spec"><span class="da-chip"><svg class="da-icon"><use href="#i-tv" /></svg>HDMI</span><span class="da-chip">Wi-Fi · Ethernet</span><span class="da-chip">Dual: 2 pantallas</span></div>
            </div>
          </div>
          <div class="dev-part" id="dv-2">
            <div class="abs da-glow" id="dev-counter-glow"></div>
            <div class="abs" id="dev-counter"><img src="assets/brand/img/counter-15.png" alt="Counter 15" style="height: 100%; display: block" /><div id="c15-screen"><div class="c15-ad"><span class="k">MENÚ DEL DÍA</span><span class="p">$ 8.900</span><span class="s">Milanesa con puré</span></div></div></div>
            <div class="abs dev-copy" id="dv-2c">
              <span class="da-label">Todo en uno · 15,6"</span>
              <h2 class="da-title" style="margin-top: 22px">Counter <span class="da-grad">15</span></h2>
              <p>La pantalla de mostrador, caja o recepción, con el reproductor integrado.</p>
              <div class="spec"><span class="da-chip">Táctil</span><span class="da-chip">Vertical u horizontal</span></div>
            </div>
          </div>
          <div class="dev-part" id="dv-3">
            <div class="abs da-glass" id="dev-off-tv"><div class="tv-face"></div></div>
            <div class="abs" id="dev-wifi"><svg class="da-icon"><use href="#i-wifi-off" /></svg></div>
            <div class="abs" id="dev-off-copy"><h2 class="da-title">Sin internet, <span class="da-grad">sigue reproduciendo</span></h2></div>
          </div>
          <div class="dev-part" id="dv-4">
            <div class="gal" id="gal-1"><img src="assets/brand/img/escena-04.png" alt="" id="gi-1" /></div>
            <div class="gal" id="gal-2"><img src="assets/brand/img/escena-08.jpg" alt="" id="gi-2" /></div>
            <div class="gal" id="gal-3"><img src="assets/brand/img/escena-09.jpg" alt="" id="gi-3" /></div>
            <div class="gal" id="gal-4"><img src="assets/brand/img/escena-12.jpg" alt="" id="gi-4" /></div>
            <div class="abs da-label" id="gal-cap">Gastronomía · Retail · Bancos · Salud</div>
          </div>
        </div>
      </section>

      <section id="cta" class="clip scene" data-start="{{start:cta}}" data-duration="{{dur:cta}}" data-track-index="1">
        <div class="scene-in" id="cta-in">
          <div class="abs" id="cta-logo"><img src="assets/brand/img/logo.svg" alt="DisplayAds" /></div>
          <h2 class="abs da-title" id="cta-tag">Cada pantalla, bajo control. <span class="da-grad">Con IA.</span></h2>
          <div class="abs" id="cta-row"><span class="da-btn" id="cta-btn">Pedí tu cotización</span><span id="cta-url">displayads.com.ar</span></div>
        </div>
      </section>

      <div class="layer" id="hud">
        <div id="bug"><img src="assets/brand/img/isotipo.svg" alt="" /><span>DisplayAds</span></div>
        <div id="chapter" class="da-label"></div>
        <div id="beat-ticks"><i></i><i></i><i></i><i></i></div>
        <div id="credit">Música: {{music_credit}}</div>
      </div>
      <div id="flash"></div>
      <div class="layer da-vignette"></div>
      <div class="layer da-grain"></div>
      <div id="progress"></div>

      <audio id="music" src="assets/audio/music.wav" data-start="0" data-duration="{{duration}}" data-track-index="10" data-volume="1" data-automation='{{music_automation}}'></audio>
      {{voice_tracks}}
      <audio id="sfx-riser" src="assets/runtime/sfx/riser.mp3" data-start="{{sfx:riser}}" data-duration="3.4" data-media-start="6.6" data-track-index="12" data-volume="0.55"></audio>
      <audio id="sfx-impact" src="assets/runtime/sfx/impact-bass-1.mp3" data-start="{{start:reveal}}" data-duration="2" data-track-index="13" data-volume="0.8"></audio>
      {{whoosh_tracks}}
      <audio id="sfx-click" src="assets/runtime/sfx/click-soft.mp3" data-start="{{sfx:click}}" data-duration="0.36" data-track-index="14" data-volume="0.7"></audio>
      <audio id="sfx-notif" src="assets/runtime/sfx/notification.mp3" data-start="{{sfx:notif}}" data-duration="1.4" data-track-index="14" data-volume="0.45"></audio>
      <audio id="sfx-pop" src="assets/runtime/sfx/pop.mp3" data-start="{{sfx:pop}}" data-duration="0.7" data-track-index="14" data-volume="0.5"></audio>
      <audio id="sfx-chime" src="assets/runtime/sfx/chime.mp3" data-start="{{sfx:chime}}" data-duration="2.4" data-track-index="14" data-volume="0.4"></audio>
    </div>

    <script>
      const T = {{timeline_json}};
      const W = {{words_json}};
      const tl = gsap.timeline({ paused: true });
      const scene = (id) => T.scenes.find((s) => s.id === id);
      const S = (id) => scene(id).start;
      const E = (id) => scene(id).end;
      const plain = (text) => text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
      const wordAt = (id, prefix) => {
        const slot = scene(id);
        const found = (W[id] || []).find((w) => plain(w.w).startsWith(plain(prefix)));
        if (found) return slot.voStart + found.t;
        const scriptWords = (slot.vo || "").split(/\s+/).map(plain).filter(Boolean);
        const index = scriptWords.findIndex((w) => w.startsWith(plain(prefix)));
        console.warn(`motion-studio: "${prefix}" no aparece en la voz de ${id}; se estima por su posición en el guion`);
        return slot.voStart + (index < 0 ? 0 : (slot.voDuration * index) / Math.max(1, scriptWords.length));
      };
      const out = (sel, id, dur = 0.35) => tl.to(sel, { opacity: 0, y: -24, filter: "blur(8px)", duration: dur, ease: "power2.in" }, E(id) - dur);

      tl.fromTo("#progress", { scaleX: 0 }, { scaleX: 1, duration: T.duration, ease: "none" }, 0);
      tl.fromTo("#glow-a", { x: 0, y: 0 }, { x: 420, y: 160, duration: T.duration, ease: "sine.inOut" }, 0);
      tl.fromTo("#glow-b", { x: 0, y: 0 }, { x: -380, y: -120, duration: T.duration, ease: "sine.inOut" }, 0);
      tl.fromTo("#dots", { x: 0, y: 0 }, { x: -68, y: -34, duration: T.duration, ease: "none" }, 0);

      const energetic = (t) => t >= S("reveal") && t < S("devices") || t >= S("cta");
      const ticks = gsap.utils.toArray("#beat-ticks i");
      T.beats.forEach((b, i) => {
        tl.fromTo(ticks[i % 4], { backgroundColor: "#38bdf8", scale: 1.35 }, { backgroundColor: "rgba(255,255,255,0.18)", scale: 1, duration: T.beatLength * 0.9, ease: "power2.out" }, b);
        if (i % 4 === 0 && energetic(b)) {
          tl.fromTo("#glow-a", { opacity: 1, scale: 1.08 }, { opacity: 0.75, scale: 1, duration: T.beatLength * 3, ease: "power2.out" }, b);
        }
      });

      const chapters = [["hook", "01", "El problema"], ["reveal", "02", "La plataforma"], ["remote", "03", "Control remoto"], ["schedule", "04", "Programación"], ["monitor", "05", "Monitoreo"], ["ai", "06", "Inteligencia artificial"], ["devices", "07", "Equipos"], ["cta", "08", "DisplayAds"]];
      chapters.forEach(([id, n, label], i) => {
        const el = document.createElement("div");
        el.className = "chap";
        el.id = `chap-${i}`;
        el.innerHTML = `<span class="num">${n}</span><span>${label}</span>`;
        document.getElementById("chapter").appendChild(el);
        const next = chapters[i + 1];
        tl.fromTo(el, { opacity: 0, x: 16 }, { opacity: 1, x: 0, duration: 0.3, ease: "power3.out" }, i === 0 ? 0.3 : S(id) + 0.02);
        if (next) tl.to(el, { opacity: 0, x: -16, duration: 0.18, ease: "power2.in" }, S(next[0]) - 0.18);
      });
      tl.fromTo("#bug", { opacity: 0, y: -10 }, { opacity: 1, y: 0, duration: 0.5, ease: "power3.out" }, S("remote"));
      tl.to("#bug", { opacity: 0, duration: 0.3 }, S("cta"));
      tl.fromTo("#credit", { opacity: 0 }, { opacity: 1, duration: 0.6 }, S("cta") + 1);
      tl.fromTo("#flash", { opacity: 0 }, { opacity: 0.85, duration: 0.06 }, S("reveal"));
      tl.to("#flash", { opacity: 0, duration: 0.9, ease: "power2.out" }, S("reveal") + 0.06);

      /* hook */
      {
        const h = S("hook");
        tl.fromTo("#hook-a1", { opacity: 0, y: 60 }, { opacity: 1, y: 0, duration: 0.6, ease: "power4.out" }, h + 0.15);
        tl.fromTo("#hook-a2", { opacity: 0, y: 60 }, { opacity: 1, y: 0, duration: 0.6, ease: "power4.out" }, h + 0.35);
        tl.fromTo("#hook-screen", { opacity: 0, x: 80, rotateY: -18, transformPerspective: 1400 }, { opacity: 1, x: 0, rotateY: -8, duration: 0.9, ease: "power3.out" }, h + 0.2);
        tl.fromTo("#hook-stand", { opacity: 0 }, { opacity: 1, duration: 0.6 }, h + 0.4);
        const off = wordAt("hook", "apagada") + 0.05;
        tl.fromTo("#hook-line", { opacity: 0 }, { opacity: 1, duration: 0.02 }, off);
        tl.fromTo("#hook-off", { opacity: 0 }, { opacity: 1, duration: 0.12, ease: "power2.in" }, off);
        tl.fromTo("#hook-line", { scaleX: 1, scaleY: 1 }, { scaleX: 0, scaleY: 0.4, duration: 0.32, ease: "power3.in" }, off + 0.08);
        tl.to("#hook-line", { opacity: 0, duration: 0.05 }, off + 0.4);
        const promo = wordAt("hook", "promo") - 0.15;
        tl.to(["#hook-a1", "#hook-a2"], { opacity: 0, y: -40, duration: 0.3, ease: "power2.in", stagger: 0.05 }, promo - 0.3);
        tl.fromTo("#hook-b1", { opacity: 0, y: 60 }, { opacity: 1, y: 0, duration: 0.55, ease: "power4.out" }, promo);
        tl.fromTo("#hook-b2", { opacity: 0, y: 60 }, { opacity: 1, y: 0, duration: 0.55, ease: "power4.out" }, promo + 0.15);
        tl.to("#hook-off", { opacity: 0, duration: 0.25 }, promo);
        const stamp = wordAt("hook", "semanas");
        tl.fromTo("#hook-stamp", { opacity: 0, scale: 2.2, rotate: -22 }, { opacity: 1, scale: 1, rotate: -12, duration: 0.28, ease: "back.out(2.5)" }, stamp);
        tl.fromTo("#hook-face", { x: 0 }, { x: 10, duration: 0.05, yoyo: true, repeat: 5, ease: "none" }, stamp + 0.1);
        out("#hook-in", "hook");
      }
      tl.set(["#hook-b1", "#hook-b2"], { opacity: 0 }, 0);

      /* pain */
      {
        const p = S("pain");
        tl.fromTo("#pain-kicker", { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.5, ease: "power3.out" }, p + 0.05);
        ["pendrives", "llamadas", "pantallas"].forEach((w, i) => {
          tl.fromTo(`#pain-${i + 1}`, { opacity: 0, y: 120, scale: 0.92 }, { opacity: 1, y: 0, scale: 1, duration: 0.5, ease: "back.out(1.6)" }, wordAt("pain", w) - 0.12);
        });
        const strikeBeats = T.beats.filter((b) => b > wordAt("pain", "controla") + 0.4).slice(0, 6);
        [0, 2, 4].forEach((k, i) => {
          tl.fromTo(`#pain-s${i + 1}`, { scaleX: 0 }, { scaleX: 1, duration: 0.22, ease: "power3.out" }, strikeBeats[k]);
          tl.to(`#pain-${i + 1}`, { opacity: 0.45, duration: 0.3 }, strikeBeats[k] + 0.1);
        });
        const end = E("pain");
        tl.to("#pain-row", { scale: 0.05, opacity: 0, duration: 0.7, ease: "power4.in" }, end - 1.1);
        tl.to("#pain-kicker", { opacity: 0, duration: 0.3 }, end - 1.1);
        tl.fromTo("#pain-dot", { opacity: 0, scale: 0 }, { opacity: 1, scale: 1.4, duration: 0.6, ease: "power2.in" }, end - 0.65);
      }

      /* reveal */
      {
        const r = S("reveal");
        tl.fromTo("#reveal-logo-img", { opacity: 0, scale: 1.25, filter: "blur(18px)" }, { opacity: 1, scale: 1, filter: "blur(0px)", duration: 0.9, ease: "expo.out" }, r);
        tl.fromTo("#reveal-ring", { opacity: 0.9, scale: 0.3 }, { opacity: 0, scale: 2.2, duration: 1.6, ease: "power2.out" }, r);
        tl.fromTo("#reveal-tag", { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 0.7, ease: "power3.out" }, wordAt("reveal", "carteleria") - 0.1);
        tl.fromTo("#reveal-c1", { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.5, ease: "power3.out" }, wordAt("reveal", "nube") - 0.2);
        tl.fromTo("#reveal-c2", { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.5, ease: "power3.out" }, wordAt("reveal", "inteligencia"));
        tl.fromTo("#reveal-logo", { y: 0 }, { y: -20, duration: E("reveal") - r, ease: "sine.inOut" }, r);
        out("#reveal-in", "reveal", 0.3);
      }

      /* remote */
      {
        const r = S("remote");
        tl.fromTo("#remote-h", { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 0.6, ease: "power3.out" }, r + 0.05);
        tl.fromTo("#phone", { opacity: 0, y: 140, rotate: -6 }, { opacity: 1, y: 0, rotate: 0, duration: 0.8, ease: "power4.out" }, r + 0.1);
        ["#scr-1", "#scr-2", "#scr-3"].forEach((s, i) => tl.fromTo(s, { opacity: 0, x: 80 }, { opacity: 1, x: 0, duration: 0.6, ease: "power3.out" }, r + 0.3 + i * 0.12));
        ["#net-1", "#net-2", "#net-3"].forEach((n) => tl.fromTo(n, { strokeDasharray: 900, strokeDashoffset: 900, opacity: 0.25 }, { strokeDashoffset: 900, opacity: 0.25, duration: 0.01 }, r));
        const press = wordAt("remote", "celular");
        tl.to("#phone-btn", { scale: 0.92, duration: 0.1, ease: "power2.in" }, press);
        tl.to("#phone-btn", { scale: 1, duration: 0.35, ease: "back.out(3)" }, press + 0.1);
        ["#net-1", "#net-2", "#net-3"].forEach((n, i) => {
          tl.to(n, { strokeDashoffset: 0, opacity: 1, duration: 0.55, ease: "power2.inOut" }, press + 0.15 + i * 0.08);
        });
        [1, 2, 3].forEach((i) => {
          const at = press + 0.6 + (i - 1) * 0.12;
          tl.fromTo(`#scr-${i}n`, { clipPath: "inset(0 100% 0 0)" }, { clipPath: "inset(0 0% 0 0)", duration: 0.45, ease: "power3.inOut" }, at);
          tl.fromTo(`#scr-${i}k`, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.35, ease: "back.out(2)" }, at + 0.3);
        });
        out("#remote-in", "remote");
      }

      /* schedule */
      {
        const s = S("schedule");
        tl.fromTo("#sched-h", { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 0.6, ease: "power3.out" }, s + 0.05);
        tl.fromTo("#sched-panel", { opacity: 0, y: 60 }, { opacity: 1, y: 0, duration: 0.7, ease: "power3.out" }, s + 0.12);
        const hour = wordAt("schedule", "horario");
        ["#blk-1", "#blk-2", "#blk-3", "#blk-4"].forEach((b, i) => tl.fromTo(b, { opacity: 0, scaleX: 0.2 }, { opacity: 1, scaleX: 1, duration: 0.45, ease: "power4.out" }, hour - 0.2 + i * T.beatLength / 2));
        const day = wordAt("schedule", "dia");
        tl.fromTo(["#day-sat", "#day-sun"], { backgroundColor: "rgba(0,0,0,0)" }, { backgroundColor: "rgba(20,184,166,0.25)", borderColor: "rgba(45,212,191,0.7)", color: "#fff", duration: 0.25, stagger: 0.12 }, day);
        tl.fromTo("#blk-5", { opacity: 0, scaleX: 0.2 }, { opacity: 1, scaleX: 1, duration: 0.5, ease: "power4.out" }, day + 0.2);
        const suc = wordAt("schedule", "sucursal");
        tl.fromTo(["#br-1", "#br-2"], { opacity: 0, y: -14 }, { opacity: 1, y: 0, duration: 0.4, stagger: 0.12, ease: "back.out(2)" }, suc - 0.1);
        tl.fromTo("#playhead", { x: 0 }, { x: 1100, duration: E("schedule") - s - 0.5, ease: "none" }, s + 0.5);
        out("#schedule-in", "schedule");
      }

      /* monitor */
      {
        const m = S("monitor");
        tl.fromTo("#mon-h", { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 0.6, ease: "power3.out" }, m + 0.05);
        tl.fromTo("#mon-panel", { opacity: 0, x: -60 }, { opacity: 1, x: 0, duration: 0.7, ease: "power3.out" }, m + 0.1);
        ["#mr-1", "#mr-2", "#mr-3", "#mr-4"].forEach((r, i) => tl.fromTo(r, { opacity: 0, x: -30 }, { opacity: 1, x: 0, duration: 0.4, ease: "power3.out" }, m + 0.35 + i * T.beatLength / 2));
        tl.fromTo("#mon-stat", { opacity: 0, x: 60 }, { opacity: 1, x: 0, duration: 0.7, ease: "power3.out" }, m + 0.25);
        const counter = { n: 0 };
        tl.to(counter, { n: 12, duration: 1.4, ease: "power2.out", onUpdate: () => { document.getElementById("mon-n").textContent = Math.round(counter.n); } }, wordAt("monitor", "linea") - 0.3);
        const offT = wordAt("monitor", "apagada") + 0.1;
        tl.to("#mr-3-dot", { backgroundColor: "#f59e0b", boxShadow: "0 0 14px rgba(245,158,11,0.9)", duration: 0.2 }, offT);
        tl.to("#mr-3-now", { opacity: 0, duration: 0.15 }, offT);
        tl.fromTo("#mr-3-off", { opacity: 0 }, { opacity: 1, duration: 0.2 }, offT + 0.1);
        tl.to(counter, { n: 11, duration: 0.05, onUpdate: () => { document.getElementById("mon-n").textContent = Math.round(counter.n); } }, offT + 0.2);
        tl.fromTo("#mon-toast", { opacity: 0, y: 40, scale: 0.96 }, { opacity: 1, y: 0, scale: 1, duration: 0.5, ease: "back.out(1.8)" }, offT + 0.2);
        out("#monitor-in", "monitor");
      }

      /* ai */
      {
        const a = S("ai");
        const p2 = wordAt("ai", "mira") - 0.2;
        const p3 = wordAt("ai", "sugiere") - 0.45;
        tl.fromTo("#ai-h1", { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 0.5, ease: "power3.out" }, a + 0.05);
        tl.fromTo("#ai-prompt", { opacity: 0, x: -60 }, { opacity: 1, x: 0, duration: 0.55, ease: "power3.out" }, a + 0.1);
        const prompt = "Promo de café con 20% off, estética cálida";
        const typing = { i: 0 };
        tl.to(typing, { i: prompt.length, duration: 1.2, ease: "none", onUpdate: () => { document.getElementById("ai-typed").textContent = prompt.slice(0, Math.round(typing.i)); } }, a + 0.3);
        T.beats.filter((b) => b >= a && b < p2).forEach((b) => tl.fromTo("#ai-caret", { opacity: 1 }, { opacity: 0.1, duration: T.beatLength * 0.8 }, b));
        tl.fromTo("#ai-gen", { opacity: 0, scale: 0.9 }, { opacity: 1, scale: 1, duration: 0.5, ease: "power3.out" }, a + 1.4);
        tl.fromTo("#ai-scan", { y: -160 }, { y: 720, duration: 1.0, ease: "power1.inOut" }, a + 1.6);
        tl.fromTo("#ai-gen-mask", { clipPath: "inset(0% 0 0 0)" }, { clipPath: "inset(100% 0 0 0)", duration: 1.0, ease: "power1.inOut" }, a + 1.6);
        ["#st-1", "#st-2", "#st-3"].forEach((s, i) => tl.fromTo(s, { y: 30, opacity: 0 }, { y: -40, opacity: 0.9, duration: 1.6, repeat: 2, ease: "sine.out" }, a + 2.0 + i * 0.25));
        tl.fromTo("#ai-badge", { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.4, ease: "back.out(2)" }, wordAt("ai", "segundos"));
        tl.to("#ai-p1", { opacity: 0, x: -80, duration: 0.3, ease: "power2.in" }, p2 - 0.3);
        tl.fromTo("#ai-h2", { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 0.5, ease: "power3.out" }, p2);
        tl.fromTo("#ai-radar", { opacity: 0, scale: 0.6 }, { opacity: 1, scale: 1, duration: 0.6, ease: "power3.out" }, p2);
        tl.fromTo("#radar-sweep", { rotate: 0 }, { rotate: 720, duration: p3 - p2 + 0.4, ease: "none" }, p2);
        [["#cx-1", "clima"], ["#cx-2", "feriados"], ["#cx-3", "competidores"]].forEach(([c, w]) => tl.fromTo(c, { opacity: 0, x: -50 }, { opacity: 1, x: 0, duration: 0.4, ease: "back.out(1.8)" }, wordAt("ai", w) - 0.1));
        ["#pin-1", "#pin-2", "#pin-3"].forEach((p, i) => tl.fromTo(p, { opacity: 0, scale: 0 }, { opacity: 1, scale: 1, duration: 0.35, ease: "back.out(3)" }, wordAt("ai", "competidores") + i * T.beatLength / 2));
        tl.to("#ai-p2", { opacity: 0, scale: 0.96, duration: 0.3, ease: "power2.in" }, p3 - 0.3);
        tl.fromTo("#ai-sug", { opacity: 0, y: 80, scale: 0.94 }, { opacity: 1, y: 0, scale: 1, duration: 0.6, ease: "back.out(1.4)" }, p3);
        const activate = T.beats.find((b) => b > wordAt("ai", "mostrar") + 1.2);
        tl.to("#sug-btn", { scale: 0.92, duration: 0.1 }, activate);
        tl.to("#sug-btn", { scale: 1, duration: 0.4, ease: "back.out(3)" }, activate + 0.1);
        tl.fromTo("#ai-sug", { borderColor: "rgba(56,189,248,0.35)" }, { borderColor: "rgba(52,211,153,0.8)", duration: 0.3 }, activate + 0.1);
        tl.fromTo("#sug-btn", { backgroundImage: "linear-gradient(180deg, #38bdf8, #0284c7)" }, { backgroundImage: "linear-gradient(180deg, #34d399, #0d9488)", duration: 0.2 }, activate + 0.1);
        tl.to("#sug-a", { opacity: 0, duration: 0.15 }, activate + 0.1);
        tl.fromTo("#sug-b", { opacity: 0 }, { opacity: 1, duration: 0.2 }, activate + 0.15);
        out("#ai-in", "ai");
      }

      /* devices */
      {
        const d = S("devices");
        const counterAt = wordAt("devices", "counter") - 0.3;
        const offAt = wordAt("devices", "corta") - 0.6;
        const galAt = T.beats.find((b) => b > wordAt("devices", "reproduciendo") + 0.9);
        tl.fromTo("#dev-core-glow", { opacity: 0, scale: 0.6 }, { opacity: 1, scale: 1, duration: 1.2, ease: "power2.out" }, d);
        tl.fromTo("#dev-core", { opacity: 0, y: 80, rotate: -6, scale: 0.9 }, { opacity: 1, y: 0, rotate: -2, scale: 1, duration: 1.1, ease: "power3.out" }, d + 0.1);
        tl.fromTo("#dev-core", { y: 0 }, { y: -18, duration: counterAt - d, ease: "sine.inOut", immediateRender: false }, d + 1.2);
        tl.fromTo("#dv-1c", { opacity: 0, x: -50 }, { opacity: 1, x: 0, duration: 0.7, ease: "power3.out" }, wordAt("devices", "core") - 0.3);
        tl.to("#dv-1", { opacity: 0, x: -100, duration: 0.4, ease: "power2.in" }, counterAt - 0.35);
        tl.fromTo("#dev-counter-glow", { opacity: 0, scale: 0.6 }, { opacity: 1, scale: 1, duration: 1.0, ease: "power2.out" }, counterAt);
        tl.fromTo("#dev-counter", { opacity: 0, x: 120, scale: 1.08 }, { opacity: 1, x: 0, scale: 1, duration: 0.8, ease: "power3.out" }, counterAt);
        tl.fromTo("#dev-counter", { scale: 1 }, { scale: 1.05, duration: offAt - counterAt, ease: "none", immediateRender: false }, counterAt + 0.8);
        tl.fromTo("#dv-2c", { opacity: 0, x: -50 }, { opacity: 1, x: 0, duration: 0.7, ease: "power3.out" }, counterAt + 0.15);
        tl.to("#dv-2", { opacity: 0, x: -100, duration: 0.4, ease: "power2.in" }, offAt - 0.35);
        tl.fromTo("#dev-off-tv", { opacity: 0, scale: 0.9 }, { opacity: 1, scale: 1, duration: 0.6, ease: "power3.out" }, offAt);
        tl.fromTo("#dev-wifi", { opacity: 0, scale: 0 }, { opacity: 1, scale: 1, duration: 0.4, ease: "back.out(3)" }, wordAt("devices", "internet") - 0.2);
        tl.fromTo("#dev-off-copy", { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 0.6, ease: "power3.out" }, wordAt("devices", "siguen") - 0.2);
        tl.fromTo("#dev-off-tv .tv-face", { backgroundPosition: "50% 40%" }, { backgroundPosition: "50% 60%", duration: galAt - offAt, ease: "none" }, offAt);
        tl.to("#dv-3", { opacity: 0, scale: 1.05, duration: 0.35, ease: "power2.in" }, galAt - 0.35);
        ["#gal-1", "#gal-2", "#gal-3", "#gal-4"].forEach((g, i) => tl.fromTo(g, { opacity: 0, y: 60, scale: 0.94 }, { opacity: 1, y: 0, scale: 1, duration: 0.5, ease: "power3.out" }, galAt + i * T.beatLength));
        ["#gi-1", "#gi-2", "#gi-3", "#gi-4"].forEach((g, i) => tl.fromTo(g, { scale: 1.12 }, { scale: 1, duration: E("devices") - galAt, ease: "none" }, galAt + i * T.beatLength));
        tl.fromTo("#gal-cap", { opacity: 0 }, { opacity: 1, duration: 0.5 }, galAt + 4 * T.beatLength);
        out("#devices-in", "devices");
      }

      /* cta */
      {
        const c = S("cta");
        tl.fromTo("#cta-logo", { opacity: 0, scale: 0.85, filter: "blur(14px)" }, { opacity: 1, scale: 1, filter: "blur(0px)", duration: 0.9, ease: "expo.out" }, c);
        tl.fromTo("#cta-tag", { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 0.7, ease: "power3.out" }, wordAt("cta", "cada") - 0.1);
        tl.fromTo("#cta-row", { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 0.6, ease: "power3.out" }, wordAt("cta", "cotizacion") - 0.4);
        tl.fromTo("#cta-btn", { boxShadow: "0 10px 40px rgba(14,165,233,0.45)" }, { boxShadow: "0 10px 80px rgba(14,165,233,0.9)", duration: T.beatLength, yoyo: true, repeat: 5, ease: "sine.inOut" }, wordAt("cta", "web"));
        tl.to("#cta-in", { opacity: 0, duration: 1.2, ease: "power2.in" }, E("cta") - 1.3);
        tl.to("#hud", { opacity: 0, duration: 1.0 }, E("cta") - 1.2);
      }

      window.__timelines["presentacion"] = tl;
    </script>
  </body>
</html>
