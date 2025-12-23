import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import Header from '@/components/Header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { AlertCircle, User, Clock, CheckCircle, Loader2 } from 'lucide-react';
import { format } from 'date-fns';

interface Complaint {
  id: string;
  description: string | null;
  status: string | null;
  created_at: string | null;
  raised_by: string;
  employee?: { full_name: string | null; email: string | null } | null;
}

const AdminComplaints = () => {
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    fetchComplaints();
  }, []);

  const fetchComplaints = async () => {
    const { data } = await supabase
      .from('complaints')
      .select('*')
      .order('created_at', { ascending: false });

    if (data) {
      const userIds = [...new Set(data.map(c => c.raised_by))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('auth_uid, full_name, email')
        .in('auth_uid', userIds);

      const enriched = data.map(complaint => ({
        ...complaint,
        employee: profiles?.find(p => p.auth_uid === complaint.raised_by) || null,
      }));

      setComplaints(enriched);
    }
  };

  const handleStatusChange = async (id: string, status: string) => {
    setUpdatingId(id);
    try {
      const { error } = await supabase
        .from('complaints')
        .update({ status })
        .eq('id', id);

      if (error) throw error;

      toast({ title: 'Success', description: 'Status updated' });
      fetchComplaints();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setUpdatingId(null);
    }
  };

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case 'resolved':
        return <Badge className="bg-green-500"><CheckCircle className="h-3 w-3 mr-1" />Resolved</Badge>;
      case 'in_progress':
        return <Badge className="bg-blue-500"><Loader2 className="h-3 w-3 mr-1" />In Progress</Badge>;
      default:
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Open</Badge>;
    }
  };

  const openCount = complaints.filter(c => c.status === 'open').length;

  return (
    <div className="min-h-screen bg-background">
      <Header title="Complaints" backTo="/admin/dashboard" />
      
      <main className="p-4 max-w-4xl mx-auto space-y-4">
        {/* Summary */}
        {openCount > 0 && (
          <Card className="border-destructive/30 bg-destructive/5">
            <CardContent className="p-4 flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-destructive" />
              <p className="font-medium text-destructive">
                {openCount} open complaint{openCount > 1 ? 's' : ''} require attention
              </p>
            </CardContent>
          </Card>
        )}

        {/* Complaints List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              All Complaints
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {complaints.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">No complaints</p>
              ) : (
                complaints.map((complaint) => (
                  <div key={complaint.id} className="p-4 bg-muted/50 rounded-lg">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">
                            {complaint.employee?.full_name || complaint.employee?.email || 'Unknown'}
                          </span>
                          {getStatusBadge(complaint.status)}
                        </div>
                        <p className="text-sm">{complaint.description}</p>
                        <p className="text-xs text-muted-foreground mt-2">
                          Submitted: {complaint.created_at ? format(new Date(complaint.created_at), 'PPp') : 'N/A'}
                        </p>
                      </div>
                      <Select
                        value={complaint.status || 'open'}
                        onValueChange={(v) => handleStatusChange(complaint.id, v)}
                        disabled={updatingId === complaint.id}
                      >
                        <SelectTrigger className="w-[140px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="open">Open</SelectItem>
                          <SelectItem value="in_progress">In Progress</SelectItem>
                          <SelectItem value="resolved">Resolved</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
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

export default AdminComplaints;