import { useAuth } from "@/lib/auth";

export const ADMIN_RESOURCES = [
  "acessos",
  "gestao",
  "moderacao",
  "cotacoes",
  "cursos",
] as const;

export type AdminResource = (typeof ADMIN_RESOURCES)[number];

export interface AdminPerms {
  isAdmin: boolean;
  isSuperAdmin: boolean;
  perms: Record<string, boolean>;
  has: (r: AdminResource) => boolean;
  hasAny: boolean;
}

export function useAdminPerms(): AdminPerms {
  const { profile } = useAuth();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p = profile as any;
  const isAdmin = p?.tipo_perfil === "admin";
  const isSuperAdmin = !!p?.is_super_admin;
  const perms = (p?.admin_permissoes ?? {}) as Record<string, boolean>;
  const has = (r: AdminResource) =>
    isAdmin && (isSuperAdmin || perms[r] === true);
  const hasAny =
    isAdmin && (isSuperAdmin || ADMIN_RESOURCES.some((r) => perms[r] === true));
  return { isAdmin, isSuperAdmin, perms, has, hasAny };
}
