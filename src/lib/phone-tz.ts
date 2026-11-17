/** Tanzanian mobile numbers, stored as +255 and 9 digits. Prefix lists are not checked. */

export function normaliseTzMobile(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed || /[a-z]/i.test(trimmed)) return null;
  const digits = trimmed.replace(/\D/g, "");
  let national = "";
  if (digits.startsWith("255") && digits.length === 12) national = digits.slice(3);
  else if (digits.startsWith("0") && digits.length === 10) national = digits.slice(1);
  else if (digits.length === 9) national = digits;
  else return null;
  if (!/^\d{9}$/.test(national)) return null;
  return `+255${national}`;
}
