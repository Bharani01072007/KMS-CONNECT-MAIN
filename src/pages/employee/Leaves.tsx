import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import Header from '@/components/Header';
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import {
  CalendarIcon, AlertTriangle, CheckCircle, XCircle, Clock
} from 'lucide-react';
import {
  format, startOfMonth, endOfMonth, differenceInCalendarDays
} from 'date-fns';
import { cn } from '@/lib/utils';
import { DateRange } from 'react-day-picker';

interface LeaveRecord {
  id: string;
  start_date: string;
  end_date: string;
  days: number;
  reason: string | null;
  status: string;
  created_at: string | null;
}

const PAID_LEAVE_LIMIT = 2;

const EmployeeLeaves = () => {
  const { user } = useAuth();

  const [range, setRange] = useState<DateRange | undefined>();
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [approvedThisMonth, setApprovedThisMonth] = useState(0);
  const [leaves, setLeaves] = useState<LeaveRecord[]>([]);

  /* ===================== FETCH ===================== */

  useEffect(() => {
    if (!user) return;
    fetchData();
  }, [user]);

  const fetchData = async () => {
    const now = new Date();
    const monthStart = format(startOfMonth(now), 'yyyy-MM-dd');
    const monthEnd = format(endOfMonth(now), 'yyyy-MM-dd');

    const { count } = await supabase
      .from('leaves')
      .select('*', { count: 'exact', head: true })
      .eq('emp_user_id', user!.id)
      .eq('status', 'approved')
      .gte('start_date', monthStart)
      .lte('start_date', monthEnd);

    setApprovedThisMonth(count ?? 0);

    const { data } = await supabase
      .from('leaves')
      .select('*')
      .eq('emp_user_id', user!.id)
      .order('start_date', { ascending: false });

    if (data) setLeaves(data);
  };

  /* ===================== HELPERS ===================== */

  const selectedDays =
    range?.from && range?.to
      ? differenceInCalendarDays(range.to, range.from) + 1
      : 0;

  const exceedsPaidLimit =
    approvedThisMonth + selectedDays > PAID_LEAVE_LIMIT;

  /* ===================== SUBMIT ===================== */

  const handleSubmit = async () => {
    if (!range?.from || !range?.to) {
      toast({
        title: 'Error',
        description: 'Please select leave dates',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);

    try {
      await supabase.from('leaves').insert({
        emp_user_id: user!.id,
        start_date: format(range.from, 'yyyy-MM-dd'),
        end_date: format(range.to, 'yyyy-MM-dd'),
        days: selectedDays,
        reason: reason.trim() || null,
        status: 'pending',
      });

      toast({ title: 'Leave request submitted' });
      setRange(undefined);
      setReason('');
      fetchData();
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  /* ===================== STATUS BADGE ===================== */

  const getStatusBadge = (status: string) => {
    if (status === 'approved')
      return <Badge className="bg-green-500"><CheckCircle className="h-3 w-3 mr-1" />Approved</Badge>;
    if (status === 'rejected')
      return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Rejected</Badge>;
    return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
  };

  /* ===================== UI ===================== */

  return (
    <div className="min-h-screen bg-background">
      <Header title="Leave Requests" backTo="/employee/dashboard" />

      <main className="p-4 max-w-2xl mx-auto space-y-4">

        {/* MONTH SUMMARY */}
        <Card
          className={cn(
            approvedThisMonth >= PAID_LEAVE_LIMIT
              ? 'border-destructive bg-destructive/5'
              : 'border-green-500/30 bg-green-500/5'
          )}
        >
          <CardContent className="p-4 flex justify-between items-center">
            <div>
              <p className="text-sm text-muted-foreground">
                Paid leaves used this month
              </p>
              <p className="text-2xl font-bold">
                {approvedThisMonth} / {PAID_LEAVE_LIMIT}
              </p>
            </div>
            {approvedThisMonth >= PAID_LEAVE_LIMIT && (
              <AlertTriangle className="h-6 w-6 text-destructive" />
            )}
          </CardContent>
        </Card>

        {/* WARNING */}
        {exceedsPaidLimit && (
          <Card className="border-destructive/50 bg-destructive/10">
            <CardContent className="p-4 flex gap-3">
              <AlertTriangle className="h-5 w-5 text-destructive mt-0.5" />
              <p className="text-sm">
                You are requesting more than <strong>2 paid leaves</strong>.
                Additional days will be treated as <strong>unpaid leave</strong>
                as per company norms.
              </p>
            </CardContent>
          </Card>
        )}

        {/* APPLY LEAVE */}
        <Card>
          <CardHeader>
            <CardTitle>Apply for Leave</CardTitle>
            <CardDescription>Select leave dates and reason</CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {range?.from
                    ? range.to
                      ? `${format(range.from, 'PPP')} → ${format(range.to, 'PPP')}`
                      : format(range.from, 'PPP')
                    : 'Select leave dates'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="p-0" align="start">
                <Calendar
                  mode="range"
                  selected={range}
                  onSelect={setRange}
                  disabled={(date) => date < new Date()}
                />
              </PopoverContent>
            </Popover>

            {selectedDays > 0 && (
              <p className="text-sm">
                Selected days: <strong>{selectedDays}</strong>
              </p>
            )}

            <Textarea
              placeholder="Reason (optional)"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />

            <Button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="w-full"
            >
              {isSubmitting ? 'Submitting...' : 'Submit Leave Request'}
            </Button>
          </CardContent>
        </Card>

        {/* HISTORY */}
        <Card>
          <CardHeader>
            <CardTitle>Leave History</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {leaves.length === 0 ? (
              <p className="text-center text-muted-foreground">
                No leave requests yet
              </p>
            ) : (
              leaves.map(l => (
                <div key={l.id} className="p-3 bg-muted/50 rounded-lg">
                  <div className="flex justify-between">
                    <div>
                      <p className="font-medium">
                        {format(new Date(l.start_date), 'PPP')}
                        {l.days > 1 &&
                          ` → ${format(new Date(l.end_date), 'PPP')}`}
                      </p>
                      {l.reason && (
                        <p className="text-sm text-muted-foreground">
                          {l.reason}
                        </p>
                      )}
                    </div>
                    {getStatusBadge(l.status)}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

      </main>
    </div>
  );
};

export default EmployeeLeaves;