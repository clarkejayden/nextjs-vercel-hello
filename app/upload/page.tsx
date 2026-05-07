import { redirect } from "next/navigation";
import { getAuthState } from "@/lib/auth";
import { AuthHeader } from "@/app/components/AuthHeader";
import { UploadCaptionPipeline } from "@/app/components/UploadCaptionPipeline";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function UploadPage() {
  const { user, profile } = await getAuthState();
  if (!user) redirect("/login");

  return (
    <main className="min-h-screen px-6 py-12">
      <div className="mx-auto w-full max-w-5xl space-y-10">
        <AuthHeader user={user} profile={profile} />

        <header className="space-y-2 text-center">
          <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--accent-bright)" }}>
            Upload
          </p>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl" style={{ color: "var(--ink)" }}>
            Image Caption Generator
          </h1>
          <p className="mx-auto max-w-2xl text-base sm:text-lg" style={{ color: "var(--muted)" }}>
            Upload an image to the staging pipeline and generate captions.
          </p>
        </header>

        <UploadCaptionPipeline />
      </div>
    </main>
  );
}
