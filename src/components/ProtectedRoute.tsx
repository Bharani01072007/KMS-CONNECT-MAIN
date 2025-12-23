import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: string[];
}

const ProtectedRoute = ({ children, allowedRoles }: ProtectedRouteProps) => {
  const { user, role, loading } = useAuth();

  // 🔑 Only wait for AUTH, not ROLE
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  // ❌ Not logged in → go to auth
  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  /**
   * 🔐 Role-based protection
   * - If role exists and is NOT allowed → redirect
   * - If role is missing → allow render (fallback)
   */
  if (allowedRoles && role && !allowedRoles.includes(role)) {
    return role === 'admin'
      ? <Navigate to="/admin/dashboard" replace />
      : <Navigate to="/employee/dashboard" replace />;
  }

  // ✅ Access granted
  return <>{children}</>;
};

export default ProtectedRoute;
