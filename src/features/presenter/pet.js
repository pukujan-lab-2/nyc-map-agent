// Position and speech are separate from the tour state. The pet never takes input away from a control.
export function createPet(root, signal) {
  const moon = root.querySelector("#pet");
  const main = root.querySelector("main");
  const bubble = document.createElement("div");
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const pointer = { x: -1000, y: -1000, until: 0 };
  const reaction = { x: 0, y: 0, until: 0, mood: "" };
  const pos = { x: 0, y: 0, lean: 0 };
  const clamp = (v, min, max) => Math.min(Math.max(min, v), Math.max(min, max));
  let geometry;
  let target;
  let speech;
  let box = { width: 0, height: 0 };
  let positioned = false;

  moon.classList.add("baker-pet");
  bubble.className = "baker-bubble";
  bubble.setAttribute("aria-hidden", "true");
  moon.after(bubble);

  function intersect(a, b) {
    if (!b) return 0;
    return Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left))
      * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
  }

  function refresh() {
    const rect = main.getBoundingClientRect();
    const visual = main.querySelector(".frame");
    const focus = target?.isConnected ? target.getBoundingClientRect() : visual?.getBoundingClientRect();
    const minX = Math.max(rect.left, 0) + 7;
    const maxX = Math.min(rect.right, innerWidth) - 7;
    const isGuiding = root.hasAttribute("data-moon-guiding");
    const minY = (isGuiding ? 0 : Math.max(rect.top, 0)) + 6;
    const maxY = (isGuiding ? innerHeight : Math.min(rect.bottom, innerHeight)) - 6;
    const size = moon.offsetWidth;
    const canvas = visual?.getBoundingClientRect();
    const subject = focus || canvas || rect;
    const protectedRects = Array.from(main.querySelectorAll(".intro h1, button, input, .corner, .mission, .qr-card, .street-invite, .route-title")).map((item) => item.getBoundingClientRect());
    const places = [
      [subject.left - size - 5, subject.top + 25],
      [subject.right + 5, subject.top + 18],
      [subject.right - size - 9, subject.top - size - 5],
      [subject.right - size - 10, subject.bottom + 6],
      [subject.left + 8, subject.top + 8],
      [subject.right - size - 8, subject.top + 8],
    ];
    const ranked = places.map(([left, top], index) => {
      const x = clamp(left, minX, maxX - size);
      const y = clamp(top, minY, maxY - size);
      const shape = { left: x, top: y, right: x + size, bottom: y + size };
      const controlOverlap = protectedRects.reduce((sum, area) => sum + intersect(shape, area), 0);
      const overlap = intersect(shape, subject) * 1.6 + intersect(shape, canvas) * .6;
      return { x, y, score: Math.abs(x - left) + Math.abs(y - top) + (controlOverlap * 8 + overlap) / 30 + index * 3 };
    });
    ranked.sort((a, b) => a.score - b.score);
    geometry = { x: ranked[0].x, y: ranked[0].y, size, minX, maxX, minY, maxY, subject, protectedRects };
    if (!positioned) {
      const mobile = innerWidth <= 700;
      pos.x = mobile ? geometry.x : clamp(geometry.x + 45, minX, maxX - size);
      pos.y = clamp(geometry.y + 16, minY, maxY - size);
      positioned = true;
    }
  }

  function aim(element, pulse = false) {
    if (!element?.getClientRects().length) return;
    target = element;
    refresh();
    if (!pulse) return;
    element.classList.remove("flash");
    void element.offsetWidth;
    element.classList.add("flash");
  }

  function phrases(text) {
    const words = text.trim().match(/\S+/g) || [];
    const parts = [];
    let chunk = [];
    for (const word of words) {
      if(chunk.length >= 4 && /^(and|then|but|so)$/i.test(word)){parts.push(chunk.join(" "));chunk=[];}
      chunk.push(word);
      const punctuation = /[,.?!…]$/.test(word) && !/^\d+(\.\d+)*[,.]$/.test(word);
      if (chunk.length === 7 || (punctuation && chunk.length >= 3)) {
        parts.push(chunk.join(" "));
        chunk = [];
      }
    }
    if (chunk.length) parts.push(chunk.join(" "));
    return parts.map((value) => ({ value, weight: Math.max(3, value.split(" ").length) + (/[.?!…]$/.test(value) ? 1 : 0) }));
  }

  function renderPhrase(part) {
    if (bubble.textContent === part && bubble.hasAttribute("data-open")) return;
    bubble.textContent = part;
    bubble.setAttribute("data-open", "");
    box = { width: bubble.offsetWidth, height: bubble.offsetHeight };
  }

  function clear() {
    speech = undefined;
    bubble.removeAttribute("data-open");
  }

  // When the line finishes, the whole reply stays in the bubble, like a chat
  // bubble, until the next action clears it.
  function settle(current) {
    if (current.settled) return;
    current.settled = true;
    renderPhrase(current.parts.map((part) => part.value).join(" "));
  }

  function say(text, audioGetter) {
    if (typeof text !== "string" || !text.trim()) {
      clear();
      return;
    }
    const parts = phrases(text);
    const weight = parts.reduce((sum, part) => sum + part.weight, 0);
    speech = { parts, weight, audioGetter, start: performance.now(), usedAudio: false, seconds: 0 };
    renderPhrase(parts[0].value);
  }

  function updatePhrase(now) {
    if (!speech) return;
    const audio = typeof speech.audioGetter === "function" ? speech.audioGetter() : undefined;
    const elapsed = (now - speech.start) / 1000;
    if (audio && !audio.ended && Number.isFinite(audio.duration) && audio.duration > 0 && audio.currentTime > 0) {
      speech.usedAudio = true;
      speech.seconds = audio.currentTime;
    }
    if (audio?.ended && speech.usedAudio) {
      settle(speech);
      return;
    }
    const expectedDuration = Math.max(2.1, speech.weight / 2.75);
    const ratio = speech.usedAudio && audio
      ? speech.seconds / audio.duration
      : elapsed / expectedDuration;
    if (ratio >= 1) {
      settle(speech);
      return;
    }
    let time = ratio * speech.weight;
    for (const part of speech.parts) {
      time -= part.weight;
      if (time < 0) {
        renderPhrase(part.value);
        break;
      }
    }
  }

  function placeBubble(x, y) {
    const { minX, maxX, minY, maxY, size, subject, protectedRects } = geometry;
    const leftWays = [x + size * .3 - box.width, x + size * .7, x + size / 2 - box.width / 2];
    const choices = [];
    for (const below of [false, true]) {
      const intendedY = below ? y + size + 6 : y - box.height - 6;
      const top = clamp(intendedY, minY, maxY - box.height);
      for (const wanted of leftWays) {
        const left = clamp(wanted, minX, maxX - box.width);
        const rect = {left, top, right:left + box.width, bottom:top + box.height};
        const covered = protectedRects.reduce((sum, item) => sum + intersect(item, rect), 0);
        const edge = clamp(x + size / 2 - left, 8, box.width - 12);
        const score = Math.abs(top - intendedY) * 3 + Math.abs(left + edge - (x + size / 2))
          + covered / 15 + intersect(subject, rect) / 36;
        choices.push({ left, top, edge, below, score });
      }
    }
    choices.sort((a, b) => a.score - b.score);
    const { left, top, edge, below } = choices[0];
    bubble.style.transform = `translate3d(${left}px,${top}px,0)`;
    bubble.style.setProperty("--baker-tail-x", edge + "px");
    bubble.toggleAttribute("data-below", below);
  }

  function react(event, tapped = false) {
    if (reduced.matches || speech || moon.classList.contains("talk") || !geometry || !positioned) return;
    if (tapped && event.target instanceof Element && event.target.closest("a,button,input,textarea,video,iframe,select,summary")) return;
    if (!tapped && event.pointerType === "touch") return;
    const x = event.clientX - (pos.x + geometry.size / 2);
    const y = event.clientY - (pos.y + geometry.size / 2);
    const distance = Math.hypot(x, y);
    const radius = tapped ? 60 : 56;
    if (distance > radius) return;
    const force = tapped ? 27 : 8 + 18 * (1 - distance / radius);
    const angle = distance > 6 ? Math.atan2(y, x) : 0;
    reaction.x = -Math.cos(angle) * force;
    reaction.y = -Math.sin(angle) * force - (tapped ? 9 : 0);
    reaction.until = performance.now() + (tapped ? 600 : 360);
    reaction.mood = tapped ? "whee" : distance < 25 ? "surprised" : "wink";
  }

  window.addEventListener("pointermove", (event) => {
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    pointer.until = performance.now() + 2000;
    react(event);
  }, { passive: true, signal });
  window.addEventListener("pointerdown", (event) => react(event, true), { passive: true, signal });
  window.addEventListener("resize", refresh, { passive: true, signal });
  window.addEventListener("scroll", refresh, { passive: true, signal });
  reduced.addEventListener("change", refresh, { signal });

  let animation;
  function frame(now) {
    animation = requestAnimationFrame(frame);
    if (!geometry || !moon.firstElementChild) return;
    updatePhrase(now);
    const { size, minX, maxX, minY, maxY } = geometry;
    const playing = !reduced.matches && (!speech || speech.settled) && !moon.classList.contains("talk");
    const kick = playing && reaction.until > now ? clamp((reaction.until - now) / 280, 0, 1) : 0;
    const drift = playing ? Math.sin(now / 1240) * 3 : 0;
    const bob = playing ? Math.sin(now / 630) * 2.8 : 0;
    const x = clamp(geometry.x + drift + kick * reaction.x, minX, maxX - size);
    const y = clamp(geometry.y + bob + kick * reaction.y, minY, maxY - size);
    const blend = reduced.matches ? 1 : .13;
    const lean = reduced.matches ? 0 : clamp((x - pos.x) * .42, -21, 21);
    pos.lean += (lean - pos.lean) * blend;
    pos.x = clamp(pos.x + (x - pos.x) * blend, minX, maxX - size);
    pos.y = clamp(pos.y + (y - pos.y) * blend, minY, maxY - size);
    moon.style.transform = `translate3d(${pos.x}px,${pos.y}px,0) rotate(${pos.lean}deg)`;
    const mood = kick > .08 ? reaction.mood : "";
    if (moon.dataset.mood !== mood) moon.dataset.mood = mood;
    const look = playing && pointer.until > now;
    moon.style.setProperty("--baker-look-x", (look ? clamp((pointer.x - pos.x - size / 2) / 26, -2, 2) : 0) + "px");
    moon.style.setProperty("--baker-look-y", (look ? clamp((pointer.y - pos.y - size / 2) / 26, -2, 2) : 0) + "px");
    if (speech) placeBubble(pos.x, pos.y);
  }

  animation = requestAnimationFrame(frame);
  signal.addEventListener("abort", () => { cancelAnimationFrame(animation); bubble.remove(); }, { once: true });
  return { aim, say, clear, refresh };
}
