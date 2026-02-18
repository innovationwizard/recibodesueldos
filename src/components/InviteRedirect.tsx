"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * When user lands via Supabase invite or reset-password link (default flow),
 * the URL has hash: #access_token=...&type=invite|recovery
 * Redirect them to /set-password to create/update their password.
 */
export function InviteRedirect() {
  const router = useRouter();

  useEffect(() => {
    if (typeof window === "undefined") return;

    const hash = window.location.hash;
    if (!hash) return;

    const params = new URLSearchParams(hash.substring(1));
    const type = params.get("type");
    if (type === "invite" || type === "recovery") {
      // Preserve hash so /set-password can establish session from tokens
      router.replace(`/set-password${hash}`);
    }
  }, [router]);

  return null;
}
