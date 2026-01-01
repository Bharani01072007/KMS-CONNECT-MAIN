import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
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

import { Users, Edit, MapPin, IndianRupee } from "lucide-react";

/* ===================== TYPES ===================== */

interface Employee {
  user_id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  designation: string | null;
  daily_wage: number | null;
  site_id: string | null;
}

interface Site {
  id: string;
  name: string;
}

/* ===================== COMPONENT ===================== */

const AdminEmployees = () => {
  const navigate = useNavigate();

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [editForm, setEditForm] = useState({
    designation: "",
    daily_wage: "",
    site_id: "",
  });

  /* ===================== FETCH ===================== */

  const fetchEmployees = async () => {
    const { data, error } = await supabase
      .from("employees")
      .select(`
        user_id,
        designation,
        daily_wage,
        site_id,
        profiles (
          full_name,
          email,
          avatar_url
        )
      `);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }

    const formatted = data.map((e: any) => ({
      user_id: e.user_id,
      designation: e.designation,
      daily_wage: e.daily_wage,
      site_id: e.site_id,
      full_name: e.profiles?.full_name ?? null,
      email: e.profiles?.email ?? null,
      avatar_url: e.profiles?.avatar_url ?? null,
    }));

    setEmployees(formatted);
  };

  const fetchSites = async () => {
    const { data } = await supabase.from("sites").select("id, name");
    if (data) setSites(data);
  };

  /* ===================== REALTIME ===================== */

  useEffect(() => {
    fetchEmployees();
    fetchSites();

    const channel = supabase
      .channel("admin-employees")
      .on("postgres_changes", { event: "*", schema: "public", table: "employees" }, fetchEmployees)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  /* ===================== ACTIONS ===================== */

  const handleEdit = (emp: Employee) => {
    setSelectedEmployee(emp);
    setEditForm({
      designation: emp.designation ?? "",
      daily_wage: emp.daily_wage?.toString() ?? "",
      site_id: emp.site_id ?? "",
    });
    setIsEditOpen(true);
  };

  const handleSave = async () => {
    if (!selectedEmployee) return;

    setIsSaving(true);

    const { error } = await supabase
      .from("employees")
      .update({
        designation: editForm.designation || null,
        daily_wage: editForm.daily_wage ? Number(editForm.daily_wage) : null,
        site_id: editForm.site_id || null,
      })
      .eq("user_id", selectedEmployee.user_id);

    if (error) {
      toast({ title: "Update failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Employee updated successfully" });
      setIsEditOpen(false);
      fetchEmployees();
    }

    setIsSaving(false);
  };

  const getSiteName = (id: string | null) =>
    sites.find(s => s.id === id)?.name || "Not assigned";

  /* ===================== UI ===================== */

  return (
    <div className="min-h-screen bg-background">
      <Header title="Employee Management" backTo="/admin/dashboard" />

      <main className="p-4 max-w-4xl mx-auto space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              All Employees ({employees.length})
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-3">
            {employees.map(emp => (
              <div
                key={emp.user_id}
                className="p-4 bg-muted/50 rounded-lg hover:bg-muted cursor-pointer"
                onClick={() => navigate(`/admin/attendance-history/${emp.user_id}`)}
              >
                <div className="flex gap-4 items-center">
                  <Avatar>
                    <AvatarImage src={emp.avatar_url ?? undefined} />
                    <AvatarFallback>{emp.full_name?.[0] ?? "E"}</AvatarFallback>
                  </Avatar>

                  <div className="flex-1">
                    <p className="font-medium">{emp.full_name}</p>
                    <p className="text-sm text-muted-foreground">{emp.email}</p>
                    <p className="text-sm flex gap-1">
                      <MapPin className="h-3 w-3" />
                      {getSiteName(emp.site_id)}
                    </p>
                    <p className="text-sm text-green-600 flex gap-1">
                      <IndianRupee className="h-3 w-3" />
                      {emp.daily_wage ?? 0}/day
                    </p>
                  </div>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={e => {
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

        {/* EDIT MODAL */}
        <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Employee</DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <Label>Designation</Label>
                <Input
                  value={editForm.designation}
                  onChange={e => setEditForm({ ...editForm, designation: e.target.value })}
                />
              </div>

              <div>
                <Label>Daily Wage</Label>
                <Input
                  type="number"
                  value={editForm.daily_wage}
                  onChange={e => setEditForm({ ...editForm, daily_wage: e.target.value })}
                />
              </div>

              <div>
                <Label>Site</Label>
                <Select
                  value={editForm.site_id}
                  onValueChange={v => setEditForm({ ...editForm, site_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select site" />
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