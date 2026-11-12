
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";

type SignUpResult = { error: string | null; needsConfirmation: boolean };

type AuthValue = {
  session: Session | null;
  email: string | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<string | null>;
  signUp: (email: string, password: string) => Promise<SignUpResult>;
  signOut: () => Promise<void>;
};

const Ctx = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (active) {
        setSession(data.session);
        setLoading(false);
      }
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthValue>(
    () => ({
      session,
      email: session?.user.email ?? null,
      loading,
      async signIn(email, password) {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (!error) return null;

        console.error("Sign-in error:", error.message);
        if (/fetch|network/i.test(error.message)) return "Cannot reach the sign-in service. Check your internet and your Supabase project.";

        if (/confirm/i.test(error.message)) return "Please confirm your email first, then sign in.";
        if (/rate|too many/i.test(error.message)) return "Too many attempts. Wait a few minutes and try again.";
        return "Email or password is incorrect.";
      },
      async signUp(email, password) {
        const { data, error } = await supabase.auth.signUp({ email: email.trim(), password });
        if (error) {
          const msg = /password/i.test(error.message)
            ? error.message
            : /rate|too many/i.test(error.message)
            ? "Too many sign-up emails were requested. Wait a while and try again."
            : "We could not create the account. Check the details and try again.";
          return { error: msg, needsConfirmation: false };
        }
        return { error: null, needsConfirmation: !data.session };
      },
      async signOut() {
        await supabase.auth.signOut();
      },
    }),
    [session, loading]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be used inside AuthProvider");
  return v;
}
