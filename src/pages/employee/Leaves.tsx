import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import Header from '@/components/Header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { CalendarIcon, AlertTriangle, CheckCircle, XCircle, Clock } from 'lucide-react';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { cn } from '@/lib/utils';

interface LeaveRecord {
  id: string;
  start_date: string;
  end_date: string;
  days: number;
  reason: string | null;
  status: string;
  created_at: string | null;
}

const EmployeeLeaves = () => {
  const { user } = useAuth();
  const [date, setDate] = useState<Date>();
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [approvedThisMonth, setApprovedThisMonth] = useState(0);
  const [leaves, setLeaves] = useState<LeaveRecord[]>([]);

  useEffect(() => {
    if (!user) return;
    fetchData();
  }, [user]);

  const fetchData = async () => {
    const now = new Date();
    const monthStart = startOfMonth(now).toISOString().split('T')[0];
    const monthEnd = endOfMonth(now).toISOString().split('T')[0];

    // Count approved leaves this month
    const { count } = await supabase
      .from('leaves')
      .select('*', { count: 'exact', head: true })
      .eq('emp_user_id', user!.id)
      .eq('status', 'approved')
      .gte('start_date', monthStart)
      .lte('start_date', monthEnd);

    setApprovedThisMonth(count ?? 0);

    // Fetch all leaves
    const { data } = await supabase
      .from('leaves')
      .select('id, start_date, end_date, days, reason, status, created_at')
      .eq('emp_user_id', user!.id)
      .order('start_date', { ascending: false });

    if (data) setLeaves(data);
  };

  const handleSubmit = async () => {
    if (!date) {
      toast({ title: 'Error', description: 'Please select a date', variant: 'destructive' });
      return;
    }

    setIsSubmitting(true);
    try {
      const leaveDate = format(date, 'yyyy-MM-dd');
      const { error } = await supabase
        .from('leaves')
        .insert({
          emp_user_id: user!.id,
          start_date: leaveDate,
          end_date: leaveDate,
          days: 1,
          reason: reason.trim() || null,
          status: 'pending',
        });

      if (error) throw error;

      toast({ title: 'Success', description: 'Leave request submitted!' });
      setDate(undefined);
      setReason('');
      fetchData();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-green-500"><CheckCircle className="h-3 w-3 mr-1" />Approved</Badge>;
      case 'rejected':
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Rejected</Badge>;
      default:
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header title="Leave Requests" backTo="/employee/dashboard" />
      
      <main className="p-4 max-w-2xl mx-auto space-y-4">
        {/* Monthly Summary */}
        <Card className={cn(
          approvedThisMonth >= 3 ? "border-warning bg-warning/5" : "border-green-500/30 bg-green-500/5"
        )}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Approved leaves this month</p>
                <p className="text-2xl font-bold">{approvedThisMonth} / 3</p>
              </div>
              {approvedThisMonth >= 3 && (
                <AlertTriangle className="h-6 w-6 text-warning" />
              )}
            </div>
          </CardContent>
        </Card>

        {/* Warning for extra leaves */}
        {approvedThisMonth >= 3 && (
          <Card className="border-warning/50 bg-warning/10">
            <CardContent className="p-4 flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
              <p className="text-sm">
                From the 4th approved leave in a month, salary will be deducted automatically as unpaid leave.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Apply Leave Form */}
        <Card>
          <CardHeader>
            <CardTitle>Apply for Leave</CardTitle>
            <CardDescription>Select a date and provide a reason</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Leave Date</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !date && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {date ? format(date, 'PPP') : 'Pick a date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={setDate}
                    disabled={(date) => date < new Date()}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Reason (optional)</label>
              <Textarea
                placeholder="Enter reason for leave..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
              />
            </div>

            <Button onClick={handleSubmit} disabled={isSubmitting} className="w-full">
              {isSubmitting ? 'Submitting...' : 'Submit Leave Request'}
            </Button>
          </CardContent>
        </Card>

        {/* Leave History */}
        <Card>
          <CardHeader>
            <CardTitle>Leave History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {leaves.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">No leave requests yet</p>
              ) : (
                leaves.map((leave) => (
                  <div key={leave.id} className="p-3 bg-muted/50 rounded-lg">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium">
                          {format(new Date(leave.start_date), 'PPP')}
                          {leave.days > 1 && ` - ${format(new Date(leave.end_date), 'PPP')}`}
                        </p>
                        {leave.reason && (
                          <p className="text-sm text-muted-foreground mt-1">{leave.reason}</p>
                        )}
                      </div>
                      {getStatusBadge(leave.status)}
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default EmployeeLeaves;
