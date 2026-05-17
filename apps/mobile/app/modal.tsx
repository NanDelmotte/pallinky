import { Link } from "expo-router";
import { StyleSheet } from "react-native";

import { ThemedText, ThemedView } from "@pallinky/ui";
import { useI18n } from "@pallinky/i18n/client";

export default function ModalScreen() {
  const { t } = useI18n();

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title">{t("modal_title")}</ThemedText>
      <Link href="/" dismissTo style={styles.link}>
        <ThemedText type="link">{t("modal_home")}</ThemedText>
      </Link>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  link: {
    marginTop: 15,
    paddingVertical: 15,
  },
});
