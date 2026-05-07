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
  const supabaseAdmin = createSupabaseAdminClient();
  if (!supabaseAdmin) return { data: [] as UserRow[], error: "Missing Supabase server credentials." };

  const pageIndex = Math.max(1, page);
  const from = (pageIndex - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("*")
    .not("email", "is", null)
    .order("created_datetime_utc", { ascending: false })
    .range(from, to);

  if (error) return { data: [] as UserRow[], error: error.message };
  return { data: data ?? [], error: null };
};

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
  fieldLabels[key] ?? key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

const UsersList = async ({ page }: { page: number }) => {
  const { data, error } = await fetchUsers(page);

  if (error) return <p role="alert" style={{ color: "#f87171" }}>Error loading users: {error}</p>;
  if (data.length === 0) return <p style={{ color: "var(--muted)" }}>No profiles found.</p>;

  const currentPage = Math.max(1, page);
  const prevPage = Math.max(1, currentPage - 1);
  const nextPage = currentPage + 1;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs" style={{ color: "var(--muted)" }}>
        <span>Showing {data.length} profiles</span>
        <span>Page {currentPage}</span>
      </div>

      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {data.map((user, index) => {
          const rawId = user?.id;
          const key = typeof rawId === "string" || typeof rawId === "number" ? rawId : `user-${index}`;

          return (
            <li
              key={key}
              className="glass-card rounded-2xl p-5 transition-all duration-200 hover:-translate-y-0.5"
              style={{ borderColor: "var(--border)" }}
            >
              <p
                className="mb-3 text-[10px] font-semibold uppercase tracking-widest"
                style={{ color: "var(--accent-bright)" }}
              >
                Profile
              </p>
              <dl className="space-y-2">
                {Object.entries(user).map(([field, value]) => (
                  <div key={field} className="grid grid-cols-[110px_1fr] gap-2">
                    <dt className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--muted)" }}>
                      {formatLabel(field)}
                    </dt>
                    <dd className="truncate text-xs" style={{ color: "var(--ink)" }}>
                      {String(value)}
                    </dd>
                  </div>
                ))}
              </dl>
            </li>
          );
        })}
      </ul>

      <nav className="flex items-center justify-between gap-4 pt-2">
        <Link
          href={`/list?page=${prevPage}`}
          aria-disabled={currentPage === 1}
          className={`btn-ghost rounded-xl px-4 py-2 text-xs font-semibold uppercase tracking-wider ${currentPage === 1 ? "pointer-events-none opacity-30" : ""}`}
        >
          ← Previous
        </Link>
        <Link
          href={`/list?page=${nextPage}`}
          className="btn-ghost rounded-xl px-4 py-2 text-xs font-semibold uppercase tracking-wider"
        >
          Next →
        </Link>
      </nav>
    </div>
  );
};

export default async function ListPage({ searchParams }: { searchParams?: { page?: string } }) {
  const pageParam = Number(searchParams?.page);
  const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1;
  const { user, profile, isAuthorized } = await getAuthState();

  if (!user) redirect("/login");

  if (!isAuthorized) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6 py-16">
        <div className="w-full max-w-lg">
          <div className="glass-card rounded-2xl p-8 space-y-4">
            <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "#f87171" }}>
              Access Denied
            </p>
            <h1 className="text-2xl font-bold" style={{ color: "var(--ink)" }}>
              Account not authorized
            </h1>
            <p className="text-sm" style={{ color: "var(--muted)" }}>
              Signed in as <span style={{ color: "var(--ink)" }}>{user.email ?? "your account"}</span>, but this profile does not have access flags enabled. Contact an administrator to grant access.
            </p>
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <LogoutButton className="btn-ghost rounded-xl px-4 py-2 text-xs font-semibold uppercase tracking-wider" />
              <Link href="/login" className="btn-ghost rounded-xl px-4 py-2 text-xs font-semibold uppercase tracking-wider">
                Return to sign in
              </Link>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-6 py-12">
      <div className="mx-auto w-full max-w-5xl space-y-10">
        <AuthHeader user={user} profile={profile} />

        <header className="space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--accent-bright)" }}>
            Directory
          </p>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl" style={{ color: "var(--ink)" }}>
            Profiles
          </h1>
          <p className="max-w-2xl text-base sm:text-lg" style={{ color: "var(--muted)" }}>
            A curated view of profiles with verified emails.
          </p>
        </header>

        <Suspense fallback={<p style={{ color: "var(--muted)" }}>Loading profiles...</p>}>
          <UsersList page={page} />
        </Suspense>
      </div>
    </main>
  );
}
