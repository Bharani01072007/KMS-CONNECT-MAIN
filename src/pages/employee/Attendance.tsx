import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import Header from '@/components/Header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import {
  Clock,
  LogIn,
  LogOut,
  MapPin,
  History,
  QrCode,
} from 'lucide-react';
import { Link } from 'react-router-dom';

interface Site {
  id: string;
  name: string;
  address: string | null;
}

interface AttendanceRecord {
  id: string;
  day: string;
  checkin_at: string | null;
  checkout_at: string | null;
  site_id: string;
}

const EmployeeAttendance = () => {
  const { user } = useAuth();
  const [sites, setSites] = useState<Site[]>([]);
  const [selectedSite, setSelectedSite] = useState('');
  const [todayAttendance, setTodayAttendance] =
    useState<AttendanceRecord | null>(null);
  const [summary, setSummary] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [history, setHistory] = useState<AttendanceRecord[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  const today = new Date().toISOString().split('T')[0];

  /* ===================== FETCH ===================== */

  const fetchData = async () => {
    if (!user) return;

    const { data: sitesData } = await supabase
      .from('sites')
      .select('id, name, address')
      .order('name');

    if (sitesData) setSites(sitesData);

    const { data: todayData } = await supabase
      .from('attendance')
      .select('*')
      .eq('emp_user_id', user.id)
      .eq('day', today)
      .maybeSingle();

    setTodayAttendance(todayData);

    const { data: historyData } = await supabase
      .from('attendance')
      .select('*')
      .eq('emp_user_id', user.id)
      .order('day', { ascending: false })
      .limit(30);

    if (historyData) setHistory(historyData);
  };

  /* ===================== REALTIME ===================== */

  useEffect(() => {
    if (!user) return;

    fetchData();

    const channel = supabase
      .channel(`employee-attendance-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'attendance',
          filter: `emp_user_id=eq.${user.id}`,
        },
        () => {
          fetchData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  /* ===================== ACTIONS ===================== */

  const handleCheckIn = async () => {
    if (!selectedSite) {
      toast({
        title: 'Error',
        description: 'Please select a site',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase.from('attendance').insert({
        emp_user_id: user!.id,
        site_id: selectedSite,
        day: today,
        checkin_at: new Date().toISOString(),
      });

      if (error) throw error;

      toast({ title: 'Success', description: 'Checked in successfully!' });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCheckOut = async () => {
    if (!todayAttendance) return;

    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('attendance')
        .update({ checkout_at: new Date().toISOString(),
          remarks: summary.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', todayAttendance.id);

      if (error) throw error;

      toast({ title: 'Success', description: 'Checked out successfully!' });
      setSummary('');
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  /* ===================== HELPERS ===================== */

  const formatTime = (time: string | null) =>
    time
      ? new Date(time).toLocaleTimeString('en-IN', {
          hour: '2-digit',
          minute: '2-digit',
        })
      : '-';

  const formatDate = (date: string) =>
    new Date(date).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });

  const getSiteName = (siteId: string) =>
    sites.find((s) => s.id === siteId)?.name || 'Unknown';

  /* ===================== UI ===================== */

  return (
    <div className="min-h-screen bg-background">
      <Header title="Attendance" backTo="/employee/dashboard" />

      <main className="p-4 max-w-2xl mx-auto space-y-4">
        <Link to="/employee/attendance/scan">
          <Button variant="outline" className="w-full" size="lg">
            <QrCode className="h-5 w-5 mr-2" />
            Scan QR to Check In/Out
          </Button>
        </Link>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Today - {formatDate(today)}
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-4">
            {!todayAttendance ? (
              <>
                <div className="p-4 bg-muted rounded-lg text-center">
                  <p className="text-muted-foreground">
                    Not checked in yet
                  </p>
                </div>

                <Select
                  value={selectedSite}
                  onValueChange={setSelectedSite}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select work site" />
                  </SelectTrigger>
                  <SelectContent>
                    {sites.map((site) => (
                      <SelectItem key={site.id} value={site.id}>
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4" />
                          {site.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Button
                  onClick={handleCheckIn}
                  disabled={isLoading}
                  className="w-full"
                  size="lg"
                >
                  <LogIn className="h-5 w-5 mr-2" />
                  Check In
                </Button>
              </>
            ) : !todayAttendance.checkout_at ? (
              <>
                <div className="p-4 bg-green-500/10 rounded-lg">
                  <div className="flex justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">
                        Checked in at
                      </p>
                      <p className="text-xl font-bold text-green-600">
                        {formatTime(todayAttendance.checkin_at)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">
                        Site
                      </p>
                      <p className="font-medium">
                        {getSiteName(todayAttendance.site_id)}
                      </p>
                    </div>
                  </div>
                </div>

                <Textarea
                  placeholder="Work summary (optional)"
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  rows={3}
                />

                <Button
                  onClick={handleCheckOut}
                  disabled={isLoading}
                  variant="destructive"
                  className="w-full"
                  size="lg"
                >
                  <LogOut className="h-5 w-5 mr-2" />
                  Check Out
                </Button>
              </>
            ) : (
              <div className="p-4 bg-muted rounded-lg">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">
                      Check In
                    </p>
                    <p className="font-bold text-green-600">
                      {formatTime(todayAttendance.checkin_at)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">
                      Check Out
                    </p>
                    <p className="font-bold text-primary">
                      {formatTime(todayAttendance.checkout_at)}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Button
          variant="outline"
          className="w-full"
          onClick={() => setShowHistory(!showHistory)}
        >
          <History className="h-4 w-4 mr-2" />
          {showHistory ? 'Hide History' : 'View Attendance History'}
        </Button>

        {showHistory && (
          <Card>
            <CardHeader>
              <CardTitle>Attendance History</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {history.length === 0 ? (
                  <p className="text-center text-muted-foreground py-4">
                    No attendance records
                  </p>
                ) : (
                  history.map((record) => (
                    <div
                      key={record.id}
                      className="p-3 bg-muted/50 rounded-lg"
                    >
                      <div className="flex justify-between">
                        <div>
                          <p className="font-medium">
                            {formatDate(record.day)}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {getSiteName(record.site_id)}
                          </p>
                        </div>
                        <div className="text-sm text-right">
                          <p>In: {formatTime(record.checkin_at)}</p>
                          <p>Out: {formatTime(record.checkout_at)}</p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
};

export default EmployeeAttendance;