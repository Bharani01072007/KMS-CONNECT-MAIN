// src/contexts/AuthContext.tsx
import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from 'react';
import { User, Session, AuthChangeEvent } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

/* ================= TYPES ================= */

type AuthContextType = {
  user: User | null;
  session: Session | null;
  role: string | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (
    email: string,
    password: string,
    name?: string,
    role?: 'admin' | 'employee'
  ) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/* ================= PROVIDER ================= */

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  /* ================= FETCH PROFILE (NON-BLOCKING) ================= */

  const fetchProfile = async (uid?: string) => {
    if (!uid) {
      setRole(null);
      return;
    }

    try {
      const { data } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', uid)
        .maybeSingle();

      // ✅ SAFE DEFAULT (never block UI)
      setRole(data?.role ?? 'employee');
    } catch (error) {
      console.warn('fetchProfile failed', error);
      setRole('employee');
    }
  };

  /* ================= AUTH INITIALIZATION ================= */

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (!mounted) return;

        const currentSession = data.session ?? null;
        const currentUser = currentSession?.user ?? null;

        setSession(currentSession);
        setUser(currentUser);

        // 🚀 DO NOT await (prevents infinite loading)
        if (currentUser) {
          fetchProfile(currentUser.id);
        } else {
          setRole(null);
        }
      } catch (err) {
        console.error('Auth init error', err);
        setUser(null);
        setSession(null);
        setRole(null);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    // 🧨 HARD FAILSAFE (NO INFINITE SPLASH)
    const timeout = setTimeout(() => {
      if (mounted) {
        console.warn('Auth timeout — forcing UI release');
        setLoading(false);
      }
    }, 3000);

    init();

    const { data: listener } = supabase.auth.onAuthStateChange(
      (event: AuthChangeEvent, payload) => {
        const session = payload ?? null;
        const user = session?.user ?? null;

        setSession(session);
        setUser(user);

        if (event === 'SIGNED_IN' && user) {
          fetchProfile(user.id);
        }

        if (event === 'SIGNED_OUT') {
          setRole(null);
        }
      }
    );

    return () => {
      mounted = false;
      clearTimeout(timeout);
      listener?.subscription?.unsubscribe();
    };
  }, []);

  /* ================= REALTIME NOTIFICATIONS ================= */

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`user-notifications-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const n = payload.new as {
            title?: string | null;
            body?: string | null;
          };

          toast({
            title: n.title ?? 'Notification',
            description: n.body ?? '',
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  /* ================= AUTH ACTIONS ================= */

  const signIn = async (email: string, password: string) => {
    try {
      const res = await supabase.auth.signInWithPassword({ email, password });
      return { error: res.error ?? null };
    } catch (err: any) {
      return { error: err };
    }
  };

  const signUp = async (
    email: string,
    password: string,
    name?: string,
    roleParam: 'admin' | 'employee' = 'employee'
  ) => {
    try {
      const res = await supabase.auth.signUp({ email, password });
      const error = res.error ?? null;

      const u = res.data?.user;
      if (!error && u) {
        await supabase.from('profiles').upsert({
          id: u.id,
          email,
          full_name: name ?? null,
          role: roleParam,
        });
        setRole(roleParam);
      }

      return { error };
    } catch (err: any) {
      return { error: err };
    }
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } finally {
      setUser(null);
      setSession(null);
      setRole(null);
      setLoading(false); // ✅ prevents stuck splash
    }
  };

  /* ================= PROVIDER ================= */

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        role,
        loading,
        signIn,
        signUp,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

/* ================= HOOK ================= */

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}