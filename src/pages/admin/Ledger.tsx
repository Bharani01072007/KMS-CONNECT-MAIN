import { useState, useEffect, useRef } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { supabase } from '@/integrations/supabase/client';
import Header from '@/components/Header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  IndianRupee,
  Calendar,
} from 'lucide-react';
import { format, startOfMonth, subMonths } from 'date-fns';

/* ===================== TYPES ===================== */

interface Employee {
  user_id: string;
  full_name: string | null;
  email: string | null;
}

interface LedgerEntry {
  id: string;
  amount: number;
  type: 'credit' | 'debit';
  reason: string | null;
  created_at: string | null;
}

interface Attendance {
  attendance_type: 'full' | 'half' | null;
}

/* ===================== COMPONENT ===================== */

const AdminLedger = () => {
  const printRef = useRef<HTMLDivElement>(null);

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [selectedMonth, setSelectedMonth] = useState<Date>(
    startOfMonth(new Date())
  );

  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [balance, setBalance] = useState(0);
  const [calculatedSalary, setCalculatedSalary] = useState(0);

  const [entryType, setEntryType] = useState<'credit' | 'debit'>('credit');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');

  /* ===================== FETCH ===================== */

  useEffect(() => {
    fetchEmployees();
  }, []);

  useEffect(() => {
    if (selectedEmployee) {
      fetchLedger();
      calculateSalaryFromAttendance();
    }
  }, [selectedEmployee, selectedMonth]);

  const fetchEmployees = async () => {
    const { data } = await supabase
      .from('employee_directory')
      .select('user_id, full_name, email')
      .eq('role', 'employee');

    if (data) setEmployees(data);
  };

  const fetchLedger = async () => {
    const monthStart = format(selectedMonth, 'yyyy-MM-01');

    const { data } = await supabase
      .from('money_ledger')
      .select('id, amount, type, reason, created_at')
      .eq('emp_user_id', selectedEmployee)
      .eq('month_year', monthStart)
      .order('created_at', { ascending: false });

    setEntries(data || []);

    const { data: total } = await supabase
      .from('v_ledger_totals')
      .select('balance')
      .eq('emp_user_id', selectedEmployee)
      .eq('month_year', monthStart)
      .maybeSingle();

    setBalance(total?.balance ?? 0);
  };

  /* ===================== SALARY CALCULATION (FIX) ===================== */

  const calculateSalaryFromAttendance = async () => {
    if (!selectedEmployee) return;

    const monthStart = format(selectedMonth, 'yyyy-MM-01');
    const monthEnd = format(
      new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1, 0),
      'yyyy-MM-dd'
    );

    const { data: emp } = await supabase
      .from('employees')
      .select('daily_wage')
      .eq('user_id', selectedEmployee)
      .maybeSingle();

    const dailyWage = emp?.daily_wage ?? 0;
    if (!dailyWage) {
      setCalculatedSalary(0);
      return;
    }

    const { data: attendance } = await supabase
      .from('attendance')
      .select('attendance_type')
      .eq('emp_user_id', selectedEmployee)
      .gte('day', monthStart)
      .lte('day', monthEnd);

    let total = 0;

    (attendance as Attendance[] | null)?.forEach((a) => {
      if (a.attendance_type === 'full') total += dailyWage;
      if (a.attendance_type === 'half') total += dailyWage / 2;
    });

    setCalculatedSalary(total);
  };

  /* ===================== NOTIFICATION ===================== */

  const sendSalaryNotification = async (empUserId: string) => {
    try {
      await supabase.from('notifications').insert({
        user_id: empUserId,
        title: 'Salary Settled',
        body: `Your salary for ${format(
          selectedMonth,
          'MMMM yyyy'
        )} has been settled successfully.`,
      });
    } catch (e) {
      console.error('Salary notification failed', e);
    }
  };

  /* ===================== MANUAL TRANSACTION ===================== */

  const handleAddTransaction = async () => {
    if (!amount || !selectedEmployee) return;

    await supabase.from('money_ledger').insert({
      emp_user_id: selectedEmployee,
      amount: Number(amount),
      type: entryType,
      reason: note || (entryType === 'credit' ? 'Manual payment' : 'Advance'),
      month_year: format(selectedMonth, 'yyyy-MM-01'),
    });

    setAmount('');
    setNote('');
    fetchLedger();
    toast({ title: 'Transaction added' });
  };

  /* ===================== SALARY SETTLEMENT (FIXED) ===================== */

  const handleSettleSalary = async () => {
    if (calculatedSalary <= 0 || !selectedEmployee) return;

    await supabase.from('money_ledger').insert({
      emp_user_id: selectedEmployee,
      amount: calculatedSalary,
      type: 'debit',
      reason: 'Salary Paid - Full Settlement',
      month_year: format(selectedMonth, 'yyyy-MM-01'),
    });

    await sendSalaryNotification(selectedEmployee);
    fetchLedger();

    toast({ title: 'Salary Settled Successfully' });
  };

  /* ===================== TOTALS ===================== */

  const totalCredits = entries
    .filter((e) => e.type === 'credit')
    .reduce((s, e) => s + e.amount, 0);

  const totalDebits = entries
    .filter((e) => e.type === 'debit')
    .reduce((s, e) => s + e.amount, 0);

  /* ===================== UI ===================== */

  return (
    <div className="min-h-screen bg-background">
      <Header title="Ledger Management" backTo="/admin/dashboard" />

      <main className="p-4 max-w-4xl mx-auto space-y-4">
        {/* UI UNCHANGED */}
      </main>
    </div>
  );
};

export default AdminLedger;
