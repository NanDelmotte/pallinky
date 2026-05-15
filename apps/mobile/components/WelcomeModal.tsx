/** * Path: components/WelcomeModal.tsx 
 * Description: First-time welcome modal for Pal-linky. Simplified to remove feedback request. */

import React, { useState, useEffect } from 'react';
import { Modal, View, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { StyledText } from '@pallinky/ui';
import * as SecureStore from 'expo-secure-store';
import { Ionicons } from '@expo/vector-icons';

const WELCOME_KEY = 'has_seen_welcome_v1';

export default function WelcomeModal() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    checkFirstTime();
  }, []);

  const getStorageItem = async (key: string) => {
    if (Platform.OS === 'web') {
      return localStorage.getItem(key);
    }
    return await SecureStore.getItemAsync(key);
  };

  const setStorageItem = async (key: string, value: string) => {
    if (Platform.OS === 'web') {
      localStorage.setItem(key, value);
      return;
    }
    await SecureStore.setItemAsync(key, value);
  };

  const checkFirstTime = async () => {
    try {
      const hasSeen = await getStorageItem(WELCOME_KEY);
      if (!hasSeen) {
        setVisible(true);
      }
    } catch (e) {
      console.log("Storage check failed", e);
    }
  };

  const handleClose = async () => {
    await setStorageItem(WELCOME_KEY, 'true');
    setVisible(false);
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          <View style={styles.iconCircle}>
            <Ionicons name="sparkles" size={40} color="#43691b" />
          </View>
          
          <StyledText style={styles.title}>Welcome to Pal-linky!</StyledText>
          
          <StyledText style={styles.body}>
            Thanks for being an early tester. This app helps turn "we should hang out" into real plans and grow your social circles organically in REAL LIFE.
          </StyledText>

          <View style={styles.bulletPoint}>
            <Ionicons name="egg-outline" size={20} color="#43691b" />
            <StyledText style={styles.bulletText}>The Hatchery: Save half-baked ideas.</StyledText>
          </View>

          <View style={styles.bulletPoint}>
            <Ionicons name="people-outline" size={20} color="#43691b" />
            <StyledText style={styles.bulletText}>Connections: See who wants to hang out.</StyledText>
          </View>

          <TouchableOpacity style={styles.button} onPress={handleClose}>
            <StyledText style={styles.buttonText}>Let's Go</StyledText>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContainer: { backgroundColor: '#F6F7F9', borderRadius: 24, padding: 30, width: '100%', alignItems: 'center' },
  iconCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  title: { fontSize: 24, fontWeight: '900', color: '#1f2a1b', marginBottom: 15, textAlign: 'center' },
  body: { fontSize: 15, color: '#43691b', textAlign: 'center', marginBottom: 20, lineHeight: 22 },
  bulletPoint: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 10, marginBottom: 10 },
  bulletText: { fontSize: 14, color: '#1f2a1b', fontWeight: '500' },
  button: { marginTop: 30, backgroundColor: '#1f2a1b', paddingVertical: 15, paddingHorizontal: 40, borderRadius: 15, width: '100%' },
  buttonText: { color: '#fff', fontWeight: 'bold', textAlign: 'center', fontSize: 16 }
});