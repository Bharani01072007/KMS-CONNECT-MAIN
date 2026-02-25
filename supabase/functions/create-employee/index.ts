import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }
  console.log("Avatar length:",avatar?avatar.length:0)
  try {
    const {
      email,
      password,
      full_name,
      site_id,
      designation,
      daily_wage,
      avatar,
    } = await req.json()

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    )

    // 1️⃣ Create Auth User
    const { data: userData, error: userError } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      })

    if (userError) {
      return new Response(
        JSON.stringify({ error: userError.message }),
        { status: 400, headers: corsHeaders }
      )
    }

    const userId = userData.user.id
    let avatarUrl: string | null = null

    // 2️⃣ Upload Avatar if provided
    if (avatar) {
      try {
        const base64 = avatar.split(",")[1]

        const byteCharacters = atob(base64)
        const byteNumbers = new Array(byteCharacters.length)

        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i)
        }

        const byteArray = new Uint8Array(byteNumbers)

        const filePath = `${userId}.png`

        const { error: uploadError } =
          await supabaseAdmin.storage
            .from("Avatars") // ✅ EXACT bucket name
            .upload(filePath, byteArray, {
              contentType: "image/png",
              upsert: true,
            })

        if (!uploadError) {
          console
          const { data } = supabaseAdmin.storage
            .from("Avatars") // ✅ EXACT bucket name
            .getPublicUrl(filePath)

          avatarUrl = data.publicUrl
        } else {
          console.log("Upload Error:", uploadError)
        }
      } catch (imgError) {
        console.log("Image processing error:", imgError)
      }
    }

    // 3️⃣ Insert Profile
    const { error: profileError } =
      await supabaseAdmin
        .from("profiles")
        .insert({
          auth_uid: userId,
          email,
          full_name,
          role: "employee",
          avatar_url: avatarUrl,
        })

    if (profileError) {
      return new Response(
        JSON.stringify({ error: profileError.message }),
        { status: 400, headers: corsHeaders }
      )
    }

    // 4️⃣ Insert Employee
    const { error: empError } =
      await supabaseAdmin
        .from("employees")
        .insert({
          user_id: userId,
          site_id,
          designation,
          daily_wage,
          active: true,
        })

    if (empError) {
      return new Response(
        JSON.stringify({ error: empError.message }),
        { status: 400, headers: corsHeaders }
      )
    }

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