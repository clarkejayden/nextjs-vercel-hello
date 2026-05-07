"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type VoteValue = 1 | -1;

type CaptionWithVotes = {
  id: string;
  content: string;
  created_datetime_utc: string;
  imageUrl: string | null;
  upvotes: number;
  downvotes: number;
  currentUserVote: 1 | -1 | 0;
};

const voteLabels: Record<VoteValue, string> = {
  1: "Up-vote",
  [-1]: "Down-vote",
};

const SWIPE_THRESHOLD = 80;

type Particle = {
  x: number; y: number;
  vx: number; vy: number;
  ay: number;
  size: number;
  color: string;
  life: number;
  decay: number;
  kind: "dot" | "spark" | "ring";
  ringRadius: number;
  ringExpand: number;
};

function hexAlpha(hex: string, a: number) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a.toFixed(3)})`;
}

const GREEN = ["#22c55e", "#86efac", "#4ade80", "#bbf7d0"];
const RED   = ["#ef4444", "#fca5a5", "#f87171", "#fee2e2"];

function makeBurst(
  direction: "right" | "left",
  cx: number, cy: number,
): Particle[] {
  const palette = direction === "right" ? GREEN : RED;
  const sign = direction === "right" ? 1 : -1;
  const out: Particle[] = [];

  // Expanding ring
  out.push({
    x: cx, y: cy, vx: 0, vy: 0, ay: 0,
    size: 2, color: palette[0],
    life: 1, decay: 0.038,
    kind: "ring", ringRadius: 4, ringExpand: 5.5,
  });
  // Second ring, slightly delayed feel via slower decay
  out.push({
    x: cx, y: cy, vx: 0, vy: 0, ay: 0,
    size: 1.5, color: palette[1],
    life: 0.85, decay: 0.028,
    kind: "ring", ringRadius: 2, ringExpand: 4,
  });

  // Dots
  for (let i = 0; i < 16; i++) {
    const spread = 140;
    const deg = sign * (Math.random() * spread - spread / 2);
    const rad = (deg * Math.PI) / 180;
    const speed = 3.5 + Math.random() * 6.5;
    out.push({
      x: cx, y: cy,
      vx: Math.cos(rad) * speed * sign,
      vy: Math.sin(rad) * speed - 1.5,
      ay: 0.18,
      size: 2.5 + Math.random() * 5.5,
      color: palette[Math.floor(Math.random() * palette.length)],
      life: 1, decay: 0.018 + Math.random() * 0.02,
      kind: "dot", ringRadius: 0, ringExpand: 0,
    });
  }

  // Velocity-aligned sparks
  for (let i = 0; i < 8; i++) {
    const deg = sign * (Math.random() * 90 - 45);
    const rad = (deg * Math.PI) / 180;
    const speed = 5 + Math.random() * 9;
    out.push({
      x: cx, y: cy,
      vx: Math.cos(rad) * speed * sign,
      vy: Math.sin(rad) * speed - 2,
      ay: 0.14,
      size: 1.5 + Math.random() * 2,
      color: palette[Math.floor(Math.random() * palette.length)],
      life: 1, decay: 0.025 + Math.random() * 0.025,
      kind: "spark", ringRadius: 0, ringExpand: 0,
    });
  }

  return out;
}

function makeTrail(cx: number, cy: number, direction: "right" | "left"): Particle[] {
  const palette = direction === "right" ? GREEN : RED;
  const sign = direction === "right" ? 1 : -1;
  return Array.from({ length: 2 }, () => ({
    x: cx + (Math.random() - 0.5) * 30,
    y: cy + (Math.random() - 0.5) * 40,
    vx: sign * (0.5 + Math.random() * 1.5),
    vy: -0.5 - Math.random() * 1.5,
    ay: 0.05,
    size: 1.5 + Math.random() * 3,
    color: palette[Math.floor(Math.random() * palette.length)],
    life: 0.7 + Math.random() * 0.3,
    decay: 0.045 + Math.random() * 0.03,
    kind: "dot" as const, ringRadius: 0, ringExpand: 0,
  }));
}

export const CaptionVoteCarousel = ({
  captions,
}: {
  captions: CaptionWithVotes[];
}) => {
  const [currentCaption, setCurrentCaption] = useState<CaptionWithVotes | null>(captions[0] ?? null);
  const [seenIds, setSeenIds] = useState<string[]>(() => captions[0]?.id ? [captions[0].id] : []);
  const [selectedVote, setSelectedVote] = useState<1 | -1 | 0>(captions[0]?.currentUserVote ?? 0);
  const [status, setStatus] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [swipeDirection, setSwipeDirection] = useState<"left" | "right" | null>(null);

  const [dragX, setDragX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartX = useRef(0);
  const lastTrailX = useRef(0);

  const [undoState, setUndoState] = useState<{ caption: CaptionWithVotes; voteValue: VoteValue } | null>(null);
  const [undoStatus, setUndoStatus] = useState<"idle" | "loading">("idle");

  // Canvas particle engine
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const rafRef = useRef<number | null>(null);

  const animate = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const next: Particle[] = [];

    for (const p of particlesRef.current) {
      p.life -= p.decay;
      if (p.life <= 0) continue;
      next.push(p);

      p.x  += p.vx;
      p.y  += p.vy;
      p.vy += p.ay;
      p.vx *= 0.97;

      const a = Math.max(0, Math.pow(p.life, 0.7));

      if (p.kind === "ring") {
        p.ringRadius += p.ringExpand;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.ringRadius, 0, Math.PI * 2);
        ctx.strokeStyle = hexAlpha(p.color, a * 0.9);
        ctx.lineWidth = 2;
        ctx.stroke();
      } else if (p.kind === "spark") {
        const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
        const len = Math.max(p.size * 2, speed * 2.5);
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(Math.atan2(p.vy, p.vx));
        ctx.beginPath();
        ctx.ellipse(0, 0, len, p.size * 0.45, 0, 0, Math.PI * 2);
        ctx.fillStyle = hexAlpha(p.color, a);
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 6;
        ctx.fill();
        ctx.restore();
      } else {
        // Glowing dot with radial gradient
        const r = p.size * (0.5 + p.life * 0.5);
        const grd = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 2.2);
        grd.addColorStop(0,   hexAlpha(p.color, a));
        grd.addColorStop(0.4, hexAlpha(p.color, a * 0.7));
        grd.addColorStop(1,   hexAlpha(p.color, 0));
        ctx.beginPath();
        ctx.arc(p.x, p.y, r * 2.2, 0, Math.PI * 2);
        ctx.fillStyle = grd;
        ctx.fill();
      }
    }

    particlesRef.current = next;
    rafRef.current = next.length > 0 ? requestAnimationFrame(animate) : null;
  }, []);

  const startAnim = useCallback(() => {
    if (!rafRef.current) rafRef.current = requestAnimationFrame(animate);
  }, [animate]);

  // Resize canvas to match container
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width  = el.offsetWidth;
      canvas.height = el.offsetHeight;
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (currentCaption) setSelectedVote(currentCaption.currentUserVote ?? 0);
  }, [currentCaption?.id]);

  const triggerBurst = useCallback((direction: "right" | "left") => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const cx = direction === "right" ? canvas.width * 0.72 : canvas.width * 0.28;
    const cy = canvas.height * 0.45;
    particlesRef.current.push(...makeBurst(direction, cx, cy));
    startAnim();
  }, [startAnim]);

  const selectedLabel = useMemo(() => {
    if (selectedVote === 1) return "You selected up-vote.";
    if (selectedVote === -1) return "You selected down-vote.";
    return "Tap a vote, swipe, or use ← → keys.";
  }, [selectedVote]);

  const swipeProgress = Math.min(Math.abs(dragX) / SWIPE_THRESHOLD, 1);
  const dragRotate = (dragX / 300) * 12;
  const isSwipingRight = isDragging && dragX > 0;
  const isSwipingLeft  = isDragging && dragX < 0;

  const loadNextCaption = async () => {
    try {
      const response = await fetch("/api/captions/next", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ excludeIds: seenIds }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.caption) {
        setStatus("error");
        setMessage(payload?.error ?? "Unable to load the next caption.");
        setSwipeDirection(null);
        return;
      }
      const nextCaption = payload.caption as CaptionWithVotes;
      setCurrentCaption(nextCaption);
      setSelectedVote(nextCaption.currentUserVote ?? 0);
      setSeenIds((prev) => prev.includes(nextCaption.id) ? prev : [...prev, nextCaption.id]);
      setStatus("idle");
      setMessage(null);
      setSwipeDirection(null);
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Unable to load the next caption.");
      setSwipeDirection(null);
    }
  };

  const submitVote = async (voteValue: VoteValue) => {
    if (!currentCaption) { setStatus("error"); setMessage("No caption selected."); return; }
    setUndoState({ caption: currentCaption, voteValue });
    setStatus("saving"); setMessage(null); setSelectedVote(voteValue);
    triggerBurst(voteValue === 1 ? "right" : "left");
    try {
      const response = await fetch("/api/caption-votes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ captionId: currentCaption.id, voteValue }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) { setStatus("error"); setMessage(payload?.error ?? "Unable to submit your vote."); return; }
      setSwipeDirection(voteValue === 1 ? "right" : "left");
      setTimeout(() => { void loadNextCaption(); }, 420);
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Unable to submit your vote.");
    }
  };

  const refreshCaption = async () => {
    if (!currentCaption) return;
    setStatus("saving"); setMessage(null);
    setSwipeDirection("right");
    setTimeout(() => { void loadNextCaption(); }, 420);
  };

  const handleUndo = async () => {
    if (!undoState || undoStatus === "loading") return;
    setUndoStatus("loading");
    try {
      await fetch("/api/caption-votes", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ captionId: undoState.caption.id }),
      });
    } catch { /* best-effort */ }
    setCurrentCaption(undoState.caption);
    setSelectedVote(0);
    setSeenIds((prev) => prev.filter((id) => id !== undoState.caption.id));
    setSwipeDirection(null); setStatus("idle"); setMessage(null);
    setUndoState(null); setUndoStatus("idle");
  };

  // Keyboard voting
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (status === "saving") return;
      if (e.key === "ArrowRight") { e.preventDefault(); void submitVote(1); }
      if (e.key === "ArrowLeft")  { e.preventDefault(); void submitVote(-1); }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, currentCaption, seenIds]);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (status === "saving") return;
    dragStartX.current = e.clientX;
    lastTrailX.current = e.clientX;
    setIsDragging(true);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    const newDragX = e.clientX - dragStartX.current;
    setDragX(newDragX);

    // Emit trail particles every ~10px of movement
    if (Math.abs(e.clientX - lastTrailX.current) > 10 && Math.abs(newDragX) > 18) {
      lastTrailX.current = e.clientX;
      const canvas = canvasRef.current;
      if (canvas) {
        const cx = canvas.width / 2 + newDragX * 0.4;
        const cy = canvas.height * 0.45;
        particlesRef.current.push(...makeTrail(cx, cy, newDragX > 0 ? "right" : "left"));
        startAnim();
      }
    }
  };

  const handlePointerUp = () => {
    if (!isDragging) return;
    setIsDragging(false);
    if (dragX >= SWIPE_THRESHOLD) {
      setDragX(0); void submitVote(1);
    } else if (dragX <= -SWIPE_THRESHOLD) {
      setDragX(0); void submitVote(-1);
    } else {
      setDragX(0);
    }
  };

  if (!currentCaption) {
    return (
      <div className="glass-card rounded-2xl px-6 py-16 text-center" style={{ color: "var(--muted)" }}>
        No captions available.
      </div>
    );
  }

  return (
    <div className="glass-card rounded-2xl overflow-hidden">
      <div
        className="px-5 py-3 text-[10px] font-semibold uppercase tracking-widest"
        style={{
          color: "var(--accent-bright)",
          borderBottom: "1px solid var(--border)",
          background: "linear-gradient(90deg, rgba(37,99,235,0.08), transparent)"
        }}
      >
        Caption feed
      </div>

      <div className="p-5">
        {/* Swipeable image + particle canvas container */}
        <div ref={containerRef} className="relative flex items-center justify-center select-none overflow-hidden rounded-xl">

          {/* Canvas particle layer */}
          <canvas
            ref={canvasRef}
            className="pointer-events-none absolute inset-0 z-30"
            style={{ width: "100%", height: "100%" }}
          />

          {/* Downvote (left) badge */}
          <div
            className="pointer-events-none absolute left-4 top-1/2 z-20 flex h-16 w-16 items-center justify-center rounded-full text-2xl font-bold"
            style={{
              opacity: isSwipingLeft ? swipeProgress : 0,
              transform: `translateY(-50%) scale(${isSwipingLeft ? 0.6 + swipeProgress * 0.4 : 0.6})`,
              background: "rgba(239,68,68,0.85)",
              border: "3px solid #ef4444",
              boxShadow: `0 0 ${Math.round(swipeProgress * 28)}px rgba(239,68,68,0.7), 0 0 ${Math.round(swipeProgress * 52)}px rgba(239,68,68,0.3)`,
              color: "#fff",
              transition: isDragging ? "none" : "opacity 0.2s, transform 0.2s",
            }}
          >
            ✕
          </div>

          {/* Upvote (right) badge */}
          <div
            className="pointer-events-none absolute right-4 top-1/2 z-20 flex h-16 w-16 items-center justify-center rounded-full text-2xl font-bold"
            style={{
              opacity: isSwipingRight ? swipeProgress : 0,
              transform: `translateY(-50%) scale(${isSwipingRight ? 0.6 + swipeProgress * 0.4 : 0.6})`,
              background: "rgba(34,197,94,0.85)",
              border: "3px solid #22c55e",
              boxShadow: `0 0 ${Math.round(swipeProgress * 28)}px rgba(34,197,94,0.7), 0 0 ${Math.round(swipeProgress * 52)}px rgba(34,197,94,0.3)`,
              color: "#fff",
              transition: isDragging ? "none" : "opacity 0.2s, transform 0.2s",
            }}
          >
            ✓
          </div>

          {/* Background tint */}
          {isDragging && (
            <div
              className="pointer-events-none absolute inset-0 z-10 rounded-xl"
              style={{
                background: isSwipingRight
                  ? `rgba(34,197,94,${swipeProgress * 0.1})`
                  : `rgba(239,68,68,${swipeProgress * 0.1})`,
              }}
            />
          )}

          {/* Draggable card */}
          <div
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            className={
              swipeDirection === "right" ? "caption-swipe-right"
              : swipeDirection === "left" ? "caption-swipe-left"
              : ""
            }
            style={{
              transform: isDragging
                ? `translate3d(${dragX}px, 0, 0) rotate(${dragRotate}deg)`
                : undefined,
              transition: isDragging ? "none" : "transform 0.25s cubic-bezier(0.34,1.56,0.64,1)",
              cursor: isDragging ? "grabbing" : "grab",
              touchAction: "none",
              willChange: "transform",
              position: "relative",
              zIndex: 15,
            }}
          >
            {currentCaption.imageUrl ? (
              <img
                src={currentCaption.imageUrl}
                alt="Caption context"
                className="mx-auto max-h-[55vh] w-full max-w-3xl rounded-xl object-contain"
                style={{
                  border: `1px solid ${isSwipingRight ? "rgba(34,197,94,0.6)" : isSwipingLeft ? "rgba(239,68,68,0.6)" : "var(--border)"}`,
                  boxShadow: isSwipingRight
                    ? `0 0 ${Math.round(swipeProgress * 28)}px rgba(34,197,94,0.35)`
                    : isSwipingLeft
                    ? `0 0 ${Math.round(swipeProgress * 28)}px rgba(239,68,68,0.35)`
                    : undefined,
                  transition: isDragging ? "none" : "border-color 0.2s, box-shadow 0.2s",
                  pointerEvents: "none",
                  userSelect: "none",
                }}
                draggable={false}
              />
            ) : (
              <div
                className="mx-auto flex max-w-3xl items-center justify-center rounded-xl"
                style={{
                  height: "160px",
                  border: "1px solid var(--border)",
                  background: "rgba(6,20,40,0.5)",
                  color: "var(--muted)",
                  fontSize: "0.85rem",
                }}
              >
                No image
              </div>
            )}
          </div>
        </div>

        <p className="mt-2 text-center text-[10px] uppercase tracking-widest" style={{ color: "var(--muted)", opacity: 0.5 }}>
          Swipe, click, or use ← → arrow keys
        </p>

        <p className="mx-auto mt-4 max-w-3xl whitespace-pre-wrap text-center text-lg leading-relaxed" style={{ color: "var(--ink)" }}>
          {currentCaption.content}
        </p>

        <div className="mt-2 text-center text-xs" style={{ color: "var(--muted)" }}>
          Created {new Date(currentCaption.created_datetime_utc).toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" })}
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-center gap-4 text-xs" style={{ color: "var(--muted)" }}>
          <span className="flex items-center gap-1">
            <span style={{ color: "var(--accent-bright)" }}>↑</span> {currentCaption.upvotes} up-votes
          </span>
          <span className="flex items-center gap-1">
            <span style={{ color: "#f87171" }}>↓</span> {currentCaption.downvotes} down-votes
          </span>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          {[1, -1].map((value) => {
            const voteValue = value as VoteValue;
            const isSelected = selectedVote === voteValue;
            return (
              <button
                key={voteValue}
                type="button"
                onClick={() => { if (status !== "saving") void submitVote(voteValue); }}
                className="flex h-12 w-12 items-center justify-center rounded-xl text-xl transition-all duration-200 hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
                style={
                  isSelected
                    ? { background: "rgba(37,99,235,0.2)", border: "1px solid rgba(37,99,235,0.6)", boxShadow: "0 0 12px rgba(37,99,235,0.35)" }
                    : { background: "rgba(255,255,255,0.04)", border: "1px solid var(--border)" }
                }
                disabled={status === "saving"}
                aria-pressed={isSelected}
                aria-label={voteLabels[voteValue]}
              >
                {voteValue === 1 ? "👍" : "👎"}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => { if (status !== "saving") void refreshCaption(); }}
            className="flex h-12 w-12 items-center justify-center rounded-xl text-lg transition-all duration-200 hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--border)" }}
            disabled={status === "saving"}
            aria-label="Skip caption"
            title="Skip caption"
          >
            →
          </button>

          {undoState ? (
            <button
              type="button"
              onClick={() => { void handleUndo(); }}
              disabled={undoStatus === "loading"}
              className="flex h-12 items-center gap-1.5 rounded-xl px-3 text-xs font-semibold uppercase tracking-wider transition-all duration-200 hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
              style={{
                background: "rgba(234,179,8,0.1)",
                border: "1px solid rgba(234,179,8,0.4)",
                color: "#fbbf24",
              }}
              aria-label="Undo last vote"
            >
              {undoStatus === "loading" ? (
                <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
              ) : <span>↩</span>}
              Undo
            </button>
          ) : null}
        </div>

        <p className="mt-3 text-center text-xs" style={{ color: "var(--muted)" }}>{selectedLabel}</p>

        {message ? (
          <p
            role={status === "error" ? "alert" : "status"}
            className="mt-4 text-center text-xs rounded-lg px-3 py-2"
            style={{
              color: status === "error" ? "#f87171" : "var(--muted)",
              background: status === "error" ? "rgba(248,113,113,0.1)" : "transparent",
              border: status === "error" ? "1px solid rgba(248,113,113,0.3)" : "none"
            }}
          >
            {message}
          </p>
        ) : null}
      </div>
    </div>
  );
};
