import { supabase } from '../supabase';

export type EventHostLookup = {
  host_email: string | null;
};

export async function getEventHostBySlug(slug: string): Promise<EventHostLookup | null> {
  const cleanSlug = slug?.trim();

  if (!cleanSlug) return null;

  const { data, error } = await supabase
    .from('events')
    .select('host_email')
    .eq('slug', cleanSlug)
    .single();

  if (error) {
    throw error;
  }

  return {
    host_email: data?.host_email?.toLowerCase().trim() ?? null,
  };
}