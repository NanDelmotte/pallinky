import React from "react";
import {
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { StyledText } from "@pallinky/ui";
import { useI18n } from "@pallinky/i18n/client";

type Props = {
  visible: boolean;
  onClose: () => void;
};

const COLORS = {
  background: "#F6F7F9",
  surface: "#FFFFFF",
  text: "#1f2a1b",
  primary: "#43691b",
  borderSoft: "#e7ede2",
};

export default function WhatsAppHelpSheet({ visible, onClose }: Props) {
  const { t } = useI18n();
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.wrap}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose}>
            <StyledText style={styles.headerAction}>
              {t("common_close")}
            </StyledText>
          </TouchableOpacity>

          <StyledText style={styles.title}>{t("whatsapp_title")}</StyledText>

          <View style={styles.headerSpacer} />
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          <StyledText style={styles.helpText}>
            {t("whatsapp_body_1")}
          </StyledText>

          <StyledText style={styles.helpText}>
            {t("whatsapp_body_2")}
          </StyledText>

          <StyledText style={[styles.helpText, styles.topGap]}>
            {t("whatsapp_body_3")}
          </StyledText>

          <StyledText style={styles.helpText}>{t("whatsapp_ios")}</StyledText>

          <StyledText style={styles.helpText}>
            {t("whatsapp_android")}
          </StyledText>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 6,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderSoft,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerAction: {
    fontSize: 15,
    fontWeight: "800",
    color: COLORS.primary,
  },
  headerSpacer: {
    width: 46,
  },
  title: {
    fontSize: 17,
    fontWeight: "900",
    color: COLORS.text,
  },
  content: {
    padding: 20,
  },
  helpText: {
    fontSize: 14,
    color: COLORS.text,
    lineHeight: 20,
    marginBottom: 8,
  },
  topGap: {
    marginTop: 12,
  },
});
