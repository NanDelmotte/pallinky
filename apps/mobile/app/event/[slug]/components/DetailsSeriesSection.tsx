// Path: app/event/[slug]/components/DetailsSeriesSection.tsx

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { formatInEventTimeZone } from '@pallinky/core';

type Theme = {
  bg: string;
  accent: string;
  text: string;
  isDark: boolean;
};

function formatSeriesDateTime(event: any) {
  if (!event?.starts_at) return 'Date TBD';

  return formatInEventTimeZone(
    event.starts_at,
    {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    },
    event
  );
}

const SYSTEM = {
  surface: '#FFFFFF',
  borderSoft: '#e7ede2',
};

export default function DetailsSeriesSection({
  theme,
  event,
  visibleSeriesEvents,
  onOpenSeriesEvent,
}: {
  theme: Theme;
  event: any;
  visibleSeriesEvents: any[];
  onOpenSeriesEvent: (slug: string) => void;
}) {
  if (!visibleSeriesEvents.length && !event?.series_id) return null;

  return (
    <View style={styles.seriesSection}>
      <Text style={[styles.sectionTitle, { color: theme.text }]}>Series</Text>

      <View style={styles.seriesList}>
        <TouchableOpacity
          activeOpacity={1}
          style={[
            styles.seriesRow,
            styles.seriesRowCurrent,
            {
              backgroundColor: theme.isDark ? 'rgba(255,255,255,0.08)' : SYSTEM.surface,
              borderColor: theme.accent,
            },
          ]}
        >
          <View style={styles.seriesRowTextWrap}>
            <Text style={[styles.seriesRowTitle, { color: theme.text }]}>
              {event.title || 'This event'}
            </Text>
            <Text style={[styles.seriesRowMeta, { color: theme.text }]}>
              {formatSeriesDateTime(event)}
            </Text>
          </View>

          <Text style={[styles.seriesCurrentBadge, { color: theme.accent }]}>Current</Text>
        </TouchableOpacity>

        {visibleSeriesEvents.map((item: any) => (
          <TouchableOpacity
            key={item.id}
            style={[
              styles.seriesRow,
              {
                backgroundColor: theme.isDark ? 'rgba(255,255,255,0.08)' : SYSTEM.surface,
                borderColor: theme.isDark ? 'rgba(255,255,255,0.10)' : SYSTEM.borderSoft,
              },
            ]}
            onPress={() => onOpenSeriesEvent(item.slug)}
          >
            <View style={styles.seriesRowTextWrap}>
              <Text style={[styles.seriesRowTitle, { color: theme.text }]}>
                {item.title || 'Untitled event'}
              </Text>
              <Text style={[styles.seriesRowMeta, { color: theme.text }]}>
                {formatSeriesDateTime(item)}
              </Text>
            </View>

            <Ionicons name="chevron-forward" size={18} color={theme.accent} />
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 15,
  },

  seriesSection: {
    marginBottom: 28,
  },

  seriesList: {
    gap: 10,
  },

  seriesRow: {
    minHeight: 64,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },

  seriesRowCurrent: {
    borderWidth: 1.5,
  },

  seriesRowTextWrap: {
    flex: 1,
  },

  seriesRowTitle: {
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 4,
  },

  seriesRowMeta: {
    fontSize: 14,
    opacity: 0.72,
  },

  seriesCurrentBadge: {
    fontSize: 12,
    fontWeight: '800',
  },
});