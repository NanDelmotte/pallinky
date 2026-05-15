/**
 * Path: apps/mobile/components/DateOptionPicker.tsx
 * Description: Cross-platform date option picker for the Vibe creation flow.
 * iOS uses an inline DateTimePicker with confirm controls.
 * Android opens the native date picker followed by time picker and adds the result to the poll options.
 */

import React, { useMemo, useState } from 'react';
import {
  Platform,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import DateTimePicker, {
  AndroidNativeProps,
  DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { StyledText } from '@pallinky/ui';

type Props = {
  value: Date[];
  onChange: (dates: Date[]) => void;
  accentColor?: string;
};

const COLORS = {
  surface: '#FFFFFF',
  text: '#1f2a1b',
  textMuted: '#66715f',
  primary: '#43691b',
  primaryBg: '#fbfcfa',
  border: '#bac9ad',
  borderSoft: '#e7ede2',
  danger: '#e63946',
};

function roundToNearestQuarterHour(date: Date) {
  const rounded = new Date(date);
  rounded.setSeconds(0, 0);
  const minutes = rounded.getMinutes();
  const roundedMinutes = Math.round(minutes / 15) * 15;
  rounded.setMinutes(roundedMinutes);

  if (roundedMinutes === 60) {
    rounded.setHours(rounded.getHours() + 1);
    rounded.setMinutes(0);
  }

  return rounded;
}

function formatDateLabel(date: Date) {
  return date.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function sortDatesAsc(dates: Date[]) {
  return [...dates].sort((a, b) => a.getTime() - b.getTime());
}

export default function DateOptionPicker({
  value,
  onChange,
  accentColor = COLORS.primary,
}: Props) {
  const [iosVisible, setIosVisible] = useState(false);
  const [iosTempDate, setIosTempDate] = useState<Date>(roundToNearestQuarterHour(new Date()));

  const [androidStep, setAndroidStep] = useState<'closed' | 'date' | 'time'>('closed');
  const [androidTempDate, setAndroidTempDate] = useState<Date>(roundToNearestQuarterHour(new Date()));

  const sortedDates = useMemo(() => sortDatesAsc(value), [value]);

  const addDateIfMissing = (nextDate: Date) => {
    const rounded = roundToNearestQuarterHour(nextDate);
    const exists = value.some((d) => d.getTime() === rounded.getTime());

    if (exists) return;

    onChange(sortDatesAsc([...value, rounded]));
  };

  const removeDateAtIndex = (index: number) => {
    const next = value.filter((_, i) => i !== index);
    onChange(next);
  };

  const openPicker = () => {
    const initial = roundToNearestQuarterHour(new Date());

    if (Platform.OS === 'ios') {
      setIosTempDate(initial);
      setIosVisible(true);
      return;
    }

    setAndroidTempDate(initial);
    setAndroidStep('date');
  };

  const onIosChange = (_event: DateTimePickerEvent, selectedDate?: Date) => {
    if (selectedDate) {
      setIosTempDate(selectedDate);
    }
  };

  const confirmIosDate = () => {
    addDateIfMissing(iosTempDate);
    setIosVisible(false);
  };

  const onAndroidDateChange: AndroidNativeProps['onChange'] = (event, selectedDate) => {
    if (event.type === 'dismissed') {
      setAndroidStep('closed');
      return;
    }

    if (!selectedDate) {
      setAndroidStep('closed');
      return;
    }

    const next = new Date(androidTempDate);
    next.setFullYear(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
    setAndroidTempDate(next);
    setAndroidStep('time');
  };

  const onAndroidTimeChange: AndroidNativeProps['onChange'] = (event, selectedDate) => {
    if (event.type === 'dismissed') {
      setAndroidStep('closed');
      return;
    }

    if (!selectedDate) {
      setAndroidStep('closed');
      return;
    }

    const next = new Date(androidTempDate);
    next.setHours(selectedDate.getHours(), selectedDate.getMinutes(), 0, 0);

    addDateIfMissing(next);
    setAndroidStep('closed');
  };

  return (
    <View>
      <StyledText style={styles.label}>Suggest some dates</StyledText>

      <View style={styles.listWrap}>
        {sortedDates.map((opt, index) => (
          <View key={`${opt.getTime()}-${index}`} style={[styles.badge, { borderLeftColor: accentColor }]}>
            <StyledText style={[styles.badgeText, { color: COLORS.text }]}>
              {formatDateLabel(opt)}
            </StyledText>

            <TouchableOpacity onPress={() => removeDateAtIndex(index)}>
              <Ionicons name="close-circle" size={22} color={COLORS.danger} />
            </TouchableOpacity>
          </View>
        ))}
      </View>

      {!iosVisible && (
        <TouchableOpacity
          style={[styles.addButton, { borderColor: accentColor }]}
          onPress={openPicker}
        >
          <Ionicons name="calendar" size={20} color={accentColor} style={{ marginBottom: 6 }} />
          <StyledText style={[styles.addButtonText, { color: accentColor }]}>
            + Add Date Option
          </StyledText>
        </TouchableOpacity>
      )}

      {Platform.OS === 'ios' && iosVisible && (
        <View style={styles.iosPickerContainer}>
          <DateTimePicker
            value={iosTempDate}
            mode="datetime"
            display="inline"
            onChange={onIosChange}
            minuteInterval={15}
            accentColor={accentColor}
          />

          <View style={styles.iosPickerFooter}>
            <TouchableOpacity onPress={() => setIosVisible(false)} style={styles.cancelBtn}>
              <StyledText style={styles.cancelText}>Cancel</StyledText>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={confirmIosDate}
              style={[styles.confirmBtn, { backgroundColor: accentColor }]}
            >
              <StyledText style={styles.confirmText}>Add Date</StyledText>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {Platform.OS === 'android' && androidStep === 'date' && (
        <DateTimePicker
          value={androidTempDate}
          mode="date"
          display="default"
          onChange={onAndroidDateChange}
        />
      )}

      {Platform.OS === 'android' && androidStep === 'time' && (
        <DateTimePicker
          value={androidTempDate}
          mode="time"
          display="default"
          is24Hour
          minuteInterval={15}
          onChange={onAndroidTimeChange}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    fontSize: 28,
    fontWeight: '900',
    color: COLORS.text,
    marginBottom: 20,
  },
  listWrap: {
    marginBottom: 10,
  },
  badge: {
    backgroundColor: COLORS.surface,
    padding: 15,
    borderRadius: 12,
    marginBottom: 10,
    borderLeftWidth: 5,
    borderWidth: 1,
    borderColor: COLORS.borderSoft,
    flexDirection: 'row',
    alignItems: 'center',
  },
  badgeText: {
    flex: 1,
    fontWeight: '700',
  },
  addButton: {
    padding: 25,
    borderRadius: 15,
    borderStyle: 'dashed',
    borderWidth: 2,
    alignItems: 'center',
    backgroundColor: COLORS.primaryBg,
    marginBottom: 20,
  },
  addButtonText: {
    fontWeight: '800',
  },
  iosPickerContainer: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: 10,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
  },
  iosPickerFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 10,
    marginTop: 5,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderSoft,
  },
  cancelBtn: {
    padding: 10,
  },
  cancelText: {
    color: COLORS.textMuted,
    fontWeight: '600',
  },
  confirmBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
  },
  confirmText: {
    color: '#fff',
    fontWeight: '800',
  },
});