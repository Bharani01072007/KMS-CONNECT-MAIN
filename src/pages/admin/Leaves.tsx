import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import Header from '@/components/Header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import { Calendar, CheckCircle, XCircle, Clock, User } from 'lucide-react';
import { format, startOfMonth, endOfMonth } from 'date-fns';

interface LeaveRequest {
  id: string;
  emp_user_id: string;
  start_date: string;
  end_date: string;
  days: number;
  status: string;
  is_paid: boolean | null;
  daily_wage: number;
  employee?: { full_name: string | null; email: string | null };
}

const AdminLeaves = () => {
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [confirmLeave, setConfirmLeave] = useState<LeaveRequest | null>(null);

  useEffect(() => {
    fetchLeaves();
  }, []);

  const fetchLeaves = async () => {
    const { data } = await supabase.from('leaves').select('*').order('created_at', { ascending: false });
    if (!data) return;

    const userIds = [...new Set(data.map(l => l.emp_user_id))];

    const { data: profiles } = await supabase
      .from('profiles')
      .select('auth_uid, full_name, email')
      .in('auth_uid', userIds);

    const { data: wages } = await supabase
      .from('employees')
      .select('user_id, daily_wage')
      .in('user_id', userIds);

    setLeaves(
      data.map(l => ({
        ...l,
        employee: profiles?.find(p => p.auth_uid === l.emp_user_id),
        daily_wage: wages?.find(w => w.user_id === l.emp_user_id)?.daily_wage || 0,
      }))
    );
  };

  const approveLeave = async (leave: LeaveRequest) => {
    const monthStart = startOfMonth(new Date(leave.start_date)).toISOString().split('T')[0];
    const monthEnd = endOfMonth(new Date(leave.start_date)).toISOString().split('T')[0];

    const { count } = await supabase
      .from('leaves')
      .select('*', { count: 'exact', head: true })
      .eq('emp_user_id', leave.emp_user_id)
      .eq('status', 'approved')
      .eq('is_paid', true)
      .gte('start_date', monthStart)
      .lte('start_date', monthEnd);

    const isPaid = (count ?? 0) < 2;

    await supabase.from('leaves').update({
      status: 'approved',
      is_paid: isPaid,
      deduction_amount: isPaid ? 0 : leave.daily_wage,
    }).eq('id', leave.id);

    toast({ title: isPaid ? 'Paid Leave Approved' : 'Unpaid Leave Approved' });
    setConfirmLeave(null);
    fetchLeaves();
  };

  return (
    <div className="min-h-screen bg-background">
      <Header title="Leave Management" backTo="/admin/dashboard" />

      <main className="p-4 max-w-4xl mx-auto space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Leave Requests</CardTitle>
          </CardHeader>

          <CardContent className="space-y-3">
            {leaves.map((l) => (
              <div key={l.id} className="p-4 bg-muted/50 rounded-lg flex justify-between">
                <div>
                  <p className="font-medium">
                    {l.employee?.full_name || l.employee?.email}
                  </p>
                  <p className="text-sm">
                    {format(new Date(l.start_date), 'PPP')} → {format(new Date(l.end_date), 'PPP')}
                  </p>
                  <Badge>{l.status}</Badge>
                </div>

                {l.status === 'pending' && (
                  <Button onClick={() => setConfirmLeave(l)}>Approve</Button>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      </main>

      <Dialog open={!!confirmLeave} onOpenChange={() => setConfirmLeave(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Leave Approval</DialogTitle>
            <DialogDescription>
              This leave may be unpaid if monthly limit exceeded.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmLeave(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => confirmLeave && approveLeave(confirmLeave)}>
              Confirm & Approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminLeaves;