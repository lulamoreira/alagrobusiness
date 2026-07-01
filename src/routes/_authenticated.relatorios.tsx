import { ProGate } from "@/components/ProGate";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { Download, BarChart3, TrendingUp, Package, Filter } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { formatMoney, formatMoneyCompact } from "@/lib/format";
import { PillButton } from "@/components/PillButton";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/relatorios")({
  component: () => (<ProGate featureKey="plan.feature.reports"><RelatoriosPage /></ProGate>),
});

type DolarTipo = "comercial" | "turismo" | "paralelo";
type StatusPag = "aguardando" | "recebido";
type NegStatus = "iniciado" | "em_negociacao" | "fechado" | "descartado";
type Periodo = "30d" | "90d" | "12m" | "custom";

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
  anuncios: { titulo: string | null; produto: string } | null;
  unidades: { nome_chave: string; fator_kg: number } | null;
}

interface ConversaRow {
  id: string;
  status_negociacao: NegStatus;
  created_at: string;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
function isoDaysAgo(days: number) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}
function isoMonthsAgo(months: number) {
  const d = new Date();
  d.setUTCMonth(d.getUTCMonth() - months);
  return d.toISOString().slice(0, 10);
}

function computeRange(periodo: Periodo, customFrom: string, customTo: string) {
  if (periodo === "30d") return { from: isoDaysAgo(30), to: todayISO() };
  if (periodo === "90d") return { from: isoDaysAgo(90), to: todayISO() };
  if (periodo === "12m") return { from: isoMonthsAgo(12), to: todayISO() };
  return { from: customFrom || isoDaysAgo(30), to: customTo || todayISO() };
}

function roundN(n: number) {
  return Math.round(n);
}

