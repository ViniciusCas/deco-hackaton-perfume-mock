// Shared between the signup form (immediate feedback) and signUpServerFn
// (source of truth — client checks can be bypassed, this can't).

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateEmail(email: string): string | null {
  if (!EMAIL_RE.test(email.trim())) return "Enter a valid email address.";
  return null;
}

const PASSWORD_RULES: { test: (pw: string) => boolean; message: string }[] = [
  { test: (pw) => pw.length >= 8, message: "at least 8 characters" },
  { test: (pw) => /[A-Z]/.test(pw), message: "an uppercase letter" },
  { test: (pw) => /[a-z]/.test(pw), message: "a lowercase letter" },
  { test: (pw) => /[0-9]/.test(pw), message: "a number" },
  { test: (pw) => /[^A-Za-z0-9]/.test(pw), message: "a special character" },
];

export function validatePassword(password: string): string | null {
  const missing = PASSWORD_RULES.filter((rule) => !rule.test(password)).map((rule) => rule.message);
  if (missing.length === 0) return null;
  return `Password must include ${missing.join(", ")}.`;
}
