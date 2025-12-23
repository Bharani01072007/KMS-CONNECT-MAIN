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
import { toast } from '@/hooks/use-toast'; // ✅ ADDED

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

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  /* ================= FETCH PROFILE ================= */

  const fetchProfile = async (uid?: string) => {
    if (!uid) {
      setRole(null);
      return;
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', uid)
      .single();

    if (error) {
      console.warn('fetchProfile error', error);
      setRole(null);
      return;
    }

    setRole(data?.role ?? null);
  };

  /* ================= AUTH INIT ================= */

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      setLoading(true);
      try {
        const { data } = await supabase.auth.getSession();
        const currentSession = data.session;
        const currentUser = currentSession?.user ?? null;

        if (!mounted) return;

        setSession(currentSession ?? null);
        setUser(currentUser);

        if (currentUser) {
          await fetchProfile(currentUser.id);
        } else {
          setRole(null);
        }
      } catch (err) {
        console.error('Auth init error', err);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    init();

    const { data: listener } = supabase.auth.onAuthStateChange(
      async (event: AuthChangeEvent, payload) => {
        const s = payload ?? null;
        const u = s?.user ?? null;

        setSession(s);
        setUser(u);
        setLoading(true);

        if (event === 'SIGNED_IN' && u) {
          await fetchProfile(u.id);
        } else if (event === 'SIGNED_OUT') {
          setRole(null);
        }

        setLoading(false);
      }
    );

    return () => {
      mounted = false;
      listener?.subscription?.unsubscribe();
    };
  }, []);

  /* ================= REALTIME NOTIFICATIONS (✅ NEW) ================= */

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
      const resp = await supabase.auth.signInWithPassword({ email, password });
      return { error: resp.error ?? null };
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
      const resp = await supabase.auth.signUp({ email, password });
      const error = resp.error ?? null;

      const u = resp.data?.user;
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
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setRole(null);
  };

  return (
    <AuthContext.Provider
      value={{ user, session, role, loading, signIn, signUp, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}