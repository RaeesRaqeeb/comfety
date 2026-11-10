/** Demo PIN only. Not real authentication. */
export const DEMO_PIN = "2026";

export function pinUnlocks(value: string): boolean {
  return value.trim() === DEMO_PIN;
}
