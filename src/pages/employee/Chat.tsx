import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { Send, MessageSquare, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { getThreadId } from "@/lib/thread";

interface Message {
  id: string;
  content: string;
  sender_id: string;
  recipient_id: string;
  created_at: string;
  pending?: boolean;
}

const EmployeeChat = () => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [adminId, setAdminId] = useState<string | null>(null);
  const [threadId, setThreadId] = useState<string>("");
  const [isSending, setIsSending] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const fetchAdmin = useCallback(async () => {
    const { data } = await supabase
      .from("profiles")
      .select("auth_uid")
      .eq("role", "admin")
      .limit(1)
      .maybeSingle();

    if (data?.auth_uid) return data.auth_uid;
    return null;
  }, []);

  useEffect(() => {
    if (!user) return;

    const init = async () => {
      setIsLoading(true);

      const adminUid = await fetchAdmin();
      if (!adminUid) {
        toast({ title: "No admin found", variant: "destructive" });
        setIsLoading(false);
        return;
      }

      setAdminId(adminUid);

      const tId = getThreadId(user.id, adminUid);
      setThreadId(tId);

      const { data } = await supabase
        .from("messages")
        .select("*")
        .eq("thread_id", tId)
        .order("created_at", { ascending: true });

      setMessages(data || []);

      const channel = supabase
        .channel(`chat-${tId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "messages",
            filter: `thread_id=eq.${tId}`,
          },
          (payload) => {
            const msg = payload.new as Message;
            setMessages((prev) => {
              if (prev.some((m) => m.id === msg.id)) return prev;
              return [...prev, msg];
            });
          }
        )
        .subscribe();

      setIsLoading(false);

      return () => supabase.removeChannel(channel);
    };

    init();
  }, [user, fetchAdmin]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!newMessage.trim() || !user || !adminId || !threadId) return;

    const content = newMessage.trim();
    setIsSending(true);

    const optimisticId = `temp-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      {
        id: optimisticId,
        content,
        sender_id: user.id,
        recipient_id: adminId,
        created_at: new Date().toISOString(),
        pending: true,
      },
    ]);

    setNewMessage("");

    const { data, error } = await supabase
      .from("messages")
      .insert({
        thread_id: threadId,
        sender_id: user.id,
        recipient_id: adminId,
        content,
        metadata: {},
      })
      .select()
      .single();

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
      setNewMessage(content);
    } else if (data) {
      setMessages((prev) =>
        prev.map((m) => (m.id === optimisticId ? { ...data, pending: false } : m))
      );
    }

    setIsSending(false);
    inputRef.current?.focus();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header title="Chat with Admin" backTo="/employee/dashboard" />

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
                <div key={msg.id} className={`flex ${isOwn ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[80%] p-3 rounded-2xl ${
                      isOwn
                        ? "bg-primary text-primary-foreground rounded-br-sm"
                        : "bg-muted rounded-bl-sm"
                    } ${msg.pending ? "opacity-70" : ""}`}
                  >
                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
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
            <Button onClick={handleSend} disabled={!newMessage.trim() || isSending} size="icon">
              {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default EmployeeChat;
