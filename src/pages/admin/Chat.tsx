import { useState, useEffect, useRef, useCallback } from "react";
import { useParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "@/hooks/use-toast";
import { Send, MessageSquare, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { getThreadId } from "@/lib/thread";

/* ===================== TYPES ===================== */

interface Message {
  id: string;
  content: string;
  sender_id: string;
  recipient_id: string;
  created_at: string;
  thread_id: string;
  pending?: boolean;
}

interface EmployeeInfo {
  user_id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
}

/* ===================== COMPONENT ===================== */

const AdminChat = () => {
  const { employeeId } = useParams<{ employeeId: string }>();
  const { user } = useAuth();

  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [employee, setEmployee] = useState<EmployeeInfo | null>(null);
  const [threadId, setThreadId] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const channelRef = useRef<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  /* ===================== FETCH EMPLOYEE ===================== */

  const fetchEmployee = useCallback(async () => {
    if (!employeeId) return;

    const { data, error } = await supabase
      .from("employee_directory")
      .select("user_id, full_name, email, avatar_url")
      .eq("user_id", employeeId)
      .maybeSingle();

    if (error||!data) {
      toast({
        title: "Error",
        description: "Could not load employee info",
        variant: "destructive",
      });
      return;
    }

    setEmployee({
      user_id: data.user_id,
      full_name: data.full_name,
      email: data.email,
      avatar_url: data.avatar_url,
    });
  }, [employeeId]);

  /* ===================== INIT ===================== */
  useEffect(() => {
    if(!user||!employee)return;
      const tId = getThreadId(user.id, employee.user_id); 
      setThreadId(tId);
  }, [user, employee]);
  useEffect(() => {
    fetchEmployee();
  }, [fetchEmployee]);
  useEffect(() => {
    if (!user || !threadId) return;
  

    const init = async () => {
      setIsLoading(true);
      /* ✅ REALTIME FIRST */
      channelRef.current = supabase
        .channel(`chat-${threadId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "messages",
            filter: `thread_id=eq.${threadId}`,
          },
          (payload) => {
            const msg = payload.new as Message;
            setMessages((prev) =>
              prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]
            );
          }
        )
        .subscribe();

      /* ✅ FETCH EXISTING MESSAGES */
      const { data } = await supabase
        .from("messages")
        .select("*")
        .eq("thread_id", threadId)
        .order("created_at", { ascending: true });
      setMessages(data || []);
      setIsLoading(false);
    };

    init();

    /* ✅ CLEANUP (CRITICAL FIX) */
    return () => {
      
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [threadId]);

  /* ===================== AUTO SCROLL ===================== */

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  /* ===================== SEND MESSAGE ===================== */

  const handleSend = async () => {
    if (!newMessage.trim() || !user || !employeeId || !threadId) return;

    const content = newMessage.trim();
    setIsSending(true);

    const tempId = `temp-${Date.now()}`;

    setMessages((prev) => [
      ...prev,
      {
        id: tempId,
        content,
        sender_id: user.id,
        recipient_id: employee!.user_id,
        created_at: new Date().toISOString(),
        thread_id: threadId,
        pending: true,
      },
    ]);

    setNewMessage("");

    const { data, error } = await supabase
      .from("messages")
      .insert({
        thread_id: threadId,
        sender_id: user.id,
        recipient_id: employee.user_id,
        content,
      })
      .select()
      .single();

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setNewMessage(content);
    } else {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === tempId ? { ...data, pending: false } : m
        )
      );
    }

    setIsSending(false);
    inputRef.current?.focus();
  };

  /* ===================== LOADING ===================== */

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  /* ===================== UI ===================== */

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header
        title={`Chat with ${employee?.full_name || "Employee"}`}
        backTo="/admin/chat"
        rightAction={
          employee && (
            <Avatar className="h-8 w-8">
              <AvatarImage src={employee.avatar_url || undefined} />
              <AvatarFallback>
                {employee.full_name?.charAt(0) || "E"}
              </AvatarFallback>
            </Avatar>
          )
        }
      />

      <main className="flex-1 flex flex-col max-w-2xl mx-auto w-full">
        <div className="flex-1 p-4 overflow-y-auto space-y-3">
          {messages.length === 0 ? (
            <div className="text-center text-muted-foreground">
              <MessageSquare className="h-10 w-10 mx-auto mb-2" />
              No messages yet
            </div>
          ) : (
            messages.map((msg) => {
              const isOwn = msg.sender_id === user?.id;
              return (
                <div
                  key={msg.id}
                  className={`flex ${
                    isOwn ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`max-w-[80%] p-3 rounded-2xl ${
                      isOwn
                        ? "bg-primary text-primary-foreground rounded-br-sm"
                        : "bg-muted rounded-bl-sm"
                    } ${msg.pending ? "opacity-70" : ""}`}
                  >
                    <p className="text-sm whitespace-pre-wrap">
                      {msg.content}
                    </p>
                    <p className="text-xs mt-1 opacity-70 text-right">
                      {format(new Date(msg.created_at), "p")}
                    </p>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="p-4 border-t bg-card">
          <div className="flex gap-2">
            <Input
              ref={inputRef}
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              placeholder="Type a message…"
            />
            <Button
              onClick={handleSend}
              disabled={!newMessage.trim() || isSending}
              size="icon"
            >
              {isSending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default AdminChat;
