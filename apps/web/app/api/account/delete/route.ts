/**
 * Path: apps/web/app/api/account/delete/route.ts
 * Description: Authenticated account-deletion endpoint for mobile/web clients.
 * Verifies the caller from the bearer token, verifies admin access first,
 * then runs DB cleanup, then deletes the auth user.
 */

export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL;

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error("Missing Supabase admin env");
  }

  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false },
  });
}

function getSupabaseUserClient(authHeader: string) {
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error("Missing Supabase anon env");
  }

  return createClient(url, anonKey, {
    auth: { persistSession: false },
    global: {
      headers: {
        Authorization: authHeader,
      },
    },
  });
}

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get("authorization");

    if (!authHeader || !authHeader.toLowerCase().startsWith("bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabaseUser = getSupabaseUserClient(authHeader);
    const supabaseAdmin = getSupabaseAdmin();

    const {
      data: { user },
      error: userError,
    } = await supabaseUser.auth.getUser();

    if (userError || !user?.id || !user?.email) {
      return NextResponse.json(
        {
          error: "Unauthorized",
          details: userError?.message || "No authenticated user",
        },
        { status: 401 }
      );
    }

    // Verify the admin client can actually see this auth user BEFORE cleanup.
    const { data: adminLookup, error: adminLookupError } =
      await supabaseAdmin.auth.admin.getUserById(user.id);

    if (adminLookupError || !adminLookup?.user?.id) {
  return NextResponse.json(
    {
      error: "Admin lookup failed",
      details: adminLookupError?.message || "Admin client cannot access auth user",
      user_id: user.id,
      user_email: user.email,
    },
    { status: 500 }
  );
}

    const { error: cleanupError } = await supabaseUser.rpc(
      "delete_my_account_data"
    );

    if (cleanupError) {
      return NextResponse.json(
        {
          error: "Cleanup failed",
          details: cleanupError.message,
          user_id: user.id,
          user_email: user.email,
        },
        { status: 500 }
      );
    }

    const { data: deleteData, error: deleteUserError } =
  await supabaseAdmin.auth.admin.deleteUser(user.id);

if (deleteUserError) {
  return NextResponse.json(
    {
      error: "Auth deletion failed",
      details: deleteUserError.message,
      delete_data: deleteData ?? null,
      user_id: user.id,
      user_email: user.email,
    },
    { status: 500 }
  );
}

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json(
      {
        error: "Server error",
        details: error?.message || "Unknown error",
      },
      { status: 500 }
    );
  }
}
