export function wantsSimpler(text: string): boolean {
  const line = text.trim().toLowerCase();
  if (line === "what" || line === "what?" || line === "again" || line === "simpler") {
    return true;
  }
  if (text.includes("سمجھ نہیں آئی")) {
    return true;
  }
  return /\bagain\b/i.test(text) || /\bsimpler\b/i.test(text);
}
