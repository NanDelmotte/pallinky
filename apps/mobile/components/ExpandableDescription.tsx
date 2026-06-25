import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

function getCollapsedDescription(value: string) {
  return value.length > 156 ? `${value.slice(0, 156).trimEnd()}...` : value;
}

export default function ExpandableDescription({
  description,
  textStyle,
  textColor,
  accentColor,
  collapsedLines = 3,
}: {
  description: string | null | undefined;
  textStyle: any;
  textColor: string;
  accentColor: string;
  collapsedLines?: number;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const cleanDescription = String(description || '').trim();
  const collapsedDescription = getCollapsedDescription(cleanDescription);

  if (!cleanDescription) return null;

  return (
    <TouchableOpacity
      style={styles.toggle}
      activeOpacity={0.82}
      onPress={() => setIsExpanded((current) => !current)}
      accessibilityRole="button"
      accessibilityLabel={isExpanded ? 'Collapse event details' : 'Expand event details'}
    >
      <Text
        style={[textStyle, !isExpanded && styles.collapsed, { color: textColor }]}
        numberOfLines={isExpanded ? undefined : collapsedLines}
        ellipsizeMode="tail"
      >
        {isExpanded ? cleanDescription : collapsedDescription}
      </Text>

      <Ionicons
        name={isExpanded ? 'chevron-up' : 'chevron-down'}
        size={18}
        color={accentColor}
        style={styles.chevron}
      />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  toggle: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },

  collapsed: {
    flexShrink: 1,
  },

  chevron: {
    marginLeft: 6,
    marginTop: 3,
  },
});
