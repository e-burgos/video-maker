window.createDisplayAdsKit = function createDisplayAdsKit(T, W, chapters) {
  const tl = gsap.timeline({ paused: true });
  const scene = (id) => T.scenes.find((s) => s.id === id);
  const S = (id) => scene(id).start;
  const E = (id) => scene(id).end;
  const plain = (text) => text.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/g, "");
  const wordAt = (id, prefix) => {
    const slot = scene(id);
    const found = (W[id] || []).find((w) => plain(w.w).startsWith(plain(prefix)));
    if (found) return slot.voStart + found.t;
    const scriptWords = (slot.vo || "").split(/\s+/).map(plain).filter(Boolean);
    const index = scriptWords.findIndex((w) => w.startsWith(plain(prefix)));
    console.warn(`motion-studio: "${prefix}" no aparece en la voz de ${id}; se estima por su posición en el guion`);
    return slot.voStart + (index < 0 ? 0 : (slot.voDuration * index) / Math.max(1, scriptWords.length));
  };
  const beatAfter = (t) => T.beats.find((b) => b >= t) ?? t;
  const enter = (sel, at, from = { y: 40 }) => tl.fromTo(sel, { opacity: 0, ...from }, { opacity: 1, x: 0, y: 0, scale: 1, duration: 0.6, ease: "power3.out" }, at);
  const leave = (sel, id, dur = 0.35) => tl.to(sel, { opacity: 0, y: -24, filter: "blur(8px)", duration: dur, ease: "power2.in" }, E(id) - dur);

  tl.fromTo("#progress", { scaleX: 0 }, { scaleX: 1, duration: T.duration, ease: "none" }, 0);
  tl.fromTo("#glow-a", { x: 0, y: 0 }, { x: 420, y: 160, duration: T.duration, ease: "sine.inOut" }, 0);
  tl.fromTo("#glow-b", { x: 0, y: 0 }, { x: -380, y: -120, duration: T.duration, ease: "sine.inOut" }, 0);
  tl.fromTo("#dots", { x: 0, y: 0 }, { x: -68, y: -34, duration: T.duration, ease: "none" }, 0);

  const ticks = gsap.utils.toArray("#beat-ticks i");
  T.beats.forEach((b, i) => {
    tl.fromTo(ticks[i % 4], { backgroundColor: "#38bdf8", scale: 1.35 }, { backgroundColor: "rgba(255,255,255,0.18)", scale: 1, duration: T.beatLength * 0.9, ease: "power2.out" }, b);
    if (i % 4 === 0) tl.fromTo("#glow-a", { opacity: 1, scale: 1.06 }, { opacity: 0.8, scale: 1, duration: T.beatLength * 3, ease: "power2.out" }, b);
  });

  const holder = document.getElementById("chapter");
  chapters.forEach(([id, n, label], i) => {
    const el = document.createElement("div");
    el.className = "chap da-label";
    el.innerHTML = `<span class="num">${n}</span><span>${label}</span>`;
    holder.appendChild(el);
    const next = chapters[i + 1];
    tl.fromTo(el, { opacity: 0, x: 16 }, { opacity: 1, x: 0, duration: 0.3, ease: "power3.out" }, i === 0 ? 0.3 : S(id) + 0.02);
    if (next) tl.to(el, { opacity: 0, x: -16, duration: 0.18, ease: "power2.in" }, S(next[0]) - 0.18);
  });

  tl.fromTo("#bug", { opacity: 0, y: -10 }, { opacity: 1, y: 0, duration: 0.5, ease: "power3.out" }, 0.2);
  tl.to("#hud", { opacity: 0, duration: 1.0 }, T.duration - 1.2);

  return { tl, S, E, wordAt, beatAfter, enter, leave };
};
