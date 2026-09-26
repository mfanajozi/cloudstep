import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { getNeon, getDataClient } from './neon';

// ---------------------------------------------------------------
// Neon Managed Better Auth session for the whole app.
//
// Better Auth issues an httpOnly session cookie; the Data API turns
// that cookie into a JWT on every request. `public.current_user_id()`
// in Postgres reads the JWT's `sub`, which is this user's id.
// ---------------------------------------------------------------

/** Local fallback used only when the Data API cannot be reached. */
export const SETUP_FLAG = 'cloudstep.setup_complete';
export const setupFlagKey = (userId: string) => `${SETUP_FLAG}.${userId}`;

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'owner';
  image: string | null;
}

export interface SignUpInput {
  fullName: string;
  username: string;
  email: string;
  password: string;
}

interface AuthContextValue {
  /** Signed-in account, or null when signed out. */
  user: AuthUser | null;
  /** True until the first session lookup settles. */
  loading: boolean;
  /** Username captured at sign-up, carried into workspace setup. */
  pendingUsername: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (input: SignUpInput) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const AUTH_MESSAGES: Record<string, string> = {
  INVALID_EMAIL_OR_PASSWORD: 'That email and password combination is not correct.',
  USER_NOT_FOUND: 'No account exists for that email address.',
  USER_ALREADY_EXISTS: 'An account already exists for that email address.',
  INVALID_EMAIL: 'That email address is not valid.',
  INVALID_PASSWORD: 'Password does not meet the minimum requirements.',
  MISSING_ORIGIN: 'This address is not trusted by the sign-in service yet.',
};

function describeError(error: unknown, fallback: string): string {
  if (error && typeof error === 'object') {
    const err = error as { code?: string; message?: string };
    if (err.code && AUTH_MESSAGES[err.code]) return AUTH_MESSAGES[err.code];
    if (err.message) return err.message;
  }
  if (typeof error === 'string' && error) return error;
  return fallback;
}

type SessionUser = Partial<AuthUser> & { id?: string; role?: string };

function toAuthUser(raw: SessionUser | null | undefined): AuthUser | null {
  if (!raw?.id) return null;
  return {
    id: raw.id,
    email: raw.email ?? '',
    name: raw.name ?? '',
    role: raw.role === 'admin' ? 'admin' : 'owner',
    image: raw.image ?? null,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [pendingUsername, setPendingUsername] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const { data, error } = await getNeon().auth.getSession();
      if (error) {
        setUser(null);
        return;
      }
      setUser(toAuthUser((data as { user?: SessionUser } | null)?.user));
    } catch (e) {
      console.error('Session lookup failed:', e);
      setUser(null);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      await refresh();
      if (mounted) setLoading(false);
    })();
    return () => { mounted = false; };
  }, [refresh]);

  const signIn = useCallback(async (email: string, password: string) => {
    try {
      const { error } = await getNeon().auth.signIn.email({ email, password });
      if (error) throw error;
    } catch (e) {
      throw new Error(describeError(e, 'Could not sign in. Please try again.'));
    }
    await refresh();
  }, [refresh]);

  const signUp = useCallback(async ({ fullName, username, email, password }: SignUpInput) => {
    const cleanName = fullName.trim();
    const cleanUsername = username.trim();
    const cleanEmail = email.trim().toLowerCase();

    let created: SessionUser | null = null;
    try {
      const { data, error } = await getNeon().auth.signUp.email({
        email: cleanEmail,
        password,
        name: cleanName,
      });
      if (error) throw error;
      created = toAuthUser((data as { user?: SessionUser } | null)?.user);
    } catch (e) {
      throw new Error(describeError(e, 'Could not create your account.'));
    }

    if (!created) {
      await refresh();
      throw new Error('Account created, but the session could not be established.');
    }

    // Better Auth has no username field, so it lives in public.users.
    // setup_complete stays false until TemplateSetup finishes the workspace.
    try {
      await getDataClient()
        .from('users')
        .upsert({
          id: created.id,
          full_name: cleanName,
          email: cleanEmail,
          username: cleanUsername,
          setup_complete: false,
        });
    } catch (e) {
      // Non-fatal: setup re-writes the same row and will retry this field.
      console.error('Owner record bootstrap failed:', e);
    }

    setPendingUsername(cleanUsername);
    setUser(created);
  }, [refresh]);

  const signOut = useCallback(async () => {
    try {
      await getNeon().auth.signOut();
    } catch (e) {
      console.error('Sign out failed:', e);
    }
    setUser(null);
    setPendingUsername(null);
  }, []);

  const value = useMemo(
    () => ({ user, loading, pendingUsername, signIn, signUp, signOut }),
    [user, loading, pendingUsername, signIn, signUp, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
