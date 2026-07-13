import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, DollarSign, Mail, Megaphone, Newspaper, Pencil, Plus, Trash2 } from "lucide-react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { handlePaywallError } from "@/components/PlanStatus";

export const Route = createFileRoute("/_authenticated/alertas")({
  component: AlertsPage,
});

type TipoAlerta = "commodity" | "dolar";
type Condicao = "acima" | "abaixo";
type Moeda = "BRL" | "USD";

interface AlertaRow {
  id: string;
  tipo_alerta: TipoAlerta;
  referencia: string;
  condicao: Condicao;
  valor_alvo: number;
  moeda: Moeda;
  ativo: boolean;
  disparado: boolean;
  ultima_notificacao_em: string | null;
  created_at: string;
}

interface NotificacaoRow {
  id: string;
  tipo: string;
  titulo: string;
  mensagem: string | null;
  link: string | null;
  lida: boolean;
  created_at: string;
}

const COMMODITIES = [
  "soja",
  "milho",
  "cafe_arabica",
  "cafe_conilon",
  "boi_gordo",
  "suino",
  "trigo",
  "algodao",
  "arroz",
  "feijao",
] as const;

const DOLAR_TIPOS = ["comercial", "turismo", "paralelo"] as const;
const MOEDAS: Moeda[] = ["BRL", "USD"];

const ICON_BY_TYPE: Record<string, typeof Bell> = {
  mensagem: Mail,
  alerta: Megaphone,
  noticia: Newspaper,
  preco: DollarSign,
  sistema: Bell,
};

// Renderiza um titulo/mensagem armazenado como "i18nKey::arg1::arg2..." OU texto livre.
function useEncodedRenderer() {
  const { t } = useTranslation();
  return (raw: string | null | undefined): string => formatNotifText(raw, t);
}

