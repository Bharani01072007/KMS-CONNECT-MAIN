import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
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
    if (!user) return;

    setIsLoading(true);

    /* ===================== 🔍 AUTH VERIFICATION ===================== */
    const { data: sessionData } = await supabase.auth.getSession();
    console.log('🔐 SESSION:', sessionData.session);
    console.log('🆔 AUTH UID:', sessionData.session?.user?.id);
    console.log('👤 CONTEXT USER ID:', user.id);

    const start = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
    const end = format(endOfMonth(currentMonth), 'yyyy-MM-dd');

    /* ===================== 🔍 ATTENDANCE FETCH ===================== */
    const { data: attData, error: attErr } = await supabase
      .from('attendance')
      .select('*')
      .gte('day', start)
      .lte('day', end);

    console.log('📋 ATTENDANCE ROWS:', attData);
    console.log('❌ ATTENDANCE ERROR:', attErr);

    /* ===================== 🔍 LEAVE FETCH ===================== */
    const { data: leaveData, error: leaveErr } = await supabase
      .from('leaves')
      .select('start_date, end_date')
      .eq('emp_user_id', user.id)
      .eq('status', 'approved');

    if (attErr || leaveErr) {
      console.error('🚨 FETCH ERROR:', attErr || leaveErr);
      setIsLoading(false);
      return;
    }

    const attRows = (attData ?? []).filter(a => a.emp_user_id === user.id);
    const leaveRows = leaveData ?? [];

    console.log('✅ FILTERED ATTENDANCE (USER ONLY):', attRows);

    setAttendance(attRows);
    setLeaves(leaveRows);

    /* ===================== SUMMARY ===================== */

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

    validDays.forEach(date => {
      const dateStr = format(date, 'yyyy-MM-dd');

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

    console.log('📊 SUMMARY:', { present, half, leave, absent });

    setSummary({ present, half, leave, absent });
    setIsLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [user, currentMonth]);

  /* ===================== HELPERS ===================== */

  const isLeaveDay = (dateStr: string) =>
    leaves.some(l => dateStr >= l.start_date && dateStr <= l.end_date);

  const getDayStatus = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (date > today) return 'future';
    if (isLeaveDay(dateStr)) return 'leave';

    const rec = attendance.find(a => a.day === dateStr);
    if (rec?.checkout_at) return 'present';
    if (rec?.checkin_at) return 'half';

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
        return 'bg-gray-200';
    }
  };

  const selectedAttendance = attendance.find(a => a.day === selectedDate);

  const selectedStatus = selectedDate
    ? isLeaveDay(selectedDate)
      ? 'Leave'
      : selectedAttendance?.checkout_at
      ? 'Present'
      : selectedAttendance?.checkin_at
      ? 'Half Day'
      : 'Absent'
    : '';

  const daysInMonth = eachDayOfInterval({
    start: startOfMonth(currentMonth),
    end: endOfMonth(currentMonth),
  });

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
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
      <Header title="Attendance History" backTo="/employee/dashboard" />

      <main className="p-4 max-w-lg mx-auto space-y-4">
        {/* UI UNCHANGED */}
      </main>
    </div>
  );
};

export default AttendanceHistory;