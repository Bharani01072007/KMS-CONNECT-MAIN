import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import Header from '@/components/Header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
  checkin_at: string | null;
  checkout_at: string | null;
}

interface LeaveRecord {
  start_date: string;
  end_date: string;
}

/* ===================== COMPONENT ===================== */

const AttendanceHistory = () => {
  const { user } = useAuth();

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
    if (!user) return;
    setIsLoading(true);

    const start = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
    const end = format(endOfMonth(currentMonth), 'yyyy-MM-dd');

    const { data: att } = await supabase
      .from('attendance')
      .select('day, checkin_at, checkout_at')
      .eq('emp_user_id', user.id)
      .gte('day', start)
      .lte('day', end);

    const { data: leaveData } = await supabase
      .from('leaves')
      .select('start_date, end_date')
      .eq('emp_user_id', user.id)
      .eq('status', 'approved');

    const attendanceRows = att || [];
    const leaveRows = leaveData || [];

    setAttendance(attendanceRows);
    setLeaves(leaveRows);

    /* ===================== SUMMARY (FIXED) ===================== */

    let present = 0;
    let half = 0;

    attendanceRows.forEach(a => {
      if (a.checkout_at) present++;
      else if (a.checkin_at) half++;
    });

    const leaveDays = leaveRows.reduce((sum, l) => {
      return (
        sum +
        eachDayOfInterval({
          start: new Date(l.start_date),
          end: new Date(l.end_date),
        }).length
      );
    }, 0);

    const validDays = eachDayOfInterval({
      start: startOfMonth(currentMonth),
      end: endOfMonth(currentMonth),
    });

    const absent =
      validDays.length - present - half - leaveDays;

    setSummary({
      present,
      half,
      leave: leaveDays,
      absent: Math.max(0, absent),
    });

    setIsLoading(false);
  };

  /* ===================== REALTIME ===================== */

  useEffect(() => {
    if (!user) return;

    fetchData();

    const channel = supabase
      .channel(`attendance-history-${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'attendance' },
        fetchData
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'leaves' },
        fetchData
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, currentMonth]);

  /* ===================== HELPERS ===================== */

  const isLeave = (date: string) =>
    leaves.some(l => date >= l.start_date && date <= l.end_date);

  const getStatus = (date: Date) => {
    const d = format(date, 'yyyy-MM-dd');
    if (isLeave(d)) return 'leave';

    const a = attendance.find(x => x.day === d);
    if (a?.checkout_at) return 'present';
    if (a?.checkin_at) return 'half';
    return 'absent';
  };

  const color = (s: string) =>
    s === 'present'
      ? 'bg-green-500'
      : s === 'half'
      ? 'bg-yellow-500'
      : s === 'leave'
      ? 'bg-blue-500'
      : 'bg-red-400';

  const selectedAttendance = attendance.find(a => a.day === selectedDate);

  /* ===================== UI ===================== */

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const days = eachDayOfInterval({
    start: startOfMonth(currentMonth),
    end: endOfMonth(currentMonth),
  });

  return (
    <div className="min-h-screen bg-background">
      <Header title="Attendance History" backTo="/employee/dashboard" />

      <main className="p-4 max-w-lg mx-auto space-y-4">
        {/* MONTH NAV */}
        <Card>
          <CardContent className="flex justify-between items-center p-4">
            <Button size="icon" variant="ghost" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
              <ChevronLeft />
            </Button>
            <h2 className="font-semibold">{format(currentMonth, 'MMMM yyyy')}</h2>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
              disabled={isSameMonth(currentMonth, new Date())}
            >
              <ChevronRight />
            </Button>
          </CardContent>
        </Card>

        {/* SUMMARY */}
        <div className="grid grid-cols-4 gap-2">
          <Summary icon={<CheckCircle />} label="Present" value={summary.present} />
          <Summary icon={<Clock />} label="Half Day" value={summary.half} />
          <Summary icon={<Plane />} label="Leaves" value={summary.leave} />
          <Summary icon={<XCircle />} label="Absent" value={summary.absent} />
        </div>

        {/* CALENDAR */}
        <Card>
          <CardHeader>
            <CardTitle>
              <Calendar className="inline h-4 w-4 mr-2" />
              Calendar
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-7 gap-1">
            {days.map(d => (
              <button
                key={d.toISOString()}
                onClick={() => setSelectedDate(format(d, 'yyyy-MM-dd'))}
                className="aspect-square flex flex-col items-center justify-center rounded hover:bg-muted"
              >
                <span className="text-xs">{format(d, 'd')}</span>
                <div className={`w-3 h-3 rounded-full ${color(getStatus(d))}`} />
              </button>
            ))}
          </CardContent>
        </Card>

        {/* DAY DETAILS */}
        {selectedDate && (
          <Card>
            <CardHeader>
              <CardTitle>{format(new Date(selectedDate), 'PPP')}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-1">
              <p><b>Check In:</b> {selectedAttendance?.checkin_at ? format(new Date(selectedAttendance.checkin_at), 'hh:mm a') : '-'}</p>
              <p><b>Check Out:</b> {selectedAttendance?.checkout_at ? format(new Date(selectedAttendance.checkout_at), 'hh:mm a') : '-'}</p>
              <p><b>Status:</b> {getStatus(new Date(selectedDate)).toUpperCase()}</p>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
};

/* ===================== SUMMARY CARD ===================== */

const Summary = ({ icon, label, value }: any) => (
  <Card>
    <CardContent className="p-3 text-center">
      {icon}
      <p className="font-bold">{value}</p>
      <p className="text-xs">{label}</p>
    </CardContent>
  </Card>
);

export default AttendanceHistory;