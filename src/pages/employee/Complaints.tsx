import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import Header from '@/components/Header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { AlertCircle, Clock, CheckCircle, Loader2 } from 'lucide-react';
import { format } from 'date-fns';

interface Complaint {
  id: string;
  description: string | null;
  status: string | null;
  created_at: string | null;
}

const EmployeeComplaints = () => {
  const { user } = useAuth();
  const [complaintText, setComplaintText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [complaints, setComplaints] = useState<Complaint[]>([]);

  useEffect(() => {
    if (!user) return;
    fetchComplaints();
  }, [user]);

  const fetchComplaints = async () => {
    const { data } = await supabase
      .from('complaints')
      .select('id, description, status, created_at')
      .eq('raised_by', user!.id)
      .order('created_at', { ascending: false });

    if (data) setComplaints(data);
  };

  const handleSubmit = async () => {
    if (!complaintText.trim()) {
      toast({ title: 'Error', description: 'Please enter your complaint', variant: 'destructive' });
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('complaints')
        .insert({
          raised_by: user!.id,
          description: complaintText.trim(),
          status: 'open',
        });

      if (error) throw error;

      toast({ title: 'Success', description: 'Complaint submitted successfully' });
      setComplaintText('');
      fetchComplaints();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
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

  return (
    <div className="min-h-screen bg-background">
      <Header title="Complaints" backTo="/employee/dashboard" />
      
      <main className="p-4 max-w-2xl mx-auto space-y-4">
        {/* Submit Complaint Form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              Raise a Complaint
            </CardTitle>
            <CardDescription>Describe your issue and we'll address it</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              placeholder="Describe your complaint in detail..."
              value={complaintText}
              onChange={(e) => setComplaintText(e.target.value)}
              rows={4}
            />
            <Button onClick={handleSubmit} disabled={isSubmitting} className="w-full">
              {isSubmitting ? 'Submitting...' : 'Submit Complaint'}
            </Button>
          </CardContent>
        </Card>

        {/* Complaints History */}
        <Card>
          <CardHeader>
            <CardTitle>Your Complaints</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {complaints.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">No complaints submitted</p>
              ) : (
                complaints.map((complaint) => (
                  <div key={complaint.id} className="p-4 bg-muted/50 rounded-lg">
                    <div className="flex justify-between items-start mb-2">
                      <p className="text-sm text-muted-foreground">
                        {complaint.created_at ? format(new Date(complaint.created_at), 'PPp') : 'Unknown date'}
                      </p>
                      {getStatusBadge(complaint.status)}
                    </div>
                    <p className="text-sm">{complaint.description}</p>
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

export default EmployeeComplaints;
