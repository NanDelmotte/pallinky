/**
 * Path: supabase/functions/delete-account/index.ts
 * Description: Deletes the authenticated user's account in the Supabase project that issued the JWT.
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
      data: { user },
      error: userError,
    } = await supabaseUser.auth.getUser();

    if (userError || !user?.id || !user?.email) {
      return jsonResponse(
        {
          error: 'Unauthorized',
          details: userError?.message || 'No authenticated user',
        },
        401,
      );
    }

    const { data: adminLookup, error: adminLookupError } =
      await supabaseAdmin.auth.admin.getUserById(user.id);

    if (adminLookupError || !adminLookup?.user?.id) {
      return jsonResponse(
        {
          error: 'Admin lookup failed',
          details:
            adminLookupError?.message || 'Admin client cannot access auth user',
        },
        500,
      );
    }

    const { error: cleanupError } = await supabaseUser.rpc(
      'delete_my_account_data',
    );

    if (cleanupError) {
      return jsonResponse(
        {
          error: 'Cleanup failed',
          details: cleanupError.message,
        },
        500,
      );
    }

    const { error: deleteUserError } =
      await supabaseAdmin.auth.admin.deleteUser(user.id);

    if (deleteUserError) {
      return jsonResponse(
        {
          error: 'Auth deletion failed',
          details: deleteUserError.message,
        },
        500,
      );
    }

    return jsonResponse({ ok: true });
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
