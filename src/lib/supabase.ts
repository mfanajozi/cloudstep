import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || import.meta.env.SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

// Create a function to generate a Supabase client that uses the Clerk JWT
export const createClerkSupabaseClient = (clerkToken: string | null) => {
  return createClient(
    supabaseUrl as string,
    supabaseAnonKey as string,
    {
      global: {
        // Get the custom Supabase token from Clerk
        fetch: async (url, options = {}) => {
          const headers = new Headers(options?.headers);
          
          if (clerkToken) {
            headers.set('Authorization', `Bearer ${clerkToken}`);
          }
          
          return fetch(url, {
            ...options,
            headers,
          });
        },
      },
    }
  );
};
