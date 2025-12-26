import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import Header from '@/components/Header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Wallet, TrendingUp, TrendingDown, IndianRupee } from 'lucide-react';
import { format } from 'date-fns';

interface LedgerEntry {
  id: string;
  amount: number;
  type: 'credit' | 'debit';
  reason: string | null;
  created_at: string | null;
}

const EmployeeLedger = () => {
  const { user } = useAuth();
  const [balance, setBalance] = useState(0);
  const [entries, setEntries] = useState<LedgerEntry[]>([]);

  const fetchData = async () => {
    if (!user) return;

    const { data: total } = await supabase
      .from('v_ledger_totals')
      .select('balance')
      .eq('emp_user_id', user.id)
      .maybeSingle();

    setBalance(Number(total?.balance ?? 0));

    const { data } = await supabase
      .from('money_ledger')
      .select('*')
      .eq('emp_user_id', user.id)
      .order('created_at', { ascending: false });

    setEntries(data || []);
  };

  useEffect(() => {
    if (!user) return;

    fetchData();

    const channel = supabase
      .channel(`employee-ledger-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'money_ledger',
          filter: `emp_user_id=eq.${user.id}`,
        },
        () => {
          fetchData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const totalCredits = entries
    .filter(e => e.type === 'credit')
    .reduce((s, e) => s + e.amount, 0);

  const totalDebits = entries
    .filter(e => e.type === 'debit')
    .reduce((s, e) => s + e.amount, 0);

  return (
    <div className="min-h-screen bg-background">
      <Header title="Money Ledger" backTo="/employee/dashboard" />

      <main className="p-4 max-w-2xl mx-auto space-y-4">
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">Current Balance</p>
            <p className="text-3xl font-bold flex items-center">
              <IndianRupee className="h-6 w-6" />
              {balance.toFixed(2)}
            </p>
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 gap-3">
          <Summary icon={<TrendingUp />} label="Credits" value={totalCredits} />
          <Summary icon={<TrendingDown />} label="Debits" value={totalDebits} />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Transaction History</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {entries.map(e => (
              <div
                key={e.id}
                className="flex justify-between p-3 bg-muted rounded"
              >
                <div>
                  <p className="font-medium">{e.reason}</p>
                  <p className="text-xs text-muted-foreground">
                    {e.created_at && format(new Date(e.created_at), 'PPp')}
                  </p>
                </div>
                <p
                  className={
                    e.type === 'credit'
                      ? 'text-green-600'
                      : 'text-red-600'
                  }
                >
                  {e.type === 'credit' ? '+' : '-'}₹
                  {e.amount.toFixed(2)}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

const Summary = ({ icon, label, value }: any) => (
  <Card>
    <CardContent className="p-4 text-center">
      {icon}
      <p className="text-lg font-bold">₹{value.toFixed(2)}</p>
      <p className="text-xs">{label}</p>
    </CardContent>
  </Card>
);

export default EmployeeLedger;