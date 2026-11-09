import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import * as SystemUI from "expo-system-ui";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";

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
      <View style={styles.column}>
        <Text accessibilityRole="header" style={styles.title}>
          Comfety
        </Text>
        <ChoiceButton
          title="Talk"
          selected={choice === "talk"}
          hint="Selects Talk. Does not turn the microphone on."
          body="The microphone hears the other person, or your question. It is off."
          onPress={() => setChoice("talk")}
          testID="talk-choice"
        />
        <ChoiceButton
          title="Guide"
          selected={choice === "guide"}
          hint="Selects Guide. Does not turn the camera on."
          body="The camera looks only after you ask. It is off. This is not a cane."
          onPress={() => setChoice("guide")}
          testID="guide-choice"
        />
        <Text accessibilityLiveRegion="polite" style={styles.body} testID="choice-status">
          {statusLine(choice)}
        </Text>
        {fontReady ? (
          <View testID="urdu-sample">
            <Text style={styles.body}>Set in Noto Nastaliq Urdu.</Text>
            <Text style={styles.urdu}>{URDU_SAMPLE}</Text>
          </View>
        ) : (
          <Text style={styles.body} testID="urdu-error">
            The Urdu font failed to load.
          </Text>
        )}
      </View>
    </SafeAreaView>
  );
}

function statusLine(choice: Choice | null): string {
  if (choice === "talk") {
    return "Talk is selected. The microphone stays off.";
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
  onPress,
  testID,
}: {
  title: string;
  body: string;
  hint: string;
  selected: boolean;
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
        selected ? styles.choiceOn : styles.choiceOff,
        pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.choiceTitle, selected && styles.ink]}>{title}</Text>
      <Text style={[styles.body, selected && styles.ink]}>{body}</Text>
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
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  title: {
    color: "#ffffff",
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "600",
  },
  choice: {
    flex: 1,
    minHeight: 0,
    justifyContent: "center",
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 2,
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
    fontSize: 34,
    lineHeight: 40,
    fontWeight: "600",
  },
  body: {
    color: "#ffffff",
    fontSize: 16,
    lineHeight: 22,
  },
  ink: {
    color: "#000000",
  },
  urdu: {
    fontFamily: FONT,
    color: "#ffffff",
    fontSize: 28,
    lineHeight: 70,
    textAlign: "center",
    writingDirection: "rtl",
  },
});
