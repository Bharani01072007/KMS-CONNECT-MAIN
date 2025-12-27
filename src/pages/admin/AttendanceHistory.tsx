import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/Header";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import {
  Loader2,
  Calendar,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  XCircle,
  Clock,
  Plane,
} from "lucide-react";

import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  addMonths,
  subMonths,
} from "date-fns";

/* ===================== TYPES ===================== */

interface AttendanceRecord {
  day: string;
  checkin_at: string | null;
  checkout_at: string | null;
}

interface LeaveRecord {
  start_date: string;
  end_date: string;
}

/* ===================== COMPONENT ===================== */

const AdminAttendanceHistory = () => {
  const { userId } = useParams<{ userId: string }>();

  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [leaves, setLeaves] = useState<LeaveRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const [summary, setSummary] = useState({
    present: 0,
    half: 0,
    leave: 0,
    absent: 0,
  });

  /* ===================== FETCH ===================== */

  const fetchData = async () => {
    if (!userId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    const start = format(startOfMonth(currentMonth), "yyyy-MM-dd");
    const end = format(endOfMonth(currentMonth), "yyyy-MM-dd");

    const { data: attData, error: attErr } = await supabase
      .from("attendance")
      .select("day, checkin_at, checkout_at")
      .eq("emp_user_id", userId)
      .gte("day", start)
      .lte("day", end);

    const { data: leaveData } = await supabase
      .from("leaves")
      .select("start_date, end_date")
      .eq("emp_user_id", userId)
      .eq("status", "approved");

    if (attErr) console.error(attErr);

    const attRows = attData ?? [];
    const leaveRows = leaveData ?? [];

    setAttendance(attRows);
    setLeaves(leaveRows);

    /* ===================== SUMMARY (NO FUTURE DAYS) ===================== */

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const validDays = eachDayOfInterval({
      start: startOfMonth(currentMonth),
      end: today < endOfMonth(currentMonth) ? today : endOfMonth(currentMonth),
    });

    let present = 0;
    let half = 0;
    let leave = 0;
    let absent = 0;

    validDays.forEach(day => {
      const dateStr = format(day, "yyyy-MM-dd");

      const onLeave = leaveRows.some(
        l => dateStr >= l.start_date && dateStr <= l.end_date
      );

      if (onLeave) {
        leave++;
        return;
      }

      const rec = attRows.find(a => a.day === dateStr);

      if (rec?.checkout_at) present++;
      else if (rec?.checkin_at) half++;
      else absent++;
    });

    setSummary({ present, half, leave, absent });
    setIsLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [userId, currentMonth]);

  /* ===================== HELPERS ===================== */

  const isLeaveDay = (dateStr: string) =>
    leaves.some(l => dateStr >= l.start_date && dateStr <= l.end_date);

  const getDayStatus = (date: Date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (date > today) return "future";

    const dateStr = format(date, "yyyy-MM-dd");

    if (isLeaveDay(dateStr)) return "leave";

    const rec = attendance.find(a => a.day === dateStr);
    if (rec?.checkout_at) return "present";
    if (rec?.checkin_at) return "half";

    return "absent";
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "present":
        return "bg-green-500";
      case "half":
        return "bg-yellow-500";
      case "leave":
        return "bg-blue-500";
      case "absent":
        return "bg-red-400";
      case "future":
        return "bg-gray-200";
      default:
        return "bg-gray-200";
    }
  };

  const selectedAttendance = attendance.find(a => a.day === selectedDate);

  const daysInMonth = eachDayOfInterval({
    start: startOfMonth(currentMonth),
    end: endOfMonth(currentMonth),
  });

  const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const firstDayOffset = startOfMonth(currentMonth).getDay();

  /* ===================== UI ===================== */

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header title="Employee Attendance" backTo="/admin/employees" />

      <main className="p-4 max-w-lg mx-auto space-y-4">

        {/* MONTH NAV */}
        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
              <ChevronLeft />
            </Button>

            <h2 className="font-semibold">{format(currentMonth, "MMMM yyyy")}</h2>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
              disabled={isSameMonth(currentMonth, new Date())}
            >
              <ChevronRight />
            </Button>
          </CardContent>
        </Card>

        {/* SUMMARY */}
        <div className="grid grid-cols-4 gap-2">
          <Summary icon={<CheckCircle className="text-green-500" />} label="Present" value={summary.present} />
          <Summary icon={<Clock className="text-yellow-500" />} label="Half Day" value={summary.half} />
          <Summary icon={<Plane className="text-blue-500" />} label="Leaves" value={summary.leave} />
          <Summary icon={<XCircle className="text-red-400" />} label="Absent" value={summary.absent} />
        </div>

        {/* CALENDAR */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-4 w-4" /> Calendar
            </CardTitle>
          </CardHeader>

          <CardContent className="p-4">
            <div className="grid grid-cols-7 gap-1 mb-2">
              {weekDays.map(d => (
                <div key={d} className="text-xs text-center text-muted-foreground">
                  {d}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: firstDayOffset }).map((_, i) => <div key={i} />)}

              {daysInMonth.map(date => {
                const dateStr = format(date, "yyyy-MM-dd");
                const status = getDayStatus(date);

                return (
                  <button
                    key={dateStr}
                    onClick={() => status !== "future" && setSelectedDate(dateStr)}
                    className="aspect-square flex flex-col items-center justify-center rounded hover:bg-muted"
                  >
                    <span className="text-xs">{format(date, "d")}</span>
                    <div className={`w-3 h-3 rounded-full ${getStatusColor(status)}`} />
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* DAY DETAILS */}
        <Dialog open={!!selectedDate} onOpenChange={() => setSelectedDate(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {selectedDate && format(new Date(selectedDate), "PPP")}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-2 text-sm">
              <p><strong>Check In:</strong> {selectedAttendance?.checkin_at ? format(new Date(selectedAttendance.checkin_at), "hh:mm a") : "-"}</p>
              <p><strong>Check Out:</strong> {selectedAttendance?.checkout_at ? format(new Date(selectedAttendance.checkout_at), "hh:mm a") : "-"}</p>
            </div>
          </DialogContent>
        </Dialog>

      </main>
    </div>
  );
};

/* ===================== SUMMARY CARD ===================== */

const Summary = ({ icon, label, value }: any) => (
  <Card>
    <CardContent className="p-3 text-center">
      {icon}
      <p className="text-lg font-bold">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </CardContent>
  </Card>
);

export default AdminAttendanceHistory;