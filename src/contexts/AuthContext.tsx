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

type Role = 'admin' | 'employee';

type AuthContextType = {
  user: User | null;
  session: Session | null;
  role: Role | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (
    email: string,
    password: string,
    name?: string,
    role?: Role
  ) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/* ================= PROVIDER ================= */

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [loading, setLoading] = useState(true);

  /* ================= PROFILE FETCH ================= */

  const fetchProfileRole = async (authUid: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('auth_uid', authUid) // ✅ CORRECT COLUMN
        .maybeSingle();

      if (error) throw error;

      if (!data?.role) {
        console.warn('Profile exists but role missing → employee fallback');
        setRole('employee');
        return;
      }

      setRole(data.role as Role);
    } catch (err) {
      console.error('Failed to fetch profile role:', err);
      setRole('employee'); // controlled fallback
    }
  };

  /* ================= INITIAL AUTH LOAD ================= */

  useEffect(() => {
    let active = true;

    const initAuth = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (!active) return;

        const session = data.session ?? null;
        const user = session?.user ?? null;

        setSession(session);
        setUser(user);

        if (user) {
          await fetchProfileRole(user.id);
        } else {
          setRole(null);
        }
      } catch (err) {
        console.error('Auth init failed:', err);
        setUser(null);
        setSession(null);
        setRole(null);
      } finally {
        if (active) setLoading(false);
      }
    };

    initAuth();

    const { data: listener } = supabase.auth.onAuthStateChange(
      async (event: AuthChangeEvent, session) => {
        const user = session?.user ?? null;

        setSession(session ?? null);
        setUser(user);

        if (event === 'SIGNED_IN' && user) {
          setLoading(true);
          await fetchProfileRole(user.id);
          setLoading(false);
        }

        if (event === 'SIGNED_OUT') {
          setRole(null);
        }
      }
    );

    return () => {
      active = false;
      listener?.subscription.unsubscribe();
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
          const n = payload.new as { title?: string; body?: string };
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
    roleParam: Role = 'employee'
  ) => {
    try {
      const res = await supabase.auth.signUp({ email, password });
      const error = res.error ?? null;

      const u = res.data?.user;
      if (!error && u) {
        await supabase.from('profiles').upsert({
          auth_uid: u.id, // ✅ IMPORTANT
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
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setRole(null);
    setLoading(false);
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
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}