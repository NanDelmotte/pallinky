/** * Path: packages/core/src/auth.ts 
 * Description: Core Auth helpers. Fixed redirect scheme for mobile.
 */
import { supabase } from './supabase';

export const sendMagicLink = async (email: string, slug: string, isWeb: boolean = true) => {
  try {
    const cleanEmail = email.toLowerCase().trim();

    // Use the custom scheme for mobile to ensure the app re-opens from the email link
    const baseUrl = isWeb ? 'https://pallinky.com' : 'pallinky://';
    const redirectTo = isWeb 
      ? `${baseUrl}/auth/callback?next=/e/${slug}`
      : `${baseUrl}auth/callback?next=/e/${slug}`;

    const { error } = await supabase.auth.signInWithOtp({
      email: cleanEmail,
      options: {
        emailRedirectTo: redirectTo,
      },
    });

    if (error) throw error;
    return { success: true };
  } catch (err) {
    console.error('Auth Error (sendMagicLink):', err);
    throw err;
  }
};

export const getCurrentSession = async () => {
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) return null;
    return session;
  } catch (err) {
    return null;
  }
};

export const getUserProfile = async () => {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user) return null;

    const { data, error } = await supabase
      .from('profiles')
      .select('id, email_lc, full_name, avatar_url')
      .eq('id', session.user.id)
      .maybeSingle();

    if (error) throw error;
    return data;
  } catch (err) {
    console.error('Auth Error (getUserProfile):', err);
    return null;
  }
};

export const signOut = async () => {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    return { success: true };
  } catch (err) {
    console.error('Auth Error (signOut):', err);
    throw err;
  }
};