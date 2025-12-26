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
  attendance_type: 'full' | 'half' | null;
  checkin_at: string | null;
  checkout_at: string | null;
}

interface LeaveRecord {
  start_date: string;
  end_date: string;
  status: string | null;
}

/* ===================== COMPONENT ===================== */

const AttendanceHistory = () => {
  const { user } = useAuth();

  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [leaves, setLeaves] = useState<LeaveRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const [summary, setSummary] = useState({
    present: 0,
    halfDays: 0,
    leaves: 0,
    absent: 0,
  });

  /* ===================== FETCH ===================== */

  const fetchData = async () => {
    if (!user) return;

    setIsLoading(true);

    const monthStart = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
    const monthEnd = format(endOfMonth(currentMonth), 'yyyy-MM-dd');

    const { data: attData } = await supabase
      .from('attendance')
      .select('day, attendance_type, checkin_at, checkout_at')
      .eq('emp_user_id', user.id)
      .gte('day', monthStart)
      .lte('day', monthEnd);

    const { data: leaveData } = await supabase
      .from('leaves')
      .select('start_date, end_date, status')
      .eq('emp_user_id', user.id)
      .eq('status', 'approved');

    /* ✅ TYPE-SAFE MAPPING (FIXES ERROR) */
    const attendanceRows: AttendanceRecord[] =
      (attData || []).map(a => ({
        day: a.day,
        attendance_type:
          a.attendance_type === 'full' || a.attendance_type === 'half'
            ? a.attendance_type
            : null,
        checkin_at: a.checkin_at,
        checkout_at: a.checkout_at,
      }));

    const leaveRows = leaveData || [];

    setAttendance(attendanceRows);
    setLeaves(leaveRows);

    /* ===================== SUMMARY ===================== */

    const fullDays = attendanceRows.filter(a => a.attendance_type === 'full').length;
    const halfDays = attendanceRows.filter(a => a.attendance_type === 'half').length;

    const leaveDays = leaveRows.reduce((sum, l) => {
      const days = eachDayOfInterval({
        start: new Date(l.start_date),
        end: new Date(l.end_date),
      });
      return sum + days.length;
    }, 0);

    const today = new Date();
    const validDays = eachDayOfInterval({
      start: startOfMonth(currentMonth),
      end: today < endOfMonth(currentMonth) ? today : endOfMonth(currentMonth),
    });

    const absent =
      validDays.length - fullDays - halfDays - leaveDays;

    setSummary({
      present: fullDays,
      halfDays,
      leaves: leaveDays,
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

  const isDateInLeave = (dateStr: string) =>
    leaves.some(l => dateStr >= l.start_date && dateStr <= l.end_date);

  const getDayStatus = (date: Date): string => {
    const dateStr = format(date, 'yyyy-MM-dd');
    if (isDateInLeave(dateStr)) return 'leave';

    const att = attendance.find(a => a.day === dateStr);
    if (att?.attendance_type === 'full') return 'present';
    if (att?.attendance_type === 'half') return 'half';

    return 'absent';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'present':
        return 'bg-green-500';
      case 'half':
        return 'bg-yellow-500';
      case 'leave':
        return 'bg-blue-500';
      case 'absent':
        return 'bg-red-400';
      default:
        return 'bg-gray-200 dark:bg-gray-700';
    }
  };

  const selectedAttendance = attendance.find(a => a.day === selectedDate);

  const daysInMonth = eachDayOfInterval({
    start: startOfMonth(currentMonth),
    end: endOfMonth(currentMonth),
  });

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const firstDayOffset = startOfMonth(currentMonth).getDay();

  /* ===================== UI ===================== */

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Header title="Attendance History" backTo="/employee/dashboard" />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header title="Attendance History" backTo="/employee/dashboard" />

      <main className="p-4 max-w-lg mx-auto space-y-4">
        {/* MONTH NAV */}
        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
              <ChevronLeft />
            </Button>
            <h2 className="text-lg font-semibold">{format(currentMonth, 'MMMM yyyy')}</h2>
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
          <Summary icon={<Clock className="text-yellow-500" />} label="Half Day" value={summary.halfDays} />
          <Summary icon={<Plane className="text-blue-500" />} label="Leaves" value={summary.leaves} />
          <Summary icon={<XCircle className="text-red-400" />} label="Absent" value={summary.absent} />
        </div>

        {/* CALENDAR */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-4 w-4" /> Calendar View
            </CardTitle>
          </CardHeader>

          <CardContent className="p-4">
            <div className="grid grid-cols-7 gap-1 mb-2">
              {weekDays.map(d => (
                <div key={d} className="text-center text-xs font-medium text-muted-foreground">
                  {d}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: firstDayOffset }).map((_, i) => (
                <div key={i} />
              ))}

              {daysInMonth.map(date => {
                const dateStr = format(date, 'yyyy-MM-dd');
                const status = getDayStatus(date);
                return (
                  <button
                    key={date.toISOString()}
                    onClick={() => setSelectedDate(dateStr)}
                    className="aspect-square flex flex-col items-center justify-center rounded hover:bg-muted"
                  >
                    <span className="text-xs text-muted-foreground">{format(date, 'd')}</span>
                    <div className={`w-3 h-3 rounded-full ${getStatusColor(status)}`} />
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* SELECTED DAY DETAILS */}
        {selectedDate && (
          <Card>
            <CardHeader>
              <CardTitle>{format(new Date(selectedDate), 'PPP')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>
                <strong>Check In:</strong>{' '}
                {selectedAttendance?.checkin_at
                  ? format(new Date(selectedAttendance.checkin_at), 'hh:mm a')
                  : '-'}
              </p>
              <p>
                <strong>Check Out:</strong>{' '}
                {selectedAttendance?.checkout_at
                  ? format(new Date(selectedAttendance.checkout_at), 'hh:mm a')
                  : '-'}
              </p>
              <p>
                <strong>Status:</strong>{' '}
                {selectedAttendance?.attendance_type
                  ? selectedAttendance.attendance_type.toUpperCase()
                  : 'ABSENT'}
              </p>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
};

/* ===================== SUMMARY ===================== */

const Summary = ({ icon, label, value }: any) => (
  <Card>
    <CardContent className="p-3 text-center">
      {icon}
      <p className="text-lg font-bold">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </CardContent>
  </Card>
);

export default AttendanceHistory;