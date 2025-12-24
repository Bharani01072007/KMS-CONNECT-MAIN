import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import logo from '@/assets/logo.jpg';

const Splash = () => {
  const navigate = useNavigate();
  const { user, role, loading } = useAuth();

  const [showSplash, setShowSplash] = useState(true);
  const [forceExit, setForceExit] = useState(false);

  // ⏱️ Splash display timer
  useEffect(() => {
    const timer = setTimeout(() => setShowSplash(false), 2500);
    return () => clearTimeout(timer);
  }, []);

  // ⛑️ HARD FAILSAFE (prevents infinite splash)
  useEffect(() => {
    const fallback = setTimeout(() => {
      setForceExit(true);
    }, 5000); // max wait = 5s

    return () => clearTimeout(fallback);
  }, []);

  // 🚦 SAFE REDIRECT
  useEffect(() => {
    if ((loading || showSplash) && !forceExit) return;

    if (!user) {
      navigate('/auth', { replace: true });
      return;
    }

    if (role === 'admin') {
      navigate('/admin/dashboard', { replace: true });
    } else {
      navigate('/employee/dashboard', { replace: true });
    }
  }, [loading, showSplash, forceExit, user, role, navigate]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center">
      <img src={logo} alt="KMS Logo" style={{ width: 208, height: 66 }} />
      <p className="text-muted-foreground">Workforce Management System</p>
      <div className="flex gap-1 mt-4">
        <span className="w-2 h-2 bg-primary rounded-full animate-bounce" />
        <span className="w-2 h-2 bg-primary rounded-full animate-bounce delay-150" />
        <span className="w-2 h-2 bg-primary rounded-full animate-bounce delay-300" />
      </div>
    </div>
  );
};

export default Splash;