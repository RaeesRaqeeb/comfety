import { File, Paths } from "expo-file-system";

const FLAG = "comfety-intro-seen.txt";

function flagFile() {
  return new File(Paths.document, FLAG);
}

export async function introAlreadySeen(): Promise<boolean> {
  try {
    return flagFile().exists;
  } catch {
    return false;
  }
}

export async function markIntroSeen(): Promise<void> {
  try {
    const file = flagFile();
    if (!file.exists) {
      file.create();
    }
    await file.write("1");
  } catch {
    return;
  }
}
