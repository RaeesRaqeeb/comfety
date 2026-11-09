export type LookMode = "describe" | "read" | "ground";

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
  if (line.includes("check the ground") || text.includes("زمین دیکھو")) {
    return "ground";
  }
  return null;
}
