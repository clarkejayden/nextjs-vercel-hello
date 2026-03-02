import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAuthState } from "@/lib/auth";
import { AuthHeader } from "@/app/components/AuthHeader";
import { CaptionVoteCarousel } from "@/app/components/CaptionVoteCarousel";

type CaptionRow = {
  id: string;
  content: string | null;
  created_datetime_utc: string;
  is_public: boolean;
  image_id: string | null;
};

type ImageRow = {
  id: string;
  url: string | null;
};

type VoteRow = {
  caption_id: string;
  profile_id: string;
  vote_value: number;
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

const fetchCaptions = async () => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("captions")
    .select("id,content,created_datetime_utc,is_public,image_id")
    .eq("is_public", true)
    .not("content", "is", null)
    .neq("content", "")
    .order("created_datetime_utc", { ascending: false })
    .limit(12);

  if (error) {
    return { data: [] as CaptionRow[], error: error.message };
  }

  return { data: data ?? [], error: null };
};

export default async function CaptionsPage() {
  const { user, profile } = await getAuthState();

  if (!user) {
    redirect("/login");
  }

  const { data, error } = await fetchCaptions();
  const filtered = data;
  const supabase = await createSupabaseServerClient();
  const captionIds = filtered.map((caption) => caption.id);
  const imageIds = Array.from(
    new Set(
      filtered
        .map((caption) => caption.image_id)
        .filter((id): id is string => Boolean(id))
    )
  );
  const { data: votes } =
    captionIds.length > 0
      ? await supabase
          .from("caption_votes")
          .select("caption_id,profile_id,vote_value")
          .in("caption_id", captionIds)
      : { data: [] as VoteRow[] };
  const { data: images } =
    imageIds.length > 0
      ? await supabase
          .from("images")
          .select("id,url")
          .in("id", imageIds)
      : { data: [] as ImageRow[] };

  const voteTotals = new Map<
    string,
    { up: number; down: number; currentUserVote: 1 | -1 | 0 }
  >();

  for (const caption of filtered) {
    voteTotals.set(caption.id, { up: 0, down: 0, currentUserVote: 0 });
  }

  (votes ?? []).forEach((vote) => {
    const entry = voteTotals.get(vote.caption_id);
    if (!entry) return;
    if (vote.vote_value === 1) entry.up += 1;
    if (vote.vote_value === -1) entry.down += 1;
    if (vote.profile_id === user.id) {
      entry.currentUserVote = vote.vote_value === 1 ? 1 : -1;
    }
  });

  const imageMap = new Map<string, string | null>();
  (images ?? []).forEach((image) => {
    imageMap.set(image.id, image.url);
  });

  return (
    <main className="relative min-h-screen overflow-hidden bg-[var(--paper)] px-6 py-16">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-24 right-[-10%] h-64 w-64 rounded-full bg-[var(--accent)]/20 blur-3xl" />
        <div className="absolute bottom-0 left-[-12%] h-80 w-80 rounded-full bg-[var(--accent-2)]/20 blur-3xl" />
      </div>
      <div className="relative mx-auto w-full max-w-5xl space-y-10">
        <AuthHeader user={user} profile={profile} />
        <header className="space-y-3">
          <p className="text-xs uppercase tracking-[0.4em] text-[var(--muted)]">
            Community
          </p>
          <h1 className="font-display text-4xl tracking-tight sm:text-5xl">
            Caption Ratings
          </h1>
          <p className="max-w-2xl text-base text-[var(--muted)] sm:text-lg">
            Rate public captions with an up-vote or down-vote. Each vote is
            stored in the caption_votes table.
          </p>
        </header>

        {error ? (
          <p role="alert">Error loading captions: {error}</p>
        ) : filtered.length === 0 ? (
          <p>No public captions found.</p>
        ) : (
          <CaptionVoteCarousel
            captions={filtered.map((caption) => {
              const totals = voteTotals.get(caption.id) ?? {
                up: 0,
                down: 0,
                currentUserVote: 0,
              };
              const imageUrl = caption.image_id
                ? imageMap.get(caption.image_id) ?? null
                : null;

              return {
                id: caption.id,
                content: caption.content ?? "",
                created_datetime_utc: caption.created_datetime_utc,
                imageUrl,
                upvotes: totals.up,
                downvotes: totals.down,
                currentUserVote: totals.currentUserVote,
              };
            })}
          />
        )}
      </div>
    </main>
  );
}
