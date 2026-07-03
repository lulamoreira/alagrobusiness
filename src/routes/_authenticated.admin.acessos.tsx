import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Loader2, Search, ShieldCheck, Gift, X, Ban } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { AdminManagementSection } from "@/components/AdminManagementSection";

export const Route = createFileRoute("/_authenticated/admin/acessos")({
  component: AdminAcessosPage,
});

interface UserRow {
  id: string;
  nome_completo: string | null;
  email: string | null;
  tipo_perfil: string | null;
  plano_codigo: string | null;
  status: string | null;
  origem: string | null;
  fim: string | null;
}

interface CortesiaRow {
  usuario_id: string;
  nome_completo: string | null;
  email: string | null;
  plano_codigo: string;
  fim: string | null;
  inicio: string;
}

interface PlanoOpt {
  codigo: string;
  nome: Record<string, string> | null;
}

function AdminAcessosPage() {
  const { t, i18n } = useTranslation();
  const { profile } = useAuth();
  const navigate = useNavigate();

  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<UserRow[]>([]);
  const [cortesias, setCortesias] = useState<CortesiaRow[]>([]);
  const [planos, setPlanos] = useState<PlanoOpt[]>([]);

  const [grantOpen, setGrantOpen] = useState(false);
  const [revokeOpen, setRevokeOpen] = useState(false);
  const [target, setTarget] = useState<UserRow | null>(null);
  const [grantPlano, setGrantPlano] = useState("pro");
  const [grantMode, setGrantMode] = useState<"indefinite" | "days">("indefinite");
  const [grantDays, setGrantDays] = useState<string>("30");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (profile && profile.tipo_perfil !== "admin") {
      navigate({ to: "/painel" });
    }
  }, [profile, navigate]);

  const loadPlanos = async () => {
    const { data } = await supabase
      .from("planos")
      .select("codigo, nome")
      .is("deleted_at", null)
      .eq("ativo", true)
      .order("preco_mensal", { ascending: true });
    setPlanos((data ?? []) as PlanoOpt[]);
  };

  const loadCortesias = async () => {
    const { data, error } = await supabase.rpc("admin_list_cortesias" as never);
    if (error) {
      toast.error(error.message);
      return;
    }
    setCortesias((data ?? []) as CortesiaRow[]);
  };

  useEffect(() => {
    loadPlanos();
    loadCortesias();
  }, []);

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
    setResults((data ?? []) as UserRow[]);
  };

  const doGrant = async () => {
    if (!target) return;
    setBusy(true);
    const dias = grantMode === "days" ? Number(grantDays) : null;
    const { error } = await supabase.rpc("admin_grant_plan" as never, {
      p_usuario: target.id,
      p_plano_codigo: grantPlano,
      p_dias: dias,
    } as never);
    setBusy(false);
    if (error) {
      toast.error(t("adminAccess.errorGrant", { detail: error.message }));
      return;
    }
    toast.success(t("adminAccess.granted"));
    setGrantOpen(false);
    setTarget(null);
    await Promise.all([runSearch(), loadCortesias()]);
  };

  const doRevoke = async () => {
    if (!target) return;
    setBusy(true);
    const { error } = await supabase.rpc("admin_revoke_plan" as never, {
      p_usuario: target.id,
    } as never);
    setBusy(false);
    if (error) {
      toast.error(t("adminAccess.errorRevoke", { detail: error.message }));
      return;
    }
    toast.success(t("adminAccess.revoked"));
    setRevokeOpen(false);
    setTarget(null);
    await Promise.all([runSearch(), loadCortesias()]);
  };

  const planoNome = (codigo: string | null) => {
    if (!codigo) return t("adminAccess.noPlan");
    const p = planos.find((x) => x.codigo === codigo);
    const nome = p?.nome?.[i18n.language] || p?.nome?.["pt-BR"];
    return nome ?? codigo.toUpperCase();
  };

  const originLabel = (o: string | null) => {
    if (o === "trial") return t("adminAccess.originTrial");
    if (o === "stripe") return t("adminAccess.originStripe");
    if (o === "admin_cortesia") return t("adminAccess.originAdmin");
    return "—";
  };
  const statusLabel = (s: string | null) => {
    if (s === "trial") return t("adminAccess.statusTrial");
    if (s === "ativa") return t("adminAccess.statusAtiva");
    if (s === "cancelada") return t("adminAccess.statusCancelada");
    if (s === "expirada") return t("adminAccess.statusExpirada");
    return "—";
  };
  const fmtDate = (iso: string | null) => {
    if (!iso) return t("adminAccess.indefinite");
    return new Date(iso).toLocaleDateString(i18n.language);
  };

  const canRevoke = (r: UserRow) => r.status === "ativa" && r.origem === "admin_cortesia";

  const grantTitle = useMemo(() => t("adminAccess.grantTitle"), [i18n.language]);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-8 p-4 md:p-8">
      <header className="flex items-start gap-3">
        <div className="rounded-2xl bg-primary/10 p-3">
          <ShieldCheck className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight md:text-3xl">
            {t("adminAccess.title")}
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            {t("adminAccess.subtitle")}
          </p>
        </div>
      </header>

      {/* Search */}
      <section className="rounded-2xl border border-border/60 bg-card/40 p-5 backdrop-blur">
        <Label htmlFor="q" className="text-sm">
          {t("adminAccess.searchLabel")}
        </Label>
        <div className="mt-2 flex flex-col gap-2 md:flex-row">
          <Input
            id="q"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("adminAccess.searchPlaceholder")}
            onKeyDown={(e) => e.key === "Enter" && runSearch()}
          />
          <Button onClick={runSearch} disabled={searching} className="md:w-auto">
            {searching ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Search className="mr-2 h-4 w-4" />
            )}
            {searching ? t("adminAccess.searching") : t("adminAccess.search")}
          </Button>
        </div>

        {results.length > 0 ? (
          <div className="mt-4 overflow-x-auto rounded-xl border border-border/50">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/30 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">{t("adminAccess.user")}</th>
                  <th className="px-4 py-3">{t("adminAccess.email")}</th>
                  <th className="px-4 py-3">{t("adminAccess.currentPlan")}</th>
                  <th className="px-4 py-3">{t("adminAccess.status")}</th>
                  <th className="px-4 py-3">{t("adminAccess.origin")}</th>
                  <th className="px-4 py-3">{t("adminAccess.expiration")}</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {results.map((r) => (
                  <tr key={r.id} className="border-t border-border/40">
                    <td className="px-4 py-3">{r.nome_completo ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{r.email ?? "—"}</td>
                    <td className="px-4 py-3">{planoNome(r.plano_codigo)}</td>
                    <td className="px-4 py-3">{statusLabel(r.status)}</td>
                    <td className="px-4 py-3">{originLabel(r.origem)}</td>
                    <td className="px-4 py-3">{fmtDate(r.fim)}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            setTarget(r);
                            setGrantPlano("pro");
                            setGrantMode("indefinite");
                            setGrantDays("30");
                            setGrantOpen(true);
                          }}
                        >
                          <Gift className="mr-1 h-4 w-4" />
                          {t("adminAccess.grant")}
                        </Button>
                        {canRevoke(r) && (
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => {
                              setTarget(r);
                              setRevokeOpen(true);
                            }}
                          >
                            <Ban className="mr-1 h-4 w-4" />
                            {t("adminAccess.revoke")}
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : query && !searching ? (
          <p className="mt-4 text-sm text-muted-foreground">{t("adminAccess.noResults")}</p>
        ) : null}
      </section>

      {/* Active courtesies */}
      <section className="rounded-2xl border border-border/60 bg-card/40 p-5 backdrop-blur">
        <h2 className="font-display text-lg font-semibold">
          {t("adminAccess.activeCortesias")}
        </h2>
        {cortesias.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">{t("adminAccess.noCortesias")}</p>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-xl border border-border/50">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/30 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">{t("adminAccess.user")}</th>
                  <th className="px-4 py-3">{t("adminAccess.email")}</th>
                  <th className="px-4 py-3">{t("adminAccess.currentPlan")}</th>
                  <th className="px-4 py-3">{t("adminAccess.expiration")}</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {cortesias.map((c) => (
                  <tr key={c.usuario_id} className="border-t border-border/40">
                    <td className="px-4 py-3">{c.nome_completo ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{c.email ?? "—"}</td>
                    <td className="px-4 py-3">{planoNome(c.plano_codigo)}</td>
                    <td className="px-4 py-3">{fmtDate(c.fim)}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end">
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => {
                            setTarget({
                              id: c.usuario_id,
                              nome_completo: c.nome_completo,
                              email: c.email,
                              tipo_perfil: null,
                              plano_codigo: c.plano_codigo,
                              status: "ativa",
                              origem: "admin_cortesia",
                              fim: c.fim,
                            });
                            setRevokeOpen(true);
                          }}
                        >
                          <Ban className="mr-1 h-4 w-4" />
                          {t("adminAccess.revoke")}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Grant dialog */}
      <AlertDialog open={grantOpen} onOpenChange={setGrantOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{grantTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {target?.nome_completo ?? target?.email ?? ""}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t("adminAccess.grantPlan")}</Label>
              <Select value={grantPlano} onValueChange={setGrantPlano}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {planos.map((p) => (
                    <SelectItem key={p.codigo} value={p.codigo}>
                      {planoNome(p.codigo)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{t("adminAccess.grantDuration")}</Label>
              <Select
                value={grantMode}
                onValueChange={(v) => setGrantMode(v as "indefinite" | "days")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="indefinite">
                    {t("adminAccess.durationIndefinite")}
                  </SelectItem>
                  <SelectItem value="days">{t("adminAccess.durationDays")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {grantMode === "days" && (
              <div className="space-y-2">
                <Label>{t("adminAccess.days")}</Label>
                <Input
                  type="number"
                  min={1}
                  value={grantDays}
                  onChange={(e) => setGrantDays(e.target.value)}
                />
              </div>
            )}
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>
              <X className="mr-1 h-4 w-4" />
              {t("adminAccess.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction disabled={busy} onClick={doGrant}>
              {busy ? (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              ) : (
                <Gift className="mr-1 h-4 w-4" />
              )}
              {t("adminAccess.confirmGrant")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Revoke dialog */}
      <AlertDialog open={revokeOpen} onOpenChange={setRevokeOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("adminAccess.confirmRevoke")}</AlertDialogTitle>
            <AlertDialogDescription>
              {target?.nome_completo ?? target?.email ?? ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>{t("adminAccess.cancel")}</AlertDialogCancel>
            <AlertDialogAction disabled={busy} onClick={doRevoke}>
              {busy ? (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              ) : (
                <Ban className="mr-1 h-4 w-4" />
              )}
              {t("adminAccess.confirmRevoke")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
