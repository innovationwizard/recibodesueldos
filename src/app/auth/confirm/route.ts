import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * Handles Supabase invite and recovery links when using custom email templates
 * with token_hash and type as query params (server-side flow).
 *
 * Supports type=invite (invite user) and type=recovery (reset password).
 *
 * Requires custom email template in Supabase Dashboard:
 * Auth → Email Templates → Invite or Recovery → change link to:
 * {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite
 * {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery
 *
 * Add https://your-domain.com/auth/confirm to Redirect URLs.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const next = searchParams.get("next") ?? "/set-password";

  if (!token_hash || (type !== "invite" && type !== "recovery")) {
    return NextResponse.redirect(new URL("/login?error=invalid_link", request.url));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({
    token_hash,
    type: type as "invite" | "recovery",
  });

  if (error) {
    return NextResponse.redirect(new URL("/login?error=expired_link", request.url));
  }

  return NextResponse.redirect(new URL(next, request.url));
}
