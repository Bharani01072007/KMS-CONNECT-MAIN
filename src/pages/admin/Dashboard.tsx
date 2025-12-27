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
  const [isDeleting, setIsDeleting] = useState(false);

  const [latestAnnouncement, setLatestAnnouncement] =
    useState<LatestAnnouncement | null>(null);

  /* ===================== FETCH ===================== */

  const fetchStats = async () => {
    const today = new Date().toISOString().split('T')[0];

    const [{ count: employeeCount }, { count: siteCount }, { count: pendingLeaves }, { count: openComplaints }, { count: todayAttendance }] =
      await Promise.all([
        supabase.from('employee_directory').select('*', { count: 'exact', head: true }).eq('role', 'employee'),
        supabase.from('sites').select('*', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('leaves').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('complaints').select('*', { count: 'exact', head: true }).eq('status', 'open'),
        supabase.from('attendance').select('*', { count: 'exact', head: true }).eq('day', today),
      ]);

    setStats({
      totalEmployees: employeeCount ?? 0,
      totalSites: siteCount ?? 0,
      pendingLeaves: pendingLeaves ?? 0,
      openComplaints: openComplaints ?? 0,
      todayAttendance: todayAttendance ?? 0,
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

    setLatestAnnouncement(data ?? null);
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
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, refreshAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance' }, refreshAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leaves' }, refreshAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'complaints' }, refreshAll)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  /* ===================== ANNOUNCEMENT ===================== */

  const handleSendAnnouncement = async () => {
    if (!announcement.trim()) {
      toast({ title: 'Error', description: 'Enter announcement', variant: 'destructive' });
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
      toast({ title: 'Error', description: 'Failed to send', variant: 'destructive' });
    } finally {
      setIsSending(false);
    }
  };

  const handleDeleteAnnouncement = async () => {
    if (!latestAnnouncement) return;

    const confirmDelete = window.confirm('Delete this announcement?');
    if (!confirmDelete) return;

    setIsDeleting(true);
    try {
      await supabase
        .from('notifications')
        .delete()
        .eq('id', latestAnnouncement.id);

      toast({ title: 'Deleted', description: 'Announcement removed' });
      setLatestAnnouncement(null);
    } catch {
      toast({ title: 'Error', description: 'Delete failed', variant: 'destructive' });
    } finally {
      setIsDeleting(false);
    }
  };

  /* ===================== UI ===================== */

  return (
    <div className="min-h-screen bg-background">
      <Header title="Admin Dashboard" />

      <main className="p-4 max-w-6xl mx-auto space-y-6">

        {/* STATS */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { icon: Users, label: 'Employees', value: stats.totalEmployees },
            { icon: Building, label: 'Sites', value: stats.totalSites },
            { icon: Clock, label: 'Today Present', value: stats.todayAttendance },
            { icon: Calendar, label: 'Pending Leaves', value: stats.pendingLeaves },
          ].map(stat => (
            <Card key={stat.label}>
              <CardContent className="p-4 flex items-center gap-3">
                <stat.icon className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-xl font-bold">{stat.value}</p>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* ANNOUNCEMENT */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Megaphone className="h-5 w-5 text-primary" />
              <CardTitle>Send Announcement</CardTitle>
            </div>
            <CardDescription>Broadcast to all employees</CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            <Textarea
              value={announcement}
              onChange={e => setAnnouncement(e.target.value)}
              placeholder="Type announcement..."
            />

            <Button onClick={handleSendAnnouncement} disabled={isSending}>
              <Send className="h-4 w-4 mr-2" />
              {isSending ? 'Sending...' : 'Send'}
            </Button>

            {latestAnnouncement && (
              <div className="p-3 rounded-lg bg-muted/50 space-y-2">
                <p className="text-xs text-muted-foreground">Latest Announcement</p>
                <p className="text-sm">{latestAnnouncement.body}</p>
                <p className="text-xs text-muted-foreground">
                  {latestAnnouncement.created_at &&
                    format(new Date(latestAnnouncement.created_at), 'PPp')}
                </p>

                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleDeleteAnnouncement}
                  disabled={isDeleting}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  {isDeleting ? 'Deleting...' : 'Delete'}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* MENU */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {[
            { icon: Users, label: 'Employees', href: '/admin/employees' },
            { icon: MapPin, label: 'Sites', href: '/admin/sites' },
            { icon: MessageSquare, label: 'Chat', href: '/admin/chat' },
            { icon: Wallet, label: 'Ledger', href: '/admin/ledger' },
            { icon: Bell, label: 'Notifications', href: '/admin/notifications' },
            { icon: AlertCircle, label: 'Complaints', href: '/admin/complaints' },
          ].map(item => (
            <Link key={item.label} to={item.href}>
              <Card className="hover:bg-accent transition">
                <CardContent className="p-4 flex items-center gap-4">
                  <item.icon className="h-5 w-5 text-primary" />
                  <p className="font-medium">{item.label}</p>
                  <ChevronRight className="ml-auto text-muted-foreground" />
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