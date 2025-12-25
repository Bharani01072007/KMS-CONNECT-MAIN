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
import {
format,
startOfMonth,
subMonths,
} from 'date-fns';

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

/* Manual transaction */
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

/* ===================== MANUAL TRANSACTION ===================== */

const handleAddTransaction = async () => {
if (!amount || !selectedEmployee) return;

const monthStart = format(selectedMonth, 'yyyy-MM-01');  

await supabase.from('money_ledger').insert({  
  emp_user_id: selectedEmployee,  
  amount: Number(amount),  
  type: entryType,  
  reason: note || (entryType === 'credit' ? 'Manual payment' : 'Advance'),  
  month_year: monthStart,  
});  

setAmount('');  
setNote('');  
fetchLedger();  
toast({ title: 'Transaction added' });

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

await sendSalarySettlementNotification();  
fetchLedger();  

toast({ title: 'Salary Settled' });

};

/* ===================== FIXED NOTIFICATION ===================== */

const sendSalarySettlementNotification = async () => {
if (!selectedEmployee) return;

const body = `Your salary for ${format(  
  selectedMonth,  
  'MMMM yyyy'  
)} has been settled successfully.`;  

const { error } = await supabase.from('notifications').insert({  
  user_id: selectedEmployee,  
  title: 'Salary Settled',  
  body,  
  read: false,  
});  

if (error) {  
  console.error('Notification insert failed:', error.message);  
}

};

/* ===================== TOTALS ===================== */

const totalCredits = entries
.filter(e => e.type === 'credit')
.reduce((s, e) => s + e.amount, 0);

const totalDebits = entries
.filter(e => e.type === 'debit')
.reduce((s, e) => s + e.amount, 0);

/* ===================== PDF GENERATION ===================== */

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

const COMPANY_LOGO =  
  'https://mxybuexkbiprxxkyrllg.supabase.co/storage/v1/object/public/Avatars/logo.jpg';  

const title =  
  mode === 'month'  
    ? `Monthly Ledger – ${format(selectedMonth, 'MMMM yyyy')}`  
    : `Yearly Ledger – ${format(selectedMonth, 'yyyy')}`;  

const img = new Image();  
img.crossOrigin = 'anonymous';  
img.src = COMPANY_LOGO;  

img.onload = () => {  
  doc.addImage(img, 'PNG', 14, 10, 30, 18);  

  doc.setFontSize(16);  
  doc.text('KMS & Co', 50, 18);  
  doc.setFontSize(10);  
  doc.text('Knowledge • Management • Success', 50, 25);  
  doc.text('Coimbatore, Tamil Nadu, India', 50, 31);  

  doc.line(14, 36, 196, 36);  

  doc.setFontSize(14);  
  doc.text(title, 105, 48, { align: 'center' });  

  doc.setFontSize(10);  
  doc.text(`Employee : ${emp?.full_name || emp?.email}`, 14, 58);  
  doc.text(`Generated : ${format(new Date(), 'dd MMM yyyy')}`, 14, 64);  

  autoTable(doc, {  
    startY: 72,  
    head: [['Date', 'Type', 'Reason', 'Amount (₹)']],  
    body: entries.map(e => [  
      e.created_at ? format(new Date(e.created_at), 'dd MMM yyyy') : '',  
      e.type.toUpperCase(),  
      e.reason || '',  
      e.amount.toLocaleString('en-IN'),  
    ]),  
    styles: { fontSize: 9 },  
    headStyles: { fillColor: [220, 38, 38] },  
  });  

  const y = (doc as any).lastAutoTable.finalY + 10;  

  doc.setFontSize(11);  
  doc.text(`Total Credits : ₹ ${totalCredits.toLocaleString('en-IN')}`, 14, y);  
  doc.text(`Total Debits  : ₹ ${totalDebits.toLocaleString('en-IN')}`, 14, y + 7);  
  doc.text(  
    `Balance       : ₹ ${(totalCredits - totalDebits).toLocaleString('en-IN')}`,  
    14,  
    y + 14  
  );  

  doc.save(  
    `${mode === 'month' ? 'Monthly' : 'Yearly'}_Ledger_${emp?.full_name || 'Employee'}.pdf`  
  );  
};

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
            <CardTitle>+ Add Transaction</CardTitle>  
          </CardHeader>  
          <CardContent className="space-y-3">  
            <div className="flex gap-2 flex-wrap">  
              <Button  
                variant={entryType === 'credit' ? 'default' : 'outline'}  
                onClick={() => setEntryType('credit')}  
              >  
                Payment (Credit)  
              </Button>  

              <Button  
                variant={entryType === 'debit' ? 'default' : 'outline'}  
                onClick={() => setEntryType('debit')}  
              >  
                Advance (Debit)  
              </Button>  

              <Button  
                variant="secondary"  
                disabled={balance <= 0}  
                onClick={handleSettleSalary}  
              >  
                Salary Payment  
              </Button>  
            </div>  

            <Input  
              placeholder="Amount ₹"  
              value={amount}  
              onChange={(e) => setAmount(e.target.value)}  
            />  
            <Textarea  
              placeholder="Note (optional)"  
              value={note}  
              onChange={(e) => setNote(e.target.value)}  
            />  

            <Button className="w-full" onClick={handleAddTransaction}>  
              Add Transaction  
            </Button>  
          </CardContent>  
        </Card>  

        {/* PDF BUTTONS */}  
        <div className="flex justify-end gap-2">  
          <Button variant="outline" onClick={() => generateLedgerPDF('month')}>  
            Monthly PDF  
          </Button>  
          <Button variant="outline" onClick={() => generateLedgerPDF('year')}>  
            Yearly PDF  
          </Button>  
        </div>  

        {/* LEDGER */}  
        <Card ref={printRef}>  
          <CardHeader>  
            <CardTitle>Transaction History</CardTitle>  
          </CardHeader>  
          <CardContent className="space-y-3">  
            {entries.map(e => (  
              <div key={e.id} className="flex justify-between p-3 bg-muted/50 rounded-lg">  
                <div>  
                  <p className="font-medium">  
                    {e.type === 'credit' ? 'Credit' : 'Debit'}  
                  </p>  
                  {e.reason && (  
                    <p className="text-sm text-muted-foreground">  
                      {e.reason}  
                    </p>  
                  )}  
                  <p className="text-xs text-muted-foreground">  
                    {e.created_at && format(new Date(e.created_at), 'PPp')}  
                  </p>  
                </div>  
                <p className={`font-bold ${e.type === 'credit' ? 'text-green-600' : 'text-red-600'}`}>  
                  {e.type === 'credit' ? '+' : '-'}₹{e.amount.toLocaleString('en-IN')}  
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

/* ===================== SUMMARY CARD ===================== */

const Summary = ({ icon, label, value }: any) => (
<Card>
<CardContent className="p-4 text-center">
{icon}
<p className="text-lg font-bold">₹{value.toLocaleString('en-IN')}</p>
<p className="text-xs text-muted-foreground">{label}</p>
</CardContent>
</Card>
);

export default AdminLedger; 