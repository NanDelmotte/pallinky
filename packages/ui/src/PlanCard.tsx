/** * Path: components/PlanCard.tsx 
 * Description: Smart PlanCard. Removed hide logic and close button. 
 * Only retains deletion logic for hosts if strictly necessary, but button is removed from UI. */

import React from 'react';
import { View, Image, StyleSheet, Pressable, Platform, Alert } from 'react-native';
import { StyledText } from './BaseComponents';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@pallinky/core';

const PALETTES: Record<string, { bg: string; accent: string; text: string; isDark: boolean }> = {
  "zen": { bg: "#F6F7F9", accent: "#43691b", text: "#1f2a1b", isDark: false },
  "girly": { bg: "#f4bbd3", accent: "#fe5d9f", text: "#2b1f24", isDark: false },
  "fiesta": { bg: "#1729ae", accent: "#fe20e8", text: "#ffffff", isDark: true },
  "classy": { bg: "#03172f", accent: "#efd466", text: "#fff7b6", isDark: true },
  "spicy": { bg: "#656c12", accent: "#ecc216", text: "#ffffff", isDark: true },
};

const FONT_MAP: Record<string, string> = {
  'Sans': Platform.OS === 'ios' ? 'Arial-BoldMT' : 'sans-serif-condensed',
  'Serif': Platform.OS === 'ios' ? 'Times New Roman' : 'serif',
  'Cursive': Platform.OS === 'ios' ? 'SnellRoundhand-Bold' : 'cursive',
  'Gothic': Platform.OS === 'ios' ? 'Copperplate-Bold' : 'monospace'
};

interface PlanCardProps {
  id: string;
  currentUserEmail: string;
  hostEmail?: string;
  title: string;
  startsAt: string;
  location: string | null;
  coverImageUrl: string | null;
  gifKey: string | null;
  fontFamily?: string | null;
  hostName: string;
  status?: string; 
  actionLabel?: string;
  badge?: string;
  unreadMessages?: number;
  lastMessagePreview?: string | null;
  onPress?: () => void;
  onRefresh?: () => void;
  showPeek?: boolean;
  styleOverrides?: {
    buttonColor?: string;
    badgeColor?: string;
  };
}

const PlanCard = ({ 
  id,
  currentUserEmail,
  hostEmail,
  title, 
  startsAt, 
  location, 
  coverImageUrl, 
  gifKey, 
  fontFamily,
  hostName,
  status,
  actionLabel,
  badge,
  unreadMessages,
  lastMessagePreview,
  onPress,
  onRefresh,
  showPeek,
  styleOverrides
}: PlanCardProps) => {
  
  const theme = (gifKey && PALETTES[gifKey]) ? PALETTES[gifKey] : PALETTES["zen"];
  const customFont = { fontFamily: FONT_MAP[fontFamily || 'Sans'] || 'System' };
  
  const imageSource = coverImageUrl 
    ? { uri: coverImageUrl } 
    : { uri: `https://loremflickr.com/300/300/${gifKey || 'party'}` };

  const displayBadge = badge || (status === 'host' || status === 'guest' ? status : null);
  const isMaybe = displayBadge?.toLowerCase() === 'maybe';
  const activeBtnColor = styleOverrides?.buttonColor || theme.accent;
  const activeBadgeColor = isMaybe ? '#FFD700' : (styleOverrides?.badgeColor || theme.accent);

  return (
    <View style={[styles.card, { backgroundColor: theme.bg, borderColor: theme.accent + '30' }]}>
      <Pressable onPress={onPress} style={({ pressed }) => [{ flex: 1, flexDirection: 'row' }, { opacity: pressed ? 0.9 : 1 }]}>
        <Image source={imageSource} style={styles.coverImage} />
        
        <View style={styles.infoContainer}>
          <StyledText style={[styles.dateText, { color: theme.accent }, customFont]}>
            {startsAt ? new Date(startsAt).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) : 'Date TBD'}
          </StyledText>
          <StyledText style={[styles.titleText, { color: theme.text }, customFont]} numberOfLines={1}>{title}</StyledText>
          
          {location ? (
  <StyledText
    style={[styles.locationText, { color: theme.text, opacity: 0.7 }]}
    numberOfLines={1}
  >
    📍 {location}
  </StyledText>
) : null}

{lastMessagePreview && (
  <StyledText
    style={[styles.chatPreviewText, { color: theme.text, opacity: 0.6 }]}
    numberOfLines={1}
  >
    💬 {lastMessagePreview}
  </StyledText>
)}

{(unreadMessages ?? 0) > 0 && (
  <View style={styles.chatUnreadBadge}>
    <StyledText style={styles.chatUnreadText}>
      {unreadMessages}
    </StyledText>
  </View>
)}

          <View style={styles.footer}>
            <StyledText style={[styles.hostText, { color: theme.text, opacity: 0.5 }]} numberOfLines={1}>By {hostName}</StyledText>
            {displayBadge && (
              <View style={[styles.statusBadge, { backgroundColor: activeBadgeColor }]}>
                <StyledText style={[styles.statusBadgeText, { color: isMaybe ? '#000' : (theme.isDark ? theme.bg : '#fff') }]}>
                  {displayBadge.toUpperCase()}
                </StyledText>
              </View>
            )}
          </View>

          {(showPeek || actionLabel) && (
            <View style={[styles.peekSection, { borderTopColor: theme.accent + '20' }]}>
              <View style={[styles.peekButton, { backgroundColor: activeBtnColor }]}>
                <StyledText style={[styles.peekButtonText, { color: theme.isDark ? theme.bg : '#fff' }]}>
                  {actionLabel || 'Peek'}
                </StyledText>
                <Ionicons 
                  name={actionLabel === 'Manage' || actionLabel === 'Update' ? "settings-outline" : "eye-outline"} 
                  size={14} 
                  color={theme.isDark ? theme.bg : '#fff'} 
                />
              </View>
            </View>
          )}
        </View>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  card: { borderRadius: 20, marginVertical: 8, marginHorizontal: 16, overflow: 'hidden', flexDirection: 'row', borderWidth: 1, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, position: 'relative' },
  coverImage: { width: 110, height: '100%', backgroundColor: 'rgba(0,0,0,0.05)' },
  infoContainer: { padding: 12, flex: 1, justifyContent: 'center' },
  dateText: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', marginBottom: 2 },
  titleText: { fontSize: 16, fontWeight: '800' },
  locationText: { fontSize: 12, marginTop: 2 },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  hostText: { fontSize: 11, fontStyle: 'italic', flex: 1 },
  statusBadge: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 6, marginLeft: 5 },
  statusBadgeText: { fontSize: 8, fontWeight: 'bold', textTransform: 'uppercase' },
  peekSection: { marginTop: 8, borderTopWidth: 1, paddingTop: 8 },
  peekButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 6, borderRadius: 10 },
  peekButtonText: { fontSize: 12, fontWeight: '700' },

chatPreviewText: {
  fontSize: 12,
  marginTop: 3
},

chatUnreadBadge: {
  position: 'absolute',
  top: 10,
  right: 10,
  backgroundColor: '#ff3b30',
  minWidth: 18,
  height: 18,
  borderRadius: 9,
  alignItems: 'center',
  justifyContent: 'center',
  paddingHorizontal: 4
},

chatUnreadText: {
  color: '#fff',
  fontSize: 10,
  fontWeight: '800'
}
});

export default PlanCard;