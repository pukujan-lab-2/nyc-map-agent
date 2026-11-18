// Draws the approved evidence views into the tour's dedicated visual stage.
import D from "./media.json";

export function createScenes(root) {
const get = (id) => root.querySelector("#" + id);
const definitions = [
  {title:"Finding our way", question:"Where does the story begin?", answer:"Imagine leaving a train in a station you don't know. Your phone has lost GPS. Let's see what our recordings and station maps can tell us.", next:"See our first pitch"},
  {title:"The first pitch", question:"What did we already show?", answer:"This is a clip from our original hackathon presentation. It shows a walk, a station map, and the layers above and below the street.", next:"Follow the same walk"},
  {title:"One walk, two estimates", question:"Why did the pin drift?", answer:"We replayed the same 67 Avenue recording twice. At the mapped exit, the GPS estimate was about 14 metres away. With GPS withheld, it was about 161 metres away. This replay did not use the video to correct either estimate.", next:"Look through the camera"},
  {title:"A sign becomes a clue", question:"What did the camera recognize?", answer:"In a saved Union Square frame, the sign reader recognized Elevator to L. The guide matched that phrase to a known landing. The movement and directions shown in this clip were simulated.", next:"Find another landmark"},
  {title:"One elevator, several floors", question:"Can a sign name the floor?", answer:"Apple Vision read EL479 on this recorded elevator plaque. That tells us which elevator it is. Since the same elevator reaches several floors, the plaque alone doesn't tell us the landing.", next:"Feel the climb"},
  {title:"The phone feels a climb", question:"What did the barometer add?", answer:"A barometer measures air pressure. In this Queensboro recording, the logged relative height was around nine metres above its baseline. Pressure adds evidence of a change in height. A mapped landing or another clue is needed to name the floor.", next:"Build the 3D view"},
  {title:"Frames become a place", question:"What does the splat do?", answer:"COLMAP estimated camera positions and a cloud of points from overlapping frames. Brush used those positions and images to build this Gaussian splat. You can move around it. Aligning it to the station map and testing new views are still to do.", next:"Walk the station"},
  {title:"A route through Fulton", question:"Where does an arrow point?", answer:"This is a simulated walk through the Fulton Street station model. The connected platforms, corridors and stairs provide a route. A future live guide would need to align the phone with the map and track its movement.", next:"See what others built"},
  {title:"Ideas proven elsewhere", question:"Has anyone done this before?", answer:"Tokyo's Toei Subway deployed camera arrows at Tochomae. FloorPair tested pressure-based floor identification at two subway stations. Clew is an open-source iPhone app for retracing an indoor path.", next:"Use the data"},
  {title:"Build with us", question:"What can I use today?", answer:"The recorder and one Union Square sample are available now. We plan to publish reviewed station data with its sources and reuse terms. The project is open for contributions.", next:"Start again"}
];

function sceneIntro(actions="") {
  return `<div class="actions">${actions}</div>`;
}
function modeButton(mode,label,active) {
  return `<button type="button" data-mode="${mode}"${active?' aria-pressed="true"':''}>${label}</button>`;
}
function clip(src,poster,label, muted=true) {
  // WebM first for browsers without H.264 (headless Chromium), MP4 fallback for Safari.
  const sources = src.endsWith(".mp4")
    ? `<source src="${src.replace(/\.mp4$/, ".webm")}" type="video/webm"><source src="${src}" type="video/mp4">`
    : `<source src="${src}">`;
  return `<div class="frame media" data-focus><div class="clip-haze" aria-hidden="true" style="--poster:url('${poster}')"></div><video controls playsinline preload="metadata" ${muted?'muted':''} poster="${poster}" aria-label="${label}">${sources}</video><span class="corner">${label}</span></div>`;
}
// The invitation card: a scannable QR and the visible link, shared by the last scene and the walk's end.
function qrCard(){
  return `<img src="/presenter-media/evidence/qr-present.svg" alt="QR code linking to nyc.design-bakery.com/present"><div class="qr-text"><a class="qr-link" href="https://nyc.design-bakery.com/present" target="_blank" rel="noreferrer">nyc.design-bakery.com/present</a><span class="qr-caption">Talk to Design Baker on your phone</span></div>`;
}
// The walks loop, in the style of the scene 6 process diagram: few words, the flow carries it.
function dataFlow(){
  return `<svg class="flow" viewBox="0 0 360 240" role="img" aria-label="Riders record a walk. It is cleaned into a path with levels, becomes checkpoints, then versioned open data, then 3D previews and guidance."><rect width="360" height="240" rx="12" fill="#151b15"/><g stroke="#a3b990" stroke-width="2" fill="none"><path d="M108 49H126 M230 49H248 M230 171H248"/><path d="M120 43l10 6-10 6 M242 43l10 6-10 6 M242 165l10 6-10 6"/><path d="M302 80V112H180V134"/><path d="M174 128l6 10 6-10"/></g><g fill="#242e22" stroke="#78906d"><rect x="8" y="18" width="100" height="62" rx="10"/><rect x="130" y="18" width="100" height="62" rx="10"/><rect x="252" y="18" width="100" height="62" rx="10"/><rect x="130" y="140" width="100" height="62" rx="10"/><rect x="252" y="140" width="100" height="62" rx="10"/></g><g fill="#d5fa80" font-family="sans-serif" text-anchor="middle" font-size="13"><text x="58" y="45">RECORD</text><text x="180" y="45">CLEAN</text><text x="302" y="45" font-size="12">CHECKPOINTS</text><text x="180" y="167">OPEN DATA</text><text x="302" y="167" font-size="12">3D + GUIDE</text></g><g fill="#dbe6d1" font-family="sans-serif" text-anchor="middle" font-size="9"><text x="58" y="62">video + sensors</text><text x="180" y="62">path + levels</text><text x="302" y="62">landmarks</text><text x="180" y="184">versioned</text><text x="302" y="184">preview + arrows</text></g><text x="180" y="226" text-anchor="middle" fill="#b7c5b0" font-family="sans-serif" font-size="11">Every cleaned walk is a versioned open dataset</text></svg>`;
}
function trackMap(){
  const tracks=D.tracks, all=tracks.flat();
  const xs=all.map(p=>p[0]), ys=all.map(p=>p[1]);
  const minX=Math.min(...xs)-20,maxX=Math.max(...xs)+20,minY=Math.min(...ys)-20,maxY=Math.max(...ys)+20;
  const point=p=>[45+(p[0]-minX)/(maxX-minX)*510,310-(p[1]-minY)/(maxY-minY)*245];
  const lines=tracks.map((a,i)=>`<polyline points="${a.map(p=>point(p).join(',')).join(' ')}" fill="none" stroke="${i?'#f3aa82':'#b4f7b8'}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><circle cx="${point(a.at(-1))[0]}" cy="${point(a.at(-1))[1]}" r="7" ${i===1?"data-focus":""} fill="${i?'#f3aa82':'#b4f7b8'}"/>`).join('');
  return `<div class="frame media"><svg viewBox="0 0 600 370" role="img" aria-label="Two recorded replay estimates for the same 67 Avenue walk"><rect width="600" height="370" fill="#141a15"/><path d="M40 75H560 M40 145H560 M40 215H560 M40 285H560 M120 30V315 M240 30V315 M360 30V315 M480 30V315" stroke="#354034" stroke-width="1"/>${lines}<circle cx="${point(tracks[0][0])[0]}" cy="${point(tracks[0][0])[1]}" r="5" fill="#eee"/><text x="28" y="28" fill="#b3c0ae" font-family="monospace" font-size="12">67 AV · REPLAY ESTIMATES · METRES FROM START</text><text x="28" y="345" fill="#b4f7b8" font-size="13" font-family="sans-serif">● GPS on · 14.4 m to mapped exit</text><text x="323" y="345" fill="#f3aa82" font-size="13" font-family="sans-serif">● GPS off · 160.5 m to mapped exit</text></svg></div>`;
}
function research(){
  return `<div class="frame media" data-focus style="display:grid;grid-template-columns:repeat(3,1fr);gap:2px;padding:clamp(6px,1.2vw,16px);background:#181d17">
    <a href="https://www.kotsu.metro.tokyo.jp/eng/news/2024/20240123_11382.html" target="_blank" rel="noreferrer" style="height:100%;min-width:0;text-align:center;color:#f1f3e9;text-decoration:none;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;background:#212a20;border-radius:8px">
      <svg viewBox="0 0 130 160" aria-hidden="true" style="height:45%;width:85%"><rect x="20" y="7" width="90" height="145" rx="16" fill="#10150f" stroke="#9dbb7a" stroke-width="3"/><path d="M27 110 L65 72 L103 110 M65 75 V136" stroke="#d5fa80" fill="none" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/><circle cx="65" cy="23" r="4" fill="#d5fa80"/></svg><span style="font-size:clamp(14px,1.5vw,23px)">Camera arrows ↗</span><small style="font:10px Menlo,monospace;color:#b9c3b1">TOEI · TOKYO</small>
    </a>
    <a href="https://www.mdpi.com/1424-8220/19/16/3622" target="_blank" rel="noreferrer" style="height:100%;min-width:0;text-align:center;color:#f1f3e9;text-decoration:none;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;background:#212a20;border-radius:8px">
      <svg viewBox="0 0 130 160" aria-hidden="true" style="height:45%;width:85%"><path d="M20 35H110 M20 80H110 M20 125H110" stroke="#809675" stroke-width="4"/><path d="M65 120V41 M48 59L65 42L82 59" fill="none" stroke="#d5fa80" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/><circle cx="65" cy="80" r="9" fill="#d5fa80"/></svg><span style="font-size:clamp(14px,1.5vw,23px)">Floors from pressure ↗</span><small style="font:10px Menlo,monospace;color:#b9c3b1">FLOORPAIR · KOREA</small>
    </a>
    <a href="https://github.com/occamLab/Clew" target="_blank" rel="noreferrer" style="height:100%;min-width:0;text-align:center;color:#f1f3e9;text-decoration:none;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;background:#212a20;border-radius:8px">
      <svg viewBox="0 0 130 160" aria-hidden="true" style="height:45%;width:85%"><path d="M24 125 Q65 148 77 115 T63 67 Q45 50 89 27" fill="none" stroke="#d5fa80" stroke-width="5" stroke-dasharray="6 7" stroke-linecap="round"/><circle cx="24" cy="125" r="10" fill="#d5fa80"/><circle cx="89" cy="27" r="10" fill="#d5fa80"/><path d="M81 30L89 22L97 30" stroke="#10150f" fill="none" stroke-width="2"/></svg><span style="font-size:clamp(14px,1.5vw,23px)">Retrace a path ↗</span><small style="font:10px Menlo,monospace;color:#b9c3b1">CLEW · ARKIT</small>
    </a>
  </div>`;
}

function drawBaseScene(i,mode="default"){
  const box=root.querySelector("#scene");
  let intro="", visual="";
  switch(i){
    case 0:
      intro=sceneIntro();
      visual=`<div class="frame"><div class="orbit"></div><div class="globe-wrap" style="position:relative;width:min(100%,calc(100vw - 32px));max-width:100%;max-height:100%;aspect-ratio:1"><img class="globe" src="${D.earth}" alt="Earth centered on North America"><div class="pin" data-focus style="left:48%;top:39%"><span>NEW YORK CITY</span></div></div><div class="tech-chips" aria-label="The tech behind this walk"><button type="button" data-jump="1">First pitch</button><button type="button" data-jump="2">GPS test</button><button type="button" data-jump="3">Sign vision</button><button type="button" data-jump="4">Elevator clue</button><button type="button" data-jump="5">Pressure</button><button type="button" data-jump="6">3D map</button><button type="button" data-jump="7">Fulton 3D</button><button type="button" data-jump="8">Other cities</button><button type="button" data-jump="9">Get the data</button></div></div>`;
      break;
    case 1:
      intro=sceneIntro();
      visual=clip(D.originalClip,D.archive,"Original pitch · sound",false);
      break;
    case 2:
      intro=sceneIntro( modeButton("default","Watch the replay",mode!=="map")+modeButton("map","Estimates map",mode==="map"));
      visual=mode==="map"?trackMap():clip(D.gpsClip,D.street,"67 Av · recorded replay");
      break;
    case 3:
      intro=sceneIntro(modeButton("default","See the match",mode!=="video")+modeButton("video","Play the guide",mode==="video"));
      visual=mode==="video"?clip(D.signClip,D.sign,"Sign reader · simulated guide"):`<div class="frame media" data-focus><img src="${D.sign}" alt="Saved Union Square frame and sign reader"><span class="corner">SAVED FRAME · SIGN MATCH</span></div>`;
      break;
    case 4:
      intro=sceneIntro();
      visual=`<div class="frame media"><div class="plate"><img src="${D.plaque}" alt="Elevator and sign at Queensboro Plaza, with the EL479 plaque outlined"><b data-focus aria-hidden="true" style="left:31%;top:24%;width:13%;height:3%"></b></div><div class="witness"><strong>EL479</strong>Elevator identified<br>Floor unknown</div></div>`;
      break;
    case 5:
      intro=sceneIntro(modeButton("default","Pressure",mode!=="data")+modeButton("data","The readings",mode==="data"));
      if(mode==="data") {
        const rows=D.heights.filter((_,index)=>index%Math.max(1,Math.floor(D.heights.length/5))===0).slice(0,5);
        visual=`<div class="frame media" data-focus style="display:block;padding:clamp(18px,4vw,42px);overflow:auto"><p style="font:11px Menlo,monospace;letter-spacing:.08em;color:#d5fa80">QUEENSBORO · SENSOR EXPORT</p><div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;border-bottom:1px solid #52614b;padding:12px 0;color:#b5bba9;font-size:13px"><span>Clip time</span><span>Height above baseline</span></div>${rows.map(r=>`<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;border-bottom:1px solid #33402e;padding:12px 0;font-size:clamp(15px,2vw,24px)"><span>${Math.floor(r[0]/60)}:${String(Math.floor(r[0]%60)).padStart(2,"0")}</span><span>${r[1].toFixed(2)} m</span></div>`).join("")}<p style="font-size:12px;color:#b5bba9">Recorded barometer-derived height · landing remains unknown</p></div>`;
      } else visual=heightView();
      break;
    case 6:
      intro=sceneIntro(modeButton("default","3D map",mode!=="splat"&&mode!=="points"&&mode!=="video"&&mode!=="process")+modeButton("splat","Splat capture",mode==="splat")+modeButton("points","COLMAP points",mode==="points")+modeButton("process","How it is made",mode==="process")+modeButton("video","Orbit video",mode==="video"));
      if(mode==="process") visual=`<div class="frame media" data-focus><svg viewBox="0 0 620 350" role="img" aria-label="Footage goes into COLMAP. Camera poses and points go into Brush for a splat. The station plan provides routes."><rect width="620" height="350" fill="#151b15"/><g stroke="#a3b990" stroke-width="2" fill="none"><path d="M130 153H185 M298 153H353 M466 153H520"/><path d="M172 146l13 7-13 7 M340 146l13 7-13 7 M507 146l13 7-13 7"/></g><g fill="#242e22" stroke="#78906d"><rect x="15" y="100" width="115" height="106" rx="12"/><rect x="185" y="100" width="113" height="106" rx="12"/><rect x="353" y="100" width="113" height="106" rx="12"/><rect x="520" y="100" width="86" height="106" rx="12"/></g><g fill="#d5fa80" font-family="sans-serif" text-anchor="middle" font-size="14"><text x="72" y="138">WALK</text><text x="72" y="160">FRAMES</text><text x="241" y="138">COLMAP</text><text x="241" y="160" fill="#dbe6d1" font-size="12">poses + points</text><text x="409" y="138">BRUSH</text><text x="409" y="160" fill="#dbe6d1" font-size="12">splat</text><text x="563" y="138">3D</text><text x="563" y="160" font-size="12">VIEW</text></g><text x="310" y="270" text-anchor="middle" fill="#b7c5b0" font-family="sans-serif" font-size="14">Station plans supply floors and walkable paths</text></svg></div>`;
      else if(mode==="points") visual=`<div class="frame media" data-focus><img src="${D.cloud}" alt="COLMAP reconstruction of camera positions and points"><span class="corner">COLMAP · POINT CLOUD</span></div>`;
      else if(mode==="video") visual=clip(D.splatClip,D.view,"Recorded splat orbit");
      else if(mode==="splat") visual=`<div class="frame media" data-focus><iframe title="Interactive Queensboro Plaza Gaussian splat" src="/presenter-media/splat/index.html" referrerpolicy="no-referrer"></iframe><span class="corner">GAUSSIAN SPLAT · DRAG TO EXPLORE</span></div>`;
      else visual=`<div class="frame media" data-focus><iframe title="Interactive Fulton Street station model" src="/station-3d" referrerpolicy="no-referrer"></iframe><span class="corner">3D STATION MAP · DRAG TO EXPLORE</span></div>`;
      break;
    case 7:
      intro=sceneIntro();
      visual=clip(D.fultonClip,D.route,"Fulton route · simulation");
      break;
    case 8:
      intro=sceneIntro();
      visual=research();
      break;
    case 9:
      intro=sceneIntro();
      visual=`<div class="frame media build" data-focus><div class="build-scroll"><p class="mission">An accessible NYC map assistant: recorded walks become checkpoints, open data and 3D guidance.</p><div class="build-grid"><div class="build-left">${dataFlow()}<div class="links"><a href="https://nyc.design-bakery.com/record" target="_blank" rel="noreferrer"><small>CONTRIBUTE ↗</small>Record a walk</a><a href="https://nyc.design-bakery.com/replay/union-sq-walk.json" target="_blank" rel="noreferrer"><small>PUBLIC SAMPLE ↗</small>Download sensor data</a><a href="https://github.com/pukujan-lab-2/nyc-map-agent" target="_blank" rel="noreferrer"><small>OPEN SOURCE ↗</small>Explore the project</a></div></div><div class="qr-card">${qrCard()}</div></div></div></div>`;
      break;
    case 15:
      intro=sceneIntro();
      visual=`<div class="frame media" data-focus><svg viewBox="0 0 620 350" role="img" aria-label="The phone records video, motion and pressure. The Hono server runs the agent and the sign reader. Octo keeps the walks, the reviewed answers and the traces. Haiku with vision writes the answers, and COLMAP with Brush builds the 3D; both feed the guide."><rect width="620" height="350" fill="#151b15"/><g stroke="#a3b990" stroke-width="2" fill="none"><path d="M170 80H235 M385 80H450 M310 120V230 M170 270H235 M450 270H385"/><path d="M222 73l13 7-13 7 M437 73l13 7-13 7 M303 217l7 13 7-13 M222 263l13 7-13 7 M398 263l-13 7 13 7"/></g><g fill="#242e22" stroke="#78906d"><rect x="20" y="40" width="150" height="80" rx="12"/><rect x="235" y="40" width="150" height="80" rx="12"/><rect x="450" y="40" width="150" height="80" rx="12"/><rect x="20" y="230" width="150" height="80" rx="12"/><rect x="235" y="230" width="150" height="80" rx="12"/><rect x="450" y="230" width="150" height="80" rx="12"/></g><g fill="#d5fa80" font-family="sans-serif" text-anchor="middle" font-size="14"><text x="95" y="72">PHONE</text><text x="310" y="72">SERVER</text><text x="525" y="72">OCTO</text><text x="95" y="262">MODEL</text><text x="310" y="262">GUIDE</text><text x="525" y="262">3D</text></g><g fill="#dbe6d1" font-family="sans-serif" text-anchor="middle" font-size="11"><text x="95" y="92">video · motion</text><text x="95" y="106">+ pressure</text><text x="310" y="92">Hono agent</text><text x="310" y="106">sign reader</text><text x="525" y="92">walks · Q&amp;A</text><text x="525" y="106">traces</text><text x="95" y="282">Haiku + vision</text><text x="310" y="282">map · preview</text><text x="310" y="296">answers</text><text x="525" y="282">COLMAP → Brush</text></g><text x="310" y="336" text-anchor="middle" fill="#b7c5b0" font-family="sans-serif" font-size="13">One recording flows through the whole stack</text></svg></div>`;
      break;
    case 16:
      intro=sceneIntro();
      visual=`<div class="frame media" data-focus><svg viewBox="0 0 620 350" role="img" aria-label="A saved frame goes to the vision model, which reads the words Elevator to L: 6 of 8 frames exactly. Our code matches the words to a mapped landing with zero wrong matches, and the route gives the left turn. Asking the model to pick the sign itself got 3 of 10 wrong."><rect width="620" height="350" fill="#151b15"/><g stroke="#a3b990" stroke-width="2" fill="none"><path d="M130 153H185 M298 153H353 M466 153H520"/><path d="M172 146l13 7-13 7 M340 146l13 7-13 7 M507 146l13 7-13 7"/></g><g fill="#242e22" stroke="#78906d"><rect x="15" y="100" width="115" height="106" rx="12"/><rect x="185" y="100" width="113" height="106" rx="12"/><rect x="353" y="100" width="113" height="106" rx="12"/><rect x="520" y="100" width="86" height="106" rx="12"/></g><g fill="#d5fa80" font-family="sans-serif" text-anchor="middle" font-size="14"><text x="72" y="138">FRAME</text><text x="241" y="138">VISION</text><text x="409" y="138">CODE</text><text x="563" y="138">ROUTE</text></g><g fill="#dbe6d1" font-family="sans-serif" text-anchor="middle" font-size="11"><text x="72" y="160">saved frame</text><text x="241" y="160">reads the words</text><text x="241" y="176">“Elevator to L”</text><text x="409" y="160">matches a</text><text x="409" y="176">mapped landing</text><text x="563" y="160">turns left</text></g><g><rect x="195" y="52" width="92" height="26" rx="13" fill="#d5fa80"/><text x="241" y="70" text-anchor="middle" fill="#171b10" font-family="sans-serif" font-weight="bold" font-size="12">6 of 8 exact</text><rect x="363" y="52" width="92" height="26" rx="13" fill="#d5fa80"/><text x="409" y="70" text-anchor="middle" fill="#171b10" font-family="sans-serif" font-weight="bold" font-size="12">0 wrong</text><path d="M241 78V100 M409 78V100" stroke="#d5fa80" stroke-width="2" fill="none"/></g><text x="310" y="270" text-anchor="middle" fill="#b7c5b0" font-family="sans-serif" font-size="13">Words only: zero wrong matches · Picking the sign itself: 3 of 10 wrong</text></svg></div>`;
      break;
  }
  box.innerHTML=visual+intro;
  box.classList.remove("scene-enter");
  void box.offsetWidth;
  box.classList.add("scene-enter");
}

// Scene ids 0–9 retain the ids used by the existing question service.
const WALK = [0, 10, 11, 12, 3, 13, 14];
const EXTRAS = [1,2,4,5,6,7,8,9,15,16];
const stops = {
  0: ['Cortlandt St → Union Sq','Your trip','Follow one step-free trip from Broadway to 14th Street and 4th Avenue.','Guide me →'],
  10: ['Cortlandt St','Broadway entrance','Enter through the glass doors. Turn right for the elevator down to the concourse.','To the train →','fulton-entrance','entry'],
  11: ['Cortlandt St','Uptown platform','Take the elevator marked Uptown & Queens. Board an R or W and ride five stops to Union Square.','Arrive at Union Sq →','uptown-queens','ride'],
  12: ['14 St–Union Sq','Platform elevator','Leave the train at Union Square. Follow the platform to the elevator and go up one level.','Find the turn →','us-to-mezzanine','landing'],
  3: ['14 St–Union Sq','Mezzanine','Turn left under “Elevator to L” and enter the long corridor.','To the street elevator →','us-to-l','turn'],
  13: ['14 St–Union Sq','Street elevator','Follow the corridor to the wide gate. Turn left at the orange mural and take the elevator to the street.','Step outside →','us-mural-elevator','street'],
  14: ['14 St & 4 Av','Street','You’re outside. The Climate Clock across the street marks the end of the recorded route.','See the tech behind this walk →','us-climate-clock']
};
const SCENES = definitions.map((scene) => ({ ...scene }));
for(const [key,v] of Object.entries(stops)){
 const n=Number(key);SCENES[n]={...SCENES[n],title:v[1],question:SCENES[n]?.question||'Where do I go next?',answer:v[2],next:v[3]};
}
// Two more evidence screens after the walk stops (10–14): the stack, and what the model actually does.
SCENES[15]={title:"The stack we build on",question:"What is this built with?",answer:"React and MapLibre draw the map, three.js the station, a Hono server the agent. Octo keeps the walks and reviewed answers, Haiku writes them, and COLMAP with Brush turn footage into 3D.",next:"See the AI at work"};
SCENES[16]={title:"How the AI reads a sign",question:"What does the model actually do?",answer:"The vision model only reads the words: 6 of 8 sign frames exactly, none wrong. Our code matches them to a mapped landing and the route gives the turn. Asking the model to pick the sign itself got 3 of 10 wrong; reading only words got zero.",next:"Build with us"};
const stationNames={1:'Hackathon archive',2:'67 Av',4:'Queensboro Plaza',5:'Queensboro Plaza',6:'Queensboro Plaza',7:'Fulton St · Simulation',8:'Field research',9:'Open data',15:'The stack',16:'Sign vision'};
// The way to go at each stop, drawn over the photo: up, left, right or a left-up turn.
const arrowTurn={10:90,11:0,12:0,3:-90,13:-45,14:0};
const arrowWord={10:'Turn right',11:'Elevator up',12:'Up one level',3:'Turn left',13:'Left, then up',14:'You’re outside'};
function guideArrow(i){
  if(!(i in arrowTurn))return '';
  return '<div class="guide-arrow" data-focus role="img" aria-label="'+arrowWord[i]+'" style="--turn:'+arrowTurn[i]+'deg"><svg viewBox="0 0 100 100" aria-hidden="true"><path d="M50 92V22M50 22L24 48M50 22L76 48" fill="none" stroke="#0d130c" stroke-width="17" stroke-linecap="round" stroke-linejoin="round" opacity=".55"/><path d="M50 92V22M50 22L24 48M50 22L76 48" fill="none" stroke="#d5fa80" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/></svg><small>'+arrowWord[i]+'</small></div>';
}
function drawTripScene(i,mode="default"){
  const scene=get('scene'), s=stops[i];
  if(!s||i===0)drawBaseScene(i,mode);
  if(s&&i!==0){
    const cinematic=mode==='walk'&&s[5],oldGuide=i===3&&mode==='video';
    if(cinematic||oldGuide)scene.innerHTML=clip(oldGuide?D.signClip:D.rider[s[5]],D.rider[s[4]],oldGuide?'Simulated directions':'Original walk',oldGuide);
    else {
      const dims={'fulton-entrance':[400,341],'uptown-queens':[400,341],'us-to-mezzanine':[400,284],'us-to-l':[400,333],'us-mural-elevator':[400,385],'us-climate-clock':[400,341]};
      const [w,h]=dims[s[4]];
      const anchor=i===3?'<path class="sign-outline" d="M2 0L278 53L278 128L1 83"/><circle cx="282" cy="124" r="3" fill="#dcff91"/>':'';
      scene.innerHTML='<div class="frame ride-photo"><div class="photo-haze" aria-hidden="true"></div><svg class="station-photo" viewBox="0 0 '+w+' '+h+'" preserveAspectRatio="xMidYMid meet" role="img" aria-label="'+s[1]+' on the recorded walk"><image width="'+w+'" height="'+h+'" href="'+D.rider[s[4]]+'"/>'+anchor+'</svg>'+guideArrow(i)+'</div>';
      const frame=scene.querySelector('.frame');frame.style.setProperty('--photo','url("'+D.rider[s[4]]+'")');
    }
    if(s[5])scene.insertAdjacentHTML('beforeend','<div class="actions">'+modeButton('default','Station frame',!cinematic&&!oldGuide)+modeButton('walk','Original walk',cinematic)+(i===3?modeButton('video','Simulated directions',oldGuide):'')+'</div>');
  }
  const currentLabel=s?s[0]:stationNames[i];root.querySelector('#location').textContent=currentLabel;
  const actions=scene.querySelector('.actions');
  const tray=get('viewChoices');tray.replaceChildren();
  if(actions){while(actions.firstChild)tray.appendChild(actions.firstChild);actions.remove()}
  get('viewGroup').hidden=!tray.children.length;
  const smallLabel=document.createElement('h1');smallLabel.className='screen-reader';smallLabel.textContent=s?s[1]:SCENES[i].title;scene.prepend(smallLabel);
  if(i===0)scene.insertAdjacentHTML('beforeend','<div class="route-title"><small>Step-free subway walk</small><b>Cortlandt St <span>→</span><br>Union Square</b></div>');
  if(s&&i!==0&&!scene.querySelector('[data-focus]')){const f=scene.querySelector('.frame');f.insertAdjacentHTML('beforeend','<span class="route-focus" data-focus></span>')}
  if(i===14)scene.insertAdjacentHTML('beforeend','<div class="street-invite">'+qrCard()+'</div>');
};
function heightView(){
 const pts=D.heights, t0=pts[0][0],t1=pts.at(-1)[0],lo=Math.floor(Math.min(...pts.map(p=>p[1]))*2)/2,hi=Math.ceil(Math.max(...pts.map(p=>p[1]))*2)/2;
 const x=p=>(p[0]-t0)/(t1-t0)*1000,y=p=>(hi-p[1])/(hi-lo)*100;
 const line=pts.map(p=>x(p)+','+y(p)).join(' ');
 const time=t=>Math.floor(t/60)+':'+String(Math.floor(t%60)).padStart(2,'0');
 return '<div class="frame pressure"><div class="metric">≈ 9 m <span>above baseline</span></div><div class="plot"><svg viewBox="0 0 1000 100" preserveAspectRatio="none" role="img" aria-label="Recorded height above baseline from '+time(t0)+' to '+time(t1)+'"><path d="M0 .5H1000 M0 50H1000 M0 99.5H1000" stroke="#485341" fill="none" vector-effect="non-scaling-stroke"/><polygon points="0,100 '+line+' 1000,100" fill="#bad484" fill-opacity=".07"/><polyline points="'+line+'" fill="none" stroke="#d5fa80" vector-effect="non-scaling-stroke" stroke-width="3"/></svg>'+[hi,(hi+lo)/2,lo].map((v,i)=>'<span class="axis-y" style="top:'+i*50+'%">'+v.toFixed(2)+'</span>').join('')+'<span class="mark" data-focus style="top:'+y(pts.at(-1))+'%"></span></div><div class="times"><span>'+time(t0)+'</span><span>'+time(t1)+'</span></div><p class="chart-caption">Recorded pressure · Floor unknown</p></div>';
};
const citySources={
 washington:['Washington, D.C.','98','Metro stations','Waymap pairs phone motion with mapped walking routes.','https://www.waymapnav.com/case-studies/wmata-washington-metro','Waymap case study'],
 singapore:['Singapore','3','SBS Transit stations','SBS Transit deployed Waymap at three stations.','https://www.waymapnav.com/case-studies/sbs-transit-singapore','SBS Transit case study'],
 london:['London','Bluetooth','beacon trial','Wayfindr trialled beacon guidance at Euston.','https://tfl.gov.uk/info-for/media/press-releases/2015/december/wayfindr-launches-with-major-london-underground-trial-at-euston','Transport for London'],
 seoul:['Seoul','Platform → exit','official subway app','Seoul announced platform and exit guidance. Its announcement leaves the positioning method open.','https://english.seoul.go.kr/new-subway-app-exclusive-for-foreign-residents-and-tourists/','Seoul city announcement']
};
function cityFor(s){return /london|pimlico/i.test(s)?'london':/singapore/i.test(s)?'singapore':/seoul/i.test(s)?'seoul':/washington|wmata/i.test(s)?'washington':undefined}
function drawScene(i,mode){
 drawTripScene(i,mode);
 if(i!==8)return;
 const choices=get("viewChoices");
 choices.innerHTML=modeButton("default","Studies",!citySources[mode])+Object.entries(citySources).map(([key,source])=>modeButton(key,source[0],mode===key)).join("");
 get("viewGroup").hidden=false;
 if(!citySources[mode])return;
 const [city,metric,unit,,url,source]=citySources[mode];
 const dots=mode==='washington'?'<div class="station-dots" aria-hidden="true">'+Array.from({length:98},()=>'<i></i>').join('')+'</div>':'';
 root.querySelector('#scene .frame').outerHTML='<div class="frame case-study"><div><div class="eyebrow">'+city+'</div><strong data-focus>'+metric+'</strong><span>'+unit+'</span>'+dots+'<a target="_blank" rel="noreferrer" href="'+url+'">'+source+' ↗</a></div></div>';
}

return { SCENES, WALK, EXTRAS, stops, citySources, cityFor, drawScene };
}
