import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, ArrowUpCircle, ArrowDownCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface EstoquePanelProps {
  anuncioId: string;
  centroId: string;
  unidadeChave?: string | null;
}

interface Movimentacao {
  id: string;
  tipo: "entrada" | "saida";
  quantidade: number;
  observacao: string | null;
  created_at: string;
}

export function EstoquePanel({ anuncioId, centroId, unidadeChave }: EstoquePanelProps) {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const [tipo, setTipo] = useState<"entrada" | "saida">("entrada");
  const [quantidade, setQuantidade] = useState("");
  const [observacao, setObservacao] = useState("");
  const [saving, setSaving] = useState(false);

  const saldoKey = ["estoque_saldo", anuncioId, centroId];
  const histKey = ["estoque_hist", anuncioId, centroId];

  const { data: saldoRow } = useQuery({
    queryKey: saldoKey,
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase as any)
        .from("estoque_saldos")
        .select("saldo")
        .eq("anuncio_id", anuncioId)
        .eq("centro_id", centroId)
        .maybeSingle();
      return (data ?? null) as { saldo: number } | null;
    },
  });

  const { data: hist, isLoading } = useQuery({
    queryKey: histKey,
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase as any)
        .from("estoque_movimentacoes")
        .select("id, tipo, quantidade, observacao, created_at")
        .eq("anuncio_id", anuncioId)
        .eq("centro_id", centroId)
        .order("created_at", { ascending: false })
        .limit(200);
      return (data ?? []) as Movimentacao[];
    },
  });

  const unidadeLabel = unidadeChave ? t(`units.${unidadeChave}`) : "";
  const saldo = Number(saldoRow?.saldo ?? 0);

  const submit = async () => {
    const q = Number(quantidade.replace(",", "."));
    if (!q || q <= 0) {
      toast.error(t("estoque.quantidadeInvalida"));
      return;
    }
    setSaving(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).from("estoque_movimentacoes").insert({
      anuncio_id: anuncioId,
      centro_id: centroId,
      tipo,
      quantidade: q,
      observacao: observacao.trim() || null,
    });
    setSaving(false);
    if (error) {
      if (error.code === "23514" || /saldo_insuficiente/i.test(error.message ?? "")) {
        toast.error(t("estoque.saldoInsuficiente"));
      } else {
        toast.error(error.message);
      }
      return;
    }
    toast.success(t("estoque.adicionado"));
    setQuantidade("");
    setObservacao("");
    qc.invalidateQueries({ queryKey: saldoKey });
    qc.invalidateQueries({ queryKey: histKey });
  };

  return (
    <div className="space-y-4 rounded-2xl border border-border bg-background/40 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {t("estoque.saldo")}
        </p>
        <p className="font-display text-2xl font-bold text-primary">
          {saldo.toLocaleString(i18n.language)} {unidadeLabel}
        </p>
      </div>

      <div className="space-y-2 rounded-xl border border-border bg-card/50 p-3">
        <div className="grid gap-2 sm:grid-cols-[auto_1fr_auto]">
          <div className="flex gap-1 rounded-full bg-muted p-1">
            <button
              type="button"
              onClick={() => setTipo("entrada")}
              className={cn(
                "flex-1 rounded-full px-3 py-1 text-xs font-semibold transition",
                tipo === "entrada" ? "bg-primary text-primary-foreground" : "text-muted-foreground",
              )}
            >
              {t("estoque.entrada")}
            </button>
            <button
              type="button"
              onClick={() => setTipo("saida")}
              className={cn(
                "flex-1 rounded-full px-3 py-1 text-xs font-semibold transition",
                tipo === "saida" ? "bg-primary text-primary-foreground" : "text-muted-foreground",
              )}
            >
              {t("estoque.saida")}
            </button>
          </div>
          <Input
            type="number"
            inputMode="decimal"
            min="0"
            step="any"
            placeholder={t("estoque.quantidade")}
            value={quantidade}
            onChange={(e) => setQuantidade(e.target.value)}
          />
          <Button onClick={submit} disabled={saving} className="gap-1">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            {t("estoque.adicionar")}
          </Button>
        </div>
        <div>
          <Label className="sr-only">{t("estoque.observacao")}</Label>
          <Textarea
            rows={2}
            placeholder={t("estoque.observacao")}
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
          />
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {t("estoque.historico")}
        </p>
        {isLoading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : !hist || hist.length === 0 ? (
          <p className="text-xs text-muted-foreground">{t("estoque.historicoVazio")}</p>
        ) : (
          <ul className="space-y-1.5">
            {hist.map((m) => (
              <li
                key={m.id}
                className="flex items-start gap-2 rounded-lg border border-border bg-background/40 px-3 py-2 text-sm"
              >
                {m.tipo === "entrada" ? (
                  <ArrowUpCircle className="mt-0.5 h-4 w-4 text-emerald-500" />
                ) : (
                  <ArrowDownCircle className="mt-0.5 h-4 w-4 text-rose-500" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">
                    <span
                      className={cn(
                        "mr-2 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase",
                        m.tipo === "entrada"
                          ? "bg-emerald-500/15 text-emerald-500"
                          : "bg-rose-500/15 text-rose-500",
                      )}
                    >
                      {t(`estoque.${m.tipo}`)}
                    </span>
                    {Number(m.quantidade).toLocaleString(i18n.language)} {unidadeLabel}
                  </p>
                  {m.observacao && (
                    <p className="mt-0.5 text-xs text-muted-foreground">{m.observacao}</p>
                  )}
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {new Date(m.created_at).toLocaleDateString(i18n.language, {
                    day: "2-digit",
                    month: "2-digit",
                    year: "2-digit",
                  })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
