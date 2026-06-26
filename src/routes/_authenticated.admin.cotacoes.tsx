import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { Loader2, Pencil, RefreshCw, Save, X, ExternalLink, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/cotacoes")({
  component: AdminCotacoesPage,
});

const PRODUTOS = [
  "soja", "milho", "cafe_arabica", "cafe_conilon", "boi_gordo",
  "suino", "trigo", "algodao", "arroz", "feijao",
] as const;
type Produto = (typeof PRODUTOS)[number];

type Moeda = "BRL" | "USD" | "EUR";

interface Unidade {
  id: string;
  nome_chave: string;
}

interface Cotacao {
  id: string;
  produto: string;
  valor: number;
  moeda: Moeda;
  unidade_id: string | null;
  data: string;
  fonte: string;
  fonte_url: string | null;
}

interface Sugestao {
  produto: Produto;
  valor: number | string;
  unidade: string;
  unidade_id?: string;
  moeda?: Moeda;
  fonte_url: string;
  _skipped?: boolean;
}

function AdminCotacoesPage() {
  const { t, i18n } = useTranslation();
  const { profile } = useAuth();
  const navigate = useNavigate();

  const [unidades, setUnidades] = useState<Unidade[]>([]);
  const [atuais, setAtuais] = useState<Record<string, Cotacao | undefined>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [editing, setEditing] = useState<Produto | null>(null);
  const [editValor, setEditValor] = useState("");
  const [editUnidade, setEditUnidade] = useState("");
  const [editMoeda, setEditMoeda] = useState<Moeda>("BRL");
  const [preview, setPreview] = useState<Sugestao[] | null>(null);

  useEffect(() => {
    if (profile && profile.tipo_perfil !== "admin") {
      navigate({ to: "/painel" });
    }
  }, [profile, navigate]);

  const schema = useMemo(() => z.object({
    valor: z.coerce.number({ invalid_type_error: t("adminQuotes.validation.valueRequired") })
      .positive(t("adminQuotes.validation.valueRequired")),
    unidade_id: z.string().uuid(t("adminQuotes.validation.unitRequired")),
    moeda: z.enum(["BRL", "USD", "EUR"]),
  }), [i18n.language]);

  const load = async () => {
    setLoading(true);
    const [{ data: uns }, { data: cots }] = await Promise.all([
      supabase.from("unidades").select("id, nome_chave").is("deleted_at", null).order("nome_chave"),
      supabase
        .from("cotacoes_commodities")
        .select("id, produto, valor, moeda, unidade_id, data, fonte, fonte_url")
        .in("produto", PRODUTOS as unknown as string[])
        .is("deleted_at", null)
        .order("data", { ascending: false }),
    ]);
    setUnidades((uns ?? []) as Unidade[]);
    const map: Record<string, Cotacao | undefined> = {};
    for (const row of (cots ?? []) as Cotacao[]) {
      if (!map[row.produto]) map[row.produto] = row;
    }
    setAtuais(map);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const startEdit = (produto: Produto) => {
    const cur = atuais[produto];
    setEditing(produto);
    setEditValor(cur ? String(cur.valor) : "");
    setEditUnidade(cur?.unidade_id ?? unidades[0]?.id ?? "");
    setEditMoeda((cur?.moeda as Moeda) ?? "BRL");
  };

  const saveManual = async () => {
    if (!editing) return;
    const parsed = schema.safeParse({ valor: editValor, unidade_id: editUnidade, moeda: editMoeda });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "");
      return;
    }
    setBusy(true);
    const today = new Date().toISOString().slice(0, 10);
    const existing = atuais[editing];
    let error;
    if (existing && existing.data === today) {
      ({ error } = await supabase
        .from("cotacoes_commodities")
        .update({
          valor: parsed.data.valor,
          unidade_id: parsed.data.unidade_id,
          moeda: parsed.data.moeda,
          fonte: "manual",
          fonte_url: null,
          atualizado_em: new Date().toISOString(),
        })
        .eq("id", existing.id));
    } else {
      ({ error } = await supabase.from("cotacoes_commodities").insert({
        produto: editing,
        valor: parsed.data.valor,
        unidade_id: parsed.data.unidade_id,
        moeda: parsed.data.moeda,
        data: today,
        fonte: "manual",
      }));
    }
    setBusy(false);
    if (error) {
      toast.error(t("adminQuotes.errorSave", { detail: error.message }));
      return;
    }
    toast.success(t("adminQuotes.manualSaved"));
    setEditing(null);
    load();
  };

  const buscarIA = async () => {
    setFetching(true);
    setPreview(null);
    const { data, error } = await supabase.functions.invoke("buscar-cotacoes", { body: {} });
    setFetching(false);
    if (error || !data?.ok) {
      toast.error(t("adminQuotes.errorFetch", { detail: error?.message ?? data?.error ?? "?" }));
      return;
    }
    const cot = (data.cotacoes ?? []) as Sugestao[];
    // pré-resolve unidade_id pelo nome_chave
    const enriched = cot.map((c) => {
      const u = unidades.find((u) => u.nome_chave === c.unidade);
      return { ...c, unidade_id: u?.id ?? "", moeda: (c.moeda ?? "BRL") as Moeda };
    });
    setPreview(enriched);
  };

  const confirmIA = async () => {
    if (!preview) return;
    const today = new Date().toISOString().slice(0, 10);
    const items = preview
      .filter((p) => !p._skipped && p.unidade_id && Number(p.valor) > 0)
      .map((p) => ({
        produto: p.produto,
        valor: Number(p.valor),
        unidade_id: p.unidade_id,
        moeda: p.moeda ?? "BRL",
        fonte_url: p.fonte_url,
      }));
    setBusy(true);
    const { data, error } = await supabase.rpc("gravar_cotacoes_ia", { p_items: items as never });
    setBusy(false);
    if (error) {
      toast.error(t("adminQuotes.errorSave", { detail: error.message }));
      return;
    }
    const rows = (data ?? []) as { produto: string; status: string }[];
    const ok = rows.filter((r) => r.status === "ok").length;
    const skipped = rows.filter((r) => r.status === "skipped_manual").length;
    toast.success(t("adminQuotes.previewSaved", { ok, skipped }));
    // marcar pulados no preview
    setPreview((cur) => cur?.map((p) => ({
      ...p,
      _skipped: rows.find((r) => r.produto === p.produto)?.status === "skipped_manual",
    })) ?? null);
    void today;
    load();
  };

  const updatePreview = (idx: number, patch: Partial<Sugestao>) => {
    setPreview((cur) => cur ? cur.map((p, i) => i === idx ? { ...p, ...patch } : p) : cur);
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="flex items-center gap-2 font-display text-2xl font-bold tracking-tight md:text-3xl">
            <ShieldCheck className="h-6 w-6 text-primary" />
            {t("adminQuotes.title")}
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{t("adminQuotes.subtitle")}</p>
        </div>
        <button
          type="button"
          onClick={buscarIA}
          disabled={fetching}
          className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
        >
          {fetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          {fetching ? t("adminQuotes.fetchingAi") : t("adminQuotes.fetchAi")}
        </button>
      </header>

      <section className="overflow-hidden rounded-2xl border border-border bg-card/40 backdrop-blur-md">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="bg-card/70 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3">{t("adminQuotes.tableProduct")}</th>
                <th className="px-4 py-3">{t("adminQuotes.tableValue")}</th>
                <th className="px-4 py-3">{t("adminQuotes.tableUnit")}</th>
                <th className="px-4 py-3">{t("adminQuotes.tableCurrency")}</th>
                <th className="px-4 py-3">{t("adminQuotes.tableDate")}</th>
                <th className="px-4 py-3">{t("adminQuotes.tableSource")}</th>
                <th className="px-4 py-3 text-right">{t("adminQuotes.tableActions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {PRODUTOS.map((produto) => {
                const cur = atuais[produto];
                const isEditing = editing === produto;
                const unidadeLabel = cur?.unidade_id
                  ? t(`units.${unidades.find((u) => u.id === cur.unidade_id)?.nome_chave ?? ""}`, { defaultValue: "—" })
                  : "—";
                return (
                  <tr key={produto} className="hover:bg-accent/30">
                    <td className="px-4 py-3 font-medium">{t(`commodities.${produto}`)}</td>
                    {isEditing ? (
                      <>
                        <td className="px-4 py-2">
                          <input
                            type="number" step="0.0001" min="0"
                            value={editValor}
                            onChange={(e) => setEditValor(e.target.value)}
                            className="w-28 rounded-lg border border-border bg-background px-2 py-1 text-sm"
                          />
                        </td>
                        <td className="px-4 py-2">
                          <select
                            value={editUnidade}
                            onChange={(e) => setEditUnidade(e.target.value)}
                            className="rounded-lg border border-border bg-background px-2 py-1 text-sm"
                          >
                            {unidades.map((u) => (
                              <option key={u.id} value={u.id}>{t(`units.${u.nome_chave}`)}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-4 py-2">
                          <select
                            value={editMoeda}
                            onChange={(e) => setEditMoeda(e.target.value as Moeda)}
                            className="rounded-lg border border-border bg-background px-2 py-1 text-sm"
                          >
                            <option value="BRL">BRL</option>
                            <option value="USD">USD</option>
                            <option value="EUR">EUR</option>
                          </select>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {new Date().toISOString().slice(0, 10)}
                        </td>
                        <td className="px-4 py-3"><SourceBadge fonte="manual" /></td>
                        <td className="px-4 py-2 text-right">
                          <div className="inline-flex gap-2">
                            <button
                              onClick={saveManual}
                              disabled={busy}
                              className="inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
                            >
                              <Save className="h-3.5 w-3.5" /> {t("adminQuotes.save")}
                            </button>
                            <button
                              onClick={() => setEditing(null)}
                              className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs font-medium hover:bg-accent"
                            >
                              <X className="h-3.5 w-3.5" /> {t("adminQuotes.cancel")}
                            </button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-4 py-3">{cur ? cur.valor.toLocaleString(i18n.language) : "—"}</td>
                        <td className="px-4 py-3 text-muted-foreground">{unidadeLabel}</td>
                        <td className="px-4 py-3 text-muted-foreground">{cur?.moeda ?? "—"}</td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {cur?.data ?? <span className="italic">{t("adminQuotes.noCurrent")}</span>}
                        </td>
                        <td className="px-4 py-3">
                          {cur ? <SourceBadge fonte={cur.fonte} url={cur.fonte_url} /> : "—"}
                        </td>
                        <td className="px-4 py-2 text-right">
                          <button
                            onClick={() => startEdit(produto)}
                            className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs font-medium hover:bg-accent"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            {cur ? t("adminQuotes.edit") : t("adminQuotes.manualLaunch")}
                          </button>
                        </td>
                      </>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {loading && (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}
      </section>

      {preview && (
        <section className="rounded-2xl border border-primary/30 bg-primary/5 p-4 md:p-6">
          <header className="mb-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="font-display text-lg font-semibold">{t("adminQuotes.previewTitle")}</h2>
              <p className="text-sm text-muted-foreground">{t("adminQuotes.previewHint")}</p>
            </div>
            <button
              onClick={confirmIA}
              disabled={busy || preview.length === 0}
              className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {t("adminQuotes.previewConfirm")}
            </button>
          </header>
          {preview.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">{t("adminQuotes.previewEmpty")}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">{t("adminQuotes.tableProduct")}</th>
                    <th className="px-3 py-2">{t("adminQuotes.tableValue")}</th>
                    <th className="px-3 py-2">{t("adminQuotes.tableUnit")}</th>
                    <th className="px-3 py-2">{t("adminQuotes.tableCurrency")}</th>
                    <th className="px-3 py-2">{t("adminQuotes.tableSourceUrl")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {preview.map((p, idx) => (
                    <tr key={idx} className={p._skipped ? "opacity-50" : ""}>
                      <td className="px-3 py-2 font-medium">{t(`commodities.${p.produto}`)}</td>
                      <td className="px-3 py-2">
                        <input
                          type="number" step="0.0001" min="0"
                          value={p.valor}
                          onChange={(e) => updatePreview(idx, { valor: e.target.value })}
                          className="w-28 rounded-lg border border-border bg-background px-2 py-1 text-sm"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <select
                          value={p.unidade_id ?? ""}
                          onChange={(e) => updatePreview(idx, { unidade_id: e.target.value })}
                          className="rounded-lg border border-border bg-background px-2 py-1 text-sm"
                        >
                          <option value="">—</option>
                          {unidades.map((u) => (
                            <option key={u.id} value={u.id}>{t(`units.${u.nome_chave}`)}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-2">
                        <select
                          value={p.moeda ?? "BRL"}
                          onChange={(e) => updatePreview(idx, { moeda: e.target.value as Moeda })}
                          className="rounded-lg border border-border bg-background px-2 py-1 text-sm"
                        >
                          <option value="BRL">BRL</option>
                          <option value="USD">USD</option>
                        </select>
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {p.fonte_url ? (
                          <a href={p.fonte_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                            <ExternalLink className="h-3.5 w-3.5" />
                            {new URL(p.fonte_url).hostname}
                          </a>
                        ) : "—"}
                        {p._skipped && (
                          <span className="ml-2 text-xs italic">({t("adminQuotes.previewSkippedManual")})</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function SourceBadge({ fonte, url }: { fonte: string; url?: string | null }) {
  const { t } = useTranslation();
  const label = fonte === "manual"
    ? t("adminQuotes.sourceManual")
    : fonte === "ia"
      ? t("adminQuotes.sourceIa")
      : t("adminQuotes.sourceAuto");
  const cls = fonte === "manual"
    ? "bg-primary/15 text-primary"
    : fonte === "ia"
      ? "bg-accent text-foreground"
      : "bg-muted text-muted-foreground";
  return (
    <span className="inline-flex items-center gap-1">
      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${cls}`}>
        {label}
      </span>
      {url && (
        <a href={url} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-primary">
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      )}
    </span>
  );
}
