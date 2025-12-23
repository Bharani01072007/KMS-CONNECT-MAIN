import { supabase } from "@/integrations/supabase/client";

interface NotifyInput {
  user_id: string;
  title: string;
  body: string;
  type: "leave" | "complaint" | "message";
  source_id: string;
}

export const createNotification = async ({
  user_id,
  title,
  body,
  type,
  source_id,
}: NotifyInput) => {
  await supabase.from("notifications").insert({
    user_id,
    title,
    body,
    meta: {
      type,
      source_id,
      label: title,
    },
  });
};
