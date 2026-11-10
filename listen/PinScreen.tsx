import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { pinUnlocks } from "./pinGate";

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
    <View style={styles.column} testID="pin-screen">
      <Text accessibilityRole="header" style={styles.title}>
        Comfety
      </Text>
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
        placeholderTextColor="#888888"
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
      <Text accessibilityLiveRegion="polite" style={styles.body} testID="pin-status">
        {error || "Demo gate only. Not a real account."}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  column: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 14,
  },
  title: {
    color: "#ffffff",
    fontSize: 40,
    lineHeight: 46,
    fontWeight: "700",
    letterSpacing: 0.4,
  },
  body: {
    color: "#ffffff",
    fontSize: 18,
    lineHeight: 24,
  },
  input: {
    borderWidth: 2,
    borderColor: "#ffffff",
    color: "#ffffff",
    fontSize: 28,
    lineHeight: 34,
    paddingHorizontal: 14,
    paddingVertical: 12,
    letterSpacing: 8,
  },
  unlock: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 52,
    borderWidth: 2,
    borderColor: "#ffffff",
    backgroundColor: "#ffffff",
    paddingHorizontal: 14,
  },
  unlockTitle: {
    color: "#000000",
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "700",
  },
  pressed: {
    opacity: 0.72,
  },
});
