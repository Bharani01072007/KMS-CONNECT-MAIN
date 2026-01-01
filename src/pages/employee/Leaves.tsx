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
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import {
  CalendarIcon,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
} from 'lucide-react';
import {
  format,
  eachDayOfInterval,
  startOfMonth,
  endOfMonth,
} from 'date-fns';
import { cn } from '@/lib/utils';
import type { DateRange } from 'react-day-picker';

interface LeaveRecord {
  id: string;
  start_date: string;
  end_date: string;
  days: number;
  reason: string | null;
  status: string;
  is_paid: boolean | null;
}

const EmployeeLeaves = () => {
  const { user } = useAuth();

  const [range, setRange] = useState<DateRange>();
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [paidLeavesThisMonth, setPaidLeavesThisMonth] = useState(0);
  const [leaves, setLeaves] = useState<LeaveRecord[]>([]);

  useEffect(() => {
    if (user) fetchData();
  }, [user]);

  const fetchData = async () => {
    const monthStart = format(startOfMonth(new Date()), 'yyyy-MM-dd');
    const monthEnd = format(endOfMonth(new Date()), 'yyyy-MM-dd');

    const { count } = await supabase
      .from('leaves')
      .select('*', { count: 'exact', head: true })
      .eq('emp_user_id', user!.id)
      .eq('status', 'approved')
      .eq('is_paid', true)
      .gte('start_date', monthStart)
      .lte('start_date', monthEnd);

    setPaidLeavesThisMonth(count ?? 0);

    const { data } = await supabase
      .from('leaves')
      .select('*')
      .eq('emp_user_id', user!.id)
      .order('created_at', { ascending: false });

    setLeaves(data || []);
  };

  const selectedDays =
    range?.from && range?.to
      ? eachDayOfInterval({ start: range.from, end: range.to })
      : [];

  const unpaidDays = Math.max(0, selectedDays.length - 2);

  const handleSubmit = async () => {
    if (!range?.from || !range?.to) {
      toast({ title: 'Select leave dates', variant: 'destructive' });
      return;
    }

    setIsSubmitting(true);

    try {
      await supabase.from('leaves').insert({
        emp_user_id: user!.id,
        start_date: format(range.from, 'yyyy-MM-dd'),
        end_date: format(range.to, 'yyyy-MM-dd'),
        days: selectedDays.length,
        reason: reason || null,
        status: 'pending',
      });

      toast({ title: 'Leave request submitted' });
      setRange(undefined);
      setReason('');
      fetchData();
    } catch (e: any) {
      toast({ title: e.message, variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusBadge = (l: LeaveRecord) => {
    if (l.status === 'approved' && l.is_paid)
      return <Badge className="bg-green-500">Paid</Badge>;
    if (l.status === 'approved' && l.is_paid === false)
      return <Badge variant="destructive">Unpaid</Badge>;
    if (l.status === 'rejected')
      return <Badge variant="destructive">Rejected</Badge>;
    return <Badge variant="secondary">Pending</Badge>;
  };

  return (
    <div className="min-h-screen bg-background">
      <Header title="Leave Requests" backTo="/employee/dashboard" />

      <main className="p-4 max-w-2xl mx-auto space-y-4">
        <Card
          className={cn(
            paidLeavesThisMonth >= 2
              ? 'border-warning bg-warning/5'
              : 'border-green-500/30 bg-green-500/5'
          )}
        >
          <CardContent className="p-4 flex justify-between">
            <div>
              <p className="text-sm">Paid leaves used this month</p>
              <p className="text-2xl font-bold">{paidLeavesThisMonth} / 2</p>
            </div>
            {paidLeavesThisMonth >= 2 && (
              <AlertTriangle className="text-warning" />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Apply for Leave</CardTitle>
            <CardDescription>Select dates and reason</CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {range?.from
                    ? `${format(range.from, 'PPP')} → ${range.to ? format(range.to, 'PPP') : ''}`
                    : 'Select leave dates'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="p-0">
                <Calendar mode="range" selected={range} onSelect={setRange} />
              </PopoverContent>
            </Popover>

            {selectedDays.length > 0 && (
              <p className="text-sm">
                Selected: {selectedDays.length} days
                {unpaidDays > 0 && (
                  <span className="text-destructive"> | Unpaid: {unpaidDays}</span>
                )}
              </p>
            )}

            <Textarea
              placeholder="Reason (optional)"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />

            <Button onClick={handleSubmit} disabled={isSubmitting} className="w-full">
              Submit Leave Request
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Leave History</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {leaves.map((l) => (
              <div key={l.id} className="p-3 bg-muted/50 rounded-lg flex justify-between">
                <div>
                  <p className="font-medium">
                    {format(new Date(l.start_date), 'PPP')} →{' '}
                    {format(new Date(l.end_date), 'PPP')}
                  </p>
                  {l.reason && <p className="text-sm">{l.reason}</p>}
                </div>
                {getStatusBadge(l)}
              </div>
            ))}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default EmployeeLeaves;