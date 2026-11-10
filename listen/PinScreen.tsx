import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { pinUnlocks } from "./pinGate";
import { theme } from "./theme";

export function PinScreen({ onUnlock }: { onUnlock: () => void }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");

  function submit() {
    if (pinUnlocks(pin)) {
      setError("");
      onUnlock();
      return;
    }
    setError("That PIN is wrong.");
  }

  return (
    <View style={styles.screen} testID="pin-screen">
      <View style={styles.blobTop} />
      <View style={styles.blobBottom} />
      <View style={styles.column}>
        <Text accessibilityRole="header" style={styles.brand}>
          Comfety
        </Text>
        <Text style={styles.tagline}>A phone held between two people</Text>
        <Text style={styles.body}>Enter the demo PIN</Text>
        <TextInput
          accessibilityLabel="Demo PIN"
          testID="pin-input"
          value={pin}
          onChangeText={(value) => {
            setPin(value.replace(/[^0-9]/g, "").slice(0, 8));
            if (error) {
              setError("");
            }
          }}
          onSubmitEditing={submit}
          keyboardType="number-pad"
          secureTextEntry
          maxLength={8}
          style={styles.input}
          placeholderTextColor={theme.textMuted}
          placeholder="PIN"
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Unlock"
          testID="pin-unlock"
          onPress={submit}
          style={({ pressed }) => [styles.unlock, pressed && styles.pressed]}
        >
          <Text style={styles.unlockTitle}>Unlock</Text>
        </Pressable>
        <Text accessibilityLiveRegion="polite" style={styles.hint} testID="pin-status">
          {error || "Demo gate only. Not a real account."}
        </Text>
      </View>
    </View>
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
    top: -80,
    right: -60,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: theme.surfaceTalk,
    opacity: 0.55,
  },
  blobBottom: {
    position: "absolute",
    bottom: -40,
    left: -50,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: theme.surfaceGuide,
    opacity: 0.45,
  },
  column: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 20,
    gap: 14,
  },
  brand: {
    color: theme.text,
    fontSize: 48,
    lineHeight: 54,
    fontWeight: "700",
  },
  tagline: {
    color: theme.accent,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "600",
    marginBottom: 8,
  },
  body: {
    color: theme.text,
    fontSize: 18,
    lineHeight: 24,
  },
  input: {
    borderWidth: 2,
    borderColor: theme.border,
    backgroundColor: theme.surface,
    borderRadius: 16,
    color: theme.text,
    fontSize: 28,
    lineHeight: 34,
    paddingHorizontal: 16,
    paddingVertical: 14,
    letterSpacing: 8,
  },
  unlock: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 54,
    borderRadius: 16,
    backgroundColor: theme.accent,
    paddingHorizontal: 14,
  },
  unlockTitle: {
    color: theme.onAccent,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "700",
  },
  hint: {
    color: theme.textMuted,
    fontSize: 16,
    lineHeight: 22,
  },
  pressed: {
    opacity: 0.85,
  },
});
