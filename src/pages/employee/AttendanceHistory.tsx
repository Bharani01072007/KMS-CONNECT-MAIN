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
  attendance_type: string | null;
}

interface LeaveRecord {
  start_date: string;
  end_date: string;
}

interface holidayRecord {
  holiday_date: string;
  description?: string | null;
  
}


/* ===================== COMPONENT ===================== */

const AttendanceHistory = () => {
  const { user } = useAuth();
  const [holidays, setHolidays] = useState<holidayRecord[]>([]);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [leaves, setLeaves] = useState<LeaveRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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

    const start = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
    const end = format(endOfMonth(currentMonth), 'yyyy-MM-dd');

    const { data: attData } = await supabase
      .from('attendance')
      .select('day, attendance_type')
      .eq('emp_user_id', user.id)
      .gte('day', start)
      .lte('day', end);

    const { data: leaveData } = await supabase
      .from('leaves')
      .select('start_date, end_date')
      .eq('emp_user_id', user.id)
      .eq('status', 'approved');

    const attendanceRows = attData || [];
    const leaveRows = leaveData || [];

    setAttendance(attendanceRows);
    setLeaves(leaveRows);

    /* ===================== SUMMARY ===================== */

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
      const dateStr = format(day, 'yyyy-MM-dd');

      // Skip future days
      if (dateStr > todayStr) return;
      if (holidayData?.some(h => h.holiday_date === dateStr)) {
        leave++;
        return;
      }

      // Approved leave
      if (leaveRows.some(l => dateStr >= l.start_date && dateStr <= l.end_date)) {
        leave++;
        return;
      }

      const record = attendanceRows.find(a => a.day === dateStr);

      // Today without check-in → pending (not absent)
      if (dateStr === todayStr && !record) return;

      if (!record || record.attendance_type === 'absent') absent++;
      else if (record.attendance_type === 'full') present++;
      else if (record.attendance_type === 'half') half++;
    });

    setSummary({ present, halfDays: half, leaves: leave, absent });
    setIsLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [user, currentMonth]);

  /* ===================== HELPERS ===================== */

  const getDayStatus = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const todayStr = format(new Date(), 'yyyy-MM-dd');

    // Future days
    if (dateStr > todayStr) return 'future';

    if (holidays.some(h => h.holiday_date === dateStr)) return 'leave';

    // Approved leave
    if (leaves.some(l => dateStr >= l.start_date && dateStr <= l.end_date))
      return 'leave';

    const record = attendance.find(a => a.day === dateStr);

    // Today but not checked in yet
    if (!record && dateStr === todayStr) return 'pending';

    if (record?.attendance_type === 'full') return 'present';
    if (record?.attendance_type === 'half') return 'half';

    // Past day missed
    return 'absent';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'present': return 'bg-green-500';
      case 'half': return 'bg-yellow-500';
      case 'leave': return 'bg-blue-500';
      case 'absent': return 'bg-red-400';
      case 'pending': return 'bg-violet-500'; // ✅ violet
      case 'future': return 'bg-gray-200';
      default: return 'bg-gray-200';
    }
  };

  const daysInMonth = eachDayOfInterval({
    start: startOfMonth(currentMonth),
    end: endOfMonth(currentMonth),
  });

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const offset = startOfMonth(currentMonth).getDay();

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
      <Header title="Attendance History" backTo="/employee/dashboard" />

      <main className="p-4 max-w-lg mx-auto space-y-4">

        {/* MONTH NAV */}
        <Card>
          <CardContent className="p-4 flex justify-between items-center">
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
                <div key={d} className="text-xs text-center text-muted-foreground">{d}</div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: offset }).map((_, i) => <div key={i} />)}
              {daysInMonth.map(d => {
                const status = getDayStatus(d);
                return (
                  <div key={d.toISOString()} className="aspect-square flex flex-col items-center justify-center">
                    <span className="text-xs">{format(d, 'd')}</span>
                    <div className={`w-3 h-3 rounded-full ${getStatusColor(status)}`} />
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
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

export default AttendanceHistory;