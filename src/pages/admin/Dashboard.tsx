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

interface Announcement {
  id: string;
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
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);

  /* ===================== FETCH STATS ===================== */

  const fetchStats = async () => {
    const [
      employees,
      sites,
      leaves,
      complaints,
      attendance,
    ] = await Promise.all([
      supabase
        .from('employee_directory')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'employee'),

      supabase
        .from('sites')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true),

      supabase
        .from('leaves')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending'),

      supabase
        .from('complaints')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'open'),

      supabase
        .from('attendance')
        .select('*', { count: 'exact', head: true })
        .eq('day', new Date().toISOString().split('T')[0]),
    ]);

    setStats({
      totalEmployees: employees.count ?? 0,
      totalSites: sites.count ?? 0,
      pendingLeaves: leaves.count ?? 0,
      openComplaints: complaints.count ?? 0,
      todayAttendance: attendance.count ?? 0,
    });
  };

  /* ===================== FETCH ANNOUNCEMENTS ===================== */

  const fetchAnnouncements = async () => {
    const { data } = await supabase
      .from('notifications')
      .select('id, body, created_at')
      .eq('title', 'Announcement')
      .order('created_at', { ascending: false });

    setAnnouncements(data || []);
  };

  /* ===================== SEND ANNOUNCEMENT ===================== */

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
        await supabase.from('notifications').insert(
          employees.map(emp => ({
            title: 'Announcement',
            body: announcement.trim(),
            user_id: emp.user_id!,
          }))
        );
      }

      toast({ title: 'Success', description: 'Announcement sent' });
      setAnnouncement('');
      fetchAnnouncements(); // ✅ instant update
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

  /* ===================== DELETE ANNOUNCEMENT ===================== */

  const handleDeleteAnnouncement = async (id: string) => {
    await supabase.from('notifications').delete().eq('id', id);

    setAnnouncements(prev => prev.filter(a => a.id !== id)); // ✅ instant UI update
  };

  /* ===================== REALTIME ===================== */

  useEffect(() => {
    fetchStats();
    fetchAnnouncements();

    const channel = supabase
      .channel('admin-dashboard-live')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications' },
        fetchAnnouncements
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'attendance' },
        fetchStats
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'leaves' },
        fetchStats
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'complaints' },
        fetchStats
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'employee_directory' },
        fetchStats
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sites' },
        fetchStats
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  /* ===================== UI ===================== */

  const menuItems = [
    { icon: Users, label: 'Employee Management', href: '/admin/employees' },
    { icon: MapPin, label: 'Site Management', href: '/admin/sites' },
    { icon: MessageSquare, label: 'Chat Inbox', href: '/admin/chat' },
    { icon: Calendar, label: 'Leave Approvals', href: '/admin/leaves' },
    { icon: CalendarDays, label: 'Company Holidays', href: '/admin/holidays' },
    { icon: IndianRupee, label: 'Advance Requests', href: '/admin/advance-requests' },
    { icon: Wallet, label: 'Money Ledger', href: '/admin/ledger' },
    { icon: Bell, label: 'Notifications', href: '/admin/notifications' },
    { icon: AlertCircle, label: 'Complaints', href: '/admin/complaints' },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Header title="Admin Dashboard" />

      <main className="p-4 max-w-6xl mx-auto space-y-6">

        {/* ANNOUNCEMENT */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Megaphone className="h-5 w-5 text-primary" />
              <CardTitle>Send Announcement</CardTitle>
            </div>
            <CardDescription>Broadcast a message to all employees</CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            <Textarea
              value={announcement}
              onChange={e => setAnnouncement(e.target.value)}
              placeholder="Type your announcement here..."
            />

            <Button onClick={handleSendAnnouncement} disabled={isSending}>
              <Send className="h-4 w-4 mr-2" />
              {isSending ? 'Sending...' : 'Send'}
            </Button>

            {announcements.map(a => (
              <div key={a.id} className="flex justify-between items-start p-3 bg-muted/50 rounded-lg">
                <div>
                  <p className="text-sm">{a.body}</p>
                  <p className="text-xs text-muted-foreground">
                    {a.created_at && format(new Date(a.created_at), 'PPp')}
                  </p>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => handleDeleteAnnouncement(a.id)}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* MENU */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {menuItems.map(item => (
            <Link key={item.label} to={item.href}>
              <Card className="cursor-pointer hover:bg-accent/50">
                <CardContent className="p-4 flex items-center gap-4">
                  <item.icon className="h-5 w-5" />
                  <p className="font-medium">{item.label}</p>
                  <ChevronRight className="ml-auto h-5 w-5" />
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