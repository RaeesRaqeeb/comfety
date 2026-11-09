export const STARTER_REPLIES = [
  "جی",
  "نہیں",
  "ایک منٹ میں لکھ رہا ہوں",
  "Please say that again",
  "کتنا ہے؟",
  "شکریہ",
];

export function addReply(replies: string[], text: string): string[] {
  const phrase = text.trim();
  if (!phrase || replies.includes(phrase)) {
    return replies;
  }
  return [...replies, phrase];
}

export function replaceReply(replies: string[], index: number, text: string): string[] {
  const phrase = text.trim();
  if (!phrase || index < 0 || index >= replies.length) {
    return replies;
  }
  const next = replies.slice();
  next[index] = phrase;
  return next;
}

export function deleteReply(replies: string[], index: number): string[] {
  if (index < 0 || index >= replies.length) {
    return replies;
  }
  return replies.filter((_, item) => item !== index);
}
