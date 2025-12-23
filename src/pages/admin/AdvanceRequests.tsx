import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/Header";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import {
  IndianRupee,
  CheckCircle,
  XCircle,
  Clock,
  User,
} from "lucide-react";
import { format } from "date-fns";
import { Database } from "@/integrations/supabase/types";

/* ===================== TYPES ===================== */

type AdvanceStatus =
  Database["public"]["Tables"]["advance_requests"]["Row"]["status"];

type AdvanceRequest =
  Database["public"]["Tables"]["advance_requests"]["Row"] & {
    employee?: {
      full_name: string | null;
      email: string | null;
    } | null;
  };

/* ===================== COMPONENT ===================== */

const AdminAdvanceRequests = () => {
  const [requests, setRequests] = useState<AdvanceRequest[]>([]);
  const [isUpdating, setIsUpdating] = useState<string | null>(null);

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    const { data } = await supabase
      .from("advance_requests")
      .select("*")
      .order("created_at", { ascending: false });

    if (!data) return;

    const rows =
      data as Database["public"]["Tables"]["advance_requests"]["Row"][];

    const userIds = [...new Set(rows.map((r) => r.user_id))];

    const { data: profiles } = await supabase
      .from("profiles")
      .select("auth_uid, full_name, email")
      .in("auth_uid", userIds);

    const enriched: AdvanceRequest[] = rows.map((req) => ({
      ...req,
      employee:
        profiles?.find(
          (p) => p.auth_uid === req.user_id
        ) || null,
    }));

    setRequests(enriched);
  };

  const approveRequest = async (req: AdvanceRequest) => {
    setIsUpdating(req.id);

    try {
      await supabase
        .from("advance_requests")
        .update({
          status: "approved" as AdvanceStatus,
        })
        .eq("id", req.id);

      await supabase.from("money_ledger").insert({
        emp_user_id: req.user_id,
        amount: req.amount,
        type: "debit",
        reason: "Advance Approved",
        month_year: format(new Date(), "yyyy-MM-01"),
      });

      await supabase.from("notifications").insert({
        user_id: req.user_id,
        title: "Advance Approved",
        body: `₹${req.amount} advance has been approved and debited.`,
        read: false,
      });

      toast({ title: "Advance Approved & Debited" });
      fetchRequests();
    } catch (e: any) {
      toast({
        title: "Error",
        description: e.message,
        variant: "destructive",
      });
    } finally {
      setIsUpdating(null);
    }
  };

  const rejectRequest = async (req: AdvanceRequest) => {
    setIsUpdating(req.id);

    try {
      await supabase
        .from("advance_requests")
        .update({
          status: "rejected" as AdvanceStatus,
        })
        .eq("id", req.id);

      await supabase.from("notifications").insert({
        user_id: req.user_id,
        title: "Advance Rejected",
        body: "Your advance request has been rejected.",
        read: false,
      });

      toast({ title: "Advance Rejected" });
      fetchRequests();
    } catch (e: any) {
      toast({
        title: "Error",
        description: e.message,
        variant: "destructive",
      });
    } finally {
      setIsUpdating(null);
    }
  };

  const getBadge = (status: AdvanceStatus) => {
    switch (status) {
      case "approved":
        return (
          <Badge className="bg-green-500">
            <CheckCircle className="h-3 w-3 mr-1" />
            Approved
          </Badge>
        );
      case "rejected":
        return (
          <Badge variant="destructive">
            <XCircle className="h-3 w-3 mr-1" />
            Rejected
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary">
            <Clock className="h-3 w-3 mr-1" />
            Pending
          </Badge>
        );
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header title="Advance Requests" backTo="/admin/dashboard" />

      <main className="p-4 max-w-4xl mx-auto space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <IndianRupee className="h-5 w-5" />
              Advance Requests
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-3">
            {requests.map((req) => (
              <div
                key={req.id}
                className="p-4 bg-muted/50 rounded-lg"
              >
                <div className="flex justify-between gap-3">
                  <div>
                    <p className="font-medium flex items-center gap-2">
                      <User className="h-4 w-4" />
                      {req.employee?.full_name ||
                        req.employee?.email}
                      {getBadge(req.status)}
                    </p>

                    <p className="text-sm mt-1">
                      Amount: <strong>₹{req.amount}</strong>
                    </p>

                    {req.reason && (
                      <p className="text-sm text-muted-foreground">
                        Reason: {req.reason}
                      </p>
                    )}
                  </div>

                  {req.status === "pending" && (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        className="bg-green-500"
                        disabled={isUpdating === req.id}
                        onClick={() => approveRequest(req)}
                      >
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={isUpdating === req.id}
                        onClick={() => rejectRequest(req)}
                      >
                        Reject
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default AdminAdvanceRequests;