import { createClient } from "@supabase/supabase-js";

export const createSupabaseAdminClient = () => {
  const normalizeEnv = (value?: string) => {
    if (!value) return "";
    return value.replace(/^\uFEFF/, "").trim();
  };

  const supabaseUrl = normalizeEnv(
    process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
  );
  const supabaseServiceKey = normalizeEnv(
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  if (!supabaseUrl || !supabaseServiceKey) {
    return null;
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
};
