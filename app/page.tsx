import Link from "next/link";
import { createSupabaseAdminClient } from "@/lib/supabase-server";
import { getAuthState } from "@/lib/auth";
import { AuthHeader } from "@/app/components/AuthHeader";
import { DashboardCaptionCard } from "@/app/components/DashboardCaptionCard";

type CaptionRow = {
  id: string;
  content: string | null;
  created_datetime_utc: string;
  image_id: string | null;
  is_public: boolean;
};

type VoteRow = {
  caption_id: string;
  profile_id: string;
  vote_value: number;
};

type ImageRow = {
  id: string;
  url: string | null;
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

const fetchPopularCaptions = async () => {
  const supabaseAdmin = createSupabaseAdminClient();

  if (!supabaseAdmin) {
    return {
      data: [] as CaptionRow[],
      votes: [] as VoteRow[],
      images: [] as ImageRow[],
      error:
        "Missing Supabase server credentials. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
    };
  }

  const { data: captions, error: captionError } = await supabaseAdmin
    .from("captions")
    .select("id,content,created_datetime_utc,image_id,is_public")
    .eq("is_public", true)
    .not("content", "is", null)
    .neq("content", "")
    .order("created_datetime_utc", { ascending: false })
    .limit(48);

  if (captionError) {
    return { data: [], votes: [], images: [], error: captionError.message };
  }

  const captionIds = (captions ?? []).map((caption) => caption.id);
  const imageIds = Array.from(
    new Set(
      (captions ?? [])
        .map((caption) => caption.image_id)
        .filter((id): id is string => Boolean(id))
    )
  );

  const { data: votes } =
    captionIds.length > 0
      ? await supabaseAdmin
          .from("caption_votes")
          .select("caption_id,profile_id,vote_value")
          .in("caption_id", captionIds)
      : { data: [] as VoteRow[] };

  const { data: images } =
    imageIds.length > 0
      ? await supabaseAdmin.from("images").select("id,url").in("id", imageIds)
      : { data: [] as ImageRow[] };

  return {
    data: captions ?? [],
    votes: votes ?? [],
    images: images ?? [],
    error: null,
  };
};

export default async function DashboardPage() {
  const { user, profile } = await getAuthState();

  const { data, votes, images, error } = await fetchPopularCaptions();

  const voteTotals = new Map<string, { up: number; down: number }>();
  (data ?? []).forEach((caption) =>
    voteTotals.set(caption.id, { up: 0, down: 0 })
  );
  (votes ?? []).forEach((vote) => {
    const entry = voteTotals.get(vote.caption_id);
    if (!entry) return;
    if (vote.vote_value === 1) entry.up += 1;
    if (vote.vote_value === -1) entry.down += 1;
  });

  const currentUserVotes = new Map<string, 1 | -1 | 0>();
  if (user) {
    (votes ?? []).forEach((vote) => {
      if (vote.profile_id === user.id) {
        currentUserVotes.set(
          vote.caption_id,
          vote.vote_value === 1 ? 1 : -1
        );
      }
    });
  }

  const imageMap = new Map<string, string | null>();
  (images ?? []).forEach((image) => imageMap.set(image.id, image.url));

  const items = (data ?? [])
    .map((caption) => ({
      ...caption,
      upvotes: voteTotals.get(caption.id)?.up ?? 0,
      downvotes: voteTotals.get(caption.id)?.down ?? 0,
      imageUrl: caption.image_id ? imageMap.get(caption.image_id) ?? null : null,
      currentUserVote: currentUserVotes.get(caption.id) ?? 0,
    }))
    .sort((a, b) => b.upvotes - a.upvotes);

  return (
    <main className="relative min-h-screen overflow-hidden bg-[var(--paper)] px-6 py-16">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-24 right-[-10%] h-64 w-64 rounded-full bg-[var(--accent)]/20 blur-3xl" />
        <div className="absolute bottom-0 left-[-12%] h-80 w-80 rounded-full bg-[var(--accent-2)]/20 blur-3xl" />
      </div>
      <div className="relative mx-auto w-full max-w-6xl space-y-10">
        {user ? (
          <AuthHeader user={user} profile={profile} />
        ) : (
          <header className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-black/5 bg-white/80 px-6 py-4 shadow-[var(--shadow)] backdrop-blur">
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">
                Welcome
              </p>
              <div className="text-lg font-semibold text-[var(--ink)]">
                Caption dashboard
              </div>
              <div className="text-xs text-[var(--muted)]">
                Sign in to vote and upload.
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Link
                href="/login"
                className="rounded-full border border-black/20 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--ink)] transition hover:-translate-y-0.5 hover:shadow"
              >
                Log in
              </Link>
              <Link
                href="/upload"
                className="rounded-full border border-black/20 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--ink)] transition hover:-translate-y-0.5 hover:shadow"
              >
                Upload
              </Link>
            </div>
          </header>
        )}
        <header className="space-y-3">
          <p className="text-xs uppercase tracking-[0.4em] text-[var(--muted)]">
            Dashboard
          </p>
          <h1 className="font-display text-4xl tracking-tight sm:text-5xl">
            Most Popular Captions
          </h1>
          <p className="max-w-2xl text-base text-[var(--muted)] sm:text-lg">
            Caption-image pairs ranked by up-votes in descending order.
          </p>
        </header>

        {error ? (
          <p role="alert">Error loading captions: {error}</p>
        ) : items.length === 0 ? (
          <p>No caption pairs available.</p>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {items.map((item) => (
              <DashboardCaptionCard
                key={item.id}
                captionId={item.id}
                content={item.content ?? ""}
                imageUrl={item.imageUrl}
                createdAt={item.created_datetime_utc}
                upvotes={item.upvotes}
                downvotes={item.downvotes}
                currentUserVote={item.currentUserVote}
                isLoggedIn={Boolean(user)}
                loginUrl="/login"
              />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
