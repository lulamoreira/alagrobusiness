import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Sparkles, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface DestaquePacote {
  id: string;
  dias: number;
  preco_centavos: number;
  ordem: number;
}

interface DestaqueBuyDialogProps {
  open: boolean;
  onClose: () => void;
  anuncioId: string;
  destaqueAte?: string | null;
}

interface FunctionErrorWithContext extends Error {
  context?: {
    json?: () => Promise<unknown>;
    text?: () => Promise<string>;
  };
}

const getCheckoutErrorMessage = async (error: unknown) => {
  const fnError = error as FunctionErrorWithContext;
  try {
    const payload = await fnError.context?.json?.();
    if (payload && typeof payload === "object" && "error" in payload) {
      return String(payload.error);
    }
  } catch {
    try {
      const body = await fnError.context?.text?.();
      if (body) return body;
    } catch {
      // Keep the original error message below when the response body is not readable.
    }
  }
  return fnError.message || String(error);
};

export function DestaqueBuyDialog({ open, onClose, anuncioId, destaqueAte }: DestaqueBuyDialogProps) {
  const { t, i18n } = useTranslation();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: pacotes, isLoading } = useQuery({
    queryKey: ["destaque_pacotes"],
    queryFn: async () => {
      const { data } = await supabase
        .from("destaque_pacotes")
        .select("id, dias, preco_centavos, ordem")
        .eq("ativo", true)
        .order("ordem", { ascending: true });
      return (data ?? []) as DestaquePacote[];
    },
    enabled: open,
    staleTime: 60_000,
  });

  const formatPrice = (cents: number) =>
    new Intl.NumberFormat(i18n.language, { style: "currency", currency: "BRL" }).format(cents / 100);

  const activeUntil =
    destaqueAte && new Date(destaqueAte) > new Date()
      ? new Date(destaqueAte).toLocaleDateString(i18n.language, {
          day: "2-digit",
          month: "long",
          year: "numeric",
        })
      : null;

  const handleBuy = async (pacoteId: string) => {
    setBusyId(pacoteId);
    setError(null);
    try {
      const { data, error: fnErr } = await supabase.functions.invoke("create-destaque-checkout", {
        body: { anuncio_id: anuncioId, pacote_id: pacoteId },
      });
      if (fnErr) throw fnErr;
      const url = (data as { url?: string })?.url;
      if (!url) throw new Error("no_url");
      window.location.href = url;
    } catch (e) {
      console.error(e);
      setError(await getCheckoutErrorMessage(e));
      setBusyId(null);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <h2 className="font-display text-lg font-bold">{t("detail.destaque.buyTitle")}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label={t("detail.destaque.buyClose")}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{t("detail.destaque.buySubtitle")}</p>

        {activeUntil && (
          <div className="mt-3 rounded-xl border border-primary/30 bg-primary/10 px-3 py-2 text-xs font-medium text-primary">
            {t("detail.destaque.buyStatusActive", { data: activeUntil })}
          </div>
        )}

        <div className="mt-4 space-y-2">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">{t("detail.destaque.buyLoading")}</p>
          ) : !pacotes || pacotes.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("detail.destaque.buyEmpty")}</p>
          ) : (
            pacotes.map((p) => (
              <button
                key={p.id}
                type="button"
                disabled={busyId !== null}
                onClick={() => handleBuy(p.id)}
                className={cn(
                  "flex w-full items-center justify-between gap-3 rounded-xl border border-border bg-background p-4 text-left transition",
                  "hover:border-primary hover:bg-primary/5 disabled:opacity-60",
                )}
              >
                <div>
                  <p className="font-display text-base font-bold">
                    {t("detail.destaque.buyDays", { days: p.dias })}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {busyId === p.id ? t("detail.destaque.buyRedirecting") : ""}
                  </p>
                </div>
                <span className="rounded-full bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground">
                  {t("detail.destaque.buyChoose", { price: formatPrice(p.preco_centavos) })}
                </span>
              </button>
            ))
          )}
        </div>

        {error && <p className="mt-3 text-xs text-destructive">{error}</p>}
      </div>
    </div>
  );
}
