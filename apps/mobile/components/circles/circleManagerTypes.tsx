/**
 * Path: apps/mobile/components/circles/circleManagerTypes.ts
 * Description: Shared type definitions for Circle Manager.
 * Extracted from share-picker to support reusable circle management UI and logic.
 */

export type PersonSource = 'pallinky' | 'contact' | 'host_manual';

export interface DeviceContactRow {
  id?: string | null;
  device_contact_id?: string | null;
  display_name?: string | null;
  name?: string | null;
  email_lc?: string | null;
  phone_e164?: string | null;
  matched_user_id?: string | null;
  matched_profile_id?: string | null;
  is_user?: boolean | null;
  avatar_url?: string | null;
  avatar_uri?: string | null;
  person_id?: string | null;
}

export interface CircleRow {
  id: string;
  circle_name: string;
  created_at?: string | null;
}

export interface CircleMemberRow {
  id: string;
  circle_id: string;
  member_name: string | null;
  member_email_lc: string | null;
  member_phone_e164?: string | null;
  member_user_id?: string | null;
  sort_order?: number | null;
  created_at?: string | null;
  device_contact_id?: string | null;
  person_id?: string | null;
}

export interface Circle {
  id: string;
  circle_name: string;
  created_at?: string | null;
  members: CircleMemberRow[];
}
export type RawDeviceContact = {
  id: string;
  displayName: string;
  firstName?: string | null;
  lastName?: string | null;
  phoneNumbers: string[];
  primaryPhone?: string | null;
};