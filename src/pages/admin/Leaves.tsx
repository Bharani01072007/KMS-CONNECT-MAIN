import { useState, useEffect } from "react";
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
import { Calendar, User } from "lucide-react";
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

  useEffect(() => {
    fetchLeaves();
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

  /* ===================== LEAVE COUNT ===================== */

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

  /* ===================== NOTIFY ===================== */

  const notifyEmployee = async (userId: string, title: string, body: string) => {
    await supabase.from("notifications").insert({ user_id: userId, title, body });
  };

  /* ===================== APPROVE ===================== */

  const approveLeave = async (leave: LeaveRequest) => {
    setIsUpdating(leave.id);
    try {
      const monthStart = leave.start_date.slice(0, 7) + "-01";

      await supabase.from("leaves").update({ status: "approved" }).eq("id", leave.id);

      // 🔴 UNPAID FROM 3RD LEAVE
      if (leaveCounts[leave.id] > 2 && leave.daily_wage) {
        await supabase.from("money_ledger").insert({
          emp_user_id: leave.emp_user_id,
          amount: leave.daily_wage,
          type: "debit",
          reason: "Unpaid Leave (More than 2 leaves)",
          month_year: monthStart,
        });
      }

      await notifyEmployee(
        leave.emp_user_id,
        "Leave Approved",
        `Your leave from ${format(new Date(leave.start_date), "PPP")} has been approved.`
      );

      toast({ title: "Leave Approved" });
      fetchLeaves();
    } finally {
      setIsUpdating(null);
      setShowWarning(false);
      setPendingLeave(null);
    }
  };

  const handleApproveClick = async (leave: LeaveRequest) => {
    const monthStart = leave.start_date.slice(0, 7) + "-01";
    const approvedCount = await getApprovedLeavesThisMonth(leave.emp_user_id, monthStart);

    if (approvedCount >= 2) {
      setPendingLeave(leave);
      setShowWarning(true);
      return;
    }

    approveLeave(leave);
  };

  /* ===================== REJECT ===================== */

  const handleReject = async (leave: LeaveRequest) => {
    setIsUpdating(leave.id);
    await supabase.from("leaves").update({ status: "rejected" }).eq("id", leave.id);
    await notifyEmployee(leave.emp_user_id, "Leave Rejected", "Your leave was rejected.");
    toast({ title: "Leave Rejected" });
    fetchLeaves();
    setIsUpdating(null);
  };

  /* ===================== UI ===================== */

  return (
    <div className="min-h-screen bg-background">
      <Header title="Leave Management" backTo="/admin/dashboard" />

      <main className="p-4 max-w-4xl mx-auto space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Leave Requests
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-3">
            {leaves.map(leave => (
              <div key={leave.id} className="p-4 bg-muted/50 rounded-lg">
                <div className="flex justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      <span className="font-medium">
                        {leave.employee?.full_name || leave.employee?.email}
                      </span>
                      <Badge>{leaveCounts[leave.id]} leave(s) this month</Badge>
                    </div>
                    <p className="text-sm mt-1">
                      {format(new Date(leave.start_date), "PPP")} →{" "}
                      {format(new Date(leave.end_date), "PPP")}
                    </p>
                  </div>

                  {leave.status === "pending" && (
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => handleApproveClick(leave)} disabled={isUpdating === leave.id}>
                        Approve
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => handleReject(leave)}>
                        Reject
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </main>

      {/* ⚠ WARNING */}
      <Dialog open={showWarning} onOpenChange={setShowWarning}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-destructive">Unpaid Leave Warning</DialogTitle>
            <DialogDescription>
              This is <strong>more than 2 leaves</strong> this month. Salary will be deducted.
            </DialogDescription>
          </DialogHeader>

          <div className="text-center font-bold text-red-600">
            ₹{pendingLeave?.daily_wage}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowWarning(false)}>Cancel</Button>
            <Button variant="destructive" onClick={() => pendingLeave && approveLeave(pendingLeave)}>
              Confirm & Approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminLeaves;