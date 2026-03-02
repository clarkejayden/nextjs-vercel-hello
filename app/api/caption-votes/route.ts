import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type VotePayload = {
  captionId?: unknown;
  voteValue?: unknown;
};

const isVoteValue = (value: unknown): value is 1 | -1 =>
  value === 1 || value === -1;

export async function POST(request: Request) {
  let payload: VotePayload;

  try {
    payload = (await request.json()) as VotePayload;
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON payload." },
      { status: 400 }
    );
  }

  const captionId =
    typeof payload.captionId === "string" ? payload.captionId.trim() : "";
  const voteValue = payload.voteValue;

  if (!captionId || !isVoteValue(voteValue)) {
    return NextResponse.json(
      { error: "Provide a captionId and a voteValue of 1 or -1." },
      { status: 400 }
    );
  }

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

  const { error: deleteError } = await supabase
    .from("caption_votes")
    .delete()
    .eq("caption_id", captionId)
    .eq("profile_id", user.id);

  if (deleteError) {
    return NextResponse.json(
      { error: deleteError.message },
      { status: 500 }
    );
  }

  const { error: insertError } = await supabase.from("caption_votes").insert({
    caption_id: captionId,
    profile_id: user.id,
    vote_value: voteValue,
    created_datetime_utc: new Date().toISOString(),
  });

  if (insertError) {
    return NextResponse.json(
      { error: insertError.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
