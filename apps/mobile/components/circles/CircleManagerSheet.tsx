/**
 * Path: apps/mobile/components/circles/CircleManagerSheet.tsx
 * Description: Reusable Circle Manager UI for create, rename, delete, member listing,
 * choose-members from the same My People data source as Share Picker, manual member add,
 * member removal, and optional use-circle action.
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { StyledText } from '@pallinky/ui';
import { supabase } from '@pallinky/core';

import {
  Circle,
  CircleMemberRow,
  DeviceContactRow,
} from './circleManagerTypes';

import {
  addMemberToCircle,
  createCircle,
  deleteCircle,
  removeMember,
  renameCircle,
} from '../../lib/circles/circleManagerHelpers';

const COLORS = {
  background: '#F6F7F9',
  surface: '#FFFFFF',
  surfaceAlt: '#F9FBF7',
  text: '#1f2a1b',
  textMuted: '#66715f',
  primary: '#43691b',
  primarySoft: '#eef4e8',
  border: '#bac9ad',
  borderSoft: '#e7ede2',
  secondary: '#6A4C93',
  secondaryBg: '#efe9f7',
  danger: '#e63946',
  dangerBg: '#fff3f3',
};

function normalizeEmail(value: string | null | undefined) {
  return value?.toLowerCase().trim() || null;
}

function normalizePhone(value: string | null | undefined) {
  if (!value) return null;
  return value.trim().replace(/[\s\-()]/g, '') || null;
}

function initialsFor(name: string | null | undefined) {
  const words = (name || 'Friend')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);
  return words.map((w) => w[0]?.toUpperCase() || '').join('') || 'FR';
}

function emailToFallbackName(email: string) {
  const first = email.split('@')[0].split(/[._-]+/)[0]?.trim();
  return first || 'Friend';
}

function phoneToFallbackName(phone: string) {
  const digits = phone.replace(/[^\d+]/g, '');
  const tail = digits.slice(-4);
  return tail ? `Contact ${tail}` : 'Contact';
}

function getSelectionId(input: {
  device_contact_id?: string | null;
  phone_e164?: string | null;
  email_lc?: string | null;
}) {
  const deviceContactId = input.device_contact_id?.trim();
  if (deviceContactId) return `device:${deviceContactId}`;

  const phone = normalizePhone(input.phone_e164);
  if (phone) return `phone:${phone}`;

  const email = normalizeEmail(input.email_lc);
  if (email) return `email:${email}`;

  return '';
}

interface CircleManagerSheetProps {
  visible: boolean;
  circles: Circle[];
  setCircles: React.Dispatch<React.SetStateAction<Circle[]>>;
  userId: string;
  initialMode?: 'create' | 'edit';
  initialCircle?: Circle | null;
  onClose: () => void;
  onUseCircle?: (circle: Circle) => void;
}

type InternalScreen = 'manage' | 'chooseMembers';
type PersonSource = 'pallinky' | 'contact';

interface PredictedFriend {
  name: string | null;
  email_lc: string | null;
  total_hangouts: number | null;
  avatar_url: string | null;
}

interface ProfileAvatarRow {
  id: string;
  email_lc: string | null;
  avatar_url: string | null;
}

interface HiddenPersonRow {
  email_lc: string | null;
  phone_e164: string | null;
  matched_user_id: string | null;
}

interface UnifiedPerson {
  key: string;
  selection_id: string;
  email_lc: string | null;
  name: string;
  avatar_url: string | null;
  source: PersonSource;
  total_hangouts: number;
  device_contact_id: string | null;
  phone_e164: string | null;
  matched_user_id: string | null;
  person_id: string | null;
}

export default function CircleManagerSheet({
  visible,
  circles,
  setCircles,
  userId,
  initialMode = 'create',
  initialCircle = null,
  onClose,
  onUseCircle,
}: CircleManagerSheetProps) {
  const [manageMode, setManageMode] = useState<'create' | 'edit'>(initialMode);
  const [activeCircle, setActiveCircle] = useState<Circle | null>(initialCircle);
  const [circleSaving, setCircleSaving] = useState(false);
  const [circleNameValue, setCircleNameValue] = useState('');
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [newMemberPhone, setNewMemberPhone] = useState('');

  const [screen, setScreen] = useState<InternalScreen>('manage');
  const [peopleLoading, setPeopleLoading] = useState(false);
  const [peopleSearch, setPeopleSearch] = useState('');
  const [availablePeople, setAvailablePeople] = useState<UnifiedPerson[]>([]);
  const [selectedPersonIds, setSelectedPersonIds] = useState<string[]>([]);

  useEffect(() => {
    if (!visible) return;

    setManageMode(initialMode);
    setActiveCircle(initialCircle);
    setCircleNameValue(initialCircle?.circle_name || '');
    setNewMemberName('');
    setNewMemberEmail('');
    setNewMemberPhone('');
    setScreen('manage');
    setPeopleLoading(false);
    setPeopleSearch('');
    setAvailablePeople([]);
    setSelectedPersonIds([]);
  }, [visible, initialMode, initialCircle]);

  useEffect(() => {
    if (!activeCircle) return;

    const latest = circles.find((circle) => circle.id === activeCircle.id);
    if (latest) {
      setActiveCircle(latest);
    }
  }, [circles, activeCircle]);

  const filteredPeople = useMemo(() => {
    const q = peopleSearch.trim().toLowerCase();
    if (!q) return availablePeople;

    return availablePeople.filter((person) => {
      return (
        person.name.toLowerCase().includes(q) ||
        (person.email_lc || '').toLowerCase().includes(q) ||
        (person.phone_e164 || '').toLowerCase().includes(q)
      );
    });
  }, [availablePeople, peopleSearch]);

  async function handleCreateCircle() {
    const name = circleNameValue.trim();
    if (!name) {
      Alert.alert('Enter a circle name');
      return;
    }

    setCircleSaving(true);

    try {
      const createdCircle = await createCircle(userId, name);
      setCircles((prev) => [createdCircle, ...prev]);
      onClose();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Could not create circle.');
    } finally {
      setCircleSaving(false);
    }
  }

  async function handleRenameCircle() {
    if (!activeCircle) return;

    const nextName = circleNameValue.trim();
    if (!nextName) {
      Alert.alert('Enter a circle name');
      return;
    }

    setCircleSaving(true);

    try {
      await renameCircle(activeCircle.id, nextName);

      const nextCircle = {
        ...activeCircle,
        circle_name: nextName,
      };

      setCircles((prev) =>
        prev.map((circle) => (circle.id === activeCircle.id ? nextCircle : circle)),
      );
      setActiveCircle(nextCircle);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Could not rename circle.');
    } finally {
      setCircleSaving(false);
    }
  }

  function handleDeleteCircle(circle: Circle) {
    Alert.alert('Delete circle', `Delete "${circle.circle_name}" and all its members?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setCircleSaving(true);

          try {
            await deleteCircle(circle.id);
            setCircles((prev) => prev.filter((item) => item.id !== circle.id));
            onClose();
          } catch (e: any) {
            Alert.alert('Error', e?.message || 'Could not delete circle.');
          } finally {
            setCircleSaving(false);
          }
        },
      },
    ]);
  }

  async function handleAddMemberToCircle() {
    if (!activeCircle) return;

    const member_name = newMemberName.trim() || null;
    const member_email_lc = normalizeEmail(newMemberEmail);
    const member_phone_e164 = normalizePhone(newMemberPhone);

    if (!member_name && !member_email_lc && !member_phone_e164) {
      Alert.alert('Add at least a name, email, or phone.');
      return;
    }

    setCircleSaving(true);

    try {
      const nextMember = await addMemberToCircle({
        circle: activeCircle,
        member_name,
        member_email_lc,
        member_phone_e164,
      });

      const nextCircle = {
        ...activeCircle,
        members: [...activeCircle.members, nextMember],
      };

      setCircles((prev) =>
        prev.map((circle) => (circle.id === activeCircle.id ? nextCircle : circle)),
      );
      setActiveCircle(nextCircle);
      setNewMemberName('');
      setNewMemberEmail('');
      setNewMemberPhone('');
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Could not add member.');
    } finally {
      setCircleSaving(false);
    }
  }

  function handleRemoveCircleMember(member: CircleMemberRow) {
    if (!activeCircle) return;

    Alert.alert(
      'Remove member',
      `Remove ${member.member_name || member.member_email_lc || member.member_phone_e164 || 'this member'} from the circle?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            setCircleSaving(true);

            try {
              await removeMember(member.id);

              const nextCircle = {
                ...activeCircle,
                members: activeCircle.members.filter((item) => item.id !== member.id),
              };

              setCircles((prev) =>
                prev.map((circle) => (circle.id === activeCircle.id ? nextCircle : circle)),
              );
              setActiveCircle(nextCircle);
            } catch (e: any) {
              Alert.alert('Error', e?.message || 'Could not remove member.');
            } finally {
              setCircleSaving(false);
            }
          },
        },
      ],
    );
  }

  function buildMergedPeople(
    predictedFriends: PredictedFriend[],
    deviceContacts: DeviceContactRow[],
    profileRows: ProfileAvatarRow[],
    hiddenRows: HiddenPersonRow[],
    userEmail: string,
  ): UnifiedPerson[] {
    const personMap = new Map<string, UnifiedPerson>();
    const profileAvatarByEmail = new Map<string, string>();
    const profileAvatarById = new Map<string, string>();

    const hiddenEmailSet = new Set(
      hiddenRows.map((row) => normalizeEmail(row.email_lc)).filter(Boolean),
    );
    const hiddenPhoneSet = new Set(
      hiddenRows.map((row) => normalizePhone(row.phone_e164)).filter(Boolean),
    );
    const hiddenMatchedUserIdSet = new Set(
      hiddenRows.map((row) => row.matched_user_id || '').filter(Boolean),
    );

    profileRows.forEach((profile) => {
      const email = normalizeEmail(profile.email_lc);
      const avatar = profile.avatar_url?.trim() || '';

      if (email && avatar) profileAvatarByEmail.set(email, avatar);
      if (profile.id && avatar) profileAvatarById.set(profile.id, avatar);
    });

    predictedFriends
      .filter((friend) => {
        const cleanEmail = normalizeEmail(friend.email_lc);
        return cleanEmail !== '' && cleanEmail !== userEmail && !hiddenEmailSet.has(cleanEmail);
      })
      .forEach((friend) => {
        const email = normalizeEmail(friend.email_lc);
        if (!email) return;

        personMap.set(`email:${email}`, {
          key: `email:${email}`,
          selection_id: getSelectionId({ email_lc: email }),
          email_lc: email,
          name: friend.name?.trim() || emailToFallbackName(email),
          avatar_url: profileAvatarByEmail.get(email) || friend.avatar_url || null,
          source: 'pallinky',
          total_hangouts: friend.total_hangouts || 0,
          device_contact_id: null,
          phone_e164: null,
          matched_user_id: null,
          person_id: null,
        });
      });

    deviceContacts
      .filter((contact) => {
        const cleanEmail = normalizeEmail(contact.email_lc);
        const cleanPhone = normalizePhone(contact.phone_e164);
        const matchedId = contact.matched_user_id || contact.matched_profile_id || '';
        const isSelf = cleanEmail !== '' && cleanEmail === userEmail;

        if (isSelf) return false;
        if (!cleanEmail && !cleanPhone) return false;
        if (cleanEmail && hiddenEmailSet.has(cleanEmail)) return false;
        if (cleanPhone && hiddenPhoneSet.has(cleanPhone)) return false;
        if (matchedId && hiddenMatchedUserIdSet.has(matchedId)) return false;

        return true;
      })
      .forEach((contact) => {
        const email = normalizeEmail(contact.email_lc) || null;
        const phone = normalizePhone(contact.phone_e164) || null;
        if (!email && !phone) return;

        const looksLikeUser = Boolean(
          contact.is_user || contact.matched_user_id || contact.matched_profile_id,
        );

        const existing = email ? personMap.get(`email:${email}`) : null;

        if (existing) {
          const mergedDeviceContactId = contact.device_contact_id || existing.device_contact_id;
          const mergedPhone = phone || existing.phone_e164;
          const mergedEmail = existing.email_lc || email;
          const mergedSelectionId = getSelectionId({
            device_contact_id: mergedDeviceContactId,
            phone_e164: mergedPhone,
            email_lc: mergedEmail,
          });

          personMap.set(`email:${mergedEmail}`, {
            ...existing,
            key: `email:${mergedEmail}`,
            selection_id: mergedSelectionId,
            email_lc: mergedEmail,
            name:
              contact.display_name?.trim() ||
              contact.name?.trim() ||
              existing.name ||
              (mergedEmail
                ? emailToFallbackName(mergedEmail)
                : phoneToFallbackName(mergedPhone || '')),
            avatar_url:
              profileAvatarById.get(contact.matched_user_id || contact.matched_profile_id || '') ||
              (mergedEmail ? profileAvatarByEmail.get(mergedEmail) : null) ||
              existing.avatar_url ||
              contact.avatar_url ||
              contact.avatar_uri ||
              null,
            source: existing.source === 'pallinky' || looksLikeUser ? 'pallinky' : 'contact',
            total_hangouts: existing.total_hangouts,
            device_contact_id: mergedDeviceContactId,
            phone_e164: mergedPhone,
            matched_user_id:
              contact.matched_user_id || contact.matched_profile_id || existing.matched_user_id,
            person_id: contact.person_id || existing.person_id,
          });
          return;
        }

        const selectionId = getSelectionId({
          device_contact_id: contact.device_contact_id,
          phone_e164: phone,
          email_lc: email,
        });

        const key = email
          ? `email:${email}`
          : contact.device_contact_id
            ? `device:${contact.device_contact_id}`
            : phone
              ? `phone:${phone}`
              : `contact:${Math.random().toString(36).slice(2)}`;

        personMap.set(key, {
          key,
          selection_id: selectionId,
          email_lc: email,
          name:
            contact.display_name?.trim() ||
            contact.name?.trim() ||
            (email ? emailToFallbackName(email) : phoneToFallbackName(phone || '')),
          avatar_url:
            profileAvatarById.get(contact.matched_user_id || contact.matched_profile_id || '') ||
            (email ? profileAvatarByEmail.get(email) : null) ||
            contact.avatar_url ||
            contact.avatar_uri ||
            null,
          source: looksLikeUser ? 'pallinky' : 'contact',
          total_hangouts: 0,
          device_contact_id: contact.device_contact_id || null,
          phone_e164: phone,
          matched_user_id: contact.matched_user_id || contact.matched_profile_id || null,
          person_id: contact.person_id || null,
        });
      });

    return Array.from(personMap.values()).sort((a, b) => {
      if (a.source !== b.source) return a.source === 'pallinky' ? -1 : 1;
      if (b.total_hangouts !== a.total_hangouts) return b.total_hangouts - a.total_hangouts;
      return a.name.localeCompare(b.name);
    });
  }

  async function openPeoplePicker() {
    if (!activeCircle) return;

    setSelectedPersonIds([]);
    setPeopleSearch('');
    setAvailablePeople([]);
    setScreen('chooseMembers');
    setPeopleLoading(true);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const userEmail = normalizeEmail(session?.user?.email);
      if (!userEmail) throw new Error('Please sign in first.');

      const [predictedRes, deviceContactsRes, hiddenRes] = await Promise.all([
        supabase
          .from('predicted_circles')
          .select('name, email_lc, total_hangouts, avatar_url')
          .neq('email_lc', userEmail)
          .order('total_hangouts', { ascending: false }),
        supabase.rpc('get_my_device_contacts'),
        supabase
          .from('hidden_people')
          .select('email_lc, phone_e164, matched_user_id')
          .eq('user_id', userId),
      ]);

      if (predictedRes.error) throw predictedRes.error;
      if (deviceContactsRes.error) throw deviceContactsRes.error;
      if (hiddenRes.error) throw hiddenRes.error;

      const predictedFriends = (predictedRes.data as PredictedFriend[]) || [];
      const deviceContacts = (deviceContactsRes.data as DeviceContactRow[]) || [];
      const hiddenRows = (hiddenRes.data as HiddenPersonRow[]) || [];

      const profileEmailSet = new Set<string>();
      const profileIdSet = new Set<string>();

      predictedFriends.forEach((friend) => {
        const email = normalizeEmail(friend.email_lc);
        if (email) profileEmailSet.add(email);
      });

      deviceContacts.forEach((contact) => {
        const email = normalizeEmail(contact.email_lc);
        const matchedId = contact.matched_user_id || contact.matched_profile_id || '';
        if (email) profileEmailSet.add(email);
        if (matchedId) profileIdSet.add(matchedId);
      });

      let profileRows: ProfileAvatarRow[] = [];
      if (profileEmailSet.size || profileIdSet.size) {
        let profileQuery = supabase.from('profiles').select('id, email_lc, avatar_url');

        if (profileEmailSet.size && profileIdSet.size) {
          profileQuery = profileQuery.or(
            `email_lc.in.(${Array.from(profileEmailSet).join(',')}),id.in.(${Array.from(profileIdSet).join(',')})`,
          );
        } else if (profileEmailSet.size) {
          profileQuery = profileQuery.in('email_lc', Array.from(profileEmailSet));
        } else {
          profileQuery = profileQuery.in('id', Array.from(profileIdSet));
        }

        const { data: profilesRes, error: profilesError } = await profileQuery;
        if (profilesError) throw profilesError;
        profileRows = (profilesRes as ProfileAvatarRow[]) || [];
      }

      const mergedPeople = buildMergedPeople(
        predictedFriends,
        deviceContacts,
        profileRows,
        hiddenRows,
        userEmail,
      );

      const existingMemberKeys = new Set(
        activeCircle.members.flatMap((member) => {
          const email = normalizeEmail(member.member_email_lc);
          const phone = normalizePhone(member.member_phone_e164);
          const personId = member.person_id || '';

          return [
            email ? `email:${email}` : '',
            phone ? `phone:${phone}` : '',
            personId ? `person:${personId}` : '',
          ].filter(Boolean);
        }),
      );

      const available = mergedPeople.filter((person) => {
        const emailKey = person.email_lc ? `email:${normalizeEmail(person.email_lc)}` : '';
        const phoneKey = person.phone_e164 ? `phone:${normalizePhone(person.phone_e164)}` : '';
        const personKey = person.person_id ? `person:${person.person_id}` : '';

        return ![emailKey, phoneKey, personKey].some((key) => key && existingMemberKeys.has(key));
      });

      setAvailablePeople(available);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Could not load people.');
      setAvailablePeople([]);
    } finally {
      setPeopleLoading(false);
    }
  }

  function togglePickedPerson(selectionId: string) {
    setSelectedPersonIds((prev) =>
      prev.includes(selectionId)
        ? prev.filter((item) => item !== selectionId)
        : [...prev, selectionId],
    );
  }

  async function handleAddSelectedPeopleToCircle() {
    if (!activeCircle) return;
    if (!selectedPersonIds.length) {
      Alert.alert('Select at least one person.');
      return;
    }

    setCircleSaving(true);

    try {
      const selectedPeople = availablePeople.filter((person) =>
        selectedPersonIds.includes(person.selection_id),
      );

      let nextCircle = activeCircle;

      for (const person of selectedPeople) {
        const nextMember = await addMemberToCircle({
          circle: nextCircle,
          member_name: person.name?.trim() || null,
          member_email_lc: normalizeEmail(person.email_lc),
          member_phone_e164: normalizePhone(person.phone_e164),
        });

        nextCircle = {
          ...nextCircle,
          members: [...nextCircle.members, nextMember],
        };
      }

      setCircles((prev) =>
        prev.map((circle) => (circle.id === activeCircle.id ? nextCircle : circle)),
      );
      setActiveCircle(nextCircle);
      setSelectedPersonIds([]);
      setPeopleSearch('');
      setAvailablePeople([]);
      setScreen('manage');
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Could not add members.');
    } finally {
      setCircleSaving(false);
    }
  }

  function handleRequestClose() {
    if (screen === 'chooseMembers') {
      setScreen('manage');
      return;
    }
    onClose();
  }

  const headerTitle =
    screen === 'chooseMembers'
      ? 'Choose members'
      : manageMode === 'create'
        ? 'New Circle'
        : 'Manage Circle';

  const leftActionLabel = screen === 'chooseMembers' ? 'Back' : 'Close';

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleRequestClose}
    >
      <SafeAreaView style={styles.modalWrap}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={handleRequestClose}>
            <StyledText style={styles.modalHeaderAction}>{leftActionLabel}</StyledText>
          </TouchableOpacity>

          <StyledText style={styles.modalTitle}>{headerTitle}</StyledText>

          {screen === 'chooseMembers' ? (
            <TouchableOpacity
              onPress={handleAddSelectedPeopleToCircle}
              disabled={circleSaving || !selectedPersonIds.length}
            >
              <StyledText
                style={[
                  styles.modalHeaderAction,
                  (!selectedPersonIds.length || circleSaving) && styles.headerActionDisabled,
                ]}
              >
                Add
              </StyledText>
            </TouchableOpacity>
          ) : (
            <View style={styles.headerSpacer} />
          )}
        </View>

        {screen === 'manage' ? (
          <ScrollView contentContainerStyle={styles.manageContent}>
            <View style={styles.manageCard}>
              <StyledText style={styles.manageLabel}>
                {manageMode === 'create' ? 'Circle name' : 'Rename circle'}
              </StyledText>

              <TextInput
                value={circleNameValue}
                onChangeText={setCircleNameValue}
                placeholder="Besties, Book Club, Work Crew"
                placeholderTextColor={COLORS.textMuted}
                style={styles.manageInput}
              />

              <TouchableOpacity
                style={[styles.primaryButton, circleSaving && styles.buttonDisabled]}
                onPress={manageMode === 'create' ? handleCreateCircle : handleRenameCircle}
                disabled={circleSaving}
              >
                <StyledText style={styles.primaryButtonText}>
                  {manageMode === 'create' ? 'Create circle' : 'Save name'}
                </StyledText>
              </TouchableOpacity>
            </View>

            {manageMode === 'edit' && activeCircle && (
              <>
                <View style={styles.manageCard}>
                  <View style={styles.manageCardHeaderRow}>
                    <StyledText style={styles.manageLabel}>Members</StyledText>
                    <StyledText style={styles.manageMetaCount}>
                      {activeCircle.members.length}
                    </StyledText>
                  </View>

                  {activeCircle.members.length === 0 ? (
                    <StyledText style={styles.emptyText}>No members in this circle yet.</StyledText>
                  ) : (
                    activeCircle.members.map((member) => (
                      <View key={member.id} style={styles.memberRow}>
                        <View style={styles.memberAvatar}>
                          <StyledText style={styles.memberAvatarText}>
                            {initialsFor(
                              member.member_name ||
                                member.member_email_lc ||
                                member.member_phone_e164,
                            )}
                          </StyledText>
                        </View>

                        <View style={styles.memberTextWrap}>
                          <StyledText style={styles.memberName}>
                            {member.member_name ||
                              member.member_email_lc ||
                              member.member_phone_e164 ||
                              'Unnamed member'}
                          </StyledText>

                          {!!member.member_email_lc && (
                            <StyledText style={styles.memberMeta}>
                              {member.member_email_lc}
                            </StyledText>
                          )}

                          {!!member.member_phone_e164 && (
                            <StyledText style={styles.memberMeta}>
                              {member.member_phone_e164}
                            </StyledText>
                          )}
                        </View>

                        <TouchableOpacity
                          style={styles.memberRemoveButton}
                          onPress={() => handleRemoveCircleMember(member)}
                        >
                          <Ionicons name="trash-outline" size={18} color={COLORS.danger} />
                        </TouchableOpacity>
                      </View>
                    ))
                  )}
                </View>

                <View style={styles.manageCard}>
                  <StyledText style={styles.manageLabel}>Add member</StyledText>

                  <TouchableOpacity
                    style={styles.secondaryButtonFull}
                    onPress={openPeoplePicker}
                  >
                    <StyledText style={styles.secondaryButtonText}>
                      Choose members
                    </StyledText>
                  </TouchableOpacity>

                  
                </View>

                <View style={styles.manageCard}>
                  
                </View>
              </>
            )}
          </ScrollView>
        ) : (
          <View style={styles.modalContent}>
            <View style={styles.searchWrapModal}>
              <Ionicons name="search" size={18} color={COLORS.textMuted} />
              <TextInput
                value={peopleSearch}
                onChangeText={setPeopleSearch}
                placeholder="Search people"
                placeholderTextColor={COLORS.textMuted}
                style={styles.searchInput}
              />
            </View>

            <StyledText style={styles.modalSummary}>
              {selectedPersonIds.length} selected
            </StyledText>

            {peopleLoading ? (
              <View style={styles.stateWrap}>
                <ActivityIndicator color={COLORS.primary} />
              </View>
            ) : (
              <ScrollView contentContainerStyle={styles.modalListContent}>
                {filteredPeople.map((person) => {
                  const isSelected = selectedPersonIds.includes(person.selection_id);

                  return (
                    <TouchableOpacity
                      key={person.key}
                      style={styles.contactRow}
                      onPress={() => togglePickedPerson(person.selection_id)}
                    >
                      <View style={styles.contactAvatar}>
                        <StyledText style={styles.contactAvatarText}>
                          {initialsFor(person.name)}
                        </StyledText>
                      </View>

                      <View style={styles.contactMain}>
                        <StyledText style={styles.contactName}>{person.name}</StyledText>
                        {!!person.email_lc && (
                          <StyledText style={styles.contactMeta}>{person.email_lc}</StyledText>
                        )}
                        {!!person.phone_e164 && (
                          <StyledText style={styles.contactMeta}>{person.phone_e164}</StyledText>
                        )}
                      </View>

                      <Ionicons
                        name={isSelected ? 'checkbox' : 'square-outline'}
                        size={22}
                        color={isSelected ? COLORS.primary : '#b0b7c3'}
                      />
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalWrap: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  modalHeader: {
    paddingHorizontal: 20,
    paddingTop: 6,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalHeaderAction: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.primary,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: COLORS.text,
  },
  headerSpacer: {
    width: 36,
  },
  manageContent: {
    paddingHorizontal: 20,
    paddingBottom: 36,
  },
  manageCard: {
    marginBottom: 14,
    padding: 16,
    borderRadius: 22,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.borderSoft,
  },
  manageLabel: {
    fontSize: 15,
    fontWeight: '900',
    color: COLORS.text,
    marginBottom: 10,
  },
  manageInput: {
    borderWidth: 1,
    borderColor: COLORS.borderSoft,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 15,
    color: COLORS.text,
    backgroundColor: COLORS.surfaceAlt,
    marginBottom: 10,
  },
  primaryButton: {
    minHeight: 46,
    borderRadius: 14,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    marginTop: 2,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontWeight: '900',
    fontSize: 15,
  },
  secondaryButtonFull: {
    minHeight: 46,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    marginTop: 10,
    marginBottom: 10,
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.text,
  },
  secondaryDangerButtonFull: {
    minHeight: 46,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#efc9c9',
    backgroundColor: COLORS.dangerBg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    marginTop: 10,
  },
  secondaryDangerButtonText: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.danger,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  manageCardHeaderRow: {
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  manageMetaCount: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.textMuted,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderSoft,
  },
  memberAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: COLORS.secondaryBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  memberAvatarText: {
    fontSize: 12,
    fontWeight: '900',
    color: COLORS.secondary,
  },
  memberTextWrap: {
    flex: 1,
    paddingRight: 10,
  },
  memberName: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.text,
  },
  memberMeta: {
    marginTop: 2,
    fontSize: 12,
    color: COLORS.textMuted,
  },
  memberRemoveButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: COLORS.dangerBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  searchWrapModal: {
    marginBottom: 10,
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    paddingHorizontal: 14,
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: COLORS.borderSoft,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: COLORS.text,
  },
  modalSummary: {
    marginBottom: 10,
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.textMuted,
  },
  stateWrap: {
    paddingVertical: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalListContent: {
    paddingBottom: 24,
  },
  contactRow: {
    backgroundColor: COLORS.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.borderSoft,
    paddingHorizontal: 14,
    paddingVertical: 13,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  contactAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.secondaryBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactAvatarText: {
    fontSize: 13,
    fontWeight: '900',
    color: COLORS.secondary,
  },
  contactMain: {
    flex: 1,
    minWidth: 0,
  },
  contactName: {
    fontSize: 15,
    fontWeight: '900',
    color: COLORS.text,
  },
  contactMeta: {
    marginTop: 2,
    fontSize: 12,
    color: COLORS.textMuted,
  },
  headerActionDisabled: {
    opacity: 0.35,
  },
  emptyText: {
    fontSize: 14,
    color: COLORS.textMuted,
    lineHeight: 20,
    paddingBottom: 4,
  },
});