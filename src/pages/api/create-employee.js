import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" })
  }

  try {
    const {
      email,
      password,
      full_name,
      site_id,
      designation,
      daily_wage,
    } = req.body

    // 1️⃣ Create Auth User
    const { data: userData, error: authError } =
      await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      })

    if (authError) {
      return res.status(400).json({ error: authError.message })
    }

    const userId = userData.user.id

    // 2️⃣ Insert Profile
    await supabase.from("profiles").insert({
      auth_uid: userId,
      email,
      full_name,
      role: "employee",
    })

    // 3️⃣ Insert Employee
    await supabase.from("employees").insert({
      user_id: userId,
      site_id,
      designation,
      daily_wage,
      active: true,
    })

    return res.status(200).json({ success: true })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}