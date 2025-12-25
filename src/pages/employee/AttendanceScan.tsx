import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import Header from '@/components/Header';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';
import { Html5Qrcode } from 'html5-qrcode';

/* ===================== TYPES ===================== */

interface AttendanceRecord {
  id: string;
  day: string;
  checkin_at: string | null;
  checkout_at: string | null;
  attendance_type?: 'full' | 'half' | null;
}

/* ===================== COMPONENT ===================== */

const AttendanceScan = () => {
  const { user } = useAuth();
  const scannerRef = useRef<Html5Qrcode | null>(null);

  const [todayAttendance, setTodayAttendance] =
    useState<AttendanceRecord | null>(null);

  const today = new Date().toISOString().split('T')[0];

  /* ===================== FETCH ===================== */

  useEffect(() => {
    if (user) fetchTodayAttendance();
  }, [user]);

  const fetchTodayAttendance = async () => {
    if (!user) return;

    const { data } = await supabase
      .from('attendance')
      .select('*')
      .eq('emp_user_id', user.id)
      .eq('day', today)
      .maybeSingle();

    if (!data) {
      setTodayAttendance(null);
      return;
    }

    // ✅ TYPE-SAFE MAPPING (CRITICAL FIX)
    const mappedAttendance: AttendanceRecord = {
      id: data.id,
      day: data.day,
      checkin_at: data.checkin_at,
      checkout_at: data.checkout_at,
      attendance_type:
        data.attendance_type === 'full' || data.attendance_type === 'half'
          ? data.attendance_type
          : null,
    };

    setTodayAttendance(mappedAttendance);
  };

  /* ===================== CORE ===================== */

  const processAttendance = async (siteId: string) => {
    if (!user) return;

    const nowIST = new Date(
      new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' })
    );

    /* -------- CHECK IN -------- */
    if (!todayAttendance) {
      await supabase.from('attendance').insert({
        emp_user_id: user.id,
        site_id: siteId,
        day: today,
        checkin_at: nowIST.toISOString(),
      });

      toast({ title: 'Checked In' });
    }

    /* -------- CHECK OUT -------- */
    else if (!todayAttendance.checkout_at) {
      const checkInTime = new Date(
        new Date(todayAttendance.checkin_at!).toLocaleString('en-US', {
          timeZone: 'Asia/Kolkata',
        })
      );

      const isHalfDay =
        checkInTime.getHours() > 10 ||
        nowIST.getHours() < 13;

      const attendanceType: 'full' | 'half' = isHalfDay ? 'half' : 'full';

      await supabase
        .from('attendance')
        .update({
          checkout_at: nowIST.toISOString(),
          attendance_type: attendanceType,
        })
        .eq('id', todayAttendance.id);

      /* 🔥 CREDIT DAILY WAGE HERE */
      await creditDailyWage(attendanceType);

      toast({
        title: 'Checked Out',
        description:
          attendanceType === 'half'
            ? 'Half Day Salary Credited'
            : 'Full Day Salary Credited',
      });
    }

    /* -------- ALREADY DONE -------- */
    else {
      toast({
        title: 'Attendance Completed',
        variant: 'destructive',
      });
    }

    fetchTodayAttendance();
  };

  /* ===================== SALARY CREDIT ===================== */

  const creditDailyWage = async (type: 'full' | 'half') => {
    if (!user) return;

    const { data: emp } = await supabase
      .from('employees')
      .select('daily_wage')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!emp?.daily_wage) return;

    const amount =
      type === 'full' ? emp.daily_wage : emp.daily_wage / 2;

    await supabase.from('money_ledger').insert({
      emp_user_id: user.id,
      amount,
      type: 'credit',
      reason: `Daily Wage (${type.toUpperCase()})`,
      month_year: today.slice(0, 7) + '-01',
      created_by: user.id,
    });
  };

  /* ===================== UI (UNCHANGED) ===================== */

  return (
    <div className="min-h-screen bg-background">
      <Header title="QR Attendance" backTo="/employee/attendance" />

      <main className="p-4 max-w-2xl mx-auto space-y-4">
        <Card>
          <CardContent className="pt-6 text-center">
            Attendance system ready
          </CardContent>
        </Card>

        {/* 🔒 YOUR EXISTING QR SCANNER UI CONTINUES HERE */}
      </main>
    </div>
  );
};

export default AttendanceScan;