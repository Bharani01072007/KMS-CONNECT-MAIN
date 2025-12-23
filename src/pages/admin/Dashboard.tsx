import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import Header from '@/components/Header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import { 
  Users, 
  MapPin, 
  Calendar, 
  AlertCircle, 
  Bell,
  MessageSquare,
  Wallet,
  ChevronRight,
  Send,
  Building,
  Clock,
  Megaphone,
  CalendarDays,
  IndianRupee
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';

interface DashboardStats {
  totalEmployees: number;
  totalSites: number;
  pendingLeaves: number;
  openComplaints: number;
  todayAttendance: number;
}

interface LatestAnnouncement {
  body: string | null;
  created_at: string | null;
}

const AdminDashboard = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    totalEmployees: 0,
    totalSites: 0,
    pendingLeaves: 0,
    openComplaints: 0,
    todayAttendance: 0,
  });
  const [announcement, setAnnouncement] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [latestAnnouncement, setLatestAnnouncement] = useState<LatestAnnouncement | null>(null);

  useEffect(() => {
    fetchStats();
    fetchLatestAnnouncement();
  }, []);

  const fetchStats = async () => {
    const { count: employeeCount } = await supabase
      .from('employee_directory')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'employee');

    const { count: siteCount } = await supabase
      .from('sites')
      .select('*', { count: 'exact', head: true });

    const { count: pendingLeavesCount } = await supabase
      .from('leaves')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');

    const { count: complaintsCount } = await supabase
      .from('complaints')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'open');

    const today = new Date().toISOString().split('T')[0];
    const { count: attendanceCount } = await supabase
      .from('attendance')
      .select('*', { count: 'exact', head: true })
      .eq('day', today);

    setStats({
      totalEmployees: employeeCount ?? 0,
      totalSites: siteCount ?? 0,
      pendingLeaves: pendingLeavesCount ?? 0,
      openComplaints: complaintsCount ?? 0,
      todayAttendance: attendanceCount ?? 0,
    });
  };

  const fetchLatestAnnouncement = async () => {
    const { data } = await supabase
      .from('notifications')
      .select('body, created_at')
      .eq('title', 'Announcement')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data) setLatestAnnouncement(data);
  };

  const handleSendAnnouncement = async () => {
    if (!announcement.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter an announcement message',
        variant: 'destructive',
      });
      return;
    }

    setIsSending(true);
    try {
      const { data: employees } = await supabase
        .from('employee_directory')
        .select('user_id')
        .eq('role', 'employee');

      if (employees?.length) {
        const notifications = employees
          .filter(e => e.user_id)
          .map(e => ({
            title: 'Announcement',
            body: announcement.trim(),
            user_id: e.user_id!,
          }));

        await supabase.from('notifications').insert(notifications);
      }

      toast({ title: 'Success', description: 'Announcement sent' });
      setAnnouncement('');
      fetchLatestAnnouncement();
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to send announcement',
        variant: 'destructive',
      });
    } finally {
      setIsSending(false);
    }
  };

  const statCards = [
    { icon: Users, label: 'Employees', value: stats.totalEmployees, color: 'text-blue-500', bg: 'bg-blue-500/10' },
    { icon: Building, label: 'Sites', value: stats.totalSites, color: 'text-green-500', bg: 'bg-green-500/10' },
    { icon: Clock, label: 'Today Present', value: stats.todayAttendance, color: 'text-purple-500', bg: 'bg-purple-500/10' },
    { icon: Calendar, label: 'Pending Leaves', value: stats.pendingLeaves, color: 'text-amber-500', bg: 'bg-amber-500/10' },
  ];

  const menuItems = [
    { icon: Users, label: 'Employee Management', description: 'Add, edit, view employees', href: '/admin/employees', color: 'text-blue-500' },
    { icon: MapPin, label: 'Site Management', description: 'Manage work sites', href: '/admin/sites', color: 'text-green-500' },
    { icon: MessageSquare, label: 'Chat Inbox', description: 'Message employees', href: '/admin/chat', color: 'text-primary' },
    { icon: Calendar, label: 'Leave Approvals', description: `${stats.pendingLeaves} pending requests`, href: '/admin/leaves', color: 'text-amber-500' },
    { icon: CalendarDays, label: 'Company Holidays', description: 'Assign company-wide holidays', href: '/admin/holidays', color: 'text-violet-500' },

    /* ✅ NEW – Advance Requests */
    { icon: IndianRupee, label: 'Advance Requests', description: 'Approve employee advance salary', href: '/admin/advance-requests', color: 'text-emerald-500' },

    { icon: Wallet, label: 'Money Ledger', description: 'Manage payments & advances', href: '/admin/ledger', color: 'text-teal-500' },
    { icon: Bell, label: 'Notifications', description: 'View announcements history', href: '/admin/notifications', color: 'text-indigo-500' },
    { icon: AlertCircle, label: 'Complaints', description: `${stats.openComplaints} open complaints`, href: '/admin/complaints', color: 'text-destructive' },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Header title="Admin Dashboard" />

      <main className="p-4 max-w-6xl mx-auto space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {statCards.map(stat => (
            <Card key={stat.label}>
              <CardContent className="p-4 flex items-center gap-3">
                <div className={`p-2 rounded-lg ${stat.bg}`}>
                  <stat.icon className={`h-5 w-5 ${stat.color}`} />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stat.value}</p>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Megaphone className="h-5 w-5 text-primary" />
              <CardTitle>Send Announcement</CardTitle>
            </div>
            <CardDescription>Broadcast a message to all employees</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea value={announcement} onChange={e => setAnnouncement(e.target.value)} placeholder="Type your announcement here..." />
            <Button onClick={handleSendAnnouncement} disabled={isSending}>
              <Send className="h-4 w-4 mr-2" />
              {isSending ? 'Sending...' : 'Send'}
            </Button>

            {latestAnnouncement && (
              <div className="p-3 bg-muted/50 rounded-lg">
                <p className="text-xs text-muted-foreground">Latest Announcement</p>
                <p className="text-sm">{latestAnnouncement.body}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {latestAnnouncement.created_at && format(new Date(latestAnnouncement.created_at), 'PPp')}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <div>
          <h2 className="text-sm font-medium text-muted-foreground px-1 mb-2">Management</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {menuItems.map(item => (
              <Link key={item.label} to={item.href}>
                <Card className="cursor-pointer hover:bg-accent/50 transition-colors">
                  <CardContent className="p-4 flex items-center gap-4">
                    <div className={`p-2.5 rounded-xl bg-background ${item.color}`}>
                      <item.icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">{item.label}</p>
                      <p className="text-xs text-muted-foreground">{item.description}</p>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
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

export default AdminDashboard;