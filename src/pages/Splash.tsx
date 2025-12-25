import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import logo from '@/assets/logo.jpg';

const Splash = () => {
  const navigate = useNavigate();
  const { user, role, loading } = useAuth();
  const redirected = useRef(false);

  useEffect(() => {
    if (loading) return;
    if (redirected.current) return;

    redirected.current = true;

    if (!user) {
      navigate('/auth', { replace: true });
      return;
    }

    if (role === 'admin') {
      navigate('/admin/dashboard', { replace: true });
    } else {
      navigate('/employee/dashboard', { replace: true });
    }
  }, [loading, user, role, navigate]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center">
      <img
        src={logo}
        alt="Company Logo"
        style={{ width: 208, height: 66 }}
      />

      <p className="text-muted-foreground text-sm mt-2">
        Workforce Management System
      </p>

      <div className="flex gap-1 mt-4">
        <span className="w-2 h-2 bg-primary rounded-full animate-bounce" />
        <span className="w-2 h-2 bg-primary rounded-full animate-bounce [animation-delay:150ms]" />
        <span className="w-2 h-2 bg-primary rounded-full animate-bounce [animation-delay:300ms]" />
      </div>
    </div>
  );
};

export default Splash;