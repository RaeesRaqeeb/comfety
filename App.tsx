import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import * as SystemUI from "expo-system-ui";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { GuidePanel } from "./listen/GuidePanel";
import { IntroSheet } from "./listen/IntroSheet";
import { introAlreadySeen, markIntroSeen } from "./listen/introFlag";
import { ListenPanel } from "./listen/ListenPanel";
import { PinScreen } from "./listen/PinScreen";
import { theme } from "./listen/theme";

const FONT = "Noto Nastaliq Urdu";
const URDU_SAMPLE = "سمجھ نہیں آئی";

const fonts = {
  [FONT]: require("./assets/fonts/NotoNastaliqUrdu.ttf"),
};

SplashScreen.preventAutoHideAsync().catch(() => {});
SystemUI.setBackgroundColorAsync(theme.bg).catch(() => {});

type Choice = "talk" | "guide";

export default function App() {
  return (
    <SafeAreaProvider>
      <Home />
    </SafeAreaProvider>
  );
}

function Home() {
  const [loaded, error] = useFonts(fonts);
  const [unlocked, setUnlocked] = useState(false);
  const [showIntro, setShowIntro] = useState(false);
  const [choice, setChoice] = useState<Choice | null>(null);

  useEffect(() => {
    if (loaded || error) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [loaded, error]);

  async function handleUnlock() {
    setUnlocked(true);
    const seen = await introAlreadySeen();
    setShowIntro(!seen);
  }

  async function finishIntro() {
    setShowIntro(false);
    await markIntroSeen();
  }

  if (!loaded && !error) {
    return (
      <View style={styles.screen}>
        <Text style={styles.body}>Loading the Urdu font.</Text>
        <StatusBar style="light" />
      </View>
    );
  }

  const fontReady = loaded && !error;

  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom", "left", "right"]}>
      <StatusBar style="light" />
      <View style={styles.blobTop} />
      <View style={styles.blobBottom} />
      {!unlocked ? (
        <PinScreen onUnlock={() => {
          void handleUnlock();
        }} />
      ) : (
        <View style={styles.column}>
          <Text accessibilityRole="header" style={styles.title}>
            Comfety
          </Text>
          <Text style={styles.subtitle}>Talk with people. Guide with care.</Text>
          <ChoiceButton
            title="Talk"
            tone="talk"
            selected={choice === "talk"}
            compact={choice !== null}
            hint="Selects Talk. Listening starts only from the Listen button."
            body="The microphone hears the other person, or your question. It is off until you tap Listen."
            onPress={() => setChoice("talk")}
            testID="talk-choice"
          />
          <ChoiceButton
            title="Guide"
            tone="guide"
            selected={choice === "guide"}
            compact={choice !== null}
            hint="Selects Guide. Does not turn the camera on."
            body="The camera looks only after you ask. It is off. This is not a cane."
            onPress={() => setChoice("guide")}
            testID="guide-choice"
          />
          <Text accessibilityLiveRegion="polite" style={styles.status} testID="choice-status">
            {statusLine(choice)}
          </Text>
          {choice === "talk" ? (
            <ListenPanel />
          ) : choice === "guide" ? (
            <GuidePanel />
          ) : fontReady ? (
            <View testID="urdu-sample" style={styles.sample}>
              <Text style={styles.body}>Set in Noto Nastaliq Urdu.</Text>
              <Text style={styles.urdu}>{URDU_SAMPLE}</Text>
            </View>
          ) : (
            <Text style={styles.body} testID="urdu-error">
              The Urdu font failed to load.
            </Text>
          )}
        </View>
      )}
      <IntroSheet
        visible={showIntro}
        onContinue={() => {
          void finishIntro();
        }}
      />
    </SafeAreaView>
  );
}

function statusLine(choice: Choice | null): string {
  if (choice === "talk") {
    return "Talk is selected.";
  }
  if (choice === "guide") {
    return "Guide is selected. The camera stays off.";
  }
  return "Tap Talk or Guide.";
}

function ChoiceButton({
  title,
  body,
  hint,
  selected,
  compact,
  tone,
  onPress,
  testID,
}: {
  title: string;
  body: string;
  hint: string;
  selected: boolean;
  compact: boolean;
  tone: "talk" | "guide";
  onPress: () => void;
  testID: string;
}) {
  const toneStyle = tone === "talk" ? styles.talkTone : styles.guideTone;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${body}`}
      accessibilityHint={hint}
      accessibilityState={{ selected }}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [
        styles.choice,
        toneStyle,
        compact ? styles.choiceCompact : styles.choiceFill,
        selected && styles.choiceOn,
        pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.choiceTitle, selected && styles.choiceTitleOn]}>{title}</Text>
      {compact ? null : <Text style={[styles.body, selected && styles.choiceBodyOn]}>{body}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.bg,
    overflow: "hidden",
  },
  blobTop: {
    position: "absolute",
    top: -100,
    right: -70,
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: theme.surfaceTalk,
    opacity: 0.35,
  },
  blobBottom: {
    position: "absolute",
    bottom: -60,
    left: -70,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: theme.surfaceGuide,
    opacity: 0.3,
  },
  column: {
    flex: 1,
    paddingHorizontal: 18,
    paddingVertical: 12,
    gap: 12,
  },
  title: {
    color: theme.text,
    fontSize: 40,
    lineHeight: 46,
    fontWeight: "700",
  },
  subtitle: {
    color: theme.accent,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "600",
    marginTop: -4,
  },
  choice: {
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 18,
    paddingVertical: 16,
    borderWidth: 1,
    borderRadius: 20,
  },
  talkTone: {
    backgroundColor: theme.surfaceTalk,
    borderColor: theme.border,
  },
  guideTone: {
    backgroundColor: theme.surfaceGuide,
    borderColor: "#2F6F8F",
  },
  choiceFill: {
    flex: 1,
    minHeight: 0,
  },
  choiceCompact: {
    flexGrow: 0,
    flexShrink: 0,
    paddingVertical: 12,
  },
  choiceOn: {
    backgroundColor: theme.accent,
    borderColor: theme.accent,
  },
  pressed: {
    opacity: 0.88,
  },
  choiceTitle: {
    color: theme.text,
    fontSize: 36,
    lineHeight: 42,
    fontWeight: "700",
  },
  choiceTitleOn: {
    color: theme.onAccent,
  },
  body: {
    color: theme.text,
    fontSize: 17,
    lineHeight: 24,
  },
  choiceBodyOn: {
    color: theme.onAccent,
  },
  status: {
    color: theme.textMuted,
    fontSize: 17,
    lineHeight: 23,
  },
  sample: {
    gap: 8,
    paddingTop: 8,
  },
  urdu: {
    fontFamily: FONT,
    color: theme.text,
    fontSize: 30,
    lineHeight: 72,
    textAlign: "center",
    writingDirection: "rtl",
  },
});
