# Design rules

*The owner's standing preferences for how the app looks and behaves, agreed 2026-10-23 and 2026-10-24 and reshaped on 2026-11-27 around Apple Maps' layout. Read this before changing anything people see. `PROJECT.md` says what the app is for; this file says how it should feel. The agreed screens are on the design canvas (private to the owner). The chat agent's own rules live in `server/features/agent/prompt.ts`.*

## Copy Apple Maps and Google Maps
- When Apple Maps or Google Maps has already solved a screen, copy its layout and gestures closely (owner, 2026-11-27: "copying ui ux is not a crime"). Keep our own icons, colours and words, never their logos or icon sets. Apple Maps is the base layout; Google's pieces are used where they are better (the transit line card, Street View, route preview).
- The agreed mockup is `docs/design/apple-layout/map-shell.html`. Open it at phone width and desktop width; the buttons along its top start each flow.

## The map is for getting around
- The main page is only for getting around New York: trains, buses, trips, walking, stations, exits, restrooms, and weather that affects the trip.
- Everything else lives on its own page: 311, noise and crash analytics at `/city-data`; the presenter, the station-walk recorder, tracker health and "what's coming" on theirs; and a hub at `/info/` that links them all. They are reached from the person button, never from buttons on the map.
- My day is removed for now (owner, 2026-11-27). It may come back later.

## The map is always there
- The map stays visible on every screen. No full screens of text, and no full-screen lists.
- **Every panel opens in one place** (owner, 2026-11-27, #180). On a phone that is the one bottom sheet; from 640 px wide it is one card docked on the left, with the chat bar at its foot. Tablet and desktop share that layout.
- Opening something replaces what is in the sheet; Back returns to it and Close empties it. Two panels never stack (`src/lib/store/pullSheet.ts`). Nothing else floats on the map: no top-left cards, no right-docked panels, no bubbles at the tapped point.
- Two exceptions, both copied from Apple's navigation screen: while walking or following a train, a banner at the top shows the next turn or the next stop; the rest of that screen (time left, camera views, End) sits in the sheet. The full-screen station walk and short toasts are the other exception.
- Panels float, translucent with a blur, so the map shows through.
- **Least first, deeper on each tap.** A casual user getting around never has to see sources, agent steps, data or options.
- **The focus stays on screen.** You, the followed train or the answer's place is never hidden under a panel, unless the person has gone three levels deep. On tablet and desktop, panels dock to the sides so the middle stays clear. The full rules, by screen size, are in `docs/PDD.md` under "Screen space".

## Few words
- Minimal text and no tooltips. If a button needs a tooltip, change the icon or the label.
- Show, do not tell: an answer comes with a button that draws it on the map.
- Data sources sit behind **More** on the answer, never in the first view.

## Fixed parts of the screen
- **The chat bar is never hidden.** Left to right: text box, a small grey microphone (dictation), a big blue waveform button (hands-free conversation), and the person button. It sits at the foot of the sheet or the left card.
- **The person button** opens Settings, Language, What we remember, and a More list of the other pages (City data, Meet Design Baker, Record a station walk, Tracker health, What's coming, Share this app, the `/info/` hub).
- **Top right is Apple's stacked pair:** a map button and Center on my location. The map button opens one sheet with Map, 3D and Street, the Live trains, Live buses and Restrooms switches, and More layers. A compass appears under the pair only when the map is rotated or tilted. Phones get no zoom buttons; desktop has + and − at the bottom right.
- **Home's four task buttons** sit in the sheet where Apple puts Home and Work: Restroom, My train, Plan trip, Find exit.
- **Answer card:** one short line and one main action ("Walk me there"). "What's nearby", "Other options" and the sources wait behind **More**.

## Trains, buses and lines on the map
- Every train or bus drawn on the map carries its line bullet (for example the round orange F), so nobody has to guess which train it is.
- Every notice is clickable. Tapping it shows, on the map, the station where the problem is, which stations and lines it affects and how (delayed, skipped, rerouted), since when and until when.
- An alternative ("Take the C instead") is clickable too: it shows where to transfer, which platform, and the new arrival time on the map.
- Tapping a line shows which line it is and its station names, and opens the line panel with its notices.
- Trains move smoothly between updates. Their path along the track is worked out in advance from the timetable shapes and arrival predictions, and the live feed is synced every 30 seconds to correct it. A train never jumps backwards (`src/features/transit/model.ts`, `dwell.ts`, `monotonic.ts`).
- Repeated taps on the same spot cycle through what is there (owner, 2026-10-25). One train in a station: the first tap picks the train, the second picks the station. Three trains in a station: taps one, two and three pick each train in turn, the fourth picks the station.
- Tapping the train you are following again, when nothing else is on that spot, lets go of it and eases the camera back, like Stop following (#297).
- A station served by several lines highlights all of them when picked, and its panel offers each line's bullet. Tapping a bullet (say the Q) isolates that line on the map and narrows the station panel to the Q's notices, skips and arrivals; tapping it again brings every line back. Tapping a running train isolates its line too.
- A focused line is drawn solid end to end, underground included, and only that line's station repairs and skips show.
- Trains are drawn as simple boxes; the detailed 3D city is optional and off by default. The Top view is a flat 2D map.

## Guidance
- Walking checkpoints use landmarks or big stores, with a photo, never street signs. While walking, the next landmark is a hint in the tray ("St Paul's Chapel on your right, in 80 m"), not a question to answer. Arrival is detected, not tapped.
- Restrooms use a real restroom icon, never "WC".

## Restrooms
- The app's job is to say where the nearest open restrooms are and when they are open, and let the person choose (owner, 2026-11-27).
- Tapping Restroom picks the closest open restroom, public or business, and draws the route. When that one is a business, the closest public one is offered under it, but only if it is open and at most 5 minutes further.
- "All restrooms nearby" lists the rest. Open ones can be picked; closed ones show when they open.
- A business restroom carries one plain warning, "may be customers only". On the map and in the list, public restrooms are a green restroom icon and businesses show their own kind (a cup for a café) or their brand logo, with a small restroom badge.
- Each pick has Walk me there and Preview in Street view, which plays the walk at street level first.
- On arrival the app asks one question, "Was the restroom available to use?", then up to three questions anyone can skip (had to pay or buy something, customers only, needed a code). Answers are anonymous and dated, and recent ones show on the card.
- Hours are worked out in New York time when someone asks. Hours we have not checked recently say "Hours may have changed" instead of "Open now".
- Weather is shown in street view, not only described.

## What the app offers without being asked
- Never suggest food, cafés, shops, events or other things to do unless the person asks. Showing the business that hosts a restroom the person asked for is part of the answer; promoting it is not.
- Unasked help is limited to their own trip: delays, planned work, skipped stops, elevator outages, weather that affects the trip.
- Never tell people how to manage their time ("leave 8 min later"). Show the facts; they plan their own day.
- One exception, decided by the owner on 2026-10-25 to match the demo video: a trip planned for later has a Remind me button. Tapping it puts the trip in the phone's own calendar with an alert 10 minutes before the time they chose. The agent may offer it for those trips; it never sets one by itself or picks a different time.
- Updates appear inside the app only. No push notifications from the app; the reminder above is the phone calendar's.

## Memory and data
- What the app learns (daily rides, Home and Work, past conversations, trips looked up) stays on the phone by default.
- The agent gets only a short summary that a question needs, never full history or exact coordinates unless the person shares their location.
- "What we remember" lets people see, pause or delete each kind of memory, or everything, and links to the data policy (`docs/PRIVACY.md`, draft in #384).
