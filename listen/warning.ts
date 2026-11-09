export type Box = {
  label: string;
  heightRatio: number;
  centerXRatio: number;
};

export type Watcher = {
  streak: number;
  lastPhrase: string | null;
  cooldownUntil: number;
};

const VEHICLES = new Set(["bicycle", "car", "motorcycle", "bus", "truck"]);

export const NOT_WATCHING =
  "I am not watching. This screen cannot see a person or a vehicle. I can miss things. This is not a cane.";

export function wantsWatch(text: string): boolean {
  const line = text.trim().toLowerCase();
  return line.includes("watch obstacles") || line.includes("start watching");
}

export function createWatcher(): Watcher {
  return { streak: 0, lastPhrase: null, cooldownUntil: 0 };
}

export function warningPhrase(label: string, centerXRatio: number): string | null {
  const kind = label === "person" ? "Person" : VEHICLES.has(label) ? "Vehicle" : null;
  if (!kind) {
    return null;
  }
  if (centerXRatio < 0.35) {
    return `${kind} close on the left`;
  }
  if (centerXRatio > 0.65) {
    return `${kind} close on the right`;
  }
  return `${kind} close ahead`;
}

export function nextWarning(
  state: Watcher,
  boxes: Box[],
  now: number,
): { state: Watcher; speak: string | null } {
  const close = boxes
    .filter((box) => box.heightRatio >= 0.4 && warningPhrase(box.label, box.centerXRatio))
    .sort((a, b) => b.heightRatio - a.heightRatio)[0];
  if (!close || now < state.cooldownUntil) {
    return { state: { ...state, streak: 0, lastPhrase: null }, speak: null };
  }
  const phrase = warningPhrase(close.label, close.centerXRatio);
  const streak = state.lastPhrase === phrase ? state.streak + 1 : 1;
  if (streak >= 3 && now >= state.cooldownUntil) {
    return {
      state: { streak: 0, lastPhrase: null, cooldownUntil: now + 4000 },
      speak: phrase,
    };
  }
  return { state: { ...state, streak, lastPhrase: phrase }, speak: null };
}
