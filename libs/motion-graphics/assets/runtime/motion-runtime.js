window.createMotionRuntime = function createMotionRuntime(T, W, compositionId) {
  const tl = gsap.timeline({ paused: true });
  const root = document.getElementById('root');
  const scenes = new Map(T.scenes.map((s) => [s.id, s]));
  const S = (id) => scenes.get(id).start;
  const E = (id) => scenes.get(id).end;
  const L = T.beatLength || 0.5;
  const token = (name) => getComputedStyle(root).getPropertyValue(name).trim();
  const ACCENT = token('--mg-accent') || '#0ea5e9';
  const ACCENT_SOFT = token('--mg-accent-soft') || 'rgba(14,165,233,0.18)';
  const GLOW = token('--mg-glow') || '0 10px 80px rgba(14,165,233,0.9)';
  const plain = (text) => String(text).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');

  const wordAt = (id, prefix) => {
    const slot = scenes.get(id);
    const wanted = plain(prefix);
    const found = (W[id] || []).find((w) => plain(w.w).startsWith(wanted));
    if (found) return slot.voStart + found.t;
    const scriptWords = String(slot.vo || '').split(/\s+/).map(plain).filter(Boolean);
    const index = scriptWords.findIndex((w) => w.startsWith(wanted));
    return slot.voStart + (index < 0 ? 0 : (slot.voDuration * index) / Math.max(1, scriptWords.length));
  };
  const beatFrom = (t, n) => {
    const after = T.beats.filter((b) => b >= t - 1e-3);
    return after[Math.max(0, n)] ?? t;
  };

  const UI_LEAD = 0.9;
  const UI_TAIL = 1.4;
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

  const timeFor = (el, id, order) => {
    const start = S(id);
    if (el.dataset.cue) return Math.max(start + 0.05, wordAt(id, el.dataset.cue) - 0.12);
    if (el.dataset.at) return start + Number(el.dataset.at);
    if (el.dataset.slot !== undefined) return start + UI_LEAD + (Math.max(1, E(id) - start - UI_LEAD - UI_TAIL) * Number(el.dataset.slot)) / Math.max(1, Number(el.dataset.count));
    if (el.dataset.beat) return beatFrom(start, Number(el.dataset.beat));
    return start + 0.15 + order * (L / 2);
  };

  const dur = (el, fallback) => (el.dataset.dur ? Number(el.dataset.dur) : fallback);
  const sceneLength = (id) => E(id) - S(id);

  const nextUiStepTime = (el, id) => {
    let next = el.nextElementSibling;
    while (next && !next.hasAttribute('data-ui-step')) next = next.nextElementSibling;
    return next ? timeFor(next, id, 0) : null;
  };
  const nextUiZoomTime = (el, id) => {
    let next = el.nextElementSibling;
    while (next && next.dataset.uiStep !== 'zoom') next = next.nextElementSibling;
    return next ? timeFor(next, id, 0) : null;
  };
  const uiZoomHoldEnd = (el, id, t) => Math.max(t + 1.7, Math.min(E(id) - 0.5, nextUiZoomTime(el, id) ?? E(id)) - 0.35);
  const uiHoldEnd = (el, id, t, fallbackHold) => Math.min(E(id) - 0.5, Math.max(t + 0.9, nextUiStepTime(el, id) ?? t + fallbackHold));
  const uiRest = { scale: 1, xPercent: 0, yPercent: 0 };
  const uiFocus = ({ scale, cx, cy }) => ({ scale, xPercent: clamp((0.5 - scale * cx) * 100, (1 - scale) * 100, 0), yPercent: clamp((0.5 - scale * cy) * 100, (1 - scale) * 100, 0) });

  const ANIMS = {
    rise: (el, t) => tl.fromTo(el, { opacity: 0, y: 46 }, { opacity: 1, y: 0, duration: dur(el, 0.6), ease: 'power3.out' }, t),
    left: (el, t) => tl.fromTo(el, { opacity: 0, x: -70 }, { opacity: 1, x: 0, duration: dur(el, 0.65), ease: 'power3.out' }, t),
    right: (el, t) => tl.fromTo(el, { opacity: 0, x: 90 }, { opacity: 1, x: 0, duration: dur(el, 0.7), ease: 'power3.out' }, t),
    pop: (el, t) => tl.fromTo(el, { opacity: 0, scale: 0.6 }, { opacity: 1, scale: 1, duration: dur(el, 0.45), ease: 'back.out(2.2)' }, t),
    fade: (el, t) => tl.fromTo(el, { opacity: 0 }, { opacity: 1, duration: dur(el, 0.4) }, t),
    blur: (el, t) => tl.fromTo(el, { opacity: 0, scale: 1.22, filter: 'blur(16px)' }, { opacity: 1, scale: 1, filter: 'blur(0px)', duration: dur(el, 0.9), ease: 'expo.out' }, t),
    wipe: (el, t) => tl.fromTo(el, { opacity: 0, clipPath: 'inset(0 100% 0 0)' }, { opacity: 1, clipPath: 'inset(0 0% 0 0)', duration: dur(el, 0.55), ease: 'power3.inOut' }, t),
    'wipe-up': (el, t) => tl.fromTo(el, { opacity: 0, clipPath: 'inset(100% 0 0 0)' }, { opacity: 1, clipPath: 'inset(0% 0 0 0)', duration: dur(el, 0.6), ease: 'power3.inOut' }, t),
    swap: (el, t) => tl.fromTo(el, { opacity: 0 }, { opacity: 1, duration: dur(el, 0.3) }, t),
    hide: (el, t) => tl.fromTo(el, { opacity: 1 }, { opacity: 0, duration: dur(el, 0.25), immediateRender: false }, t),
    strike: (el, t) => tl.fromTo(el, { scaleX: 0 }, { scaleX: 1, duration: dur(el, 0.25), ease: 'power3.out' }, t),
    dim: (el, t) => tl.fromTo(el, { opacity: 1 }, { opacity: 0.4, duration: dur(el, 0.3), immediateRender: false }, t),
    draw: (el, t) => tl.fromTo(el, { strokeDasharray: 1, strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: dur(el, 0.7), ease: 'power2.inOut' }, t),
    ring: (el, t) => tl.fromTo(el, { strokeDasharray: '0 1' }, { strokeDasharray: '1 0', duration: dur(el, 2), ease: 'none' }, t),
    press: (el, t) => {
      tl.to(el, { scale: 0.92, duration: 0.1, ease: 'power2.in' }, t);
      tl.to(el, { scale: 1, duration: 0.35, ease: 'back.out(3)' }, t + 0.1);
    },
    tap: (el, t) => {
      tl.fromTo(el, { opacity: 0, scale: 0.4 }, { opacity: 1, scale: 1, duration: 0.2 }, t);
      tl.to(el, { opacity: 0, scale: 1.7, duration: 0.4 }, t + 0.25);
    },
    select: (el, t) => tl.to(el, { borderColor: ACCENT, backgroundColor: ACCENT_SOFT, duration: 0.25 }, t),
    glow: (el, t) => tl.fromTo(el, { boxShadow: '0 0 0 rgba(0,0,0,0)' }, { boxShadow: GLOW, duration: L, yoyo: true, repeat: 5, ease: 'sine.inOut' }, t),
    shake: (el, t) => tl.fromTo(el, { x: 0 }, { x: 10, duration: 0.05, yoyo: true, repeat: 5, ease: 'none' }, t),
    float: (el, t, id) => tl.fromTo(el, { y: 0 }, { y: -16, duration: Math.max(1, sceneLength(id) - (t - S(id))), ease: 'sine.inOut', immediateRender: false }, t),
    kenburns: (el, t, id) => tl.fromTo(el, { scale: 1.14 }, { scale: 1, duration: Math.max(1, E(id) - t), ease: 'none' }, t),
    sweep: (el, t, id) => tl.fromTo(el, { rotate: 0 }, { rotate: 720, duration: Math.max(1, E(id) - t), ease: 'none' }, t),
    scroll: (el, t, id) => tl.fromTo(el, { objectPosition: '50% 0%' }, { objectPosition: '50% 80%', duration: Math.max(1, E(id) - t - 0.6), ease: 'sine.inOut' }, t),
    drive: (el, t) => tl.fromTo(el, { x: -520, opacity: 0 }, { x: 0, opacity: 1, duration: dur(el, 1.6), ease: 'power2.out' }, t),
    spin: (el, t) => tl.fromTo(el, { rotation: 0 }, { rotation: 900, transformOrigin: '50% 50%', duration: dur(el, 1.6), ease: 'power2.out' }, t),
    shackle: (el, t) => tl.fromTo(el, { y: -22 }, { y: 0, duration: dur(el, 0.35), ease: 'back.in(2)' }, t),
    advance: (el, t) => {
      const step = Number(el.dataset.step || 200);
      tl.to(el, { x: step, duration: 0.55, ease: 'power3.inOut' }, t);
      tl.to(el, { x: step * 2, duration: 0.55, ease: 'power3.inOut' }, t + 0.9);
    },
    type: (el, t) => {
      const text = el.dataset.text || '';
      const state = { i: 0 };
      el.textContent = '';
      tl.to(state, { i: text.length, duration: dur(el, Math.min(1.6, 0.04 * text.length + 0.3)), ease: 'none', onUpdate: () => { el.textContent = text.slice(0, Math.round(state.i)); } }, t);
    },
    dots: (el, t) => {
      const count = Number(el.dataset.count || 9);
      const state = { i: 0 };
      el.textContent = '';
      tl.to(state, { i: count, duration: dur(el, 0.9), ease: 'none', onUpdate: () => { el.textContent = '•'.repeat(Math.round(state.i)); } }, t);
    },
    count: (el, t) => {
      const from = Number(el.dataset.from || 0);
      const to = Number(el.dataset.to || 0);
      const state = { n: from };
      el.textContent = String(from);
      tl.to(state, { n: to, duration: dur(el, 1.3), ease: 'power2.out', onUpdate: () => { el.textContent = String(Math.round(state.n)); } }, t);
    },
    'ui-mark': () => undefined,
    'ui-click': (el, t) => {
      tl.fromTo(el, { opacity: 0, scale: 0.25 }, { opacity: 1, scale: 1, duration: 0.18, ease: 'power2.out' }, t);
      tl.to(el, { opacity: 0, scale: 1.3, duration: 0.45, ease: 'power1.out' }, t + 0.18);
    },
    'ui-type': (el, t) => {
      const text = el.dataset.text || '';
      const target = el.firstElementChild;
      const state = { i: 0 };
      target.textContent = '';
      tl.fromTo(el, { opacity: 0 }, { opacity: 1, duration: 0.2 }, t);
      tl.to(state, { i: text.length, duration: Math.min(2.4, 0.06 * text.length + 0.3), ease: 'none', onUpdate: () => { target.textContent = text.slice(0, Math.round(state.i)); } }, t + 0.2);
    },
    'ui-highlight': (el, t, id) => {
      tl.fromTo(el, { opacity: 0, scale: 1.04 }, { opacity: 1, scale: 1, duration: 0.35, ease: 'power2.out' }, t);
      tl.to(el, { opacity: 0, duration: 0.3 }, uiHoldEnd(el, id, t, 2.4));
    },
    'ui-callout': (el, t, id) => {
      tl.fromTo(el, { opacity: 0, scale: 0.8, y: 10 }, { opacity: 1, scale: 1, y: 0, duration: 0.35, ease: 'back.out(2)' }, t);
      tl.to(el, { opacity: 0, duration: 0.3 }, uiHoldEnd(el, id, t, 3));
    },
    'ui-zoom': (el, t, id) => {
      const zoom = el.closest('.mg-ui-zoom');
      const focus = uiFocus({ scale: Number(el.dataset.scale), cx: Number(el.dataset.cx), cy: Number(el.dataset.cy) });
      tl.fromTo(zoom, uiRest, { ...focus, duration: 0.8, ease: 'power2.inOut', immediateRender: false }, t);
      tl.fromTo(zoom, focus, { ...uiRest, duration: 0.7, ease: 'power2.inOut', immediateRender: false }, uiZoomHoldEnd(el, id, t));
    },
    'ui-autocamera': (el, t, id) => {
      const zoom = el.closest('.mg-ui-zoom');
      const scene = el.closest('[data-scene]');
      const bodies = Array.from(scene.querySelectorAll('.mg-ui-bubble-body'));
      const anchors = Array.from(scene.querySelectorAll('.mg-ui-anchor'));
      const pin = scene.querySelector('.mg-ui-pin');
      const keyframes = Array.from(scene.querySelectorAll('[data-cam-scale]'))
        .map((step) => ({ t: timeFor(step, id, 0), scale: Number(step.dataset.camScale), cx: Number(step.dataset.camCx), cy: Number(step.dataset.camCy) }))
        .sort((a, b) => a.t - b.t)
        .filter((frame, i, all) => i === 0 || frame.scale !== all[i - 1].scale || frame.cx !== all[i - 1].cx || frame.cy !== all[i - 1].cy);
      let previous = { scale: 1, cx: 0.5, cy: 0.5 };
      let previousArrival = S(id) + 0.3;
      keyframes.forEach((frame) => {
        const arrival = Math.max(previousArrival + 0.3, frame.t - 0.12);
        const start = Math.max(previousArrival + 0.05, arrival - 0.75);
        const duration = arrival - start;
        const timing = { duration, ease: 'power2.inOut', immediateRender: false };
        tl.fromTo(zoom, uiFocus(previous), { ...uiFocus(frame), ...timing }, start);
        bodies.forEach((body) => tl.fromTo(body, { scale: 1 / previous.scale }, { scale: 1 / frame.scale, ...timing }, start));
        anchors.forEach((anchor) => tl.fromTo(anchor, { '--mg-inv': 1 / previous.scale }, { '--mg-inv': 1 / frame.scale, ...timing }, start));
        if (pin) tl.fromTo(pin, { scale: 1 / previous.scale }, { scale: 1 / frame.scale, ...timing }, start);
        previous = frame;
        previousArrival = arrival;
      });
    },
    'ui-cursor': (el, t, id) => {
      const waypoints = Array.from(el.closest('[data-scene]').querySelectorAll('[data-ui-step][data-px]'))
        .map((step) => ({ t: timeFor(step, id, 0), x: Number(step.dataset.px), y: Number(step.dataset.py), click: step.dataset.uiStep === 'click' }))
        .sort((a, b) => a.t - b.t);
      if (!waypoints.length) return;
      const arrow = el.querySelector('.mg-ui-cursor');
      const first = waypoints[0];
      let previous = { x: clamp(first.x - 0.14, 0, 1), y: clamp(first.y + 0.14, 0, 1), t: first.t - 0.9 };
      gsap.set(el, { xPercent: previous.x * 100, yPercent: previous.y * 100 });
      tl.fromTo(el, { opacity: 0 }, { opacity: 1, duration: 0.25 }, Math.max(S(id) + 0.05, first.t - 0.9));
      waypoints.forEach((point) => {
        const travelStart = Math.max(previous.t + 0.12, point.t - 0.75, S(id) + 0.05);
        tl.fromTo(el, { xPercent: previous.x * 100, yPercent: previous.y * 100 }, { xPercent: point.x * 100, yPercent: point.y * 100, duration: Math.max(0.12, point.t - travelStart), ease: 'power2.inOut', immediateRender: false }, travelStart);
        if (point.click) {
          tl.to(arrow, { scale: 0.8, duration: 0.08, ease: 'power2.in' }, point.t);
          tl.to(arrow, { scale: 1, duration: 0.2, ease: 'back.out(3)' }, point.t + 0.08);
        }
        previous = point;
      });
    },
    seq: (el, t) => {
      const items = Array.from(el.children);
      const step = dur(el, 3) / items.length;
      items.forEach((child, i) => {
        tl.fromTo(child, { opacity: 0 }, { opacity: 1, duration: 0.04 }, t + i * step);
        if (i < items.length - 1) tl.to(child, { opacity: 0, duration: 0.04 }, t + (i + 1) * step);
      });
    },
  };

  const curve = (a, b, vertical) => {
    if (vertical) {
      const my = (a.y + b.y) / 2;
      return `M${a.x} ${a.y} C ${a.x} ${my}, ${b.x} ${my}, ${b.x} ${b.y}`;
    }
    const mx = (a.x + b.x) / 2;
    return `M${a.x} ${a.y} C ${mx} ${a.y}, ${mx} ${b.y}, ${b.x} ${b.y}`;
  };
  const anchorPoint = (el, side, base) => {
    const r = el.getBoundingClientRect();
    const x = r.left - base.left;
    const y = r.top - base.top;
    if (side === 'right') return { x: x + r.width, y: y + r.height / 2 };
    if (side === 'left') return { x, y: y + r.height / 2 };
    if (side === 'top') return { x: x + r.width / 2, y };
    if (side === 'bottom') return { x: x + r.width / 2, y: y + r.height };
    return { x: x + r.width / 2, y: y + r.height / 2 };
  };
  const drawLinks = () => {
    const vertical = root.classList.contains('fmt-9x16');
    document.querySelectorAll('svg[data-links]').forEach((svg) => {
      const scope = svg.closest('.scene-in');
      const base = svg.getBoundingClientRect();
      svg.querySelectorAll('path[data-from]').forEach((path) => {
        const from = scope.querySelector(path.dataset.from);
        const to = scope.querySelector(path.dataset.to);
        if (!from || !to) return;
        const a = anchorPoint(from, vertical ? 'bottom' : path.dataset.fromSide || 'right', base);
        const b = anchorPoint(to, vertical ? 'top' : path.dataset.toSide || 'left', base);
        path.setAttribute('d', curve(a, b, vertical));
      });
    });
  };

  document.querySelectorAll('[data-scene]').forEach((section) => {
    section.style.visibility = 'hidden';
    section.style.display = 'block';
  });
  drawLinks();
  document.querySelectorAll('[data-scene]').forEach((section) => {
    section.style.visibility = '';
    section.style.display = '';
  });

  tl.fromTo('#mg-progress', { scaleX: 0 }, { scaleX: 1, duration: T.duration, ease: 'none' }, 0);
  tl.fromTo('#mg-glow-a', { x: 0, y: 0 }, { x: 420, y: 160, duration: T.duration, ease: 'sine.inOut' }, 0);
  tl.fromTo('#mg-glow-b', { x: 0, y: 0 }, { x: -380, y: -120, duration: T.duration, ease: 'sine.inOut' }, 0);
  tl.fromTo('#mg-dots', { x: 0, y: 0 }, { x: -68, y: -34, duration: T.duration, ease: 'none' }, 0);
  const ticks = Array.from(document.querySelectorAll('#mg-ticks i'));
  T.beats.forEach((b, i) => {
    if (ticks.length) tl.fromTo(ticks[i % ticks.length], { backgroundColor: ACCENT, scale: 1.35 }, { backgroundColor: 'rgba(255,255,255,0.18)', scale: 1, duration: L * 0.9, ease: 'power2.out' }, b);
    if (i % 4 === 0) tl.fromTo('#mg-glow-a', { opacity: 1, scale: 1.07 }, { opacity: 0.78, scale: 1, duration: L * 3, ease: 'power2.out' }, b);
  });

  const chapterHost = document.getElementById('mg-chapter');
  const chapters = Array.from(document.querySelectorAll('[data-scene][data-chapter]')).map((section) => ({ ...scenes.get(section.dataset.scene), chapter: section.dataset.chapter }));
  const chapterStops = Array.from(document.querySelectorAll('[data-scene][data-chapter-end]')).map((section) => scenes.get(section.dataset.scene).start);
  chapters.forEach((s, i) => {
    const el = document.createElement('div');
    el.className = 'mg-chap mg-label';
    const number = document.createElement('span');
    number.className = 'mg-chap-n';
    number.textContent = String(i + 1).padStart(2, '0');
    const label = document.createElement('span');
    label.textContent = s.chapter;
    el.append(number, label);
    chapterHost.appendChild(el);
    const ends = [chapters[i + 1]?.start, ...chapterStops.filter((t) => t > s.start)].filter((t) => t !== undefined);
    tl.fromTo(el, { opacity: 0, x: 16 }, { opacity: 1, x: 0, duration: 0.3, ease: 'power3.out' }, Math.max(0.3, s.start + 0.02));
    if (ends.length) tl.to(el, { opacity: 0, x: -16, duration: 0.18, ease: 'power2.in' }, Math.min(...ends) - 0.18);
  });

  tl.fromTo('#mg-bug', { opacity: 0, y: -10 }, { opacity: 1, y: 0, duration: 0.5, ease: 'power3.out' }, 0.3);

  document.querySelectorAll('[data-scene]').forEach((section) => {
    const id = section.dataset.scene;
    let order = 0;
    section.querySelectorAll('[data-anim]').forEach((el) => {
      const timed = el.dataset.cue || el.dataset.at || el.dataset.beat || el.dataset.slot;
      const t = timeFor(el, id, timed ? 0 : order) + Number(el.dataset.after || 0);
      if (!timed && !el.dataset.parallel) order += 1;
      el.dataset.anim.split(' ').forEach((name) => ANIMS[name] && ANIMS[name](el, t, id));
    });
    if (section.dataset.flash) {
      tl.fromTo('#mg-flash', { opacity: 0 }, { opacity: 0.85, duration: 0.06 }, S(id));
      tl.to('#mg-flash', { opacity: 0, duration: 0.9, ease: 'power2.out' }, S(id) + 0.06);
    }
    const inner = section.querySelector('.scene-in');
    const isLast = T.scenes[T.scenes.length - 1].id === id;
    if (isLast) tl.to(inner, { opacity: 0, duration: 1.1, ease: 'power2.in' }, E(id) - 1.2);
    else tl.to(inner, { opacity: 0, y: -24, filter: 'blur(8px)', duration: 0.35, ease: 'power2.in' }, E(id) - 0.35);
  });
  tl.to('#mg-hud', { opacity: 0, duration: 1 }, T.duration - 1.2);

  window.__timelines[compositionId] = tl;
  return tl;
};
