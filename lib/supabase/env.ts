const normalizeEnv = (value?: string) => {
  if (!value) return "";
  return value.replace(/^\uFEFF/, "").trim();
};

export const getSupabaseEnv = () => {
  const supabaseUrl = normalizeEnv(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const supabaseAnonKey = normalizeEnv(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  return { supabaseUrl, supabaseAnonKey };
};
