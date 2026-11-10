import { useEffect, useRef, useState } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text, Vibration, View } from "react-native";
import Constants from "expo-constants";
import {
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioStream,
} from "expo-audio";
import type { AudioStreamBuffer } from "expo-audio";
import { CameraView, useCameraPermissions } from "expo-camera";
import { File, Paths } from "expo-file-system";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import * as Speech from "expo-speech";
import { AudioFormat, CommitStrategy, RealtimeEvents, Scribe } from "@elevenlabs/client";
import type { RealtimeConnection } from "@elevenlabs/client";
import { wantsSimpler } from "./guideTurn";
import { lookIntent } from "./lookIntent";
import { canWatchHere, WatchScreen } from "./watchGate";
import { theme } from "./theme";
import { NOT_WATCHING, wantsWatch } from "./warning";
import {
  applyScribeMessage,
  encodeBase64,
  monoPcm16,
  resamplePcm16,
  scribeSession,
  transcriptLine,
  type Transcript,
} from "./scribe";
import { readVoice } from "./voices";

const EMPTY: Transcript = { committed: [], partial: "" };
const NO_NETWORK = "I can't answer without the network.";
const NEED_NETWORK = "I need the network to read this.";
const KEY_HINT =
  "XAI_API_KEY is not set. Put it in .env.local on this machine, then run npm run listen.";

function workerBaseUrl(): string | null {
  const configured = process.env.EXPO_PUBLIC_WORKER_URL?.replace(/\/$/, "");
  if (configured) {
    return configured;
  }
  const hostUri = Constants.expoConfig?.hostUri ?? Constants.expoGoConfig?.debuggerHost ?? "";
  const host = hostUri.split(":")[0];
  return host ? `http://${host}:8791` : null;
}

function sayStatus(line: string) {
  try {
    Speech.stop();
    Speech.speak(line);
  } catch {
    return;
  }
}

