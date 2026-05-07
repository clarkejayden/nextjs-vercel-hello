import Link from "next/link";
import { getAuthState } from "@/lib/auth";
import { OAuthButtons } from "@/app/components/OAuthButtons";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function LoginPage() {
  const { user, profile, isAuthorized } = await getAuthState();

  if (user) {
    return (
      <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-6 py-16" style={{ background: "var(--paper)" }}>
        <div className="relative mx-auto w-full max-w-lg space-y-6 text-center">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl" style={{ color: "var(--ink)" }}>
            Already signed in
          </h1>
          <p className="text-base sm:text-lg" style={{ color: "var(--muted)" }}>
            {profile?.first_name ?? user.email ?? "Your account"} is connected.
            {isAuthorized ? " You have access to the app." : " Your account is not authorized yet."}
          </p>
          <Link
            href="/"
            className="btn-primary inline-flex items-center rounded-xl px-6 py-3 text-sm font-semibold"
          >
            Continue to Dashboard
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-6 py-16" style={{ background: "var(--paper)" }}>
      <div className="relative w-full max-w-sm">
        <div
          className="absolute -inset-0.5 rounded-2xl opacity-50 blur-sm"
          style={{ background: "linear-gradient(135deg, rgba(37,99,235,0.5), rgba(6,182,212,0.3), rgba(37,99,235,0.1))" }}
        />
        <div className="glass-card relative space-y-6 rounded-2xl p-8">
          <div className="space-y-1">
            <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--accent-bright)" }}>
              Sign in
            </p>
            <h1 className="text-2xl font-bold" style={{ color: "var(--ink)" }}>Welcome back</h1>
            <p className="text-sm" style={{ color: "var(--muted)" }}>
              Authenticate with your OAuth provider to access the dashboard.
            </p>
          </div>

          <OAuthButtons />

          <div style={{ borderTop: "1px solid var(--border)", paddingTop: "1rem" }}>
            <Link
              href="/"
              className="btn-ghost inline-flex rounded-xl px-4 py-2 text-xs font-semibold uppercase tracking-wider"
            >
              Continue as guest
            </Link>
          </div>

          <p className="text-xs" style={{ color: "var(--muted)" }}>
            By continuing you will be redirected through OAuth and returned to{" "}
            <span className="font-semibold" style={{ color: "var(--ink)" }}>/auth/callback</span>.
          </p>
        </div>
      </div>
    </main>
  );
}
