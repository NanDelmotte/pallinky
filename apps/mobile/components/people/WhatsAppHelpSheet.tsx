import React from 'react';
import { Modal, SafeAreaView, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { StyledText } from '@pallinky/ui';

type Props = {
  visible: boolean;
  onClose: () => void;
};

const COLORS = {
  background: '#F6F7F9',
  surface: '#FFFFFF',
  text: '#1f2a1b',
  primary: '#43691b',
  borderSoft: '#e7ede2',
};

export default function WhatsAppHelpSheet({ visible, onClose }: Props) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.wrap}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose}>
            <StyledText style={styles.headerAction}>Close</StyledText>
          </TouchableOpacity>

          <StyledText style={styles.title}>WhatsApp Contacts</StyledText>

          <View style={styles.headerSpacer} />
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          <StyledText style={styles.helpText}>
            Pallinky only shows contacts saved to your phone.
          </StyledText>

          <StyledText style={styles.helpText}>
            If someone is only in WhatsApp, they will not appear here.
          </StyledText>

          <StyledText style={[styles.helpText, styles.topGap]}>
            You can turn off WhatsApp contacts in your account settings.
          </StyledText>

          <StyledText style={styles.helpText}>
            iPhone: Settings → Privacy → Contacts → toggle WhatsApp
          </StyledText>

          <StyledText style={styles.helpText}>
            Android: WhatsApp → Settings → Privacy → Contacts
          </StyledText>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 6,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderSoft,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerAction: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.primary,
  },
  headerSpacer: {
    width: 46,
  },
  title: {
    fontSize: 17,
    fontWeight: '900',
    color: COLORS.text,
  },
  content: {
    padding: 20,
  },
  helpText: {
    fontSize: 14,
    color: COLORS.text,
    lineHeight: 20,
    marginBottom: 8,
  },
  topGap: {
    marginTop: 12,
  },
});