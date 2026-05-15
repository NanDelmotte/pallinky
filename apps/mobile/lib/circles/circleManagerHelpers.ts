/**
 * Path: apps/mobile/lib/circles/circleManagerHelpers.ts
 * Description: Shared helper functions for circle CRUD and member management.
 * Extracted from share-picker to centralize Supabase interactions.
 */

import { supabase } from '@pallinky/core';
import {
  Circle,
  CircleMemberRow,
  DeviceContactRow,
} from '../../components/circles/circleManagerTypes';

function normalizeEmail(value: string | null | undefined) {
  return value?.toLowerCase().trim() || null;
}

function normalizePhone(value: string | null | undefined) {
  if (!value) return null;
  return value.trim().replace(/[\s\-()]/g, '') || null;
}

export async function createCircle(userId: string, name: string): Promise<Circle> {
  const { data, error } = await supabase
    .from('social_circles')
    .insert({
      user_id: userId,
      circle_name: name,
      members: [],
    })
    .select('id, circle_name, created_at')
    .single();

  if (error) throw error;

  return {
    id: data.id,
    circle_name: data.circle_name,
    created_at: data.created_at || null,
    members: [],
  };
}

export async function renameCircle(circleId: string, name: string) {
  const { error } = await supabase
    .from('social_circles')
    .update({ circle_name: name })
    .eq('id', circleId);

  if (error) throw error;
}

export async function deleteCircle(circleId: string) {
  const { error: membersError } = await supabase
    .from('social_circle_members')
    .delete()
    .eq('circle_id', circleId);

  if (membersError) throw membersError;

  const { error: circleError } = await supabase
    .from('social_circles')
    .delete()
    .eq('id', circleId);

  if (circleError) throw circleError;
}

export async function addMemberToCircle(params: {
  circle: Circle;
  member_name: string | null;
  member_email_lc: string | null;
  member_phone_e164: string | null;
}): Promise<CircleMemberRow> {
  const { circle, member_name, member_email_lc, member_phone_e164 } = params;

  let member_user_id: string | null = null;

  if (member_email_lc) {
    const { data: profileRow, error } = await supabase
      .from('profiles')
      .select('id')
      .eq('email_lc', member_email_lc)
      .maybeSingle();

    if (error) throw error;
    member_user_id = profileRow?.id || null;
  }

  const { data: personId, error: personError } = await supabase.rpc(
    'resolve_or_create_person',
    {
      p_email_lc: member_email_lc,
      p_phone_e164: member_phone_e164,
      p_matched_user_id: member_user_id,
    },
  );

  if (personError) throw personError;

  const nextSortOrder =
    circle.members.reduce((max, item) => Math.max(max, item.sort_order ?? 0), 0) + 1;

  const { data, error } = await supabase
    .from('social_circle_members')
    .insert({
      circle_id: circle.id,
      member_name,
      member_email_lc,
      member_phone_e164,
      member_user_id,
      person_id: personId,
      sort_order: nextSortOrder,
    })
    .select(
      'id, circle_id, member_name, member_email_lc, member_phone_e164, member_user_id, sort_order, created_at, device_contact_id, person_id',
    )
    .single();

  if (error) throw error;

  return data as CircleMemberRow;
}

export async function removeMember(memberId: string) {
  const { error } = await supabase
    .from('social_circle_members')
    .delete()
    .eq('id', memberId);

  if (error) throw error;
}

export async function loadUploadedContacts(): Promise<DeviceContactRow[]> {
  const { data, error } = await supabase.rpc('get_my_device_contacts');
  if (error) throw error;

  return ((data as DeviceContactRow[]) || []).filter(
    (c) => Boolean(c?.id) && Boolean(c.email_lc || c.phone_e164),
  );
}

export async function addUploadedContactsToCircle(circleId: string, contactIds: string[]) {
  const { error } = await supabase.rpc('add_device_contacts_to_circle', {
    p_circle_id: circleId,
    p_contact_ids: contactIds,
  });

  if (error) throw error;
}
import type { RawDeviceContact } from '../../components/circles/circleManagerTypes';

export async function addRawDeviceContactsToCircle(
  circle: Circle,
  contacts: RawDeviceContact[],
): Promise<{ added: number; skipped: number }> {
  let added = 0;
  let skipped = 0;

  const existingPhones = new Set(
    circle.members
      .map((m) => normalizePhone(m.member_phone_e164))
      .filter(Boolean),
  );

  const seenPhones = new Set<string>();

  for (const contact of contacts) {
    const primary =
      normalizePhone(contact.primaryPhone) ||
      normalizePhone(contact.phoneNumbers?.[0]);

    if (!primary) {
      skipped++;
      continue;
    }

    if (existingPhones.has(primary) || seenPhones.has(primary)) {
      skipped++;
      continue;
    }

    try {
      await addMemberToCircle({
        circle,
        member_name: contact.displayName || null,
        member_email_lc: null,
        member_phone_e164: primary,
      });

      seenPhones.add(primary);
      added++;
    } catch {
      skipped++;
    }
  }

  return { added, skipped };
}