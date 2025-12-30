import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { Calendar, AlertTriangle, CheckCircle, XCircle, Clock } from "lucide-react";
import { format } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";
import { Database } from "@/integrations/supabase/types";

/* ===================== TYPES ===================== */

type LeaveStatus = Database["public"]["Enums"]["leave_status"];

interface LeaveRecord {
  id: string;
  start_date: string;
  end_date: string;
  reason: string | null;
  status: LeaveStatus | null;
}

/* ===================== COMPONENT ===================== */

const EmployeeLeaves = () => {
  const { user } = useAuth();

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");

  const [leaves, setLeaves] = useState<LeaveRecord[]>([]);
  const [paidUsed, setPaidUsed] = useState(0);
  const [loading, setLoading] = useState(false);

  /* ===================== FETCH ===================== */

  const fetchLeaves = async () => {
    if (!user) return;

    const monthStart = format(new Date(), "yyyy-MM-01");

    const { data } = await supabase
      .from("leaves")
      .select("*")
      .eq("emp_user_id", user.id)
      .order("created_at", { ascending: false });

    setLeaves(data || []);

    const { count } = await supabase
      .from("leaves")
      .select("*", { count: "exact", head: true })
      .eq("emp_user_id", user.id)
      .eq("status", "approved")
      .gte("start_date", monthStart);

    setPaidUsed(count || 0);
  };

  useEffect(() => {
    fetchLeaves();
  }, [user]);

  /* ===================== SUBMIT ===================== */

  const submitLeave = async () => {
    if (!startDate || !endDate) {
      toast({
        title: "Missing dates",
        description: "Please select both start and end dates",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      await supabase.from("leaves").insert({
        emp_user_id: user!.id,
        start_date: startDate,
        end_date: endDate,
        reason,
        days:
          (new Date(endDate).getTime() - new Date(startDate).getTime()) /
            (1000 * 60 * 60 * 24) +
          1,
        status: "pending",
      });

      toast({ title: "Leave requested successfully" });

      setStartDate("");
      setEndDate("");
      setReason("");
      fetchLeaves();
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  /* ===================== HELPERS ===================== */

  const remainingPaid = Math.max(0, 2 - paidUsed);

  const statusBadge = (status: LeaveStatus | null) => {
    if (status === "approved")
      return <Badge className="bg-green-600"><CheckCircle className="h-3 w-3 mr-1"/>Approved</Badge>;
    if (status === "rejected")
      return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1"/>Rejected</Badge>;
    return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1"/>Pending</Badge>;
  };

  /* ===================== UI ===================== */

  return (
    <div className="min-h-screen bg-background">
      <Header title="Leave Requests" backTo="/employee/dashboard" />

      <main className="p-4 max-w-xl mx-auto space-y-4">

        {/* 🔴 WARNING */}
        <div className="flex gap-2 items-start bg-red-50 border border-red-200 p-3 rounded-lg text-sm text-red-700">
          <AlertTriangle className="h-4 w-4 mt-0.5" />
          <p>
            Only <strong>2 paid leaves</strong> are allowed per month.
            <br />
            Leaves beyond this will be treated as <strong>unpaid</strong>.
          </p>
        </div>

        {/* APPLY LEAVE */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-red-600" />
              Apply for Leave
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm">Paid leaves remaining</span>
              <Badge className="bg-red-600 text-white">
                {remainingPaid} / 2
              </Badge>
            </div>

            <input
              type="date"
              className="w-full border rounded px-3 py-2"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
            />

            <input
              type="date"
              className="w-full border rounded px-3 py-2"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
            />

            <Textarea
              placeholder="Reason (optional)"
              value={reason}
              onChange={e => setReason(e.target.value)}
            />

            <Button
              className="w-full bg-red-600 hover:bg-red-700"
              disabled={loading}
              onClick={submitLeave}
            >
              Submit Leave Request
            </Button>
          </CardContent>
        </Card>

        {/* HISTORY */}
        <Card>
          <CardHeader>
            <CardTitle>Leave History</CardTitle>
          </CardHeader>

          <CardContent className="space-y-2">
            {leaves.length === 0 && (
              <p className="text-sm text-muted-foreground text-center">
                No leave requests
              </p>
            )}

            {leaves.map(l => (
              <div key={l.id} className="p-3 rounded-lg bg-muted/40 flex justify-between">
                <div>
                  <p className="font-medium">
                    {format(new Date(l.start_date), "PPP")} →{" "}
                    {format(new Date(l.end_date), "PPP")}
                  </p>
                  {l.reason && (
                    <p className="text-xs text-muted-foreground">{l.reason}</p>
                  )}
                </div>
                {statusBadge(l.status)}
              </div>
            ))}
          </CardContent>
        </Card>

      </main>
    </div>
  );
};

export default EmployeeLeaves;