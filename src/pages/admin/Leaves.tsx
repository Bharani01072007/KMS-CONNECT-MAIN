import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { Calendar, CheckCircle, XCircle, Clock, User } from "lucide-react";
import { format } from "date-fns";
import { Database } from "@/integrations/supabase/types";

/* ===================== TYPES ===================== */

type LeaveStatus = Database["public"]["Enums"]["leave_status"];

interface LeaveRequest {
  id: string;
  start_date: string;
  end_date: string;
  days: number;
  reason: string | null;
  status: LeaveStatus | null;
  created_at: string | null;
  emp_user_id: string;
  employee?: { full_name: string | null; email: string | null } | null;
  daily_wage?: number;
}

/* ===================== COMPONENT ===================== */

const AdminLeaves = () => {
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [leaveCounts, setLeaveCounts] = useState<Record<string, number>>({});
  const [isUpdating, setIsUpdating] = useState<string | null>(null);
  const [showWarning, setShowWarning] = useState(false);
  const [pendingLeave, setPendingLeave] = useState<LeaveRequest | null>(null);

  const realtimeRef = useRef<any>(null);

  useEffect(() => {
    fetchLeaves();

    realtimeRef.current = supabase
      .channel("admin-leaves-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "leaves" },
        fetchLeaves
      )
      .subscribe();

    return () => {
      if (realtimeRef.current) supabase.removeChannel(realtimeRef.current);
    };
  }, []);

  /* ===================== FETCH ===================== */

  const fetchLeaves = async () => {
    const { data } = await supabase
      .from("leaves")
      .select("*")
      .order("created_at", { ascending: false });

    if (!data) return;

    const userIds = [...new Set(data.map(l => l.emp_user_id))];

    const { data: profiles } = await supabase
      .from("profiles")
      .select("auth_uid, full_name, email")
      .in("auth_uid", userIds);

    const { data: wages } = await supabase
      .from("employees")
      .select("user_id, daily_wage")
      .in("user_id", userIds);

    const enriched = data.map(leave => ({
      ...leave,
      employee: profiles?.find(p => p.auth_uid === leave.emp_user_id) || null,
      daily_wage: wages?.find(w => w.user_id === leave.emp_user_id)?.daily_wage || 0,
    }));

    setLeaves(enriched);
    calculateLeaveCounts(enriched);
  };

  /* ===================== COUNT ===================== */

  const getApprovedLeavesThisMonth = async (empUserId: string, monthStart: string) => {
    const nextMonth = new Date(monthStart);
    nextMonth.setMonth(nextMonth.getMonth() + 1);

    const { count } = await supabase
      .from("leaves")
      .select("*", { count: "exact", head: true })
      .eq("emp_user_id", empUserId)
      .eq("status", "approved")
      .gte("start_date", monthStart)
      .lt("start_date", nextMonth.toISOString().slice(0, 10));

    return count || 0;
  };

  const calculateLeaveCounts = async (list: LeaveRequest[]) => {
    const counts: Record<string, number> = {};
    for (const leave of list) {
      const monthStart = leave.start_date.slice(0, 7) + "-01";
      const approved = await getApprovedLeavesThisMonth(leave.emp_user_id, monthStart);
      counts[leave.id] = approved + 1;
    }
    setLeaveCounts(counts);
  };

  /* ===================== APPROVE ===================== */

  const approveLeave = async (leave: LeaveRequest) => {
    setIsUpdating(leave.id);

    try {
      const monthStart = leave.start_date.slice(0, 7) + "-01";

      await supabase.from("leaves")
        .update({ status: "approved" })
        .eq("id", leave.id);

      // 🔴 UNPAID LEAVE (3rd onwards)
      if (leaveCounts[leave.id] > 2 && leave.daily_wage) {
        await supabase.from("money_ledger").insert({
          emp_user_id: leave.emp_user_id,
          amount: leave.daily_wage,
          type: "debit",
          reason: "Unpaid Leave (More than 2 leaves)",
          month_year: monthStart,
        });
      }

      toast({ title: "Leave Approved" });
      fetchLeaves();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setIsUpdating(null);
      setShowWarning(false);
      setPendingLeave(null);
    }
  };

  const handleApproveClick = async (leave: LeaveRequest) => {
    const monthStart = leave.start_date.slice(0, 7) + "-01";
    const approved = await getApprovedLeavesThisMonth(leave.emp_user_id, monthStart);

    if (approved >= 2) {
      setPendingLeave(leave);
      setShowWarning(true);
      return;
    }

    approveLeave(leave);
  };

  /* ===================== UI ===================== */

  return (
    <div className="min-h-screen bg-background">
      <Header title="Leave Management" backTo="/admin/dashboard" />

      <main className="p-4 max-w-4xl mx-auto space-y-4">
        {leaves.map(leave => (
          <Card key={leave.id}>
            <CardContent className="p-4 flex justify-between">
              <div>
                <p className="font-medium flex items-center gap-2">
                  <User className="h-4 w-4" />
                  {leave.employee?.full_name || leave.employee?.email}
                  <Badge>{leaveCounts[leave.id]} leave(s) this month</Badge>
                </p>
                <p className="text-sm">
                  {format(new Date(leave.start_date), "PPP")} →{" "}
                  {format(new Date(leave.end_date), "PPP")}
                </p>
              </div>

              {leave.status === "pending" && (
                <Button size="sm" onClick={() => handleApproveClick(leave)}>
                  Approve
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </main>

      {/* ⚠ WARNING */}
      <Dialog open={showWarning} onOpenChange={setShowWarning}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-destructive">
              Unpaid Leave Warning
            </DialogTitle>
            <DialogDescription>
              This employee has already used <strong>2 paid leaves</strong> this month.
              <br />This leave will be <strong>unpaid</strong>.
            </DialogDescription>
          </DialogHeader>

          <div className="text-center font-bold text-red-600">
            ₹{pendingLeave?.daily_wage}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowWarning(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => pendingLeave && approveLeave(pendingLeave)}
            >
              Confirm & Approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminLeaves;