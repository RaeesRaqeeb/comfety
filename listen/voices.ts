import { File, Paths } from "expo-file-system";

export const VOICES = [
  { id: "warm-woman", label: "warm woman" },
  { id: "warm-man", label: "warm man" },
  { id: "clear-woman", label: "clear woman" },
  { id: "clear-man", label: "clear man" },
] as const;

export type VoiceId = (typeof VOICES)[number]["id"];

const FILE_NAME = "comfety-voice.txt";

export function isVoiceId(value: string): value is VoiceId {
  return VOICES.some((voice) => voice.id === value);
}

export async function readVoice(): Promise<VoiceId> {
  try {
    const file = new File(Paths.document, FILE_NAME);
    if (!file.exists) {
      return "warm-woman";
    }
    const saved = (await file.text()).trim();
    if (isVoiceId(saved)) {
      return saved;
    }
  } catch {
    return "warm-woman";
  }
  return "warm-woman";
}

export async function saveVoice(voice: VoiceId): Promise<void> {
  try {
    const file = new File(Paths.document, FILE_NAME);
    if (!file.exists) {
      file.create();
    }
    await file.write(voice);
  } catch {
    return;
  }
}