export function GuidePanel() {
  const [transcript, setTranscript] = useState<Transcript>(EMPTY);
  const [listening, setListening] = useState(false);
  const [notice, setNotice] = useState("The microphone is off.");
  const [answer, setAnswer] = useState("");
  const [aiming, setAiming] = useState<"describe" | "read" | "ground" | null>(null);
  const [watching, setWatching] = useState(false);
  const [, requestCameraPermission] = useCameraPermissions();
  const previousRef = useRef("");
  const transcriptRef = useRef<Transcript>(EMPTY);
  const cameraRef = useRef<CameraView>(null);
  const busyRef = useRef(false);
  const connectionRef = useRef<RealtimeConnection | null>(null);
  const listeningRef = useRef(false);
  const modelErrorSaid = useRef(false);
  const player = useAudioPlayer(null);
  const { stream } = useAudioStream({
    sampleRate: 16000,
    channels: 1,
    encoding: "int16",
    onBuffer: (buffer) => sendBuffer(buffer),
  });

  function sendBuffer(buffer: AudioStreamBuffer) {
    const connection = connectionRef.current;
    if (!listeningRef.current || !connection) {
      return;
    }
    const mono = monoPcm16(buffer.data, "int16", buffer.channels || 1);
    const pcm = resamplePcm16(mono, buffer.sampleRate || 16000);
    if (pcm.length === 0) {
      return;
    }
    const bytes = new Uint8Array(pcm.buffer, pcm.byteOffset, pcm.byteLength);
    connection.send({ audioBase64: encodeBase64(bytes), sampleRate: 16000 });
  }

  function stopRecognizer() {
    listeningRef.current = false;
    setListening(false);
    const connection = connectionRef.current;
    connectionRef.current = null;
    connection?.close();
    stream?.stop?.();
  }

  useEffect(() => {
    return () => {
      listeningRef.current = false;
      connectionRef.current?.close();
      stream?.stop?.();
      player.pause();
      Speech.stop();
    };
  }, [player, stream]);

  async function playAnswer(text: string) {
    const secret = process.env.EXPO_PUBLIC_DEMO_SECRET ?? "";
    const base = workerBaseUrl();
    const voice = await readVoice();
    if (!secret || !base) {
      setNotice(NO_NETWORK);
      sayStatus(NO_NETWORK);
      return;
    }
    setNotice("Speaking");
    sayStatus("Speaking");
    let response: Response;
    try {
      response = await fetch(`${base}/v1/speak`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-comfety-demo": secret,
        },
        body: JSON.stringify({ text, voice }),
      });
    } catch {
      setNotice(NO_NETWORK);
      sayStatus(NO_NETWORK);
      return;
    }
    if (!response.ok) {
      setNotice(NO_NETWORK);
      sayStatus(NO_NETWORK);
      return;
    }
    try {
      Speech.stop();
      const bytes = new Uint8Array(await response.arrayBuffer());
      const file = new File(Paths.cache, "comfety-guide.mp3");
      if (file.exists) {
        file.delete();
      }
      file.create();
      await file.write(bytes);
      await setAudioModeAsync({
        playsInSilentMode: true,
        interruptionMode: "doNotMix",
        allowsRecording: false,
        shouldPlayInBackground: false,
        shouldRouteThroughEarpiece: false,
      });
      player.replace({ uri: file.uri });
      player.play();
    } catch {
      setNotice("Speaking failed.");
    }
  }

  async function ask(line: string) {
    const secret = process.env.EXPO_PUBLIC_DEMO_SECRET ?? "";
    const base = workerBaseUrl();
    if (!secret || !base) {
      setAnswer(NO_NETWORK);
      setNotice(NO_NETWORK);
      sayStatus(NO_NETWORK);
      return;
    }
    let response: Response;
    try {
      response = await fetch(`${base}/v1/guide`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-comfety-demo": secret,
        },
        body: JSON.stringify({
          text: line,
          simpler: wantsSimpler(line),
          previous: previousRef.current,
        }),
      });
    } catch {
      setAnswer(NO_NETWORK);
      setNotice(NO_NETWORK);
      sayStatus(NO_NETWORK);
      return;
    }
    const body = (await response.json().catch(() => null)) as { text?: string; error?: string } | null;
    if (!response.ok || !body?.text) {
      const message = body?.error?.includes("XAI_API_KEY") ? KEY_HINT : body?.error || NO_NETWORK;
      setAnswer(message);
      setNotice(message);
      if (message === NO_NETWORK) {
        sayStatus(NO_NETWORK);
      }
      return;
    }
    previousRef.current = body.text;
    setAnswer(body.text);
    await playAnswer(body.text);
  }

  async function start() {
    setNotice("The microphone hears your question.");
    const permission = await requestRecordingPermissionsAsync();
    if (!permission.granted) {
      setNotice("The microphone stays off.");
      return;
    }
    if (!stream?.start) {
      setNotice("Open this screen in Expo Go on the phone. This browser preview has no microphone stream.");
      return;
    }
    const secret = process.env.EXPO_PUBLIC_DEMO_SECRET ?? "";
    const base = workerBaseUrl();
    if (!secret || !base) {
      setNotice(NO_NETWORK);
      sayStatus(NO_NETWORK);
      return;
    }
    let response: Response;
    try {
      response = await fetch(`${base}/v1/scribe-token`, {
        method: "POST",
        headers: { "x-comfety-demo": secret },
      });
    } catch {
      setNotice(NO_NETWORK);
      sayStatus(NO_NETWORK);
      return;
    }
    const body = (await response.json().catch(() => null)) as { token?: string } | null;
    if (!response.ok || !body?.token) {
      setNotice(NO_NETWORK);
      sayStatus(NO_NETWORK);
      return;
    }
    const connection = Scribe.connect({
      ...scribeSession(body.token),
      audioFormat: AudioFormat.PCM_16000,
      commitStrategy: CommitStrategy.VAD,
    });
    connectionRef.current = connection;
    connection.on(RealtimeEvents.PARTIAL_TRANSCRIPT, (data) => {
      setTranscript((current) => {
        const next = applyScribeMessage(current, data);
        transcriptRef.current = next;
        return next;
      });
    });
    connection.on(RealtimeEvents.COMMITTED_TRANSCRIPT, (data) => {
      setTranscript((current) => {
        const next = applyScribeMessage(current, data);
        transcriptRef.current = next;
        return next;
      });
    });
    try {
      await setAudioModeAsync({
        playsInSilentMode: true,
        interruptionMode: "doNotMix",
        allowsRecording: true,
        shouldPlayInBackground: false,
        shouldRouteThroughEarpiece: false,
      });
      await new Promise<void>((resolve, reject) => {
        connection.on(RealtimeEvents.OPEN, () => resolve());
        connection.on(RealtimeEvents.ERROR, () => reject(new Error("socket")));
      });
      await stream.start();
    } catch {
      connection.close();
      connectionRef.current = null;
      setNotice(NO_NETWORK);
      sayStatus(NO_NETWORK);
      return;
    }
    listeningRef.current = true;
    setListening(true);
    transcriptRef.current = EMPTY;
    setTranscript(EMPTY);
    setNotice("Listening");
    sayStatus("Listening");
  }

  async function openCamera(mode: "describe" | "read" | "ground") {
    if (busyRef.current) {
      return;
    }
    stopRecognizer();
    if (Platform.OS === "web") {
      setNotice("Open this screen in Expo Go on the phone. This browser preview has no camera.");
      return;
    }
    const permission = await requestCameraPermission();
    if (!permission.granted) {
      setNotice("The camera stays off.");
      return;
    }
    setAiming(mode);
    setNotice("Camera on");
    sayStatus("Camera on");
  }

  function closeCamera() {
    if (busyRef.current) {
      return;
    }
    setAiming(null);
    setNotice("The camera is off.");
    sayStatus("The camera is off.");
  }

  async function takePhoto() {
    if (!aiming || busyRef.current || !cameraRef.current) {
      return;
    }
    const mode = aiming;
    busyRef.current = true;
    let image = "";
    try {
      const picture = await cameraRef.current.takePictureAsync({ quality: 0.4, shutterSound: false });
      const resized = await manipulateAsync(picture.uri, [{ resize: { width: 1024 } }], {
        compress: 0.6,
        format: SaveFormat.JPEG,
        base64: true,
      });
      image = resized.base64 ?? "";
    } catch {
      image = "";
    }
    setAiming(null);
    if (!image) {
      busyRef.current = false;
      setNotice("The camera stays off.");
      return;
    }
    try {
      const secret = process.env.EXPO_PUBLIC_DEMO_SECRET ?? "";
      const base = workerBaseUrl();
      if (!secret || !base) {
        setAnswer(NEED_NETWORK);
        setNotice(NEED_NETWORK);
        sayStatus(NEED_NETWORK);
        return;
      }
      let response: Response;
      try {
        response = await fetch(`${base}/v1/look`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-comfety-demo": secret,
          },
          body: JSON.stringify({ mode, image }),
        });
      } catch {
        setAnswer(NEED_NETWORK);
        setNotice(NEED_NETWORK);
        sayStatus(NEED_NETWORK);
        return;
      }
      const body = (await response.json().catch(() => null)) as { text?: string; error?: string } | null;
      if (!response.ok || !body?.text) {
        const message = body?.error || NEED_NETWORK;
        setAnswer(message);
        setNotice(message);
        if (message === NEED_NETWORK) {
          sayStatus(NEED_NETWORK);
        }
        return;
      }
      previousRef.current = body.text;
      setAnswer(body.text);
      await playAnswer(body.text);
    } finally {
      busyRef.current = false;
    }
  }

  function sayNotWatching() {
    stopRecognizer();
    setWatching(false);
    setNotice("Not watching.");
    setAnswer(NOT_WATCHING);
    sayStatus(NOT_WATCHING);
  }

  function sayCameraStaysOff() {
    stopRecognizer();
    setWatching(false);
    setNotice("The camera stays off.");
    setAnswer("The camera stays off.");
    sayStatus("The camera stays off.");
  }

  function sayModelDidNotLoad() {
    if (modelErrorSaid.current) {
      return;
    }
    modelErrorSaid.current = true;
    stopRecognizer();
    setWatching(false);
    setNotice("The watcher model did not load.");
    setAnswer("The watcher model did not load.");
    sayStatus("The watcher model did not load.");
  }

  function speakWatch(phrase: string) {
    stopRecognizer();
    void player.pause();
    Speech.stop();
    setNotice(phrase);
    setAnswer(phrase);
    Speech.speak(phrase);
    try {
      Vibration.vibrate(200);
    } catch {
      return;
    }
  }

  function beginWatch() {
    stopRecognizer();
    if (!canWatchHere()) {
      sayNotWatching();
      return;
    }
    modelErrorSaid.current = false;
    setAiming(null);
    setNotice("Loading the watcher.");
    setWatching(true);
  }

  function stopWatch() {
    setWatching(false);
    Speech.stop();
    setNotice("Not watching.");
  }

  async function finish() {
    const line = transcriptLine(transcriptRef.current).trim();
    stopRecognizer();
    if (!line) {
      setNotice("Say a question.");
      return;
    }
    if (wantsWatch(line)) {
      beginWatch();
      return;
    }
    const mode = lookIntent(line);
    if (mode) {
      await openCamera(mode);
      return;
    }
    await ask(line);
  }

  return (
    <View style={styles.panel} testID="guide-panel">
      <Text style={styles.body}>This is not a cane.</Text>
      {watching ? (
        <>
          <WatchScreen
            onWarning={speakWatch}
            onReady={speakWatch}
            onCameraDenied={sayCameraStaysOff}
            onModelError={sayModelDidNotLoad}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Stop watching"
            onPress={stopWatch}
            testID="watch-stop"
            style={({ pressed }) => [styles.look, pressed && styles.pressed]}
          >
            <Text style={styles.lookTitle}>Stop watching</Text>
          </Pressable>
        </>
      ) : aiming ? (
        <>
          <CameraView
            ref={cameraRef}
            facing="back"
            mute
            mode="picture"
            ratio="4:3"
            style={styles.preview}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Take photo"
            onPress={() => {
              void takePhoto();
            }}
            testID="look-take"
            style={({ pressed }) => [styles.talk, pressed && styles.pressed]}
          >
            <Text style={styles.talkTitle}>Take photo</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Cancel"
            onPress={closeCamera}
            testID="look-cancel"
            style={({ pressed }) => [styles.look, pressed && styles.pressed]}
          >
            <Text style={styles.lookTitle}>Cancel</Text>
          </Pressable>
        </>
      ) : (
        <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={listening ? "Stop" : "Talk"}
        onPress={() => {
          if (listeningRef.current) {
            void finish();
          } else {
            void start();
          }
        }}
        testID="guide-talk"
        style={({ pressed }) => [styles.talk, listening && styles.talkOn, pressed && styles.pressed]}
      >
        <Text style={[styles.talkTitle, listening && styles.ink]}>{listening ? "Stop" : "Talk"}</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="What's in front of me"
        onPress={() => {
          void openCamera("describe");
        }}
        testID="look-describe"
        style={({ pressed }) => [styles.look, pressed && styles.pressed]}
      >
        <Text style={styles.lookTitle}>What's in front of me</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Read this"
        onPress={() => {
          void openCamera("read");
        }}
        testID="look-read"
        style={({ pressed }) => [styles.look, pressed && styles.pressed]}
      >
        <Text style={styles.lookTitle}>Read this</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Check the ground"
        onPress={() => {
          void openCamera("ground");
        }}
        testID="look-ground"
        style={({ pressed }) => [styles.look, pressed && styles.pressed]}
      >
        <Text style={styles.lookTitle}>Check the ground</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Watch obstacles"
        onPress={beginWatch}
        testID="watch-obstacles"
        style={({ pressed }) => [styles.look, pressed && styles.pressed]}
      >
        <Text style={styles.lookTitle}>Watch obstacles</Text>
      </Pressable>
        </>
      )}
      <Text accessibilityLiveRegion="polite" style={styles.status} testID="guide-status">
        {notice}
      </Text>
      {aiming || watching ? null : (
        <ScrollView style={styles.answer} testID="guide-answer">
          <Text style={styles.answerText}>{answer || transcriptLine(transcript) || "Ask a question."}</Text>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    flex: 1,
    minHeight: 0,
    gap: 8,
  },
  body: {
    color: theme.textMuted,
    fontSize: 16,
    lineHeight: 22,
  },
  talk: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.surface,
    borderRadius: 14,
  },
  talkOn: {
    backgroundColor: theme.accent,
    borderColor: theme.accent,
  },
  talkTitle: {
    color: theme.text,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "700",
  },
  look: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 42,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.surfaceGuide,
    borderRadius: 14,
  },
  lookTitle: {
    color: theme.text,
    fontSize: 18,
    lineHeight: 22,
    fontWeight: "600",
  },
  preview: {
    flex: 1,
    width: "100%",
    borderRadius: 16,
    overflow: "hidden",
  },
  status: {
    color: theme.textMuted,
    fontSize: 20,
    lineHeight: 28,
  },
  answer: {
    flex: 1,
    minHeight: 0,
  },
  answerText: {
    color: theme.text,
    fontSize: 28,
    lineHeight: 36,
  },
  ink: {
    color: theme.onAccent,
  },
  pressed: {
    opacity: 0.85,
  },
});
