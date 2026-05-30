/**
 * Path: apps/mobile/app/create/formal.tsx
 * Description: Title step for the route-based formal create flow.
 */

import React, { useEffect } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { StyledInput, StyledText } from "@pallinky/ui";
import { useFormalDraft } from "../../lib/formalDraft";
import { useI18n } from "@pallinky/i18n/client";

const COLORS = {
  background: "#F6F7F9",
  surface: "#FFFFFF",
  text: "#1f2a1b",
  textMuted: "#66715f",
  primary: "#43691b",
  border: "#bac9ad",
};

export default function FormalCreateScreen() {
  const { t } = useI18n();
  const params = useLocalSearchParams<{
    prefill_title?: string;
    prefill_desc?: string;
    prefill_date?: string;
    prefill_nonce?: string;
  }>();

  const { form, updateForm, resetForm } = useFormalDraft();

  useEffect(() => {
    if (typeof params.prefill_nonce !== "string") return;

    resetForm({
      prefill_title:
        typeof params.prefill_title === "string"
          ? params.prefill_title
          : undefined,
      prefill_desc:
        typeof params.prefill_desc === "string"
          ? params.prefill_desc
          : undefined,
      prefill_date:
        typeof params.prefill_date === "string"
          ? params.prefill_date
          : undefined,
    });
  }, [params.prefill_nonce, resetForm]);
  const canContinue = !!form.title.trim();

  return (
    <SafeAreaView style={styles.wrapper} edges={["top", "left", "right"]}>
      <StatusBar barStyle="dark-content" />
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.topBar}>
        <TouchableOpacity
          onPress={() => router.replace("/create")}
          style={styles.navIconBtn}
        >
          <Ionicons name="arrow-back" size={28} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
        >
          <View>
            <StyledText style={styles.stepTitle}>
              {t("create_plan_question")}
            </StyledText>

            <StyledInput
              placeholder={t("create_title_placeholder")}
              value={form.title}
              onChangeText={(t: string) => updateForm("title", t)}
              style={styles.inputStyle}
            />

            <View style={styles.navSpacer} />

            <View style={[styles.nav, { justifyContent: "flex-end" }]}>
              <TouchableOpacity
                style={[styles.btn, !canContinue && styles.disabledBtn]}
                onPress={() => router.replace("/create/event-type")}
                disabled={!canContinue}
              >
                <Ionicons name="arrow-forward" size={28} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },

  wrapper: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  topBar: {
    flexDirection: "row",
    justifyContent: "flex-start",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 10,
  },

  navIconBtn: {
    width: 44,
    height: 44,
    justifyContent: "center",
    alignItems: "center",
  },

  container: {
    padding: 25,
    paddingTop: 10,
    paddingBottom: 40,
  },

  stepTitle: {
    fontSize: 32,
    fontWeight: "900",
    color: COLORS.text,
    marginBottom: 20,
  },

  inputStyle: {
    fontSize: 18,
    backgroundColor: COLORS.surface,
    borderRadius: 15,
    padding: 15,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: COLORS.border,
    color: COLORS.text,
  },

  nav: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 20,
  },

  navSpacer: {
    height: 10,
  },

  btn: {
    backgroundColor: COLORS.primary,
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: "center",
    alignItems: "center",
  },

  disabledBtn: {
    opacity: 0.45,
  },
});
