// packages/ui/src/ReconnectFeedCard.tsx
import React from 'react';
import { View, StyleSheet, Pressable, Image } from 'react-native';
import { StyledText } from './BaseComponents';
import { Ionicons } from '@expo/vector-icons';

export interface ReconnectFeedCardProps {
  person: any;
  subtitle: string;
  onPress?: () => void;
  onDismiss?: () => void;
}

function getInitials(person: any) {
  const first = person?.name || person?.full_name || person?.first_name || '';
  if (!first) return '?';

  const parts = String(first).trim().split(/\s+/);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();

  return `${parts[0].charAt(0)}${parts[1].charAt(0)}`.toUpperCase();
}

function getDisplayName(person: any) {
  return (
    person?.first_name ||
    person?.name ||
    person?.full_name ||
    person?.email ||
    'Someone'
  );
}

const ReconnectFeedCard = ({
  person,
  subtitle,
  onPress,
  onDismiss,
}: ReconnectFeedCardProps) => {
  const imageUrl = person?.avatar_url || person?.photo_url || null;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.shadowWrap, pressed && styles.pressed]}
    >
      <View style={styles.card}>
        <View style={styles.leftSide}>
          {imageUrl ? (
            <Image source={{ uri: imageUrl }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarFallback}>
              <StyledText style={styles.avatarFallbackText}>
                {getInitials(person)}
              </StyledText>
            </View>
          )}

          <View style={styles.textBlock}>
            <StyledText style={styles.nameText} numberOfLines={1}>
              {getDisplayName(person)}
            </StyledText>
            <StyledText style={styles.subtitleText} numberOfLines={2}>
              {subtitle}
            </StyledText>
          </View>
        </View>

        <View style={styles.rightSide}>
          {onDismiss ? (
            <Pressable
              onPress={onDismiss}
              hitSlop={10}
              style={styles.dismissButton}
            >
              <Ionicons name="close" size={15} color="#94a3b8" />
            </Pressable>
          ) : (
            <View style={styles.dismissSpacer} />
          )}

          <View style={styles.ctaButton}>
            <StyledText style={styles.ctaText}>Add</StyledText>
          </View>
        </View>
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  shadowWrap: {
    width: '100%',
    borderRadius: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
  pressed: {
    opacity: 0.96,
  },
  card: {
    minHeight: 92,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#bac9ad',
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  leftSide: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    paddingRight: 12,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    marginRight: 12,
  },
  avatarFallback: {
    width: 46,
    height: 46,
    borderRadius: 23,
    marginRight: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#bac9ad',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarFallbackText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1f2a1b',
  },
  textBlock: {
    flex: 1,
  },
  nameText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1f2a1b',
  },
  subtitleText: {
    marginTop: 3,
    fontSize: 14,
    lineHeight: 18,
    color: '#66715f',
  },
  rightSide: {
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    alignSelf: 'stretch',
  },
  dismissButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dismissSpacer: {
    height: 24,
  },
  ctaButton: {
    marginTop: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#bac9ad',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  ctaText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#43691b',
  },
});

export default ReconnectFeedCard;