/**
 * Path: apps/mobile/app/create/event-type.tsx
 * Description: When step.
 * Specific = overlay modal
 * Options = overlay modal
 * Not sure yet = straight to details
 * Series = hidden behind "Repeat this event" inside Specific modal
 */

import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, {
  DateTimePickerAndroid,
  DateTimePickerEvent,
} from '@react-native-community/datetimepicker';

import { StyledText } from '@pallinky/ui';
import { useI18n } from '@pallinky/i18n/client';
import { getLocalTimeZone } from '@pallinky/core';
import { useFormalDraft } from '../../lib/formalDraft';

const COLORS = {
  background: '#F6F7F9',
  surface: '#FFFFFF',
  text: '#1f2a1b',
  textMuted: '#66715f',
  primary: '#43691b',
  border: '#bac9ad',
  borderSoft: '#e7ede2',
  danger: '#e63946',
  overlay: 'rgba(31, 42, 27, 0.35)',
};

export default function FormalWhenScreen() {
  const { form, updateForm, setForm } = useFormalDraft();
  const { t, language } = useI18n();
  const localTimeZone = getLocalTimeZone();
  const dateLocale = language === 'fr' ? 'fr-FR' : language === 'nl' ? 'nl-NL' : 'en-GB';

  const [showSpecificModal, setShowSpecificModal] = useState(false);
  const [showSeriesModal, setShowSeriesModal] = useState(false);
  const [showOptionsModal, setShowOptionsModal] = useState(false);

  const [showPicker, setShowPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  const [tempDate, setTempDate] = useState(form.specificDate || new Date());
  const [tempEndDate, setTempEndDate] = useState(form.endDate || new Date((form.specificDate || new Date()).getTime() + 60 * 60 * 1000));

  const sameMinute = (a: Date, b: Date) => a.getTime() === b.getTime();

  const mergeDatePart = (current: Date, selectedDate: Date) => {
    const nextDate = new Date(current);
    nextDate.setFullYear(
      selectedDate.getFullYear(),
      selectedDate.getMonth(),
      selectedDate.getDate()
    );
    return nextDate;
  };

  const mergeTimePart = (current: Date, selectedDate: Date) => {
    const nextDate = new Date(current);
    nextDate.setHours(selectedDate.getHours(), selectedDate.getMinutes(), 0, 0);
    return nextDate;
  };

  const openSpecific = () => {
    updateForm('creation_mode', 'event');
    updateForm('whenMode', 'specific');
    setTempDate(form.specificDate || new Date());
    setShowPicker(false);
    setShowEndPicker(false);
    setShowSpecificModal(true);
  };

  const openSeriesFromSpecific = () => {
    const seedDate = form.specificDate || tempDate || new Date();

    setForm((prev) => {
      const existingSeriesDates = prev.seriesDates || [];
      const hasSeed = existingSeriesDates.some((d) => sameMinute(d, seedDate));

      return {
        ...prev,
        whenMode: 'series',
        specificDate: seedDate,
        seriesDates: hasSeed
          ? existingSeriesDates
          : [...existingSeriesDates, seedDate].sort(
              (a, b) => a.getTime() - b.getTime()
            ),
      };
    });

    setTempDate(seedDate);
    setShowPicker(false);
    setShowEndPicker(false);
    setShowSpecificModal(false);
    setShowSeriesModal(true);
  };

  const openOptions = () => {
    updateForm('creation_mode', 'event');
    updateForm('whenMode', 'options');
    setShowPicker(false);
    setShowEndPicker(false);
    setShowOptionsModal(true);
  };

  const closeSpecific = () => {
    setShowSpecificModal(false);
    setShowPicker(false);
    setShowEndPicker(false);
  };

  const closeSeries = () => {
    setShowSeriesModal(false);
    setShowPicker(false);
    setShowEndPicker(false);
  };

  const closeOptions = () => {
    setShowOptionsModal(false);
    setShowPicker(false);
  };

  const onIOSChange = (_event: DateTimePickerEvent, selectedDate?: Date) => {
    if (selectedDate) {
      setTempDate((current) => mergeDatePart(current, selectedDate));
    }
  };

  const onIOSTimeChange = (_event: DateTimePickerEvent, selectedDate?: Date) => {
    if (selectedDate) {
      setTempDate((current) => mergeTimePart(current, selectedDate));
    }
  };

  const confirmIOSDate = () => {
    if (form.whenMode === 'series') {
      setForm((prev) => {
        if (prev.seriesDates.some((d) => sameMinute(d, tempDate))) return prev;

        return {
          ...prev,
          seriesDates: [...prev.seriesDates, tempDate].sort(
            (a, b) => a.getTime() - b.getTime()
          ),
        };
      });
    } else {
      updateForm('specificDate', tempDate);
    }

    setShowPicker(false);
  };

  const openIOSPicker = (seedDate?: Date) => {
    setTempDate(seedDate ?? new Date());
    setShowPicker(true);
  };

  const showAndroidPicker = () => {
    const baseDate =
      form.whenMode === 'series'
        ? new Date()
        : form.specificDate || new Date();

    DateTimePickerAndroid.open({
      value: baseDate,
      mode: 'date',
      onChange: (event, date) => {
        if (event.type === 'set' && date) {
          DateTimePickerAndroid.open({
            value: date,
            mode: 'time',
            is24Hour: true,
            onChange: (timeEvent, timeDate) => {
              if (timeEvent.type === 'set' && timeDate) {
                const merged = new Date(date);
                merged.setHours(timeDate.getHours(), timeDate.getMinutes(), 0, 0);

                if (form.whenMode === 'series') {
                  setForm((prev) => {
                    if (prev.seriesDates.some((d) => sameMinute(d, merged))) return prev;

                    return {
                      ...prev,
                      seriesDates: [...prev.seriesDates, merged].sort(
                        (a, b) => a.getTime() - b.getTime()
                      ),
                    };
                  });
                } else if (form.whenMode === 'options') {
                  setForm((prev) => {
                    if (prev.pollOptions.some((d) => sameMinute(d, merged))) return prev;

                    return {
                      ...prev,
                      pollOptions: [...prev.pollOptions, merged].sort(
                        (a, b) => a.getTime() - b.getTime()
                      ),
                    };
                  });

                  setTempDate(merged);
                } else {
                  updateForm('specificDate', merged);
                  setTempDate(merged);
                }
              }
            },
          });
        }
      },
    });
  };


  const getDefaultEndDate = (startDate = form.specificDate || tempDate || new Date()) =>
    form.endDate || new Date(startDate.getTime() + 60 * 60 * 1000);

  const onIOSEndChange = (_event: DateTimePickerEvent, selectedDate?: Date) => {
    if (selectedDate) {
      setTempEndDate((current) => mergeDatePart(current, selectedDate));
    }
  };

  const onIOSEndTimeChange = (_event: DateTimePickerEvent, selectedDate?: Date) => {
    if (selectedDate) {
      setTempEndDate((current) => mergeTimePart(current, selectedDate));
    }
  };

  const confirmIOSEndDate = () => {
    updateForm('endDate', tempEndDate);
    setShowEndPicker(false);
  };

  const openEndPicker = () => {
    setTempEndDate(getDefaultEndDate());
    setShowEndPicker(true);
  };

  const clearEndDate = () => {
    updateForm('endDate', null);
    setShowEndPicker(false);
  };

  const showAndroidEndPicker = () => {
    const baseDate = getDefaultEndDate();

    DateTimePickerAndroid.open({
      value: baseDate,
      mode: 'date',
      onChange: (event, date) => {
        if (event.type === 'set' && date) {
          DateTimePickerAndroid.open({
            value: baseDate,
            mode: 'time',
            is24Hour: true,
            onChange: (timeEvent, timeDate) => {
              if (timeEvent.type === 'set' && timeDate) {
                const merged = new Date(date);
                merged.setHours(timeDate.getHours(), timeDate.getMinutes(), 0, 0);
                updateForm('endDate', merged);
              }
            },
          });
        }
      },
    });
  };

  const validateEndDate = (startDate: Date) => {
    if (!form.endDate || form.endDate.getTime() >= startDate.getTime()) return true;

    Alert.alert(
      t('create_when_end_before_start_title'),
      t('create_when_end_before_start_body')
    );
    return false;
  };

  const removeSeriesDate = (date: Date) => {
    setForm((prev) => ({
      ...prev,
      seriesDates: prev.seriesDates.filter((d) => !sameMinute(d, date)),
    }));
  };

  const continueSpecific = () => {
    if (!validateEndDate(tempDate)) return;

    updateForm('whenMode', 'specific');
    updateForm('specificDate', tempDate);
    setShowSpecificModal(false);
    setShowPicker(false);
    setShowEndPicker(false);
    router.replace('/create/invite-options');
  };

  const continueSeries = () => {
    updateForm('whenMode', 'series');
    setShowSeriesModal(false);
    setShowPicker(false);
    setShowEndPicker(false);
    router.replace('/create/invite-options');
  };

  const continueOptions = () => {
    updateForm('whenMode', 'options');
    setShowOptionsModal(false);
    router.replace('/create/invite-options');
  };

  const whenCards = [
    {
      key: 'specific',
      emoji: '🗓️',
      badge: t('create_when_specific_badge'),
      title: t('create_when_specific_title'),
      subtitle: t('create_when_specific_subtitle'),
      example: t('create_when_specific_example'),
      onPress: openSpecific,
    },
    {
      key: 'options',
      emoji: '🗳️',
      badge: t('create_when_options_badge'),
      title: t('create_when_options_title'),
      subtitle: t('create_when_options_subtitle'),
      example: t('create_when_options_example'),
      onPress: openOptions,
    },
    {
      key: 'unsure',
      emoji: '🙋',
      badge: t('create_when_unsure_badge'),
      title: t('create_when_unsure_title'),
      subtitle: t('create_when_unsure_subtitle'),
      example: t('create_when_unsure_example'),
      onPress: () => {
        updateForm('creation_mode', 'planning_chat');
        updateForm('whenMode', 'unsure');
        router.replace('/create/invite-options');
      },
    },
  ] as const;

  return (
    <SafeAreaView style={styles.wrapper} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="dark-content" />
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.replace('/create/formal')} style={styles.navIconBtn}>
          <Ionicons name="arrow-back" size={28} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <View>
            <StyledText style={styles.stepTitle}>{t('create_when_title')}</StyledText>

            {whenCards.map((card) => {
              const selected = form.whenMode === card.key;

              return (
                <TouchableOpacity
                  key={card.key}
                  style={[
                    styles.modeCard,
                    selected && styles.modeCardSelected,
                  ]}
                  activeOpacity={0.9}
                  onPress={card.onPress}
                >
                  <View style={styles.modeCardTop}>
                    <StyledText style={styles.modeEmoji}>{card.emoji}</StyledText>

                    <View style={styles.modeBadge}>
                      <StyledText style={styles.modeBadgeText}>
                        {card.badge}
                      </StyledText>
                    </View>
                  </View>

                  <StyledText style={styles.modeTitle}>{card.title}</StyledText>

                  <StyledText style={styles.modeSub}>
                    {card.subtitle}
                  </StyledText>

                  <View style={styles.modeExample}>
                    <StyledText style={styles.modeExampleText}>
                      {card.example}
                    </StyledText>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal
        visible={showSpecificModal}
        transparent
        animationType="fade"
        presentationStyle="overFullScreen"
        onRequestClose={closeSpecific}
      >
        <View style={styles.modalOverlayCenter}>
          <View style={styles.overlayCard}>
            <View style={styles.topBar}>
              <TouchableOpacity onPress={closeSpecific} style={styles.navIconBtn}>
                <Ionicons name="close" size={28} color={COLORS.primary} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
              <StyledText style={styles.stepTitle}>{t('create_when_specific_title')}</StyledText>

              <StyledText style={styles.modeSub}>
                {t('create_when_specific_help')}
              </StyledText>
              <StyledText style={styles.timezoneNote}>
                {t('create_when_timezone_note', { timeZone: localTimeZone })}
              </StyledText>

              <StyledText style={styles.label}>{t('create_when_start_time')}</StyledText>

              <TouchableOpacity
                style={styles.pwaInput}
                onPress={() =>
                  Platform.OS === 'android'
                    ? showAndroidPicker()
                    : setShowPicker((prev) => !prev)
                }
              >
                <StyledText style={styles.pwaInputText}>
                  {tempDate.toLocaleString(dateLocale, {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })}
                </StyledText>

                <Ionicons
                  name={showPicker ? 'chevron-up' : 'chevron-down'}
                  size={18}
                  color={COLORS.textMuted}
                />
              </TouchableOpacity>

              {Platform.OS === 'ios' && showPicker && (
                <>
                  <View style={styles.iosDeadlinePickerHeader}>
                    <TouchableOpacity onPress={() => setShowPicker(false)}>
                      <StyledText style={styles.iosCancelText}>{t('common_cancel')}</StyledText>
                    </TouchableOpacity>

                    <TouchableOpacity onPress={confirmIOSDate}>
                      <StyledText style={styles.iosConfirmText}>{t('common_confirm')}</StyledText>
                    </TouchableOpacity>
                  </View>

                  <DateTimePicker
                    value={tempDate}
                    mode="date"
                    display="inline"
                    onChange={onIOSChange}
                    accentColor={COLORS.primary}
                    style={{ width: '100%' }}
                  />

                  <DateTimePicker
                    value={tempDate}
                    mode="time"
                    display="spinner"
                    onChange={onIOSTimeChange}
                    minuteInterval={15}
                    style={{ width: '100%' }}
                  />
                </>
              )}

              <StyledText style={styles.label}>{t('create_when_end_time')}</StyledText>

              <TouchableOpacity
                style={styles.pwaInput}
                onPress={() =>
                  Platform.OS === 'android'
                    ? showAndroidEndPicker()
                    : openEndPicker()
                }
              >
                <StyledText
                  style={[
                    styles.pwaInputText,
                    !form.endDate && styles.placeholderText,
                  ]}
                >
                  {form.endDate
                    ? form.endDate.toLocaleString(dateLocale, {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })
                    : t('end_time_none')}
                </StyledText>

                <Ionicons
                  name="time-outline"
                  size={18}
                  color={COLORS.textMuted}
                />
              </TouchableOpacity>

              {form.endDate && (
                <TouchableOpacity onPress={clearEndDate}>
                  <StyledText style={styles.clearEndText}>{t('create_when_clear_end_time')}</StyledText>
                </TouchableOpacity>
              )}

              {Platform.OS === 'ios' && showEndPicker && (
                <>
                  <View style={styles.iosDeadlinePickerHeader}>
                    <TouchableOpacity onPress={() => setShowEndPicker(false)}>
                      <StyledText style={styles.iosCancelText}>{t('common_cancel')}</StyledText>
                    </TouchableOpacity>

                    <TouchableOpacity onPress={confirmIOSEndDate}>
                      <StyledText style={styles.iosConfirmText}>{t('common_confirm')}</StyledText>
                    </TouchableOpacity>
                  </View>

                  <DateTimePicker
                    value={tempEndDate}
                    mode="date"
                    display="inline"
                    onChange={onIOSEndChange}
                    accentColor={COLORS.primary}
                    style={{ width: '100%' }}
                  />

                  <DateTimePicker
                    value={tempEndDate}
                    mode="time"
                    display="spinner"
                    onChange={onIOSEndTimeChange}
                    minuteInterval={15}
                    style={{ width: '100%' }}
                  />
                </>
              )}

              <TouchableOpacity style={styles.secondaryCard} onPress={openSeriesFromSpecific}>
                <View style={{ flex: 1 }}>
                  <StyledText style={styles.secondaryTitle}>{t('create_when_repeat_event')}</StyledText>
                  <StyledText style={styles.secondarySub}>
                    Create several sessions of the same event.
                  </StyledText>
                </View>

                <Ionicons name="repeat" size={22} color={COLORS.primary} />
              </TouchableOpacity>

              <TouchableOpacity onPress={continueSpecific}>
                <StyledText style={styles.doneText}>{t('common_done')}</StyledText>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showSeriesModal}
        transparent
        animationType="fade"
        presentationStyle="overFullScreen"
        onRequestClose={closeSeries}
      >
        <View style={styles.modalOverlayCenter}>
          <View style={styles.overlayCard}>
            <View style={styles.topBar}>
              <TouchableOpacity onPress={closeSeries} style={styles.navIconBtn}>
                <Ionicons name="close" size={28} color={COLORS.primary} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
              <StyledText style={styles.stepTitle}>{t('create_when_repeat_event')}</StyledText>

              <StyledText style={styles.modeSub}>
                Add each session of the same event.
              </StyledText>
              <StyledText style={styles.timezoneNote}>
                {t('create_when_timezone_note', { timeZone: localTimeZone })}
              </StyledText>

              {Platform.OS === 'ios' && showPicker && form.whenMode === 'series' && (
                <>
                  <View style={styles.iosDeadlinePickerHeader}>
                    <TouchableOpacity onPress={() => setShowPicker(false)}>
                      <StyledText style={styles.iosCancelText}>{t('common_cancel')}</StyledText>
                    </TouchableOpacity>

                    <TouchableOpacity onPress={confirmIOSDate}>
                      <StyledText style={styles.iosConfirmText}>{t('common_confirm')}</StyledText>
                    </TouchableOpacity>
                  </View>

                  <DateTimePicker
                    value={tempDate}
                    mode="date"
                    display="inline"
                    onChange={onIOSChange}
                    accentColor={COLORS.primary}
                    style={{ width: '100%' }}
                  />

                  <DateTimePicker
                    value={tempDate}
                    mode="time"
                    display="spinner"
                    onChange={onIOSTimeChange}
                    minuteInterval={15}
                    style={{ width: '100%' }}
                  />
                </>
              )}

              <StyledText style={styles.label}>{t('create_when_sessions')}</StyledText>

              {form.seriesDates.length > 0 ? (
                <View style={{ marginTop: 8 }}>
                  {form.seriesDates.map((date, index) => {
                    const key = date.toISOString();

                    return (
                      <View
                        key={key}
                        style={[
                          styles.pwaInput,
                          { marginBottom: 10, paddingVertical: 14 },
                        ]}
                      >
                        <View style={{ flex: 1 }}>
                          <StyledText style={styles.sessionLabel}>
                            Session {index + 1}
                          </StyledText>

                          <StyledText style={styles.sessionDate}>
                            {date.toLocaleString(dateLocale, {
                              weekday: 'short',
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </StyledText>

                          <StyledText style={styles.sessionTime}>
                            {date.toLocaleString(dateLocale, {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </StyledText>
                        </View>

                        <TouchableOpacity onPress={() => removeSeriesDate(date)}>
                          <Ionicons name="close-circle" size={22} color={COLORS.danger} />
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                </View>
              ) : (
                <StyledText style={{ color: COLORS.textMuted, marginTop: 8 }}>
                  No sessions yet
                </StyledText>
              )}

              
              <StyledText style={styles.label}>{t('create_when_end_time')}</StyledText>

              <TouchableOpacity
                style={styles.pwaInput}
                onPress={() =>
                  Platform.OS === 'android'
                    ? showAndroidEndPicker()
                    : openEndPicker()
                }
              >
                <StyledText
                  style={[
                    styles.pwaInputText,
                    !form.endDate && styles.placeholderText,
                  ]}
                >
                  {form.endDate
                    ? form.endDate.toLocaleString(dateLocale, {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })
                    : t('end_time_none')}
                </StyledText>

                <Ionicons
                  name="time-outline"
                  size={18}
                  color={COLORS.textMuted}
                />
              </TouchableOpacity>

              {form.endDate && (
                <TouchableOpacity onPress={clearEndDate}>
                  <StyledText style={styles.clearEndText}>{t('create_when_clear_end_time')}</StyledText>
                </TouchableOpacity>
              )}

              {Platform.OS === 'ios' && showEndPicker && (
                <>
                  <View style={styles.iosDeadlinePickerHeader}>
                    <TouchableOpacity onPress={() => setShowEndPicker(false)}>
                      <StyledText style={styles.iosCancelText}>{t('common_cancel')}</StyledText>
                    </TouchableOpacity>

                    <TouchableOpacity onPress={confirmIOSEndDate}>
                      <StyledText style={styles.iosConfirmText}>{t('common_confirm')}</StyledText>
                    </TouchableOpacity>
                  </View>

                  <DateTimePicker
                    value={tempEndDate}
                    mode="date"
                    display="inline"
                    onChange={onIOSEndChange}
                    accentColor={COLORS.primary}
                    style={{ width: '100%' }}
                  />

                  <DateTimePicker
                    value={tempEndDate}
                    mode="time"
                    display="spinner"
                    onChange={onIOSEndTimeChange}
                    minuteInterval={15}
                    style={{ width: '100%' }}
                  />
                </>
              )}
<TouchableOpacity
                style={[styles.pwaInput, { marginTop: 12 }]}
                onPress={() =>
                  Platform.OS === 'android'
                    ? showAndroidPicker()
                    : openIOSPicker(new Date())
                }
              >
                <StyledText style={styles.pwaInputText}>{t('create_when_add_session')}</StyledText>
                <Ionicons name="add" size={18} color={COLORS.textMuted} />
              </TouchableOpacity>

              <TouchableOpacity onPress={continueSeries}>
                <StyledText style={styles.doneText}>{t('common_done')}</StyledText>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showOptionsModal}
        transparent
        animationType="fade"
        presentationStyle="overFullScreen"
        onRequestClose={closeOptions}
      >
        <View style={styles.modalOverlayCenter}>
          <View style={styles.overlayCard}>
            <View style={styles.topBar}>
              <TouchableOpacity onPress={closeOptions} style={styles.navIconBtn}>
                <Ionicons name="close" size={28} color={COLORS.primary} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
              <StyledText style={styles.stepTitle}>{t('create_when_options_title')}</StyledText>

              <StyledText style={styles.modeSub}>
                {t('create_when_options_subtitle')}
              </StyledText>
              <StyledText style={styles.timezoneNote}>
                {t('create_when_timezone_note', { timeZone: localTimeZone })}
              </StyledText>

              <StyledText style={styles.label}>{t('create_when_date_options')}</StyledText>

              <TouchableOpacity
                style={styles.pwaInput}
                onPress={() =>
                  Platform.OS === 'android'
                    ? showAndroidPicker()
                    : openIOSPicker(new Date())
                }
              >
                <StyledText style={styles.pwaInputText}>{t('create_when_add_date_option')}</StyledText>
                <Ionicons name="add" size={18} color={COLORS.textMuted} />
              </TouchableOpacity>

              {Platform.OS === 'ios' && showPicker && form.whenMode === 'options' && (
                <>
                  <DateTimePicker
                    value={tempDate}
                    mode="date"
                    display="inline"
                    onChange={onIOSChange}
                    accentColor={COLORS.primary}
                    style={{ width: '100%' }}
                  />

                  <DateTimePicker
                    value={tempDate}
                    mode="time"
                    display="spinner"
                    onChange={onIOSTimeChange}
                    minuteInterval={15}
                    style={{ width: '100%' }}
                  />

                  <View style={styles.iosPickerFooter}>
                    <TouchableOpacity
                      onPress={() => setShowPicker(false)}
                      style={styles.iosFooterCancelBtn}
                    >
                      <StyledText style={styles.iosCancelText}>{t('common_cancel')}</StyledText>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.iosChooseBtn}
                      onPress={() => {
                        setForm((prev) => {
                          if (prev.pollOptions.some((d) => d.getTime() === tempDate.getTime())) {
                            return prev;
                          }

                          return {
                            ...prev,
                            pollOptions: [...prev.pollOptions, tempDate].sort(
                              (a, b) => a.getTime() - b.getTime()
                            ),
                          };
                        });

                        setShowPicker(false);
                      }}
                    >
                      <StyledText style={styles.iosChooseText}>{t('create_when_choose')}</StyledText>
                    </TouchableOpacity>
                  </View>
                </>
              )}

              {form.pollOptions.length > 0 && (
                <View style={{ marginTop: 8 }}>
                  {form.pollOptions.map((date) => {
                    const key = date.toISOString();

                    return (
                      <View
                        key={key}
                        style={[
                          styles.pwaInput,
                          { marginBottom: 10, paddingVertical: 14 },
                        ]}
                      >
                        <StyledText style={[styles.pwaInputText, { flex: 1 }]}>
                          {date.toLocaleString(dateLocale, {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          })}
                        </StyledText>

                        <TouchableOpacity
                          onPress={() =>
                            setForm((prev) => ({
                              ...prev,
                              pollOptions: prev.pollOptions.filter(
                                (d) => d.getTime() !== date.getTime()
                              ),
                            }))
                          }
                        >
                          <Ionicons name="close-circle" size={22} color={COLORS.danger} />
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                </View>
              )}

              <TouchableOpacity onPress={continueOptions}>
                <StyledText style={styles.doneText}>{t('common_done')}</StyledText>
              </TouchableOpacity>
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
    flexDirection: 'row',
    justifyContent: 'flex-start',
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

  clearEndText: {
    color: COLORS.primary,
    fontWeight: '800',
    marginBottom: 8,
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

  label: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.textMuted,
    marginTop: 20,
    marginBottom: 8,
    letterSpacing: 1,
  },

  modeCard: {
  backgroundColor: '#FAFBF8',
  borderRadius: 18,
  padding: 14,
  borderWidth: 1,
  borderColor: '#DDD5C8',
  marginBottom: 10,
},

  modeCardSelected: {
    borderWidth: 2,
    borderColor: COLORS.primary,
    backgroundColor: '#fbfcfa',
  },

  modeCardTop: {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: 8,
},
  modeEmoji: {
    fontSize: 25,
  },

  modeBadge: {
  backgroundColor: '#EEF4E9',
  borderRadius: 999,
  paddingHorizontal: 10,
  paddingVertical: 5,
},

modeBadgeText: {
  fontSize: 12,
  fontWeight: '800',
  color: COLORS.primary,
},
  
modeTitle: {
  fontSize: 18,
  lineHeight: 22,
  fontWeight: '900',
  color: '#1E1A17',
  marginBottom: 4,
},

  modeSub: {
  fontSize: 13,
  lineHeight: 18,
  color: '#7B746B',
},

modeExample: {
  marginTop: 8,
  backgroundColor: '#EEF4E9',
  borderRadius: 12,
  borderWidth: 1,
  borderColor: '#D7E4CC',
  paddingHorizontal: 10,
  paddingVertical: 8,
},

modeExampleText: {
  fontSize: 12,
  lineHeight: 16,
  color: COLORS.primary,
  fontWeight: '800',
},

  timezoneNote: {
    fontSize: 13,
    lineHeight: 18,
    color: COLORS.primary,
    fontWeight: '700',
    marginTop: 8,
  },

  secondaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fbfcfa',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.borderSoft,
    marginTop: 14,
  },

  secondaryTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: 3,
  },

  secondarySub: {
    fontSize: 13,
    lineHeight: 18,
    color: COLORS.textMuted,
  },

  pwaInput: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
    fontWeight: '600',
  },

  placeholderText: {
    color: COLORS.textMuted,
  },

  modalOverlayCenter: {
    flex: 1,
    backgroundColor: COLORS.overlay,
    justifyContent: 'center',
    alignItems: 'center',
  },

  overlayCard: {
    width: '92%',
    maxHeight: '88%',
    backgroundColor: COLORS.background,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  iosDeadlinePickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
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

  iosPickerFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderSoft,
  },

  iosFooterCancelBtn: {
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: 8,
  },

  iosChooseBtn: {
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 22,
  },

  iosChooseText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '900',
  },

  doneText: {
    color: COLORS.primary,
    fontWeight: '800',
    marginTop: 20,
  },
  sessionLabel: {
  fontSize: 12,
  fontWeight: '900',
  color: COLORS.textMuted,
  letterSpacing: 0.8,
  textTransform: 'uppercase',
  marginBottom: 4,
},

sessionDate: {
  fontSize: 18,
  fontWeight: '800',
  color: COLORS.text,
  marginBottom: 2,
},

sessionTime: {
  fontSize: 16,
  fontWeight: '700',
  color: COLORS.textMuted,
},
});
