/**
 * Path: supabase/functions/admin-delete-user/index.ts
 * Description: Admin-only account deletion for removing another user from the dashboard.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.97.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

function getRequiredEnv(name: string) {
  const value = Deno.env.get(name);

  if (!value) {
    throw new Error(`Missing ${name}`);
  }

  return value;
}

function getAdminEmails() {
  return (Deno.env.get('ADMIN_EMAILS') || 'nanbowles@gmail.com')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  try {
    const authHeader = request.headers.get('Authorization');

    if (!authHeader?.toLowerCase().startsWith('bearer ')) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    const body = await request.json().catch(() => null);
    const targetUserId =
      typeof body?.target_user_id === 'string'
        ? body.target_user_id.trim()
        : '';

    if (!targetUserId) {
      return jsonResponse({ error: 'Missing target_user_id' }, 400);
    }

    const supabaseUrl = getRequiredEnv('SUPABASE_URL');
    const supabaseAnonKey = getRequiredEnv('SUPABASE_ANON_KEY');
    const serviceRoleKey = getRequiredEnv('SUPABASE_SERVICE_ROLE_KEY');

    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false },
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    });

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const {
      data: { user: requester },
      error: requesterError,
    } = await supabaseUser.auth.getUser();

    if (requesterError || !requester?.id || !requester?.email) {
      return jsonResponse(
        {
          error: 'Unauthorized',
          details: requesterError?.message || 'No authenticated user',
        },
        401,
      );
    }

    const requesterEmail = requester.email.trim().toLowerCase();

    if (!getAdminEmails().includes(requesterEmail)) {
      return jsonResponse({ error: 'Admin access only' }, 403);
    }

    if (requester.id === targetUserId) {
      return jsonResponse(
        { error: 'Use account settings to delete your own account.' },
        400,
      );
    }

    const { data: cleanupData, error: cleanupError } =
      await supabaseAdmin.rpc('admin_delete_user_account', {
        p_target_user_id: targetUserId,
      });

    if (cleanupError) {
      return jsonResponse(
        {
          error: 'Cleanup failed',
          details: cleanupError.message,
          user_id: targetUserId,
        },
        500,
      );
    }

    const { data: targetLookup, error: targetLookupError } =
      await supabaseAdmin.auth.admin.getUserById(targetUserId);

    const authUserExists = Boolean(targetLookup?.user?.id);
    const missingAuthUser =
      targetLookupError &&
      ((targetLookupError as { status?: number }).status === 404 ||
        targetLookupError.message.toLowerCase().includes('not found'));

    if (targetLookupError && !missingAuthUser) {
      return jsonResponse(
        {
          error: 'Admin lookup failed',
          details: targetLookupError.message,
          user_id: targetUserId,
        },
        500,
      );
    }

    if (authUserExists) {
      const { error: deleteUserError } =
        await supabaseAdmin.auth.admin.deleteUser(targetUserId);

      if (deleteUserError) {
        return jsonResponse(
          {
            error: 'Auth deletion failed',
            details: deleteUserError.message,
            user_id: targetUserId,
          },
          500,
        );
      }
    }

    return jsonResponse({
      ok: true,
      auth_deleted: authUserExists,
      cleanup: cleanupData ?? null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';

    return jsonResponse(
      {
        error: 'Server error',
        details: message,
      },
      500,
    );
  }
});
