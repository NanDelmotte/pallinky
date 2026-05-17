/**
 * Path: apps/mobile/app/create/formal-when.tsx
 * Description: When step.
 * Specific = overlay modal
 * Options = overlay modal
 * Not sure yet = straight to details
 * Series = hidden behind "Repeat this event" inside Specific modal
 */

import React, { useState } from 'react';
import {
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
  const localTimeZone = getLocalTimeZone();

  const [showSpecificModal, setShowSpecificModal] = useState(false);
  const [showSeriesModal, setShowSeriesModal] = useState(false);
  const [showOptionsModal, setShowOptionsModal] = useState(false);

  const [showPicker, setShowPicker] = useState(false);
  const [showDurationDropdown, setShowDurationDropdown] = useState(false);

  const [tempDate, setTempDate] = useState(form.specificDate || new Date());

  const sameMinute = (a: Date, b: Date) => a.getTime() === b.getTime();

  const openSpecific = () => {
    updateForm('whenMode', 'specific');
    setTempDate(form.specificDate || new Date());
    setShowPicker(false);
    setShowDurationDropdown(false);
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
    setShowDurationDropdown(false);
    setShowSpecificModal(false);
    setShowSeriesModal(true);
  };

  const openOptions = () => {
    updateForm('whenMode', 'options');
    setShowPicker(false);
    setShowDurationDropdown(false);
    setShowOptionsModal(true);
  };

  const closeSpecific = () => {
    setShowSpecificModal(false);
    setShowPicker(false);
    setShowDurationDropdown(false);
  };

  const closeSeries = () => {
    setShowSeriesModal(false);
    setShowPicker(false);
    setShowDurationDropdown(false);
  };

  const closeOptions = () => {
    setShowOptionsModal(false);
    setShowPicker(false);
  };

  const onIOSChange = (_event: DateTimePickerEvent, selectedDate?: Date) => {
    if (selectedDate) setTempDate(selectedDate);
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

  const setDuration = (mins: number | null) => {
    updateForm('durationMins', mins);
    setShowDurationDropdown(false);
  };

  const removeSeriesDate = (date: Date) => {
    setForm((prev) => ({
      ...prev,
      seriesDates: prev.seriesDates.filter((d) => !sameMinute(d, date)),
    }));
  };

  const continueSpecific = () => {
    updateForm('whenMode', 'specific');
    updateForm('specificDate', tempDate);
    setShowSpecificModal(false);
    setShowPicker(false);
    setShowDurationDropdown(false);
    router.push('/create/formal-details');
  };

  const continueSeries = () => {
    updateForm('whenMode', 'series');
    setShowSeriesModal(false);
    setShowPicker(false);
    setShowDurationDropdown(false);
    router.push('/create/formal-details');
  };

  const continueOptions = () => {
    updateForm('whenMode', 'options');
    setShowOptionsModal(false);
    router.push('/create/formal-details');
  };

  return (
    <SafeAreaView style={styles.wrapper} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="dark-content" />
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.push('/create/formal')} style={styles.navIconBtn}>
          <Ionicons name="arrow-back" size={28} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <View>
            <StyledText style={styles.stepTitle}>When?</StyledText>

            <TouchableOpacity
              style={[
                styles.modeCard,
                form.whenMode === 'specific' && styles.modeCardSelected,
              ]}
              onPress={openSpecific}
            >
              <StyledText style={styles.modeTitle}>A specific time</StyledText>
              <StyledText style={styles.modeSub}>
                I already know when this is happening.
              </StyledText>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.modeCard,
                form.whenMode === 'options' && styles.modeCardSelected,
              ]}
              onPress={openOptions}
            >
              <StyledText style={styles.modeTitle}>A few options</StyledText>
              <StyledText style={styles.modeSub}>
                I want to suggest some dates and let people choose.
              </StyledText>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.modeCard,
                form.whenMode === 'unsure' && styles.modeCardSelected,
              ]}
              onPress={() => {
                updateForm('whenMode', 'unsure');
                router.push('/create/formal-details');
              }}
            >
              <StyledText style={styles.modeTitle}>Not sure yet</StyledText>
              <StyledText style={styles.modeSub}>
                I just want to open the plan for now.
              </StyledText>
            </TouchableOpacity>
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
              <StyledText style={styles.stepTitle}>A specific time</StyledText>

              <StyledText style={styles.modeSub}>
                Choose the date and time for this event.
              </StyledText>
              <StyledText style={styles.timezoneNote}>
                Times will be saved in {localTimeZone}.
              </StyledText>

              <StyledText style={styles.label}>START TIME</StyledText>

              <TouchableOpacity
                style={styles.pwaInput}
                onPress={() =>
                  Platform.OS === 'android'
                    ? showAndroidPicker()
                    : setShowPicker((prev) => !prev)
                }
              >
                <StyledText style={styles.pwaInputText}>
                  {tempDate.toLocaleString('en-GB', {
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
                      <StyledText style={styles.iosCancelText}>Cancel</StyledText>
                    </TouchableOpacity>

                    <TouchableOpacity onPress={confirmIOSDate}>
                      <StyledText style={styles.iosConfirmText}>Confirm</StyledText>
                    </TouchableOpacity>
                  </View>

                  <DateTimePicker
                    value={tempDate}
                    mode="datetime"
                    display="spinner"
                    onChange={onIOSChange}
                    minuteInterval={15}
                    style={{ width: '100%' }}
                  />
                </>
              )}

              <StyledText style={styles.label}>DURATION</StyledText>

              <TouchableOpacity
                style={styles.pwaInput}
                onPress={() => setShowDurationDropdown((prev) => !prev)}
              >
                <StyledText
                  style={[
                    styles.pwaInputText,
                    !form.durationMins && styles.placeholderText,
                  ]}
                >
                  {form.durationMins
                    ? `${Math.floor(form.durationMins / 60)}h ${form.durationMins % 60}m`
                    : 'No end time'}
                </StyledText>

                <Ionicons
                  name={showDurationDropdown ? 'chevron-up' : 'chevron-down'}
                  size={18}
                  color={COLORS.textMuted}
                />
              </TouchableOpacity>

              {showDurationDropdown && (
                <View style={styles.durationDropdown}>
                  <TouchableOpacity style={styles.durationOption} onPress={() => setDuration(null)}>
                    <StyledText style={styles.durationOptionText}>No end time</StyledText>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.durationOption} onPress={() => setDuration(30)}>
                    <StyledText style={styles.durationOptionText}>30m</StyledText>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.durationOption} onPress={() => setDuration(60)}>
                    <StyledText style={styles.durationOptionText}>1h</StyledText>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.durationOption} onPress={() => setDuration(90)}>
                    <StyledText style={styles.durationOptionText}>1h 30m</StyledText>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.durationOption} onPress={() => setDuration(120)}>
                    <StyledText style={styles.durationOptionText}>2h</StyledText>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.durationOption} onPress={() => setDuration(180)}>
                    <StyledText style={styles.durationOptionText}>3h</StyledText>
                  </TouchableOpacity>
                </View>
              )}

              <TouchableOpacity style={styles.secondaryCard} onPress={openSeriesFromSpecific}>
                <View style={{ flex: 1 }}>
                  <StyledText style={styles.secondaryTitle}>Repeat this event</StyledText>
                  <StyledText style={styles.secondarySub}>
                    Create several sessions of the same event.
                  </StyledText>
                </View>

                <Ionicons name="repeat" size={22} color={COLORS.primary} />
              </TouchableOpacity>

              <TouchableOpacity onPress={continueSpecific}>
                <StyledText style={styles.doneText}>Done</StyledText>
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
              <StyledText style={styles.stepTitle}>Repeat this event</StyledText>

              <StyledText style={styles.modeSub}>
                Add each session of the same event.
              </StyledText>
              <StyledText style={styles.timezoneNote}>
                Times will be saved in {localTimeZone}.
              </StyledText>

              {Platform.OS === 'ios' && showPicker && form.whenMode === 'series' && (
                <>
                  <View style={styles.iosDeadlinePickerHeader}>
                    <TouchableOpacity onPress={() => setShowPicker(false)}>
                      <StyledText style={styles.iosCancelText}>Cancel</StyledText>
                    </TouchableOpacity>

                    <TouchableOpacity onPress={confirmIOSDate}>
                      <StyledText style={styles.iosConfirmText}>Confirm</StyledText>
                    </TouchableOpacity>
                  </View>

                  <DateTimePicker
                    value={tempDate}
                    mode="datetime"
                    display="spinner"
                    onChange={onIOSChange}
                    minuteInterval={15}
                    style={{ width: '100%' }}
                  />
                </>
              )}

              <StyledText style={styles.label}>SESSIONS</StyledText>

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
                            {date.toLocaleString('en-GB', {
                              weekday: 'short',
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </StyledText>

                          <StyledText style={styles.sessionTime}>
                            {date.toLocaleString('en-GB', {
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

              
              <StyledText style={styles.label}>DURATION</StyledText>

              <TouchableOpacity
                style={styles.pwaInput}
                onPress={() => setShowDurationDropdown((prev) => !prev)}
              >
                <StyledText
                  style={[
                    styles.pwaInputText,
                    !form.durationMins && styles.placeholderText,
                  ]}
                >
                  {form.durationMins
                    ? `${Math.floor(form.durationMins / 60)}h ${form.durationMins % 60}m`
                    : 'No end time'}
                </StyledText>

                <Ionicons
                  name={showDurationDropdown ? 'chevron-up' : 'chevron-down'}
                  size={18}
                  color={COLORS.textMuted}
                />
              </TouchableOpacity>

              {showDurationDropdown && (
                <View style={styles.durationDropdown}>
                  <TouchableOpacity style={styles.durationOption} onPress={() => setDuration(null)}>
                    <StyledText style={styles.durationOptionText}>No end time</StyledText>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.durationOption} onPress={() => setDuration(30)}>
                    <StyledText style={styles.durationOptionText}>30m</StyledText>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.durationOption} onPress={() => setDuration(60)}>
                    <StyledText style={styles.durationOptionText}>1h</StyledText>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.durationOption} onPress={() => setDuration(90)}>
                    <StyledText style={styles.durationOptionText}>1h 30m</StyledText>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.durationOption} onPress={() => setDuration(120)}>
                    <StyledText style={styles.durationOptionText}>2h</StyledText>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.durationOption} onPress={() => setDuration(180)}>
                    <StyledText style={styles.durationOptionText}>3h</StyledText>
                  </TouchableOpacity>
                </View>
              )}
<TouchableOpacity
                style={[styles.pwaInput, { marginTop: 12 }]}
                onPress={() =>
                  Platform.OS === 'android'
                    ? showAndroidPicker()
                    : openIOSPicker(new Date())
                }
              >
                <StyledText style={styles.pwaInputText}>Add session</StyledText>
                <Ionicons name="add" size={18} color={COLORS.textMuted} />
              </TouchableOpacity>

              <TouchableOpacity onPress={continueSeries}>
                <StyledText style={styles.doneText}>Done</StyledText>
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
              <StyledText style={styles.stepTitle}>A few options</StyledText>

              <StyledText style={styles.modeSub}>
                Add possible dates so guests can choose what works.
              </StyledText>
              <StyledText style={styles.timezoneNote}>
                Times will be saved in {localTimeZone}.
              </StyledText>

              <StyledText style={styles.label}>DATE OPTIONS</StyledText>

              <TouchableOpacity
                style={styles.pwaInput}
                onPress={() =>
                  Platform.OS === 'android'
                    ? showAndroidPicker()
                    : openIOSPicker(new Date())
                }
              >
                <StyledText style={styles.pwaInputText}>Add a date option</StyledText>
                <Ionicons name="add" size={18} color={COLORS.textMuted} />
              </TouchableOpacity>

              {Platform.OS === 'ios' && showPicker && form.whenMode === 'options' && (
                <>
                  <DateTimePicker
                    value={tempDate}
                    mode="datetime"
                    display="spinner"
                    onChange={onIOSChange}
                    minuteInterval={15}
                    style={{ width: '100%' }}
                  />

                  <View style={styles.iosPickerFooter}>
                    <TouchableOpacity
                      onPress={() => setShowPicker(false)}
                      style={styles.iosFooterCancelBtn}
                    >
                      <StyledText style={styles.iosCancelText}>Cancel</StyledText>
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
                      <StyledText style={styles.iosChooseText}>Choose</StyledText>
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
                          {date.toLocaleString('en-GB', {
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
                <StyledText style={styles.doneText}>Done</StyledText>
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

  durationDropdown: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginTop: 8,
    marginBottom: 8,
    overflow: 'hidden',
  },

  durationOption: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderSoft,
  },

  durationOptionText: {
    fontSize: 16,
    color: COLORS.text,
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
    backgroundColor: '#fbfcfa',
  },

  modeTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: 4,
  },

  modeSub: {
    fontSize: 14,
    lineHeight: 20,
    color: COLORS.textMuted,
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