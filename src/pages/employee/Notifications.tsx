import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Bell } from "lucide-react";
import { format } from "date-fns";

/* ===================== TYPES ===================== */

interface Notification {
  id: string;
  title: string | null;
  body: string | null;
  created_at: string | null;
  read: boolean | null;
}

/* ===================== COMPONENT ===================== */

const EmployeeNotifications = () => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    if (!user) return;

    fetchNotifications();

    /* ===================== REALTIME LISTENER ===================== */

    const channel = supabase
      .channel(`employee-notifications-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const newNotification: Notification = {
            id: payload.new.id,
            title: payload.new.title,
            body: payload.new.body,
            created_at: payload.new.created_at,
            read: payload.new.read,
          };

          setNotifications((prev) => [newNotification, ...prev]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  /* ===================== FETCH ===================== */

  const fetchNotifications = async () => {
    const { data } = await supabase
      .from("notifications")
      .select("id, title, body, created_at, read")
      .eq("user_id", user!.id)
      .order("created_at", { ascending: false });

    if (data) setNotifications(data);
  };

  /* ===================== MARK AS READ ===================== */

  const markAsRead = async (id: string) => {
    await supabase
      .from("notifications")
      .update({ read: true })
      .eq("id", id);

    setNotifications((prev) =>
      prev.map((n) =>
        n.id === id ? { ...n, read: true } : n
      )
    );
  };

  /* ===================== UI ===================== */

  return (
    <div className="min-h-screen bg-background">
      <Header title="Notifications" backTo="/employee/dashboard" />

      <main className="p-4 max-w-2xl mx-auto space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              All Notifications
            </CardTitle>
          </CardHeader>

          <CardContent>
            <div className="space-y-3">
              {notifications.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">
                  No notifications yet
                </p>
              ) : (
                notifications.map((notification) => (
                  <div
                    key={notification.id}
                    onClick={() =>
                      !notification.read &&
                      markAsRead(notification.id)
                    }
                    className={`p-4 rounded-lg cursor-pointer transition
                      ${
                        notification.read
                          ? "bg-muted/40"
                          : "bg-muted/50 border border-primary/40"
                      }
                    `}
                  >
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-lg bg-primary/10">
                        <Bell className="h-4 w-4 text-primary" />
                      </div>

                      <div className="flex-1">
                        {notification.title && (
                          <p className="font-medium text-sm">
                            {notification.title}
                          </p>
                        )}

                        <p className="text-sm text-muted-foreground">
                          {notification.body}
                        </p>

                        <div className="flex items-center gap-2 mt-2">
                          <p className="text-xs text-muted-foreground">
                            {notification.created_at
                              ? format(
                                  new Date(notification.created_at),
                                  "PPp"
                                )
                              : "Unknown date"}
                          </p>

                          {!notification.read && (
                            <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
                              New
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default EmployeeNotifications;