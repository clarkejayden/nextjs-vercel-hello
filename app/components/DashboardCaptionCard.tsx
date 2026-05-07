"use client";

import { useState } from "react";

type VoteValue = 1 | -1;

type DashboardCaptionCardProps = {
  captionId: string;
  content: string;
  imageUrl: string | null;
  createdAt: string;
  upvotes: number;
  downvotes: number;
  currentUserVote: 1 | -1 | 0;
  isLoggedIn: boolean;
  loginUrl: string;
};

export const DashboardCaptionCard = ({
  captionId,
  content,
  imageUrl,
  createdAt,
  upvotes,
  downvotes,
  currentUserVote,
  isLoggedIn,
  loginUrl,
}: DashboardCaptionCardProps) => {
  const [status, setStatus] = useState<"idle" | "saving" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [vote, setVote] = useState<1 | -1 | 0>(currentUserVote);
  const [upvoteCount, setUpvoteCount] = useState(upvotes);
  const [downvoteCount, setDownvoteCount] = useState(downvotes);

  const handleVote = async (voteValue: VoteValue) => {
    if (!isLoggedIn) {
      window.location.href = loginUrl;
      return;
    }

    setStatus("saving");
    setMessage(null);

    try {
      const response = await fetch("/api/caption-votes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ captionId, voteValue }),
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(payload?.error ?? "Unable to submit your vote.");
      }

      if (vote === 1) setUpvoteCount((prev) => Math.max(0, prev - 1));
      if (vote === -1) setDownvoteCount((prev) => Math.max(0, prev - 1));
      if (voteValue === 1) setUpvoteCount((prev) => prev + 1);
      if (voteValue === -1) setDownvoteCount((prev) => prev + 1);

      setVote(voteValue);
      setStatus("idle");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Unable to submit your vote.");
    }
  };

  return (
    <article className="glass-card group flex flex-col rounded-2xl overflow-hidden transition-all duration-300 hover:shadow-[var(--shadow-glow)]" style={{ borderColor: "var(--border)" }}>
      <div className="relative">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt="Caption context"
            className="h-52 w-full object-cover"
          />
        ) : (
          <div
            className="flex h-52 w-full items-center justify-center text-xs"
            style={{ background: "rgba(37,99,235,0.05)", color: "var(--muted)", borderBottom: "1px solid var(--border)" }}
          >
            No image available
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-[#061428] to-transparent" />
      </div>

      <div className="flex flex-1 flex-col gap-3 p-5">
        <p className="flex-1 text-sm leading-relaxed" style={{ color: "var(--ink)" }}>{content}</p>

        <div className="flex items-center justify-between text-xs" style={{ color: "var(--muted)" }}>
          <span className="flex items-center gap-1">
            <span style={{ color: "var(--accent-bright)" }}>↑</span> {upvoteCount}
          </span>
          <span className="flex items-center gap-1">
            <span style={{ color: "#f87171" }}>↓</span> {downvoteCount}
          </span>
          <span>{new Date(createdAt).toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" })}</span>
        </div>

        <div className="flex items-center gap-2 pt-1" style={{ borderTop: "1px solid var(--border)" }}>
          {[1, -1].map((value) => {
            const voteValue = value as VoteValue;
            const isSelected = vote === voteValue;
            return (
              <button
                key={voteValue}
                type="button"
                onClick={() => void handleVote(voteValue)}
                disabled={status === "saving"}
                className="flex h-9 w-9 items-center justify-center rounded-xl text-base transition-all duration-200 hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
                style={
                  isSelected
                    ? { background: "rgba(37,99,235,0.2)", border: "1px solid rgba(37,99,235,0.6)", boxShadow: "0 0 10px rgba(37,99,235,0.3)" }
                    : { background: "rgba(255,255,255,0.04)", border: "1px solid var(--border)" }
                }
                aria-pressed={isSelected}
                aria-label={voteValue === 1 ? "Up-vote" : "Down-vote"}
              >
                {voteValue === 1 ? "👍" : "👎"}
              </button>
            );
          })}
        </div>

        {message ? (
          <p
            role={status === "error" ? "alert" : "status"}
            className="text-xs"
            style={{ color: status === "error" ? "#f87171" : "var(--muted)" }}
          >
            {message}
          </p>
        ) : null}
      </div>
    </article>
  );
};
