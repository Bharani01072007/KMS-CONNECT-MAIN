import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import Header from '@/components/Header';

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

import {
  Loader2,
  Calendar,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  XCircle,
  Clock,
  Plane,
} from 'lucide-react';

import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  addMonths,
  subMonths,
} from 'date-fns';

/* ===================== TYPES ===================== */

interface AttendanceRecord {
  day: string;
  attendance_type: string | null;
  checkin_at: string | null;
  checkout_at: string | null;
  remarks: string | null;
}

interface LeaveRecord {
  start_date: string;
  end_date: string;
}
interface holidayRecord {
  holiday_date: string;
  description?: string | null;
}

const [holidays, setHolidays] = useState<holidayRecord[]>([]);

/* ===================== COMPONENT ===================== */

const AdminAttendanceHistory = () => {
  const { employeeId } = useParams<{ employeeId: string }>();

  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [leaves, setLeaves] = useState<LeaveRecord[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [summary, setSummary] = useState({
    present: 0,
    half: 0,
    leave: 0,
    absent: 0,
  });

  /* ===================== FETCH ===================== */

  const fetchData = async () => {
    if (!employeeId) return;
    setIsLoading(true);

    const start = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
    const end = format(endOfMonth(currentMonth), 'yyyy-MM-dd');

    const { data: attData } = await supabase
      .from('attendance')
      .select('day, attendance_type, checkin_at, checkout_at, remarks')
      .eq('emp_user_id', employeeId)
      .gte('day', start)
      .lte('day', end);

    const { data: leaveData } = await supabase
      .from('leaves')
      .select('start_date, end_date')
      .eq('emp_user_id', employeeId)
      .eq('status', 'approved');

    const attendanceRows = attData ?? [];
    const leaveRows = leaveData ?? [];

    setAttendance(attendanceRows);
    setLeaves(leaveRows);

    let present = 0;
    let half = 0;
    let leave = 0;
    let absent = 0;

    const todayStr = format(new Date(), 'yyyy-MM-dd');

    const allDays = eachDayOfInterval({
      start: startOfMonth(currentMonth),
      end: endOfMonth(currentMonth),
    });
    const { data: holidayData } = await supabase
      .from('holidays')
      .select('holiday_date')
      .gte('holiday_date', start)
      .lte('holiday_date', end);

    setHolidays(holidayData ?? []);

    allDays.forEach(day => {
      const d = format(day, 'yyyy-MM-dd');

      // Skip future days
      if (d > todayStr) return;
      if (holidayData?.some(h => h.holiday_date === d)) {
        leave++;
        return;
      }

      // Approved leave
      if (leaveRows.some(l => d >= l.start_date && d <= l.end_date)) {
        leave++;
        return;
      }

      const r = attendanceRows.find(a => a.day === d);

      // Today without check-in → pending (not absent)
      if (d === todayStr && !r) return;

      if (!r || r.attendance_type === 'absent') absent++;
      else if (r.attendance_type === 'full') present++;
      else if (r.attendance_type === 'half') half++;
    });

    setSummary({ present, half, leave, absent });
    setIsLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [employeeId, currentMonth]);

  /* ===================== HELPERS ===================== */

  const getDayStatus = (date: Date) => {
    const d = format(date, 'yyyy-MM-dd');
    const todayStr = format(new Date(), 'yyyy-MM-dd');

    // Future day
    if (d > todayStr) return 'future';

    if (holidays.some(h => h.holiday_date === d)) return 'leave';

    // Approved leave
    if (leaves.some(l => d >= l.start_date && d <= l.end_date)) return 'leave';

    const r = attendance.find(a => a.day === d);

    // Today but no attendance yet
    if (!r && d === todayStr) return 'pending';

    if (r?.attendance_type === 'full') return 'present';
    if (r?.attendance_type === 'half') return 'half';

    return 'absent';
  };

  const getColor = (s: string) =>
    s === 'present'
      ? 'bg-green-500'
      : s === 'half'
      ? 'bg-yellow-500'
      : s === 'leave'
      ? 'bg-blue-500'
      : s === 'pending'
      ? 'bg-violet-500'
      : s === 'future'
      ? 'bg-gray-200'
      : 'bg-red-400';

  const selectedAttendance = attendance.find(a => a.day === selectedDate);

  /* ===================== UI ===================== */

  if (isLoading) {
    return (
      <div className="min-h-screen flex justify-center items-center">
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
          <CardContent className="flex items-center justify-between p-4">
            <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
              <ChevronLeft />
            </Button>

            <h2 className="font-semibold">{format(currentMonth, 'MMMM yyyy')}</h2>

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
          <CardContent className="grid grid-cols-7 gap-1 p-4">
            {eachDayOfInterval({
              start: startOfMonth(currentMonth),
              end: endOfMonth(currentMonth),
            }).map(d => {
              const ds = format(d, 'yyyy-MM-dd');
              const st = getDayStatus(d);
              return (
                <button
                  key={ds}
                  onClick={() => setSelectedDate(ds)}
                  className="aspect-square flex flex-col items-center justify-center rounded hover:bg-muted"
                >
                  <span className="text-xs">{format(d, 'd')}</span>
                  <div className={`w-3 h-3 rounded-full ${getColor(st)}`} />
                </button>
              );
            })}
          </CardContent>
        </Card>

        {/* DAY DETAILS */}
        <Dialog open={!!selectedDate} onOpenChange={() => setSelectedDate(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {selectedDate && format(new Date(selectedDate), 'PPP')}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-2 text-sm">
              <p><strong>Check In:</strong> {selectedAttendance?.checkin_at ? format(new Date(selectedAttendance.checkin_at), 'hh:mm a') : '-'}</p>
              <p><strong>Check Out:</strong> {selectedAttendance?.checkout_at ? format(new Date(selectedAttendance.checkout_at), 'hh:mm a') : '-'}</p>
              <p><strong>Remarks:</strong></p>
              <div className="p-2 bg-muted rounded">
                {selectedAttendance?.remarks || '—'}
              </div>
            </div>
          </DialogContent>
        </Dialog>

      </main>
    </div>
  );
};

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