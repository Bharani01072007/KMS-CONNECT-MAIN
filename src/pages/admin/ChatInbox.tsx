import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { MessageSquare, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { getThreadId } from "@/lib/thread";

/* ===================== TYPES ===================== */

interface EmployeeWithMessage {
  user_id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  last_message: string | null;
  last_message_time: string | null;
  last_message_sender_id: string | null;
}

interface MessageRow {
  sender_id: string;
  recipient_id: string;
  content: string;
  created_at: string;
  thread_id: string;
}

/* ===================== COMPONENT ===================== */

const AdminChatInbox = () => {
  const navigate = useNavigate();

  const [employees, setEmployees] = useState<EmployeeWithMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [adminId, setAdminId] = useState<string | null>(null);

  const channelRef = useRef<any>(null);

  useEffect(() => {
    init();

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, []);

  /* ===================== INIT ===================== */

  const init = async () => {
    const { data } = await supabase.auth.getUser();
    const uid = data.user?.id || null;

    setAdminId(uid);
    await loadInbox(uid);

    if (uid) subscribeRealtime(uid);
  };

  /* ===================== LOAD INBOX ===================== */

  const loadInbox = async (adminUserId: string | null) => {
    if (!adminUserId) return;

    setLoading(true);

    try {
      const { data: empData } = await supabase
        .from("employee_directory")
        .select("user_id, full_name, email, avatar_url")
        .eq("role", "employee");

      const { data: messages } = await supabase
        .from("messages")
        .select("sender_id, recipient_id, content, created_at,thread_id")
        .order("created_at", { ascending: false });

      const inbox: EmployeeWithMessage[] =
        empData?.map(emp => {
          const threadId = getThreadId(adminUserId, emp.user_id);
          const related =
            messages?.filter(
              m =>
                m.thread_id === threadId) || [];

          const last = related[0];

          return {
            user_id: emp.user_id,
            full_name: emp.full_name,
            email: emp.email,
            avatar_url: emp.avatar_url,
            last_message: last?.content || null,
            last_message_time: last?.created_at || null,
            last_message_sender_id: last?.sender_id || null,
          };
        }) || [];

      inbox.sort((a, b) => {
        if (!a.last_message_time && !b.last_message_time) return 0;
        if (!a.last_message_time) return 1;
        if (!b.last_message_time) return -1;
        return (
          new Date(b.last_message_time).getTime() -
          new Date(a.last_message_time).getTime()
        );
      });

      setEmployees(inbox);
    } catch (err) {
      console.error("Inbox load failed:", err);
    } finally {
      setLoading(false);
    }
  };

  /* ===================== REALTIME SUBSCRIPTION ===================== */

  const subscribeRealtime = (adminUserId: string) => {
    channelRef.current = supabase
      .channel("admin-chat-inbox")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
        },
        payload => {
          const msg = payload.new as MessageRow;
          const otherUserId =
            msg.sender_id === adminUserId
              ? msg.recipient_id
              : msg.sender_id;
          const threadId = getThreadId(adminUserId, otherUserId);
          // Only react to messages related to admin
          if (msg.thread_id !== threadId) return;
          

          setEmployees(prev =>
            prev
              .map(emp => {
                if (
                  emp.user_id === msg.sender_id ||
                  emp.user_id === msg.recipient_id
                ) {
                  return {
                    ...emp,
                    last_message: msg.content,
                    last_message_time: msg.created_at,
                    last_message_sender_id: msg.sender_id,
                  };
                }
                return emp;
              })
              .sort((a, b) => {
                if (!a.last_message_time && !b.last_message_time) return 0;
                if (!a.last_message_time) return 1;
                if (!b.last_message_time) return -1;
                return (
                  new Date(b.last_message_time).getTime() -
                  new Date(a.last_message_time).getTime()
                );
              })
          );
        }
      )
      .subscribe();
  };

  /* ===================== UI ===================== */

  return (
    <div className="min-h-screen bg-background">
      <Header title="Chat Inbox" backTo="/admin/dashboard" />

      <main className="p-4 max-w-2xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              All Conversations
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-2">
            {loading && (
              <p className="text-center text-muted-foreground py-6">
                Loading conversations…
              </p>
            )}

            {!loading &&
              employees.map(emp => {
                const showRedDot =
                  emp.last_message_sender_id === emp.user_id;

                return (
                  <div
                    key={emp.user_id}
                    onClick={() =>
                      navigate(`/admin/chat/${emp.user_id}`)
                    }
                    className="flex items-center gap-3 p-3 rounded-lg cursor-pointer hover:bg-muted/50 transition"
                  >
                    <div className="relative">
                      <Avatar className="h-12 w-12">
                        <AvatarFallback>
                          {emp.full_name?.[0] || "E"}
                        </AvatarFallback>
                      </Avatar>

                      {showRedDot && (
                        <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-red-500" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between">
                        <p className="font-medium truncate">
                          {emp.full_name || emp.email}
                        </p>
                        {emp.last_message_time && (
                          <span className="text-xs text-muted-foreground">
                            {format(
                              new Date(emp.last_message_time),
                              "MMM d"
                            )}
                          </span>
                        )}
                      </div>

                      <p className="text-sm text-muted-foreground truncate">
                        {emp.last_message || "No messages yet"}
                      </p>
                    </div>

                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  </div>
                );
              })}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default AdminChatInbox;