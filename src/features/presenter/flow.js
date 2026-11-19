// The renderer: one tour actor per page mount. The machine (tourMachine.ts) owns
// where the visitor is and what is legal; this file draws the spine, reports media
// state back, turns DOM events into machine events, and performs the pet, speech
// and network side effects. No navigation logic lives here (docs/specs/PRESENTER_SDD.md).
import { createActor } from "xstate";
import { say } from "@/lib/voice/say";
import D from "./media.json";
import moonArt from "./moon.svg?raw";
import { createPet } from "./pet";
import { createScenes } from "./scenes";
import { createChat } from "./chat";
import { mountMicrophone } from "./microphone";
import { tourMachine } from "./tourMachine";
import { SPINE, ACT_NAMES, OLD_TO_NEW } from "./spine";

// The opening screen's chips: the technology act plus the invitation, from the spine (D24).
const CHIP_LABELS = { 7: "First pitch", 8: "GPS test", 9: "Sign vision", 10: "Elevator clue", 11: "Pressure", 12: "3D map", 13: "Fulton 3D", 14: "Other cities", 15: "The stack", 16: "AI at work", 17: "Get the data" };

export function mountPresenter(root) {
  const lifecycle = new AbortController();
  const { signal } = lifecycle;
  const listen = (element, event, callback, options = {}) => element.addEventListener(event, callback, { ...options, signal });
  const get = (id) => root.querySelector("#" + id);
  const scenes = createScenes(root);
  const pet = createPet(root, signal);
  const sessionId = crypto.randomUUID();
  const chat = createChat(sessionId);
  const stage = get("scene");
  const moon = get("pet");
  const route = get("menu");
  const routeButton = get("places");
  const next = get("next");
  const back = get("back");
  const question = get("q");
  const soundButton = get("sound");
  const suggestTray = get("suggest");
  const offerTray = get("offer");
  const stepLabel = get("step");
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const media = () => stage.querySelector("video");

  const actor = createActor(tourMachine, { input: { bank: D.bank, live: false } });
  const context = () => actor.getSnapshot().context;
  const stateValue = () => actor.getSnapshot().value;

  let audio;
  let cancelSpeech;
  let blockedVoice;
  let focus;
  let lastDrawn = null;
  let lastAnswer;
  let lastSound = true;
  let lastSuggestChapter = -1;
  let lastOffer;
  let drawToken = 0;
  let guidingTimer;
  let restoring = false;
  let lastClipSend = 0;
  let askSeq = 0;
  let lastQuestion = "";
  let flight = null;
  let flightSeq = -1;

  // Chapters whose clip carries its own narration: the first pitch and any original-walk view.
  const originalAudio = (c) => c.chapter === 7 || c.view === "walk";

  function stopVoice() {
    if (audio) {
      audio.pause();
      audio = undefined;
    }
    cancelSpeech?.();
    cancelSpeech = undefined;
    moon.classList.remove("talk");
  }

  function updateMediaSound() {
    const video = media();
    if (video) video.muted = !context().sound || !originalAudio(context());
  }

  function speak(words) {
    const c = context();
    if (!c.sound || !words) return;
    const video = media();
    if (originalAudio(c) && video && !video.paused && !video.muted) return;
    stopVoice();
    const token = drawToken;
    const finished = () => {
      if (token === drawToken && !signal.aborted) moon.classList.remove("talk");
    };
    const clip = D.voices?.[words];
    if (clip) {
      audio = new Audio(clip);
      audio.onplay = () => { if (token === drawToken && !signal.aborted) moon.classList.add("talk"); };
      audio.onended = finished;
      audio.onerror = finished;
      audio.play().catch((error) => {
        if (error?.name === "NotAllowedError" && token === drawToken) blockedVoice = words;
        finished();
      });
      return;
    }
    moon.classList.add("talk");
    cancelSpeech = say(words, "en", finished);
  }

  function setWords(words, label = "Design Baker") {
    get("by").textContent = label;
    get("words").textContent = words;
    get("transcript").textContent = (label.includes(" · ") ? label + " — " : "") + words;
    speak(words);
    const c = context();
    const video = media();
    if (!(originalAudio(c) && video && !video.paused)) pet.say(words, () => audio);
  }

  function labelWithSources(answer) {
    let label = answer.label || "Design Baker";
    const names = (Array.isArray(answer.sources) ? answer.sources : []).filter((source) => typeof source?.title === "string").slice(0, 2);
    if (names.length > 0) label += " · " + [...new Set(names.map((source) => source.page ? source.title + ", p. " + source.page : source.title))].join(" · ");
    return label;
  }

  function glide(element, pulse = false) {
    if (!element || !element.getClientRects().length) return;
    focus = element;
    pet.aim(element, pulse);
  }

  function evidence() {
    return Array.from(stage.querySelectorAll("[data-focus]")).find((element) => element.getClientRects().length)
      || stage.querySelector(".frame");
  }

  function sendClip(video) {
    lastClipSend = performance.now();
    actor.send({ type: "CLIP_STATE", time: video.currentTime || 0, playing: !video.paused && !video.ended });
  }

  // On the splat view Moon drives the camera: overview, then a slow orbit. The
  // draw token cancels pending moves when the chapter, view or question changes.
  function driveSplat(token) {
    const frame = stage.querySelector('iframe[title="Interactive Queensboro Plaza Gaussian splat"]');
    if (!frame) return;
    const post = (move) => {
      const c = context();
      if (signal.aborted || token !== drawToken || !frame.isConnected) return;
      if (c.chapter !== 12 || c.view !== "splat") return;
      frame.contentWindow?.postMessage({ type: "presenter-camera", move }, location.origin);
    };
    const send = () => {
      post("overview");
      setTimeout(() => post("orbit"), 2500);
    };
    // A freshly drawn iframe sits at about:blank (readyState complete) before its src loads.
    const loaded = frame.contentDocument?.readyState === "complete" && frame.contentWindow?.location.pathname.endsWith("/splat/index.html");
    if (loaded) send();
    else listen(frame, "load", send, { once: true });
  }

  function drawStage(c) {
    const token = ++drawToken;
    media()?.pause();
    lastDrawn = { chapter: c.chapter, view: c.view };
    const ch = SPINE[c.chapter];
    scenes.drawChapter(ch, c.view);
    // The view switcher lives ON the stage (D22), generated from the spine.
    if (ch.views.length > 1) {
      const switcher = document.createElement("div");
      switcher.className = "view-switch";
      switcher.setAttribute("role", "group");
      switcher.setAttribute("aria-label", "Views of this chapter");
      ch.views.forEach((view, index) => {
        const button = document.createElement("button");
        button.type = "button";
        button.dataset.mode = view;
        button.textContent = ch.viewLabels[index];
        button.setAttribute("aria-pressed", String(view === c.view));
        listen(button, "click", () => {
          pet.aim(button, true);
          actor.send({ type: "SET_VIEW", view });
        });
        switcher.append(button);
      });
      stage.append(switcher);
    }
    // The opening chips are the spine's technology act plus the invitation (D24).
    if (c.chapter === 0) {
      const chips = document.createElement("div");
      chips.className = "tech-chips";
      chips.setAttribute("aria-label", "The tech behind this walk");
      for (const [id, label] of Object.entries(CHIP_LABELS)) {
        const button = document.createElement("button");
        button.type = "button";
        button.dataset.jump = id;
        button.textContent = label;
        listen(button, "click", () => {
          pet.aim(button, true);
          actor.send({ type: "JUMP", chapter: Number(id) });
        });
        chips.append(button);
      }
      stage.querySelector(".frame")?.append(chips);
    }
    restoring = true;
    const video = media();
    if (video) {
      video.playsInline = true;
      updateMediaSound();
      const restore = () => {
        if (media() !== video || token !== drawToken) return;
        if (c.clipTime > 0) video.currentTime = Math.min(c.clipTime, video.duration || c.clipTime);
        restoring = false;
        if (c.playing) video.play().catch(() => {});
        sendClip(video);
      };
      if (video.readyState >= 1) restore();
      else video.addEventListener("loadedmetadata", restore, { once: true });
      listen(video, "timeupdate", () => {
        if (restoring || token !== drawToken) return;
        if (performance.now() - lastClipSend >= 500) sendClip(video);
      });
      listen(video, "play", () => {
        if (token !== drawToken) return;
        if (originalAudio(c)) {
          pet.clear();
          if (!video.muted) stopVoice();
        }
        sendClip(video);
      });
      listen(video, "pause", () => { if (token === drawToken && !restoring) sendClip(video); });
      listen(video, "seeked", () => { if (token === drawToken && !restoring) sendClip(video); });
      listen(video, "ended", () => { if (token === drawToken) sendClip(video); });
    } else {
      restoring = false;
    }
    root.dataset.moonGuiding = "";
    requestAnimationFrame(() => { if (token === drawToken && !signal.aborted) glide(evidence(), true); });
    clearTimeout(guidingTimer);
    guidingTimer = setTimeout(() => { if (token === drawToken && !signal.aborted) delete root.dataset.moonGuiding; }, reducedMotion.matches ? 0 : 650);
    if (c.chapter === 12 && c.view === "splat") driveSplat(token);
  }

  function renderSuggestions(ch) {
    if (lastSuggestChapter === ch.id) return;
    lastSuggestChapter = ch.id;
    suggestTray.replaceChildren();
    for (const text of ch.suggestions) {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.textContent = text;
      listen(chip, "click", () => {
        question.value = text;
        get("ask").requestSubmit();
      });
      suggestTray.append(chip);
    }
  }

  // An unknown question offers its nearest chapters as tappable actions (D33).
  function renderOffer(offer) {
    if (offer === lastOffer) return;
    lastOffer = offer;
    offerTray.replaceChildren();
    offerTray.hidden = !offer;
    for (const id of offer ?? []) {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.dataset.jump = String(id);
      chip.textContent = SPINE[id].title;
      listen(chip, "click", () => actor.send({ type: "JUMP", chapter: id }));
      offerTray.append(chip);
    }
  }

  function startFlight(c) {
    flightSeq = askSeq;
    flight?.abort();
    const controller = new AbortController();
    flight = controller;
    const seq = askSeq;
    const text = lastQuestion;
    const timeout = setTimeout(() => controller.abort(), 20000);
    const stale = () => signal.aborted || seq !== askSeq || controller.signal.aborted;
    const done = () => { clearTimeout(timeout); if (flight === controller) flight = null; };
    if (c.askKind === "smalltalk") {
      chat.ask(text, { signal: controller.signal }).then((result) => {
        if (stale() || typeof result?.answer !== "string" || !result.answer.trim()) return;
        const label = result.label || "Design Baker";
        actor.send({ type: "SMALLTALK", text: result.answer, label: label.startsWith("Design Baker") ? label : "Design Baker · " + label });
      }).catch(() => {
        // A replaced question is silent (seq moved on); a timeout still answers honestly.
        if (signal.aborted || seq !== askSeq) return;
        actor.send({ type: "SMALLTALK", text: "I couldn’t check that right now. We can keep going from here.", label: "Design Baker" });
      }).finally(done);
      return;
    }
    setWords("I’m looking that up.", "Design Baker");
    const ch = SPINE[c.chapter];
    // Walk stops send their real spine id and recorded direction (D15, M12).
    const body = {
      question: ch.direction ? `${ch.title}. Recorded direction: ${ch.direction}. Visitor: ${text}`.slice(0, 500) : text,
      scene: c.chapter + 1,
    };
    fetch("/api/presenter/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-session-id": sessionId },
      signal: controller.signal,
      body: JSON.stringify(body),
    }).then(async (response) => {
      const result = await response.json().catch(() => null);
      if (stale() || stateValue() !== "asking") return;
      if (!response.ok) {
        // A 429 carries an honest "give me a moment" answer the visitor sees (D30, M9).
        actor.send({ type: "FAIL", text: response.status === 429 && typeof result?.answer === "string" ? result.answer : undefined });
        return;
      }
      if (typeof result?.answer !== "string" || !result.answer.trim()) {
        actor.send({ type: "FAIL" });
        return;
      }
      actor.send({ type: "ANSWER", text: result.answer, chapter: result.chapter, sources: result.sources, label: "Design Baker · Live" });
    }).catch(() => {
      if (stale() || stateValue() !== "asking") return;
      actor.send({ type: "FAIL" });
    }).finally(done);
  }

  function render() {
    if (signal.aborted) return;
    const snapshot = actor.getSnapshot();
    const c = snapshot.context;
    const ch = SPINE[c.chapter];
    blockedVoice = undefined; // a stale blocked line never re-speaks after a transition (D31)
    root.dataset.scene = String(c.chapter + 1);
    root.dataset.mode = c.view;
    root.dataset.answerMode = c.live ? "live" : "prepared";
    // The menu's visibility IS the machine's menuOpen — no exit path can strand it (M11).
    route.hidden = !c.menuOpen;
    routeButton.setAttribute("aria-expanded", String(c.menuOpen));
    soundButton.textContent = c.sound ? "Sound on" : "Sound off";
    soundButton.setAttribute("aria-pressed", String(c.sound));
    const progress = `${c.chapter + 1} / ${SPINE.length} · ${ACT_NAMES[ch.act]}`;
    if (stepLabel.textContent !== progress) stepLabel.textContent = progress;
    root.querySelectorAll(".meter i").forEach((dot, index) => dot.classList.toggle("on", index <= c.chapter));
    const nextLabel = c.detour ? "Resume route ↺" : ch.nextLabel;
    if (next.textContent !== nextLabel) next.textContent = nextLabel;
    back.disabled = c.chapter === 0 && !c.detour;
    route.querySelectorAll(".item").forEach((item) => item.setAttribute("aria-current", String(Number(item.dataset.index) === c.chapter)));
    const moved = !lastDrawn || lastDrawn.chapter !== c.chapter || lastDrawn.view !== c.view;
    if (moved) drawStage(c);
    updateMediaSound();
    renderSuggestions(ch);
    renderOffer(c.offer);
    if (c.sound !== lastSound) {
      lastSound = c.sound;
      if (!c.sound) stopVoice();
      else if (c.answer) setWords(c.answer.text, labelWithSources(c.answer));
    }
    if (c.answer && c.answer !== lastAnswer) {
      lastAnswer = c.answer;
      setWords(c.answer.text || scenes.preparedAnswer(ch), labelWithSources(c.answer));
    } else if (!c.answer && (moved || lastAnswer !== null)) {
      // A move without an authored answer speaks the new chapter's prepared line.
      lastAnswer = null;
      setWords(scenes.preparedAnswer(ch), "Design Baker");
    }
    if (c.askKind !== "none" && flightSeq !== askSeq) startFlight(c);
    if (c.askKind === "none" && flight) {
      flight.abort();
      flight = null;
    }
  }

  // --- The menu: one flat list grouped by act, built from the spine (PDD). ---
  const routeTitle = document.createElement("div");
  const routeLabel = document.createElement("strong");
  routeLabel.textContent = "The story";
  const closeRouteButton = document.createElement("button");
  closeRouteButton.textContent = "Close";
  closeRouteButton.type = "button";
  listen(closeRouteButton, "click", () => {
    actor.send({ type: "MENU", open: false });
    routeButton.focus();
  });
  routeTitle.append(routeLabel, closeRouteButton);
  route.append(routeTitle);
  for (const act of [1, 2, 3]) {
    const heading = document.createElement("div");
    heading.className = "menu-act";
    heading.textContent = ACT_NAMES[act];
    route.append(heading);
    for (const ch of SPINE.filter((chapter) => chapter.act === act)) {
      const item = document.createElement("button");
      item.className = "item";
      item.type = "button";
      item.dataset.index = String(ch.id);
      item.textContent = ch.title;
      listen(item, "click", () => {
        pet.aim(item, true);
        actor.send({ type: "JUMP", chapter: ch.id });
      });
      route.append(item);
    }
  }
  const transcript = document.createElement("details");
  transcript.innerHTML = "<summary>Read Moon’s reply</summary><p id=\"transcript\"></p>";
  route.append(transcript);
  listen(routeButton, "click", () => actor.send({ type: "MENU", open: !context().menuOpen }));
  listen(document, "click", (event) => {
    if (context().menuOpen && !route.contains(event.target) && event.target !== routeButton && !get("ask").contains(event.target)) {
      actor.send({ type: "MENU", open: false });
    }
  });
  listen(document, "keydown", (event) => {
    if (event.key === "Escape" && context().menuOpen) {
      actor.send({ type: "MENU", open: false });
      routeButton.focus();
    }
  });

  // --- Fixed controls: every click is one machine event. ---
  const meter = root.querySelector(".meter");
  for (let index = 0; index < SPINE.length; index++) meter.append(document.createElement("i"));
  listen(next, "click", () => actor.send({ type: "ADVANCE" }));
  listen(back, "click", () => actor.send({ type: "BACK" }));
  listen(soundButton, "click", () => actor.send({ type: "SOUND", on: !context().sound }));
  listen(get("ask"), "submit", (event) => {
    event.preventDefault();
    const text = question.value.trim();
    if (!text) return;
    question.value = "";
    askSeq += 1;
    lastQuestion = text;
    actor.send({ type: "ASK", text, chatMatch: chat.matches(text) });
  });
  function unlockSound(event) {
    if (!blockedVoice || event.target.closest?.("#sound,video,iframe")) return;
    const words = blockedVoice;
    blockedVoice = undefined;
    setWords(words, get("by").textContent);
  }
  listen(document, "click", unlockSound, { capture: true });
  listen(window, "resize", () => glide(focus?.isConnected ? focus : evidence()));
  listen(window, "scroll", () => glide(focus?.isConnected ? focus : evidence()), { passive: true });

  // --- Deep links: #chapter-n (1-based) and legacy #stop-n, on mount and hashchange (D21). ---
  function applyHash() {
    const chapterLink = /^#chapter-(\d+)$/.exec(location.hash);
    if (chapterLink) {
      const id = Number(chapterLink[1]) - 1;
      if (SPINE[id]) actor.send({ type: "JUMP", chapter: id });
      return;
    }
    const stopLink = /^#stop-(\d+)$/.exec(location.hash);
    if (stopLink) {
      const id = OLD_TO_NEW[Number(stopLink[1]) - 1];
      if (id !== undefined) actor.send({ type: "JUMP", chapter: id });
    }
  }
  listen(window, "hashchange", applyHash);

  moon.innerHTML = moonArt;
  const subscription = actor.subscribe(render);
  actor.start();
  applyHash();
  render();
  fetch("/api/presenter/status", { signal }).then((response) => response.ok ? response.json() : {}).then((status) => {
    if (signal.aborted) return;
    actor.send({ type: "LIVE", on: status.haiku === true });
  }).catch(() => {});
  mountMicrophone(root, signal, () => {
    media()?.pause();
  }, (text) => actor.send({ type: "SMALLTALK", text, label: "Design Baker" }));

  return () => {
    subscription.unsubscribe();
    actor.stop();
    flight?.abort();
    lifecycle.abort();
    clearTimeout(guidingTimer);
    stopVoice();
    media()?.pause();
    stage.replaceChildren();
    route.replaceChildren();
    meter.replaceChildren();
    suggestTray.replaceChildren();
    offerTray.replaceChildren();
    moon.replaceChildren();
  };
}