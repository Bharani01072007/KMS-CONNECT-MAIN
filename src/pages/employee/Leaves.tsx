import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import Header from "@/components/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { Calendar } from "lucide-react";

/* ===================== COMPONENT ===================== */

const EmployeeLeaves = () => {
  const { user } = useAuth();
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [usedLeaves, setUsedLeaves] = useState(0);

  useEffect(() => {
    fetchLeaveCount();
  }, []);

  /* ===================== FETCH COUNT ===================== */

  const fetchLeaveCount = async () => {
    if (!user) return;

    const monthStart = new Date().toISOString().slice(0, 7) + "-01";

    const { count } = await supabase
      .from("leaves")
      .select("*", { count: "exact", head: true })
      .eq("emp_user_id", user.id)
      .eq("status", "approved")
      .gte("start_date", monthStart);

    setUsedLeaves(count || 0);
  };

  /* ===================== APPLY ===================== */

  const applyLeave = async () => {
    if (!startDate || !endDate) {
      toast({ title: "Select dates", variant: "destructive" });
      return;
    }

    await supabase.from("leaves").insert({
      emp_user_id: user!.id,
      start_date: startDate,
      end_date: endDate,
      days: 1,
      reason,
      status: "pending",
    });

    toast({ title: "Leave applied successfully" });
    setReason("");
    setStartDate("");
    setEndDate("");
    fetchLeaveCount();
  };

  /* ===================== UI ===================== */

  return (
    <div className="min-h-screen bg-background">
      <Header title="Apply Leave" backTo="/employee/dashboard" />

      <main className="p-4 max-w-lg mx-auto space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Leave Request
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-3">
            <p className="text-sm">
              Paid leaves remaining this month:{" "}
              <strong>{Math.max(0, 2 - usedLeaves)}</strong>
            </p>

            <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
            <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />

            <Textarea
              placeholder="Reason (optional)"
              value={reason}
              onChange={e => setReason(e.target.value)}
            />

            <Button onClick={applyLeave} className="w-full">
              Submit Leave
            </Button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default EmployeeLeaves;