import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import * as SystemUI from "expo-system-ui";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { GuidePanel } from "./listen/GuidePanel";
import { ListenPanel } from "./listen/ListenPanel";
import { PinScreen } from "./listen/PinScreen";

const FONT = "Noto Nastaliq Urdu";
const URDU_SAMPLE = "سمجھ نہیں آئی";

const fonts = {
  [FONT]: require("./assets/fonts/NotoNastaliqUrdu.ttf"),
};

SplashScreen.preventAutoHideAsync().catch(() => {});
SystemUI.setBackgroundColorAsync("#000000").catch(() => {});

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
  const [choice, setChoice] = useState<Choice | null>(null);

  useEffect(() => {
    if (loaded || error) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [loaded, error]);

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
      {!unlocked ? (
        <PinScreen onUnlock={() => setUnlocked(true)} />
      ) : (
        <View style={styles.column}>
          <Text accessibilityRole="header" style={styles.title}>
            Comfety
          </Text>
          <ChoiceButton
            title="Talk"
            selected={choice === "talk"}
            compact={choice !== null}
            hint="Selects Talk. Listening starts only from the Listen button."
            body="The microphone hears the other person, or your question. It is off until you tap Listen."
            onPress={() => setChoice("talk")}
            testID="talk-choice"
          />
          <ChoiceButton
            title="Guide"
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
  onPress,
  testID,
}: {
  title: string;
  body: string;
  hint: string;
  selected: boolean;
  compact: boolean;
  onPress: () => void;
  testID: string;
}) {
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
        compact ? styles.choiceCompact : styles.choiceFill,
        selected ? styles.choiceOn : styles.choiceOff,
        pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.choiceTitle, selected && styles.ink]}>{title}</Text>
      {compact ? null : <Text style={[styles.body, selected && styles.ink]}>{body}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#000000",
  },
  column: {
    flex: 1,
    paddingHorizontal: 18,
    paddingVertical: 12,
    gap: 12,
  },
  title: {
    color: "#ffffff",
    fontSize: 36,
    lineHeight: 42,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  choice: {
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 2,
  },
  choiceFill: {
    flex: 1,
    minHeight: 0,
  },
  choiceCompact: {
    flexGrow: 0,
    flexShrink: 0,
    paddingVertical: 10,
  },
  choiceOff: {
    backgroundColor: "#000000",
    borderColor: "#ffffff",
  },
  choiceOn: {
    backgroundColor: "#ffffff",
    borderColor: "#ffffff",
  },
  pressed: {
    opacity: 0.72,
  },
  choiceTitle: {
    color: "#ffffff",
    fontSize: 36,
    lineHeight: 42,
    fontWeight: "700",
  },
  body: {
    color: "#ffffff",
    fontSize: 17,
    lineHeight: 24,
  },
  status: {
    color: "#ffffff",
    fontSize: 18,
    lineHeight: 24,
  },
  sample: {
    gap: 8,
    paddingTop: 8,
  },
  ink: {
    color: "#000000",
  },
  urdu: {
    fontFamily: FONT,
    color: "#ffffff",
    fontSize: 30,
    lineHeight: 72,
    textAlign: "center",
    writingDirection: "rtl",
  },
});
