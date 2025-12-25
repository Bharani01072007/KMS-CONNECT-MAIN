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
    if (selectedEmployee) fetchLedger();
  }, [selectedEmployee, selectedMonth]);

  const fetchEmployees = async () => {
    const { data } = await supabase
      .from('employee_directory')
      .select('user_id, full_name, email')
      .eq('role', 'employee');

    setEmployees(data || []);
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

  /* ===================== MANUAL TRANSACTION ===================== */

  const handleAddTransaction = async () => {
    if (!amount || !selectedEmployee) return;

    const monthStart = format(selectedMonth, 'yyyy-MM-01');

    await supabase.from('money_ledger').insert({
      emp_user_id: selectedEmployee,
      amount: Number(amount),
      type: entryType,
      reason: note || (entryType === 'credit' ? 'Manual Credit' : 'Manual Debit'),
      month_year: monthStart,
    });

    setAmount('');
    setNote('');
    fetchLedger();

    toast({ title: 'Transaction added successfully' });
  };

  /* ===================== SALARY SETTLEMENT ===================== */

  const handleSettleSalary = async () => {
    if (balance <= 0) return;

    const monthStart = format(selectedMonth, 'yyyy-MM-01');

    await supabase.from('money_ledger').insert({
      emp_user_id: selectedEmployee,
      amount: balance,
      type: 'debit',
      reason: 'Salary Paid - Full Settlement',
      month_year: monthStart,
    });

    await supabase.from('notifications').insert({
      user_id: selectedEmployee,
      title: 'Salary Settled',
      body: `Your salary for ${format(selectedMonth, 'MMMM yyyy')} has been settled.`,
      read: false,
    });

    fetchLedger();
    toast({ title: 'Salary settled successfully' });
  };

  /* ===================== TOTALS ===================== */

  const totalCredits = entries
    .filter(e => e.type === 'credit')
    .reduce((s, e) => s + e.amount, 0);

  const totalDebits = entries
    .filter(e => e.type === 'debit')
    .reduce((s, e) => s + e.amount, 0);

  /* ===================== PDF ===================== */

  const generateLedgerPDF = (mode: 'month' | 'year') => {
    if (!entries.length) {
      toast({
        title: 'No Data',
        description: 'No ledger data available',
        variant: 'destructive',
      });
      return;
    }

    const emp = employees.find(e => e.user_id === selectedEmployee);
    const doc = new jsPDF();

    const title =
      mode === 'month'
        ? `Monthly Ledger – ${format(selectedMonth, 'MMMM yyyy')}`
        : `Yearly Ledger – ${format(selectedMonth, 'yyyy')}`;

    doc.setFontSize(14);
    doc.text('KMS & Co', 14, 15);
    doc.text(title, 14, 25);
    doc.text(`Employee: ${emp?.full_name || emp?.email}`, 14, 32);

    autoTable(doc, {
      startY: 40,
      head: [['Date', 'Type', 'Reason', 'Amount']],
      body: entries.map(e => [
        e.created_at ? format(new Date(e.created_at), 'dd MMM yyyy') : '',
        e.type.toUpperCase(),
        e.reason || '',
        `₹${e.amount}`,
      ]),
    });

    doc.save(`${title}.pdf`);
  };

  /* ===================== UI ===================== */

  return (
    <div className="min-h-screen bg-background">
      <Header title="Ledger Management" backTo="/admin/dashboard" />

      <main className="p-4 max-w-4xl mx-auto space-y-4">

        {/* EMPLOYEE SELECT */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5" />
              Select Employee
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

        {selectedEmployee && (
          <>
            {/* MONTH */}
            <Card>
              <CardContent className="flex justify-between p-4">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  {format(selectedMonth, 'MMMM yyyy')}
                </div>

                <Select
                  value={format(selectedMonth, 'yyyy-MM')}
                  onValueChange={(v) => setSelectedMonth(new Date(v + '-01'))}
                >
                  <SelectTrigger className="w-[160px]" />
                  <SelectContent>
                    {[0,1,2,3,4,5].map(i => {
                      const d = subMonths(new Date(), i);
                      return (
                        <SelectItem key={i} value={format(d, 'yyyy-MM')}>
                          {format(d, 'MMMM yyyy')}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>

            {/* SUMMARY */}
            <div className="grid grid-cols-3 gap-3">
              <Summary icon={<TrendingUp className="text-green-600" />} label="Credits" value={totalCredits} />
              <Summary icon={<TrendingDown className="text-red-600" />} label="Debits" value={totalDebits} />
              <Summary icon={<IndianRupee />} label="Balance" value={balance} />
            </div>

            {/* ADD TRANSACTION */}
            <Card>
              <CardHeader>
                <CardTitle>Add Transaction</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-2">
                  <Button onClick={() => setEntryType('credit')}>Credit</Button>
                  <Button variant="outline" onClick={() => setEntryType('debit')}>Debit</Button>
                  <Button variant="secondary" onClick={handleSettleSalary} disabled={balance <= 0}>
                    Salary Payment
                  </Button>
                </div>

                <Input placeholder="Amount" value={amount} onChange={(e) => setAmount(e.target.value)} />
                <Textarea placeholder="Reason" value={note} onChange={(e) => setNote(e.target.value)} />

                <Button className="w-full" onClick={handleAddTransaction}>
                  Add Transaction
                </Button>
              </CardContent>
            </Card>

            {/* PDF */}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => generateLedgerPDF('month')}>Monthly PDF</Button>
              <Button variant="outline" onClick={() => generateLedgerPDF('year')}>Yearly PDF</Button>
            </div>

            {/* LEDGER */}
            <Card ref={printRef}>
              <CardHeader>
                <CardTitle>Transaction History</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {entries.map(e => (
                  <div key={e.id} className="flex justify-between p-3 bg-muted rounded-lg">
                    <div>
                      <p className="font-medium">{e.reason}</p>
                      <p className="text-xs text-muted-foreground">
                        {e.created_at && format(new Date(e.created_at), 'PPp')}
                      </p>
                    </div>
                    <p className={`font-bold ${e.type === 'credit' ? 'text-green-600' : 'text-red-600'}`}>
                      {e.type === 'credit' ? '+' : '-'}₹{e.amount}
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </>
        )}
      </main>
    </div>
  );
};

/* ===================== SUMMARY ===================== */

const Summary = ({ icon, label, value }: any) => (
  <Card>
    <CardContent className="p-4 text-center">
      {icon}
      <p className="text-lg font-bold">₹{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </CardContent>
  </Card>
);

export default AdminLedger;