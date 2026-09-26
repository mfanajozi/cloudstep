import { defineConfig } from "@neon/config/v1";

export default defineConfig({
  // Neon Managed Better Auth issues the session JWT; the Data API validates it
  // against Neon Auth's JWKS and resolves `public.current_user_id()` to the
  // token's `sub`.
  auth: true,

  // CloudSTep talks to Neon through the Data API (PostgREST-compatible) so the
  // existing supabase-js-style query layer keeps working against Postgres.
  dataApi: {
    authProvider: "neon",
  },
  preview: {
    buckets: {
      media: { access: "public_read" },
    },
  },
});
