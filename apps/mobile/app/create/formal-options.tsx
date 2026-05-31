/**
 * Path: apps/mobile/app/create/formal-options.tsx
 * Description: Route-based options step for the formal create flow.
 * Handles "a few options" and "not sure yet" modes using the shared formal draft.
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

import { StyledText } from "@pallinky/ui";

import DateOptionPicker from "../../components/DateOptionPicker";
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

export default function FormalOptionsScreen() {
  const { t } = useI18n();
  const params = useLocalSearchParams<{
    prefill_title?: string;
    prefill_desc?: string;
    prefill_date?: string;
  }>();

  const { form, updateForm, initializeFromPrefill } = useFormalDraft();

  useEffect(() => {
    initializeFromPrefill({
      prefill_title: params.prefill_title,
      prefill_desc: params.prefill_desc,
      prefill_date: params.prefill_date,
    });
  }, [
    initializeFromPrefill,
    params.prefill_title,
    params.prefill_desc,
    params.prefill_date,
  ]);

  const goBack = () => {
    router.replace("/create/event-type");
  };

  const goForward = () => {
    router.replace("/create/event-details");
  };

  return (
    <SafeAreaView style={styles.wrapper} edges={["top", "left", "right"]}>
      <StatusBar barStyle="dark-content" />
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.topBar}>
        <TouchableOpacity onPress={goBack} style={styles.navIconBtn}>
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
              {t("create_when_title")}
            </StyledText>

            <TouchableOpacity
              style={[
                styles.modeCard,
                form.whenMode === "options" && styles.modeCardSelected,
              ]}
              onPress={() => updateForm("whenMode", "options")}
            >
              <StyledText style={styles.modeTitle}>
                {t("create_few_options")}
              </StyledText>
              <StyledText style={styles.modeSub}>
                {t("create_few_options_subtitle")}
              </StyledText>
            </TouchableOpacity>

            {form.whenMode === "options" && (
              <View style={styles.dateOptionsWrap}>
                <DateOptionPicker
                  value={form.pollOptions}
                  onChange={(dates) => updateForm("pollOptions", dates)}
                />
              </View>
            )}

            <TouchableOpacity
              style={[
                styles.modeCard,
                form.whenMode === "unsure" && styles.modeCardSelected,
              ]}
              onPress={() => updateForm("whenMode", "unsure")}
            >
              <StyledText style={styles.modeTitle}>
                {t("create_not_sure")}
              </StyledText>
              <StyledText style={styles.modeSub}>
                {t("create_not_sure_subtitle")}
              </StyledText>
            </TouchableOpacity>

            <View style={styles.nav}>
              <TouchableOpacity style={styles.btn} onPress={goBack}>
                <Ionicons name="arrow-back" size={28} color="#fff" />
              </TouchableOpacity>

              <TouchableOpacity style={styles.btn} onPress={goForward}>
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

  modeCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 12,
  },

  modeCardSelected: {
    borderWidth: 2,
    borderColor: COLORS.primary,
    backgroundColor: "#fbfcfa",
  },

  modeTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: COLORS.text,
    marginBottom: 4,
  },

  modeSub: {
    fontSize: 14,
    lineHeight: 20,
    color: COLORS.textMuted,
  },

  dateOptionsWrap: {
    marginTop: 8,
  },

  nav: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 20,
  },

  btn: {
    backgroundColor: COLORS.primary,
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: "center",
    alignItems: "center",
  },
});
