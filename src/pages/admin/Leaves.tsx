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
import {
  Calendar,
  CheckCircle,
  XCircle,
  Clock,
  User,
} from "lucide-react";
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
  const [monthlyApproved, setMonthlyApproved] = useState<Record<string, Record<string, number>>>({});
  const [isUpdating, setIsUpdating] = useState<string | null>(null);

  const [showWarning, setShowWarning] = useState(false);
  const [pendingLeave, setPendingLeave] = useState<LeaveRequest | null>(null);

  useEffect(() => {
    fetchLeaves();
  }, []);

  /* ===================== FETCH LEAVES ===================== */

  const fetchLeaves = async () => {
    const { data } = await supabase
      .from("leaves")
      .select("*")
      .order("created_at", { ascending: false });

    if (!data) return;

    const userIds = [...new Set(data.map((l) => l.emp_user_id))];

    const { data: profiles } = await supabase
      .from("profiles")
      .select("auth_uid, full_name, email")
      .in("auth_uid", userIds);

    const { data: wages } = await supabase
      .from("employees")
      .select("user_id, daily_wage")
      .in("user_id", userIds);

    const enriched: LeaveRequest[] = data.map((leave) => ({
      ...leave,
      employee:
        profiles?.find((p) => p.auth_uid === leave.emp_user_id) || null,
      daily_wage:
        wages?.find((w) => w.user_id === leave.emp_user_id)?.daily_wage || 0,
    }));

    setLeaves(enriched);
    setMonthlyApproved(buildMonthlyApprovedMap(enriched));
  };

  /* ===================== LEAVE COUNT PER MONTH ===================== */

  const buildMonthlyApprovedMap = (leaves: LeaveRequest[]) => {
    const map: Record<string, Record<string, number>> = {};
    for (const leave of leaves) {
      if (leave.status !== "approved") continue;
      const empid=leave.emp_user_id;
      const month = leave.start_date.slice(0, 7);
      if(!map[empid]) map[empid]={};
      if(!map[empid][month]) map[empid][month]=0;
      map[empid][month]+=leave.days;
    }
    return map;  
  };


  /* ===================== SAFE NOTIFICATION ===================== */

  const sendLeaveNotification = async (
    empUserId: string,
    title: string,
    body: string
  ) => {
    try {
      await supabase.from("notifications").insert({
        user_id: empUserId,
        title,
        body,
      });
    } catch {}
  };

  /* ===================== APPROVE LEAVE ===================== */

  const approveLeave = async (leaveId: string) => {
    setIsUpdating(leaveId);

    try {
      const { error } = await supabase.rpc("approve_leave_with_deduction",{
        p_leave_id: leaveId
      });
   

      if (error) throw error;

      const leave = pendingLeave || leaves.find((l) => l.id === leaveId);

      if (leave) {
        await sendLeaveNotification(
          leave.emp_user_id,
          "Leave Approved",
          `Your leave from ${format(
            new Date(leave.start_date),
            "PPP"
          )} to ${format(new Date(leave.end_date), "PPP")} has been approved.`
        );
      }

      toast({ title: "Leave Approved" });
      fetchLeaves();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsUpdating(null);
      setShowWarning(false);
      setPendingLeave(null);
    }
  };

  const handleApproveClick = async (leave: LeaveRequest) => {
    const month = leave.start_date.slice(0, 7); // yyyy-MM
    const approvedSoFar =
      monthlyApproved[leave.emp_user_id]?.[month] ?? 0;
    const paidLeft = Math.max(0, 2 - approvedSoFar);
    const unpaidDays = Math.max(0, leave.days - paidLeft);

    if (unpaidDays >0){
      setPendingLeave({
        ...leave,
        unpaidDays,
      }as LeaveRequest & {unpaidDays:number});
      setShowWarning(true);
      return;
    }
    approveLeave(leave.id);
  };

  /* ===================== REJECT ===================== */

  const handleReject = async (id: string) => {
    setIsUpdating(id);

    try {
      const { error } = await supabase
        .from("leaves")
        .update({ status: "rejected" })
        .eq("id", id);

      if (error) throw error;

      const leave = leaves.find((l) => l.id === id);
      if (leave) {
        await sendLeaveNotification(
          leave.emp_user_id,
          "Leave Rejected",
          "Your leave request has been rejected by admin."
        );
      }

      toast({ title: "Leave Rejected" });
      fetchLeaves();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsUpdating(null);
    }
  };

  /* ===================== UI HELPERS ===================== */

  const getStatusBadge = (status: LeaveStatus | null) => {
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

  const pendingCount = leaves.filter(
    (l) => l.status === "pending"
  ).length;
  /* ===================== SALARY DEDUCTION CALC ===================== */

  const unpaidDays = (pendingLeave as (LeaveRequest & { unpaidDays: number }) | null)?.unpaidDays ?? 0;

  const deductionAmount = unpaidDays * (pendingLeave?.daily_wage ?? 0);
  const isLatestApprovedInMonth = (
    leave: LeaveRequest,
    allLeaves: LeaveRequest[]
  ) => {
    const month = leave.start_date.slice(0, 7);

    return (
      leave.status === "approved" &&
      allLeaves.find(
        (l) =>
          l.emp_user_id === leave.emp_user_id &&
          l.status === "approved" &&
          l.start_date.slice(0, 7) === month
      )?.id === leave.id
    );
  };

  /* ===================== UI ===================== */

  return (
    <div className="min-h-screen bg-background">
      <Header title="Leave Management" backTo="/admin/dashboard" />

      <main className="p-4 max-w-4xl mx-auto space-y-4">
        {pendingCount > 0 && (
          <Card className="border-amber-500/50 bg-amber-500/10">
            <CardContent className="p-4 flex items-center gap-3">
              <Clock className="h-5 w-5 text-amber-500" />
              <p className="font-medium">
                {pendingCount} leave request
                {pendingCount > 1 ? "s" : ""} pending approval
              </p>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              All Leave Requests
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-3">
            {leaves.map((leave) => (
              <div key={leave.id} className="p-4 bg-muted/50 rounded-lg">
                <div className="flex flex-col sm:flex-row justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <User className="h-4 w-4 text-muted-foreground" />

                      <span className="font-medium">
                        {leave.employee?.full_name ||
                          leave.employee?.email ||
                          "Unknown"}
                      </span>

                      {getStatusBadge(leave.status)}

                      {isLatestApprovedInMonth(leave,leaves) && (() => {
                        const month = leave.start_date.slice(0, 7);
                        const usedDays =
                          monthlyApproved[leave.emp_user_id]?.[month] || 0;
                        return (
                          <Badge variant={usedDays > 2 ? "destructive" : "secondary"}>
                            {usedDays} / 2 approved this month
                          </Badge>
                        );
                      })()}
                    </div>

                    <p className="text-sm">
                      {format(new Date(leave.start_date), "PPP")} →{" "}
                      {format(new Date(leave.end_date), "PPP")} (
                      {leave.days} day{leave.days > 1 ? "s" : ""})
                    </p>

                    {leave.reason && (
                      <p className="text-sm text-muted-foreground mt-1">
                        Reason: {leave.reason}
                      </p>
                    )}
                  </div>

                  {leave.status === "pending" && (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        className="bg-green-500 hover:bg-green-600"
                        disabled={isUpdating === leave.id}
                        onClick={() => handleApproveClick(leave)}
                      >
                        <CheckCircle className="h-4 w-4 mr-1" />
                        Approve
                      </Button>

                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={isUpdating === leave.id}
                        onClick={() => handleReject(leave.id)}
                      >
                        <XCircle className="h-4 w-4 mr-1" />
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

      {/* ⚠️ Salary Warning */}
      <Dialog open={showWarning} onOpenChange={setShowWarning}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-destructive">
              Salary Deduction Warning
            </DialogTitle>
            <DialogDescription>
              This leave exceeds the <strong>2 free leave days</strong> for this month Approving this leave will result in a salary deduction:
            </DialogDescription>
          </DialogHeader>

          <div className="p-3 bg-muted rounded-lg text-center font-semibold text-red-600">
            ₹{deductionAmount} will be deducted from the employee's salary.
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowWarning(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() =>
                pendingLeave && approveLeave(pendingLeave.id)
              }
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