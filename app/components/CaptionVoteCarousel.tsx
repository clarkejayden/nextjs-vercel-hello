"use client";

import { useEffect, useMemo, useState } from "react";

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

export const CaptionVoteCarousel = ({
  captions,
}: {
  captions: CaptionWithVotes[];
}) => {
  const [currentCaption, setCurrentCaption] = useState<CaptionWithVotes | null>(
    captions[0] ?? null
  );
  const [seenIds, setSeenIds] = useState<string[]>(() =>
    captions[0]?.id ? [captions[0].id] : []
  );
  const [selectedVote, setSelectedVote] = useState<1 | -1 | 0>(
    captions[0]?.currentUserVote ?? 0
  );
  const [status, setStatus] = useState<"idle" | "saving" | "success" | "error">(
    "idle"
  );
  const [message, setMessage] = useState<string | null>(null);
  const [swipeDirection, setSwipeDirection] = useState<"left" | "right" | null>(
    null
  );

  useEffect(() => {
    if (currentCaption) {
      setSelectedVote(currentCaption.currentUserVote ?? 0);
    }
  }, [currentCaption?.id]);

  const selectedLabel = useMemo(() => {
    if (selectedVote === 1) return "You selected up-vote.";
    if (selectedVote === -1) return "You selected down-vote.";
    return "Tap a vote to submit.";
  }, [selectedVote]);

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
      setSeenIds((prev) =>
        prev.includes(nextCaption.id) ? prev : [...prev, nextCaption.id]
      );
      setStatus("idle");
      setMessage(null);
      setSwipeDirection(null);
    } catch (error) {
      setStatus("error");
      setMessage(
        error instanceof Error ? error.message : "Unable to load the next caption."
      );
      setSwipeDirection(null);
    }
  };

  const submitVote = async (voteValue: VoteValue) => {
    if (!currentCaption) {
      setStatus("error");
      setMessage("No caption selected.");
      return;
    }

    setStatus("saving");
    setMessage(null);
    setSelectedVote(voteValue);

    try {
      const response = await fetch("/api/caption-votes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          captionId: currentCaption.id,
          voteValue,
        }),
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        setStatus("error");
        setMessage(payload?.error ?? "Unable to submit your vote.");
        return;
      }

      setSwipeDirection(voteValue === 1 ? "right" : "left");

      setTimeout(() => {
        void loadNextCaption();
      }, 420);
    } catch (error) {
      setStatus("error");
      setMessage(
        error instanceof Error ? error.message : "Unable to submit your vote."
      );
    }
  };

  const refreshCaption = async () => {
    if (!currentCaption) return;

    setStatus("saving");
    setMessage(null);

    setSwipeDirection("right");

    setTimeout(() => {
      void loadNextCaption();
    }, 420);
  };

  if (!currentCaption) {
    return <p>No captions available.</p>;
  }

  return (
    <div className="rounded-2xl border border-black/5 bg-[var(--card)] p-6 text-center shadow-[var(--shadow)]">
      <div className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
        Caption feed
      </div>
      <div className="mt-4 flex items-center justify-center">
        <div
          className={`transition ${
            swipeDirection === "right"
              ? "caption-swipe-right"
              : swipeDirection === "left"
                ? "caption-swipe-left"
                : ""
          }`}
        >
          {currentCaption.imageUrl ? (
            <img
              src={currentCaption.imageUrl}
              alt="Caption context"
              className="mx-auto max-h-[55vh] w-full max-w-3xl rounded-3xl border border-black/10 object-contain shadow-[var(--shadow)]"
            />
          ) : null}
        </div>
      </div>
      <p className="mx-auto mt-6 max-w-3xl whitespace-pre-wrap text-lg text-[var(--ink)]">
        {currentCaption.content}
      </p>
      <div className="mt-2 text-xs text-[var(--muted)]">
        Created {new Date(currentCaption.created_datetime_utc).toLocaleString()}
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-center gap-4 text-xs text-[var(--muted)]">
        <span>Up-votes: {currentCaption.upvotes}</span>
        <span>Down-votes: {currentCaption.downvotes}</span>
      </div>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-4">
        {[1, -1].map((value) => {
          const voteValue = value as VoteValue;
          const isSelected = selectedVote === voteValue;
          return (
            <button
              key={voteValue}
              type="button"
              onClick={() => {
                if (status === "saving") return;
                void submitVote(voteValue);
              }}
              className={`flex h-12 w-12 items-center justify-center rounded-full border text-xl transition hover:-translate-y-0.5 hover:shadow disabled:cursor-not-allowed disabled:opacity-60 ${
                isSelected
                  ? "border-black/60 bg-black/5 text-[var(--ink)]"
                  : "border-black/20 bg-white text-[var(--ink)]"
              }`}
              disabled={status === "saving"}
              aria-pressed={isSelected}
              aria-label={voteLabels[voteValue]}
            >
              {voteValue === 1 ? "\u{1F44D}" : "\u{1F44E}"}
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => {
            if (status === "saving") return;
            void refreshCaption();
          }}
          className="flex h-12 w-12 items-center justify-center rounded-full border border-black/20 bg-white text-lg transition hover:-translate-y-0.5 hover:shadow disabled:cursor-not-allowed disabled:opacity-60"
          disabled={status === "saving"}
          aria-label="Refresh caption"
          title="Refresh caption"
        >
          {"\u{1F504}"}
        </button>
      </div>
      <p className="mt-3 text-xs text-[var(--muted)]">{selectedLabel}</p>
      {message ? (
        <p
          role={status === "error" ? "alert" : "status"}
          className={`mt-5 text-xs ${
            status === "error" ? "text-red-600" : "text-[var(--muted)]"
          }`}
        >
          {message}
        </p>
      ) : null}
    </div>
  );
};
