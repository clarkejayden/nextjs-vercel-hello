import Link from "next/link";
import { getAuthState } from "@/lib/auth";
import { OAuthButtons } from "@/app/components/OAuthButtons";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function LoginPage() {
  const { user, profile, isAuthorized } = await getAuthState();

  if (user) {
    return (
      <main className="relative min-h-screen overflow-hidden bg-[var(--paper)] px-6 py-16">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-24 right-[-10%] h-64 w-64 rounded-full bg-[var(--accent)]/20 blur-3xl" />
          <div className="absolute bottom-0 left-[-12%] h-80 w-80 rounded-full bg-[var(--accent-2)]/20 blur-3xl" />
        </div>
        <div className="relative mx-auto w-full max-w-2xl space-y-6">
          <h1 className="font-display text-4xl tracking-tight sm:text-5xl">
            You are already signed in
          </h1>
          <p className="text-base text-[var(--muted)] sm:text-lg">
            {profile?.first_name ?? user.email ?? "Your account"} is connected.
            {isAuthorized
              ? " You have access to the app."
              : " Your account is not authorized yet."}
          </p>
          <Link
            href="/"
            className="inline-flex rounded-full border border-black/20 bg-white px-5 py-3 text-sm font-semibold uppercase tracking-[0.2em] text-[var(--ink)] transition hover:-translate-y-0.5 hover:shadow"
          >
            Continue
          </Link>
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
      <div className="relative mx-auto w-full max-w-xl space-y-8 rounded-3xl border border-black/5 bg-white/90 p-8 shadow-[var(--shadow)] backdrop-blur">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.4em] text-[var(--muted)]">
            Sign in
          </p>
          <h1 className="font-display text-4xl tracking-tight sm:text-5xl">
            Welcome back
          </h1>
          <p className="text-base text-[var(--muted)] sm:text-lg">
            Authenticate with your OAuth provider to access the protected
            dashboard.
          </p>
        </div>
        <OAuthButtons />
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/"
            className="rounded-full border border-black/20 bg-white px-5 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--ink)] transition hover:-translate-y-0.5 hover:shadow"
          >
            Continue as guest
          </Link>
        </div>
        <p className="text-xs text-[var(--muted)]">
          By continuing you will be redirected through OAuth and returned to
          <span className="font-semibold text-[var(--ink)]"> /auth/callback</span>.
        </p>
      </div>
    </main>
  );
}
