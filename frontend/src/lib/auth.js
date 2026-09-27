import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL?.trim();
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() || import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();
let client = null;
try {
  if (url && key) client = createClient(url, key, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: "implicit" },
  });
} catch { /* A missing or invalid deployment configuration must not crash the page. */ }
export const supabase = client;

export function authRedirect(recovery = false) {
  const target = new URL(import.meta.env.BASE_URL, window.location.origin);
  if (recovery) target.searchParams.set("auth", "reset");
  return target.href;
}

export function authCallbackError(callbackUrl) {
  const params = new URLSearchParams(callbackUrl.search);
  new URLSearchParams(callbackUrl.hash.slice(1)).forEach((value, key) => params.set(key, value));
  if (!["error", "error_code", "error_description"].some((key) => params.has(key))) return "";
  const code = params.get("error_code") || params.get("error");
  if (code === "otp_expired") return authError({ code });
  if (code === "access_denied") return "Sign-in was denied or cancelled. Please try signing in again.";
  if (code === "provider_disabled" || code === "oauth_provider_not_supported") {
    return "This sign-in provider is not enabled. Please use email sign-in or contact support.";
  }
  // Provider descriptions are untrusted and can contain internal details.
  return "The sign-in provider could not complete your request. Please try again or contact support if this continues.";
}

export function authError(error) {
  const code = error?.code || error?.details?.code;
  if (code === "invalid_credentials") return "That email and password don't match. Please try again.";
  if (code === "email_not_confirmed") return "Please confirm your email before signing in. Check your inbox or resend the confirmation below.";
  if (code === "over_email_send_rate_limit" || code === "over_request_rate_limit" || error?.status === 429) return "Too many attempts. Please wait a little before trying again.";
  if (code === "weak_password") return "Choose a stronger password with uppercase and lowercase letters, a number, and a symbol.";
  if (code === "same_password") return "Choose a password different from your current password.";
  if (code === "otp_expired") return "This link has expired or has already been used. Please request a new one.";
  if (code === "user_already_exists") return "Unable to create this account. Try signing in or resetting your password.";
  if (code === "validation_failed" || code === "email_address_invalid") return "Please check your email address and try again.";
  if (error?.name === "AuthRetryableFetchError" || error?.message === "Failed to fetch") return "Couldn't connect. Check your connection and try again.";
  return "We couldn't complete that request. Please try again in a moment.";
}

export async function getAccessToken(expectedUserId) {
  if (!supabase) throw new Error("Sign-in is temporarily unavailable.");
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session || data.session.user.id !== expectedUserId) {
    throw new Error("Your session has expired. Please sign in again.");
  }
  return data.session.access_token;
}
