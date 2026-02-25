import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/Header";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
  id: string;               // ✅ employees.id (PRIMARY KEY)
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
  const [isCreateOpen, setIsCreateOpen] = useState(false); 
  const [createForm, setCreateForm] = useState({
    email: "",
    password:"",
    full_name: "",
    site_id:"",
    designation: "", 
    daily_wage: "",
    avatar:"",});

  /* ===================== FETCH ===================== */

  const fetchEmployees = async () => {
    const { data, error } = await supabase
      .from("employee_directory")
      .select(`
        id,
        user_id,
        full_name,
        email,
        avatar_url,
        designation,
        daily_wage,
        site_id
      `)
      .eq("role", "employee")
      .order("full_name");

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }

    setEmployees(data as Employee[]);
  };

  const fetchSites = async () => {
    const { data } = await supabase.from("sites").select("id, name");
    if (data) setSites(data);
  };

  /* ===================== EFFECT ===================== */

  useEffect(() => {
    fetchEmployees();
    fetchSites();

    const channel = supabase
      .channel("admin-employees-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "employees" },
        fetchEmployees
      )
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
        daily_wage: editForm.daily_wage
          ? Number(editForm.daily_wage)
          : null,
        site_id: editForm.site_id || null,
      })
      .eq("id", selectedEmployee.id); // ✅ CRITICAL FIX

    if (error) {
      toast({
        title: "Update failed",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({ title: "Employee updated successfully" });
      setIsEditOpen(false);
      fetchEmployees();
    }

    setIsSaving(false);
  };

  const getSiteName = (id: string | null) =>
    sites.find((s) => s.id === id)?.name || "Not assigned";

  const handleCreate = async () => 
  {
    console.log("Sending avatar:", createForm.avatar?.substring(0,50))
    try {
      const { data, error } = await supabase.functions.invoke(
        "create-employee",
        {
          body: {
            email: createForm.email,
            password: createForm.password,
            full_name: createForm.full_name,
            site_id: createForm.site_id,
            designation: createForm.designation,
            daily_wage: Number(createForm.daily_wage),
            avatar: createForm.avatar,
          },
        }
      );

      if (error) {
        throw new Error(error.message);
      }

      toast({ title: "Employee Created Successfully" });

      setIsCreateOpen(false);
      fetchEmployees();

      setCreateForm({
        email: "",
        password: "",
        full_name: "",
        site_id: "",
        designation: "",
        daily_wage: "",
        avatar:"",
      });

    } catch (err: any) 
      {
      toast({
        title: "Creation failed",
        description: err.message,
        variant: "destructive",
        });
      
      }
    
  };

  /* ===================== UI ===================== */

  return (
    <div className="min-h-screen bg-background">
      <Header title="Employee Management" backTo="/admin/dashboard" />

      <main className="p-4 max-w-4xl mx-auto space-y-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              All Employees ({employees.length})
            </CardTitle>
            <Button onClick={()=> setIsCreateOpen(true)}>
          + Add Employee
          </Button>
          </CardHeader>
          

          <CardContent className="space-y-3">
            {employees.map((emp) => (
              <div
                key={emp.id}
                className="p-4 bg-muted/50 rounded-lg hover:bg-muted cursor-pointer"
                onClick={() =>
                  navigate(`/admin/attendance-history/${emp.user_id}`)
                }
              >
                <div className="flex gap-4 items-center">
                  <Avatar>
                    <AvatarImage src={emp.avatar_url ?? undefined} />
                    <AvatarFallback>
                      {emp.full_name?.[0] ?? "E"}
                    </AvatarFallback>
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

                  <div className="flex gap-2">
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

                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={async (e) => {
                        e.stopPropagation()

                        const confirmDelete = confirm(
                          "Are you sure you want to delete this employee?"
                        )

                        if (!confirmDelete) return

                        const { error } = await supabase.functions.invoke(
                          "delete-employee",
                          {
                            body: { user_id: emp.user_id },
                          }
                        )

                        if (error) {
                          toast({
                            title: "Delete failed",
                            description: error?.message || "Failed to delete employee",
                            variant: "destructive",
                          })
                        } else {
                          toast({ title: "Employee deleted successfully" })
                          fetchEmployees()
                        }
                      }}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* ===================== EDIT DIALOG ===================== */}

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
                  onChange={(e) =>
                    setEditForm({ ...editForm, designation: e.target.value })
                  }
                />
              </div>

              <div>
                <Label>Daily Wage</Label>
                <Input
                  type="number"
                  value={editForm.daily_wage}
                  onChange={(e) =>
                    setEditForm({ ...editForm, daily_wage: e.target.value })
                  }
                />
              </div>

              <div>
                <Label>Site</Label>
                <Select
                  value={editForm.site_id}
                  onValueChange={(v) =>
                    setEditForm({ ...editForm, site_id: v })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select site" />
                  </SelectTrigger>
                  <SelectContent>
                    {sites.map((s) => (
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

    {/* ===================== CREATE DIALOG ===================== */}

    <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Employee</DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <Label>Full Name</Label>
                <Input
                  value={createForm.full_name}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, full_name: e.target.value })
                  }
                />
              </div>
              <div>
                <Label>Email</Label>
                <Input
                  type="email"
                  value={createForm.email}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, email: e.target.value })
                  }
                />
              </div>

              <div>
                <Label>Password</Label>
                <Input
                  type="password"
                  value={createForm.password}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, password: e.target.value })
                  }
                />
              </div>

              <div>
                <Label>Designation</Label>
                <Input
                  value={createForm.designation}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, designation: e.target.value })
                  }
                />
              </div>

              <div>
                <Label>Daily Wage</Label>
                <Input
                  type="number"
                  value={createForm.daily_wage}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, daily_wage: e.target.value })
                  }
                />
              </div>

              <div>
                <Label>Site</Label>
                <Select
                  value={createForm.site_id}
                  onValueChange={(v) =>
                    setCreateForm({ ...createForm, site_id: v })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select site" />
                  </SelectTrigger>
                  <SelectContent>
                    {sites.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreate}>
                Create
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
};

export default AdminEmployees;