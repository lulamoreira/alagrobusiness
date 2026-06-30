import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Check, Crown, Sparkles, Clock } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { usePlan } from "@/lib/plan";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/planos")({
  component: PlanosPage,
});

interface PlanoRow {
  id: string;
  codigo: string;
  nome: Record<string, string>;
  descricao: Record<string, string>;
  preco_mensal: number;
  preco_anual: number;
  moeda: string;
  limites: Record<string, unknown>;
  ordem?: number | null;
}

function PlanosPage() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const { codigo: planoAtual, emTrial, diasRestantesTrial, isProAtivo } = usePlan();

  const { data: planos, isLoading } = useQuery({
    queryKey: ["planos_publicos"],
    queryFn: async (): Promise<PlanoRow[]> => {
      const { data, error } = await supabase
        .from("planos")
        .select("id, codigo, nome, descricao, preco_mensal, preco_anual, moeda, limites")
        .is("deleted_at", null)
        .order("preco_mensal", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as PlanoRow[];
    },
  });

  const nf = new Intl.NumberFormat(lang, { style: "currency", currency: "BRL" });

  function nameFor(p: PlanoRow) {
    return p.nome?.[lang] ?? p.nome?.["pt-BR"] ?? p.codigo;
  }
  function descFor(p: PlanoRow) {
    return p.descricao?.[lang] ?? p.descricao?.["pt-BR"] ?? "";
  }

  function featuresFor(p: PlanoRow): string[] {
    const l = p.limites ?? {};
    const feats: string[] = [];
    const maxA = l["max_anuncios"];
    feats.push(
      maxA == null
        ? t("plan.features.unlimitedAnuncios")
        : t("plan.features.maxAnuncios", { n: maxA as number }),
    );
    const maxAl = l["max_alertas"];
    feats.push(
      maxAl == null
        ? t("plan.features.unlimitedAlertas")
        : t("plan.features.maxAlertas", { n: maxAl as number }),
    );
    feats.push(
      l["painel_completo"]
        ? t("plan.features.painelFull")
        : t("plan.features.painelLimited"),
    );
    feats.push(
      l["cursos"] === "full"
        ? t("plan.features.cursosFull")
        : t("plan.features.cursosPreview"),
    );
    feats.push(
      l["clube"]
        ? t("plan.features.clubeFull")
        : t("plan.features.clubeNone"),
    );
    return feats;
  }

  const handleAssinar = () => {
    toast.info(t("plan.checkoutSoon"));
  };

  return (
    <div className="space-y-8">
      <header className="text-center">
        <h1 className="font-display text-3xl font-bold md:text-4xl">{t("plan.page.title")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t("plan.page.subtitle")}</p>
        {emTrial && (
          <p className="mt-3 inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-4 py-1.5 text-xs font-semibold text-primary">
            <Clock className="h-3.5 w-3.5" />
            {t("plan.banner.trial", { days: diasRestantesTrial })}
          </p>
        )}
      </header>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-pulse rounded-full bg-primary/40" />
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2">
          {planos?.map((p) => {
            const isPro = p.codigo === "pro";
            const isCurrent = planoAtual === p.codigo;
            return (
              <div
                key={p.id}
                className={cn(
                  "relative overflow-hidden rounded-3xl border bg-card p-6 shadow-xl transition md:p-8",
                  isPro
                    ? "border-primary/60 ring-1 ring-primary/30"
                    : "border-border",
                )}
              >
                {isPro && (
                  <div className="absolute -right-12 top-6 rotate-45 bg-primary px-12 py-1 text-[10px] font-bold uppercase tracking-wider text-primary-foreground">
                    {t("plan.recommended")}
                  </div>
                )}
                <div className="flex items-center gap-2">
                  {isPro ? (
                    <Crown className="h-5 w-5 text-primary" />
                  ) : (
                    <Sparkles className="h-5 w-5 text-muted-foreground" />
                  )}
                  <h2 className="font-display text-2xl font-bold">{nameFor(p)}</h2>
                  {isCurrent && (
                    <span className="ml-2 rounded-full border border-primary/40 bg-primary/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
                      {t("plan.current")}
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{descFor(p)}</p>

                <div className="mt-5 flex items-end gap-1.5">
                  <span className="font-display text-4xl font-bold tabular-nums">
                    {Number(p.preco_mensal) === 0 ? t("plan.free") : nf.format(Number(p.preco_mensal))}
                  </span>
                  {Number(p.preco_mensal) > 0 && (
                    <span className="mb-1.5 text-xs text-muted-foreground">
                      / {t("plan.month")}
                    </span>
                  )}
                </div>
                {Number(p.preco_anual) > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {t("plan.annual")}: {nf.format(Number(p.preco_anual))}
                  </p>
                )}

                <ul className="mt-6 space-y-2.5">
                  {featuresFor(p).map((f, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-7">
                  {isPro ? (
                    isProAtivo ? (
                      <button
                        disabled
                        className="w-full cursor-not-allowed rounded-full border border-border bg-background/40 px-6 py-3 text-sm font-semibold text-muted-foreground"
                      >
                        {t("plan.alreadyActive")}
                      </button>
                    ) : (
                      <button
                        onClick={handleAssinar}
                        className="w-full rounded-full bg-primary px-6 py-3 text-sm font-bold text-primary-foreground transition hover:brightness-110"
                      >
                        {t("plan.subscribe")}
                      </button>
                    )
                  ) : (
                    <button
                      disabled
                      className="w-full cursor-not-allowed rounded-full border border-border bg-background/40 px-6 py-3 text-sm font-semibold text-muted-foreground"
                    >
                      {isCurrent ? t("plan.current") : t("plan.free")}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
