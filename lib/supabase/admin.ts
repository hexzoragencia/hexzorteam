import { createClient } from "@supabase/supabase-js";

// Cliente con service role — bypass RLS. SOLO usar en server (API routes / cron).
// NUNCA exponer en cliente.
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Faltan SUPABASE env vars (URL o SERVICE_ROLE_KEY)");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
