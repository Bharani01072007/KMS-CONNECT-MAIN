import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { Calendar, Trash2, Plus } from "lucide-react";
import { format } from "date-fns";

/* ===================== TYPES ===================== */

interface Holiday {
  id: string;
  holiday_date: string;
  description: string | null;
}

/* ===================== COMPONENT ===================== */

const AdminHolidays = () => {
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [date, setDate] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchHolidays();

    /* ===================== 🔴 REALTIME ===================== */

    const channel = supabase
      .channel("admin-holidays-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "holidays",
        },
        () => {
          fetchHolidays();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  /* ===================== FETCH ===================== */

  const fetchHolidays = async () => {
    const { data } = await supabase
      .from("holidays")
      .select("*")
      .order("holiday_date", { ascending: false });

    if (data) setHolidays(data);
  };

  /* ===================== ADD ===================== */

  const addHoliday = async () => {
    if (!date) {
      toast({
        title: "Please select a date",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    const { error } = await supabase.from("holidays").insert({
      holiday_date: date,
      description: description || null,
    });

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({ title: "Company holiday added" });
      setDate("");
      setDescription("");
    }

    setLoading(false);
  };

  /* ===================== DELETE ===================== */

  const deleteHoliday = async (id: string) => {
    const { error } = await supabase
      .from("holidays")
      .delete()
      .eq("id", id);

    if (!error) {
      toast({ title: "Holiday removed" });
    }
  };

  /* ===================== UI ===================== */

  return (
    <div className="min-h-screen bg-background">
      <Header title="Company Holidays" backTo="/admin/dashboard" />

      <main className="p-4 max-w-3xl mx-auto space-y-4">
        {/* ADD HOLIDAY */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Add Company Holiday
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-4">
            <div>
              <Label>Date</Label>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>

            <div>
              <Label>Description (optional)</Label>
              <Input
                placeholder="e.g. Pongal Festival"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <Button onClick={addHoliday} disabled={loading}>
              {loading ? "Saving..." : "Add Holiday"}
            </Button>
          </CardContent>
        </Card>

        {/* HOLIDAY LIST */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Holiday List
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-3">
            {holidays.length === 0 && (
              <p className="text-sm text-muted-foreground text-center">
                No company holidays added
              </p>
            )}

            {holidays.map((h) => (
              <div
                key={h.id}
                className="flex justify-between items-center p-3 bg-muted/50 rounded-lg"
              >
                <div>
                  <p className="font-medium">
                    {format(new Date(h.holiday_date), "PPP")}
                  </p>
                  {h.description && (
                    <p className="text-sm text-muted-foreground">
                      {h.description}
                    </p>
                  )}
                </div>

                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => deleteHoliday(h.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default AdminHolidays;