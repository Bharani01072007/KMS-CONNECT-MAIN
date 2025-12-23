import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Bell } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

/* ===================== TYPES ===================== */

interface Notification {
  id: string;
  title: string | null;
  body: string | null;
  read: boolean | null;
  created_at: string | null;
}

/* ===================== COMPONENT ===================== */

const AdminNotifications = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchNotifications();
  }, []);

  /* ===================== FETCH (DEDUPED ANNOUNCEMENTS) ===================== */

  const fetchNotifications = async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from("notifications")
      .select("id, title, body, read, created_at")
      .eq("title", "Announcement")
      .order("created_at", { ascending: false });

    if (!error && data) {
      // ✅ DEDUPLICATE SAME BODY
      const unique = Array.from(
        new Map(data.map(n => [n.body, n])).values()
      );
      setNotifications(unique);
    }

    setLoading(false);
  };

  /* ===================== UI ===================== */

  return (
    <div className="min-h-screen bg-background">
      <Header title="Announcements" backTo="/admin/dashboard" />

      <main className="p-4 max-w-4xl mx-auto space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Announcement History</CardTitle>
          </CardHeader>

          <CardContent className="space-y-3">
            {loading && (
              <p className="text-sm text-muted-foreground text-center">
                Loading announcements...
              </p>
            )}

            {!loading && notifications.length === 0 && (
              <div className="text-center py-8 space-y-2">
                <Bell className="h-10 w-10 mx-auto text-muted-foreground" />
                <p className="font-medium">No announcements yet</p>
              </div>
            )}

            {!loading &&
              notifications.map(n => (
                <div
                  key={n.id}
                  className="p-3 rounded-lg border flex gap-3 bg-muted"
                >
                  <Bell className="h-4 w-4 text-blue-600 mt-1" />
                  <div className="flex-1">
                    <div className="flex justify-between">
                      <p className="font-semibold">Announcement</p>
                      {n.created_at && (
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(n.created_at), {
                            addSuffix: true,
                          })}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {n.body}
                    </p>
                  </div>
                </div>
              ))}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default AdminNotifications;