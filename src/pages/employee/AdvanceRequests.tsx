import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/Header";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { CheckCircle, XCircle, Clock } from "lucide-react";
import { Database } from "@/integrations/supabase/types";

/* ===================== TYPES ===================== */

type AdvanceStatus =
  Database["public"]["Tables"]["advance_requests"]["Row"]["status"];

type AdvanceRecord =
  Database["public"]["Tables"]["advance_requests"]["Row"];

/* ===================== COMPONENT ===================== */

const EmployeeAdvanceRequests = () => {
  const { user } = useAuth();
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [records, setRecords] = useState<AdvanceRecord[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (user) fetchData();
  }, [user]);

  /* ===================== FETCH ===================== */

  const fetchData = async () => {
    const { data, error } = await supabase
      .from("advance_requests")
      .select("*")
      .eq("user_id", user!.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Fetch advance error:", error);
      return;
    }

    setRecords(data ?? []);
  };

  /* ===================== SUBMIT ===================== */

  const handleSubmit = async () => {
    if (!amount) {
      toast({ title: "Enter amount", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);

    const { error } = await supabase.from("advance_requests").insert({
      user_id: user!.id,              // ✅ FIXED
      amount: Number(amount),
      reason: reason || null,
      status: "pending",              // ✅ REQUIRED
    });

    if (error) {
      console.error("Insert advance error:", error);
      toast({
        title: "Failed",
        description: error.message,
        variant: "destructive",
      });
      setIsSubmitting(false);
      return;
    }

    toast({ title: "Advance request submitted" });
    setAmount("");
    setReason("");
    fetchData();
    setIsSubmitting(false);
  };

  /* ===================== BADGE ===================== */

  const badge = (status: AdvanceStatus) => {
    switch (status) {
      case "approved":
        return (
          <Badge className="bg-green-500">
            <CheckCircle className="h-3 w-3 mr-1" />
            Approved
          </Badge>
        );
      case "rejected":
        return (
          <Badge variant="destructive">
            <XCircle className="h-3 w-3 mr-1" />
            Rejected
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary">
            <Clock className="h-3 w-3 mr-1" />
            Pending
          </Badge>
        );
    }
  };

  /* ===================== UI ===================== */

  return (
    <div className="min-h-screen bg-background">
      <Header title="Advance Requests" backTo="/employee/dashboard" />

      <main className="p-4 max-w-2xl mx-auto space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Request Advance</CardTitle>
            <CardDescription>
              Submit an advance salary request
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-3">
            <Input
              placeholder="Amount ₹"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            <Textarea
              placeholder="Reason (optional)"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="w-full"
            >
              Submit Request
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Advance History</CardTitle>
          </CardHeader>

          <CardContent className="space-y-3">
            {records.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center">
                No advance requests yet
              </p>
            ) : (
              records.map((r) => (
                <div
                  key={r.id}
                  className="p-3 bg-muted/50 rounded-lg flex justify-between"
                >
                  <div>
                    <p className="font-medium">₹{r.amount}</p>
                    {r.reason && (
                      <p className="text-sm text-muted-foreground">
                        {r.reason}
                      </p>
                    )}
                  </div>
                  {badge(r.status)}
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default EmployeeAdvanceRequests;