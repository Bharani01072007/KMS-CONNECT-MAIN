import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { Calendar as CalendarIcon, Trash2, Plus } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { format, eachDayOfInterval } from "date-fns";
import type { DateRange } from "react-day-picker";

/* ===================== TYPES ===================== */

interface Holiday {
  id: string;
  holiday_date: string;
  description: string | null;
}

/* ===================== COMPONENT ===================== */

const AdminHolidays = () => {
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [range, setRange] = useState<DateRange | undefined>();
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

  /* ===================== ADD (RANGE SUPPORT) ===================== */

  const addHoliday = async () => {
    if (!range?.from || !range?.to) {
      toast({
        title: "Please select a date range",
        variant: "destructive",
      });
      return;
    }

    const days = eachDayOfInterval({
      start: range.from,
      end: range.to,
    });

    setLoading(true);

    try {
      const rows = days.map((d) => ({
        holiday_date: format(d, "yyyy-MM-dd"),
        description: description || null,
      }));

      const { error } = await supabase.from("holidays").insert(rows);
      if (error) throw error;

      toast({ title: "Company holidays added" });
      setRange(undefined);
      setDescription("");
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  /* ===================== DELETE ===================== */

  const deleteHoliday = async (id: string) => 
  {
    try{
      const { error } = await supabase
        .from("holidays")
        .delete()
        .eq("id", id);
      if (error) throw error;
      toast({ title: "Holiday removed and salary reverted" });
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive",
      });
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
              <Label>Select Date Range</Label>
              <Calendar
                mode="range"
                selected={range}
                onSelect={setRange}
                numberOfMonths={1}
              />
            </div>

            {range?.from && (
              <p className="text-sm text-muted-foreground">
                Selected: {format(range.from, "PPP")} →{" "}
                {range.to ? format(range.to, "PPP") : ""}
              </p>
            )}

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
              <CalendarIcon className="h-5 w-5" />
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