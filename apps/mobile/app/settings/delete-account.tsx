/**
 * Path: app/settings/delete-account.tsx
 * Description: Destructive confirmation screen for account deletion.
 */

import React, { useState } from "react";
import { View, StyleSheet, TouchableOpacity, Alert } from "react-native";
import { StyledText } from "@pallinky/ui";
import { supabase } from "@pallinky/core";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useI18n } from "@pallinky/i18n/client";

export default function DeleteAccountScreen() {
  const router = useRouter();
  const { t } = useI18n();
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    try {
      setLoading(true);

      const { data, error } = await supabase.functions.invoke(
        "delete-account",
        {
          method: "POST",
        },
      );

      if (error || !data?.ok) {
        let details = error?.message;

        const context = (
          error as { context?: { json?: () => Promise<unknown> } } | null
        )?.context;

        if (context?.json) {
          try {
            const body = await context.json();

            if (body && typeof body === "object") {
              const { details: responseDetails, error: responseError } =
                body as {
                  details?: string;
                  error?: string;
                };

              details = responseDetails || responseError || details;
            }
          } catch (parseError) {
            console.log("DELETE_ACCOUNT_ERROR_PARSE_WARNING", parseError);
          }
        }

        throw new Error(details || t("delete_account_failed"));
      }

      const { error: signOutError } = await supabase.auth.signOut({
        scope: "local",
      });

      // If the server already deleted the auth user, the session can be stale.
      // We still want to continue to the signed-out screen.
      if (signOutError) {
        console.log("Local sign-out warning:", signOutError.message);
      }

      router.replace("/auth/verify");
    } catch (err: any) {
      console.log("DELETE_ACCOUNT_ERROR", err);
      Alert.alert(
        t("common_error"),
        err?.message || t("delete_account_generic_error"),
      );
      setLoading(false);
    }
  }

  function confirmDelete() {
    Alert.alert(
      t("delete_account_confirm_title"),
      t("delete_account_warning"),
      [
        { text: t("common_cancel"), style: "cancel" },
        {
          text: t("common_delete"),
          style: "destructive",
          onPress: handleDelete,
        },
      ],
    );
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={() => router.back()} style={styles.backArrow}>
        <Ionicons name="arrow-back" size={28} color="#43691b" />
      </TouchableOpacity>

      <StyledText style={styles.title}>{t("delete_account_title")}</StyledText>

      <StyledText style={styles.body}>{t("delete_account_intro")}</StyledText>

      <View style={styles.list}>
        <StyledText style={styles.item}>
          {t("delete_account_profile")}
        </StyledText>
        <StyledText style={styles.item}>
          {t("delete_account_events")}
        </StyledText>
        <StyledText style={styles.item}>{t("delete_account_rsvps")}</StyledText>
        <StyledText style={styles.item}>
          {t("delete_account_messages")}
        </StyledText>
      </View>

      <StyledText style={styles.warning}>
        {t("delete_account_warning")}
      </StyledText>

      <TouchableOpacity
        style={styles.deleteBtn}
        onPress={confirmDelete}
        disabled={loading}
      >
        <StyledText style={styles.deleteText}>
          {loading ? t("delete_account_deleting") : t("delete_account_title")}
        </StyledText>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F6F7F9",
    padding: 30,
    paddingTop: 60,
  },
  backArrow: {
    marginBottom: 10,
    width: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: "900",
    color: "#1f2a1b",
    marginBottom: 20,
  },
  body: {
    fontSize: 16,
    color: "#1f2a1b",
    marginBottom: 10,
  },
  list: {
    marginBottom: 20,
  },
  item: {
    fontSize: 15,
    color: "#66715f",
    marginBottom: 6,
  },
  warning: {
    fontSize: 14,
    color: "#e63946",
    marginBottom: 30,
  },
  deleteBtn: {
    backgroundColor: "#e63946",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  deleteText: {
    color: "#fff",
    fontWeight: "bold",
  },
});
