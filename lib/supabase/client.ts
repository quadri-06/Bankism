"use server";

import { createServerClient } from "@supabase/ssr";

export const createClient = () => {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          const cookieStore = document.cookie ? document.cookie.split(';') : [];
          const match = cookieStore.find(c => c.trim().startsWith(`${name}=`));
          return match?.split('=')[1] ?? null;
        },
        set(name: string, value: string, options: { maxAge?: number }) {
          const maxAge = options.maxAge || 3600;
          document.cookie = `${name}=${value};path=/;max-age=${maxAge}`;
        },
        remove(name: string, options: { maxAge?: number }) {
          document.cookie = `${name}=;path=/;max-age=0`;
        },
      },
    }
  );
};