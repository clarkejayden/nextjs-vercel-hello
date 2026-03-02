import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type NextCaptionPayload = {
  excludeIds?: unknown;
};

const normalizeExcludeIds = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
};

export async function POST(request: Request) {
  let payload: NextCaptionPayload;

  try {
    payload = (await request.json()) as NextCaptionPayload;
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON payload." },
      { status: 400 }
    );
  }

  const excludeIds = normalizeExcludeIds(payload.excludeIds);

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json(
      { error: "Authentication required." },
      { status: 401 }
    );
  }

  let captionQuery = supabase
    .from("captions")
    .select("id,content,created_datetime_utc,image_id")
    .eq("is_public", true)
    .not("content", "is", null)
    .neq("content", "")
    .order("created_datetime_utc", { ascending: false })
    .limit(1);

  if (excludeIds.length > 0) {
    const notInClause = `(${excludeIds.map((id) => `"${id}"`).join(",")})`;
    captionQuery = captionQuery.not("id", "in", notInClause);
  }

  const { data: captionRows, error: captionError } = await captionQuery;

  if (captionError) {
    return NextResponse.json(
      { error: captionError.message },
      { status: 500 }
    );
  }

  let caption = captionRows?.[0];

  if (!caption) {
    const { data: fallbackRows, error: fallbackError } = await supabase
      .from("captions")
      .select("id,content,created_datetime_utc,image_id")
      .eq("is_public", true)
      .not("content", "is", null)
      .neq("content", "")
      .order("created_datetime_utc", { ascending: false })
      .limit(1);

    if (fallbackError) {
      return NextResponse.json(
        { error: fallbackError.message },
        { status: 500 }
      );
    }

    caption = fallbackRows?.[0];
  }

  if (!caption) {
    return NextResponse.json(
      { error: "No additional captions available." },
      { status: 404 }
    );
  }

  let imageUrl: string | null = null;
  if (caption.image_id) {
    const { data: imageRow } = await supabase
      .from("images")
      .select("url")
      .eq("id", caption.image_id)
      .single();
    imageUrl = imageRow?.url ?? null;
  }

  const { data: voteRows } = await supabase
    .from("caption_votes")
    .select("profile_id,vote_value")
    .eq("caption_id", caption.id);

  let upvotes = 0;
  let downvotes = 0;
  let currentUserVote: 1 | -1 | 0 = 0;

  (voteRows ?? []).forEach((vote) => {
    if (vote.vote_value === 1) upvotes += 1;
    if (vote.vote_value === -1) downvotes += 1;
    if (vote.profile_id === user.id) {
      currentUserVote = vote.vote_value === 1 ? 1 : -1;
    }
  });

  return NextResponse.json({
    caption: {
      id: caption.id,
      content: caption.content ?? "",
      created_datetime_utc: caption.created_datetime_utc,
      imageUrl,
      upvotes,
      downvotes,
      currentUserVote,
    },
  });
}
