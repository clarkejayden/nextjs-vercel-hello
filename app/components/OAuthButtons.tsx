"use client";

import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type Provider = "google" | "github";

const providers: { id: Provider; label: string }[] = [
  { id: "google", label: "Continue with Google" },
  { id: "github", label: "Continue with GitHub" },
];

export const OAuthButtons = () => {
  const [busyProvider, setBusyProvider] = useState<Provider | null>(null);

  const handleLogin = async (provider: Provider) => {
    setBusyProvider(provider);
    const supabase = createSupabaseBrowserClient();
    const redirectTo = new URL("/auth/callback", window.location.origin).toString();

    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo,
      },
    });

    if (error) {
      setBusyProvider(null);
      console.error(error);
    }
  };

  return (
    <div className="space-y-3">
      {providers.map((provider) => (
        <button
          key={provider.id}
          type="button"
          onClick={() => handleLogin(provider.id)}
          disabled={busyProvider === provider.id}
          className="w-full rounded-full border border-black/20 bg-white px-4 py-3 text-sm font-semibold text-black transition hover:-translate-y-0.5 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busyProvider === provider.id ? "Connecting..." : provider.label}
        </button>
      ))}
    </div>
  );
};
