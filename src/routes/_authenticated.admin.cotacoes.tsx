import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { Loader2, Pencil, Plus, RefreshCw, Save, X, ExternalLink, ShieldCheck } from "lucide-react";
import { useCommoditiesCatalog, nomeFor, type CatalogItem } from "@/lib/catalog";

export const Route = createFileRoute("/_authenticated/admin/cotacoes")({
  component: AdminCotacoesPage,
});

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
  produto: string;
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

  const { data: catalog = [], refetch: refetchCatalog } = useCommoditiesCatalog();

  const [unidades, setUnidades] = useState<Unidade[]>([]);
  const [atuais, setAtuais] = useState<Record<string, Cotacao | undefined>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [editValor, setEditValor] = useState("");
  const [editUnidade, setEditUnidade] = useState("");
  const [editMoeda, setEditMoeda] = useState<Moeda>("BRL");
  const [preview, setPreview] = useState<Sugestao[] | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [newCodigo, setNewCodigo] = useState("");
  const [newNomePt, setNewNomePt] = useState("");
  const [newNomeEn, setNewNomeEn] = useState("");
  const [newNomeEs, setNewNomeEs] = useState("");
  const [newUnidadeId, setNewUnidadeId] = useState("");
  const [savingNew, setSavingNew] = useState(false);

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

  const unidadePadraoId = (codigo: string): string => {
    const item = catalog.find((c) => c.codigo === codigo);
    return item?.unidade_padrao_id ?? "";
  };

  const load = async () => {
    setLoading(true);
    const [{ data: uns }, { data: cots }] = await Promise.all([
      supabase.from("unidades").select("id, nome_chave").is("deleted_at", null).order("nome_chave"),
      supabase
        .from("cotacoes_commodities")
        .select("id, produto, valor, moeda, unidade_id, data, fonte, fonte_url")
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

  const startEdit = (produto: string) => {
    const cur = atuais[produto];
    setEditing(produto);
    setEditValor(cur ? String(cur.valor) : "");
    setEditUnidade(
      cur?.unidade_id ?? unidadePadraoId(produto) ?? unidades[0]?.id ?? "",
    );
    setEditMoeda((cur?.moeda as Moeda) ?? "BRL");
  };

  const saveNewProduto = async () => {
    if (!newCodigo.trim() || !newNomePt.trim() || !newUnidadeId) {
      toast.error(t("adminQuotes.validation.unitRequired"));
      return;
    }
    setSavingNew(true);
    const codigo = newCodigo.trim().toLowerCase().replace(/\s+/g, "_");
    const ordem = (catalog[catalog.length - 1]?.ordem ?? 0) + 10;
    const { error } = await supabase.from("commodities_catalogo").insert({
      codigo,
      nome: {
        "pt-BR": newNomePt.trim(),
        en: (newNomeEn || newNomePt).trim(),
        es: (newNomeEs || newNomePt).trim(),
      },
      unidade_padrao_id: newUnidadeId,
      ordem,
    });
    setSavingNew(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(t("adminQuotes.newProductSaved"));
    setShowNew(false);
    setNewCodigo("");
    setNewNomePt("");
    setNewNomeEn("");
    setNewNomeEs("");
    setNewUnidadeId("");
    refetchCatalog();
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
    // Pré-resolve unidade_id: 1) pelo nome_chave devolvido pela IA;
    // 2) caso a IA não retorne unidade ou ela seja desconhecida, usa a
    //    unidade padrão do produto. A regra continua a mesma — sem unidade
    //    a linha é bloqueada no `confirmIA`.
    const enriched = cot.map((c) => {
      const byName = unidades.find((u) => u.nome_chave === c.unidade);
      const fallbackId = unidadePadraoId(c.produto);
      return {
        ...c,
        unidade_id: byName?.id || fallbackId || "",
        moeda: (c.moeda ?? "BRL") as Moeda,
      };
    });
    setPreview(enriched);
  };

  const confirmIA = async () => {
    if (!preview) return;
    // Validação na UI: toda linha precisa de unidade e valor positivo
    const missingUnit = preview.some((p) => !p._skipped && !p.unidade_id);
    if (missingUnit) {
      toast.error(t("adminQuotes.validation.unitRequired"));
      return;
    }
    const items = preview
      .filter((p) => !p._skipped && Number(p.valor) > 0)
      .map((p) => ({
        produto: p.produto,
        valor: Number(p.valor),
        unidade_id: p.unidade_id || null,
        moeda: p.moeda ?? "BRL",
        fonte_url: p.fonte_url,
      }));
    if (items.length === 0) {
      toast.error(t("adminQuotes.previewEmpty"));
      return;
    }
    setBusy(true);
    const { data, error } = await supabase.rpc("gravar_cotacoes_ia", { p_items: items as never });
    setBusy(false);
    if (error) {
      toast.error(t("adminQuotes.errorSave", { detail: error.message }));
      return;
    }
    const raw = (data ?? []) as { out_produto: string; out_status: string; out_motivo: string | null }[];
    const rows = raw.map((r) => ({ produto: r.out_produto, status: r.out_status, motivo: r.out_motivo }));
    const ok = rows.filter((r) => r.status === "ok").length;
    const skipped = rows.filter((r) => r.status === "skipped_manual").length;
    const errors = rows.filter((r) => r.status === "erro" || r.status === "skipped_invalid");
    toast.success(t("adminQuotes.previewSaved", { ok, skipped, errors: errors.length }));
    if (errors.length > 0) {
      toast.error(
        errors.map((e) => `${e.produto}: ${e.motivo ?? e.status}`).join(" · "),
      );
    }
    await load();
    if (ok > 0 || skipped > 0) {
      setPreview(null);
    } else {
      // mantém preview aberto para o admin corrigir os erros
      setPreview((cur) => cur?.map((p) => {
        const r = rows.find((x) => x.produto === p.produto);
        return { ...p, _skipped: r?.status === "skipped_manual" };
      }) ?? null);
    }

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
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setShowNew(true)}
            className="inline-flex items-center justify-center gap-2 rounded-full border border-primary/40 bg-card px-4 py-2.5 text-sm font-semibold text-primary transition hover:bg-primary/10"
          >
            <Plus className="h-4 w-4" />
            {t("adminQuotes.newProduct")}
          </button>
          <button
            type="button"
            onClick={buscarIA}
            disabled={fetching}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
          >
            {fetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            {fetching ? t("adminQuotes.fetchingAi") : t("adminQuotes.fetchAi")}
          </button>
        </div>
      </header>

      {showNew && (
        <section className="rounded-2xl border border-primary/30 bg-primary/5 p-4 md:p-6">
          <header className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold">{t("adminQuotes.newProduct")}</h2>
            <button
              onClick={() => setShowNew(false)}
              className="rounded-full p-1 hover:bg-accent"
              aria-label={t("adminQuotes.cancel")}
            >
              <X className="h-4 w-4" />
            </button>
          </header>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
              {t("adminQuotes.code")}
              <input
                value={newCodigo}
                onChange={(e) => setNewCodigo(e.target.value)}
                placeholder="ex: cevada"
                className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
              {t("adminQuotes.defaultUnit")}
              <select
                value={newUnidadeId}
                onChange={(e) => setNewUnidadeId(e.target.value)}
                className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
              >
                <option value="">—</option>
                {unidades.map((u) => (
                  <option key={u.id} value={u.id}>{t(`units.${u.nome_chave}`, { defaultValue: u.nome_chave })}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
              {t("adminQuotes.namePt")}
              <input
                value={newNomePt}
                onChange={(e) => setNewNomePt(e.target.value)}
                className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
              {t("adminQuotes.nameEn")}
              <input
                value={newNomeEn}
                onChange={(e) => setNewNomeEn(e.target.value)}
                className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground md:col-span-2">
              {t("adminQuotes.nameEs")}
              <input
                value={newNomeEs}
                onChange={(e) => setNewNomeEs(e.target.value)}
                className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
              />
            </label>
          </div>
          <div className="mt-4 flex justify-end">
            <button
              onClick={saveNewProduto}
              disabled={savingNew}
              className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              {savingNew ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {t("adminQuotes.save")}
            </button>
          </div>
        </section>
      )}


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
              {catalog.map((item: CatalogItem) => {
                const produto = item.codigo;
                const cur = atuais[produto];
                const isEditing = editing === produto;
                const unidadeLabel = cur?.unidade_id
                  ? t(`units.${unidades.find((u) => u.id === cur.unidade_id)?.nome_chave ?? ""}`, { defaultValue: "—" })
                  : "—";
                return (
                  <tr key={produto} className="hover:bg-accent/30">
                    <td className="px-4 py-3 font-medium">{nomeFor(item, i18n.language)}</td>
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
                  {preview.map((p, idx) => {
                    const missing = !p._skipped && !p.unidade_id;
                    return (
                    <tr
                      key={idx}
                      className={
                        p._skipped
                          ? "opacity-50"
                          : missing
                            ? "bg-destructive/10 ring-1 ring-inset ring-destructive/40"
                            : ""
                      }
                    >
                      <td className="px-3 py-2 font-medium">{(() => { const c = catalog.find((x) => x.codigo === p.produto); return c ? nomeFor(c, i18n.language) : p.produto; })()}</td>
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
                          className={`rounded-lg border bg-background px-2 py-1 text-sm ${missing ? "border-destructive" : "border-border"}`}
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
                    );
                  })}

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
