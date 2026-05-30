/**
 * Path: apps/mobile/app/create/event-details.tsx
 * Description: Final details + submit step for the formal create flow.
 * Simplified social visibility model:
 * - visible_in_feed
 * - requires_approval
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import DateTimePicker, {
  DateTimePickerAndroid,
  DateTimePickerEvent,
} from '@react-native-community/datetimepicker';

import { createVibeDraft, getLocalTimeZone, supabase } from '@pallinky/core';
import { StyledInput, StyledText } from '@pallinky/ui';
import { useI18n } from '@pallinky/i18n/client';
import type { TranslationKey } from '@pallinky/i18n';

import LocationSearch from '../../components/LocationSearch';
import { isValidExternalUrl, normalizeExternalUrl } from '../../lib/externalUrl';

import {
  ReminderDays,
  useFormalDraft,
} from '../../lib/formalDraft';

const COLORS = {
  background: '#F6F7F9',
  surface: '#FFFFFF',
  text: '#1f2a1b',
  textMuted: '#66715f',
  primary: '#43691b',
  border: '#bac9ad',
  borderSoft: '#e7ede2',
  overlay: 'rgba(31, 42, 27, 0.35)',
};

const REMINDER_OPTIONS: ReminderDays[] = [1, 2, 3, 5, 7];

function toDateOnly(value: Date) {
  return value.toISOString().slice(0, 10);
}

function formatDeadlineLabel(
  value: string | null,
  translate: (key: TranslationKey) => string,
  locale: string
) {
  if (!value) return translate('create_deadline_select_date');

  const date = new Date(`${value}T12:00:00`);
  return date.toLocaleDateString(locale, { month: 'short', day: 'numeric', year: 'numeric' });
}

function visibilitySummary(
  visibleInFeed: boolean,
  requiresApproval: boolean,
  translate: (key: TranslationKey) => string
) {
  if (visibleInFeed && requiresApproval) return translate('visibility_public_approval');
  if (visibleInFeed && !requiresApproval) return translate('visibility_public_open');
  if (!visibleInFeed && requiresApproval) return translate('visibility_link_approval');
  return translate('visibility_link_open');
}

function makeSeriesId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const rand = Math.floor(Math.random() * 16);
    const value = char === 'x' ? rand : (rand & 0x3) | 0x8;
    return value.toString(16);
  });
}

export default function FormalDetailsScreen() {
  const params = useLocalSearchParams<{
    prefill_title?: string;
    prefill_desc?: string;
    prefill_date?: string;
  }>();

  const { form, updateForm, initializeFromPrefill } =
    useFormalDraft();
  const { t, language } = useI18n();
  const dateLocale = language === 'fr' ? 'fr-FR' : language === 'nl' ? 'nl-NL' : 'en-US';

  const [loading, setLoading] = useState(false);
  const submitLockRef = useRef(false);

  const [showDeadlinePicker, setShowDeadlinePicker] = useState(false);

  const [tempDeadlineDate, setTempDeadlineDate] = useState<Date>(
    new Date()
  );

  const [showReminderDropdown, setShowReminderDropdown] =
    useState(false);

  const inviteSettingTitle =
    form.invite_option === 'direct'
      ? t('invite_options_direct_title')
      : form.invite_option === 'friends_of_friends'
      ? t('invite_options_friends_title')
      : t('invite_options_circle_title');

  const inviteSettingBadge =
    form.invite_option === 'direct'
      ? t('invite_options_direct_badge')
      : form.invite_option === 'friends_of_friends'
      ? t('invite_options_friends_badge')
      : t('invite_options_circle_badge');

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

  useEffect(() => {
    async function loadUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user?.id || !user?.email) return;

      const cleanEmail = user.email.toLowerCase().trim();

      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .maybeSingle();

      updateForm('host_email', cleanEmail);

      updateForm(
        'host_name',
        profile?.full_name ||
          user?.user_metadata?.full_name ||
          cleanEmail.split('@')[0]
      );
    }

    void loadUser();
  }, [updateForm]);

  const goBack = () => {
    router.push('/create/invite-options');
  };

  const canSave =
    !!form.title.trim() &&
    !!form.host_name.trim() &&
    !!form.host_email.trim();

  const onIOSDeadlineChange = (
    _event: DateTimePickerEvent,
    selectedDate?: Date
  ) => {
    if (selectedDate) {
      setTempDeadlineDate(selectedDate);
    }
  };

  const confirmIOSDeadline = () => {
    updateForm(
      'rsvp_deadline',
      toDateOnly(tempDeadlineDate)
    );

    setShowDeadlinePicker(false);
  };

  const openAndroidDeadlinePicker = () => {
    DateTimePickerAndroid.open({
      value: form.rsvp_deadline
        ? new Date(
            `${form.rsvp_deadline}T12:00:00`
          )
        : new Date(),

      mode: 'date',

      onChange: (event, date) => {
        if (event.type === 'set' && date) {
          updateForm(
            'rsvp_deadline',
            toDateOnly(date)
          );
        }
      },
    });
  };

  const handleSavePress = () => {
    if (
      submitLockRef.current ||
      loading ||
      !canSave
    ) {
      return;
    }

    submitLockRef.current = true;
    void saveUnified();
  };

  const saveUnified = async () => {
    setLoading(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const effectiveEmail = (
        user?.email ||
        form.host_email ||
        ''
      )
        .toLowerCase()
        .trim();

      const effectiveHostName =
        form.host_name.trim() ||
        effectiveEmail.split('@')[0];

      if (!effectiveEmail) {
        Alert.alert(
          t('create_details_identity_error'),
          t('create_details_identity_email_required')
        );

        return;
      }

      if (!form.title.trim()) {
        Alert.alert(
          t('manage_required'),
          t('manage_required_title_body')
        );

        return;
      }

      const description =
        form.description.trim() || null;

      if (!isValidExternalUrl(form.external_url)) {
        Alert.alert(
          t('external_link_invalid_title'),
          t('external_link_invalid_body')
        );

        return;
      }

      const externalUrl = normalizeExternalUrl(form.external_url);

      const location = form.location || null;

      if (
        form.whenMode === 'specific' ||
        form.whenMode === 'series' ||
        (
          form.whenMode === 'options' &&
          form.pollOptions.length === 1
        )
      ) {
        const fullDescription = location
          ? `${description ?? ''}${
              description ? '\n\n' : ''
            }Location: ${location}`.trim()
          : description;

        const rawDatesToCreate =
          form.whenMode === 'series'
            ? form.seriesDates
            : form.whenMode === 'options'
            ? form.pollOptions
            : [form.specificDate];

        const datesToCreate = rawDatesToCreate
          .filter(
            (
              value:
                | Date
                | null
                | undefined
            ) => value instanceof Date
          )
          .filter(
            (value: Date) =>
              !Number.isNaN(value.getTime())
          )
          .sort(
            (a: Date, b: Date) =>
              a.getTime() - b.getTime()
          );

        if (datesToCreate.length === 0) {
          Alert.alert(
            t('create_details_missing_date'),
            form.whenMode === 'series'
              ? t('create_details_missing_series_date')
              : t('create_details_missing_specific_date')
          );

          return;
        }

        const seriesId =
          form.whenMode === 'series' &&
          datesToCreate.length > 1
            ? makeSeriesId()
            : null;

        const createdRows: {
          id: string;
          slug: string;
          manage_handle: string;
        }[] = [];

        const endOffsetMs = form.endDate
          ? form.endDate.getTime() - form.specificDate.getTime()
          : null;

        if (endOffsetMs !== null && endOffsetMs < 0) {
          Alert.alert(
            t('create_when_end_before_start_title'),
            t('create_when_end_before_start_body')
          );

          return;
        }

        for (const startDate of datesToCreate) {
          const endsAt = endOffsetMs !== null
            ? new Date(startDate.getTime() + endOffsetMs).toISOString()
            : null;

          const payload = {
            p_title: form.title.trim(),
            p_host_name: effectiveHostName,
            p_host_email: effectiveEmail,
            p_keyword: 'event',
            p_starts_at: startDate.toISOString(),
            p_ends_at: endsAt,
            p_location: location,
            p_description:
              fullDescription || null,
            p_event_type: 'formal',
            p_event_time_zone: getLocalTimeZone(),
            p_external_url: externalUrl,
            p_visibility: form.visibility,
            p_invite_list_visibility:
              form.invite_list_visibility,
            p_guest_list_visibility:
              form.guest_list_visibility,
            p_forwarding_mode: form.forwarding_mode,

            p_visible_in_feed:
              form.visible_in_feed ?? true,

            p_requires_approval:
              form.requires_approval ?? false,

            p_expires_in_days: 14,

            p_send_rsvp_reminders:
              form.send_rsvp_reminders,

            p_remind_after_days:
              form.remind_after_days,

            p_rsvp_deadline:
              form.rsvp_deadline,

            p_send_final_reminder_at_deadline:
              form.send_final_reminder_at_deadline,
          };

          const { data, error } =
            await supabase.rpc(
              'create_event_draft',
              payload
            );

          if (error) throw error;

          const row = Array.isArray(data)
            ? data[0]
            : data;

          if (!row?.id) {
            throw new Error(
              t('create_details_created_without_id')
            );
          }

          if (seriesId) {
            const { error: seriesError } =
              await supabase
                .from('events')
                .update({
                  series_id: seriesId,
                })
                .eq('id', row.id);

            if (seriesError) {
              throw seriesError;
            }
          }

          createdRows.push(row);
        }

        const firstRow = createdRows[0];

        if (
          !firstRow?.slug ||
          !firstRow?.manage_handle
        ) {
          throw new Error(
            t('create_details_success_open_error')
          );
        }

        router.push({
          pathname: '/create/success',

          params: {
            slug: firstRow.slug,
            manage_handle:
              firstRow.manage_handle,
            title: form.title,
            email: effectiveEmail,
            visibility: String(form.visibility),
            invite_option: form.invite_option ?? '',
          },
        });

        return;
      }

      const isSingleOption =
        form.whenMode === 'options' &&
        form.pollOptions.length === 1;

      const isPoll =
        form.whenMode === 'options' &&
        form.pollOptions.length > 1;

      const isReachOut =
        form.whenMode === 'unsure' ||
        (
          form.whenMode === 'options' &&
          form.pollOptions.length === 0
        );

      const eventType = isSingleOption
        ? 'fixed_date'
        : isPoll
        ? 'poll'
        : isReachOut
        ? 'reach_out'
        : 'fixed_date';

      const proposedDates =
        form.whenMode === 'options' &&
        form.pollOptions.length > 1
          ? form.pollOptions.map((d) =>
              d.toISOString()
            )
          : [];

      const result = await createVibeDraft({
        title: form.title.trim(),
        description:
          description ?? undefined,
        location,
        hostName: effectiveHostName,
        hostEmail: effectiveEmail,

        keyword: `evt-${Math.random()
          .toString(36)
          .substring(2, 7)}`,

        gifKey: 'waves',

        eventType,
        proposedDates,

        visibleInFeed:
          form.visible_in_feed ?? true,

        requiresApproval:
          form.requires_approval ?? false,

        sendRsvpReminders:
          form.send_rsvp_reminders,

        remindAfterDays:
          form.remind_after_days,

        rsvpDeadline:
          form.rsvp_deadline,

        sendFinalReminderAtDeadline:
          form.send_final_reminder_at_deadline,

        forwardingMode:
          form.forwarding_mode,

        visibility:
          form.visibility,

        externalUrl,
      });

      router.push({
        pathname: '/create/success-vibe',

        params: {
          slug: result.slug,
          manage_handle:
            result.manage_handle,
          title: form.title,
          email: effectiveEmail,
          visibility: String(form.visibility),
          invite_option: form.invite_option ?? '',
        },
      });
    } catch (e: any) {
      Alert.alert(
        t('manage_save_failed'),
        e?.message ??
          t('create_details_save_error')
      );
    } finally {
      submitLockRef.current = false;
      setLoading(false);
    }
  };

  return (
    <SafeAreaView
      style={styles.wrapper}
      edges={['top', 'left', 'right']}
    >
      <StatusBar barStyle="dark-content" />

      <Stack.Screen
        options={{ headerShown: false }}
      />

      <View style={styles.topBar}>
        <TouchableOpacity
          onPress={goBack}
          style={styles.navIconBtn}
        >
          <Ionicons
            name="arrow-back"
            size={28}
            color={COLORS.primary}
          />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        behavior={
          Platform.OS === 'ios'
            ? 'padding'
            : 'height'
        }
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={
            styles.container
          }
          keyboardShouldPersistTaps="handled"
        >
          <View>
            <StyledText style={styles.stepTitle}>
              {t('create_details_title')}
            </StyledText>

            <View style={styles.detailSection}>
              <StyledText style={styles.sectionTitle}>Description</StyledText>
              <StyledText style={styles.sectionHint}>
                Add the context people need before they say yes.
              </StyledText>

              <StyledInput
                placeholder={t('manage_note_placeholder')}
                value={form.description}
                onChangeText={(t: string) =>
                  updateForm(
                    'description',
                    t
                  )
                }
                multiline
                style={[
                  styles.inputStyle,
                  styles.detailsInput,
                ]}
              />
            </View>

            <View style={styles.detailSection}>
              <StyledText style={styles.sectionTitle}>Place and links</StyledText>
              <StyledText style={styles.sectionHint}>
                Add where it happens and any useful link.
              </StyledText>

              <StyledText style={styles.fieldLabel}>{t('manage_label_where')}</StyledText>

              <View style={styles.locationWrap}>
                <LocationSearch
                  value={form.location}
                  onChange={(nextValue) =>
                    updateForm(
                      'location',
                      nextValue
                    )
                  }
                />
              </View>

              <StyledText style={styles.fieldLabel}>{t('external_link_label')}</StyledText>

              <StyledInput
                placeholder={t('external_link_placeholder')}
                value={form.external_url}
                onChangeText={(text: string) =>
                  updateForm(
                    'external_url',
                    text
                  )
                }
                keyboardType="url"
                autoCapitalize="none"
                autoCorrect={false}
                style={styles.inputStyle}
              />

            </View>

            <View style={styles.detailSection}>
              <StyledText style={styles.sectionTitle}>Invite settings</StyledText>
              <StyledText style={styles.sectionHint}>
                This follows the sharing choice you picked, with a few final controls.
              </StyledText>

              <View style={styles.summaryRow}>
                <View style={styles.summaryContent}>
                  <View style={styles.summaryHeader}>
                    <StyledText style={styles.summaryText}>
                      {inviteSettingTitle}
                    </StyledText>

                    <View style={styles.summaryBadge}>
                      <StyledText style={styles.summaryBadgeText}>
                        {inviteSettingBadge}
                      </StyledText>
                    </View>
                  </View>

                  <StyledText style={styles.summarySub}>
                    {visibilitySummary(
                      form.visible_in_feed ?? true,
                      form.requires_approval ?? false,
                      t
                    )}
                  </StyledText>
                </View>
              </View>

              <TouchableOpacity
                style={styles.checkboxRow}
                onPress={() =>
                  updateForm(
                    'visible_in_feed',
                    !(form.visible_in_feed ?? true)
                  )
                }
              >
                <Ionicons
                  name={
                    (form.visible_in_feed ?? true)
                      ? 'checkbox-outline'
                      : 'square-outline'
                  }
                  size={22}
                  color={COLORS.primary}
                />

                <StyledText style={styles.radioRowText}>
                  {t('create_details_people_can_see')}
                </StyledText>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.checkboxRow}
                onPress={() =>
                  updateForm(
                    'requires_approval',
                    !(form.requires_approval ?? false)
                  )
                }
              >
                <Ionicons
                  name={
                    (form.requires_approval ?? false)
                      ? 'checkbox-outline'
                      : 'square-outline'
                  }
                  size={22}
                  color={COLORS.primary}
                />

                <StyledText style={styles.radioRowText}>
                  {t('create_details_approve_attendees')}
                </StyledText>
              </TouchableOpacity>
            </View>

            <View style={styles.detailSection}>
              <StyledText style={styles.sectionTitle}>RSVP settings</StyledText>
              <StyledText style={styles.sectionHint}>
                Set reminders and an optional deadline before the invite goes out.
              </StyledText>

              <View style={styles.reminderInlineRow}>
                <TouchableOpacity
                  style={styles.checkboxInline}
                  onPress={() =>
                    updateForm(
                      'send_rsvp_reminders',
                      !form.send_rsvp_reminders
                    )
                  }
                >
                  <Ionicons
                    name={
                      form.send_rsvp_reminders
                        ? 'checkbox-outline'
                        : 'square-outline'
                    }
                    size={22}
                    color={COLORS.primary}
                  />

                  <StyledText style={styles.checkboxInlineText}>
                    Send reminders after
                  </StyledText>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.reminderDropdown}
                  onPress={() =>
                    setShowReminderDropdown((prev) => !prev)
                  }
                >
                  <StyledText style={styles.reminderDropdownText}>
                    {form.remind_after_days} day
                    {form.remind_after_days > 1 ? 's' : ''}
                  </StyledText>

                  <Ionicons
                    name={
                      showReminderDropdown
                        ? 'chevron-up'
                        : 'chevron-down'
                    }
                    size={16}
                    color={COLORS.textMuted}
                  />
                </TouchableOpacity>
              </View>

              {showReminderDropdown && (
                <View style={styles.reminderDropdownMenu}>
                  {REMINDER_OPTIONS.map((days) => (
                    <TouchableOpacity
                      key={days}
                      style={styles.reminderDropdownItem}
                      onPress={() => {
                        updateForm(
                          'remind_after_days',
                          days
                        );
                        setShowReminderDropdown(false);
                      }}
                    >
                      <StyledText
                        style={styles.reminderDropdownItemText}
                      >
                        {days} day{days > 1 ? 's' : ''}
                      </StyledText>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              <StyledText style={styles.fieldLabel}>RSVP deadline</StyledText>

              <TouchableOpacity
                style={styles.deadlineField}
                onPress={() => {
                  if (Platform.OS === 'android') {
                    openAndroidDeadlinePicker();
                  } else {
                    setTempDeadlineDate(
                      form.rsvp_deadline
                        ? new Date(
                            `${form.rsvp_deadline}T12:00:00`
                          )
                        : new Date()
                    );
                    setShowDeadlinePicker(true);
                  }
                }}
              >
                <StyledText style={styles.deadlineFieldText}>
                  {formatDeadlineLabel(
                    form.rsvp_deadline,
                    t,
                    dateLocale
                  )}
                </StyledText>

                <Ionicons
                  name="chevron-down"
                  size={18}
                  color={COLORS.textMuted}
                />
              </TouchableOpacity>

              {!!form.rsvp_deadline && (
                <TouchableOpacity
                  style={styles.clearDeadlineBtn}
                  onPress={() =>
                    updateForm(
                      'rsvp_deadline',
                      null
                    )
                  }
                >
                  <StyledText style={styles.clearDeadlineText}>
                    Clear date
                  </StyledText>
                </TouchableOpacity>
              )}

              {showDeadlinePicker && Platform.OS === 'ios' && (
                <View style={styles.iosDeadlinePickerWrap}>
                  <View style={styles.iosDeadlinePickerHeader}>
                    <TouchableOpacity
                      onPress={() =>
                        setShowDeadlinePicker(false)
                      }
                    >
                      <StyledText style={styles.iosCancelText}>
                        {t('common_cancel')}
                      </StyledText>
                    </TouchableOpacity>

                    <TouchableOpacity onPress={confirmIOSDeadline}>
                      <StyledText style={styles.iosConfirmText}>
                        {t('common_confirm')}
                      </StyledText>
                    </TouchableOpacity>
                  </View>

                  <DateTimePicker
                    value={tempDeadlineDate}
                    mode="date"
                    display="inline"
                    onChange={onIOSDeadlineChange}
                    accentColor={COLORS.primary}
                  />
                </View>
              )}

              <TouchableOpacity
                style={styles.checkboxRow}
                onPress={() =>
                  updateForm(
                    'send_final_reminder_at_deadline',
                    !form.send_final_reminder_at_deadline
                  )
                }
              >
                <Ionicons
                  name={
                    form.send_final_reminder_at_deadline
                      ? 'checkbox-outline'
                      : 'square-outline'
                  }
                  size={22}
                  color={COLORS.primary}
                />

                <StyledText style={styles.radioRowText}>
                  Send final reminder at the RSVP deadline
                </StyledText>
              </TouchableOpacity>
            </View>

            <View style={styles.detailSection}>
              <StyledText style={styles.sectionTitle}>
                {t('create_details_from')}
              </StyledText>
              <StyledText style={styles.sectionHint}>
                This is how guests will see the host.
              </StyledText>

              <StyledInput
                placeholder={t('manage_name_placeholder')}
                value={form.host_name}
                onChangeText={(t: string) =>
                  updateForm(
                    'host_name',
                    t
                  )
                }
                style={styles.inputStyle}
              />

              <StyledInput
                placeholder={t('manage_email_placeholder')}
                value={form.host_email}
                onChangeText={(t: string) =>
                  updateForm(
                    'host_email',
                    t
                  )
                }
                keyboardType="email-address"
                autoCapitalize="none"
                style={styles.inputStyle}
              />
            </View>

            <View style={styles.nav}>
              <TouchableOpacity
                style={styles.btn}
                onPress={goBack}
              >
                <Ionicons
                  name="arrow-back"
                  size={28}
                  color="#fff"
                />
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.btn,
                  styles.saveBtn,
                  (
                    !canSave ||
                    loading
                  ) &&
                    styles.disabledBtn,
                ]}
                onPress={
                  handleSavePress
                }
                disabled={
                  loading ||
                  !canSave ||
                  submitLockRef.current
                }
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Ionicons
                    name="checkmark"
                    size={30}
                    color="#fff"
                  />
                )}
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
    backgroundColor:
      COLORS.background,
  },

  topBar: {
    flexDirection: 'row',
    justifyContent:
      'flex-start',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 10,
  },

  navIconBtn: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },

  container: {
    padding: 25,
    paddingTop: 10,
    paddingBottom: 40,
  },

  stepTitle: {
    fontSize: 32,
    fontWeight: '900',
    color: COLORS.text,
    marginBottom: 20,
  },

  detailSection: {
    backgroundColor: COLORS.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.borderSoft,
    padding: 16,
    marginBottom: 14,
  },

  sectionTitle: {
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '900',
    color: COLORS.text,
    marginBottom: 4,
  },

  sectionHint: {
    fontSize: 13,
    lineHeight: 18,
    color: COLORS.textMuted,
    marginBottom: 14,
  },

  fieldLabel: {
    fontSize: 12,
    fontWeight: '900',
    color: COLORS.textMuted,
    marginBottom: 8,
    textTransform: 'uppercase',
  },

  inputStyle: {
    fontSize: 16,
    backgroundColor:
      COLORS.surface,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    color: COLORS.text,
  },

  detailsInput: {
    height: 120,
  },

  locationWrap: {
    marginBottom: 14,
  },

  summaryRow: {
    flexDirection: 'row',
    justifyContent:
      'space-between',
    alignItems: 'center',
    backgroundColor: '#f9faf7',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.borderSoft,
    marginBottom: 10,
  },

  summaryContent: {
    flex: 1,
  },

  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 4,
  },

  summaryText: {
    fontSize: 15,
    lineHeight: 20,
    color: COLORS.text,
    fontWeight: '800',
  },

  summarySub: {
    fontSize: 13,
    lineHeight: 18,
    color: COLORS.textMuted,
  },

  summaryBadge: {
    backgroundColor: '#EEF4E9',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },

  summaryBadgeText: {
    fontSize: 12,
    fontWeight: '900',
    color: COLORS.primary,
  },

  nav: {
    flexDirection: 'row',
    justifyContent:
      'space-between',
    marginTop: 20,
  },

  btn: {
    backgroundColor:
      COLORS.primary,
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },

  saveBtn: {
    backgroundColor:
      COLORS.primary,
  },

  disabledBtn: {
    opacity: 0.45,
  },

  radioRowText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 20,
    color: COLORS.text,
    marginLeft: 10,
  },

  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },

  reminderInlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginTop: 8,
    marginBottom: 12,
    gap: 10,
  },

  checkboxInline: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  checkboxInlineText: {
    fontSize: 15,
    lineHeight: 20,
    color: COLORS.text,
    marginLeft: 10,
  },

  reminderDropdown: {
    flexDirection: 'row',
    alignItems: 'center',
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
    fontWeight: '600',
    marginRight: 6,
  },

  reminderDropdownMenu: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    marginBottom: 12,
    overflow: 'hidden',
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

  deadlineField: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  deadlineFieldText: {
    fontSize: 16,
    color: COLORS.text,
  },

  clearDeadlineBtn: {
    alignSelf: 'flex-start',
    marginBottom: 12,
  },

  clearDeadlineText: {
    color: COLORS.primary,
    fontWeight: '700',
  },

  iosDeadlinePickerWrap: {
    marginTop: 14,
    borderTopWidth: 1,
    borderTopColor:
      COLORS.borderSoft,
    paddingTop: 12,
  },

  iosDeadlinePickerHeader: {
    flexDirection: 'row',
    justifyContent:
      'space-between',
    marginBottom: 8,
  },

  iosCancelText: {
    color: COLORS.textMuted,
    fontWeight: '600',
  },

  iosConfirmText: {
    color: COLORS.primary,
    fontWeight: '800',
  },
});