function RelatoriosPage() {
  const { t, i18n } = useTranslation();
  const { user, profile } = useAuth();
  const userMoeda = (profile?.moeda_preferida ?? "BRL") as "BRL" | "USD" | "EUR";
  const userDolarPref = (profile?.tipo_dolar_preferido ?? "comercial") as DolarTipo;

  const [periodo, setPeriodo] = useState<Periodo>("30d");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  const { from, to } = useMemo(
    () => computeRange(periodo, customFrom, customTo),
    [periodo, customFrom, customTo],
  );

  const { data: dolar } = useQuery({
    queryKey: ["cotacoes_dolar"],
    queryFn: async () =>
      (await supabase.from("cotacoes_dolar").select("tipo, valor_brl")).data ?? [],
    staleTime: 1000 * 60 * 30,
  });

  const { data: vendas, isLoading: loadingVendas } = useQuery({
    queryKey: ["reports_vendas", user?.id, from, to],
    enabled: !!user,
    queryFn: async (): Promise<VendaRow[]> => {
      const { data, error } = await supabase
        .from("vendas")
        .select(
          "id, anuncio_id, comprador_nome, quantidade, unidade_id, valor_total, moeda, data_venda, status_pagamento, anuncios:anuncio_id(titulo, produto), unidades:unidade_id(nome_chave, fator_kg)",
        )
        .eq("vendedor_id", user!.id)
        .is("deleted_at", null)
        .gte("data_venda", from)
        .lte("data_venda", to)
        .order("data_venda", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as VendaRow[];
    },
  });

  const { data: conversas } = useQuery({
    queryKey: ["reports_conversas", user?.id, from, to],
    enabled: !!user,
    queryFn: async (): Promise<ConversaRow[]> => {
      const { data, error } = await supabase
        .from("conversas")
        .select("id, status_negociacao, created_at")
        .eq("vendedor_id", user!.id)
        .is("deleted_at", null)
        .gte("created_at", `${from}T00:00:00`)
        .lte("created_at", `${to}T23:59:59`);
      if (error) throw error;
      return (data ?? []) as ConversaRow[];
    },
  });

  const money = (v: number) =>
    formatMoney(v, userMoeda, userDolarPref, dolar ?? [], i18n.language);
  const moneyCompact = (v: number) =>
    formatMoneyCompact(v, userMoeda, userDolarPref, dolar ?? [], i18n.language);

  // Summary
  const summary = useMemo(() => {
    const list = vendas ?? [];
    const brl = list.filter((v) => v.moeda === "BRL");
    const total = brl.reduce((acc, v) => acc + Number(v.valor_total), 0);
    const received = brl
      .filter((v) => v.status_pagamento === "recebido")
      .reduce((acc, v) => acc + Number(v.valor_total), 0);
    const pending = total - received;
    const count = list.length;
    const avg = count > 0 ? total / count : 0;
    return { total, received, pending, count, avg };
  }, [vendas]);

  // Revenue by month
  const revenueByMonth = useMemo(() => {
    const map = new Map<string, number>();
    for (const v of vendas ?? []) {
      if (v.moeda !== "BRL") continue;
      const ym = v.data_venda.slice(0, 7); // YYYY-MM
      map.set(ym, (map.get(ym) ?? 0) + Number(v.valor_total));
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([ym, value]) => {
        const [y, m] = ym.split("-").map(Number);
        const label = new Intl.DateTimeFormat(i18n.language, {
          month: "short",
          year: "2-digit",
        }).format(new Date(Date.UTC(y, (m ?? 1) - 1, 1)));
        return { ym, label, value: roundN(value) };
      });
  }, [vendas, i18n.language]);

  // Top products
  const topProducts = useMemo(() => {
    const byValue = new Map<string, number>();
    const byVolume = new Map<string, number>();
    for (const v of vendas ?? []) {
      const name = v.anuncios?.titulo || v.anuncios?.produto || "—";
      if (v.moeda === "BRL") {
        byValue.set(name, (byValue.get(name) ?? 0) + Number(v.valor_total));
      }
      const fator = Number(v.unidades?.fator_kg ?? 0);
      const kg = Number(v.quantidade) * fator;
      byVolume.set(name, (byVolume.get(name) ?? 0) + kg);
    }
    const sortDesc = (m: Map<string, number>) =>
      Array.from(m.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(([name, value]) => ({ name, value: roundN(value) }));
    return { byValue: sortDesc(byValue), byVolume: sortDesc(byVolume) };
  }, [vendas]);

  // Funnel
  const funnel = useMemo(() => {
    const counts: Record<NegStatus, number> = {
      iniciado: 0,
      em_negociacao: 0,
      fechado: 0,
      descartado: 0,
    };
    for (const c of conversas ?? []) {
      counts[c.status_negociacao] = (counts[c.status_negociacao] ?? 0) + 1;
    }
    const total =
      counts.iniciado + counts.em_negociacao + counts.fechado + counts.descartado;
    const rate = total > 0 ? counts.fechado / total : 0;
    return { counts, total, rate };
  }, [conversas]);

  const nf = new Intl.NumberFormat(i18n.language);
  const pf = new Intl.NumberFormat(i18n.language, {
    style: "percent",
    maximumFractionDigits: 1,
  });

  const handleExportCsv = () => {
    const list = vendas ?? [];
    const headers = [
      t("reports.csvDate"),
      t("reports.csvProduct"),
      t("reports.csvBuyer"),
      t("reports.csvQuantity"),
      t("reports.csvUnit"),
      t("reports.csvTotal"),
      t("reports.csvCurrency"),
      t("reports.csvStatus"),
    ];
    const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
    const rows = list.map((v) =>
      [
        v.data_venda,
        v.anuncios?.titulo || v.anuncios?.produto || "",
        v.comprador_nome ?? "",
        String(v.quantidade),
        v.unidades?.nome_chave ?? "",
        String(v.valor_total),
        v.moeda,
        v.status_pagamento,
      ]
        .map(esc)
        .join(","),
    );
    const csv = [headers.map(esc).join(","), ...rows].join("\n");
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${t("reports.csvFileName")}_${from}_${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const periodOptions: { v: Periodo; key: string }[] = [
    { v: "30d", key: "reports.period30" },
    { v: "90d", key: "reports.period90" },
    { v: "12m", key: "reports.period12m" },
    { v: "custom", key: "reports.periodCustom" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold md:text-3xl">
            {t("reports.title")}
          </h1>
          <p className="text-sm text-muted-foreground">{t("reports.subtitle")}</p>
        </div>
        <PillButton onClick={handleExportCsv} disabled={(vendas ?? []).length === 0}>
          <Download className="h-4 w-4" />
          {t("reports.exportCsv")}
        </PillButton>
      </div>

      {/* Period filter */}
      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <Filter className="h-3.5 w-3.5" />
          {t("reports.periodLabel")}
        </div>
        <div className="flex flex-wrap gap-2">
          {periodOptions.map((opt) => (
            <button
              key={opt.v}
              onClick={() => setPeriodo(opt.v)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
                periodo === opt.v
                  ? "border-primary bg-primary/15 text-primary"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {t(opt.key)}
            </button>
          ))}
        </div>
        {periodo === "custom" && (
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              {t("reports.from")}
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              {t("reports.to")}
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
              />
            </label>
          </div>
        )}
      </div>

      {/* Summary */}
      <section>
        <h2 className="mb-3 font-display text-lg font-bold">{t("reports.summary")}</h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <Kpi label={t("reports.totalSold")} value={moneyCompact(summary.total)} fullValue={money(summary.total)} accent />
          <Kpi label={t("reports.received")} value={moneyCompact(summary.received)} fullValue={money(summary.received)} />
          <Kpi label={t("reports.pending")} value={moneyCompact(summary.pending)} fullValue={money(summary.pending)} />
          <Kpi label={t("reports.salesCount")} value={nf.format(summary.count)} />
          <Kpi label={t("reports.averageTicket")} value={moneyCompact(summary.avg)} fullValue={money(summary.avg)} />
        </div>
      </section>

      {/* Revenue by month */}
      <section className="rounded-2xl border border-border bg-card p-5">
        <div className="mb-3 flex items-center gap-2">
          <span className="rounded-full bg-primary/15 p-1.5 text-primary">
            <TrendingUp className="h-3.5 w-3.5" />
          </span>
          <h3 className="font-display text-sm font-bold">
            {t("reports.revenueByMonth")}
          </h3>
        </div>
        {loadingVendas ? (
          <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
        ) : revenueByMonth.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("reports.emptySales")}</p>
        ) : (
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={revenueByMonth} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="label"
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={11}
                />
                <YAxis
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={11}
                  tickFormatter={(v) => nf.format(Number(v))}
                />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 12,
                    fontSize: 12,
                  }}
                  formatter={(v: number) => money(Number(v))}
                  labelStyle={{ color: "hsl(var(--foreground))" }}
                />
                <Bar dataKey="value" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      {/* Top products */}
      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="mb-3 flex items-center gap-2">
            <span className="rounded-full bg-primary/15 p-1.5 text-primary">
              <Package className="h-3.5 w-3.5" />
            </span>
            <h3 className="font-display text-sm font-bold">
              {t("reports.topProducts")} — {t("reports.byValue")}
            </h3>
          </div>
          {topProducts.byValue.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("reports.emptySales")}</p>
          ) : (
            <ProductBars items={topProducts.byValue} formatValue={money} />
          )}
        </div>

        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="mb-3 flex items-center gap-2">
            <span className="rounded-full bg-primary/15 p-1.5 text-primary">
              <BarChart3 className="h-3.5 w-3.5" />
            </span>
            <h3 className="font-display text-sm font-bold">
              {t("reports.topProducts")} — {t("reports.byVolume")}
            </h3>
          </div>
          {topProducts.byVolume.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("reports.emptySales")}</p>
          ) : (
            <ProductBars
              items={topProducts.byVolume}
              formatValue={(v) => `${nf.format(Math.round(v))} kg`}
            />
          )}
        </div>
      </section>

      {/* Funnel */}
      <section className="rounded-2xl border border-border bg-card p-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-sm font-bold">{t("reports.funnel")}</h3>
          <span className="text-xs font-semibold text-primary tabular-nums">
            {t("reports.conversionRate")}: {pf.format(funnel.rate)}
          </span>
        </div>
        {funnel.total === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t("reports.emptyConversations")}
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {(["iniciado", "em_negociacao", "fechado", "descartado"] as NegStatus[]).map(
              (s) => (
                <div
                  key={s}
                  className="rounded-xl border border-border bg-background/40 p-4"
                >
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {t(`reports.status.${s}`)}
                  </p>
                  <p className="mt-2 font-display text-2xl font-bold tabular-nums">
                    {nf.format(funnel.counts[s])}
                  </p>
                </div>
              ),
            )}
          </div>
        )}
      </section>
    </div>
  );
}

function Kpi({
  label,
  value,
  fullValue,
  accent,
}: {
  label: string;
  value: string;
  fullValue?: string;
  accent?: boolean;
}) {
  return (
    <div className="min-w-0 rounded-2xl border border-border bg-card p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p
        title={fullValue}
        className={cn(
          "mt-2 font-display font-bold tabular-nums leading-tight break-words [font-size:clamp(1.125rem,4vw,1.5rem)]",
          accent ? "text-primary" : "text-foreground",
        )}
      >
        {value}
      </p>
    </div>
  );
}

function ProductBars({
  items,
  formatValue,
}: {
  items: { name: string; value: number }[];
  formatValue: (v: number) => string;
}) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <ul className="space-y-2">
      {items.map((it) => {
        const pct = (it.value / max) * 100;
        return (
          <li key={it.name} className="space-y-1">
            <div className="flex items-center justify-between gap-3 text-xs">
              <span className="truncate font-medium text-foreground">{it.name}</span>
              <span className="tabular-nums text-muted-foreground">
                {formatValue(it.value)}
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${pct}%` }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
