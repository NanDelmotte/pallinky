/**
 * Path: app/m/[token]/edit.tsx
 * Description: Edit page
 * This mutates the original event.
 */

import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker, {
  DateTimePickerAndroid,
  DateTimePickerEvent,
} from "@react-native-community/datetimepicker";

import { getLocalTimeZone, supabase } from "@pallinky/core";
import { StyledInput, StyledText } from "@pallinky/ui";
import { useI18n } from "@pallinky/i18n/client";
import type { TranslationKey } from "@pallinky/i18n";

import DateOptionPicker from "../../../components/DateOptionPicker";
import LocationSearch from "../../../components/LocationSearch";

type ReminderDays = 1 | 2 | 3 | 5 | 7;
type WhenMode = "specific" | "options" | "unsure";

type FormState = {
  title: string;
  whenMode: WhenMode;
  specificDate: Date;
  pollOptions: Date[];
  durationMins: number | null;
  description: string;
  location: string;
  host_name: string;
  host_email: string;
  visible_in_feed: boolean;
  requires_approval: boolean;
  send_rsvp_reminders: boolean;
  remind_after_days: ReminderDays;
  rsvp_deadline: string | null;
  send_final_reminder_at_deadline: boolean;
};

const COLORS = {
  background: "#F6F7F9",
  surface: "#FFFFFF",
  text: "#1f2a1b",
  textMuted: "#66715f",
  primary: "#43691b",
  border: "#bac9ad",
  borderSoft: "#e7ede2",
  secondary: "#6A4C93",
  secondaryBg: "#efe9f7",
  overlay: "rgba(31, 42, 27, 0.35)",
};

function visibilitySummary(
  visibleInFeed: boolean,
  requiresApproval: boolean,
  translate: (key: TranslationKey) => string,
) {
  if (visibleInFeed && requiresApproval) return translate("visibility_public_approval");
  if (visibleInFeed && !requiresApproval) return translate("visibility_public_open");
  if (!visibleInFeed && requiresApproval) return translate("visibility_link_approval");
  return translate("visibility_link_open");
}

function stripLocationFromDescription(value: string) {
  return value.replace(/\n{0,2}Location: [\s\S]*$/i, "").trim();
}

function parseBool(value: unknown) {
  return value === true || value === "true";
}

