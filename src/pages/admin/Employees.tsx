import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/Header";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "@/hooks/use-toast";

import {
  Users,
  Edit,
  MapPin,
  IndianRupee,
  X,
  Calendar,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  Clock,
  XCircle,
  Plane,
} from "lucide-react";

import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isSunday,
  addMonths,
  subMonths,
} from "date-fns";

/* ===================== TYPES ===================== */

interface Employee {
  user_id: string | null;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  daily_wage: number | null;
  site_id: string | null;
  designation: string | null;
}

interface Site {
  id: string;
  name: string;
}

interface AttendanceRow {
  day: string;
  checkin_at: string | null;
  checkout_at: string | null;
}

interface HolidayRow {
  holiday_date: string;
  description: string | null;
}

/* ===================== COMPONENT ===================== */

const AdminEmployees = () => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);

  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [editForm, setEditForm] = useState({
    designation: "",
    daily_wage: "",
    site_id: "",
  });

  /* ---------- MONTH VIEW ---------- */
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [attendance, setAttendance] = useState<AttendanceRow[]>([]);
  const [holidays, setHolidays] = useState<HolidayRow[]>([]);
  const [summary, setSummary] = useState({
    present: 0,
    half: 0,
    absent: 0,
    companyLeave: 0,
  });

  /* ===================== FETCH EMPLOYEES ===================== */

  const fetchEmployees = async () => {
    const { data } = await supabase
      .from("employee_directory")
      .select("*")
      .eq("role", "employee");

    if (data) setEmployees(data);

    const { data: siteData } = await supabase
      .from("sites")
      .select("id, name");

    if (siteData) setSites(siteData);
  };

  /* ===================== REALTIME (SAFE) ===================== */

  useEffect(() => {
    fetchEmployees();

    const channel = supabase
      .channel("admin-employees-realtime")

      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "employee_directory" },
        () => {
          fetchEmployees();
        }
      )

      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "employees" },
        () => {
          fetchEmployees();
        }
      )

      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  /* ===================== MONTH DATA ===================== */

  useEffect(() => {
    if (!selectedEmployee?.user_id) return;

    fetchMonthData();

    const channel = supabase
      .channel(`emp-month-${selectedEmployee.user_id}`)

      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "attendance" },
        () => fetchMonthData()
      )

      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "holidays" },
        () => fetchMonthData()
      )

      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedEmployee, currentMonth]);

  const fetchMonthData = async () => {
    if (!selectedEmployee?.user_id) return;

    const start = format(startOfMonth(currentMonth), "yyyy-MM-dd");
    const end = format(endOfMonth(currentMonth), "yyyy-MM-dd");

    const { data: attData } = await supabase
      .from("attendance")
      .select("day, checkin_at, checkout_at")
      .eq("emp_user_id", selectedEmployee.user_id)
      .gte("day", start)
      .lte("day", end);

    const { data: holidayData } = await supabase
      .from("holidays")
      .select("holiday_date, description")
      .gte("holiday_date", start)
      .lte("holiday_date", end);

    const present = attData?.filter(a => a.checkout_at)?.length || 0;
    const half = attData?.filter(a => a.checkin_at && !a.checkout_at)?.length || 0;
    const companyLeave = holidayData?.length || 0;

    const workingDays = eachDayOfInterval({
      start: startOfMonth(currentMonth),
      end: endOfMonth(currentMonth),
    }).filter(d => !isSunday(d)).length;

    setAttendance(attData || []);
    setHolidays(holidayData || []);
    setSummary({
      present,
      half,
      companyLeave,
      absent: Math.max(0, workingDays - present - half - companyLeave),
    });
  };

  /* ===================== HELPERS ===================== */

  const getSiteName = (siteId: string | null) =>
    sites.find(s => s.id === siteId)?.name || "Not assigned";

  /* ===================== ACTIONS ===================== */

  const handleEdit = (emp: Employee) => {
    setSelectedEmployee(emp);
    setEditForm({
      designation: emp.designation || "",
      daily_wage: emp.daily_wage?.toString() || "",
      site_id: emp.site_id || "",
    });
    setIsDetailOpen(false);
    setIsEditOpen(true);
  };

  const handleSave = async () => {
    if (!selectedEmployee?.user_id) return;

    setIsSaving(true);

    const { error } = await supabase
      .from("employees")
      .update({
        designation: editForm.designation || null,
        daily_wage: editForm.daily_wage
          ? Number(editForm.daily_wage)
          : null,
        site_id: editForm.site_id || null,
      })
      .eq("user_id", selectedEmployee.user_id);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Success", description: "Employee updated successfully" });
      setIsEditOpen(false);
      fetchEmployees();
    }

    setIsSaving(false);
  };

  /* ===================== UI ===================== */

  return (
    <div className="min-h-screen bg-background">
      <Header title="Employee Management" backTo="/admin/dashboard" />

      <main className="p-4 max-w-4xl mx-auto space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" /> All Employees ({employees.length})
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-3">
            {employees.map(emp => (
              <div
                key={emp.user_id!}
                className="p-4 bg-muted/50 rounded-lg cursor-pointer hover:bg-muted"
                onClick={() => {
                  setSelectedEmployee(emp);
                  setIsDetailOpen(true);
                }}
              >
                <div className="flex gap-4">
                  <Avatar>
                    <AvatarImage src={emp.avatar_url || undefined} />
                    <AvatarFallback>{emp.full_name?.[0] || "E"}</AvatarFallback>
                  </Avatar>

                  <div className="flex-1">
                    <p className="font-medium">{emp.full_name}</p>
                    <p className="text-sm text-muted-foreground">{emp.email}</p>
                    <p className="text-sm flex gap-1">
                      <MapPin className="h-3 w-3" /> {getSiteName(emp.site_id)}
                    </p>
                    <p className="text-sm text-green-600 flex gap-1">
                      <IndianRupee className="h-3 w-3" /> {emp.daily_wage}/day
                    </p>
                  </div>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEdit(emp);
                    }}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* EDIT DIALOG */}
        <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Employee</DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <Label>Designation</Label>
              <Input
                value={editForm.designation}
                onChange={e =>
                  setEditForm({ ...editForm, designation: e.target.value })
                }
              />

              <Label>Daily Wage</Label>
              <Input
                type="number"
                value={editForm.daily_wage}
                onChange={e =>
                  setEditForm({ ...editForm, daily_wage: e.target.value })
                }
              />

              <Label>Site</Label>
              <Select
                value={editForm.site_id}
                onValueChange={v =>
                  setEditForm({ ...editForm, site_id: v })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {sites.map(s => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEditOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving ? "Saving..." : "Save"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
};

export default AdminEmployees;