/** * Path: moved to packages/ui/src/BaseComponents.tsx 
 * * Description: Reusable native components. Added StyledText and simplified StyledInput to match common mobile patterns. */



import React from 'react';
import { TouchableOpacity, Text, TextInput, StyleSheet, View, ActivityIndicator } from 'react-native';

// 1. Styled Text (The missing component)
export const StyledText = ({ children, style, ...props }: any) => (
  <Text style={[styles.baseText, style]} {...props}>{children}</Text>
);

// 2. Primary Button
export const PrimaryButton = ({ title, onPress, loading, disabled, style }: any) => (
  <TouchableOpacity 
    onPress={onPress} 
    disabled={disabled || loading} 
    style={[styles.btn, (disabled || loading) && styles.btnDisabled, style]}
  >
    {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>{title}</Text>}
  </TouchableOpacity>
);

// 3. Form Input
export const StyledInput = ({ label, ...props }: any) => (
  <View style={styles.inputGroup}>
    {label && <Text style={styles.label}>{label}</Text>}
    <TextInput style={styles.input} placeholderTextColor="#999" {...props} />
  </View>
);

const styles = StyleSheet.create({
  baseText: { fontSize: 16, color: '#000' },
  btn: {
    backgroundColor: '#000',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginVertical: 10,
  },
  btnDisabled: { backgroundColor: '#666' },
  btnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  inputGroup: { marginBottom: 20 },
  label: { fontSize: 14, fontWeight: '600', marginBottom: 8, color: '#333' },
  input: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    backgroundColor: '#F9F9F9',
  },
});