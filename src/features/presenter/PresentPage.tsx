import { useEffect, useRef } from "react";
import { removeShell } from "@/lib/shellDraft";
import { mountPresenter } from "./flow";
import "./presenter.css";

/** The interactive subway presentation at /present. */
export default function PresentPage() {
  const presenter = useRef<HTMLDivElement>(null);

  useEffect(() => {
    removeShell();
    if (!presenter.current) return;
    const previousTitle = document.title;
    document.title = "Underground with Design Baker";
    const unmount = mountPresenter(presenter.current);
    return () => {
      unmount();
      document.title = previousTitle;
    };
  }, []);

  return (
    <div id="presenter" ref={presenter}>
      <header>
        <div className="brand">
          <span className="word">Design B<i>a</i>kery</span>
          <span id="location" />
        </div>
        <div className="headBtns">
          <button type="button" id="sound" aria-pressed="true">Sound on</button>
          <button type="button" id="places" aria-expanded="false" aria-controls="menu">Route ▾</button>
        </div>
      </header>
      <div className="popover" id="menu" hidden />
      <main>
        <div id="scene" />
      </main>
      <footer>
        <p className="sr-only" aria-live="polite">
          <span id="by">Design Baker</span>
          <span id="words" />
        </p>
        <form id="ask" aria-label="Talk to Design Baker">
          <button type="button" id="back" aria-label="Go back">←</button>
          <div className="inputwrap">
            <input id="q" aria-label="Ask Design Baker" placeholder="Ask or dictate…" maxLength={500} />
            <button type="button" id="dictate" aria-label="Dictate a question" hidden>Mic</button>
            <button type="submit">Ask ↗</button>
          </div>
          <div className="meter" aria-hidden="true" />
          <span className="progress" id="step" />
          <button type="button" className="primary jump" id="next">Guide me →</button>
        </form>
      </footer>
      <div id="pet" aria-hidden="true" />
    </div>
  );
}
