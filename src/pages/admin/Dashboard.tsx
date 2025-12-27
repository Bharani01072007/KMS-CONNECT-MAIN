import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import Header from '@/components/Header';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
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
  IndianRupee,
  Trash2,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';

/* ===================== TYPES ===================== */

interface DashboardStats {
  totalEmployees: number;
  totalSites: number;
  pendingLeaves: number;
  openComplaints: number;
  todayAttendance: number;
}

interface LatestAnnouncement {
  id?: string;
  body: string | null;
  created_at: string | null;
}

/* ===================== COMPONENT ===================== */

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
  const [latestAnnouncement, setLatestAnnouncement] =
    useState<LatestAnnouncement | null>(null);

  /* ===================== FETCH ===================== */

  const fetchStats = async () => {
    const { count: employeeCount } = await supabase
      .from('employee_directory')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'employee');

    const { count: siteCount } = await supabase
      .from('sites')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true);

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
      .select('id, body, created_at')
      .eq('title', 'Announcement')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data) setLatestAnnouncement(data);
  };

  const refreshAll = () => {
    fetchStats();
    fetchLatestAnnouncement();
  };

  /* ===================== REALTIME ===================== */

  useEffect(() => {
    refreshAll();

    const channel = supabase
      .channel('admin-dashboard-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'employee_directory' }, refreshAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sites' }, refreshAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance' }, refreshAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leaves' }, refreshAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'complaints' }, refreshAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, refreshAll)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  /* ===================== ANNOUNCEMENT ===================== */

  const handleSendAnnouncement = async () => {
    if (!announcement.trim()) {
      toast({ title: 'Error', description: 'Please enter an announcement message', variant: 'destructive' });
      return;
    }

    setIsSending(true);
    try {
      const { data: employees } = await supabase
        .from('employee_directory')
        .select('user_id')
        .eq('role', 'employee');

      if (employees?.length) {
        await supabase.from('notifications').insert(
          employees.map(e => ({
            title: 'Announcement',
            body: announcement.trim(),
            user_id: e.user_id!,
          }))
        );
      }

      toast({ title: 'Success', description: 'Announcement sent' });
      setAnnouncement('');
    } catch {
      toast({ title: 'Error', description: 'Failed to send announcement', variant: 'destructive' });
    } finally {
      setIsSending(false);
    }
  };

  const handleDeleteAnnouncement = async () => {
    if (!latestAnnouncement?.id) return;

    await supabase.from('notifications').delete().eq('id', latestAnnouncement.id);
    toast({ title: 'Deleted', description: 'Announcement removed' });
    setLatestAnnouncement(null);
  };

  /* ===================== UI ===================== */

  const statCards = [
    { icon: Users, label: 'Employees', value: stats.totalEmployees, color: 'text-blue-500', bg: 'bg-blue-500/10' },
    { icon: Building, label: 'Sites', value: stats.totalSites, color: 'text-green-500', bg: 'bg-green-500/10' },
    { icon: Clock, label: 'Today Present', value: stats.todayAttendance, color: 'text-purple-500', bg: 'bg-purple-500/10' },
    { icon: Calendar, label: 'Pending Leaves', value: stats.pendingLeaves, color: 'text-amber-500', bg: 'bg-amber-500/10' },
  ];

  const menuItems = [
    { icon: Users, label: 'Employee Management', href: '/admin/employees', description: 'Add, edit, view employees', color: 'text-blue-500' },
    { icon: MapPin, label: 'Site Management', href: '/admin/sites', description: 'Manage work sites', color: 'text-green-500' },
    { icon: MessageSquare, label: 'Chat Inbox', href: '/admin/chat', description: 'Message employees', color: 'text-primary' },
    { icon: Calendar, label: 'Leave Approvals', href: '/admin/leaves', description: `${stats.pendingLeaves} pending requests`, color: 'text-amber-500' },
    { icon: CalendarDays, label: 'Company Holidays', href: '/admin/holidays', description: 'Assign company-wide holidays', color: 'text-violet-500' },
    { icon: IndianRupee, label: 'Advance Requests', href: '/admin/advance-requests', description: 'Approve salary advances', color: 'text-emerald-500' },
    { icon: Wallet, label: 'Money Ledger', href: '/admin/ledger', description: 'Manage payments & advances', color: 'text-teal-500' },
    { icon: Bell, label: 'Notifications', href: '/admin/notifications', description: 'View announcements', color: 'text-indigo-500' },
    { icon: AlertCircle, label: 'Complaints', href: '/admin/complaints', description: `${stats.openComplaints} open complaints`, color: 'text-destructive' },
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

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Megaphone className="h-5 w-5 text-primary" />
              <CardTitle>Send Announcement</CardTitle>
            </div>
            <CardDescription>Broadcast a message to all employees</CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            <Textarea value={announcement} onChange={e => setAnnouncement(e.target.value)} />
            <Button onClick={handleSendAnnouncement} disabled={isSending}>
              <Send className="h-4 w-4 mr-2" /> Send
            </Button>

            {latestAnnouncement && (
              <div className="p-3 bg-muted/50 rounded-lg space-y-2">
                <p className="text-sm">{latestAnnouncement.body}</p>
                <p className="text-xs text-muted-foreground">
                  {latestAnnouncement.created_at && format(new Date(latestAnnouncement.created_at), 'PPp')}
                </p>
                <Button variant="destructive" size="sm" onClick={handleDeleteAnnouncement}>
                  <Trash2 className="h-4 w-4 mr-1" /> Delete
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {menuItems.map(item => (
            <Link key={item.label} to={item.href}>
              <Card className="cursor-pointer hover:bg-accent/50">
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
      </main>
    </div>
  );
};

export default AdminDashboard;