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
      error: "Missing Supabase server credentials. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
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

  if (captionError) return { data: [], votes: [], images: [], error: captionError.message };

  const captionIds = (captions ?? []).map((c) => c.id);
  const imageIds = Array.from(new Set((captions ?? []).map((c) => c.image_id).filter((id): id is string => Boolean(id))));

  const { data: votes } = captionIds.length > 0
    ? await supabaseAdmin.from("caption_votes").select("caption_id,profile_id,vote_value").in("caption_id", captionIds)
    : { data: [] as VoteRow[] };

  const { data: images } = imageIds.length > 0
    ? await supabaseAdmin.from("images").select("id,url").in("id", imageIds)
    : { data: [] as ImageRow[] };

  return { data: captions ?? [], votes: votes ?? [], images: images ?? [], error: null };
};

export default async function DashboardPage() {
  const { user, profile } = await getAuthState();
  const { data, votes, images, error } = await fetchPopularCaptions();

  const voteTotals = new Map<string, { up: number; down: number }>();
  (data ?? []).forEach((caption) => voteTotals.set(caption.id, { up: 0, down: 0 }));
  (votes ?? []).forEach((vote) => {
    const entry = voteTotals.get(vote.caption_id);
    if (!entry) return;
    if (vote.vote_value === 1) entry.up += 1;
    if (vote.vote_value === -1) entry.down += 1;
  });

  const currentUserVotes = new Map<string, 1 | -1 | 0>();
  if (user) {
    (votes ?? []).forEach((vote) => {
      if (vote.profile_id === user.id) currentUserVotes.set(vote.caption_id, vote.vote_value === 1 ? 1 : -1);
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
    <main className="relative min-h-screen overflow-hidden px-6 py-12" style={{ background: "var(--paper)" }}>
      <div className="relative mx-auto w-full max-w-6xl space-y-10">
        {user ? (
          <AuthHeader user={user} profile={profile} />
        ) : (
          <header className="glass-card flex flex-wrap items-center justify-between gap-4 rounded-2xl px-6 py-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--muted)" }}>Welcome</p>
              <div className="text-sm font-semibold" style={{ color: "var(--ink)" }}>Caption dashboard</div>
              <div className="text-xs" style={{ color: "var(--muted)" }}>Sign in to vote and upload.</div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Link href="/login" className="btn-ghost rounded-xl px-4 py-2 text-xs font-semibold uppercase tracking-wider">
                Log in
              </Link>
              <Link href="/upload" className="btn-ghost rounded-xl px-4 py-2 text-xs font-semibold uppercase tracking-wider">
                Upload
              </Link>
            </div>
          </header>
        )}

        <header className="space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--accent-bright)" }}>
            Dashboard
          </p>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl" style={{ color: "var(--ink)" }}>
            Most Popular Captions
          </h1>
          <p className="max-w-2xl text-base sm:text-lg" style={{ color: "var(--muted)" }}>
            Caption-image pairs ranked by up-votes in descending order.
          </p>
        </header>

        {error ? (
          <p role="alert" className="text-sm" style={{ color: "#f87171" }}>Error loading captions: {error}</p>
        ) : items.length === 0 ? (
          <p style={{ color: "var(--muted)" }}>No caption pairs available.</p>
        ) : (
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
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
