function sanitizeRule(entry: string): string {
  return entry
    .trim()
    .replace(/^"+|"+$/g, "")
    .replace(/^'+|'+$/g, "")
    .toLowerCase();
}

function readAllowedEmails(): string[] {
  const raw = process.env.ADMIN_PANEL_ALLOWED_EMAILS ?? "";

  return raw
    .split(",")
    .map((entry) => sanitizeRule(entry))
    .filter(Boolean);
}

export function isPlatformAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;

  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) return false;

  const allowedEmails = readAllowedEmails();
  if (allowedEmails.length === 0) return false;

  return allowedEmails.some((rule) => {
    if (rule.startsWith("@")) {
      return normalizedEmail.endsWith(rule);
    }
    return normalizedEmail === rule;
  });
}
