/**
 * Letter avatar for a business / shop name.
 * Uses the first letter of the first word (Latin, digits, or Arabic/Urdu script).
 */
export function businessLogoLetter(name: string | null | undefined): string {
  const trimmed = (name ?? "").trim();
  if (!trimmed) return "?";
  const firstWord = trimmed.split(/\s+/)[0] ?? trimmed;
  const match = firstWord.match(/[\p{L}\p{N}]/u);
  if (!match?.[0]) return "?";
  return match[0].toLocaleUpperCase();
}
