import { ProGate } from "@/components/ProGate";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import {
  Wallet,
  ArrowDownCircle,
  Clock,
  CheckCircle2,
  Pencil,
  Trash2,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { formatMoney, formatMoneyCompact, formatPrice, toBRL, type CambioRow } from "@/lib/format";
import { PillButton } from "@/components/PillButton";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/financeiro")({
  component: () => (<ProGate featureKey="plan.feature.finance"><FinanceiroPage /></ProGate>),
});

type DolarTipo = "comercial" | "turismo" | "paralelo";
type StatusPag = "aguardando" | "recebido";

interface VendaRow {
  id: string;
  anuncio_id: string;
  comprador_nome: string | null;
  quantidade: number;
  unidade_id: string;
  valor_total: number;
  moeda: "BRL" | "USD" | "EUR";
  data_venda: string;
  status_pagamento: StatusPag;
  data_recebimento: string | null;
  anuncios: { titulo: string | null; produto: string } | null;
  unidades: { nome_chave: string } | null;
}

const editSchema = z.object({
  valor_total: z.number().positive({ message: "validation.invalid_amount" }),
  comprador_nome: z.string().trim().max(200).optional().nullable(),
  data_venda: z.string().min(1, { message: "validation.required" }),
  status_pagamento: z.enum(["aguardando", "recebido"]),
});

