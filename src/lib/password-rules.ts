export const ADMIN_PASSWORD_MIN_LENGTH = 12;

const ADMIN_RULE_LABELS = {
  length: `At least ${ADMIN_PASSWORD_MIN_LENGTH} characters`,
  cases: "Upper and lower case letters",
  number: "At least one number",
  symbol: "At least one symbol (for example ! ? # @)",
};

/** When the owner policy is off, eight characters are enough so a reset is still possible. */
export function passwordMeetsPolicy(password: string, strong: boolean) {
  if (!strong) return password.length >= 8;
  return adminPasswordChecks(password).every((check) => check.ok);
}

/** Strength rules for admin passwords; every rule must pass. */
export function adminPasswordChecks(password: string, labels: typeof ADMIN_RULE_LABELS = ADMIN_RULE_LABELS) {
  return [
    { ok: password.length >= ADMIN_PASSWORD_MIN_LENGTH, label: labels.length },
    { ok: /[a-z]/.test(password) && /[A-Z]/.test(password), label: labels.cases },
    { ok: /\d/.test(password), label: labels.number },
    { ok: /[^A-Za-z0-9]/.test(password), label: labels.symbol },
  ];
}
