import { useState, useMemo, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { registrarVendaSchema } from "@/lib/schemas";
import { PillButton } from "@/components/PillButton";
import { cn } from "@/lib/utils";

interface AnuncioForSale {
  id: string;
  produto: string;
  preco: number;
  moeda: "BRL" | "USD" | "EUR";
  quantidade_disponivel: number;
  quantidade_unidade_id: string;
  preco_unidade_id: string;
}

interface MarkAsSoldDialogProps {
  anuncio: AnuncioForSale;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function MarkAsSoldDialog({ anuncio, open, onClose, onSuccess }: MarkAsSoldDialogProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const qc = useQueryClient();

  const today = new Date().toISOString().slice(0, 10);
  const defaultTotal = Number((anuncio.preco * anuncio.quantidade_disponivel).toFixed(2));

  const [quantidade, setQuantidade] = useState<string>(String(anuncio.quantidade_disponivel));
  const [unidadeId, setUnidadeId] = useState<string>(anuncio.quantidade_unidade_id);
  const [valorTotal, setValorTotal] = useState<string>(String(defaultTotal));
  const [compradorNome, setCompradorNome] = useState<string>("");
  const [dataVenda, setDataVenda] = useState<string>(today);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const { data: unidades } = useQuery({
    queryKey: ["unidades_all"],
    queryFn: async () =>
      (await supabase.from("unidades").select("*").is("deleted_at", null)).data ?? [],
    staleTime: 1000 * 60 * 30,
    enabled: open,
  });

  const unidadeOptions = useMemo(() => unidades ?? [], [unidades]);

  if (!open) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrors({});
    setSubmitError(null);

    const parsed = registrarVendaSchema.safeParse({
      quantidade,
      unidade_id: unidadeId,
      valor_total: valorTotal,
      comprador_nome: compradorNome,
      data_venda: dataVenda,
    });
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const k = issue.path[0]?.toString() ?? "_";
        if (!errs[k]) errs[k] = issue.message;
      }
      setErrors(errs);
      return;
    }
    if (!user) return;
    setSubmitting(true);
    const { error: insertError } = await supabase.from("vendas").insert({
      anuncio_id: anuncio.id,
      vendedor_id: user.id,
      comprador_nome: parsed.data.comprador_nome?.trim() || null,
      quantidade: parsed.data.quantidade,
      unidade_id: parsed.data.unidade_id,
      valor_total: parsed.data.valor_total,
      moeda: anuncio.moeda,
      data_venda: parsed.data.data_venda,
    });
    if (insertError) {
      setSubmitting(false);
      setSubmitError(t("sell.markSoldDialog.error"));
      return;
    }
    const { error: updateError } = await supabase
      .from("anuncios")
      .update({ status: "vendido" })
      .eq("id", anuncio.id);
    setSubmitting(false);
    if (updateError) {
      setSubmitError(t("sell.markSoldDialog.error"));
      return;
    }
    qc.invalidateQueries({ queryKey: ["my_anuncios", user.id] });
    qc.invalidateQueries({ queryKey: ["business_kpis", user.id] });
    onSuccess();
    onClose();
  };

  const labelClass = "text-xs font-semibold uppercase tracking-wide text-muted-foreground";
  const inputClass =
    "w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary";

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
          <div>
            <h2 className="font-display text-lg font-bold">{t("sell.markSoldDialog.title")}</h2>
            <p className="text-xs text-muted-foreground">{t("sell.markSoldDialog.subtitle")}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 text-muted-foreground hover:bg-accent"
            aria-label={t("sell.markSoldDialog.cancel")}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={labelClass}>{t("sell.markSoldDialog.quantity")}</label>
              <input
                type="number"
                step="0.01"
                min="0"
                inputMode="decimal"
                className={cn(inputClass, errors.quantidade && "border-destructive")}
                value={quantidade}
                onChange={(e) => setQuantidade(e.target.value)}
              />
              {errors.quantidade && (
                <p className="mt-1 text-[11px] text-destructive">{t(errors.quantidade)}</p>
              )}
            </div>
            <div>
              <label className={labelClass}>{t("sell.markSoldDialog.unit")}</label>
              <select
                className={cn(inputClass, errors.unidade_id && "border-destructive")}
                value={unidadeId}
                onChange={(e) => setUnidadeId(e.target.value)}
              >
                {unidadeOptions.map((u) => (
                  <option key={u.id} value={u.id}>
                    {t(`units.${u.nome_chave}`)}
                  </option>
                ))}
              </select>
              {errors.unidade_id && (
                <p className="mt-1 text-[11px] text-destructive">{t(errors.unidade_id)}</p>
              )}
            </div>
          </div>

          <div>
            <label className={labelClass}>{t("sell.markSoldDialog.total")}</label>
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

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={labelClass}>{t("sell.markSoldDialog.buyer")}</label>
              <input
                type="text"
                maxLength={120}
                placeholder={t("sell.markSoldDialog.buyerPlaceholder")}
                className={inputClass}
                value={compradorNome}
                onChange={(e) => setCompradorNome(e.target.value)}
              />
            </div>
            <div>
              <label className={labelClass}>{t("sell.markSoldDialog.date")}</label>
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
          </div>

          {submitError && <p className="text-sm text-destructive">{submitError}</p>}

          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-border bg-card px-4 py-2 text-sm font-medium hover:bg-accent"
            >
              {t("sell.markSoldDialog.cancel")}
            </button>
            <PillButton type="submit" disabled={submitting}>
              {t("sell.markSoldDialog.confirm")}
            </PillButton>
          </div>
        </form>
      </div>
    </div>
  );
}
