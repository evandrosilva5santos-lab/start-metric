// Constantes do login Google (OAuth) compartilhadas entre /api/google/oauth e /api/google/callback.

export const GOOGLE_OAUTH_STATE_COOKIE = "google_oauth_state";

export function googleRedirectUri(origin: string): string {
  return process.env.GOOGLE_ADS_REDIRECT_URI ?? new URL("/api/google/callback", origin).toString();
}
