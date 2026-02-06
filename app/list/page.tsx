type CaptionVote = {
  id: number;
  created_datetime_utc: string;
  modified_datetime_utc: string | null;
  vote_value: number;
  profile_id: string;
  caption_id: string;
};

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

const pad2 = (value: number) => String(value).padStart(2, "0");

const formatTimestamp = (value: string | null) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  const year = date.getUTCFullYear();
  const month = pad2(date.getUTCMonth() + 1);
  const day = pad2(date.getUTCDate());
  const hours = pad2(date.getUTCHours());
  const minutes = pad2(date.getUTCMinutes());
  return `${year}-${month}-${day} ${hours}:${minutes} UTC`;
};

const fetchCaptionVotes = async (page: number) => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return {
      votes: [] as CaptionVote[],
      total: 0,
      error: "Missing Supabase credentials in .env.local.",
    };
  }

  const offset = (page - 1) * PAGE_SIZE;
  const response = await fetch(
    `${supabaseUrl}/rest/v1/caption_votes?select=*&order=created_datetime_utc.desc&limit=${PAGE_SIZE}&offset=${offset}`,
    {
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        Prefer: "count=exact",
      },
      cache: "no-store",
    }
  );

  if (!response.ok) {
    return {
      votes: [] as CaptionVote[],
      total: 0,
      error: `Supabase request failed (${response.status}).`,
    };
  }

  const range = response.headers.get("content-range");
  const total = range ? Number(range.split("/")[1]) : null;
  const votes = (await response.json()) as CaptionVote[];

  return { votes, total, error: null };
};

export default async function ListPage({
  searchParams,
}: {
  searchParams?: { page?: string } | Promise<{ page?: string }>;
}) {
  const resolvedParams = await Promise.resolve(searchParams);
  const pageValue = Number(resolvedParams?.page ?? "1");
  const page = Number.isFinite(pageValue) && pageValue > 0 ? pageValue : 1;
  const { votes, total, error } = await fetchCaptionVotes(page);
  const totalPages =
    total !== null ? Math.max(1, Math.ceil(total / PAGE_SIZE)) : null;
  const hasPrevPage = page > 1;
  const hasNextPage =
    totalPages !== null ? page < totalPages : votes.length === PAGE_SIZE;
  const prevPage = hasPrevPage ? page - 1 : page;
  const nextPage = hasNextPage ? page + 1 : page;

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(255,107,53,0.15),_transparent_55%),_radial-gradient(circle_at_20%_20%,_rgba(25,114,120,0.2),_transparent_45%),_linear-gradient(180deg,_rgba(255,245,230,0.95),_rgba(255,255,255,0.75))]">
      <div className="relative overflow-hidden">
        <div className="pointer-events-none absolute -top-24 right-10 h-64 w-64 rounded-full bg-[conic-gradient(from_120deg,_rgba(255,107,53,0.45),_rgba(25,114,120,0.3),_rgba(255,107,53,0.15))] blur-2xl opacity-80 animate-drift" />
        <div className="pointer-events-none absolute bottom-10 left-6 h-48 w-48 rounded-full bg-[radial-gradient(circle,_rgba(25,114,120,0.35),_transparent_70%)] blur-xl opacity-70 animate-drift" />

        <section className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 pb-8 pt-16">
          <div className="animate-fade-up">
            <p className="text-sm uppercase tracking-[0.4em] text-[var(--muted)]">
              Supabase Caption Votes
            </p>
            <h1 className="font-display mt-3 text-4xl font-semibold text-[var(--ink)] md:text-6xl">
              The Humor Project Caption Votes
            </h1>
            <p className="mt-4 max-w-2xl text-base text-[var(--muted)] md:text-lg">
              A live list of caption votes pulled from Supabase and presented as
              tactile cards with quick-glance metadata.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-sm text-[var(--muted)]">
            <div className="rounded-full border border-[var(--ring)] bg-white/70 px-4 py-2 shadow-[var(--shadow)]">
              Total rows:{" "}
              <span className="font-semibold">
                {total !== null ? total : "—"}
              </span>
            </div>
            <div className="rounded-full border border-[var(--ring)] bg-white/70 px-4 py-2 shadow-[var(--shadow)]">
              Page {page}
              {totalPages !== null ? ` of ${totalPages}` : ""}
            </div>
            <div className="rounded-full border border-[var(--ring)] bg-white/70 px-4 py-2 shadow-[var(--shadow)]">
              Page size: <span className="font-semibold">{PAGE_SIZE}</span>
            </div>
            {error ? (
              <div className="rounded-full border border-[var(--ring)] bg-white/70 px-4 py-2 text-[var(--accent)] shadow-[var(--shadow)]">
                {error}
              </div>
            ) : null}
          </div>
        </section>
      </div>

      <section className="mx-auto w-full max-w-6xl px-6 pb-20">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div className="text-sm text-[var(--muted)]">
            Showing {(page - 1) * PAGE_SIZE + 1}-
            {Math.min(page * PAGE_SIZE, total ?? page * PAGE_SIZE)} of{" "}
            {total ?? "—"}
          </div>
          <div className="flex items-center gap-3">
            <a
              href={`/list?page=${prevPage}`}
              aria-disabled={!hasPrevPage}
              className={`rounded-full border border-[var(--ring)] px-4 py-2 text-sm font-semibold transition ${
                !hasPrevPage
                  ? "cursor-not-allowed bg-white/40 text-[var(--muted)]"
                  : "bg-white text-[var(--ink)] shadow-[var(--shadow)] hover:-translate-y-0.5"
              }`}
            >
              Prev
            </a>
            <a
              href={`/list?page=${nextPage}`}
              aria-disabled={!hasNextPage}
              className={`rounded-full border border-[var(--ring)] px-4 py-2 text-sm font-semibold transition ${
                !hasNextPage
                  ? "cursor-not-allowed bg-white/40 text-[var(--muted)]"
                  : "bg-white text-[var(--ink)] shadow-[var(--shadow)] hover:-translate-y-0.5"
              }`}
            >
              Next
            </a>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
          {votes.map((vote, index) => (
            <article
              key={`${vote.id}-${vote.profile_id}`}
              className="animate-fade-up rounded-3xl border border-[var(--ring)] bg-[var(--card)] p-6 shadow-[var(--shadow)] transition-transform duration-300 hover:-translate-y-1"
              style={{ animationDelay: `${index * 35}ms` }}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.25em] text-[var(--muted)]">
                    Vote ID
                  </p>
                  <p className="text-lg font-semibold text-[var(--ink)]">
                    #{vote.id}
                  </p>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-sm font-semibold ${
                    vote.vote_value > 0
                      ? "bg-[rgba(255,107,53,0.15)] text-[var(--accent)]"
                      : "bg-[rgba(25,114,120,0.15)] text-[var(--accent-2)]"
                  }`}
                >
                  {vote.vote_value > 0 ? "Upvote" : "Downvote"}
                </span>
              </div>

              <div className="mt-5 grid gap-3 text-sm text-[var(--muted)]">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                    Created
                  </p>
                  <p className="text-[var(--ink)]">
                    {formatTimestamp(vote.created_datetime_utc)}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                    Modified
                  </p>
                  <p className="text-[var(--ink)]">
                    {formatTimestamp(vote.modified_datetime_utc)}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                    Profile
                  </p>
                  <p className="break-all text-[var(--ink)]">
                    {vote.profile_id}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                    Caption
                  </p>
                  <p className="break-all text-[var(--ink)]">
                    {vote.caption_id}
                  </p>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
