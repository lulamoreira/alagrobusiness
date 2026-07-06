import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Loader2, Search, ShieldCheck, UserPlus, Ban, Crown, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ADMIN_RESOURCES, useAdminPerms, type AdminResource } from "@/lib/adminPerms";
import { cn } from "@/lib/utils";

interface AdminRow {
  id: string;
  nome_completo: string | null;
  email: string | null;
  is_super_admin: boolean;
  admin_permissoes: Record<string, boolean> | null;
}

interface SearchRow {
  id: string;
  nome_completo: string | null;
  email: string | null;
  tipo_perfil: string | null;
}

function emptyPerms(): Record<AdminResource, boolean> {
  return ADMIN_RESOURCES.reduce(
    (acc, r) => ({ ...acc, [r]: false }),
    {} as Record<AdminResource, boolean>,
  );
}

export function AdminManagementSection() {
  const { t } = useTranslation();
  const { isSuperAdmin } = useAdminPerms();

  const [admins, setAdmins] = useState<AdminRow[]>([]);
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [candidates, setCandidates] = useState<SearchRow[]>([]);

  const [target, setTarget] = useState<AdminRow | SearchRow | null>(null);
  const [mode, setMode] = useState<"grant" | "edit" | "revoke" | null>(null);
  const [perms, setPerms] = useState<Record<AdminResource, boolean>>(emptyPerms());
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const { data, error } = await supabase.rpc("admin_list_admins" as never);
    if (error) {
      toast.error(error.message);
      return;
    }
    setAdmins((data ?? []) as AdminRow[]);
  };

  useEffect(() => {
    if (isSuperAdmin) load();
  }, [isSuperAdmin]);

  const runSearch = async () => {
    setSearching(true);
    const { data, error } = await supabase.rpc("admin_search_users" as never, {
      p_query: query,
    } as never);
    setSearching(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    const rows = (data ?? []) as SearchRow[];
    // Only offer promoting non-admins
    setCandidates(rows.filter((r) => r.tipo_perfil !== "admin"));
  };

  const openGrant = (row: SearchRow) => {
    setTarget(row);
    setPerms(emptyPerms());
    setMode("grant");
  };

  const openEdit = (row: AdminRow) => {
    setTarget(row);
    const base = emptyPerms();
    for (const r of ADMIN_RESOURCES) {
      base[r] = !!row.admin_permissoes?.[r];
    }
    setPerms(base);
    setMode("edit");
  };

  const openRevoke = (row: AdminRow) => {
    setTarget(row);
    setMode("revoke");
  };

  const close = () => {
    setMode(null);
    setTarget(null);
  };

  const submit = async () => {
    if (!target || !mode) return;
    setBusy(true);
    let err: { message: string } | null = null;
    if (mode === "grant") {
      const { error } = await supabase.rpc("admin_grant_admin" as never, {
        p_usuario: target.id,
        p_permissoes: perms,
      } as never);
      err = error;
      if (!error) toast.success(t("adminAccess.adminGranted"));
    } else if (mode === "edit") {
      const { error } = await supabase.rpc("admin_update_admin_perms" as never, {
        p_usuario: target.id,
        p_permissoes: perms,
      } as never);
      err = error;
      if (!error) toast.success(t("adminAccess.permsUpdated"));
    } else if (mode === "revoke") {
      const { error } = await supabase.rpc("admin_revoke_admin" as never, {
        p_usuario: target.id,
      } as never);
      err = error;
      if (!error) toast.success(t("adminAccess.adminRevoked"));
    }
    setBusy(false);
    if (err) {
      toast.error(err.message);
      return;
    }
    close();
    await Promise.all([load(), runSearch()]);
  };

  const dialogTitle = useMemo(() => {
    if (mode === "grant") return t("adminAccess.confirmGrantAdmin");
    if (mode === "edit") return t("adminAccess.editPerms");
    if (mode === "revoke") return t("adminAccess.confirmRevokeAdmin");
    return "";
  }, [mode, t]);

  if (!isSuperAdmin) return null;

  return (
    <section className="rounded-2xl border border-border/60 bg-card/40 p-5 backdrop-blur">
      <header className="flex items-start gap-3">
        <div className="rounded-xl bg-primary/10 p-2">
          <Crown className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h2 className="font-display text-lg font-semibold">
            {t("adminAccess.adminSectionTitle")}
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            {t("adminAccess.adminSectionSubtitle")}
          </p>
        </div>
      </header>

      {/* Current admins */}
      <div className="mt-5">
        {admins.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t("adminAccess.adminsListEmpty")}
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {admins.map((a) => (
              <div
                key={a.id}
                className="flex flex-col gap-3 rounded-xl border border-border/50 bg-background/40 p-4"
              >
                <div className="flex min-w-0 items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {a.nome_completo ?? "—"}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {a.email ?? "—"}
                    </p>
                  </div>
                  {a.is_super_admin && (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-medium text-primary">
                      <Crown className="h-3 w-3" />
                      {t("adminAccess.superAdminBadge")}
                    </span>
                  )}
                </div>

                <div>
                  <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    {t("adminAccess.resourcesTitle")}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {a.is_super_admin
                      ? ADMIN_RESOURCES.map((r) => (
                          <span
                            key={r}
                            className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-medium text-primary"
                          >
                            {t(`adminAccess.resource_${r}`)}
                          </span>
                        ))
                      : ADMIN_RESOURCES.filter((r) => a.admin_permissoes?.[r]).map(
                          (r) => (
                            <span
                              key={r}
                              className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary/90"
                            >
                              {t(`adminAccess.resource_${r}`)}
                            </span>
                          ),
                        )}
                    {!a.is_super_admin &&
                      !ADMIN_RESOURCES.some((r) => a.admin_permissoes?.[r]) && (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                  </div>
                </div>

                <div className="mt-auto grid grid-cols-2 gap-2 pt-1">
                  {a.is_super_admin ? (
                    <span className="col-span-2 text-center text-xs text-muted-foreground">
                      {t("adminAccess.youCannotEditSuper")}
                    </span>
                  ) : (
                    <>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => openEdit(a)}
                      >
                        <ShieldCheck className="mr-1 h-4 w-4" />
                        {t("adminAccess.editPerms")}
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => openRevoke(a)}
                      >
                        <Ban className="mr-1 h-4 w-4" />
                        {t("adminAccess.revokeAdmin")}
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>

        )}
      </div>

      {/* Grant admin: search users */}
      <div className="mt-6">
        <Label htmlFor="admin-q" className="text-sm">
          {t("adminAccess.grantAdmin")}
        </Label>
        <div className="mt-2 flex flex-col gap-2 md:flex-row">
          <Input
            id="admin-q"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("adminAccess.searchPlaceholder")}
            onKeyDown={(e) => e.key === "Enter" && runSearch()}
          />
          <Button onClick={runSearch} disabled={searching} variant="secondary">
            {searching ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Search className="mr-2 h-4 w-4" />
            )}
            {t("adminAccess.search")}
          </Button>
        </div>

        {candidates.length > 0 && (
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {candidates.map((c) => (
              <div
                key={c.id}
                className="flex flex-col gap-3 rounded-xl border border-border/50 bg-background/40 p-4"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {c.nome_completo ?? "—"}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {c.email ?? "—"}
                  </p>
                </div>
                <Button size="sm" className="mt-auto w-full" onClick={() => openGrant(c)}>
                  <UserPlus className="mr-1 h-4 w-4" />
                  {t("adminAccess.grantAdmin")}
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>


      {/* Dialog: grant/edit/revoke */}
      <AlertDialog open={mode !== null} onOpenChange={(o) => !o && close()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{dialogTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {target?.nome_completo ?? target?.email ?? ""}
            </AlertDialogDescription>
          </AlertDialogHeader>

          {mode !== "revoke" && (
            <div className="space-y-3 py-2">
              <p className="text-sm font-medium">{t("adminAccess.resourcesTitle")}</p>
              <div className="space-y-2">
                {ADMIN_RESOURCES.map((r) => (
                  <label
                    key={r}
                    className={cn(
                      "flex cursor-pointer items-center gap-3 rounded-lg border border-border/60 bg-background/40 px-3 py-2.5",
                      "hover:border-primary/60",
                    )}
                  >
                    <Checkbox
                      checked={perms[r]}
                      onCheckedChange={(v) =>
                        setPerms((p) => ({ ...p, [r]: v === true }))
                      }
                    />
                    <span className="text-sm">
                      {t(`adminAccess.resource_${r}`)}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>
              {t("adminAccess.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction disabled={busy} onClick={submit}>
              {busy ? (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              ) : mode === "revoke" ? (
                <Ban className="mr-1 h-4 w-4" />
              ) : (
                <Save className="mr-1 h-4 w-4" />
              )}
              {mode === "revoke"
                ? t("adminAccess.confirmRevoke")
                : mode === "grant"
                  ? t("adminAccess.grantAdmin")
                  : t("adminAccess.editPerms")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
