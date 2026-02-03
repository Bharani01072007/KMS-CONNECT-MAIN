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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
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

/* ===================== TYPES ===================== */

interface LeaveRecord {
  id: string;
  start_date: string;
  end_date: string;
  days: number;
  reason: string | null;
  status: string;
  created_at: string | null;
}

/* ===================== COMPONENT ===================== */

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
      ? eachDayOfInterval({ start: range.from, end: range.to })
      : [];

  const unpaidDays = Math.max(0, approvedThisMonth + selectedDays.length - 2);

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
      const start = format(range.from, 'yyyy-MM-dd');
      const end = format(range.to, 'yyyy-MM-dd');
      const days = selectedDays.length;

      /* 🔥 Validate paid leave status via SQL */
      for (const d of selectedDays) {
        const { data, error } = await supabase.rpc(
          'get_paid_leave_status',
          {
            p_emp_user_id: user!.id,
            p_day: format(d, 'yyyy-MM-dd'),
          }
        );

        if (error) throw error;
        // data = true (paid) / false (unpaid) → backend handles salary logic
      }

      const { error } = await supabase.from('leaves').insert({
        emp_user_id: user!.id,
        start_date: start,
        end_date: end,
        days,
        reason: reason.trim() || null,
        status: 'pending',
      });

      if (error) throw error;

      toast({
        title: 'Leave Requested',
        description: 'Your leave request has been submitted',
      });

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
      return (
        <Badge className="bg-green-500">
          <CheckCircle className="h-3 w-3 mr-1" />
          Approved
        </Badge>
      );
    if (status === 'rejected')
      return (
        <Badge variant="destructive">
          <XCircle className="h-3 w-3 mr-1" />
          Rejected
        </Badge>
      );
    return (
      <Badge variant="secondary">
        <Clock className="h-3 w-3 mr-1" />
        Pending
      </Badge>
    );
  };

  /* ===================== UI ===================== */

  return (
    <div className="min-h-screen bg-background">
      <Header title="Leave Requests" backTo="/employee/dashboard" />

      <main className="p-4 max-w-2xl mx-auto space-y-4">

        {/* MONTHLY SUMMARY */}
        <Card
          className={cn(
            approvedThisMonth >= 2
              ? 'border-warning bg-warning/5'
              : 'border-green-500/30 bg-green-500/5'
          )}
        >
          <CardContent className="p-4 flex justify-between">
            <div>
              <p className="text-sm text-muted-foreground">
                Paid leaves used this month
              </p>
              <p className="text-2xl font-bold">{approvedThisMonth} / 2</p>
            </div>
            {approvedThisMonth >= 2 && (
              <AlertTriangle className="h-6 w-6 text-warning" />
            )}
          </CardContent>
        </Card>

        {/* COMPANY RULE */}
        {approvedThisMonth >= 2 && (
          <Card className="border-warning/50 bg-warning/10">
            <CardContent className="p-4 flex gap-3">
              <AlertTriangle className="h-5 w-5 text-warning mt-0.5" />
              <p className="text-sm">
                From the <strong>3rd leave day</strong> onwards, salary will be
                deducted as per company norms.
              </p>
            </CardContent>
          </Card>
        )}

        {/* APPLY LEAVE */}
        <Card>
          <CardHeader>
            <CardTitle>Apply for Leave</CardTitle>
            <CardDescription>
              Select dates and provide a reason
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-start text-left"
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {range?.from
                    ? `${format(range.from, 'PPP')} → ${
                        range.to ? format(range.to, 'PPP') : ''
                      }`
                    : 'Select leave dates'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="p-0">
                <Calendar
                  mode="range"
                  selected={range}
                  onSelect={setRange}
                  disabled={(d) => d < new Date()}
                  numberOfMonths={1}
                />
              </PopoverContent>
            </Popover>

            {selectedDays.length > 0 && (
              <div className="text-sm space-y-1">
                <p>
                  Selected days: <strong>{selectedDays.length}</strong>
                </p>
                {unpaidDays > 0 && (
                  <p className="text-destructive">
                    Unpaid days: <strong>{unpaidDays-1}</strong>
                  </p>
                )}
              </div>
            )}

            <Textarea
              placeholder="Reason (optional)"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />

            <Button
              className="w-full"
              disabled={isSubmitting}
              onClick={handleSubmit}
            >
              {isSubmitting ? 'Submitting…' : 'Submit Leave Request'}
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
              <p className="text-center text-muted-foreground py-4">
                No leave requests yet
              </p>
            ) : (
              leaves.map((l) => (
                <div key={l.id} className="p-3 bg-muted/50 rounded-lg">
                  <div className="flex justify-between">
                    <div>
                      <p className="font-medium">
                        {format(new Date(l.start_date), 'PPP')} →{' '}
                        {format(new Date(l.end_date), 'PPP')}
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