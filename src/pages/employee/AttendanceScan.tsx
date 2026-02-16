import { useEffect, useState, useRef, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import Header from '@/components/Header';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';
import { Html5Qrcode, Html5QrcodeScannerState } from 'html5-qrcode';
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
const isAfterCutoffIST = () => {
  const now = new Date(
    new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' })
  );
  const cutoff = new Date(now);
  cutoff.setHours(14, 0, 0, 0); // 2:00 PM IST
  return now > cutoff;
};

/* ===================== COMPONENT ===================== */

const AttendanceScan = () => {
  const { user } = useAuth();
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const isProcessingRef = useRef(false);

  const [todayAttendance, setTodayAttendance] =
    useState<AttendanceRecord | null>(null);

  const today = new Date().toISOString().split('T')[0];
  const monthYear = today.slice(0, 7) + '-01';
  const afterCutoff = useMemo(isAfterCutoffIST, []); // Helper function to determine if current time is after cutoff

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
  const safeStopScanner = async () => {
  const scanner = scannerRef.current;
  if (!scanner) return;

  try {
    const state = scanner.getState();
    if (state === Html5QrcodeScannerState.SCANNING) {
      await scanner.stop();
    }
  } catch {
    // ignore safely
  } finally {
    scanner.clear();
    scannerRef.current = null;
  }
};
  

  /* ===================== REALTIME ===================== */

  useEffect(() => {
    if (user) fetchTodayAttendance();
  }, [user]);

  useRealtimeAttendance(user?.id ?? null, fetchTodayAttendance);
  useEffect(() => {
    if (!user) return;
    if(afterCutoff && !todayAttendance) {
      toast({
        title: "Attendance Cutoff",
        description: "check-in after 2:00 PM  is not allowed.You are marked absent for today.",
        variant: "destructive",
      });
      safeStopScanner();
      return;
    }
    if(todayAttendance) {
      return;
    }

    const html5QrCode = new Html5Qrcode("qr-reader");
    scannerRef.current = html5QrCode;

    html5QrCode
      .start(
        { facingMode: "environment" }, // back camera
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
        },
        async (decodedText) => {await safeStopScanner();
          // decodedText = site_id from QR
          let siteid:string;
          try{
            siteid = JSON.parse(decodedText).site_id;
          } catch  {
            toast({
              title: "Invalid QR Code",
              description: "The scanned QR code is not valid",
              variant: "destructive",
            });
            return;
          }
          await processAttendance(siteid);
        },
        () => {}
      )
      .catch((err) => {
        toast({
          title: "Camera Error",
          description: "Camera permission denied or not available",
          variant: "destructive",
        });

      });

    return () => {
      safeStopScanner();
    };
  }, [user,todayAttendance,afterCutoff]);

  /* ===================== CORE ===================== */

  const processAttendance = async (siteId: string) => {
    if (!user) return;
    if (isProcessingRef.current) return;
    isProcessingRef.current = true;
    try{
      if (!isUuid(siteId)) {
        toast({
          title: 'Invalid QR Code',
          description: 'The scanned QR code is not valid',
          variant: 'destructive',
        });
        return;
      }
    if(todayAttendance) {
      toast({
        title: 'Attendance Already Completed',
        description: 'You have already checked in today',
        variant: 'destructive',
      });
      return;
    } 
    const nowIST = new Date(
      new Date().toLocaleString('en-US', {
        timeZone: 'Asia/Kolkata',
      })
    );

    const {error} = await supabase
      .from('attendance').insert({
        emp_user_id: user.id,
        site_id: siteId,
        day: today,
        checkin_at: nowIST.toISOString(),
      });
    if (error) {
      toast({
        title: 'Check-In Failed',
        description: error.message,
        variant: 'destructive',
      });
      return;
    }
    await fetchTodayAttendance();
    toast({ title: 'Checked In', description: 'You have successfully checked in.' });
    } finally {
      setTimeout(() => {
        isProcessingRef.current = false;
      }, 3000); // 3 seconds lock to prevent rapid scans
    }
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