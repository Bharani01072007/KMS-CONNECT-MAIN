import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const { user_id } = await req.json()

    if (!user_id) {
      return new Response(
        JSON.stringify({ error: "User ID required" }),
        { status: 400, headers: corsHeaders }
      )
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    )

    // 1️⃣ Delete Avatar from Storage (if exists)
    await supabaseAdmin.storage
      .from("Avatars") // ⚠ match your bucket name exactly
      .remove([`${user_id}.png`])

    // 2️⃣ Delete employee row
    await supabaseAdmin
      .from("employees")
      .delete()
      .eq("user_id", user_id)

    // 3️⃣ Delete profile row
    await supabaseAdmin
      .from("profiles")
      .delete()
      .eq("auth_uid", user_id)

    // 4️⃣ Delete Auth user
    await supabaseAdmin.auth.admin.deleteUser(user_id)

    return new Response(
      JSON.stringify({ success: true }),
      { headers: corsHeaders }
    )

  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: corsHeaders }
    )
  }
})