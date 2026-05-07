"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";

type Step = { id: string; title: string; description: string };

const ALL_STEPS: Step[] = [
  {
    id: "nav-dashboard",
    title: "Dashboard",
    description: "View the main feed of recent public captions and their vote counts.",
  },
  {
    id: "nav-captions",
    title: "Caption Ratings",
    description: "Browse and vote on captions submitted by the community.",
  },
  {
    id: "nav-upload",
    title: "Upload",
    description: "Upload an image and generate AI-powered captions for it.",
  },
  {
    id: "carousel-image",
    title: "Swipe to Vote",
    description:
      "Drag the image right to upvote or left to downvote. A green ✓ or red ✕ appears as you swipe, with particle effects on release.",
  },
  {
    id: "carousel-vote-buttons",
    title: "Vote Buttons",
    description:
      "Tap 👍 to upvote or 👎 to downvote. You can also use the ← → arrow keys on your keyboard.",
  },
  {
    id: "carousel-skip",
    title: "Skip",
    description: "Skip to the next caption without casting a vote.",
  },
];

type Rect = { top: number; left: number; width: number; height: number };

const PAD = 8;
const TOOLTIP_W = 320;

export const TutorialTour = () => {
  const [active, setActive] = useState(false);
  const [steps, setSteps] = useState<Step[]>([]);
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);

  const measure = useCallback((step: Step) => {
    const el = document.querySelector<HTMLElement>(`[data-tour="${step.id}"]`);
    if (!el) return false;
    el.scrollIntoView({ behavior: "smooth", block: "nearest" });
    const r = el.getBoundingClientRect();
    setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
    return true;
  }, []);

  const start = useCallback(() => {
    const available = ALL_STEPS.filter(
      (s) => !!document.querySelector(`[data-tour="${s.id}"]`)
    );
    if (!available.length) return;
    setSteps(available);
    setIndex(0);
    measure(available[0]);
    setActive(true);
  }, [measure]);

  const goTo = useCallback(
    (i: number) => {
      setIndex(i);
      measure(steps[i]);
    },
    [steps, measure]
  );

  const close = useCallback(() => {
    setActive(false);
    setRect(null);
  }, []);

  // Re-measure on resize / scroll
  useEffect(() => {
    if (!active || !steps.length) return;
    const update = () => measure(steps[index]);
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [active, index, steps, measure]);

  // Close on Escape
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, close]);

  const step = steps[index];

  // Tooltip placement — fixed coords, no scrollY needed
  // All window accesses are guarded behind `rect` so they never run during SSR
  const TOOLTIP_H = 220;
  const MARGIN = 12;
  const belowTop  = rect ? rect.top + rect.height + PAD + 14 : 0;
  const aboveTop  = rect ? rect.top - PAD - 14 - TOOLTIP_H  : 0;
  const tooLow    = rect ? belowTop + TOOLTIP_H > window.innerHeight - MARGIN : false;
  const rawTop    = tooLow ? aboveTop : belowTop;
  const tooltipTopAdjusted = rect
    ? Math.min(Math.max(rawTop, MARGIN), window.innerHeight - TOOLTIP_H - MARGIN)
    : 0;
  const tooltipLeft = rect
    ? Math.min(Math.max(rect.left, MARGIN), window.innerWidth - TOOLTIP_W - MARGIN)
    : 0;

  return (
    <>
      <button
        type="button"
        onClick={start}
        className="btn-ghost rounded-xl px-3 py-2 text-xs font-semibold uppercase tracking-wider"
        aria-label="Start app tutorial"
        title="App tutorial"
      >
        Tutorial
      </button>

      {active && rect && step && createPortal(
        <>
          {/* Dark backdrop — click-away closes */}
          <div
            className="fixed inset-0 z-[9990]"
            style={{ background: "rgba(3,13,26,0.78)", backdropFilter: "blur(2px)" }}
            onClick={close}
          />

          {/* Spotlight cutout using outward box-shadow */}
          <div
            className="pointer-events-none fixed z-[9991] rounded-xl transition-all duration-300"
            style={{
              top: rect.top - PAD,
              left: rect.left - PAD,
              width: rect.width + PAD * 2,
              height: rect.height + PAD * 2,
              boxShadow: "0 0 0 9999px rgba(3,13,26,0.78)",
              border: "2px solid rgba(96,165,250,0.65)",
              outline: "4px solid rgba(96,165,250,0.15)",
            }}
          />

          {/* Corner accents */}
          {[
            { top: rect.top - PAD - 2, left: rect.left - PAD - 2, rotate: "0deg" },
            { top: rect.top - PAD - 2, left: rect.left + rect.width + PAD - 10, rotate: "90deg" },
            { top: rect.top + rect.height + PAD - 10, left: rect.left - PAD - 2, rotate: "270deg" },
            { top: rect.top + rect.height + PAD - 10, left: rect.left + rect.width + PAD - 10, rotate: "180deg" },
          ].map((corner, i) => (
            <div
              key={i}
              className="pointer-events-none fixed z-[9992]"
              style={{
                top: corner.top,
                left: corner.left,
                width: 12,
                height: 12,
                borderTop: "2px solid #60a5fa",
                borderLeft: "2px solid #60a5fa",
                transform: `rotate(${corner.rotate})`,
                borderRadius: "2px 0 0 0",
              }}
            />
          ))}

          {/* Tooltip card */}
          <div
            className="glass-card fixed z-[9993] rounded-2xl p-5"
            style={{
              top: tooltipTopAdjusted,
              left: tooltipLeft,
              width: TOOLTIP_W,
              border: "1px solid rgba(96,165,250,0.35)",
              boxShadow: "0 0 40px rgba(37,99,235,0.3), 0 8px 32px rgba(3,13,26,0.8)",
              pointerEvents: "all",
            }}
          >
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span
                  className="text-[10px] font-semibold uppercase tracking-widest"
                  style={{ color: "var(--accent-bright)" }}
                >
                  Step {index + 1} of {steps.length}
                </span>
                <div className="flex items-center gap-1">
                  {steps.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => goTo(i)}
                      className="rounded-full transition-all duration-200"
                      style={{
                        width: i === index ? 16 : 6,
                        height: 6,
                        background: i === index ? "var(--accent-bright)" : "rgba(96,165,250,0.25)",
                      }}
                      aria-label={`Go to step ${i + 1}`}
                    />
                  ))}
                </div>
              </div>
              <button
                onClick={close}
                className="rounded-lg px-2 py-1 text-xs transition-colors hover:text-white"
                style={{ color: "var(--muted)" }}
                aria-label="Close tutorial"
              >
                ✕
              </button>
            </div>

            <p className="mb-1 text-base font-bold" style={{ color: "var(--ink)" }}>
              {step.title}
            </p>
            <p className="mb-5 text-sm leading-relaxed" style={{ color: "var(--muted)" }}>
              {step.description}
            </p>

            <div className="flex items-center justify-between gap-2">
              <button
                onClick={() => goTo(index - 1)}
                disabled={index === 0}
                className="btn-ghost rounded-xl px-3 py-1.5 text-xs font-semibold uppercase tracking-wider disabled:pointer-events-none disabled:opacity-30"
              >
                ← Back
              </button>
              {index < steps.length - 1 ? (
                <button
                  onClick={() => goTo(index + 1)}
                  className="btn-primary rounded-xl px-5 py-1.5 text-xs font-semibold uppercase tracking-wider"
                >
                  Next →
                </button>
              ) : (
                <button
                  onClick={close}
                  className="btn-primary rounded-xl px-5 py-1.5 text-xs font-semibold uppercase tracking-wider"
                >
                  Done ✓
                </button>
              )}
            </div>
          </div>
        </>,
        document.body
      )}
    </>
  );
};
