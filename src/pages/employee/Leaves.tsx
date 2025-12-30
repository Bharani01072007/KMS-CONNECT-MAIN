import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { Calendar } from "lucide-react";
import { format } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";

/* ===================== COMPONENT ===================== */

const EmployeeLeaves = () => {
  const { user } = useAuth();
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [paidRemaining, setPaidRemaining] = useState(2);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchLeaveBalance();
  }, []);

  /* ===================== FETCH ===================== */

  const fetchLeaveBalance = async () => {
    if (!user) return;

    const monthStart = format(new Date(), "yyyy-MM-01");

    const { count } = await supabase
      .from("leaves")
      .select("*", { count: "exact", head: true })
      .eq("emp_user_id", user.id)
      .eq("status", "approved")
      .gte("start_date", monthStart);

    setPaidRemaining(Math.max(0, 2 - (count || 0)));
  };

  /* ===================== SUBMIT ===================== */

  const submitLeave = async () => {
    if (!startDate || !endDate) {
      toast({ title: "Select dates", variant: "destructive" });
      return;
    }

    setLoading(true);

    try {
      await supabase.from("leaves").insert({
        emp_user_id: user!.id,
        start_date: startDate,
        end_date: endDate,
        days: 1,
        reason,
        status: "pending",
      });

      toast({ title: "Leave Requested" });
      setStartDate("");
      setEndDate("");
      setReason("");
      fetchLeaveBalance();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  /* ===================== UI ===================== */

  return (
    <div className="min-h-screen bg-background">
      <Header title="Apply Leave" backTo="/employee/dashboard" />

      <main className="p-4 max-w-md mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Leave Request
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="p-3 rounded bg-muted text-sm">
              <strong>Paid leaves remaining:</strong>{" "}
              <span className="text-green-600 font-bold">
                {paidRemaining}
              </span>
              <p className="text-xs text-muted-foreground mt-1">
                Only first <strong>2 leaves</strong> per month are paid.
                Additional leaves will be unpaid.
              </p>
            </div>

            <Input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
            />

            <Input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
            />

            <Textarea
              placeholder="Reason (optional)"
              value={reason}
              onChange={e => setReason(e.target.value)}
            />

            <Button onClick={submitLeave} disabled={loading} className="w-full">
              Submit Leave
            </Button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default EmployeeLeaves;