import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, CheckCircle, XCircle } from "lucide-react";
import { format } from "date-fns";
import { Database } from "@/integrations/supabase/types";

type LeaveStatus = Database["public"]["Enums"]["leave_status"];

interface LeaveRequest {
  id: string;
  start_date: string;
  end_date: string;
  status: LeaveStatus | null;
}

const EmployeeLeaves = () => {
  const { user } = useAuth();
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [monthlyCount, setMonthlyCount] = useState(0);

  useEffect(() => {
    if (!user) return;
    fetchLeaves();
  }, [user]);

  const fetchLeaves = async () => {
    const { data } = await supabase
      .from("leaves")
      .select("id, start_date, end_date, status")
      .eq("emp_user_id", user!.id)
      .order("created_at", { ascending: false });

    setLeaves(data || []);

    const monthStart = new Date().toISOString().slice(0, 7) + "-01";

    const { count } = await supabase
      .from("leaves")
      .select("*", { count: "exact", head: true })
      .eq("emp_user_id", user!.id)
      .eq("status", "approved")
      .gte("start_date", monthStart);

    setMonthlyCount(count || 0);
  };

  const badge = (status: LeaveStatus | null) => {
    if (status === "approved")
      return <Badge className="bg-green-500"><CheckCircle className="h-3 w-3 mr-1"/>Approved</Badge>;
    if (status === "rejected")
      return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1"/>Rejected</Badge>;
    return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1"/>Pending</Badge>;
  };

  return (
    <div className="min-h-screen bg-background">
      <Header title="My Leaves" backTo="/employee/dashboard" />

      <main className="p-4 max-w-2xl mx-auto space-y-4">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-sm text-muted-foreground">Leaves Used This Month</p>
            <p className="text-2xl font-bold">{monthlyCount} / 2</p>
            {monthlyCount > 2 && (
              <p className="text-sm text-red-600 mt-1">
                Leaves beyond 2 are unpaid
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Leave History
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-3">
            {leaves.map(l => (
              <div key={l.id} className="p-3 bg-muted/50 rounded-lg flex justify-between">
                <div>
                  <p className="font-medium">
                    {format(new Date(l.start_date), "PPP")} →{" "}
                    {format(new Date(l.end_date), "PPP")}
                  </p>
                </div>
                {badge(l.status)}
              </div>
            ))}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default EmployeeLeaves;