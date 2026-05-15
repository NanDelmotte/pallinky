/** * Path: app/m/[token]/vibe-details.tsx 
 * Description: Detailed view for a 'Fishing' plan. Shows the full list of 
 * voters for each date and allows the host to finalize the plan. */

import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { StyledText } from '@pallinky/ui';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { supabase } from '@pallinky/core';

export default function VibeDetailsScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [plan, setPlan] = useState<any>(null);

  useEffect(() => {
    // Mocking the fetch for Nancy's specific idea
    setTimeout(() => {
      setPlan({
        title: "Canal Cruise & Drinks",
        description: "Testing the waters for a sunset cruise.",
        options: [
          { id: 'a', date: 'Fri 7 Mar, 19:00', voters: ['Nancy', 'Margot', 'Pete'], votes: 3 },
          { id: 'b', date: 'Sat 8 Mar, 15:00', voters: ['Nancy', 'Sarah', 'Tom', 'Anna', 'Zoe'], votes: 5 },
        ]
      });
      setLoading(false);
    }, 800);
  }, [token]);

  const finalizeDate = (date: string) => {
    Alert.alert(
      "Confirm Plan?",
      `This will turn this idea into a formal plan for ${date}. Ready to seal the deal?`,
      [
        { text: "Not yet", style: "cancel" },
        { 
          text: "Seal it!", 
          onPress: () => {
            // Logic to convert Vibe -> Formal in DB would go here
            router.replace('/(tabs)');
          } 
        }
      ]
    );
  };

  if (loading) return <View style={styles.center}><ActivityIndicator color="#0077b6" /></View>;

  return (
    <View style={styles.wrapper}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={28} color="#003049" />
        </TouchableOpacity>
        <StyledText style={styles.headerTitle}>Vibe Check</StyledText>
        <TouchableOpacity>
          <Ionicons name="share-social-outline" size={24} color="#003049" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <StyledText style={styles.title}>{plan?.title}</StyledText>
        <StyledText style={styles.sub}>{plan?.description}</StyledText>

        <View style={styles.section}>
          <StyledText style={styles.sectionLabel}>The Tide (Results)</StyledText>
          {plan?.options.map((opt: any) => (
            <View key={opt.id} style={styles.optionCard}>
              <View style={styles.optionInfo}>
                <StyledText style={styles.optionDate}>{opt.date}</StyledText>
                <StyledText style={styles.voterList}>
                  {opt.voters.join(', ')}
                </StyledText>
              </View>
              <TouchableOpacity 
                style={styles.selectBtn}
                onPress={() => finalizeDate(opt.date)}
              >
                <StyledText style={styles.selectBtnText}>{opt.votes}</StyledText>
                <MaterialCommunityIcons name="anchor" size={16} color="#fff" />
              </TouchableOpacity>
            </View>
          ))}
        </View>

        <TouchableOpacity style={styles.deleteBtn} onPress={() => router.back()}>
          <StyledText style={styles.deleteText}>Pull the Line (Cancel Idea)</StyledText>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: '#e0f2fe' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingTop: 60, backgroundColor: '#fff' },
  headerTitle: { fontSize: 20, fontWeight: '900', color: '#003049' },
  content: { padding: 25 },
  title: { fontSize: 28, fontWeight: '900', color: '#003049', marginBottom: 5 },
  sub: { fontSize: 16, color: '#0077b6', marginBottom: 30 },
  section: { marginTop: 10 },
  sectionLabel: { fontSize: 12, fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', marginBottom: 15, letterSpacing: 1 },
  optionCard: { backgroundColor: '#fff', borderRadius: 20, padding: 15, marginBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', elevation: 2 },
  optionInfo: { flex: 1, marginRight: 10 },
  optionDate: { fontSize: 16, fontWeight: '800', color: '#1e293b', marginBottom: 4 },
  voterList: { fontSize: 13, color: '#64748b', lineHeight: 18 },
  selectBtn: { backgroundColor: '#0077b6', paddingHorizontal: 15, height: 44, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 6 },
  selectBtnText: { color: '#fff', fontWeight: '900', fontSize: 16 },
  deleteBtn: { marginTop: 40, alignSelf: 'center', padding: 10 },
  deleteText: { color: '#ef4444', fontWeight: '700', fontSize: 14, opacity: 0.8 }
});