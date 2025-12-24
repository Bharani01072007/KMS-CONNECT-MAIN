import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import logo from '@/assets/logo.jpg';

const Splash = () => {
  const navigate = useNavigate();
  const { user, role, loading } = useAuth();

  const [minTimePassed, setMinTimePassed] = useState(false);
  const hasRedirected = useRef(false);

  /* ---------------- MIN SPLASH TIME (1s) ---------------- */
  useEffect(() => {
    const timer = setTimeout(() => {
      setMinTimePassed(true);
    }, 1000); // fast & smooth

    return () => clearTimeout(timer);
  }, []);

  /* ---------------- FAILSAFE (4s) ---------------- */
  useEffect(() => {
    const failsafe = setTimeout(() => {
      if (!hasRedirected.current) {
        console.warn('Splash failsafe triggered');
        navigate('/auth', { replace: true });
        hasRedirected.current = true;
      }
    }, 4000);

    return () => clearTimeout(failsafe);
  }, [navigate]);

  /* ---------------- MAIN REDIRECT LOGIC ---------------- */
  useEffect(() => {
    if (loading) return;
    if (!minTimePassed) return;
    if (hasRedirected.current) return;

    hasRedirected.current = true;

    if (!user) {
      navigate('/auth', { replace: true });
      return;
    }

    if (role === 'admin') {
      navigate('/admin/dashboard', { replace: true });
    } else {
      navigate('/employee/dashboard', { replace: true });
    }
  }, [loading, minTimePassed, user, role, navigate]);

  /* ---------------- UI ---------------- */
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background">
      <img
        src={logo}
        alt="KMS Logo"
        className="w-[200px] mb-4"
      />

      <p className="text-sm text-muted-foreground">
        Workforce Management System
      </p>

      <div className="flex gap-1 mt-4">
        <span className="w-2 h-2 bg-primary rounded-full animate-bounce" />
        <span className="w-2 h-2 bg-primary rounded-full animate-bounce delay-150" />
        <span className="w-2 h-2 bg-primary rounded-full animate-bounce delay-300" />
      </div>
    </div>
  );
};

export default Splash;