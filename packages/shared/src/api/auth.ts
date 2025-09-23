import { supabase } from "../integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

export type LoginResult = {
  user: User | null;
  session: Session | null;
  error: { message: string } | null;
};

export const authAPI = {
  async login(email: string, password: string): Promise<LoginResult> {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    return {
      user: data?.user ?? null,
      session: data?.session ?? null,
      error: error ? { message: error.message } : null,
    };
  },
};


