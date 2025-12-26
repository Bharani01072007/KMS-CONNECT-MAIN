import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import Header from '@/components/Header';
import AnnouncementBar from '@/components/AnnouncementBar';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Calendar, 
  Clock, 
  MessageSquare, 
  Wallet, 
  AlertCircle,
  CheckCircle,
  ChevronRight,
  Bell,
  XCircle,
  User,
  IndianRupee
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { startOfMonth, endOfMonth } from 'date-fns';

const EmployeeDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [employeeName, setEmployeeName] = useState<string>('');
  const [todayStatus, setTodayStatus] =
    useState<'not_checked' | 'checked_in' | 'checked_out'>('not_checked');
  const [inTime, setInTime] = useState<string | null>(null);
  const [outTime, setOutTime] = useState<string | null>(null);
  const [approvedLeavesThisMonth, setApprovedLeavesThisMonth] = useState(0);
  const [balance, setBalance] = useState(0);

  /* ===================== FETCH ===================== */

  const fetchData = async () => {
    if (!user) return;

    const { data: profileData } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('auth_uid', user.id)
      .maybeSingle();

    if (profileData?.full_name) {
      setEmployeeName(profileData.full_name);
    }

    const today = new Date().toISOString().split('T')[0];

    const { data: todayAtt } = await supabase
      .from('attendance')
      .select('checkin_at, checkout_at')
      .eq('emp_user_id', user.id)
      .eq('day', today)
      .maybeSingle();

    if (todayAtt) {
      if (todayAtt.checkout_at) setTodayStatus('checked_out');
      else if (todayAtt.checkin_at) setTodayStatus('checked_in');
      else setTodayStatus('not_checked');

      setInTime(todayAtt.checkin_at);
      setOutTime(todayAtt.checkout_at);
    } else {
      setTodayStatus('not_checked');
      setInTime(null);
      setOutTime(null);
    }

    const now = new Date();
    const monthStart = startOfMonth(now).toISOString().split('T')[0];
    const monthEnd = endOfMonth(now).toISOString().split('T')[0];

    const { count } = await supabase
      .from('leaves')
      .select('*', { count: 'exact', head: true })
      .eq('emp_user_id', user.id)
      .eq('status', 'approved')
      .gte('start_date', monthStart)
      .lte('start_date', monthEnd);

    setApprovedLeavesThisMonth(count ?? 0);

    const { data: ledgerData } = await supabase
      .from('v_ledger_totals')
      .select('balance')
      .eq('emp_user_id', user.id)
      .maybeSingle();

    setBalance(ledgerData?.balance ?? 0);
  };

  /* ===================== REALTIME ===================== */

  useEffect(() => {
    if (!user) return;

    fetchData();

    const channel = supabase
      .channel(`employee-dashboard-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'attendance',
          filter: `emp_user_id=eq.${user.id}`,
        },
        fetchData
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'leaves',
          filter: `emp_user_id=eq.${user.id}`,
        },
        fetchData
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'money_ledger',
          filter: `emp_user_id=eq.${user.id}`,
        },
        fetchData
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  /* ===================== HELPERS ===================== */

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  const menuItems = [
    { icon: Clock, label: 'Attendance', description: 'View & mark attendance', href: '/employee/attendance', color: 'text-blue-500' },
    { icon: Calendar, label: 'Attendance History', description: 'Monthly attendance calendar', href: '/employee/attendance-history', color: 'text-primary' },
    { icon: Calendar, label: 'Leave Requests', description: 'Apply for leave', href: '/employee/leaves', color: 'text-green-500' },
    { icon: IndianRupee, label: 'Advance Requests', description: 'Request salary advance', href: '/employee/advance-requests', color: 'text-emerald-500' },
    { icon: Wallet, label: 'Money Ledger', description: 'View transactions', href: '/employee/ledger', color: 'text-purple-500' },
    { icon: MessageSquare, label: 'Chat', description: 'Chat with admin', href: '/employee/chat', color: 'text-primary' },
    { icon: AlertCircle, label: 'Complaints', description: 'Raise a complaint', href: '/employee/complaints', color: 'text-destructive' },
    { icon: Bell, label: 'Notifications', description: 'View announcements', href: '/employee/notifications', color: 'text-teal-500' },
  ];

  /* ===================== UI ===================== */

  return (
    <div className="min-h-screen bg-background">
      <Header
        title="Employee Dashboard"
        rightAction={
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/employee/profile')}
            className="text-primary-foreground hover:bg-primary-foreground/10"
          >
            <User className="h-5 w-5" />
          </Button>
        }
      />

      <AnnouncementBar />

      <main className="p-4 max-w-4xl mx-auto space-y-6">
        <div className="px-1">
          <h2 className="text-2xl font-bold">
            {getGreeting()}, {employeeName || 'Employee'}!
          </h2>
          <p className="text-muted-foreground">
            Here's your overview for today
          </p>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <Card className="col-span-3 sm:col-span-1">
            <CardContent className="p-4 flex items-center gap-3">
              {todayStatus === 'checked_out' ? (
                <CheckCircle className="h-8 w-8 text-green-500" />
              ) : todayStatus === 'checked_in' ? (
                <Clock className="h-8 w-8 text-blue-500" />
              ) : (
                <XCircle className="h-8 w-8 text-muted-foreground" />
              )}
              <div>
                <p className="text-xs text-muted-foreground">Today</p>
                <p className="font-semibold">
                  {todayStatus === 'checked_out'
                    ? 'Checked Out'
                    : todayStatus === 'checked_in'
                    ? 'Checked In'
                    : 'Not Checked'}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="col-span-3 sm:col-span-1">
            <CardContent className="p-4 flex items-center gap-3">
              <Calendar className="h-8 w-8 text-green-500" />
              <div>
                <p className="text-xs text-muted-foreground">
                  Leaves This Month
                </p>
                <p className="font-semibold text-xl">
                  {approvedLeavesThisMonth} / 3
                </p>
                <p className="text-xs text-muted-foreground">Approved</p>
              </div>
            </CardContent>
          </Card>

          <Card className="col-span-3 sm:col-span-1">
            <CardContent className="p-4 flex items-center gap-3">
              <Wallet className="h-8 w-8 text-purple-500" />
              <div>
                <p className="text-xs text-muted-foreground">Balance</p>
                <p className="font-semibold text-xl">
                  ₹{balance.toLocaleString('en-IN')}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-2">
          <h2 className="text-sm font-medium text-muted-foreground px-1">
            Quick Actions
          </h2>

          <div className="grid grid-cols-1 gap-2">
            {menuItems.map((item) => (
              <Link key={item.label} to={item.href}>
                <Card className="cursor-pointer hover:bg-accent/50 transition-colors group">
                  <CardContent className="p-4 flex items-center gap-4">
                    <div
                      className={`p-2.5 rounded-xl bg-background ${item.color}`}
                    >
                      <item.icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">{item.label}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.description}
                      </p>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-foreground" />
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
};

export default EmployeeDashboard;