import { File, Paths } from "expo-file-system";
import { STARTER_REPLIES } from "./replyList";

const FILE_NAME = "comfety-replies.json";

export async function readReplies(): Promise<string[]> {
  try {
    const file = new File(Paths.document, FILE_NAME);
    if (!file.exists) {
      return STARTER_REPLIES;
    }
    const parsed = JSON.parse(await file.text()) as unknown;
    if (!Array.isArray(parsed) || parsed.some((item) => typeof item !== "string")) {
      return STARTER_REPLIES;
    }
    return parsed;
  } catch {
    return STARTER_REPLIES;
  }
}

export async function writeReplies(replies: string[]): Promise<void> {
  try {
    const file = new File(Paths.document, FILE_NAME);
    if (!file.exists) {
      file.create();
    }
    await file.write(JSON.stringify(replies));
  } catch {
    return;
  }
}
