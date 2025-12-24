import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import logo from '@/assets/logo.jpg';

const SPLASH_TIMEOUT = 1500; // fast & mobile friendly

const Splash = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  const redirectedRef = useRef(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 🔐 SINGLE SAFE REDIRECT FUNCTION
  const redirect = () => {
    if (redirectedRef.current) return;
    redirectedRef.current = true;

    if (!user) {
      navigate('/auth', { replace: true });
    } else {
      // 🚀 ENTER APP IMMEDIATELY (DO NOT WAIT FOR ROLE)
      navigate('/employee/dashboard', { replace: true });
    }
  };

  // ⏳ SPLASH TIMER (GUARANTEED EXIT)
  useEffect(() => {
    timeoutRef.current = setTimeout(() => {
      redirect();
    }, SPLASH_TIMEOUT);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  // ⚡ FAST EXIT IF AUTH RESOLVES EARLY
  useEffect(() => {
    if (!loading) {
      redirect();
    }
  }, [loading]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background">
      <img
        src={logo}
        alt="Company Logo"
        className="mb-4"
        style={{ width: 208, height: 66 }}
      />

      <p className="text-muted-foreground text-sm">
        Workforce Management System
      </p>

      {/* Minimal loader (never blocks forever) */}
      <div className="flex gap-1 mt-4">
        <span className="w-2 h-2 bg-primary rounded-full animate-bounce" />
        <span className="w-2 h-2 bg-primary rounded-full animate-bounce [animation-delay:150ms]" />
        <span className="w-2 h-2 bg-primary rounded-full animate-bounce [animation-delay:300ms]" />
      </div>
    </div>
  );
};

export default Splash;