/**
 * Path: apps/mobile/app/create/invite-options.tsx
 * Description: Invite method step for the route-based formal create flow.
 */

import React from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { StyledText } from '@pallinky/ui';
import { useFormalDraft } from '../../lib/formalDraft';
import { useI18n } from '@pallinky/i18n/client';

const COLORS = {
  background: '#F6F7F9',
  surface: '#FFFFFF',
  text: '#1f2a1b',
  textMuted: '#66715f',
  primary: '#43691b',
  border: '#bac9ad',
  borderSoft: '#e7ede2',
};

export default function InviteOptionsScreen() {
  const { t } = useI18n();
  const { form, updateForm } = useFormalDraft();
  const isGroup = form.invite_option === 'group';

  const chooseIndividuals = () => {
    updateForm('invite_option', 'individuals');
    updateForm('visible_in_feed', false);
    updateForm('requires_approval', false);
  };

  const chooseGroup = () => {
    updateForm('invite_option', 'group');
    updateForm('visible_in_feed', false);
  };

  const goForward = () => {
    if (!form.invite_option) {
      chooseGroup();
    }

    router.replace('/create/event-details');
  };

  return (
    <SafeAreaView style={styles.wrapper} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="dark-content" />
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.replace('/create/event-type')} style={styles.navIconBtn}>
          <Ionicons name="arrow-back" size={28} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <StyledText style={styles.stepTitle}>
            {t('invite_options_title')}
          </StyledText>

          <TouchableOpacity
            style={[
              styles.optionCard,
              form.invite_option === 'group' && styles.optionCardSelected,
            ]}
            activeOpacity={0.9}
            onPress={chooseGroup}
          >
            <View style={styles.optionIcon}>
              <Ionicons name="chatbubbles-outline" size={24} color={COLORS.primary} />
            </View>
            <View style={styles.optionCopy}>
              <StyledText style={styles.optionTitle}>
                {t('invite_options_group_title')}
              </StyledText>
              <StyledText style={styles.optionBody}>
                {t('invite_options_group_body')}
              </StyledText>
            </View>
          </TouchableOpacity>

          {isGroup ? (
            <View style={styles.approvalBox}>
              <StyledText style={styles.approvalTitle}>
                {t('invite_options_approval_title')}
              </StyledText>

              <TouchableOpacity
                style={styles.radioRow}
                onPress={() => updateForm('requires_approval', true)}
              >
                <Ionicons
                  name={form.requires_approval ? 'radio-button-on' : 'radio-button-off'}
                  size={22}
                  color={COLORS.primary}
                />
                <StyledText style={styles.radioText}>
                  {t('invite_options_approval_yes')}
                </StyledText>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.radioRow}
                onPress={() => updateForm('requires_approval', false)}
              >
                <Ionicons
                  name={!form.requires_approval ? 'radio-button-on' : 'radio-button-off'}
                  size={22}
                  color={COLORS.primary}
                />
                <StyledText style={styles.radioText}>
                  {t('invite_options_approval_no')}
                </StyledText>
              </TouchableOpacity>
            </View>
          ) : null}

          <TouchableOpacity
            style={[
              styles.optionCard,
              form.invite_option === 'individuals' && styles.optionCardSelected,
            ]}
            activeOpacity={0.9}
            onPress={chooseIndividuals}
          >
            <View style={styles.optionIcon}>
              <Ionicons name="people-outline" size={24} color={COLORS.primary} />
            </View>
            <View style={styles.optionCopy}>
              <StyledText style={styles.optionTitle}>
                {t('invite_options_individuals_title')}
              </StyledText>
              <StyledText style={styles.optionBody}>
                {t('invite_options_individuals_body')}
              </StyledText>
            </View>
          </TouchableOpacity>

          <View style={styles.nav}>
            <TouchableOpacity style={styles.btn} onPress={() => router.replace('/create/event-type')}>
              <Ionicons name="arrow-back" size={28} color="#fff" />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.btn, !form.invite_option && styles.disabledBtn]}
              onPress={goForward}
              disabled={!form.invite_option}
            >
              <Ionicons name="arrow-forward" size={28} color="#fff" />
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  wrapper: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  topBar: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'flex-start',
    paddingBottom: 10,
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  navIconBtn: {
    alignItems: 'center',
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  container: {
    padding: 25,
    paddingBottom: 40,
    paddingTop: 10,
  },
  stepTitle: {
    color: COLORS.text,
    fontSize: 32,
    fontWeight: '900',
    marginBottom: 20,
  },
  optionCard: {
    alignItems: 'flex-start',
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    marginBottom: 12,
    padding: 16,
  },
  optionCardSelected: {
    backgroundColor: '#fbfcfa',
    borderColor: COLORS.primary,
    borderWidth: 2,
  },
  optionIcon: {
    alignItems: 'center',
    backgroundColor: '#EEF4E9',
    borderRadius: 14,
    height: 44,
    justifyContent: 'center',
    marginRight: 12,
    width: 44,
  },
  optionCopy: {
    flex: 1,
  },
  optionTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '900',
    lineHeight: 23,
    marginBottom: 4,
  },
  optionBody: {
    color: COLORS.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  approvalBox: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.borderSoft,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 12,
    padding: 14,
  },
  approvalTitle: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '900',
    lineHeight: 21,
    marginBottom: 8,
  },
  radioRow: {
    alignItems: 'center',
    flexDirection: 'row',
    minHeight: 42,
  },
  radioText: {
    color: COLORS.text,
    flex: 1,
    fontSize: 15,
    lineHeight: 20,
    marginLeft: 10,
  },
  nav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  btn: {
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    borderRadius: 30,
    height: 60,
    justifyContent: 'center',
    width: 60,
  },
  disabledBtn: {
    opacity: 0.45,
  },
});
