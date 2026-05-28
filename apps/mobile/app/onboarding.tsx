import React from 'react';
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useI18n } from '@pallinky/i18n/client';
import type { TranslationKey } from '@pallinky/i18n/types';

type OnboardingStep = {
  id: string;
  kind: 'value' | 'invite' | 'network';
  headline: TranslationKey;
  body: TranslationKey;
};

const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: 'value',
    kind: 'value',
    headline: 'welcome_value_headline',
    body: 'welcome_value_body',
  },
  {
    id: 'invite',
    kind: 'invite',
    headline: 'welcome_invite_headline',
    body: 'welcome_invite_body',
  },
  {
    id: 'network',
    kind: 'network',
    headline: 'welcome_network_headline',
    body: 'welcome_network_body',
  },
];

const YOGA_SCENE = require('../assets/onboarding1a.png');
const DRINKS_SCENE = require('../assets/onboarding1b.png');
const INVITE_SCENE = require('../assets/onboarding2.png');
const DANCING_SCENE = require('../assets/onboarding3.png');

export default function OnboardingScreen() {
  const router = useRouter();
  const { destination } = useLocalSearchParams<{ destination?: string }>();
  const { t } = useI18n();
  const [step, setStep] = React.useState(0);

  const lastStep = ONBOARDING_STEPS.length - 1;
  const screen = ONBOARDING_STEPS[step];

  const finish = () => {
    const next = destination ? decodeURIComponent(destination) : '/create';
    router.replace(next as any);
  };

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.brandRow}>
          <Text style={styles.brand}>{t('welcome_title')}</Text>
          <View style={styles.stepPills}>
            {ONBOARDING_STEPS.map((item, index) => (
              <View
                key={item.id}
                style={[styles.stepPill, index === step && styles.stepPillActive]}
              />
            ))}
          </View>
        </View>

        <OnboardingVisual kind={screen.kind} />
        <Text style={styles.title}>{t(screen.headline)}</Text>

        {screen.kind === 'invite' ? (
          <View style={styles.callout}>
            <Text style={styles.calloutBody}>{t(screen.body)}</Text>
          </View>
        ) : (
          <Text style={styles.body}>{t(screen.body)}</Text>
        )}

      </ScrollView>

      <View style={styles.footer}>
        {step > 0 ? (
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => setStep((current) => Math.max(0, current - 1))}
          >
            <Text style={styles.backText}>{t('common_back')}</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.backSpacer} />
        )}

        <TouchableOpacity
          style={styles.primary}
          onPress={() => {
            if (step < lastStep) {
              setStep((current) => current + 1);
              return;
            }
            finish();
          }}
        >
          <Text style={styles.primaryText}>
            {step === lastStep ? t('onboarding_create_first_event') : t('common_next')}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function OnboardingVisual({ kind }: { kind: 'value' | 'invite' | 'network' }) {
  if (kind === 'invite') {
    return (
      <View style={styles.inviteSceneCard}>
        <Image source={INVITE_SCENE} style={IMAGE_FILL} resizeMode="cover" />
      </View>
    );
  }

  if (kind === 'network') {
    return (
      <View style={styles.dancingSceneCard}>
        <Image source={DANCING_SCENE} style={IMAGE_FILL} resizeMode="cover" />
      </View>
    );
  }

  return (
    <View style={styles.valueVisual}>
      <View style={styles.sceneCard}>
        <Image source={YOGA_SCENE} style={IMAGE_FILL} resizeMode="cover" />
      </View>
      <View style={[styles.sceneCard, styles.sceneCardLower]}>
        <Image source={DRINKS_SCENE} style={IMAGE_FILL} resizeMode="cover" />
      </View>
    </View>
  );
}

const SYSTEM = {
  background: '#F6F7F9',
  text: '#1f2a1b',
  primary: '#43691b',
  border: '#bac9ad',
};

const IMAGE_FILL = {
  height: '100%' as const,
  width: '100%' as const,
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: SYSTEM.background,
  },
  content: {
    padding: 22,
    paddingTop: 44,
    flexGrow: 1,
  },
  brandRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 22,
  },
  brand: {
    color: SYSTEM.text,
    fontSize: 18,
    fontWeight: '800',
  },
  stepPills: {
    flexDirection: 'row',
    gap: 6,
  },
  stepPill: {
    backgroundColor: '#d8dfd2',
    borderRadius: 999,
    height: 7,
    width: 7,
  },
  stepPillActive: {
    backgroundColor: SYSTEM.primary,
    width: 22,
  },
  title: {
    fontSize: 27,
    fontWeight: '700',
    color: SYSTEM.text,
    marginBottom: 10,
    lineHeight: 32,
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    color: '#66715f',
    marginBottom: 18,
  },
  footer: {
    alignItems: 'center',
    backgroundColor: SYSTEM.background,
    borderTopColor: '#e5eadf',
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: 12,
    padding: 20,
    paddingBottom: 28,
  },
  primary: {
    flex: 1,
    backgroundColor: SYSTEM.primary,
    padding: 16,
    borderRadius: 12,
  },
  primaryText: {
    color: '#fff',
    textAlign: 'center',
    fontWeight: '700',
  },
  backButton: {
    padding: 16,
  },
  backSpacer: {
    width: 66,
  },
  backText: {
    color: SYSTEM.text,
    fontWeight: '700',
  },
  valueVisual: {
    height: 304,
    marginBottom: 22,
    position: 'relative',
  },
  sceneCard: {
    backgroundColor: '#fff',
    borderColor: '#e2e8dc',
    borderRadius: 18,
    borderWidth: 1,
    aspectRatio: 1.5,
    left: 0,
    overflow: 'hidden',
    position: 'absolute',
    right: 46,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
  },
  sceneCardLower: {
    bottom: 0,
    left: 46,
    right: 0,
    top: undefined,
  },
  inviteSceneCard: {
    backgroundColor: '#fff',
    aspectRatio: 1.5,
    borderColor: '#e2e8dc',
    borderRadius: 18,
    borderWidth: 1,
    marginBottom: 22,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
  },
  callout: {
    backgroundColor: '#fff',
    borderColor: '#d5e0cb',
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
  },
  calloutBody: {
    color: SYSTEM.text,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  dancingSceneCard: {
    backgroundColor: '#fff',
    aspectRatio: 1.5,
    borderColor: '#e2e8dc',
    borderRadius: 18,
    borderWidth: 1,
    marginBottom: 22,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
  },
});
