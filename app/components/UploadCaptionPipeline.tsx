"use client";

import { useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

const allowedTypes = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
]);

type PipelineCaptions = {
  captions: string[];
  imageId?: string;
  cdnUrl?: string;
  raw?: unknown;
};

const normalizeCaptions = (payload: unknown): PipelineCaptions => {
  if (!payload || typeof payload !== "object") {
    return { captions: [], raw: payload };
  }

  if (Array.isArray(payload)) {
    const captions = payload
      .map((entry) => {
        if (!entry || typeof entry !== "object") return "";
        const asObject = entry as {
          content?: unknown;
          caption?: unknown;
          text?: unknown;
          caption_text?: unknown;
          value?: unknown;
        };
        return typeof asObject.content === "string"
          ? asObject.content
          : typeof asObject.caption === "string"
            ? asObject.caption
            : typeof asObject.text === "string"
              ? asObject.text
              : typeof asObject.caption_text === "string"
                ? asObject.caption_text
                : typeof asObject.value === "string"
                  ? asObject.value
                  : "";
      })
      .filter((entry) => entry.length > 0);

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
      if (typeof entry === "string") {
        captions.push(entry);
        return;
      }
      if (entry && typeof entry === "object") {
        const asObject = entry as {
          text?: unknown;
          caption?: unknown;
          content?: unknown;
          caption_text?: unknown;
          value?: unknown;
        };
        const text =
          typeof asObject.text === "string"
            ? asObject.text
            : typeof asObject.caption === "string"
              ? asObject.caption
              : typeof asObject.content === "string"
                ? asObject.content
                : typeof asObject.caption_text === "string"
                  ? asObject.caption_text
                  : typeof asObject.value === "string"
                    ? asObject.value
                    : "";
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
  const [pipelineImageId, setPipelineImageId] = useState<string | null>(null);
  const [savedImageId, setSavedImageId] = useState<string | null>(null);
  const [status, setStatus] = useState<
    "idle" | "uploading" | "registering" | "generating" | "error" | "success"
  >("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [debugPayload, setDebugPayload] = useState<string | null>(null);
  const [voteStatus, setVoteStatus] = useState<"idle" | "saving" | "error">(
    "idle"
  );
  const [fadingCaptions, setFadingCaptions] = useState<Set<string>>(
    () => new Set()
  );

  const isLoading = status !== "idle" && status !== "error" && status !== "success";

  const statusLabel = useMemo(() => {
    switch (status) {
      case "uploading":
        return "Uploading image...";
      case "registering":
        return "Registering image...";
      case "generating":
        return "Generating captions...";
      case "success":
        return "Captions generated.";
      case "error":
        return "Something went wrong.";
      default:
        return "Ready to upload.";
    }
  }, [status]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0] ?? null;
    if (!selected) {
      setFile(null);
      return;
    }

    if (!allowedTypes.has(selected.type)) {
      setFile(null);
      setMessage(
        "Unsupported file type. Use jpeg, jpg, png, webp, gif, or heic."
      );
      setStatus("error");
      return;
    }

    setFile(selected);
    setCaptions([]);
    setUploadedImageUrl(null);
    setPipelineImageId(null);
    setSavedImageId(null);
    setMessage(null);
    setDebugPayload(null);
    setVoteStatus("idle");
    setFadingCaptions(new Set());
    setStatus("idle");
  };

  const getAccessToken = async () => {
    const supabase = createSupabaseBrowserClient();
    const { data, error } = await supabase.auth.getSession();
    if (error || !data.session?.access_token) {
      throw new Error("You must be signed in to upload images.");
    }
    return data.session.access_token;
  };

  const buildUrl = (baseUrl: string, path: string) =>
    `${baseUrl.replace(/\/$/, "")}${path}`;

  const handleUpload = async () => {
    if (!file) {
      setStatus("error");
      setMessage("Choose a file before uploading.");
      return;
    }

    if (!allowedTypes.has(file.type)) {
      setStatus("error");
      setMessage("Unsupported file type. Use jpeg, jpg, png, webp, gif, or heic.");
      return;
    }

    const baseUrl = process.env.NEXT_PUBLIC_PIPELINE_API_BASE_URL;
    if (!baseUrl) {
      setStatus("error");
      setMessage("Missing pipeline API base URL.");
      return;
    }

    setStatus("uploading");
    setMessage(null);
    setCaptions([]);
    setDebugPayload(null);
    setUploadedImageUrl(null);
    setPipelineImageId(null);
    setSavedImageId(null);
    setVoteStatus("idle");
    setFadingCaptions(new Set());

    try {
      const accessToken = await getAccessToken();

      const presignResponse = await fetch(
        buildUrl(baseUrl, "/pipeline/generate-presigned-url"),
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ contentType: file.type }),
        }
      );

      const presignPayload = await presignResponse.json().catch(() => null);

      if (!presignResponse.ok || !presignPayload) {
        throw new Error(presignPayload?.error ?? "Unable to generate upload URL.");
      }

      const presignedUrl = presignPayload.presignedUrl as string | undefined;
      const cdnUrl = presignPayload.cdnUrl as string | undefined;

      if (!presignedUrl || !cdnUrl) {
        throw new Error("Missing presignedUrl or cdnUrl in response.");
      }

      setUploadedImageUrl(cdnUrl);

      const uploadResponse = await fetch(presignedUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });

      if (!uploadResponse.ok) {
        throw new Error("Upload failed. Please try again.");
      }

      setStatus("registering");

      const registerResponse = await fetch(
        buildUrl(baseUrl, "/pipeline/upload-image-from-url"),
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ imageUrl: cdnUrl, isCommonUse: false }),
        }
      );

      const registerPayload = await registerResponse.json().catch(() => null);

      if (!registerResponse.ok || !registerPayload) {
        throw new Error(registerPayload?.error ?? "Unable to register image.");
      }

      const imageId = registerPayload.imageId as string | undefined;

      if (!imageId) {
        throw new Error("Missing imageId in response.");
      }

      setPipelineImageId(imageId);
      setStatus("generating");

      const generateResponse = await fetch(
        buildUrl(baseUrl, "/pipeline/generate-captions"),
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ imageId }),
        }
      );

      const generatePayload = await generateResponse.json().catch(() => null);

      if (!generateResponse.ok || !generatePayload) {
        throw new Error(generatePayload?.error ?? "Unable to generate captions.");
      }

      const normalized = normalizeCaptions(generatePayload);
      const nextCaptions = normalized.captions;

      if (nextCaptions.length === 0) {
        setDebugPayload(JSON.stringify(normalized.raw ?? generatePayload, null, 2));
        throw new Error("No captions were returned for this image.");
      }

      setCaptions(
        nextCaptions.map((text, index) => ({
          id:
            globalThis.crypto?.randomUUID?.() ??
            `${Date.now()}-${index}-${Math.random().toString(16).slice(2)}`,
          text,
        }))
      );
      setStatus("success");
      setMessage("Captions generated successfully.");
    } catch (error) {
      setStatus("error");
      setMessage(
        error instanceof Error ? error.message : "Unable to complete upload."
      );
    }
  };

  const ensureImageRow = async (
    supabase: ReturnType<typeof createSupabaseBrowserClient>,
    userId: string
  ) => {
    if (savedImageId) return savedImageId;
    if (!uploadedImageUrl) {
      throw new Error("Missing image URL for saving.");
    }

    const { data, error } = await supabase
      .from("images")
      .insert({
        url: uploadedImageUrl,
        is_public: false,
        created_by_user_id: userId,
        modified_by_user_id: userId,
      })
      .select("id")
      .single();

    if (error || !data?.id) {
      throw new Error(error?.message ?? "Unable to save image.");
    }

    setSavedImageId(data.id);
    return data.id;
  };

  const handleVote = async (item: { id: string; text: string }, decision: "yes" | "no") => {
    setFadingCaptions((prev) => {
      const next = new Set(prev);
      next.add(item.id);
      return next;
    });

    if (decision === "no") {
      setTimeout(() => {
        setCaptions((prev) => prev.filter((entry) => entry.id !== item.id));
        setFadingCaptions((prev) => {
          const next = new Set(prev);
          next.delete(item.id);
          return next;
        });
      }, 250);
      return;
    }

    try {
      setVoteStatus("saving");
      setMessage(null);

      const supabase = createSupabaseBrowserClient();
      const { data: sessionData, error: sessionError } =
        await supabase.auth.getSession();
      if (sessionError || !sessionData.session) {
        throw new Error("You must be signed in to save captions.");
      }

      const imageId = await ensureImageRow(supabase, sessionData.session.user.id);

      const { error: insertError } = await supabase.from("captions").insert({
        content: item.text,
        is_public: false,
        image_id: imageId,
        created_by_user_id: sessionData.session.user.id,
        modified_by_user_id: sessionData.session.user.id,
      });

      if (insertError) {
        throw new Error(insertError.message);
      }

      setTimeout(() => {
        setCaptions((prev) => prev.filter((entry) => entry.id !== item.id));
        setFadingCaptions((prev) => {
          const next = new Set(prev);
          next.delete(item.id);
          return next;
        });
      }, 250);
      setVoteStatus("idle");
    } catch (error) {
      setFadingCaptions((prev) => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
      setVoteStatus("error");
      setMessage(
        error instanceof Error ? error.message : "Unable to save caption."
      );
    }
  };

  return (
    <div className="rounded-3xl border border-black/5 bg-white/80 p-8 shadow-[var(--shadow)] backdrop-blur">
      <div className="space-y-2 text-center">
        <p className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">
          Pipeline
        </p>
        <h2 className="font-display text-3xl">Upload an image</h2>
        <p className="text-sm text-[var(--muted)]">
          Generate captions through the Almost Crackd staging pipeline.
        </p>
      </div>

      <div className="mt-8 flex flex-col items-center gap-4">
        <label className="w-full max-w-md rounded-2xl border border-dashed border-black/20 bg-white px-4 py-6 text-center text-sm text-[var(--muted)]">
          <input
            type="file"
            accept="image/jpeg,image/jpg,image/png,image/webp,image/gif,image/heic"
            onChange={handleFileChange}
            className="hidden"
          />
          {file ? (
            <span className="text-[var(--ink)]">{file.name}</span>
          ) : (
            "Choose an image file"
          )}
        </label>

        <button
          type="button"
          onClick={() => {
            if (isLoading) return;
            void handleUpload();
          }}
          disabled={isLoading || !file}
          className="rounded-full border border-black/20 bg-white px-6 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--ink)] transition hover:-translate-y-0.5 hover:shadow disabled:cursor-not-allowed disabled:opacity-60"
        >
          Upload &amp; Generate
        </button>

        <div className="text-xs text-[var(--muted)]">{statusLabel}</div>

      {message ? (
        <p
          role={status === "error" ? "alert" : "status"}
          className={`text-xs ${
            status === "error" ? "text-red-600" : "text-[var(--muted)]"
          }`}
        >
          {message}
        </p>
      ) : null}
      {status === "error" && debugPayload ? (
        <details className="w-full max-w-md rounded-2xl border border-black/10 bg-white px-4 py-3 text-left text-xs text-[var(--muted)]">
          <summary className="cursor-pointer text-[var(--ink)]">
            View API response
          </summary>
          <pre className="mt-2 whitespace-pre-wrap break-words">
            {debugPayload}
          </pre>
        </details>
      ) : null}
      </div>

      {captions.length > 0 ? (
        <div className="mt-8 space-y-4">
          <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
            Generated Captions
          </h3>
          {uploadedImageUrl ? (
            <div className="flex items-center justify-center">
              <img
                src={uploadedImageUrl}
                alt="Uploaded preview"
                className="mx-auto max-h-[50vh] w-full max-w-3xl rounded-3xl border border-black/10 object-contain shadow-[var(--shadow)]"
              />
            </div>
          ) : null}
          <ul className="space-y-3">
            {captions.map((caption, index) => (
              <li
                key={`${caption.id}-${index}`}
                className={`rounded-2xl border border-black/5 bg-white px-4 py-3 text-sm text-[var(--ink)] shadow-[var(--shadow)] transition duration-300 ${
                  fadingCaptions.has(caption.id)
                    ? "opacity-0 -translate-y-1"
                    : "opacity-100"
                }`}
              >
                <div className="flex flex-col items-center gap-3 text-center">
                  <p className="text-sm text-[var(--ink)]">{caption.text}</p>
                  <div className="flex flex-wrap items-center justify-center gap-3">
                    <button
                      type="button"
                      onClick={() => void handleVote(caption, "no")}
                      disabled={voteStatus === "saving"}
                      className="rounded-full border border-black/20 bg-white px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--ink)] transition hover:-translate-y-0.5 hover:shadow disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      No
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleVote(caption, "yes")}
                      disabled={voteStatus === "saving"}
                      className="rounded-full border border-black/20 bg-[var(--accent)]/20 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--ink)] transition hover:-translate-y-0.5 hover:shadow disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Yes
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
          {voteStatus === "saving" ? (
            <p className="text-xs text-[var(--muted)]">Saving selection...</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};
