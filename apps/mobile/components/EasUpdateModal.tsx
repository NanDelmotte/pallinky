import React from "react";
import {
  ActivityIndicator,
  Modal,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { StyledText } from "@pallinky/ui";

type Props = {
  visible: boolean;
  restarting: boolean;
  onLater: () => void;
  onUpdateNow: () => void;
};

const COLORS = {
  overlay: "rgba(0,0,0,0.34)",
  surface: "#FFFFFF",
  text: "#1f2a1b",
  textMuted: "#66715f",
  primary: "#43691b",
  primarySoft: "#edf5e6",
  borderSoft: "#e7ede2",
};

export default function EasUpdateModal({
  visible,
  restarting,
  onLater,
  onUpdateNow,
}: Props) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={() => {
        if (!restarting) {
          onLater();
        }
      }}
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.iconWrap}>
            <Ionicons name="sparkles-outline" size={28} color={COLORS.primary} />
          </View>

          <StyledText style={styles.title}>Update available</StyledText>
          <StyledText style={styles.body}>
            A newer version of Pallinky is ready. Restart now to get the latest
            improvements.
          </StyledText>

          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.button, styles.secondaryButton]}
              onPress={onLater}
              disabled={restarting}
            >
              <StyledText style={styles.secondaryButtonText}>Later</StyledText>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.primaryButton]}
              onPress={onUpdateNow}
              disabled={restarting}
            >
              {restarting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <StyledText style={styles.primaryButtonText}>
                  Update now
                </StyledText>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: COLORS.overlay,
    justifyContent: "center",
    padding: 24,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: COLORS.borderSoft,
    padding: 24,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginBottom: 16,
  },
  title: {
    color: COLORS.text,
    fontSize: 24,
    fontWeight: "900",
    textAlign: "center",
    marginBottom: 10,
  },
  body: {
    color: COLORS.textMuted,
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    marginBottom: 24,
  },
  actions: {
    flexDirection: "row",
    gap: 12,
  },
  button: {
    flex: 1,
    minHeight: 50,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  secondaryButton: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.borderSoft,
  },
  primaryButton: {
    backgroundColor: COLORS.primary,
  },
  secondaryButtonText: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: "800",
  },
  primaryButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "800",
  },
});
