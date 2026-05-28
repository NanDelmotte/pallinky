import React from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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
        <Text style={styles.body}>{t(screen.body)}</Text>

        {screen.kind === 'invite' ? (
          <View style={styles.callout}>
            <Text style={styles.calloutTitle}>{t('welcome_invite_flow_key')}</Text>
            <Text style={styles.calloutBody}>{t('welcome_invite_flow_detail')}</Text>
          </View>
        ) : null}

        {screen.kind === 'network' ? (
          <View style={styles.networkPreview}>
            <View style={styles.personNode}>
              <Text style={styles.personInitial}>Y</Text>
            </View>
            <View style={styles.connector} />
            <View style={[styles.personNode, styles.friendNode]}>
              <Text style={styles.personInitial}>R</Text>
            </View>
            <View style={styles.connector} />
            <View style={[styles.personNode, styles.secondNode]}>
              <Text style={styles.personInitial}>2°</Text>
            </View>
          </View>
        ) : null}
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
      <View style={styles.flowVisual}>
        <VisualStep icon="restaurant-outline" label="Dinner" />
        <Ionicons name="arrow-forward" size={20} color={SYSTEM.primary} />
        <VisualStep icon="logo-whatsapp" label="Invite" />
        <Ionicons name="arrow-forward" size={20} color={SYSTEM.primary} />
        <VisualStep icon="checkmark-circle-outline" label="RSVP" />
      </View>
    );
  }

  if (kind === 'network') {
    return (
      <View style={styles.magicVisual}>
        <Ionicons name="sparkles-outline" size={34} color={SYSTEM.primary} />
        <Text style={styles.magicText}>friends of friends</Text>
      </View>
    );
  }

  return (
    <View style={styles.valueVisual}>
      <View style={styles.eventCard}>
        <Text style={styles.eventTitle}>Dinner Friday</Text>
        <View style={styles.avatarRow}>
          <View style={styles.avatar} />
          <View style={[styles.avatar, styles.avatarOverlap]} />
          <View style={[styles.avatar, styles.avatarOverlap, styles.avatarAccent]} />
        </View>
      </View>
      <Ionicons name="chatbubble-ellipses-outline" size={30} color={SYSTEM.primary} />
    </View>
  );
}

function VisualStep({
  icon,
  label,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
}) {
  return (
    <View style={styles.visualStep}>
      <Ionicons name={icon} size={24} color={SYSTEM.primary} />
      <Text style={styles.visualStepText}>{label}</Text>
    </View>
  );
}

const SYSTEM = {
  background: '#F6F7F9',
  text: '#1f2a1b',
  primary: '#43691b',
  border: '#bac9ad',
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: SYSTEM.background,
  },
  content: {
    padding: 24,
    paddingTop: 70,
    flexGrow: 1,
  },
  brandRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 42,
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
    fontSize: 32,
    fontWeight: '700',
    color: SYSTEM.text,
    marginBottom: 16,
    lineHeight: 38,
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
    color: '#66715f',
    marginBottom: 30,
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
    alignItems: 'center',
    backgroundColor: '#eef4e7',
    borderColor: '#d5e0cb',
    borderRadius: 24,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 34,
    padding: 18,
  },
  eventCard: {
    backgroundColor: '#fff',
    borderColor: '#d5e0cb',
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    width: 180,
  },
  eventTitle: {
    color: SYSTEM.text,
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 18,
  },
  avatarRow: {
    flexDirection: 'row',
  },
  avatar: {
    backgroundColor: '#f2c078',
    borderColor: '#fff',
    borderRadius: 999,
    borderWidth: 2,
    height: 34,
    width: 34,
  },
  avatarOverlap: {
    backgroundColor: '#8bb6a6',
    marginLeft: -9,
  },
  avatarAccent: {
    backgroundColor: '#d97862',
  },
  flowVisual: {
    alignItems: 'center',
    backgroundColor: '#fff',
    borderColor: '#d5e0cb',
    borderRadius: 24,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
    marginBottom: 34,
    padding: 14,
  },
  visualStep: {
    alignItems: 'center',
    backgroundColor: '#f4f7f1',
    borderRadius: 16,
    flex: 1,
    minHeight: 82,
    justifyContent: 'center',
    padding: 8,
  },
  visualStepText: {
    color: SYSTEM.text,
    fontSize: 12,
    fontWeight: '800',
    marginTop: 7,
    textAlign: 'center',
  },
  callout: {
    backgroundColor: '#fff',
    borderColor: '#d5e0cb',
    borderRadius: 18,
    borderWidth: 1,
    padding: 18,
  },
  calloutTitle: {
    color: SYSTEM.text,
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 8,
  },
  calloutBody: {
    color: '#66715f',
    fontSize: 15,
    lineHeight: 22,
  },
  magicVisual: {
    alignItems: 'center',
    backgroundColor: '#f7eadf',
    borderColor: '#ecd6c2',
    borderRadius: 24,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    marginBottom: 34,
    padding: 20,
  },
  magicText: {
    color: SYSTEM.text,
    fontSize: 19,
    fontWeight: '800',
  },
  networkPreview: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 8,
  },
  personNode: {
    alignItems: 'center',
    backgroundColor: '#fff',
    borderColor: SYSTEM.primary,
    borderRadius: 999,
    borderWidth: 2,
    height: 54,
    justifyContent: 'center',
    width: 54,
  },
  friendNode: {
    backgroundColor: '#eef4e7',
  },
  secondNode: {
    backgroundColor: '#f7eadf',
    borderColor: '#d97862',
  },
  personInitial: {
    color: SYSTEM.text,
    fontWeight: '900',
  },
  connector: {
    backgroundColor: SYSTEM.border,
    height: 2,
    width: 42,
  },
});
