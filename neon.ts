import { defineConfig } from "@neon/config/v1";

// Function secrets are read from the env file passed to `neon deploy --env`.
// A key is only declared when it has a value: uploading "" would delete the
// live secret.
const renewalsEnv: Record<string, string> = {};
for (const key of [
  "SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS", "RESEND_API_KEY",
  "EMAIL_FROM", "APP_URL", "PUBLIC_URL", "ALLOWED_ORIGINS",
]) {
  const value = process.env[key];
  if (value) renewalsEnv[key] = value;
}

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

  // CloudStep Renewal Reminder: scheduler, Mark-as-done links, client
  // portal, app API and inbound integration API. See functions/renewals.
  functions: {
    renewals: {
      name: "Renewal Reminder",
      source: "functions/renewals/index.ts",
      env: renewalsEnv,
    },
  },

  triggers: {
    "renewals-every-5-min": {
      type: "schedule",
      function: "renewals",
      cron: "*/5 * * * *",
      functionPath: "/cron",
    },
  },
});
