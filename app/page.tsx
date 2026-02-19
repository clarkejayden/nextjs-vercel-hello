import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseAdminClient } from "@/lib/supabase-server";
import { getAuthState } from "@/lib/auth";
import { AuthHeader } from "@/app/components/AuthHeader";
import { LogoutButton } from "@/app/components/LogoutButton";

type UserRow = Record<string, unknown>;

const PAGE_SIZE = 6;

export const dynamic = "force-dynamic";
export const revalidate = 0;

const fetchUsers = async (page: number) => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return {
      data: [] as UserRow[],
      error: "Missing Supabase environment variables.",
    };
  }

  const supabaseAdmin = createSupabaseAdminClient();

  if (!supabaseAdmin) {
    return {
      data: [] as UserRow[],
      error:
        "Missing Supabase server credentials. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
    };
  }

  const pageIndex = Math.max(1, page);
  const from = (pageIndex - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("*")
    .not("email", "is", null)
    .order("created_datetime_utc", { ascending: false })
    .range(from, to);

  if (error) {
    return { data: [] as UserRow[], error: error.message };
  }

  return { data: data ?? [], error: null };
};

const UsersList = async ({ page }: { page: number }) => {
  const { data, error } = await fetchUsers(page);

  if (error) {
    return <p role="alert">Error loading users: {error}</p>;
  }

  if (data.length === 0) {
    return <p>No profiles found.</p>;
  }

  const currentPage = Math.max(1, page);
  const prevPage = Math.max(1, currentPage - 1);
  const nextPage = currentPage + 1;

  const fieldLabels: Record<string, string> = {
    id: "Profile ID",
    first_name: "First name",
    last_name: "Last name",
    email: "Email",
    created_datetime_utc: "Created",
    modified_datetime_utc: "Updated",
    is_superadmin: "Superadmin",
    is_in_study: "In study",
    is_matrix_admin: "Matrix admin",
  };

  const formatLabel = (key: string) =>
    fieldLabels[key] ??
    key.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-[var(--muted)]">
        <span>Showing {data.length} profiles</span>
        <span>Page {currentPage}</span>
      </div>

      <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {data.map((user, index) => {
          const rawId = user?.id;
          const key =
            typeof rawId === "string" || typeof rawId === "number"
              ? rawId
              : `user-${index}`;

          return (
            <li
              key={key}
              className="group rounded-2xl border border-black/5 bg-[var(--card)] p-5 shadow-[var(--shadow)] transition hover:-translate-y-1"
            >
              <div className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                Profile
              </div>
              <dl className="mt-4 space-y-2 text-sm text-[var(--ink)]">
                {Object.entries(user).map(([field, value]) => (
                  <div key={field} className="grid grid-cols-[120px_1fr] gap-3">
                    <dt className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                      {formatLabel(field)}
                    </dt>
                    <dd className="text-xs leading-relaxed text-[var(--ink)]">
                      {String(value)}
                    </dd>
                  </div>
                ))}
              </dl>
            </li>
          );
        })}
      </ul>

      <nav className="flex items-center justify-between gap-4">
        <Link
          href={`/?page=${prevPage}`}
          aria-disabled={currentPage === 1}
          className={`rounded-full border px-4 py-2 text-sm transition ${
            currentPage === 1
              ? "pointer-events-none border-black/10 text-[var(--muted)]"
              : "border-black/20 text-[var(--ink)] hover:bg-black/5"
          }`}
        >
          Previous
        </Link>
        <Link
          href={`/?page=${nextPage}`}
          className="rounded-full border border-black/20 px-4 py-2 text-sm text-[var(--ink)] transition hover:bg-black/5"
        >
          Next
        </Link>
      </nav>
    </div>
  );
};

export default async function ListPage({
  searchParams,
}: {
  searchParams?: { page?: string };
}) {
  const pageParam = Number(searchParams?.page);
  const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1;
  const { user, profile, isAuthorized } = await getAuthState();

  if (!user) {
    redirect("/login");
  }

  if (!isAuthorized) {
    return (
      <main className="relative min-h-screen overflow-hidden bg-[var(--paper)] px-6 py-16">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-24 right-[-10%] h-64 w-64 rounded-full bg-[var(--accent)]/20 blur-3xl" />
          <div className="absolute bottom-0 left-[-12%] h-80 w-80 rounded-full bg-[var(--accent-2)]/20 blur-3xl" />
        </div>
        <div className="relative mx-auto w-full max-w-3xl space-y-8">
          <div className="rounded-3xl border border-black/5 bg-white/90 p-8 shadow-[var(--shadow)] backdrop-blur">
            <p className="text-xs uppercase tracking-[0.4em] text-[var(--muted)]">
              Access denied
            </p>
            <h1 className="mt-3 font-display text-4xl tracking-tight sm:text-5xl">
              Your account is not authorized
            </h1>
            <p className="mt-3 text-base text-[var(--muted)] sm:text-lg">
              Signed in as {user.email ?? "your account"}, but the profile does
              not have access flags enabled. Contact an administrator to grant
              access.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <LogoutButton className="rounded-full border border-black/20 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--ink)] transition hover:-translate-y-0.5 hover:shadow" />
              <Link
                href="/login"
                className="rounded-full border border-black/20 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--ink)] transition hover:-translate-y-0.5 hover:shadow"
              >
                Return to sign in
              </Link>
            </div>
          </div>
        </div>
      </main>
    );
  }

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
            Directory
          </p>
          <h1 className="font-display text-4xl tracking-tight sm:text-5xl">
            Profiles
          </h1>
          <p className="max-w-2xl text-base text-[var(--muted)] sm:text-lg">
            A curated view of profiles that include a verified email.
          </p>
        </header>
        <Suspense fallback={<p>Loading profiles...</p>}>
          <UsersList page={page} />
        </Suspense>
      </div>
    </main>
  );
}
