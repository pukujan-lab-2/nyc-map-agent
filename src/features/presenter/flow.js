import { say } from "@/lib/voice/say";
import D from "./media.json";
import moonArt from "./moon.svg?raw";
import { createPet } from "./pet";
import { createScenes } from "./scenes";
import { createChat } from "./chat";
import { mountMicrophone } from "./microphone";

// The guide remembers one place on the main tour while answering detours.
export function mountPresenter(root) {
  const lifecycle = new AbortController();
  const { signal } = lifecycle;
  const listen = (element, event, callback, options = {}) => element.addEventListener(event, callback, { ...options, signal });
  const get = (id) => root.querySelector("#" + id);
  const { SCENES, WALK, EXTRAS, stops, citySources, cityFor, drawScene } = createScenes(root);
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
  const sound = get("sound");
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const media = () => stage.querySelector("video");
  let current = { scene: 0, mode: "default", time: 0, playing: false };
  let bookmarked;
  let history = [];
  let voice = true;
  let blockedVoice;
  let automatedClick;
  let guiding = false;
  let audio;
  let cancelSpeech;
  let request;
  let actionId = 0;
  let focus;
  let live = false;
  const originalAudio = () => current.scene === 1 || current.mode === "walk";

  const routeToEvidence = [
    [/\b(jump\w*|drift\w*|gps|withheld|67\s*(av|ave|avenue))\b/i, 2],
    [/\b(vision|camera reads|sign reader|sign match|elevator sign|union square|ocr|elevator to l)\b/i, 3],
    [/\b(el479|plaque|elevator number|elevator id|queensboro sign)\b/i, 4],
    [/\b(barometer|pressure|vertical|altitude|go upstairs|climb|elevator ride)\b/i, 5],
    [/\b(colmap|splat|meshroom|3d capture|point cloud|3d thing|become 3d|how was this made)\b/i, 6],
    [/\b(fulton|arrow|arkit|nassau|route graph|augmented reality|live guidance)\b/i, 7],
    [/\b(toei|tokyo|floorpair|clew|research|anyone else|other people)\b/i, 8],
    [/\b(license|privacy|contribut\w*|github|download|data today|collecting|data flow|octo|upload|give feedback)\b/i, 9],
    [/\b(ai|artificial intelligence|vision model|vision analysis|what did the (?:model|ai)|neural|how does the vision)\b/i, 16],
    [/\b(tech stack|stack|technologies|what is it built|built with|gis)\b/i, 15],
    [/\b(archive|first pitch|original video|hackathon)\b/i, 1],
    [/\b(starting point|introduction|beginning)\b/i, 0],
  ];

  function stopVoice() {
    if (audio) {
      audio.pause();
      audio = undefined;
    }
    cancelSpeech?.();
    cancelSpeech = undefined;
    moon.classList.remove("talk");
  }

  function interrupt() {
    actionId += 1;
    if (request) request.abort();
    request = undefined;
    stopVoice();
    pet.clear();
    blockedVoice = undefined;
    if (guiding) closeRoute();
    guiding = false;
    delete root.dataset.moonGuiding;
    return actionId;
  }

  function updateMediaSound() {
    const video = media();
    if (video) video.muted = !voice || !originalAudio();
  }

  function speak(words) {
    if (!voice || !words) return;
    blockedVoice = undefined;
    const video = media();
    if (originalAudio() && video && !video.paused && !video.muted) return;
    stopVoice();
    const id = actionId;
    const finished = () => {
      if (id === actionId && !signal.aborted) moon.classList.remove("talk");
    };
    const clip = D.voices?.[words];
    if (clip) {
      audio = new Audio(clip);
      audio.onplay = () => { if (id === actionId && !signal.aborted) moon.classList.add("talk"); };
      audio.onended = finished;
      audio.onerror = finished;
      audio.play().catch((error) => {
        if (error?.name === "NotAllowedError" && id === actionId) blockedVoice = words;
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
    get("transcript").textContent = (label.includes(" · ") ? label+" — " : "")+words;
    speak(words);
    if (!(originalAudio() && media() && !media().paused)) pet.say(words, () => audio);
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

  function waitForGlide(id, callback) {
    if (signal.aborted) return;
    if (reducedMotion.matches) {
      if (id === actionId && !signal.aborted) callback();
      return;
    }
    setTimeout(() => { if (id === actionId && !signal.aborted) callback(); }, 480);
  }

  function snapshot() {
    const video = media();
    return { ...current, time: video?.currentTime || 0, playing: Boolean(video && !video.paused && !video.ended) };
  }

  // Tappable options above the chat, like the Design Bakery site: each scene offers
  // the questions a visitor is most likely to want next.
  const suggestions = {
    0: ["Start the tour", "Show me the splat", "How did Washington do this?"],
    1: ["Keep going", "What does the phone record?"],
    2: ["Show the GPS replay", "How far off was GPS?"],
    3: ["Play the original walk here", "What did the sign reader see?", "Show me the left turn", "What did the AI actually do?"],
    4: ["What does EL479 tell us?", "What did the barometer add?"],
    5: ["Show the pressure readings", "How does this become 3D?"],
    6: ["Show the COLMAP points", "How was this made?", "What is a Gaussian splat?", "What is the tech stack?"],
    7: ["Is this live guidance?", "Show the Fulton simulation"],
    8: ["How did Singapore do this?", "How did London do this?", "How did Seoul do this?"],
    9: ["How can I contribute a walk?", "What's the plan from here?", "How can I get the data today?"],
    10: ["Play the original walk here", "What do I do here?"],
    11: ["Play the original walk here", "What do I do here?"],
    12: ["Play the original walk here", "Where do I go?"],
    13: ["Play the original walk here", "Where do I go?"],
    14: ["Show me the GPS test", "How can I contribute a walk?"],
    15: ["What did the AI actually do?", "How can I get the data today?"],
    16: ["Show me the sign match", "What is the tech stack?"],
  };
  function updateSuggestions() {
    const tray = get("suggest");
    if (!tray) return;
    tray.replaceChildren();
    for (const text of suggestions[current.scene] || suggestions[0]) {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.textContent = text;
      listen(chip, "click", () => {
        question.value = text;
        get("ask").requestSubmit();
      });
      tray.append(chip);
    }
  }

  function updateNav() {
    const scene = SCENES[current.scene];
    const walkIndex = WALK.indexOf(current.scene);
    get("step").textContent = walkIndex < 0 ? "" : (walkIndex + 1) + " / " + WALK.length;
    next.textContent = !bookmarked && walkIndex < 0 ? "Start the walk →" : bookmarked ? "Resume route ↗" : (scene.next || (current.scene + 1 === SCENES.length ? "Back to start ↗" : "Continue ↗"));
    back.disabled = !bookmarked && history.length === 0 && current.scene === 0;
    root.dataset.scene = String(current.scene + 1);
    root.dataset.mode = current.mode;
    root.querySelectorAll(".meter i").forEach((dot, i) => dot.classList.toggle("on", i <= current.scene));
    route.querySelectorAll(".item").forEach((item) => item.setAttribute("aria-current", String(Number(item.dataset.index) === current.scene)));
    question.placeholder = "Ask or dictate…";
    question.setAttribute("aria-description", scene.question || "");
    updateSuggestions();
  }

  // On the splat scene Moon drives the camera: pull back to the overview, then start a slow orbit.
  // The guards match the glide's: an interrupting question or a new scene cancels pending moves.
  function driveSplat(id) {
    const frame = stage.querySelector("iframe");
    if (!frame) return;
    const post = (move) => {
      if (signal.aborted || id !== actionId || !frame.isConnected) return;
      if (current.scene !== 6 || current.mode !== "splat") return;
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

  function show(state) {
    blockedVoice = undefined;
    media()?.pause();
    current = { mode: "default", time: 0, playing: false, ...state };
    drawScene(current.scene, current.mode);
    updateNav();
    const video = media();
    if (video) {
      video.playsInline = true;
      updateMediaSound();
      const restore = () => {
        if (media() !== video) return;
        if (state.time > 0) video.currentTime = Math.min(state.time, video.duration || state.time);
        if (state.playing) video.play().catch(() => {});
      };
      if (video.readyState >= 1) restore();
      else video.addEventListener("loadedmetadata", restore, { once: true });
      listen(video, "play", () => {
        if (originalAudio()) pet.clear();
        if (originalAudio() && !video.muted) stopVoice();
      });
    }
    const id = actionId;
    requestAnimationFrame(() => { if (id === actionId && !signal.aborted && !guiding) glide(evidence(), true); });
    if (current.scene === 6 && current.mode === "splat") driveSplat(id);
  }

  function describe(target, words, label) {
    glide(target, true);
    const id = actionId;
    waitForGlide(id, () => setWords(words, label));
  }

  function follow(to, control) {
    const id = interrupt();
    if (control) glide(control, true);
    const open = () => {
      if (to.scene !== current.scene || (to.mode || "default") !== current.mode) {
        history.push(snapshot());
        if (history.length > 32) history.shift();
      }
      show(to);
      const details = SCENES[to.scene];
      describe(evidence(), details.answer || details.question || details.title);
    };
    if (control) waitForGlide(id, open);
    else open();
  }

  function resume() {
    if (!bookmarked) return false;
    interrupt();
    const restore = bookmarked;
    bookmarked = undefined;
    show(restore);
    setWords("We’re back where you left off.");
    return true;
  }

  function rewind() {
    if (resume()) return;
    interrupt();
    const state = history.pop() || { scene: WALK[Math.max(0, WALK.indexOf(current.scene) - 1)] };
    show(state);
    describe(evidence(), SCENES[current.scene].answer || SCENES[current.scene].title);
  }

  function onward(control) {
    if (resume()) return;
    // The walk's last stop leads into the tech story instead of looping.
    if (current.scene === 14) {
      follow({ scene: 2 }, control);
      return;
    }
    const scene = WALK[(WALK.indexOf(current.scene) + 1) % WALK.length];
    follow({ scene, playing: [1, 2, 7].includes(scene) }, control);
  }

  function closeRoute() {
    route.hidden = true;
    routeButton.setAttribute("aria-expanded", "false");
  }

  const routeTitle = document.createElement("div");
  const routeLabel = document.createElement("strong");
  routeLabel.textContent = "Explore the route";
  const closeRouteButton = document.createElement("button");
  closeRouteButton.textContent = "Close";
  closeRouteButton.type = "button";
  listen(closeRouteButton, "click", () => {
    closeRoute();
    routeButton.focus();
  });
  routeTitle.append(routeLabel, closeRouteButton);
  route.append(routeTitle);
  function menuItem(index, isEvidence) {
    const button = document.createElement("button");
    button.className = "item";
    button.type = "button";
    button.dataset.index = index;
    button.textContent = stops[index]?.[1] || SCENES[index].title;
    listen(button, "click", () => {
      const step = automatedClick;
      if (step) {
        if (step.recordHistory && index !== current.scene) remember(step.before);
        show({ scene: index, playing: step.play && !step.view });
        return;
      }
      if (isEvidence && !bookmarked && WALK.includes(current.scene)) bookmarked = snapshot();
      if (!isEvidence) bookmarked = undefined;
      closeRoute();
      follow({ scene: index });
    });
    route.append(button);
  }
  routeTitle.querySelector("strong").textContent="This walk";
  WALK.forEach(i=>menuItem(i,false));
  const more=document.createElement("details");
  more.innerHTML="<summary>Explore the evidence</summary>";route.append(more);
  EXTRAS.forEach(i=>{menuItem(i,true);more.append(route.lastElementChild)});
  // View-mode tabs live on the stage, not buried in the Route drawer (#issue-log 2026-11-19).
  const group=document.createElement("div");group.id="viewGroup";group.innerHTML='<span class="section-name">View this stop</span><div id="viewChoices"></div>';root.querySelector("main").append(group);
  const transcript=document.createElement("details");transcript.innerHTML='<summary>Read Moon’s reply</summary><p id="transcript"></p>';route.append(transcript);
  listen(routeButton, "click", () => {
    if (!automatedClick && guiding) {
      interrupt();
      return;
    }
    route.hidden = !route.hidden;
    routeButton.setAttribute("aria-expanded", String(!route.hidden));
  });
  listen(document, "click", (event) => {
    if (!route.hidden && !route.contains(event.target) && event.target !== routeButton && !get("ask").contains(event.target)) {
      if (guiding) interrupt();
      else closeRoute();
    }
  });
  listen(document, "keydown", (event) => {
    if (event.key === "Escape" && !route.hidden) {
      if (guiding) interrupt();
      else closeRoute();
      routeButton.focus();
    }
  });
  listen(next, "click", () => onward(next));
  listen(back, "click", rewind);
  listen(sound, "click", () => {
    voice = !voice;
    blockedVoice = undefined;
    sound.textContent = voice ? "Sound on" : "Sound off";
    sound.setAttribute("aria-pressed", String(voice));
    updateMediaSound();
    if (!voice) stopVoice();
    else setWords(get("words").textContent,get("by").textContent);
  });

  sound.textContent = "Sound on";
  sound.setAttribute("aria-pressed", "true");
  function unlockSound(event) {
    if (!blockedVoice || event.target.closest?.("#sound,video,iframe,button,a,#ask")) return;
    setWords(blockedVoice, get("by").textContent);
  }
  listen(document, "click", unlockSound, { capture: true });

  listen(document, "click", (event) => {
    const chip = event.target.closest("button[data-jump]");
    if (!chip) return;
    const to = Number(chip.dataset.jump);
    if (Number.isInteger(to) && SCENES[to]) follow({ scene: to }, chip);
  });

  listen(document, "click", (event) => {
    const control = event.target.closest("button[data-mode]");
    if (!control || control.disabled) return;
    const mode = control.dataset.mode;
    if (automatedClick) {
      show({ scene: current.scene, mode, playing: automatedClick.play });
      return;
    }
    closeRoute();
    const id = interrupt();
    glide(control, true);
    waitForGlide(id, () => {
      if (mode === "next") {
        onward(null);
        return;
      }
      show({ scene: current.scene, mode });
      const video = media();
      if (video) video.play().catch(() => {});
      const currentScene = SCENES[current.scene];
      describe(evidence(), currentScene.modes?.[mode] || currentScene.answer || currentScene.title);
    });
  });

  const normalize = (words) => words.trim().toLowerCase().replace(/[’']/g, "").replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ");

  function stageFor(words) {
    const bare = normalize(words);
    for (const [stopName, index] of [
      [/broadway (entrance|doors)|cortlandt (street )?entrance/, 10],
      [/uptown (platform|train|and queens)|the r or w/, 11],
      [/platform elevator|elevator (from|off) the platform/, 12],
      [/mezzanine|left turn/, 3],
      [/street elevator|wide gate|orange mural/, 13],
      [/climate clock|14th street and 4th avenue|street arrival/, 14],
    ]) {
      if (stopName.test(bare)) return index;
    }
    if (/^(take me back|go back|back|previous|rewind)$/.test(bare)) return "back";
    if (/^(resume|resume tour|resume the route|resume the tour|back to the route)$/.test(bare)) return "resume";
    if (/^(go on|keep going|carry on|continue|continue the tour|next|next stop|start the tour)$/.test(bare)) return "onward";
    if (/^(start over|restart|return to start)$/.test(bare)) return 0;
    return routeToEvidence.find(([pattern]) => pattern.test(words))?.[1];
  }

  function prepared(words, scene, destination) {
    const bare = normalize(words);
    if (stops[scene] && destination === undefined && /^(why|how|what now|where do i go(?: here)?|what do i do(?: here)?|which way|what happened|tell me more)$/.test(bare)) return {chapter:scene+1,answer:stops[scene][2]};
    if (destination === 15 || destination === 16) return { chapter: destination + 1, answer: SCENES[destination].answer };
    const known = D.bank.find((item) => normalize(item.question) === bare);
    if (known) return { chapter: known.scene, answer: known.answer };
    if (/^(why|why though|what happened|how did that happen|what is that|what does that mean|explain that|tell me more|how|go deeper)$/.test(bare)) {
      return { chapter: scene + 1, answer: SCENES[scene].answer };
    }
    if (Number.isInteger(destination)) {
      return { chapter: destination + 1, answer: SCENES[destination].answer };
    }
    return {
      chapter: scene + 1,
      answer: live ? "The live guide couldn’t retrieve an answer right now. Keep exploring from here." : "I can show you the replay, the elevator clues, the 3D capture, or the route. Try asking about one of those.",
    };
  }

  function remember(previous) {
    history.push(previous);
    if (history.length > 32) history.shift();
  }

  function setReply(result, label) {
    const names = (Array.isArray(result.sources) ? result.sources : []).filter((source) => typeof source?.title === "string").slice(0, 2);
    if (names.length > 0) label += " · " + [...new Set(names.map((source) => source.page ? source.title + ", p. " + source.page : source.title))].join(" · ");
    describe(evidence(), result.answer, label);
  }

  function clickAfterGlide(element, id, options) {
    if (!element || id !== actionId) return Promise.resolve(false);
    if (route.contains(element)) element.scrollIntoView({ block: "nearest", inline: "nearest" });
    glide(element, true);
    return new Promise((done) => {
      const click = () => {
        if (signal.aborted || id !== actionId || !element.isConnected || !element.getClientRects().length) {
          done(false);
          return;
        }
        automatedClick = options;
        try {
          element.click();
        } finally {
          automatedClick = undefined;
        }
        done(true);
      };
      if (reducedMotion.matches) click();
      else setTimeout(click, 350);
    });
  }

  async function deliver(result, id, label, options = {}) {
    if (signal.aborted || id !== actionId) return;
    const index = Number.isInteger(result.chapter) && result.chapter >= 1 && result.chapter <= SCENES.length
      ? result.chapter - 1 : current.scene;
    const { view, play } = options;
    if (index === current.scene && !view && !options.openStop) {
      if (play) media()?.play().catch(() => {});
      setReply(result, label);
      return;
    }
    if (index === current.scene && view) {
      show({ scene: index, mode: view, playing: play });
      setReply(result, label);
      return;
    }
    guiding = true;
    root.dataset.moonGuiding = "";
    // Speak first, navigate second: the visitor hears the answer while Moon flies to the evidence.
    setReply(result, label);
    try {
      if (route.hidden && !await clickAfterGlide(routeButton, id, options)) return;
      if (EXTRAS.includes(index) && !more.open && !await clickAfterGlide(more.querySelector("summary"), id, options)) return;
      if (index !== current.scene || options.openStop) {
        const stop = route.querySelector(`[data-index="${index}"]`);
        if (!await clickAfterGlide(stop, id, options)) return;
      }
      if (view) {
        const control = get("viewChoices").querySelector(`[data-mode="${view}"]`);
        if (!await clickAfterGlide(control, id, options)) return;
      }
      if (signal.aborted || id !== actionId) return;
      closeRoute();
    } finally {
      if (id === actionId && !signal.aborted) {
        guiding = false;
        delete root.dataset.moonGuiding;
      }
    }
  }

  function commandView(words, index, city) {
    if (city) return city;
    if (stops[index]?.[5] && /\b(original walk|recorded walk|this (part|stop|walk|clip))\b/i.test(words)) return "walk";
    if (index === 5 && /\b(readings|values|numbers|sensor export)\b/i.test(words)) return "data";
    if (index === 6 && /\bsplat\b/i.test(words)) return "splat";
    if (index === 6 && /\b(point cloud|camera positions|points)\b/i.test(words)) return "points";
    if (index === 6 && /\b(process|pipeline|steps|sequence|how was this made|become 3d)\b/i.test(words)) return "process";
    if (index === 2 && /\b(map|estimates|tracks?)\b/i.test(words)) return "map";
    if ([2, 3, 6].includes(index) && /\b(play|watch|clip|footage|video)\b/i.test(words)) return "video";
    return undefined;
  }

  async function stayAndAnswer(words, chat) {
    const before = snapshot();
    if (!bookmarked && before.playing) bookmarked = before;
    media()?.pause();
    const id = interrupt();
    updateNav();
    const controller = new AbortController();
    request = controller;
    const timeout = setTimeout(() => controller.abort(), 20000);
    try {
      const result = await chat.ask(words, { signal: controller.signal, scene: before.scene + 1 });
      if (signal.aborted || id !== actionId || typeof result?.answer !== "string" || !result.answer.trim()) return;
      const label = result.label || "Design Baker · Prepared";
      setReply(result, label.startsWith("Design Baker") ? label : "Design Baker · " + label);
    } catch {
      if (id === actionId && !signal.aborted) setWords("I couldn’t check that right now. We can keep going from here.");
    } finally {
      clearTimeout(timeout);
      if (request === controller) request = undefined;
    }
  }

  async function ask(words) {
      if (chat?.matches(words)) {
      await stayAndAnswer(words, chat);
      return;
    }
    let destination = stageFor(words);
    // Known bank questions route deterministically in live mode too, so chips never
    // wander to a model-chosen slide (#issue-log 2026-11-19).
    if (!Number.isInteger(destination)) {
      const banked = D.bank.find((item) => normalize(item.question) === normalize(words));
      if (banked) destination = banked.scene;
    }
    const city = cityFor(words);
    const outsideNYC = Boolean(city) || /\b(waymap|navilens|wmata|pimlico)\b/i.test(words);
    if (outsideNYC) destination = 8;
    if (destination === undefined && stops[current.scene]?.[5] && /\b(original walk|recorded walk|this (part|stop|walk|clip))\b/i.test(words)) destination = current.scene;
    if (destination === "back") {
      rewind();
      return;
    }
    if (destination === "resume") {
      if (!resume()) onward(next);
      return;
    }
    if (destination === "onward") {
      onward(next);
      return;
    }
    if (destination === 0 && /^(start over|restart|return to start)$/.test(normalize(words))) {
      bookmarked = undefined;
      history = [];
      interrupt();
      show({ scene: 0 });
      setWords(SCENES[0].answer);
      return;
    }
    const before = snapshot();
    const command = /\b(show|open|play|watch|take me|go (?:back )?to|jump to|zoom|switch|try|return to)\b/i.test(words);
    const direct = command && Number.isInteger(destination) && WALK.includes(destination);
    if (direct) bookmarked = undefined;
    else if (!bookmarked) bookmarked = before;
    media()?.pause();
    const id = interrupt();
    updateNav();
    const known = prepared(words, before.scene, destination);
    if (outsideNYC) known.answer = citySources[city]?.[3] || "Open the live guide to look up that question in the sourced transit Q&A.";
    const options = {
      before,
      openStop: Number.isInteger(destination),
      recordHistory: direct,
      view: commandView(words, known.chapter - 1, city),
      play: /\b(play|watch|replay)\b/i.test(words),
    };
    if (Number.isInteger(destination) && !outsideNYC) {
      await deliver(known, id, command ? "Design Baker · Guided" : "Design Baker · Prepared", options);
      return;
    }
    if (!live) {
      await deliver(known, id, "Design Baker · Prepared", options);
      return;
    }
    setWords("I’m looking that up.", "Design Baker");
    const controller = new AbortController();
    request = controller;
    const timeout = setTimeout(() => controller.abort(), 20000);
    try {
      const response = await fetch("/api/presenter/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-session-id": sessionId },
        signal: controller.signal,
        body: JSON.stringify({ question: before.scene>=10 ? (stops[before.scene][0]+" / "+stops[before.scene][1]+". Recorded direction: "+stops[before.scene][2]+". Visitor: "+words).slice(0,500) : words, scene: before.scene>=10 ? 4 : before.scene+1 }),
      });
      if (!response.ok) throw new Error("Guide unavailable");
      const result = await response.json();
      if (typeof result.answer !== "string" || !result.answer.trim()) throw new Error("Guide returned no answer");
      if (outsideNYC) result.chapter=9;
      if (before.scene >= 10 && result.chapter === 4 && !Number.isInteger(destination)) result.chapter=before.scene+1;
      await deliver(result, id, "Design Baker · Live", options);
    } catch {
      await deliver(known, id, "Design Baker · Prepared", options);
    } finally {
      clearTimeout(timeout);
      if (request === controller) request = undefined;
    }
  }

  listen(get("ask"), "submit", (event) => {
    event.preventDefault();
    const words = question.value.trim();
    if (!words) return;
    question.value = "";
    void ask(words);
  });

  listen(window, "resize", () => glide(focus?.isConnected ? focus : evidence()));
  listen(window, "scroll", () => glide(focus?.isConnected ? focus : evidence()), {passive: true});
  moon.innerHTML = moonArt;
  const deepLink = /^#stop-(\d+)$/.exec(location.hash);
  if (deepLink && SCENES[Number(deepLink[1]) - 1]) current.scene = Number(deepLink[1]) - 1;
  show(current);
  setWords(SCENES[current.scene].answer);
  fetch("/api/presenter/status", { signal }).then((response) => response.ok ? response.json() : {}).then((status) => {
    if (signal.aborted) return;
    live = status.haiku === true;
    root.dataset.answerMode = live ? "live" : "prepared";
  }).catch(() => {});
  mountMicrophone(root, signal, () => {
    if (!bookmarked && !media()?.paused) bookmarked = snapshot();
    media()?.pause();
    interrupt();
    updateNav();
  }, (text) => setWords(text));
  return () => {
    interrupt();
    lifecycle.abort();
    media()?.pause();
    closeRoute();
    stage.replaceChildren();
    route.replaceChildren();
    root.querySelector(".meter").replaceChildren();
    moon.replaceChildren();
  };
}
