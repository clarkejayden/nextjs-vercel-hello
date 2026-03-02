import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase-server";

export type Profile = {
  id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  is_superadmin: boolean;
  is_in_study: boolean;
  is_matrix_admin: boolean;
};

export const getAuthState = async () => {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      user: null,
      profile: null as Profile | null,
      isAuthorized: false,
    };
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return {
      user,
      profile: null as Profile | null,
      isAuthorized: false,
    };
  }

  const { data: profile } = await admin
    .from("profiles")
    .select(
      "id,email,first_name,last_name,is_superadmin,is_in_study,is_matrix_admin"
    )
    .eq("id", user.id)
    .single();

  const isAuthorized = Boolean(
    profile &&
      (profile.is_superadmin ||
        profile.is_matrix_admin ||
        profile.is_in_study)
  );

  return { user, profile: profile ?? null, isAuthorized };
};
