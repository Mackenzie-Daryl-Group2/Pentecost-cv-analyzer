import { supabase } from "@/utils/supabase";

export async function recordActivity(
  action: string,
  description: string,
  options: { entityType?: string; entityId?: string | number; metadata?: Record<string, unknown> } = {}
) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return false;

  const response = await fetch("/api/audit", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      action,
      description,
      entityType: options.entityType,
      entityId: options.entityId,
      metadata: options.metadata || {},
    }),
  }).catch(() => null);

  return Boolean(response?.ok);
}
