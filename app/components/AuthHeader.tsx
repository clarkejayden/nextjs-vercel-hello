import Link from "next/link";
import { LogoutButton } from "@/app/components/LogoutButton";
import type { Profile } from "@/lib/auth";
import type { User } from "@supabase/supabase-js";

export const AuthHeader = ({
  user,
  profile,
}: {
  user: User;
  profile: Profile | null;
}) => {
  const displayName =
    profile?.first_name || profile?.last_name
      ? `${profile?.first_name ?? ""} ${profile?.last_name ?? ""}`.trim()
      : user.email ?? "Signed-in user";

  return (
    <header className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-black/5 bg-white/80 px-6 py-4 shadow-[var(--shadow)] backdrop-blur">
      <div className="space-y-1">
        <p className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">
          Signed in
        </p>
        <div className="text-lg font-semibold text-[var(--ink)]">
          {displayName}
        </div>
        <div className="text-xs text-[var(--muted)]">{user.email}</div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href="/"
          className="rounded-full border border-black/20 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--ink)] transition hover:-translate-y-0.5 hover:shadow"
        >
          Dashboard
        </Link>
        <LogoutButton className="rounded-full border border-black/20 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--ink)] transition hover:-translate-y-0.5 hover:shadow" />
      </div>
    </header>
  );
};
