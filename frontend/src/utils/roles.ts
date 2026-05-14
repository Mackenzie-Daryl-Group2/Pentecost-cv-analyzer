export type AppRole = "user" | "hr" | "pro_vc" | "admin" | "registrar";

export function getUserRole(user: any): AppRole {
  const rawRole = String(
    user?.user_metadata?.role || user?.app_metadata?.role || "user"
  )
    .trim()
    .toLowerCase();

  if (rawRole === "provc" || rawRole === "pro-vc") return "pro_vc";
  if (rawRole === "hr_manager") return "hr";
  if (["user", "hr", "pro_vc", "admin", "registrar"].includes(rawRole)) {
    return rawRole as AppRole;
  }

  return "user";
}

export function getRoleHome(role: AppRole) {
  if (role === "hr") return "/hr";
  if (role === "admin") return "/admin";
  if (role === "pro_vc") return "/pro-vc";
  if (role === "registrar") return "/registrar";
  return "/jobs";
}

export function isApplicantRole(role: AppRole) {
  return role === "user";
}