function AlertsPage() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const userId = user?.id;
  const renderEncoded = useEncodedRenderer();

  // ---------- Alertas ----------
  const alertsQuery = useQuery({
    queryKey: ["alertas_preco", userId],
    enabled: !!userId,
    queryFn: async (): Promise<AlertaRow[]> => {
      const { data, error } = await supabase
        .from("alertas_preco")
        .select(
          "id, tipo_alerta, referencia, condicao, valor_alvo, moeda, ativo, disparado, ultima_notificacao_em, created_at",
        )
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as AlertaRow[];
    },
  });

  // ---------- Notificações de preço ----------
  const notifQuery = useQuery({
    queryKey: ["notificacoes_preco", userId],
    enabled: !!userId,
    queryFn: async (): Promise<NotificacaoRow[]> => {
      const { data, error } = await supabase
        .from("notificacoes")
        .select("id, tipo, titulo, mensagem, link, lida, created_at")
        .eq("tipo", "preco")
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as NotificacaoRow[];
    },
  });

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`alertas-page-${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "notificacoes" }, () => {
        void notifQuery.refetch();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "alertas_preco" }, () => {
        void alertsQuery.refetch();
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // ---------- Form ----------
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tipoAlerta, setTipoAlerta] = useState<TipoAlerta>("commodity");
  const [referencia, setReferencia] = useState<string>("soja");
  const [condicao, setCondicao] = useState<Condicao>("acima");
  const [valorAlvo, setValorAlvo] = useState<string>("");
  const [moeda, setMoeda] = useState<Moeda>("BRL");
  const [showForm, setShowForm] = useState(false);

  const resetForm = () => {
    setEditingId(null);
    setTipoAlerta("commodity");
    setReferencia("soja");
    setCondicao("acima");
    setValorAlvo("");
    setMoeda("BRL");
  };

  const startEdit = (a: AlertaRow) => {
    setEditingId(a.id);
    setTipoAlerta(a.tipo_alerta);
    setReferencia(a.referencia);
    setCondicao(a.condicao);
    setValorAlvo(String(a.valor_alvo));
    setMoeda(a.moeda);
    setShowForm(true);
  };

  const schema = useMemo(
    () =>
      z.object({
        tipo_alerta: z.enum(["commodity", "dolar"]),
        referencia: z.string().min(1, t("alerts.validation.referenceRequired")),
        condicao: z.enum(["acima", "abaixo"]),
        valor_alvo: z
          .number({ invalid_type_error: t("alerts.validation.targetRequired") })
          .positive(t("alerts.validation.targetRequired")),
        moeda: z.enum(["BRL", "USD"]),
      }),
    [t],
  );

  const saveMutation = useMutation({
    mutationFn: async () => {
      const parsed = schema.parse({
        tipo_alerta: tipoAlerta,
        referencia,
        condicao,
        valor_alvo: Number(valorAlvo.replace(",", ".")),
        moeda,
      });
      if (editingId) {
        const { error } = await supabase
          .from("alertas_preco")
          .update({
            tipo_alerta: parsed.tipo_alerta,
            referencia: parsed.referencia,
            condicao: parsed.condicao,
            valor_alvo: parsed.valor_alvo,
            moeda: parsed.moeda,
            // Ao editar, rearma para reavaliar no próximo job
            disparado: false,
          })
          .eq("id", editingId);
        if (error) throw error;
      } else {
        if (!userId) throw new Error("no user");
        const { error } = await supabase.from("alertas_preco").insert({
          usuario_id: userId,
          tipo_alerta: parsed.tipo_alerta,
          referencia: parsed.referencia,
          condicao: parsed.condicao,
          valor_alvo: parsed.valor_alvo,
          moeda: parsed.moeda,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(t(editingId ? "alerts.updatedToast" : "alerts.createdToast"));
      resetForm();
      setShowForm(false);
      void queryClient.invalidateQueries({ queryKey: ["alertas_preco", userId] });
    },
    onError: (e: unknown) => {
      if (handlePaywallError(e, t)) return;
      const detail = e instanceof z.ZodError ? e.errors.map((x) => x.message).join(", ") : (e as Error).message;
      toast.error(t("alerts.errorSave", { detail }));
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await supabase.from("alertas_preco").update({ ativo }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["alertas_preco", userId] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("alertas_preco")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("alerts.deletedToast"));
      void queryClient.invalidateQueries({ queryKey: ["alertas_preco", userId] });
    },
  });

  const handleClickNotif = async (n: NotificacaoRow) => {
    if (!n.lida) {
      await supabase.from("notificacoes").update({ lida: true }).eq("id", n.id);
      void queryClient.invalidateQueries({ queryKey: ["notificacoes_preco", userId] });
    }
    if (n.link) {
      if (n.link.startsWith("/")) navigate({ to: n.link });
      else window.open(n.link, "_blank", "noopener,noreferrer");
    }
  };

  const alertas = alertsQuery.data ?? [];
  const notifs = notifQuery.data ?? [];

  const refOptions = tipoAlerta === "commodity" ? COMMODITIES : DOLAR_TIPOS;
  const refLabel = (r: string) =>
    tipoAlerta === "commodity"
      ? t(`commodities.${r}`, { defaultValue: r })
      : t(`quote.${r}`, { defaultValue: r });

  return (
    <div className="space-y-8">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold md:text-3xl">{t("alerts.title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("alerts.subtitle")}</p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setShowForm((s) => !s);
          }}
          className="flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-glow hover:opacity-90"
        >
          <Plus className="h-4 w-4" />
          {t("alerts.new")}
        </button>
      </header>

      {/* Formulário */}
      {showForm && (
        <section className="rounded-2xl border border-border bg-card/60 p-4 md:p-6">
          <h2 className="mb-4 font-display text-lg font-semibold">
            {editingId ? t("alerts.edit") : t("alerts.new")}
          </h2>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="space-y-1.5 text-sm">
              <span className="text-muted-foreground">{t("alerts.type")}</span>
              <select
                value={tipoAlerta}
                onChange={(e) => {
                  const v = e.target.value as TipoAlerta;
                  setTipoAlerta(v);
                  setReferencia(v === "commodity" ? "soja" : "comercial");
                }}
                className="w-full rounded-lg border border-border bg-background px-3 py-2"
              >
                <option value="commodity">{t("alerts.typeCommodity")}</option>
                <option value="dolar">{t("alerts.typeDolar")}</option>
              </select>
            </label>

            <label className="space-y-1.5 text-sm">
              <span className="text-muted-foreground">{t("alerts.reference")}</span>
              <select
                value={referencia}
                onChange={(e) => setReferencia(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2"
              >
                {refOptions.map((r) => (
                  <option key={r} value={r}>
                    {refLabel(r)}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1.5 text-sm">
              <span className="text-muted-foreground">{t("alerts.condition")}</span>
              <select
                value={condicao}
                onChange={(e) => setCondicao(e.target.value as Condicao)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2"
              >
                <option value="acima">{t("alerts.above")}</option>
                <option value="abaixo">{t("alerts.below")}</option>
              </select>
            </label>

            <label className="space-y-1.5 text-sm">
              <span className="text-muted-foreground">{t("alerts.target")}</span>
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                value={valorAlvo}
                onChange={(e) => setValorAlvo(e.target.value)}
                placeholder={t("alerts.target")}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 font-mono"
              />
            </label>

            <label className="space-y-1.5 text-sm">
              <span className="text-muted-foreground">{t("alerts.currency")}</span>
              <select
                value={moeda}
                onChange={(e) => setMoeda(e.target.value as Moeda)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2"
              >
                {MOEDAS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="mt-4 flex items-center gap-2">
            <button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
              className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-glow hover:opacity-90 disabled:opacity-50"
            >
              {t("alerts.save")}
            </button>
            <button
              onClick={() => {
                resetForm();
                setShowForm(false);
              }}
              className="rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold text-muted-foreground hover:text-foreground"
            >
              {t("alerts.cancel")}
            </button>
          </div>
        </section>
      )}

      {/* Lista de alertas */}
      <section>
        {alertsQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
        ) : alertas.length === 0 ? (
          <div className="flex min-h-[20vh] flex-col items-center justify-center gap-3 rounded-2xl border border-border bg-card/40 p-8 text-center">
            <Bell className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">{t("alerts.empty")}</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {alertas.map((a) => {
              const label =
                a.tipo_alerta === "commodity"
                  ? t(`commodities.${a.referencia}`, { defaultValue: a.referencia })
                  : `${t("alerts.typeDolar")} · ${t(`quote.${a.referencia}`, { defaultValue: a.referencia })}`;
              return (
                <li
                  key={a.id}
                  className={cn(
                    "flex flex-col gap-3 rounded-2xl border p-4 md:flex-row md:items-center md:justify-between",
                    a.ativo ? "border-border bg-card" : "border-border/60 bg-card/40 opacity-70",
                  )}
                >
                  <div className="min-w-0">
                    <p className="font-display text-base font-semibold">{label}</p>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {t(a.condicao === "acima" ? "alerts.above" : "alerts.below")}{" "}
                      <span className="font-mono text-foreground">
                        {a.valor_alvo.toLocaleString(i18n.language, { minimumFractionDigits: 2 })}
                      </span>{" "}
                      <span className="text-xs">{a.moeda}</span>
                    </p>
                    <p className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                      {a.ativo
                        ? a.disparado
                          ? t("alerts.triggered")
                          : t("alerts.armed")
                        : t("alerts.inactive")}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleMutation.mutate({ id: a.id, ativo: !a.ativo })}
                      className="rounded-full border border-border bg-background px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
                    >
                      {a.ativo ? t("alerts.deactivate") : t("alerts.activate")}
                    </button>
                    <button
                      onClick={() => startEdit(a)}
                      className="rounded-full border border-border bg-background p-2 text-muted-foreground hover:text-foreground"
                      aria-label={t("alerts.edit")}
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(t("alerts.confirmDelete"))) deleteMutation.mutate(a.id);
                      }}
                      className="rounded-full border border-border bg-background p-2 text-destructive hover:bg-destructive/10"
                      aria-label={t("alerts.delete")}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Notificações de preço */}
      <section>
        <h2 className="mb-3 font-display text-lg font-semibold">{t("alerts.notificationsTitle")}</h2>
        {notifQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
        ) : notifs.length === 0 ? (
          <div className="flex min-h-[15vh] flex-col items-center justify-center gap-2 rounded-2xl border border-border bg-card/40 p-6 text-center">
            <DollarSign className="h-6 w-6 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">{t("alerts.notificationsEmpty")}</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {notifs.map((n) => {
              const Icon = ICON_BY_TYPE[n.tipo] ?? Bell;
              return (
                <li key={n.id}>
                  <button
                    onClick={() => void handleClickNotif(n)}
                    className={cn(
                      "flex w-full items-start gap-3 rounded-2xl border p-4 text-left transition-colors",
                      n.lida
                        ? "border-border bg-card/60 hover:bg-accent"
                        : "border-primary/40 bg-card hover:bg-accent",
                    )}
                  >
                    <div
                      className={cn(
                        "flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full",
                        n.lida ? "bg-accent text-muted-foreground" : "bg-primary/15 text-primary",
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className={cn("truncate text-sm", n.lida ? "font-medium" : "font-semibold")}>
                          {renderEncoded(n.titulo)}
                        </p>
                        <span className="flex-shrink-0 text-[10px] text-muted-foreground">
                          {new Date(n.created_at).toLocaleString(i18n.language, {
                            day: "2-digit",
                            month: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                      {n.mensagem && (
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          {renderEncoded(n.mensagem)}
                        </p>
                      )}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
