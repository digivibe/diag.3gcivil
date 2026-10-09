"use client";

import { useEffect, useRef, useState } from "react";
import { CHAPTERS } from "@/lib/content";
import { on, scrollToTarget, story } from "@/components/experience/story";

const fmt = (value: number) => (value < 0 ? "−" : "+") + Math.abs(value).toFixed(2).padStart(5, "0");

/** Interface "instrument" : index des chapitres, télémétrie caméra, repères de cadrage. */
export function Hud() {
  const [active, setActive] = useState(0);
  const telemetry = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const root = document.documentElement;
    const offChapter = on("chapter", setActive);
    const offPhase = on("phase", (phase) => {
      root.dataset.phase = phase;
    });
    root.dataset.phase = "story";

    let frame = 0;
    const tick = () => {
      const el = telemetry.current;
      if (el && root.dataset.phase === "story") {
        const [x, y, z] = story.camPos;
        el.textContent = `X ${fmt(x)}  Y ${fmt(y)}  Z ${fmt(z)}`;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      offChapter();
      offPhase();
      cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div className="hud">
      <nav className="hud__rail" aria-label="Chapitres">
        <ol>
          {CHAPTERS.map((chapter, i) => (
            <li key={chapter.id}>
              <button
                type="button"
                className="hud__chapter"
                aria-current={active === i ? "step" : undefined}
                onClick={() => scrollToTarget(`#chapitre-${chapter.id}`)}
              >
                <span className="hud__chapter-index">{chapter.index}</span>
                <span className="hud__chapter-label">{chapter.label}</span>
              </button>
            </li>
          ))}
        </ol>
      </nav>

      <div className="hud__telemetry" aria-hidden="true">
        <p className="hud__meta">
          <span className="hud__pulse" /> Jumeau numérique · {CHAPTERS[active].label}
        </p>
        <p ref={telemetry} className="hud__coords">
          X +00.00 Y +00.00 Z +00.00
        </p>
      </div>

      <div className="hud__scroll" aria-hidden="true">
        <span>Scroller</span>
        <span className="hud__scroll-line" />
      </div>

      <span className="hud__corner hud__corner--tl" aria-hidden="true" />
      <span className="hud__corner hud__corner--tr" aria-hidden="true" />
      <span className="hud__corner hud__corner--bl" aria-hidden="true" />
      <span className="hud__corner hud__corner--br" aria-hidden="true" />
    </div>
  );
}
