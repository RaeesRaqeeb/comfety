import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { theme } from "./theme";

export function IntroSheet({ visible, onContinue }: { visible: boolean; onContinue: () => void }) {
  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onContinue}>
      <View style={styles.backdrop} testID="intro-sheet">
        <View style={styles.card}>
          <Text accessibilityRole="header" style={styles.title}>
            Welcome to Comfety
          </Text>
          <Text style={styles.body}>
            Comfety is a phone held between two people. Talk helps someone who cannot speak. Guide helps
            someone who cannot see.
          </Text>
          <Text style={styles.body}>
            Talk listens to the other person and speaks your typed reply. Guide answers questions, can
            look at one photo, and can watch for close people or vehicles.
          </Text>
          <Text style={styles.note}>Guide is not a cane. It can miss things.</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Continue"
            testID="intro-continue"
            onPress={onContinue}
            style={({ pressed }) => [styles.button, pressed && styles.pressed]}
          >
            <Text style={styles.buttonTitle}>Continue</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(7, 46, 44, 0.72)",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  card: {
    backgroundColor: theme.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.border,
    paddingHorizontal: 20,
    paddingVertical: 22,
    gap: 14,
  },
  title: {
    color: theme.text,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "700",
  },
  body: {
    color: theme.text,
    fontSize: 17,
    lineHeight: 25,
  },
  note: {
    color: theme.accent,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "600",
  },
  button: {
    marginTop: 4,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 52,
    borderRadius: 14,
    backgroundColor: theme.accent,
    paddingHorizontal: 14,
  },
  buttonTitle: {
    color: theme.onAccent,
    fontSize: 20,
    lineHeight: 26,
    fontWeight: "700",
  },
  pressed: {
    opacity: 0.85,
  },
});
