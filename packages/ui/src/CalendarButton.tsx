/** * Path: components/CalendarButton.tsx 
 * Description: Robust calendar component. Now supports manual selection on both iOS (ActionSheet) and Android (Alert). 
 */
import React from 'react';
import {
  TouchableOpacity,
  Text,
  Alert,
  Platform,
  ActionSheetIOS,
  StyleProp,
  ViewStyle,
} from 'react-native';
import * as Calendar from 'expo-calendar';
import * as Linking from 'expo-linking';

interface Props {
  event: any;
  theme: { accent: string; bg: string };
  children?: React.ReactNode;
  touchableStyle?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

export const CalendarButton = ({
  event,
  theme,
  children,
  touchableStyle,
  accessibilityLabel = 'Add to calendar',
}: Props) => {
  const saveToSelectedCalendar = async (calendarId: string) => {
    try {
      const eventUrl = Linking.createURL(`/event/${event.slug}`);
      await Calendar.createEventAsync(calendarId, {
        title: `🗓️ ${event.title}`,
        startDate: new Date(event.starts_at),
        endDate: event.ends_at ? new Date(event.ends_at) : new Date(new Date(event.starts_at).getTime() + 7200000),
        location: event.location || '',
        notes: `Guest List & Details: ${eventUrl}`,
        url: eventUrl,
      });
      Alert.alert('Success!', 'Event added to your calendar.');
    } catch (e) {
      Alert.alert('Error', 'Could not save the event.');
    }
  };

  const handleAdd = async () => {
    const { status } = await Calendar.requestCalendarPermissionsAsync();
    if (status !== 'granted') return Alert.alert('Permission Denied', 'Enable calendar access in settings.');

    const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
    const writableCalendars = calendars.filter(cal => cal.allowsModifications);

    if (writableCalendars.length === 0) {
      return Alert.alert('Error', 'No writable calendars found.');
    }

    if (Platform.OS === 'ios') {
      const options = writableCalendars.map(cal => cal.title);
      options.push('Cancel');
      ActionSheetIOS.showActionSheetWithOptions(
        { options, cancelButtonIndex: options.length - 1, title: 'Select a Calendar' },
        (index) => {
          if (index < writableCalendars.length) saveToSelectedCalendar(writableCalendars[index].id);
        }
      );
    } else {
      // Android: Alert supports max 3 buttons. 
      if (writableCalendars.length > 2) {
        // If many calendars, just use the first one to avoid messy UI
        saveToSelectedCalendar(writableCalendars[0].id);
      } else {
        const buttons = writableCalendars.map(cal => ({
          text: cal.title,
          onPress: () => saveToSelectedCalendar(cal.id)
        }));
        buttons.push({ text: 'Cancel', onPress: () => {}, style: 'cancel' } as any);
        
        Alert.alert('Select Calendar', 'Where should we save this?', buttons);
      }
    }
  };

  return (
    <TouchableOpacity
      onPress={handleAdd}
      style={touchableStyle || { marginTop: 10 }}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      {children || (
        <Text style={{ color: theme.accent, fontWeight: '700' }}>+ Add to Calendar</Text>
      )}
    </TouchableOpacity>
  );
};