function parseJsonArray(value: unknown) {
  if (!value || typeof value !== "string") return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export default function EditCreateScreen() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const token = typeof params.token === "string" ? params.token : "";
  const { t, language } = useI18n();
  const dateLocale = language === "fr" ? "fr-FR" : language === "nl" ? "nl-NL" : "en-GB";

  const titleParam = typeof params.title === "string" ? params.title : "";
  const descriptionParam =
    typeof params.description === "string"
      ? stripLocationFromDescription(params.description)
      : "";
  const locationParam =
    typeof params.location === "string" ? params.location : "";
  const hostNameParam =
    typeof params.host_name === "string" ? params.host_name : "";
  const hostEmailParam =
    typeof params.host_email === "string" ? params.host_email : "";
  const eventTypeParam =
    typeof params.event_type === "string" ? params.event_type : "";
  const startsAtParam =
    typeof params.starts_at === "string" ? params.starts_at : "";
  const endsAtParam = typeof params.ends_at === "string" ? params.ends_at : "";
  const proposedDatesParam =
    typeof params.proposed_dates === "string" ? params.proposed_dates : "";
  const visibleInFeedParam =
    typeof params.visible_in_feed === "string"
      ? params.visible_in_feed
      : "true";
  const requiresApprovalParam =
    typeof params.requires_approval === "string"
      ? params.requires_approval
      : "false";
  const sendRsvpRemindersParam =
    typeof params.send_rsvp_reminders === "string"
      ? params.send_rsvp_reminders
      : "false";
  const remindAfterDaysParam =
    typeof params.remind_after_days === "string"
      ? params.remind_after_days
      : "3";
  const rsvpDeadlineParam =
    typeof params.rsvp_deadline === "string" ? params.rsvp_deadline : "";
  const sendFinalReminderAtDeadlineParam =
    typeof params.send_final_reminder_at_deadline === "string"
      ? params.send_final_reminder_at_deadline
      : "false";
  const initialStartsAt = startsAtParam ? new Date(startsAtParam) : new Date();
  const initialPollOptions = parseJsonArray(proposedDatesParam)
    .map((value) => new Date(value))
    .filter((d) => !Number.isNaN(d.getTime()));

  const initialWhenMode: WhenMode =
    eventTypeParam === "formal"
      ? "specific"
      : initialPollOptions.length > 0
        ? "options"
        : "unsure";

  const initialEndsAt = endsAtParam ? new Date(endsAtParam) : null;
  const initialDurationMins =
    initialEndsAt && !Number.isNaN(initialEndsAt.getTime())
      ? Math.max(
          0,
          Math.round(
            (initialEndsAt.getTime() - initialStartsAt.getTime()) / 60000,
          ),
        )
      : null;

  const [loading, setLoading] = useState(false);

  const [showPicker, setShowPicker] = useState(false);
  const [showCustomDuration, setShowCustomDuration] = useState(false);

  const [showVisibilityModal, setShowVisibilityModal] = useState(false);

  const [tempDate, setTempDate] = useState(initialStartsAt);
  const [customHrs, setCustomHrs] = useState(
    initialDurationMins ? String(Math.floor(initialDurationMins / 60)) : "1",
  );
  const [customMins, setCustomMins] = useState(
    initialDurationMins ? String(initialDurationMins % 60) : "0",
  );

  const [form, setForm] = useState<FormState>({
    title: titleParam,
    whenMode: initialWhenMode,
    specificDate: initialStartsAt,
    pollOptions: initialPollOptions,
    durationMins: initialDurationMins,
    description: descriptionParam,
    location: locationParam,
    host_name: hostNameParam,
    host_email: hostEmailParam,
    visible_in_feed: parseBool(visibleInFeedParam),
    requires_approval: parseBool(requiresApprovalParam),
    send_rsvp_reminders: parseBool(sendRsvpRemindersParam),
    remind_after_days: (Number(remindAfterDaysParam || 3) as ReminderDays) || 3,
    rsvp_deadline: rsvpDeadlineParam || null,
    send_final_reminder_at_deadline: parseBool(
      sendFinalReminderAtDeadlineParam,
    ),
  });

  useEffect(() => {
    async function loadUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user?.id || !user?.email) return;

      const cleanEmail = user.email.toLowerCase().trim();

      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .maybeSingle();

      setForm((prev) => ({
        ...prev,
        host_email: prev.host_email || cleanEmail,
        host_name:
          prev.host_name ||
          profile?.full_name ||
          user?.user_metadata?.full_name ||
          cleanEmail.split("@")[0],
      }));
    }

    void loadUser();
  }, []);

  const canSave = useMemo(() => {
    return (
      !!form.title.trim() && !!form.host_name.trim() && !!form.host_email.trim()
    );
  }, [form]);

  const updateForm = <K extends keyof FormState>(
    key: K,
    value: FormState[K],
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const onIOSChange = (_event: DateTimePickerEvent, selectedDate?: Date) => {
    if (selectedDate) setTempDate(selectedDate);
  };

  const confirmIOSDate = () => {
    updateForm("specificDate", tempDate);
    setShowPicker(false);
  };

  const showAndroidPicker = () => {
    DateTimePickerAndroid.open({
      value: form.specificDate,
      mode: "date",
      onChange: (event, date) => {
        if (event.type === "set" && date) {
          DateTimePickerAndroid.open({
            value: date,
            mode: "time",
            is24Hour: true,
            onChange: (timeEvent, timeDate) => {
              if (timeEvent.type === "set" && timeDate) {
                const merged = new Date(date);
                merged.setHours(
                  timeDate.getHours(),
                  timeDate.getMinutes(),
                  0,
                  0,
                );
                updateForm("specificDate", merged);
              }
            },
          });
        }
      },
    });
  };

  const setDuration = (hours: number, mins: number) => {
    const total = hours * 60 + mins;
    updateForm("durationMins", total > 0 ? total : null);
    setShowCustomDuration(false);
  };

  const openVisibilityConfig = () => {
    setShowVisibilityModal(true);
  };

  const saveVisibilityConfig = () => {
    setShowVisibilityModal(false);
  };

  const saveChanges = async () => {
    if (!token) {
      Alert.alert(t("manage_missing_token_title"), t("manage_missing_token_body"));
      return;
    }

    if (!form.title.trim()) {
      Alert.alert(t("manage_required"), t("manage_required_title_body"));
      return;
    }

    setLoading(true);

    try {
      const description = form.description.trim() || null;
      const location = form.location || null;

      const eventType = form.whenMode === "specific" ? "formal" : "vibe";

      const startsAt =
        form.whenMode === "specific" ? form.specificDate.toISOString() : null;

      const endsAt =
        form.whenMode === "specific" && form.durationMins
          ? new Date(
              form.specificDate.getTime() + form.durationMins * 60 * 1000,
            ).toISOString()
          : null;

      const proposedDates =
        form.whenMode === "options"
          ? form.pollOptions.map((d) => d.toISOString())
          : [];

      const fullDescription = location
        ? `${description ?? ""}${description ? "\n\n" : ""}Location: ${location}`.trim()
        : description;

      const { error } = await supabase.rpc("update_event_by_manage_token", {
        p_manage_token: token,
        p_title: form.title.trim(),
        p_starts_at: startsAt,
        p_ends_at: endsAt,
        p_location: location,
        p_description: fullDescription || null,
        p_cover_image_url: null,
        p_expires_at: null,
        p_gif_key: null,
        p_event_type: eventType,
        p_proposed_dates: proposedDates,
        p_visibility: null,
        p_visible_in_feed: form.visible_in_feed,
        p_requires_approval: form.requires_approval,
        p_invite_list_visibility: "host_only",
        p_guest_list_visibility: "guests_can_see",
        p_send_rsvp_reminders: form.send_rsvp_reminders,
        p_remind_after_days: form.remind_after_days,
        p_rsvp_deadline: form.rsvp_deadline,
        p_send_final_reminder_at_deadline: form.send_final_reminder_at_deadline,
        p_forwarding_mode: null,
        p_event_time_zone: startsAt ? getLocalTimeZone() : null,
      });

      if (error) throw error;

      Alert.alert(t("manage_saved"), t("manage_event_updated"));
      router.replace(`/m/${token}` as any);
    } catch (e: any) {
      Alert.alert(t("manage_save_failed"), e?.message ?? t("manage_update_error"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.wrapper} edges={["top", "left", "right"]}>
      <StatusBar barStyle="dark-content" />
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.topBar}>
        <TouchableOpacity
          onPress={() => router.back()}
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
          <StyledText style={styles.stepTitle}>{t("manage_edit_event")}</StyledText>
          <StyledText style={styles.sectionHint}>
            {t("manage_update_hint")}
          </StyledText>

          <StyledText style={styles.label}>{t("manage_label_title")}</StyledText>
          <StyledInput
            placeholder={t("create_title_placeholder")}
            value={form.title}
            onChangeText={(t: string) => updateForm("title", t)}
            style={styles.inputStyle}
          />

          <StyledText style={styles.label}>{t("manage_label_when")}</StyledText>

          <View style={styles.whenToggleRow}>
            <TouchableOpacity
              style={[
                styles.whenToggleBtn,
                form.whenMode === "specific" && styles.whenToggleBtnSelected,
              ]}
              onPress={() => updateForm("whenMode", "specific")}
            >
              <StyledText
                style={[
                  styles.whenToggleText,
                  form.whenMode === "specific" && styles.whenToggleTextSelected,
                ]}
              >
                {t("manage_date")}
              </StyledText>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.whenToggleBtn,
                form.whenMode === "options" && styles.whenToggleBtnSelected,
              ]}
              onPress={() => updateForm("whenMode", "options")}
            >
              <StyledText
                style={[
                  styles.whenToggleText,
                  form.whenMode === "options" && styles.whenToggleTextSelected,
                ]}
              >
                {t("manage_poll")}
              </StyledText>
            </TouchableOpacity>
          </View>

          {form.whenMode === "specific" && (
            <>
              <StyledText style={styles.label}>{t("manage_label_start_time")}</StyledText>
              <TouchableOpacity
                style={styles.pwaInput}
                onPress={() =>
                  Platform.OS === "android"
                    ? showAndroidPicker()
                    : setShowPicker(true)
                }
              >
                <StyledText style={styles.pwaInputText}>
                  {form.specificDate.toLocaleString(dateLocale, {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </StyledText>
              </TouchableOpacity>

              <StyledText style={styles.label}>{t("manage_label_duration")}</StyledText>
              <TouchableOpacity
                style={styles.pwaInput}
                onPress={() => setShowCustomDuration(true)}
              >
                <StyledText
                  style={[
                    styles.pwaInputText,
                    !form.durationMins && styles.placeholderText,
                  ]}
                >
                  {form.durationMins
                    ? `${Math.floor(form.durationMins / 60)}h ${form.durationMins % 60}m`
                    : t("duration_no_end_time")}
                </StyledText>
                <Ionicons
                  name="chevron-down"
                  size={18}
                  color={COLORS.textMuted}
                />
              </TouchableOpacity>
            </>
          )}

          {form.whenMode === "options" && (
            <View style={styles.dateOptionsWrap}>
              <View style={styles.pollNeutralizer}>
                <DateOptionPicker
                  value={form.pollOptions}
                  onChange={(dates) => updateForm("pollOptions", dates)}
                />
              </View>
            </View>
          )}

          {showPicker && Platform.OS === "ios" && (
            <View style={styles.iosPickerContainer}>
              <View style={styles.iosPickerHeader}>
                <TouchableOpacity
                  onPress={() => setShowPicker(false)}
                  style={styles.iosHeaderBtn}
                >
                  <StyledText style={styles.iosCancelText}>{t("common_cancel")}</StyledText>
                </TouchableOpacity>

                <TouchableOpacity onPress={confirmIOSDate}>
                  <StyledText style={styles.iosConfirmText}>{t("common_confirm")}</StyledText>
                </TouchableOpacity>
              </View>

              <DateTimePicker
                value={tempDate}
                mode="datetime"
                display="inline"
                onChange={onIOSChange}
                accentColor={COLORS.primary}
                minuteInterval={15}
              />
            </View>
          )}

          <StyledText style={styles.label}>{t("manage_label_description")}</StyledText>
          <StyledInput
            placeholder={t("manage_note_placeholder")}
            value={form.description}
            onChangeText={(t: string) => updateForm("description", t)}
            multiline
            style={[styles.inputStyle, styles.detailsInput]}
          />

          <StyledText style={styles.sectionLabel}>{t("manage_label_where")}</StyledText>
          <View style={styles.locationWrap}>
            <LocationSearch
              value={form.location}
              onChange={(nextValue) => updateForm("location", nextValue)}
            />
          </View>

          <TouchableOpacity
            style={styles.pwaInput}
            onPress={openVisibilityConfig}
          >
            <View>
              <StyledText style={styles.label}>{t("manage_label_who_can_join")}</StyledText>
              <StyledText style={styles.pwaInputText}>
                {visibilitySummary(
                  form.visible_in_feed,
                  form.requires_approval,
                  t,
                )}
              </StyledText>
            </View>
            <Ionicons
              name="settings-outline"
              size={20}
              color={COLORS.textMuted}
            />
          </TouchableOpacity>

          <StyledText style={styles.sectionLabel}>
            {t("create_details_from")}
          </StyledText>

          <StyledInput
            placeholder={t("manage_name_placeholder")}
            value={form.host_name}
            onChangeText={(t: string) => updateForm("host_name", t)}
            style={styles.inputStyle}
          />

          <StyledInput
            placeholder={t("manage_email_placeholder")}
            value={form.host_email}
            onChangeText={(t: string) => updateForm("host_email", t)}
            keyboardType="email-address"
            autoCapitalize="none"
            style={styles.inputStyle}
          />

          <TouchableOpacity
            style={[styles.saveBtn, !canSave && styles.disabledBtn]}
            onPress={saveChanges}
            disabled={loading || !canSave}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <StyledText style={styles.saveBtnText}>{t("manage_save_changes")}</StyledText>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={showCustomDuration} transparent animationType="fade">
        <View style={styles.modalOverlayCenter}>
          <View style={styles.durationModalContent}>
            <StyledText style={styles.durationModalLabel}>
              {t("manage_label_duration")}
            </StyledText>

            <View style={styles.durationInputRow}>
              <View style={styles.inputGroup}>
                <TextInput
                  style={styles.modalInput}
                  keyboardType="numeric"
                  value={customHrs}
                  onChangeText={(t: string) => setCustomHrs(t)}
                  maxLength={2}
                />
                <StyledText style={styles.inlineFieldLabel}>{t("manage_hours")}</StyledText>
              </View>

              <View style={styles.inputGroup}>
                <TextInput
                  style={styles.modalInput}
                  keyboardType="numeric"
                  value={customMins}
                  onChangeText={(t: string) => setCustomMins(t)}
                  maxLength={2}
                />
                <StyledText style={styles.inlineFieldLabel}>{t("manage_mins")}</StyledText>
              </View>
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity onPress={() => setShowCustomDuration(false)}>
                <StyledText style={styles.modalCancelText}>{t("common_cancel")}</StyledText>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() =>
                  setDuration(
                    parseInt(customHrs || "0", 10),
                    parseInt(customMins || "0", 10),
                  )
                }
              >
                <StyledText style={styles.modalSetText}>{t("common_set")}</StyledText>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showVisibilityModal} transparent animationType="slide">
        <View style={styles.modalOverlayBottom}>
          <View style={styles.modalCard}>
            <ScrollView keyboardShouldPersistTaps="handled">
              <View style={styles.compactSection}>
                <StyledText style={styles.compactHeading}>
                  {t("create_details_social_visibility")}
                </StyledText>

                <TouchableOpacity
                  style={styles.checkboxRow}
                  onPress={() =>
                    updateForm("visible_in_feed", !form.visible_in_feed)
                  }
                >
                  <Ionicons
                    name={
                      form.visible_in_feed
                        ? "checkbox-outline"
                        : "square-outline"
                    }
                    size={22}
                    color={COLORS.primary}
                  />
                  <StyledText style={styles.radioRowText}>
                    {t("create_details_people_can_see")}
                  </StyledText>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.checkboxRow}
                  onPress={() =>
                    updateForm("requires_approval", !form.requires_approval)
                  }
                >
                  <Ionicons
                    name={
                      form.requires_approval
                        ? "checkbox-outline"
                        : "square-outline"
                    }
                    size={22}
                    color={COLORS.primary}
                  />
                  <StyledText style={styles.radioRowText}>
                    {t("create_details_approve_attendees")}
                  </StyledText>
                </TouchableOpacity>
              </View>

              <View style={styles.modalActionsBottom}>
                <TouchableOpacity
                  style={styles.modalSecondaryBtn}
                  onPress={() => {
                    setShowVisibilityModal(false);
                  }}
                >
                  <StyledText style={styles.modalSecondaryText}>
                    {t("common_cancel")}
                  </StyledText>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.modalPrimaryBtn}
                  onPress={saveVisibilityConfig}
                >
                  <StyledText style={styles.modalPrimaryText}>{t("common_save")}</StyledText>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
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
    marginBottom: 10,
  },

  sectionLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.text,
    marginBottom: 12,
  },

  sectionHint: {
    fontSize: 15,
    color: COLORS.textMuted,
    lineHeight: 22,
    marginBottom: 18,
  },

  label: {
    fontSize: 12,
    fontWeight: "800",
    color: COLORS.textMuted,
    marginTop: 20,
    marginBottom: 8,
    letterSpacing: 1,
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

  detailsInput: {
    height: 120,
  },

  pwaInput: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 8,
  },

  pwaInputText: {
    fontSize: 18,
    color: COLORS.text,
    fontWeight: "600",
  },

  placeholderText: {
    color: COLORS.textMuted,
  },

  whenToggleRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 8,
  },

  whenToggleBtn: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },

  whenToggleBtnSelected: {
    borderWidth: 2,
    borderColor: COLORS.primary,
    backgroundColor: "#fbfcfa",
  },

  whenToggleText: {
    fontSize: 16,
    fontWeight: "800",
    color: COLORS.textMuted,
    letterSpacing: 0.8,
  },

  whenToggleTextSelected: {
    color: COLORS.text,
  },

  dateOptionsWrap: {
    marginTop: 8,
  },

  pollNeutralizer: {
    borderRadius: 18,
  },

  locationWrap: {
    marginBottom: 18,
  },

  saveBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 18,
    minHeight: 56,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 28,
  },

  saveBtnText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "800",
  },

  disabledBtn: {
    opacity: 0.45,
  },

  iosPickerContainer: {
    backgroundColor: COLORS.surface,
    borderRadius: 15,
    padding: 10,
    marginBottom: 20,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  iosPickerHeader: {
    flexDirection: "row",
    justifyContent: "flex-end",
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderSoft,
  },

  iosHeaderBtn: {
    marginRight: 20,
  },

  iosCancelText: {
    color: COLORS.textMuted,
    fontWeight: "600",
  },

  iosConfirmText: {
    color: COLORS.primary,
    fontWeight: "800",
  },

  durationModalContent: {
    backgroundColor: COLORS.surface,
    padding: 25,
    borderRadius: 20,
    width: "80%",
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  durationModalLabel: {
    fontSize: 12,
    fontWeight: "800",
    color: COLORS.textMuted,
    letterSpacing: 1,
  },

  durationInputRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginVertical: 20,
  },

  inputGroup: {
    alignItems: "center",
  },

  inlineFieldLabel: {
    color: COLORS.text,
  },

  modalInput: {
    borderBottomWidth: 2,
    borderBottomColor: COLORS.primary,
    fontSize: 32,
    textAlign: "center",
    width: 60,
    marginBottom: 5,
    color: COLORS.text,
  },

  modalButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 20,
  },

  modalCancelText: {
    color: COLORS.textMuted,
  },

  modalSetText: {
    color: COLORS.primary,
    fontWeight: "800",
  },

  modalOverlayCenter: {
    flex: 1,
    backgroundColor: COLORS.overlay,
    justifyContent: "center",
    alignItems: "center",
  },

  modalOverlayBottom: {
    flex: 1,
    backgroundColor: COLORS.overlay,
    justifyContent: "flex-end",
  },

  modalCard: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: "88%",
    borderTopWidth: 1,
    borderColor: COLORS.border,
  },

  compactSection: {
    marginBottom: 22,
  },

  compactHeading: {
    fontSize: 16,
    fontWeight: "800",
    color: COLORS.text,
    marginBottom: 4,
  },

  radioRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
  },

  radioRowText: {
    flex: 1,
    fontSize: 16,
    color: COLORS.text,
    marginLeft: 10,
  },

  checkboxRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
  },

  reminderInlineRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    marginBottom: 12,
    gap: 10,
  },

  checkboxInline: {
    flexDirection: "row",
    alignItems: "center",
  },

  checkboxInlineText: {
    fontSize: 16,
    color: COLORS.text,
    marginLeft: 10,
  },

  reminderDropdown: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },

  reminderDropdownText: {
    fontSize: 15,
    color: COLORS.text,
    fontWeight: "600",
    marginRight: 6,
  },

  reminderDropdownMenu: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    marginBottom: 12,
    overflow: "hidden",
  },

  reminderDropdownItem: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderSoft,
  },

  reminderDropdownItemText: {
    fontSize: 15,
    color: COLORS.text,
  },

  inlineLabel: {
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.text,
    marginTop: 8,
    marginBottom: 8,
  },

  deadlineField: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  deadlineFieldText: {
    fontSize: 16,
    color: COLORS.text,
  },

  clearDeadlineBtn: {
    alignSelf: "flex-start",
    marginBottom: 12,
  },

  clearDeadlineText: {
    color: COLORS.primary,
    fontWeight: "700",
  },

  modalActionsBottom: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 12,
    marginBottom: 6,
  },

  modalSecondaryBtn: {
    paddingVertical: 14,
    paddingHorizontal: 18,
  },

  modalSecondaryText: {
    color: COLORS.textMuted,
    fontWeight: "700",
  },

  modalPrimaryBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 999,
    paddingVertical: 14,
    paddingHorizontal: 22,
  },

  modalPrimaryText: {
    color: "#fff",
    fontWeight: "800",
  },

  iosDeadlinePickerWrap: {
    marginTop: 14,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderSoft,
    paddingTop: 12,
  },

  iosDeadlinePickerHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
});
