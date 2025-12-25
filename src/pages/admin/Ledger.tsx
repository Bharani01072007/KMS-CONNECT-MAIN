import { useState, useEffect, useRef } from 'react';
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
import { format, startOfMonth } from 'date-fns';
import { IndianRupee } from 'lucide-react';

/* ================= TYPES ================= */

interface Employee {
  user_id: string;
  full_name: string | null;
}

interface LedgerEntry {
  id: string;
  amount: number;
  type: 'credit' | 'debit';
  reason: string | null;
  created_at: string;
}

/* ================= COMPONENT ================= */

const AdminLedger = () => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(
    startOfMonth(new Date())
  );

  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [balance, setBalance] = useState(0);

  const [entryType, setEntryType] = useState<'credit' | 'debit'>('credit');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');

  /* ================= FETCH ================= */

  useEffect(() => {
    fetchEmployees();
  }, []);

  useEffect(() => {
    if (selectedEmployee) fetchLedger();
  }, [selectedEmployee, selectedMonth]);

  const fetchEmployees = async () => {
    const { data } = await supabase
      .from('employee_directory')
      .select('user_id, full_name')
      .eq('role', 'employee');

    setEmployees(data || []);
  };

  const fetchLedger = async () => {
    const monthKey = format(selectedMonth, 'yyyy-MM-01');

    const { data } = await supabase
      .from('money_ledger')
      .select('*')
      .eq('emp_user_id', selectedEmployee)
      .eq('month_year', monthKey)
      .order('created_at', { ascending: false });

    setEntries(data || []);

    const credit = (data || [])
      .filter(e => e.type === 'credit')
      .reduce((s, e) => s + e.amount, 0);

    const debit = (data || [])
      .filter(e => e.type === 'debit')
      .reduce((s, e) => s + e.amount, 0);

    setBalance(credit - debit);
  };

  /* ================= ACTIONS ================= */

  const addTransaction = async () => {
    if (!amount || !selectedEmployee) return;

    await supabase.from('money_ledger').insert({
      emp_user_id: selectedEmployee,
      amount: Number(amount),
      type: entryType,
      reason: note || (entryType === 'credit' ? 'Manual Credit' : 'Advance'),
      month_year: format(selectedMonth, 'yyyy-MM-01'),
    });

    setAmount('');
    setNote('');
    fetchLedger();
    toast({ title: 'Transaction added' });
  };

  const settleSalary = async () => {
    if (balance <= 0) return;

    await supabase.from('money_ledger').insert({
      emp_user_id: selectedEmployee,
      amount: balance,
      type: 'debit',
      reason: 'Salary Settled',
      month_year: format(selectedMonth, 'yyyy-MM-01'),
    });

    await supabase.from('notifications').insert({
      user_id: selectedEmployee,
      title: 'Salary Settled',
      body: `Your salary for ${format(selectedMonth, 'MMMM yyyy')} is settled.`,
    });

    fetchLedger();
    toast({ title: 'Salary settled successfully' });
  };

  /* ================= UI ================= */

  return (
    <div className="min-h-screen bg-background">
      <Header title="Ledger Management" backTo="/admin/dashboard" />

      <main className="p-4 max-w-4xl mx-auto space-y-4">
        {/* EMPLOYEE SELECT */}
        <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
          <SelectTrigger>
            <SelectValue placeholder="Select employee" />
          </SelectTrigger>
          <SelectContent>
            {employees.map(emp => (
              <SelectItem key={emp.user_id} value={emp.user_id}>
                {emp.full_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* BALANCE */}
        <Card>
          <CardHeader>
            <CardTitle>Current Balance</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-2 text-xl">
            <IndianRupee /> {balance}
          </CardContent>
        </Card>

        {/* ADD TRANSACTION */}
        <Card>
          <CardHeader>
            <CardTitle>Add Transaction</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Select
              value={entryType}
              onValueChange={v => setEntryType(v as any)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="credit">Credit</SelectItem>
                <SelectItem value="debit">Debit</SelectItem>
              </SelectContent>
            </Select>

            <Input
              placeholder="Amount"
              value={amount}
              onChange={e => setAmount(e.target.value)}
            />

            <Textarea
              placeholder="Reason"
              value={note}
              onChange={e => setNote(e.target.value)}
            />

            <Button onClick={addTransaction}>Add</Button>
          </CardContent>
        </Card>

        {/* SETTLE SALARY */}
        <Button
          disabled={balance <= 0}
          onClick={settleSalary}
          className="w-full"
        >
          Settle Salary
        </Button>
      </main>
    </div>
  );
};

export default AdminLedger;