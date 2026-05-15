import React from 'react';
import { Alert, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StyledText } from '@pallinky/ui';
import MyPeopleList, { MyPeopleListPerson } from './MyPeopleList';

type Props = {
  people: MyPeopleListPerson[];
  selectedPersonIds?: string[];
  onTogglePerson?: (selectionId: string) => void;
  onPressAddPeople?: () => void;
  onLongPressPerson?: (person: MyPeopleListPerson) => void;
  showCheckboxes?: boolean;
  showHintOnce?: boolean;
  emptyText?: string;
};

const COLORS = {
  surface: '#FFFFFF',
  text: '#1f2a1b',
  textMuted: '#66715f',
  primary: '#43691b',
  primarySoft: '#eef4e8',
  borderSoft: '#e7ede2',
};

export default function MyPeopleSection({
  people,
  selectedPersonIds = [],
  onTogglePerson,
  onPressAddPeople,
  onLongPressPerson,
  showCheckboxes = false,
  showHintOnce = false,
  emptyText = 'No people yet. Tap the add button to choose who to share from your phone.',
}: Props) {
  return (
    <View style={styles.sectionCard}>
      <View style={styles.headerRow}>
        <StyledText style={styles.sectionTitle}>My People</StyledText>

        <TouchableOpacity
          style={styles.addPeopleButton}
          onPress={onPressAddPeople}
          accessibilityLabel="Add people"
        >
          <Ionicons name="person-add-outline" size={20} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      <MyPeopleList
        people={people}
        selectedPersonIds={selectedPersonIds}
        onTogglePerson={onTogglePerson}
        onLongPressPerson={onLongPressPerson}
        showCheckboxes={showCheckboxes}
        showHintOnce={showHintOnce}
        emptyText={emptyText}
      />
    </View>
  );
}

export function defaultMyPeopleLongPressHandler(
  person: MyPeopleListPerson,
  onConfirmRemove: (person: MyPeopleListPerson) => void,
) {
  Alert.alert('Remove from my people', `Remove ${person.name} from your people list?`, [
    { text: 'Cancel', style: 'cancel' },
    {
      text: 'Remove',
      style: 'destructive',
      onPress: () => onConfirmRemove(person),
    },
  ]);
}

const styles = StyleSheet.create({
  sectionCard: {
    marginBottom: 14,
    borderRadius: 24,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.borderSoft,
    paddingVertical: 16,
  },
  headerRow: {
    paddingHorizontal: 16,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontSize: 19,
    fontWeight: '900',
    color: COLORS.text,
  },
  addPeopleButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primarySoft,
    borderWidth: 1,
    borderColor: '#d8e5cc',
    alignItems: 'center',
    justifyContent: 'center',
  },
});