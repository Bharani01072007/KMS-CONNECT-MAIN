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
  type: string;
  reason: string | null;
  created_at: string | null;
}

const EmployeeLedger = () => {
  const { user } = useAuth();
  const [balance, setBalance] = useState(0);
  const [entries, setEntries] = useState<LedgerEntry[]>([]);

  useEffect(() => {
    if (!user) return;
    fetchData();
  }, [user]);

  const fetchData = async () => {
    // Fetch balance
    const { data: totalsData } = await supabase
      .from('v_ledger_totals')
      .select('balance')
      .eq('emp_user_id', user!.id)
      .maybeSingle();

    if (totalsData) {
      setBalance(totalsData.balance ?? 0);
    }

    // Fetch entries
    const { data: entriesData } = await supabase
      .from('money_ledger')
      .select('id, amount, type, reason, created_at')
      .eq('emp_user_id', user!.id)
      .order('created_at', { ascending: false });

    if (entriesData) setEntries(entriesData);
  };

  // Calculate totals from entries
  const totalCredits = entries.filter(e => e.type === 'credit').reduce((sum, e) => sum + e.amount, 0);
  const totalDebits = entries.filter(e => e.type === 'debit').reduce((sum, e) => sum + e.amount, 0);

  return (
    <div className="min-h-screen bg-background">
      <Header title="Money Ledger" backTo="/employee/dashboard" />
      
      <main className="p-4 max-w-2xl mx-auto space-y-4">
        {/* Balance Card */}
        <Card className="bg-gradient-to-br from-primary/10 to-accent/20 border-0">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Current Balance</p>
                <p className="text-3xl font-bold text-primary flex items-center">
                  <IndianRupee className="h-7 w-7" />
                  {balance.toLocaleString('en-IN')}
                </p>
              </div>
              <Wallet className="h-12 w-12 text-primary/30" />
            </div>
          </CardContent>
        </Card>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 gap-3">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-500/10">
                  <TrendingUp className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Earnings</p>
                  <p className="text-xl font-bold text-green-600">
                    ₹{totalCredits.toLocaleString('en-IN')}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-red-500/10">
                  <TrendingDown className="h-5 w-5 text-red-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Deductions</p>
                  <p className="text-xl font-bold text-red-600">
                    ₹{totalDebits.toLocaleString('en-IN')}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Transaction History */}
        <Card>
          <CardHeader>
            <CardTitle>Transaction History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {entries.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">No transactions yet</p>
              ) : (
                entries.map((entry) => (
                  <div key={entry.id} className="p-3 bg-muted/50 rounded-lg flex justify-between items-center">
                    <div>
                      <div className="flex items-center gap-2">
                        {entry.type === 'credit' ? (
                          <TrendingUp className="h-4 w-4 text-green-500" />
                        ) : (
                          <TrendingDown className="h-4 w-4 text-red-500" />
                        )}
                        <span className="font-medium">
                          {entry.type === 'credit' ? 'Payment' : 'Deduction'}
                        </span>
                      </div>
                      {entry.reason && (
                        <p className="text-sm text-muted-foreground mt-1">{entry.reason}</p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {entry.created_at ? format(new Date(entry.created_at), 'PPp') : 'Unknown date'}
                      </p>
                    </div>
                    <p className={`text-lg font-bold ${entry.type === 'credit' ? 'text-green-600' : 'text-red-600'}`}>
                      {entry.type === 'credit' ? '+' : '-'}₹{entry.amount.toLocaleString('en-IN')}
                    </p>
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

export default EmployeeLedger;
