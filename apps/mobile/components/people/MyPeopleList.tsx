import React from 'react';
import { Image, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StyledText } from '@pallinky/ui';

type PersonSource = 'pallinky' | 'contact';

export type MyPeopleListPerson = {
  key: string;
  selection_id: string;
  name: string;
  avatar_url: string | null;
  source: PersonSource;
};

type Props = {
  people: MyPeopleListPerson[];
  selectedPersonIds?: string[];
  onTogglePerson?: (selectionId: string) => void;
  onLongPressPerson?: (person: MyPeopleListPerson) => void;
  showCheckboxes?: boolean;
  showHintOnce?: boolean;
  emptyText?: string;
};

const COLORS = {
  text: '#1f2a1b',
  textMuted: '#66715f',
  primary: '#43691b',
  borderSoft: '#e7ede2',
  secondary: '#6A4C93',
  secondaryBg: '#efe9f7',
};

function avatarFor(name: string, avatarUrl: string | null | undefined) {
  if (avatarUrl) return avatarUrl;
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(
    name || 'Friend',
  )}&background=6A4C93&color=fff`;
}

export default function MyPeopleList({
  people,
  selectedPersonIds = [],
  onTogglePerson,
  onLongPressPerson,
  showCheckboxes = false,
  showHintOnce = false,
  emptyText = 'No people yet.',
}: Props) {
  const selectedSet = new Set(selectedPersonIds);

  if (!people.length) {
    return <StyledText style={styles.emptyText}>{emptyText}</StyledText>;
  }

  return (
    <View style={styles.list}>
      {people.map((person, index) => {
        const isSelected = selectedSet.has(person.selection_id);

        return (
          <TouchableOpacity
            key={person.key}
            style={styles.row}
            activeOpacity={0.8}
            onPress={onTogglePerson ? () => onTogglePerson(person.selection_id) : undefined}
            onLongPress={onLongPressPerson ? () => onLongPressPerson(person) : undefined}
          >
            <Image
              source={{ uri: avatarFor(person.name, person.avatar_url) }}
              style={styles.avatar}
            />

            <View style={styles.main}>
              <View style={styles.topRow}>
                <StyledText style={styles.name} numberOfLines={1}>
                  {person.name}
                </StyledText>

                {person.source === 'pallinky' ? (
                  <View style={styles.pallinkyBadge}>
                    <Ionicons name="sparkles" size={12} color={COLORS.secondary} />
                  </View>
                ) : null}
              </View>

              {showHintOnce && index === 0 ? (
                <StyledText style={styles.hint}>Long press to remove</StyledText>
              ) : null}
            </View>

            {showCheckboxes ? (
              <Ionicons
                name={isSelected ? 'checkbox' : 'square-outline'}
                size={22}
                color={isSelected ? COLORS.primary : '#b0b7c3'}
              />
            ) : null}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    paddingHorizontal: 12,
  },
  row: {
    minHeight: 64,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderSoft,
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.secondaryBg,
    marginRight: 12,
  },
  main: {
    flex: 1,
    minWidth: 0,
    paddingRight: 10,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  name: {
    fontSize: 15,
    fontWeight: '900',
    color: COLORS.text,
    flexShrink: 1,
  },
  pallinkyBadge: {
    marginLeft: 6,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: COLORS.secondaryBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hint: {
    marginTop: 2,
    fontSize: 11,
    color: COLORS.textMuted,
  },
  emptyText: {
    fontSize: 14,
    color: COLORS.textMuted,
    lineHeight: 20,
    paddingHorizontal: 16,
    paddingBottom: 4,
  },
});