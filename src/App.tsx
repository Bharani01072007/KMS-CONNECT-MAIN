import { useEffect } from "react";
import { BrowserRouter, Routes, Route, useNavigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

import { supabase } from "@/integrations/supabase/client";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";

// Pages
import Splash from "./pages/Splash";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";

// Employee pages
import EmployeeDashboard from "./pages/employee/Dashboard";
import EmployeeAttendance from "./pages/employee/Attendance";
import EmployeeAttendanceScan from "./pages/employee/AttendanceScan";
import EmployeeLeaves from "./pages/employee/Leaves";
import EmployeeLedger from "./pages/employee/Ledger";
import EmployeeChat from "./pages/employee/Chat";
import EmployeeComplaints from "./pages/employee/Complaints";
import EmployeeNotifications from "./pages/employee/Notifications";
import EmployeeProfile from "./pages/employee/Profile";
import EmployeeAttendanceHistory from "./pages/employee/AttendanceHistory";
import EmployeeAdvanceRequests from "./pages/employee/AdvanceRequests"; // ✅ ADDED

// Admin pages
import AdminDashboard from "./pages/admin/Dashboard";
import AdminEmployees from "./pages/admin/Employees";
import AdminSites from "./pages/admin/Sites";
import AdminLeaves from "./pages/admin/Leaves";
import AdminLedger from "./pages/admin/Ledger";
import AdminNotifications from "./pages/admin/Notifications";
import AdminComplaints from "./pages/admin/Complaints";
import AdminChat from "./pages/admin/Chat";
import AdminChatInbox from "./pages/admin/ChatInbox";
import AdminHolidays from "./pages/admin/Holidays";
import AdminAdvanceRequests from "./pages/admin/AdvanceRequests"; // ✅ ADDED

const queryClient = new QueryClient();

/* 🔹 SAFE AUTH LISTENER */
const AuthRedirectListener = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) {
        navigate("/", { replace: true });
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  return null;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <AuthRedirectListener />

          <Routes>
            <Route path="/" element={<Splash />} />
            <Route path="/auth" element={<Auth />} />

            {/* ================= EMPLOYEE ROUTES ================= */}
            <Route
              path="/employee/dashboard"
              element={
                <ProtectedRoute allowedRoles={["employee"]}>
                  <EmployeeDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/employee/attendance"
              element={
                <ProtectedRoute allowedRoles={["employee"]}>
                  <EmployeeAttendance />
                </ProtectedRoute>
              }
            />
            <Route
              path="/employee/attendance/scan"
              element={
                <ProtectedRoute allowedRoles={["employee"]}>
                  <EmployeeAttendanceScan />
                </ProtectedRoute>
              }
            />
            <Route
              path="/employee/leaves"
              element={
                <ProtectedRoute allowedRoles={["employee"]}>
                  <EmployeeLeaves />
                </ProtectedRoute>
              }
            />
            <Route
              path="/employee/ledger"
              element={
                <ProtectedRoute allowedRoles={["employee"]}>
                  <EmployeeLedger />
                </ProtectedRoute>
              }
            />
            <Route
              path="/employee/advance-requests" // ✅ FIXED
              element={
                <ProtectedRoute allowedRoles={["employee"]}>
                  <EmployeeAdvanceRequests />
                </ProtectedRoute>
              }
            />
            <Route
              path="/employee/chat"
              element={
                <ProtectedRoute allowedRoles={["employee"]}>
                  <EmployeeChat />
                </ProtectedRoute>
              }
            />
            <Route
              path="/employee/complaints"
              element={
                <ProtectedRoute allowedRoles={["employee"]}>
                  <EmployeeComplaints />
                </ProtectedRoute>
              }
            />
            <Route
              path="/employee/notifications"
              element={
                <ProtectedRoute allowedRoles={["employee"]}>
                  <EmployeeNotifications />
                </ProtectedRoute>
              }
            />
            <Route
              path="/employee/profile"
              element={
                <ProtectedRoute allowedRoles={["employee"]}>
                  <EmployeeProfile />
                </ProtectedRoute>
              }
            />
            <Route
              path="/employee/attendance-history"
              element={
                <ProtectedRoute allowedRoles={["employee"]}>
                  <EmployeeAttendanceHistory />
                </ProtectedRoute>
              }
            />

            {/* ================= ADMIN ROUTES ================= */}
            <Route
              path="/admin/dashboard"
              element={
                <ProtectedRoute allowedRoles={["admin"]}>
                  <AdminDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/employees"
              element={
                <ProtectedRoute allowedRoles={["admin"]}>
                  <AdminEmployees />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/sites"
              element={
                <ProtectedRoute allowedRoles={["admin"]}>
                  <AdminSites />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/leaves"
              element={
                <ProtectedRoute allowedRoles={["admin"]}>
                  <AdminLeaves />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/holidays"
              element={
                <ProtectedRoute allowedRoles={["admin"]}>
                  <AdminHolidays />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/ledger"
              element={
                <ProtectedRoute allowedRoles={["admin"]}>
                  <AdminLedger />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/advance-requests" // ✅ FIXED
              element={
                <ProtectedRoute allowedRoles={["admin"]}>
                  <AdminAdvanceRequests />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/notifications"
              element={
                <ProtectedRoute allowedRoles={["admin"]}>
                  <AdminNotifications />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/complaints"
              element={
                <ProtectedRoute allowedRoles={["admin"]}>
                  <AdminComplaints />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/chat/:employeeId"
              element={
                <ProtectedRoute allowedRoles={["admin"]}>
                  <AdminChat />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/chat"
              element={
                <ProtectedRoute allowedRoles={["admin"]}>
                  <AdminChatInbox />
                </ProtectedRoute>
              }
            />

            {/* Catch-all */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;