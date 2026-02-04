import { useEffect, useState, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import Header from '@/components/Header';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';
import { Html5Qrcode } from 'html5-qrcode';
import { validate as isUuid} from 'uuid';


/* ===================== TYPES ===================== */

interface AttendanceRecord {
  id: string;
  day: string;
  checkin_at: string | null;
  checkout_at: string | null;
  attendance_type?: 'full' | 'half' | null;
  remarks?: string | null;
}

/* ===================== REALTIME HOOK ===================== */

const useRealtimeAttendance = (
  userId: string | null,
  callback: () => void
) => {
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`rt-attendance-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'attendance',
          filter: `emp_user_id=eq.${userId}`,
        },
        callback
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);
};

/* ===================== COMPONENT ===================== */

const AttendanceScan = () => {
  const { user } = useAuth();
  const scannerRef = useRef<Html5Qrcode | null>(null);

  const [todayAttendance, setTodayAttendance] =
    useState<AttendanceRecord | null>(null);

  const today = new Date().toISOString().split('T')[0];
  const monthYear = today.slice(0, 7) + '-01';

  /* ===================== FETCH ===================== */

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

    setTodayAttendance({
      id: data.id,
      day: data.day,
      checkin_at: data.checkin_at,
      checkout_at: data.checkout_at,
      attendance_type:
        data.attendance_type === 'full' || data.attendance_type === 'half'
          ? data.attendance_type
          : null,
    });
  };

  /* ===================== REALTIME ===================== */

  useEffect(() => {
    if (user) fetchTodayAttendance();
  }, [user]);

  useRealtimeAttendance(user?.id ?? null, fetchTodayAttendance);
  useEffect(() => {
    if (!user) return;

    const html5QrCode = new Html5Qrcode("qr-reader");
    scannerRef.current = html5QrCode;

    html5QrCode
      .start(
        { facingMode: "environment" }, // back camera
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
        },
        async (decodedText) => {
          // decodedText = site_id from QR
          await html5QrCode.stop();
          await processAttendance(decodedText);
        },
        () => {}
      )
      .catch((err) => {
        toast({
          title: "Camera Error",
          description: "Camera permission denied or not available",
          variant: "destructive",
        });
        console.error(err);
      });

    return () => {
      html5QrCode
        .stop()
        .catch(() => {})
        .finally(() => {
          html5QrCode.clear();
        });
    };
  }, [user]);

  /* ===================== CORE ===================== */

  const processAttendance = async (siteId: string) => {
    if (!user) return;
    if (!isUuid(siteId)) {
      toast({
        title: 'Invalid QR Code',
        description: 'The scanned QR code is not valid',
        variant: 'destructive',
      });
      return;
    }

    const nowIST = new Date(
      new Date().toLocaleString('en-US', {
        timeZone: 'Asia/Kolkata',
      })
    );

    /* 🔐 SINGLE-SCAN LOCK */
    if (todayAttendance?.checkout_at) {
      toast({
        title: 'Attendance Completed',
        description: 'You have already checked out today',
        variant: 'destructive',
      });
      return;
    }

    /* -------- CHECK IN -------- */
    if (!todayAttendance) {
      const {  error: insertError } = await supabase.from('attendance').insert({
        emp_user_id: user.id,
        site_id: siteId,
        day: today,
        checkin_at: nowIST.toISOString(),
      });
      if (insertError) {
        toast({
          title: 'Check-In Failed',
          description: insertError.message,
          variant: 'destructive',
        });
        return;
      }
      await fetchTodayAttendance();

      toast({ title: 'Checked In' });
      return;
    }

    /* -------- CHECK OUT -------- */


    const { error: updateError } = await supabase
      .from('attendance')
      .update({
        checkout_at: nowIST.toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', todayAttendance.id);
      if (updateError) {
        toast({
          title: 'Check-Out Failed',
          description: updateError.message,
          variant: 'destructive',
        });
        return;
      }

    await fetchTodayAttendance();

    toast({
      title: 'Checked Out',
      description:'Attendance process completed for today.',   
    });
  };

  /* ===================== SALARY CREDIT (SAFE) ===================== */


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

        <Card>
          <CardContent className="pt-6">
            <div id="qr-reader" className="w-full max-w-sm mx-auto" />
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default AttendanceScan;