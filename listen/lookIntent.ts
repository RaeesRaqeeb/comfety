export type LookMode = "describe" | "read";

export function lookIntent(text: string): LookMode | null {
  const line = text.trim().toLowerCase();
  if (
    line.includes("what's in front") ||
    line.includes("whats in front") ||
    line.includes("what is in front") ||
    text.includes("سامنے کیا")
  ) {
    return "describe";
  }
  if (/\bread (this|it)\b/i.test(text) || text.includes("پڑھو") || text.includes("پڑھ")) {
    return "read";
  }
  return null;
}
