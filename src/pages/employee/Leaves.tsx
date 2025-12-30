import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { toast } from "@/hooks/use-toast";
import { AlertTriangle, CalendarDays } from "lucide-react";
import { format, differenceInCalendarDays } from "date-fns";
import { DateRange } from "react-day-picker";
import { useAuth } from "@/contexts/AuthContext";

/* ===================== COMPONENT ===================== */

const EmployeeLeaves = () => {
  const { user } = useAuth();

  const [range, setRange] = useState<DateRange | undefined>(undefined);
  const [reason, setReason] = useState("");
  const [remainingPaid, setRemainingPaid] = useState(2);
  const [submitting, setSubmitting] = useState(false);

  /* ===================== FETCH PAID LEAVES ===================== */

  useEffect(() => {
    if (!user) return;

    const fetchPaidLeaves = async () => {
      const monthStart = format(new Date(), "yyyy-MM-01");
      const nextMonth = new Date(monthStart);
      nextMonth.setMonth(nextMonth.getMonth() + 1);

      const { count } = await supabase
        .from("leaves")
        .select("*", { count: "exact", head: true })
        .eq("emp_user_id", user.id)
        .eq("status", "approved")
        .gte("start_date", monthStart)
        .lt("start_date", format(nextMonth, "yyyy-MM-dd"));

      const used = count || 0;
      setRemainingPaid(Math.max(2 - used, 0));
    };

    fetchPaidLeaves();
  }, [user]);

  /* ===================== CALCULATIONS ===================== */

  const selectedDays =
    range?.from && range?.to
      ? differenceInCalendarDays(range.to, range.from) + 1
      : 0;

  const unpaidDays = Math.max(selectedDays - remainingPaid, 0);

  /* ===================== SUBMIT ===================== */

  const handleSubmit = async () => {
    if (!user || !range?.from || !range?.to) {
      toast({ title: "Please select leave dates", variant: "destructive" });
      return;
    }

    setSubmitting(true);

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
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  /* ===================== UI ===================== */

  return (
    <div className="min-h-screen bg-background">
      <Header title="Leave Requests" backTo="/employee/dashboard" />

      <main className="p-4 max-w-xl mx-auto space-y-5">

        {/* INFO CARD */}
        <Card className="border-red-200">
          <CardContent className="p-4 flex items-center justify-between">
            <span className="text-sm font-medium">
              Paid leaves remaining this month
            </span>
            <Badge
              className={
                remainingPaid === 0
                  ? "bg-red-500"
                  : "bg-red-500/90"
              }
            >
              {remainingPaid}
            </Badge>
          </CardContent>
        </Card>

        {/* WARNING */}
        <Card className="bg-red-50 border-red-200">
          <CardContent className="p-4 flex gap-3 text-sm text-red-700">
            <AlertTriangle className="h-5 w-5 mt-0.5" />
            <p>
              Only <strong>2 paid leaves</strong> are allowed per month.
              Any additional days will be treated as <strong>unpaid leave</strong>.
            </p>
          </CardContent>
        </Card>

        {/* APPLY LEAVE */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-red-500" />
              Apply for Leave
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-4">

            {/* SINGLE RANGE CALENDAR */}
            <Calendar
              mode="range"
              selected={range}
              onSelect={setRange}
              className="rounded-md border"
            />

            {/* SUMMARY */}
            {selectedDays > 0 && (
              <div className="text-sm space-y-1">
                <p>
                  Selected days: <strong>{selectedDays}</strong>
                </p>
                {unpaidDays > 0 && (
                  <p className="text-red-600 font-medium">
                    {unpaidDays} day(s) will be unpaid as per company policy
                  </p>
                )}
              </div>
            )}

            {/* REASON */}
            <Textarea
              placeholder="Reason for leave (optional)"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
            />

            <Button
              className="w-full bg-red-600 hover:bg-red-700"
              onClick={handleSubmit}
              disabled={submitting}
            >
              Submit Leave Request
            </Button>
          </CardContent>
        </Card>

      </main>
    </div>
  );
};

export default EmployeeLeaves;