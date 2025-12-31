import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

type Role = 'admin' | 'employee';

type AuthContextType = {
  user: User | null;
  session: Session | null;
  role: Role;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<Role>('employee'); // ✅ DEFAULT
  const [loading, setLoading] = useState(true);

  /* ================= INIT ================= */

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;

      const session = data.session ?? null;
      const user = session?.user ?? null;

      setSession(session);
      setUser(user);
      setLoading(false); // ✅ UI UNBLOCKED IMMEDIATELY

      if (user) {
        fetchRoleAsync(user.id); // 🚀 non-blocking
      }
    };

    init();

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        const user = session?.user ?? null;
        setSession(session ?? null);
        setUser(user);
        setRole('employee'); // reset safely

        if (user) fetchRoleAsync(user.id);
      }
    );

    return () => {
      mounted = false;
      listener?.subscription.unsubscribe();
    };
  }, []);

  /* ================= ROLE FETCH (NON BLOCKING) ================= */

  const fetchRoleAsync = async (uid: string) => {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('role')
        .eq('auth_uid', uid)
        .maybeSingle();

      if (data?.role === 'admin') {
        setRole('admin');
      }
    } catch (err) {
      console.warn('Role fetch failed → employee fallback');
    }
  };

  /* ================= ACTIONS ================= */

  const signIn = async (email: string, password: string) => {
    const res = await supabase.auth.signInWithPassword({ email, password });
    return { error: res.error ?? null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setRole('employee');
  };

  return (
    <AuthContext.Provider
      value={{ user, session, role, loading, signIn, signOut }}
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