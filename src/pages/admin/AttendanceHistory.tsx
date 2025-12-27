import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import Header from '@/components/Header';
import {
  Card, CardContent, CardHeader, CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Loader2, Calendar, ChevronLeft, ChevronRight,
  CheckCircle, XCircle, Clock, Plane,
} from 'lucide-react';
import {
  format, startOfMonth, endOfMonth,
  eachDayOfInterval, isSameMonth,
  addMonths, subMonths,
} from 'date-fns';

interface AttendanceRecord {
  day: string;
  checkin_at: string | null;
  checkout_at: string | null;
}

interface LeaveRecord {
  start_date: string;
  end_date: string;
}

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

    // 🔑 STEP A — GET PROFILE ID
    const { data: profile, error: pErr } = await supabase
      .from('profiles')
      .select('id')
      .eq('auth_uid', user.id)
      .maybeSingle();

    if (pErr || !profile) {
      console.error('Profile not found', pErr);
      setIsLoading(false);
      return;
    }

    const profileId = profile.id;

    const start = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
    const end = format(endOfMonth(currentMonth), 'yyyy-MM-dd');

    const { data: att } = await supabase
      .from('attendance')
      .select('day, checkin_at, checkout_at')
      .eq('emp_user_id', profileId)
      .gte('day', start)
      .lte('day', end);

    const { data: lv } = await supabase
      .from('leaves')
      .select('start_date, end_date')
      .eq('emp_user_id', profileId)
      .eq('status', 'approved');

    const attRows = att ?? [];
    const leaveRows = lv ?? [];

    setAttendance(attRows);
    setLeaves(leaveRows);

    /* ===================== SUMMARY ===================== */

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const validDays = eachDayOfInterval({
      start: startOfMonth(currentMonth),
      end: today < endOfMonth(currentMonth) ? today : endOfMonth(currentMonth),
    });

    let present = 0, half = 0, leave = 0, absent = 0;

    validDays.forEach(d => {
      const ds = format(d, 'yyyy-MM-dd');

      if (leaveRows.some(l => ds >= l.start_date && ds <= l.end_date)) {
        leave++;
        return;
      }

      const r = attRows.find(a => a.day === ds);
      if (r?.checkout_at) present++;
      else if (r?.checkin_at) half++;
      else absent++;
    });

    setSummary({ present, half, leave, absent });
    setIsLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [user, currentMonth]);

  /* ===================== HELPERS ===================== */

  const getStatus = (d: Date) => {
    const ds = format(d, 'yyyy-MM-dd');
    if (leaves.some(l => ds >= l.start_date && ds <= l.end_date)) return 'leave';
    const r = attendance.find(a => a.day === ds);
    if (r?.checkout_at) return 'present';
    if (r?.checkin_at) return 'half';
    return 'absent';
  };

  const color = (s: string) =>
    s === 'present' ? 'bg-green-500'
    : s === 'half' ? 'bg-yellow-500'
    : s === 'leave' ? 'bg-blue-500'
    : 'bg-red-400';

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin" />
    </div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <Header title="Attendance History" backTo="/employee/dashboard" />

      <main className="p-4 max-w-lg mx-auto space-y-4">

        <Card>
          <CardContent className="p-4 flex justify-between">
            <Button variant="ghost" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
              <ChevronLeft />
            </Button>
            <h2>{format(currentMonth, 'MMMM yyyy')}</h2>
            <Button
              variant="ghost"
              onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
              disabled={isSameMonth(currentMonth, new Date())}
            >
              <ChevronRight />
            </Button>
          </CardContent>
        </Card>

        <div className="grid grid-cols-4 gap-2">
          <Summary icon={<CheckCircle className="text-green-500" />} label="Present" value={summary.present} />
          <Summary icon={<Clock className="text-yellow-500" />} label="Half" value={summary.half} />
          <Summary icon={<Plane className="text-blue-500" />} label="Leave" value={summary.leave} />
          <Summary icon={<XCircle className="text-red-400" />} label="Absent" value={summary.absent} />
        </div>

        <Card>
          <CardHeader>
            <CardTitle><Calendar className="inline mr-2" />Calendar</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-7 gap-1">
            {eachDayOfInterval({
              start: startOfMonth(currentMonth),
              end: endOfMonth(currentMonth),
            }).map(d => (
              <button
                key={d.toISOString()}
                onClick={() => setSelectedDate(format(d, 'yyyy-MM-dd'))}
                className="aspect-square flex flex-col items-center justify-center"
              >
                <span className="text-xs">{format(d, 'd')}</span>
                <div className={`w-3 h-3 rounded-full ${color(getStatus(d))}`} />
              </button>
            ))}
          </CardContent>
        </Card>

        <Dialog open={!!selectedDate} onOpenChange={() => setSelectedDate(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{selectedDate}</DialogTitle>
            </DialogHeader>
            {attendance.find(a => a.day === selectedDate) ? (
              <>
                <p>Check In: {attendance.find(a => a.day === selectedDate)?.checkin_at ?? '-'}</p>
                <p>Check Out: {attendance.find(a => a.day === selectedDate)?.checkout_at ?? '-'}</p>
              </>
            ) : <p>No attendance</p>}
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
      <p className="text-xs">{label}</p>
    </CardContent>
  </Card>
);

export default AttendanceHistory;