function FinanceiroPage() {
  const { t, i18n } = useTranslation();
  const { user, profile } = useAuth();
  const qc = useQueryClient();
  const userMoeda = (profile?.moeda_preferida ?? "BRL") as "BRL" | "USD" | "EUR";
  const userDolarPref = (profile?.tipo_dolar_preferido ?? "comercial") as DolarTipo;

  const [statusFilter, setStatusFilter] = useState<"todos" | StatusPag>("todos");
  const [periodFrom, setPeriodFrom] = useState<string>("");
  const [periodTo, setPeriodTo] = useState<string>("");
  const [editing, setEditing] = useState<VendaRow | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<VendaRow | null>(null);

  const { data: dolar } = useQuery({
    queryKey: ["cotacoes_dolar"],
    queryFn: async () =>
      (await supabase.from("cotacoes_dolar").select("tipo, valor_brl")).data ?? [],
    staleTime: 1000 * 60 * 30,
  });
  const { data: cambio } = useQuery({
    queryKey: ["cotacoes_cambio"],
    queryFn: async (): Promise<CambioRow[]> =>
      ((await supabase.from("cotacoes_cambio").select("moeda, valor_brl")).data ?? []) as CambioRow[],
    staleTime: 1000 * 60 * 10,
  });

  const { data: vendas, isLoading } = useQuery({
    queryKey: ["financeiro_vendas", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<VendaRow[]> => {
      const { data, error } = await supabase
        .from("vendas")
        .select(
          "id, anuncio_id, comprador_nome, quantidade, unidade_id, valor_total, moeda, data_venda, status_pagamento, data_recebimento, anuncios:anuncio_id(titulo, produto), unidades:unidade_id(nome_chave)",
        )
        .eq("vendedor_id", user!.id)
        .is("deleted_at", null)
        .order("data_venda", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as VendaRow[];
    },
  });

  const cotacoes = useMemo(
    () =>
      (dolar ?? []).map((r) => ({
        tipo: r.tipo as DolarTipo,
        valor_brl: Number(r.valor_brl),
      })),
    [dolar],
  );
  // Fase 1: exibição via formatPrice (BRL → moeda do usuário, com degradação suave).
  const fmtBRL = (brl: number) => formatPrice(brl, "BRL", userMoeda, cambio ?? [], i18n.language);
  // fmt/fmtCompact mantidos para valores já em moeda do usuário (linhas individuais legadas).
  const fmt = (v: number) => formatMoney(v, userMoeda, userDolarPref, cotacoes, i18n.language);
  const fmtCompact = (v: number) =>
    formatMoneyCompact(v, userMoeda, userDolarPref, cotacoes, i18n.language);

  const filtered = useMemo(() => {
    return (vendas ?? []).filter((v) => {
      if (statusFilter !== "todos" && v.status_pagamento !== statusFilter) return false;
      if (periodFrom && v.data_venda < periodFrom) return false;
      if (periodTo && v.data_venda > periodTo) return false;
      return true;
    });
  }, [vendas, statusFilter, periodFrom, periodTo]);

  // Normaliza cada venda para BRL antes de somar (Fase 1b Internacional).
  // Degradação suave: se faltar taxa, usa valor cru como fallback.
  const totals = useMemo(() => {
    const all = vendas ?? [];
    const toBRLsafe = (v: VendaRow) =>
      toBRL(Number(v.valor_total), v.moeda, cambio ?? []) ?? Number(v.valor_total);
    const total = all.reduce((acc, v) => acc + toBRLsafe(v), 0);
    const received = all
      .filter((v) => v.status_pagamento === "recebido")
      .reduce((acc, v) => acc + toBRLsafe(v), 0);
    const pending = all
      .filter((v) => v.status_pagamento === "aguardando")
      .reduce((acc, v) => acc + toBRLsafe(v), 0);
    return { total, received, pending };
  }, [vendas, cambio]);


  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ["financeiro_vendas"] });
    qc.invalidateQueries({ queryKey: ["business_kpis"] });
  };

  const markReceived = async (v: VendaRow) => {
    const today = new Date().toISOString().slice(0, 10);
    const { error } = await supabase
      .from("vendas")
      .update({ status_pagamento: "recebido", data_recebimento: today })
      .eq("id", v.id);
    if (!error) invalidateAll();
  };

  const deleteVenda = async (v: VendaRow) => {
    const nowIso = new Date().toISOString();
    const { error } = await supabase
      .from("vendas")
      .update({ deleted_at: nowIso })
      .eq("id", v.id);
    if (error) return;
    // Reativar anúncio
    await supabase.from("anuncios").update({ status: "ativo" }).eq("id", v.anuncio_id);
    setConfirmDelete(null);
    invalidateAll();
  };

  const dateFmt = (iso: string) =>
    new Intl.DateTimeFormat(i18n.language).format(new Date(iso + "T00:00:00"));
  const nfQty = new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 2 });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-bold md:text-3xl">{t("finance.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("finance.subtitle")}</p>
      </header>

      {/* KPIs */}
      <section className="grid gap-3 sm:grid-cols-3">
        <KpiCard
          label={t("finance.kpiTotal")}
          value={fmtBRL(totals.total)}
          fullValue={fmtBRL(totals.total)}
          icon={Wallet}
          tone="primary"
        />
        <KpiCard
          label={t("finance.kpiReceived")}
          value={fmtBRL(totals.received)}
          fullValue={fmtBRL(totals.received)}
          icon={ArrowDownCircle}
          tone="success"
        />
        <KpiCard
          label={t("finance.kpiPending")}
          value={fmtBRL(totals.pending)}
          fullValue={fmtBRL(totals.pending)}
          icon={Clock}
          tone="warning"
        />
      </section>

      {/* Filtros */}
      <section className="rounded-2xl border border-border bg-card p-4">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {t("finance.filters")}
        </h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {t("finance.filterStatus")}
            </label>
            <select
              className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as "todos" | StatusPag)}
            >
              <option value="todos">{t("finance.filterAll")}</option>
              <option value="aguardando">{t("finance.filterPending")}</option>
              <option value="recebido">{t("finance.filterReceived")}</option>
            </select>
          </div>
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {t("finance.filterPeriodFrom")}
            </label>
            <input
              type="date"
              className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
              value={periodFrom}
              onChange={(e) => setPeriodFrom(e.target.value)}
            />
          </div>
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {t("finance.filterPeriodTo")}
            </label>
            <input
              type="date"
              className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
              value={periodTo}
              onChange={(e) => setPeriodTo(e.target.value)}
            />
          </div>
        </div>
      </section>

      {/* Lista */}
      <section>
        <h2 className="mb-3 font-display text-lg font-bold">{t("finance.historyTitle")}</h2>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
        ) : (vendas ?? []).length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card/40 p-10 text-center">
            <h3 className="font-display text-lg font-bold">{t("finance.emptyTitle")}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{t("finance.emptyDescription")}</p>
          </div>
        ) : filtered.length === 0 ? (
          <p className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
            {t("finance.noResults")}
          </p>
        ) : (
          <div className="grid gap-3">
            {filtered.map((v) => {
              const titulo = v.anuncios?.titulo || (v.anuncios?.produto ? t(`commodities.${v.anuncios.produto}`) : "—");
              const unitKey = v.unidades?.nome_chave;
              return (
                <article
                  key={v.id}
                  className="rounded-2xl border border-border bg-card p-4 transition-colors hover:border-primary/40"
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="truncate font-display text-base font-bold">{titulo}</h3>
                        <StatusBadge status={v.status_pagamento} />
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {v.comprador_nome || "—"} · {nfQty.format(Number(v.quantidade))}{" "}
                        {unitKey ? t(`units.${unitKey}`) : ""} · {dateFmt(v.data_venda)}
                      </p>
                    </div>
                    <div className="flex items-center justify-between gap-3 md:justify-end">
                      <span className="font-display text-lg font-bold text-primary tabular-nums">
                        {fmt(Number(v.valor_total))}
                      </span>
                      <div className="flex items-center gap-1">
                        {v.status_pagamento === "aguardando" && (
                          <button
                            type="button"
                            onClick={() => markReceived(v)}
                            className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/20"
                            title={t("finance.markReceived")}
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            <span className="hidden sm:inline">{t("finance.markReceived")}</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setEditing(v)}
                          className="rounded-full border border-border p-2 text-muted-foreground hover:bg-accent hover:text-foreground"
                          aria-label={t("finance.edit")}
                          title={t("finance.edit")}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDelete(v)}
                          className="rounded-full border border-border p-2 text-muted-foreground hover:border-destructive/60 hover:bg-destructive/10 hover:text-destructive"
                          aria-label={t("finance.delete")}
                          title={t("finance.delete")}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {editing && (
        <EditDialog
          venda={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            invalidateAll();
          }}
        />
      )}

      {confirmDelete && (
        <ConfirmDialog
          title={t("finance.deleteConfirmTitle")}
          description={t("finance.deleteConfirmDesc")}
          confirmLabel={t("finance.deleteConfirm")}
          onCancel={() => setConfirmDelete(null)}
          onConfirm={() => deleteVenda(confirmDelete)}
        />
      )}
    </div>
  );
}

function KpiCard({
  label,
  value,
  fullValue,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  fullValue?: string;
  icon: typeof Wallet;
  tone: "primary" | "success" | "warning";
}) {
  const toneCls =
    tone === "primary"
      ? "text-primary bg-primary/15"
      : tone === "success"
        ? "text-emerald-400 bg-emerald-500/10"
        : "text-amber-400 bg-amber-500/10";
  const valueCls =
    tone === "primary"
      ? "text-primary"
      : tone === "success"
        ? "text-emerald-400"
        : "text-amber-400";
  return (
    <div className="min-w-0 rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        <span className={cn("rounded-full p-1.5", toneCls)}>
          <Icon className="h-3.5 w-3.5" />
        </span>
      </div>
      <div
        title={fullValue}
        className={cn(
          "mt-3 font-display font-bold tabular-nums leading-tight whitespace-nowrap [font-size:clamp(1rem,3.6vw,1.5rem)]",
          valueCls,
        )}
      >
        {value}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: StatusPag }) {
  const { t } = useTranslation();
  if (status === "recebido") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-400">
        {t("finance.statusReceived")}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-400">
      {t("finance.statusPending")}
    </span>
  );
}

function EditDialog({
  venda,
  onClose,
  onSaved,
}: {
  venda: VendaRow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const [valorTotal, setValorTotal] = useState<string>(String(venda.valor_total));
  const [comprador, setComprador] = useState<string>(venda.comprador_nome ?? "");
  const [dataVenda, setDataVenda] = useState<string>(venda.data_venda);
  const [statusPag, setStatusPag] = useState<StatusPag>(venda.status_pagamento);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const labelClass = "text-xs font-semibold uppercase tracking-wide text-muted-foreground";
  const inputClass =
    "w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary";

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErrors({});
    setSubmitError(null);

    const parsed = editSchema.safeParse({
      valor_total: Number(valorTotal),
      comprador_nome: comprador.trim() || null,
      data_venda: dataVenda,
      status_pagamento: statusPag,
    });
    if (!parsed.success) {
      const e2: Record<string, string> = {};
      for (const iss of parsed.error.issues) {
        e2[iss.path.join(".")] = iss.message;
      }
      setErrors(e2);
      return;
    }

    setSubmitting(true);
    const patch: {
      valor_total: number;
      comprador_nome: string | null;
      data_venda: string;
      status_pagamento: StatusPag;
      data_recebimento?: string | null;
    } = {
      valor_total: parsed.data.valor_total,
      comprador_nome: parsed.data.comprador_nome ?? null,
      data_venda: parsed.data.data_venda,
      status_pagamento: parsed.data.status_pagamento,
    };
    if (parsed.data.status_pagamento === "recebido" && !venda.data_recebimento) {
      patch.data_recebimento = new Date().toISOString().slice(0, 10);
    } else if (parsed.data.status_pagamento === "aguardando") {
      patch.data_recebimento = null;
    }

    const { error } = await supabase.from("vendas").update(patch).eq("id", venda.id);
    setSubmitting(false);
    if (error) {
      setSubmitError(t("finance.errorGeneric"));
      return;
    }
    onSaved();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-end justify-center bg-background/80 p-0 backdrop-blur-sm md:items-center md:p-6"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-lg rounded-t-3xl border border-border bg-card p-6 shadow-2xl md:rounded-2xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 className="font-display text-lg font-bold">{t("finance.editTitle")}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 text-muted-foreground hover:bg-accent"
            aria-label={t("common.cancel")}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className={labelClass}>{t("finance.editTotal")}</label>
            <input
              type="number"
              step="0.01"
              min="0"
              inputMode="decimal"
              className={cn(inputClass, errors.valor_total && "border-destructive")}
              value={valorTotal}
              onChange={(e) => setValorTotal(e.target.value)}
            />
            {errors.valor_total && (
              <p className="mt-1 text-[11px] text-destructive">{t(errors.valor_total)}</p>
            )}
          </div>

          <div>
            <label className={labelClass}>{t("finance.editBuyer")}</label>
            <input
              type="text"
              className={inputClass}
              value={comprador}
              onChange={(e) => setComprador(e.target.value)}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={labelClass}>{t("finance.editDate")}</label>
              <input
                type="date"
                className={cn(inputClass, errors.data_venda && "border-destructive")}
                value={dataVenda}
                onChange={(e) => setDataVenda(e.target.value)}
              />
              {errors.data_venda && (
                <p className="mt-1 text-[11px] text-destructive">{t(errors.data_venda)}</p>
              )}
            </div>
            <div>
              <label className={labelClass}>{t("finance.editStatus")}</label>
              <select
                className={inputClass}
                value={statusPag}
                onChange={(e) => setStatusPag(e.target.value as StatusPag)}
              >
                <option value="aguardando">{t("finance.statusPending")}</option>
                <option value="recebido">{t("finance.statusReceived")}</option>
              </select>
            </div>
          </div>

          {submitError && <p className="text-xs text-destructive">{submitError}</p>}

          <div className="mt-4 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-border px-4 py-2 text-sm font-semibold text-muted-foreground hover:bg-accent"
            >
              {t("common.cancel")}
            </button>
            <PillButton type="submit" disabled={submitting}>
              {t("finance.editSave")}
            </PillButton>
          </div>
        </form>
      </div>
    </div>
  );
}

function ConfirmDialog({
  title,
  description,
  confirmLabel,
  onCancel,
  onConfirm,
}: {
  title: string;
  description: string;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-end justify-center bg-background/80 p-0 backdrop-blur-sm md:items-center md:p-6"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div className="w-full max-w-md rounded-t-3xl border border-border bg-card p-6 shadow-2xl md:rounded-2xl">
        <h2 className="font-display text-lg font-bold">{title}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{description}</p>
        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full border border-border px-4 py-2 text-sm font-semibold text-muted-foreground hover:bg-accent"
          >
            {t("common.cancel")}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-full bg-destructive px-4 py-2 text-sm font-semibold text-destructive-foreground hover:bg-destructive/90"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
