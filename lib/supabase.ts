import { createClient } from "@supabase/supabase-js";

const normalizeEnv = (value?: string) => {
  if (!value) return "";
  return value.replace(/^\uFEFF/, "").trim();
};

const supabaseUrl = normalizeEnv(process.env.NEXT_PUBLIC_SUPABASE_URL);
const supabaseAnonKey = normalizeEnv(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
