"use client";

import { useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

const allowedTypes = new Set([
  "image/jpeg", "image/jpg", "image/png",
  "image/webp", "image/gif", "image/heic",
]);

type PipelineCaptions = {
  captions: string[];
  imageId?: string;
  cdnUrl?: string;
  raw?: unknown;
};

const normalizeCaptions = (payload: unknown): PipelineCaptions => {
  if (!payload || typeof payload !== "object") return { captions: [], raw: payload };

  if (Array.isArray(payload)) {
    const captions = payload
      .map((entry) => {
        if (!entry || typeof entry !== "object") return "";
        const o = entry as Record<string, unknown>;
        return (
          (typeof o.content === "string" ? o.content : "") ||
          (typeof o.caption === "string" ? o.caption : "") ||
          (typeof o.text === "string" ? o.text : "") ||
          (typeof o.caption_text === "string" ? o.caption_text : "") ||
          (typeof o.value === "string" ? o.value : "")
        );
      })
      .filter((e) => e.length > 0);
    return { captions, raw: payload };
  }

  const maybe = payload as {
    captions?: unknown;
    data?: { captions?: unknown };
    result?: { captions?: unknown };
    imageId?: string;
    cdnUrl?: string;
  };
  const raw = maybe.captions ?? maybe.data?.captions ?? maybe.result?.captions;
  const captions: string[] = [];

  if (Array.isArray(raw)) {
    raw.forEach((entry) => {
      if (typeof entry === "string") { captions.push(entry); return; }
      if (entry && typeof entry === "object") {
        const o = entry as Record<string, unknown>;
        const text =
          (typeof o.text === "string" ? o.text : "") ||
          (typeof o.caption === "string" ? o.caption : "") ||
          (typeof o.content === "string" ? o.content : "") ||
          (typeof o.caption_text === "string" ? o.caption_text : "") ||
          (typeof o.value === "string" ? o.value : "");
        if (text) captions.push(text);
      }
    });
  } else if (typeof raw === "string" && raw) {
    captions.push(raw);
  }

  return {
    captions,
    imageId: typeof maybe.imageId === "string" ? maybe.imageId : undefined,
    cdnUrl: typeof maybe.cdnUrl === "string" ? maybe.cdnUrl : undefined,
    raw: payload,
  };
};

export const UploadCaptionPipeline = () => {
  const [file, setFile] = useState<File | null>(null);
  const [captions, setCaptions] = useState<{ id: string; text: string }[]>([]);
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null);
  const [savedImageId, setSavedImageId] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "uploading" | "registering" | "generating" | "error" | "success">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [debugPayload, setDebugPayload] = useState<string | null>(null);
  const [voteStatus, setVoteStatus] = useState<"idle" | "saving" | "error">("idle");
  const [fadingCaptions, setFadingCaptions] = useState<Set<string>>(() => new Set());

  const isLoading = status !== "idle" && status !== "error" && status !== "success";

  const statusLabel = useMemo(() => {
    switch (status) {
      case "uploading":   return "Uploading image…";
      case "registering": return "Registering image…";
      case "generating":  return "Generating captions…";
      case "success":     return "Captions generated.";
      case "error":       return "Something went wrong.";
      default:            return null;
    }
  }, [status]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0] ?? null;
    if (!selected) { setFile(null); return; }
    if (!allowedTypes.has(selected.type)) {
      setFile(null);
      setMessage("Unsupported file type. Use jpeg, jpg, png, webp, gif, or heic.");
      setStatus("error");
      return;
    }
    setFile(selected);
    setCaptions([]); setUploadedImageUrl(null); setSavedImageId(null);
    setMessage(null); setDebugPayload(null); setVoteStatus("idle");
    setFadingCaptions(new Set()); setStatus("idle");
  };

  const getAccessToken = async () => {
    const supabase = createSupabaseBrowserClient();
    const { data, error } = await supabase.auth.getSession();
    if (error || !data.session?.access_token) throw new Error("You must be signed in to upload images.");
    return data.session.access_token;
  };

  const buildUrl = (baseUrl: string, path: string) => `${baseUrl.replace(/\/$/, "")}${path}`;

  const handleUpload = async () => {
    if (!file) { setStatus("error"); setMessage("Choose a file before uploading."); return; }
    if (!allowedTypes.has(file.type)) { setStatus("error"); setMessage("Unsupported file type."); return; }

    const baseUrl = process.env.NEXT_PUBLIC_PIPELINE_API_BASE_URL;
    if (!baseUrl) { setStatus("error"); setMessage("Missing pipeline API base URL."); return; }

    setStatus("uploading"); setMessage(null); setCaptions([]); setDebugPayload(null);
    setUploadedImageUrl(null); setSavedImageId(null); setVoteStatus("idle"); setFadingCaptions(new Set());

    try {
      const accessToken = await getAccessToken();

      const presignResponse = await fetch(buildUrl(baseUrl, "/pipeline/generate-presigned-url"), {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ contentType: file.type }),
      });
      const presignPayload = await presignResponse.json().catch(() => null);
      if (!presignResponse.ok || !presignPayload) throw new Error(presignPayload?.error ?? "Unable to generate upload URL.");

      const { presignedUrl, cdnUrl } = presignPayload as { presignedUrl?: string; cdnUrl?: string };
      if (!presignedUrl || !cdnUrl) throw new Error("Missing presignedUrl or cdnUrl in response.");

      setUploadedImageUrl(cdnUrl);

      const uploadResponse = await fetch(presignedUrl, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
      if (!uploadResponse.ok) throw new Error("Upload failed. Please try again.");

      setStatus("registering");

      const registerResponse = await fetch(buildUrl(baseUrl, "/pipeline/upload-image-from-url"), {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ imageUrl: cdnUrl, isCommonUse: false }),
      });
      const registerPayload = await registerResponse.json().catch(() => null);
      if (!registerResponse.ok || !registerPayload) throw new Error(registerPayload?.error ?? "Unable to register image.");

      const imageId = registerPayload.imageId as string | undefined;
      if (!imageId) throw new Error("Missing imageId in response.");

      setStatus("generating");

      const generateResponse = await fetch(buildUrl(baseUrl, "/pipeline/generate-captions"), {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ imageId }),
      });
      const generatePayload = await generateResponse.json().catch(() => null);
      if (!generateResponse.ok || !generatePayload) throw new Error(generatePayload?.error ?? "Unable to generate captions.");

      const normalized = normalizeCaptions(generatePayload);
      if (normalized.captions.length === 0) {
        setDebugPayload(JSON.stringify(normalized.raw ?? generatePayload, null, 2));
        throw new Error("No captions were returned for this image.");
      }

      setCaptions(normalized.captions.map((text, i) => ({
        id: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${i}-${Math.random().toString(16).slice(2)}`,
        text,
      })));
      setStatus("success");
      setMessage("Captions generated successfully.");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Unable to complete upload.");
    }
  };

  const ensureImageRow = async (supabase: ReturnType<typeof createSupabaseBrowserClient>, userId: string) => {
    if (savedImageId) return savedImageId;
    if (!uploadedImageUrl) throw new Error("Missing image URL for saving.");

    const { data, error } = await supabase
      .from("images")
      .insert({ url: uploadedImageUrl, is_public: false, created_by_user_id: userId, modified_by_user_id: userId })
      .select("id")
      .single();

    if (error || !data?.id) throw new Error(error?.message ?? "Unable to save image.");
    setSavedImageId(data.id);
    return data.id;
  };

  const handleVote = async (item: { id: string; text: string }, decision: "yes" | "no") => {
    setFadingCaptions((prev) => { const next = new Set(prev); next.add(item.id); return next; });

    if (decision === "no") {
      setTimeout(() => {
        setCaptions((prev) => prev.filter((e) => e.id !== item.id));
        setFadingCaptions((prev) => { const next = new Set(prev); next.delete(item.id); return next; });
      }, 250);
      return;
    }

    try {
      setVoteStatus("saving"); setMessage(null);
      const supabase = createSupabaseBrowserClient();
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !sessionData.session) throw new Error("You must be signed in to save captions.");

      const imageId = await ensureImageRow(supabase, sessionData.session.user.id);
      const { error: insertError } = await supabase.from("captions").insert({
        content: item.text,
        is_public: false,
        image_id: imageId,
        created_by_user_id: sessionData.session.user.id,
        modified_by_user_id: sessionData.session.user.id,
      });
      if (insertError) throw new Error(insertError.message);

      setTimeout(() => {
        setCaptions((prev) => prev.filter((e) => e.id !== item.id));
        setFadingCaptions((prev) => { const next = new Set(prev); next.delete(item.id); return next; });
      }, 250);
      setVoteStatus("idle");
    } catch (error) {
      setFadingCaptions((prev) => { const next = new Set(prev); next.delete(item.id); return next; });
      setVoteStatus("error");
      setMessage(error instanceof Error ? error.message : "Unable to save caption.");
    }
  };

  return (
    <div className="glass-card rounded-2xl overflow-hidden">
      <div
        className="px-6 py-4"
        style={{
          borderBottom: "1px solid var(--border)",
          background: "linear-gradient(90deg, rgba(37,99,235,0.08), transparent)",
        }}
      >
        <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--accent-bright)" }}>
          Pipeline
        </p>
        <h2 className="mt-1 text-lg font-bold" style={{ color: "var(--ink)" }}>Upload an image</h2>
        <p className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>
          Generate captions through the Almost Crackd staging pipeline.
        </p>
      </div>

      <div className="p-6 space-y-5">
        <label
          className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl px-6 py-10 text-center transition-all duration-200 hover:border-blue-500/40"
          style={{
            border: "1.5px dashed var(--border)",
            background: "rgba(37,99,235,0.04)",
          }}
        >
          <input
            type="file"
            accept="image/jpeg,image/jpg,image/png,image/webp,image/gif,image/heic"
            onChange={handleFileChange}
            className="hidden"
          />
          <svg className="h-8 w-8 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: "var(--accent-bright)" }}>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
          </svg>
          {file ? (
            <span className="text-sm font-medium" style={{ color: "var(--ink)" }}>{file.name}</span>
          ) : (
            <>
              <span className="text-sm font-medium" style={{ color: "var(--ink)" }}>Choose an image</span>
              <span className="text-xs" style={{ color: "var(--muted)" }}>jpeg, jpg, png, webp, gif, heic</span>
            </>
          )}
        </label>

        <div className="flex flex-col items-center gap-3">
          <button
            type="button"
            onClick={() => { if (!isLoading) void handleUpload(); }}
            disabled={isLoading || !file}
            className="w-full max-w-sm rounded-xl px-6 py-3 text-sm font-semibold transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50"
            style={
              !isLoading && file
                ? { background: "linear-gradient(135deg, #1d4ed8, #2563eb)", color: "#fff", boxShadow: "0 0 20px rgba(37,99,235,0.35)" }
                : { background: "rgba(255,255,255,0.06)", border: "1px solid var(--border)", color: "var(--muted)" }
            }
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="h-3.5 w-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                {statusLabel}
              </span>
            ) : (
              "Upload & Generate"
            )}
          </button>

          {statusLabel && !isLoading ? (
            <p
              className="text-xs"
              style={{ color: status === "error" ? "#f87171" : status === "success" ? "#34d399" : "var(--muted)" }}
            >
              {statusLabel}
            </p>
          ) : null}

          {message && !isLoading ? (
            <p
              role={status === "error" ? "alert" : "status"}
              className="rounded-lg px-3 py-2 text-xs text-center"
              style={{
                color: status === "error" ? "#f87171" : "#34d399",
                background: status === "error" ? "rgba(248,113,113,0.1)" : "rgba(52,211,153,0.1)",
                border: `1px solid ${status === "error" ? "rgba(248,113,113,0.3)" : "rgba(52,211,153,0.3)"}`,
              }}
            >
              {message}
            </p>
          ) : null}

          {status === "error" && debugPayload ? (
            <details
              className="w-full max-w-md rounded-xl px-4 py-3 text-left text-xs"
              style={{ border: "1px solid var(--border)", background: "rgba(255,255,255,0.03)" }}
            >
              <summary className="cursor-pointer font-medium" style={{ color: "var(--ink)" }}>
                View API response
              </summary>
              <pre className="mt-2 whitespace-pre-wrap break-words" style={{ color: "var(--muted)" }}>
                {debugPayload}
              </pre>
            </details>
          ) : null}
        </div>

        {captions.length > 0 ? (
          <div className="space-y-4 pt-2" style={{ borderTop: "1px solid var(--border)" }}>
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--accent-bright)" }}>
                Generated Captions
              </p>
              <span className="text-xs" style={{ color: "var(--muted)" }}>{captions.length} remaining</span>
            </div>

            {uploadedImageUrl ? (
              <img
                src={uploadedImageUrl}
                alt="Uploaded preview"
                className="mx-auto max-h-[40vh] w-full max-w-3xl rounded-xl object-contain"
                style={{ border: "1px solid var(--border)" }}
              />
            ) : null}

            <ul className="space-y-3">
              {captions.map((caption, index) => (
                <li
                  key={`${caption.id}-${index}`}
                  className="rounded-xl p-4 transition-all duration-300"
                  style={{
                    border: "1px solid var(--border)",
                    background: "rgba(37,99,235,0.04)",
                    opacity: fadingCaptions.has(caption.id) ? 0 : 1,
                    transform: fadingCaptions.has(caption.id) ? "translateY(-4px)" : "translateY(0)",
                  }}
                >
                  <p className="text-sm leading-relaxed text-center mb-4" style={{ color: "var(--ink)" }}>
                    {caption.text}
                  </p>
                  <div className="flex items-center justify-center gap-3">
                    <button
                      type="button"
                      onClick={() => void handleVote(caption, "no")}
                      disabled={voteStatus === "saving"}
                      className="btn-ghost rounded-xl px-5 py-2 text-xs font-semibold uppercase tracking-wider disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Skip
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleVote(caption, "yes")}
                      disabled={voteStatus === "saving"}
                      className="rounded-xl px-5 py-2 text-xs font-semibold uppercase tracking-wider transition-all disabled:cursor-not-allowed disabled:opacity-50"
                      style={{ background: "linear-gradient(135deg, #1d4ed8, #2563eb)", color: "#fff", boxShadow: "0 0 12px rgba(37,99,235,0.3)" }}
                    >
                      Save
                    </button>
                  </div>
                </li>
              ))}
            </ul>

            {voteStatus === "saving" ? (
              <p className="text-center text-xs" style={{ color: "var(--muted)" }}>Saving selection…</p>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
};
