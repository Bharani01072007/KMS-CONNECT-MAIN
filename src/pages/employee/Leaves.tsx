import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { toast } from "@/hooks/use-toast";
import { format, differenceInCalendarDays } from "date-fns";
import { DateRange } from "react-day-picker";
import { AlertTriangle, CalendarDays } from "lucide-react";
import { Database } from "@/integrations/supabase/types";

/* ===================== TYPES ===================== */

type LeaveStatus = Database["public"]["Enums"]["leave_status"];

interface LeaveRecord {
  id: string;
  start_date: string;
  end_date: string;
  status: LeaveStatus | null;
  reason: string | null;
}

/* ===================== COMPONENT ===================== */

const EmployeeLeaves = () => {
  const [range, setRange] = useState<DateRange | undefined>();
  const [reason, setReason] = useState("");
  const [history, setHistory] = useState<LeaveRecord[]>([]);
  const [approvedCount, setApprovedCount] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  /* ===================== FETCH ===================== */

  const fetchData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const monthStart = format(new Date(), "yyyy-MM-01");

    const { data: approved } = await supabase
      .from("leaves")
      .select("id")
      .eq("emp_user_id", user.id)
      .eq("status", "approved")
      .gte("start_date", monthStart);

    setApprovedCount(approved?.length || 0);

    const { data: historyData } = await supabase
      .from("leaves")
      .select("*")
      .eq("emp_user_id", user.id)
      .order("created_at", { ascending: false });

    setHistory(historyData || []);
  };

  useEffect(() => {
    fetchData();
  }, []);

  /* ===================== DERIVED ===================== */

  const selectedDays =
    range?.from && range?.to
      ? differenceInCalendarDays(range.to, range.from) + 1
      : 0;

  const unpaidDays = Math.max(0, approvedCount + selectedDays - 2);

  /* ===================== SUBMIT ===================== */

  const handleSubmit = async () => {
    if (!range?.from || !range?.to) {
      toast({ title: "Select leave dates", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    try {
      await supabase.from("leaves").insert({
        emp_user_id: user.id,
        start_date: format(range.from, "yyyy-MM-dd"),
        end_date: format(range.to, "yyyy-MM-dd"),
        days: selectedDays,
        reason,
        status: "pending",
      });

      toast({ title: "Leave request submitted" });
      setRange(undefined);
      setReason("");
      fetchData();
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  /* ===================== UI ===================== */

  return (
    <div className="min-h-screen bg-background">
      <Header title="Leave Requests" backTo="/employee/dashboard" />

      <main className="p-4 max-w-xl mx-auto space-y-4">

        {/* 🔴 POLICY WARNING */}
        <Card className="border-red-500 bg-red-50">
          <CardContent className="p-3 flex gap-2 text-sm text-red-700">
            <AlertTriangle className="h-5 w-5 mt-0.5" />
            Only <strong>2 paid leaves</strong> are allowed per month.  
            Extra days will be treated as <strong>unpaid leave</strong>.
          </CardContent>
        </Card>

        {/* APPLY LEAVE */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5" />
              Apply for Leave
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-4">

            {/* PAID COUNT */}
            <div className="flex justify-between items-center">
              <span className="text-sm">Paid leaves remaining</span>
              <Badge variant={approvedCount >= 2 ? "destructive" : "default"}>
                {Math.max(0, 2 - approvedCount)}
              </Badge>
            </div>

            {/* SINGLE CALENDAR (RANGE) */}
            <Calendar
              mode="range"
              selected={range}
              onSelect={setRange}
              className="rounded-md border"
            />

            {/* COUNT SUMMARY */}
            {selectedDays > 0 && (
              <div className="text-sm space-y-1">
                <p>Selected days: <strong>{selectedDays}</strong></p>
                {unpaidDays > 0 && (
                  <p className="text-red-600">
                    {unpaidDays} day(s) will be unpaid
                  </p>
                )}
              </div>
            )}

            <Textarea
              placeholder="Reason (optional)"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />

            <Button
              className="w-full bg-red-600 hover:bg-red-700"
              onClick={handleSubmit}
              disabled={isSubmitting}
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
            {history.length === 0 && (
              <p className="text-sm text-muted-foreground text-center">
                No leave records
              </p>
            )}

            {history.map(l => (
              <div key={l.id} className="p-3 bg-muted/50 rounded">
                <div className="flex justify-between">
                  <span className="text-sm">
                    {format(new Date(l.start_date), "PPP")} →{" "}
                    {format(new Date(l.end_date), "PPP")}
                  </span>
                  <Badge
                    variant={
                      l.status === "approved"
                        ? "default"
                        : l.status === "rejected"
                        ? "destructive"
                        : "secondary"
                    }
                  >
                    {l.status}
                  </Badge>
                </div>
                {l.reason && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {l.reason}
                  </p>
                )}
              </div>
            ))}
          </CardContent>
        </Card>

      </main>
    </div>
  );
};

export default EmployeeLeaves;