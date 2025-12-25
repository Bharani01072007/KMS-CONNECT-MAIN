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

  const [entryType, setEntryType] = useState<'credit' | 'debit'>('credit');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');

  /* ===================== FETCH ===================== */

  useEffect(() => {
    fetchEmployees();
  }, []);

  useEffect(() => {
    if (!selectedEmployee) return;
    calculateMonthlySalary();
    fetchLedger();
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
      .select('*')
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

  /* ===================== AUTO MONTHLY SALARY ===================== */

  const calculateMonthlySalary = async () => {
    const monthStart = format(selectedMonth, 'yyyy-MM-01');
    const monthEnd = format(
      new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1, 0),
      'yyyy-MM-dd'
    );

    const { data: exists } = await supabase
      .from('money_ledger')
      .select('id')
      .eq('emp_user_id', selectedEmployee)
      .eq('month_year', monthStart)
      .eq('reason', 'Monthly Salary');

    if (exists && exists.length > 0) return;

    const { data: attendance } = await supabase
      .from('attendance')
      .select('attendance_type')
      .eq('emp_user_id', selectedEmployee)
      .gte('day', monthStart)
      .lte('day', monthEnd);

    if (!attendance || attendance.length === 0) return;

    const fullDays = attendance.filter(a => a.attendance_type === 'full').length;
    const halfDays = attendance.filter(a => a.attendance_type === 'half').length;

    const { data: emp } = await supabase
      .from('employees')
      .select('daily_wage')
      .eq('user_id', selectedEmployee)
      .maybeSingle();

    if (!emp?.daily_wage) return;

    const salary =
      fullDays * emp.daily_wage +
      halfDays * (emp.daily_wage / 2);

    if (salary <= 0) return;

    await supabase.from('money_ledger').insert({
      emp_user_id: selectedEmployee,
      amount: salary,
      type: 'credit',
      reason: 'Monthly Salary',
      month_year: monthStart,
    });
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

  /* ===================== SALARY SETTLEMENT ===================== */

  const handleSettleSalary = async () => {
    if (balance <= 0) return;

    await supabase.from('money_ledger').insert({
      emp_user_id: selectedEmployee,
      amount: balance,
      type: 'debit',
      reason: 'Salary Paid - Full Settlement',
      month_year: format(selectedMonth, 'yyyy-MM-01'),
    });

    fetchLedger();
    toast({ title: 'Salary Settled' });
  };

  /* ===================== TOTALS ===================== */

  const totalCredits = entries
    .filter(e => e.type === 'credit')
    .reduce((s, e) => s + e.amount, 0);

  const totalDebits = entries
    .filter(e => e.type === 'debit')
    .reduce((s, e) => s + e.amount, 0);

  /* ===================== PDF ===================== */

  const generateLedgerPDF = () => {
    const doc = new jsPDF();
    const logo =
      'https://mxybuexkbiprxxkyrllg.supabase.co/storage/v1/object/public/Avatars/logo.jpg';

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = logo;

    img.onload = () => {
      doc.addImage(img, 'PNG', 14, 10, 30, 18);
      doc.text('Ledger Report', 105, 40, { align: 'center' });

      autoTable(doc, {
        startY: 50,
        head: [['Date', 'Type', 'Reason', 'Amount']],
        body: entries.map(e => [
          e.created_at ? format(new Date(e.created_at), 'dd MMM yyyy') : '',
          e.type,
          e.reason,
          e.amount.toLocaleString('en-IN'),
        ]),
      });

      doc.text(
        `Total Credits: ₹${totalCredits.toLocaleString('en-IN')}`,
        14,
        (doc as any).lastAutoTable.finalY + 10
      );
      doc.text(
        `Total Debits: ₹${totalDebits.toLocaleString('en-IN')}`,
        14,
        (doc as any).lastAutoTable.finalY + 18
      );
      doc.text(
        `Balance: ₹${balance.toLocaleString('en-IN')}`,
        14,
        (doc as any).lastAutoTable.finalY + 26
      );

      doc.save('ledger.pdf');
    };
  };

  /* ===================== UI ===================== */

  return (
    <div className="min-h-screen bg-background">
      <Header title="Ledger Management" backTo="/admin/dashboard" />

      <main className="p-4 max-w-4xl mx-auto space-y-4">

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wallet /> Select Employee
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
              <SelectTrigger>
                <SelectValue placeholder="Choose employee" />
              </SelectTrigger>
              <SelectContent>
                {employees.map(emp => (
                  <SelectItem key={emp.user_id} value={emp.user_id}>
                    {emp.full_name || emp.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <div className="grid grid-cols-3 gap-3">
          <Summary icon={<TrendingUp />} label="Credits" value={totalCredits} />
          <Summary icon={<TrendingDown />} label="Debits" value={totalDebits} />
          <Summary icon={<IndianRupee />} label="Balance" value={balance} />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Add Transaction</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              placeholder="Amount"
              value={amount}
              onChange={e => setAmount(e.target.value)}
            />
            <Textarea
              placeholder="Note"
              value={note}
              onChange={e => setNote(e.target.value)}
            />
            <Button onClick={handleAddTransaction}>Add</Button>
          </CardContent>
        </Card>

        <Button variant="outline" onClick={generateLedgerPDF}>
          Download PDF
        </Button>

      </main>
    </div>
  );
};

const Summary = ({ icon, label, value }: any) => (
  <Card>
    <CardContent className="text-center p-4">
      {icon}
      <p className="font-bold">₹{value.toLocaleString('en-IN')}</p>
      <p className="text-xs">{label}</p>
    </CardContent>
  </Card>
);

export default AdminLedger;