import { redirect } from "next/navigation";
import { getAuthState } from "@/lib/auth";
import { AuthHeader } from "@/app/components/AuthHeader";
import { UploadCaptionPipeline } from "@/app/components/UploadCaptionPipeline";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function UploadPage() {
  const { user, profile } = await getAuthState();

  if (!user) {
    redirect("/login");
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[var(--paper)] px-6 py-16">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-24 right-[-10%] h-64 w-64 rounded-full bg-[var(--accent)]/20 blur-3xl" />
        <div className="absolute bottom-0 left-[-12%] h-80 w-80 rounded-full bg-[var(--accent-2)]/20 blur-3xl" />
      </div>
      <div className="relative mx-auto w-full max-w-5xl space-y-10">
        <AuthHeader user={user} profile={profile} />
        <header className="space-y-3 text-center">
          <p className="text-xs uppercase tracking-[0.4em] text-[var(--muted)]">
            Upload
          </p>
          <h1 className="font-display text-4xl tracking-tight sm:text-5xl">
            Image Caption Generator
          </h1>
          <p className="mx-auto max-w-2xl text-base text-[var(--muted)] sm:text-lg">
            Upload an image to the staging pipeline and generate captions.
          </p>
        </header>

        <UploadCaptionPipeline />
      </div>
    </main>
  );
}
