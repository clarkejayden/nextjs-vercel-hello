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

      if (vote === 1) {
        setUpvoteCount((prev) => Math.max(0, prev - 1));
      }
      if (vote === -1) {
        setDownvoteCount((prev) => Math.max(0, prev - 1));
      }

      if (voteValue === 1) {
        setUpvoteCount((prev) => prev + 1);
      }
      if (voteValue === -1) {
        setDownvoteCount((prev) => prev + 1);
      }

      setVote(voteValue);
      setStatus("idle");
    } catch (error) {
      setStatus("error");
      setMessage(
        error instanceof Error ? error.message : "Unable to submit your vote."
      );
    }
  };

  return (
    <article className="rounded-3xl border border-black/5 bg-white/80 p-5 shadow-[var(--shadow)] backdrop-blur">
      {imageUrl ? (
        <img
          src={imageUrl}
          alt="Caption context"
          className="mb-4 h-56 w-full rounded-2xl border border-black/10 object-cover"
        />
      ) : (
        <div className="mb-4 flex h-56 items-center justify-center rounded-2xl border border-dashed border-black/10 text-xs text-[var(--muted)]">
          No image available
        </div>
      )}
      <p className="text-base text-[var(--ink)]">{content}</p>
      <div className="mt-4 flex items-center justify-between text-xs text-[var(--muted)]">
        <span>Up-votes: {upvoteCount}</span>
        <span>Down-votes: {downvoteCount}</span>
        <span>{new Date(createdAt).toLocaleDateString()}</span>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        {[1, -1].map((value) => {
          const voteValue = value as VoteValue;
          const isSelected = vote === voteValue;
          return (
            <button
              key={voteValue}
              type="button"
              onClick={() => void handleVote(voteValue)}
              disabled={status === "saving"}
              className={`flex h-10 w-10 items-center justify-center rounded-full border text-lg transition hover:-translate-y-0.5 hover:shadow disabled:cursor-not-allowed disabled:opacity-60 ${
                isSelected
                  ? "border-black/60 bg-black/5 text-[var(--ink)]"
                  : "border-black/20 bg-white text-[var(--ink)]"
              }`}
              aria-pressed={isSelected}
              aria-label={voteValue === 1 ? "Up-vote" : "Down-vote"}
            >
              {voteValue === 1 ? "\u{1F44D}" : "\u{1F44E}"}
            </button>
          );
        })}
      </div>
      {message ? (
        <p
          role={status === "error" ? "alert" : "status"}
          className={`mt-3 text-xs ${
            status === "error" ? "text-red-600" : "text-[var(--muted)]"
          }`}
        >
          {message}
        </p>
      ) : null}
    </article>
  );
};
