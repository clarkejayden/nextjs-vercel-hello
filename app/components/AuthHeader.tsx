import Link from "next/link";
import { LogoutButton } from "@/app/components/LogoutButton";
import { TutorialTour } from "@/app/components/TutorialTour";
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

  const initials = (displayName ?? "?").slice(0, 2).toUpperCase();

  return (
    <header className="glass-card flex flex-wrap items-center justify-between gap-4 rounded-2xl px-6 py-4">
      <div className="flex items-center gap-3">
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xs font-bold text-white"
          style={{ background: "linear-gradient(135deg, #1d4ed8, #06b6d4)", boxShadow: "0 0 12px rgba(37,99,235,0.4)" }}
        >
          {initials}
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--muted)" }}>
            Signed in
          </p>
          <div className="text-sm font-semibold" style={{ color: "var(--ink)" }}>
            {displayName}
          </div>
          <div className="text-xs" style={{ color: "var(--muted)" }}>{user.email}</div>
        </div>
      </div>
      <nav className="flex flex-wrap items-center gap-2">
        {[
          { href: "/", label: "Dashboard", tour: "nav-dashboard" },
          { href: "/captions", label: "Captions", tour: "nav-captions" },
          { href: "/upload", label: "Upload", tour: "nav-upload" },
        ].map((item) => (
          <Link
            key={item.href}
            href={item.href}
            data-tour={item.tour}
            className="btn-ghost rounded-xl px-4 py-2 text-xs font-semibold uppercase tracking-wider"
          >
            {item.label}
          </Link>
        ))}
        <TutorialTour />
        <LogoutButton className="btn-ghost rounded-xl px-4 py-2 text-xs font-semibold uppercase tracking-wider" />
      </nav>
    </header>
  );
};
