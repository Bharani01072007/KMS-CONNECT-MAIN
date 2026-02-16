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
  thread_id: string;
  pending?: boolean;
}

const EmployeeChat = () => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [adminId, setAdminId] = useState<string | null>(null);
  const [threadId, setThreadId] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const channelRef = useRef<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const fetchAdmin = useCallback(async () => {
    const { data } = await supabase
      .from("profiles")
      .select("auth_uid")
      .eq("role", "admin")
      .limit(1)
      .maybeSingle();

    return data?.auth_uid ?? null;
  }, []);

  useEffect(() => {
    if (!user) return;

    let isMounted = true;
    let unsubscribe: (() => void) | null = null;

    const init = async () => {
      setIsLoading(true);

      try {
        const adminUid = await fetchAdmin();
        if (!adminUid || !isMounted) return;

        const tId = getThreadId(user.id, adminUid);
        
        if (!isMounted) return;
        setAdminId(adminUid);
        setThreadId(tId);

        /* ✅ LOAD MESSAGES FIRST */
        const { data: msgData, error: fetchError } = await supabase
          .from("messages")
          .select("*")
          .eq("thread_id", tId)
          .order("created_at", { ascending: true });

        if (fetchError) {
          console.error("Failed to fetch messages:", fetchError);
          if (isMounted) {
            toast({
              title: "Error",
              description: "Failed to load messages",
              variant: "destructive",
            });
          }
          return;
        }

        if (isMounted) {
          setMessages(msgData || []);
        }

        /* ✅ SETUP REALTIME - DO NOT UNSUBSCRIBE ON EFFECT CLEANUP */
        console.log("🔧 Setting up realtime for thread:", tId);
        
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
              console.log("📨 New message received:", payload.new);
              if (!isMounted) return;
              const msg = payload.new as Message;
              setMessages((prev) =>
                prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]
              );
            }
          )
          .subscribe((status, err) => {
            console.log(`✔️ Chat subscription status: ${status}`);
            if (err) console.error("Subscription error:", err);
          });

        channelRef.current = channel;
        unsubscribe = () => {
          console.log("🔌 Removing channel:", tId);
          supabase.removeChannel(channel);
        };
      } catch (error) {
        console.error("Chat init error:", error);
        if (isMounted) {
          toast({
            title: "Error",
            description: "Failed to initialize chat",
            variant: "destructive",
          });
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    init();

    return () => {
      isMounted = false;
      // Only clean up on unmount, not on every effect re-run
      if (unsubscribe && channelRef.current) {
        unsubscribe();
      }
    };
  }, [user]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!newMessage.trim() || !user || !adminId || !threadId) return;

    const content = newMessage.trim();
    setIsSending(true);

    const tempId = `temp-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      {
        id: tempId,
        content,
        sender_id: user.id,
        recipient_id: adminId,
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
        recipient_id: adminId,
        content,
      })
      .select()
      .single();

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setNewMessage(content);
    } else {
      setMessages((prev) =>
        prev.map((m) => (m.id === tempId ? { ...data, pending: false } : m))
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