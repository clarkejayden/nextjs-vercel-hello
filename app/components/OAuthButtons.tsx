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

    const { error } = await supabase.auth.signInWithOAuth({ provider, options: { redirectTo } });

    if (error) {
      setBusyProvider(null);
      console.error(error);
    }
  };

  return (
    <div className="space-y-3">
      {providers.map((provider, i) => (
        <button
          key={provider.id}
          type="button"
          onClick={() => handleLogin(provider.id)}
          disabled={busyProvider === provider.id}
          className="w-full rounded-xl px-4 py-3 text-sm font-semibold transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-60"
          style={
            i === 0
              ? { background: "linear-gradient(135deg, #1d4ed8, #2563eb)", color: "#fff", boxShadow: "0 0 20px rgba(37,99,235,0.35)" }
              : { background: "rgba(255,255,255,0.04)", border: "1px solid var(--border)", color: "var(--ink)" }
          }
        >
          {busyProvider === provider.id ? (
            <span className="flex items-center justify-center gap-2">
              <span className="h-3.5 w-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
              Connecting...
            </span>
          ) : (
            provider.label
          )}
        </button>
      ))}
    </div>
  );
};
