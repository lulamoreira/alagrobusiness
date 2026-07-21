import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ShieldCheck,
  Search,
  Users,
  Clock,
  Ban,
  CheckCircle2,
  Wallet,
  Handshake,
  Crown,
  Receipt,
  Loader2,
} from "lucide-react";
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
import { formatMoneyCompact } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin/gestao")({
  component: AdminGestaoPage,
});

type StatusPerfil = "ativo" | "aguardando_aprovacao" | "bloqueado";
type TipoPerfil = "comprador" | "vendedor" | "lojista" | "marca" | "admin";

interface KpisResp {
  cadastros_total: number;
  cadastros_aguardando: number;
  cadastros_bloqueados: number;
  cadastros_ativos: number;
  transacoes: number;
  volume_financeiro: number;
  em_negociacao: number;
  assinantes_pro: number;
}

interface UserRow {
  id: string;
  nome_completo: string | null;
  email: string | null;
  tipo_perfil: TipoPerfil | null;
  status: StatusPerfil | null;
  cidade: string | null;
  estado: string | null;
}

type Action = "aprovar" | "bloquear" | "reativar";

function AdminGestaoPage() {
  const { t, i18n } = useTranslation();
  const { profile } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | StatusPerfil>("all");
  const [tipoFilter, setTipoFilter] = useState<"all" | TipoPerfil>("all");
  const [pending, setPending] = useState<{ user: UserRow; action: Action } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (profile && profile.tipo_perfil !== "admin") navigate({ to: "/painel" });
  }, [profile, navigate]);

  const { data: dolar } = useQuery({
    queryKey: ["cotacoes_dolar"],
    queryFn: async () =>
      (await supabase.from("cotacoes_dolar").select("*").is("deleted_at", null)).data ?? [],
  });

  const userMoeda = profile?.moeda_preferida ?? "BRL";
  const userDolarPref = (profile?.tipo_dolar_preferido ?? "comercial") as
    | "comercial"
    | "turismo"
    | "paralelo";
  const cotacoesForConvert = useMemo(
    () =>
      (dolar ?? []).map((r) => ({
        tipo: r.tipo as "comercial" | "turismo" | "paralelo",
        valor_brl: Number(r.valor_brl),
      })),
    [dolar],
  );

  const { data: kpis, isLoading: loadingKpis } = useQuery({
    queryKey: ["admin_kpis"],
    enabled: profile?.tipo_perfil === "admin",
    queryFn: async (): Promise<KpisResp> => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc("admin_kpis");
      if (error) throw error;
      return data as KpisResp;
    },
  });

  const { data: users, isLoading: loadingUsers } = useQuery({
    queryKey: ["admin_users_list"],
    enabled: profile?.tipo_perfil === "admin",
    queryFn: async (): Promise<UserRow[]> => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, nome_completo, email, tipo_perfil, status, cidade, estado")
        .is("deleted_at", null)
        .order("status", { ascending: true })
        .order("nome_completo", { ascending: true, nullsFirst: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as UserRow[];
    },
  });

  const filtered = useMemo(() => {
    let list = users ?? [];
    if (statusFilter !== "all") list = list.filter((u) => u.status === statusFilter);
    if (tipoFilter !== "all") list = list.filter((u) => u.tipo_perfil === tipoFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (u) =>
          (u.nome_completo ?? "").toLowerCase().includes(q) ||
          (u.email ?? "").toLowerCase().includes(q),
      );
    }
    // Fila de aguardando no topo
    return [...list].sort((a, b) => {
      const rank = (s: StatusPerfil | null) =>
        s === "aguardando_aprovacao" ? 0 : s === "ativo" ? 1 : 2;
      return rank(a.status) - rank(b.status);
    });
  }, [users, statusFilter, tipoFilter, search]);

  const aguardando = useMemo(
    () => (users ?? []).filter((u) => u.status === "aguardando_aprovacao"),
    [users],
  );

  const numberFmt = new Intl.NumberFormat(i18n.language);
  const money = (v: number) => formatMoneyCompact(v, userMoeda, userDolarPref, cotacoesForConvert, i18n.language);

  const syncAuthBan = async () => {
    try {
      const { error } = await supabase.functions.invoke("sync-demo-auth-ban", { body: {} });
      if (error) toast.error(`sync-demo-auth-ban: ${error.message}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(`sync-demo-auth-ban: ${msg}`);
    }
  };

  const runAction = async () => {
    if (!pending) return;
    setBusy(true);
    try {
      const newStatus: StatusPerfil =
        pending.action === "bloquear" ? "bloqueado" : "ativo";
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).rpc("admin_set_user_status", {
        p_usuario: pending.user.id,
        p_status: newStatus,
      });
      if (error) throw error;
      toast.success(t(`adminGestao.action.${pending.action}Success`));
      await syncAuthBan();
      await qc.invalidateQueries({ queryKey: ["admin_users_list"] });
      await qc.invalidateQueries({ queryKey: ["admin_kpis"] });
      setPending(null);
    } catch (err) {
      const msg = (err as { message?: string }).message ?? String(err);
      toast.error(t("adminGestao.action.error", { detail: msg }));
    } finally {
      setBusy(false);
    }
  };

  if (profile?.tipo_perfil !== "admin") {
    return (
      <div className="rounded-3xl border border-border bg-card/60 p-8 text-center text-sm text-muted-foreground">
        <ShieldCheck className="mx-auto mb-2 h-6 w-6" />
        {t("adminGestao.onlyAdmin")}
      </div>
    );
  }

  const kpiCards: {
    key: string;
    icon: typeof Users;
    value: string;
    tone?: "default" | "warn" | "danger" | "good" | "primary";
  }[] = [
    { key: "total", icon: Users, value: numberFmt.format(kpis?.cadastros_total ?? 0) },
    {
      key: "aguardando",
      icon: Clock,
      value: numberFmt.format(kpis?.cadastros_aguardando ?? 0),
      tone: "warn",
    },
    {
      key: "bloqueados",
      icon: Ban,
      value: numberFmt.format(kpis?.cadastros_bloqueados ?? 0),
      tone: "danger",
    },
    {
      key: "ativos",
      icon: CheckCircle2,
      value: numberFmt.format(kpis?.cadastros_ativos ?? 0),
      tone: "good",
    },
    { key: "transacoes", icon: Receipt, value: numberFmt.format(kpis?.transacoes ?? 0) },
    {
      key: "volume",
      icon: Wallet,
      value: money(kpis?.volume_financeiro ?? 0),
      tone: "primary",
    },
    { key: "negociacao", icon: Handshake, value: numberFmt.format(kpis?.em_negociacao ?? 0) },
    {
      key: "pro",
      icon: Crown,
      value: numberFmt.format(kpis?.assinantes_pro ?? 0),
      tone: "primary",
    },
  ];

  return (
    <div className="space-y-8">
      <header className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-primary/30 bg-primary/10">
          <ShieldCheck className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold md:text-3xl">
            {t("adminGestao.title")}
          </h1>
          <p className="text-sm text-muted-foreground">{t("adminGestao.subtitle")}</p>
        </div>
      </header>

      {/* KPIs */}
      <section className="space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
          {t("adminGestao.kpisTitle")}
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {kpiCards.map((c) => {
            const Icon = c.icon;
            const toneMap: Record<string, string> = {
              warn: "border-amber-500/30 bg-amber-500/5",
              danger: "border-red-500/30 bg-red-500/5",
              good: "border-emerald-500/30 bg-emerald-500/5",
              primary: "border-primary/30 bg-primary/5",
              default: "border-border bg-card/60",
            };
            const iconTone: Record<string, string> = {
              warn: "text-amber-400",
              danger: "text-red-400",
              good: "text-emerald-400",
              primary: "text-primary",
              default: "text-muted-foreground",
            };
            const tone = c.tone ?? "default";
            return (
              <div
                key={c.key}
                className={cn(
                  "rounded-2xl border p-4 shadow-sm backdrop-blur",
                  toneMap[tone],
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {t(`adminGestao.kpi.${c.key}`)}
                  </span>
                  <Icon className={cn("h-4 w-4", iconTone[tone])} />
                </div>
                <div className="mt-3 truncate font-display text-2xl font-bold text-foreground">
                  {loadingKpis ? "—" : c.value}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Fila de aguardando */}
      {aguardando.length > 0 && (
        <section className="rounded-3xl border border-amber-500/30 bg-amber-500/5 p-5">
          <div className="mb-3 flex items-center gap-2">
            <Clock className="h-4 w-4 text-amber-400" />
            <h2 className="font-display text-sm font-bold uppercase tracking-widest text-amber-300">
              {t("adminGestao.queueTitle", { count: aguardando.length })}
            </h2>
          </div>
          <p className="text-xs text-muted-foreground">{t("adminGestao.queueHint")}</p>
        </section>
      )}

      {/* Gestão de cadastros */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-bold">{t("adminGestao.usersTitle")}</h2>
            <p className="text-xs text-muted-foreground">{t("adminGestao.usersSubtitle")}</p>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <div className="md:col-span-2">
            <Label className="text-xs">{t("adminGestao.searchLabel")}</Label>
            <div className="relative mt-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("adminGestao.searchPlaceholder")}
                className="pl-9"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">{t("adminGestao.filterStatus")}</Label>
              <Select
                value={statusFilter}
                onValueChange={(v) => setStatusFilter(v as "all" | StatusPerfil)}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("adminGestao.filterAll")}</SelectItem>
                  <SelectItem value="aguardando_aprovacao">
                    {t("adminGestao.status.aguardando_aprovacao")}
                  </SelectItem>
                  <SelectItem value="ativo">{t("adminGestao.status.ativo")}</SelectItem>
                  <SelectItem value="bloqueado">{t("adminGestao.status.bloqueado")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">{t("adminGestao.filterTipo")}</Label>
              <Select
                value={tipoFilter}
                onValueChange={(v) => setTipoFilter(v as "all" | TipoPerfil)}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("adminGestao.filterAll")}</SelectItem>
                  <SelectItem value="comprador">{t("adminGestao.tipo.comprador")}</SelectItem>
                  <SelectItem value="vendedor">{t("adminGestao.tipo.vendedor")}</SelectItem>
                  <SelectItem value="lojista">{t("adminGestao.tipo.lojista")}</SelectItem>
                  <SelectItem value="marca">{t("adminGestao.tipo.marca")}</SelectItem>
                  <SelectItem value="admin">{t("adminGestao.tipo.admin")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-3xl border border-border bg-card/60">
          {loadingUsers ? (
            <div className="flex items-center justify-center gap-2 p-10 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t("adminGestao.loading")}
            </div>
          ) : !filtered.length ? (
            <div className="p-10 text-center text-sm text-muted-foreground">
              {t("adminGestao.empty")}
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {filtered.map((u) => {
                const isAg = u.status === "aguardando_aprovacao";
                const isBl = u.status === "bloqueado";
                const isAt = u.status === "ativo";
                const statusChip: Record<StatusPerfil, string> = {
                  aguardando_aprovacao: "border-amber-500/40 bg-amber-500/10 text-amber-300",
                  ativo: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
                  bloqueado: "border-red-500/40 bg-red-500/10 text-red-300",
                };
                return (
                  <li
                    key={u.id}
                    className="flex flex-wrap items-center gap-3 p-4 md:flex-nowrap"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-semibold text-foreground">
                          {u.nome_completo ?? "—"}
                        </span>
                        {u.status && (
                          <span
                            className={cn(
                              "shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                              statusChip[u.status],
                            )}
                          >
                            {t(`adminGestao.status.${u.status}`)}
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 truncate text-xs text-muted-foreground">
                        {u.email ?? "—"}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                        {u.tipo_perfil && (
                          <span className="rounded-full border border-border bg-background/40 px-2 py-0.5">
                            {t(`adminGestao.tipo.${u.tipo_perfil}`)}
                          </span>
                        )}
                        {(u.cidade || u.estado) && (
                          <span>
                            {[u.cidade, u.estado].filter(Boolean).join(" · ")}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                      {isAg && (
                        <Button
                          size="sm"
                          onClick={() => setPending({ user: u, action: "aprovar" })}
                        >
                          <CheckCircle2 className="mr-1.5 h-4 w-4" />
                          {t("adminGestao.action.aprovar")}
                        </Button>
                      )}
                      {isBl && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setPending({ user: u, action: "reativar" })}
                        >
                          <CheckCircle2 className="mr-1.5 h-4 w-4" />
                          {t("adminGestao.action.reativar")}
                        </Button>
                      )}
                      {(isAt || isAg) && u.tipo_perfil !== "admin" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-red-500/40 text-red-300 hover:bg-red-500/10"
                          onClick={() => setPending({ user: u, action: "bloquear" })}
                        >
                          <Ban className="mr-1.5 h-4 w-4" />
                          {t("adminGestao.action.bloquear")}
                        </Button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

      <AlertDialog open={!!pending} onOpenChange={(o) => !o && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pending ? t(`adminGestao.action.${pending.action}ConfirmTitle`) : ""}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pending
                ? t(`adminGestao.action.${pending.action}ConfirmDesc`, {
                    name: pending.user.nome_completo ?? pending.user.email ?? "",
                  })
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>{t("adminGestao.cancel")}</AlertDialogCancel>
            <AlertDialogAction disabled={busy} onClick={runAction}>
              {busy ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : null}
              {t("adminGestao.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
