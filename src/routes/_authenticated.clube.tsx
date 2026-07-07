import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Copy, ExternalLink, Sparkles, Tag, CalendarClock } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ProGate } from "@/components/ProGate";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/clube")({
  component: ClubePage,
});

interface VantagemRow {
  id: string;
  titulo: string;
  descricao: string | null;
  parceiro_nome: string;
  parceiro_logo_url: string | null;
  categoria: string | null;
  desconto: string;
  cupom: string | null;
  link_url: string | null;
  validade: string | null;
  ordem: number;
}

function ClubePage() {
  return (
    <ProGate requires="clube" featureKey="clube.title">
      <ClubeContent />
    </ProGate>
  );
}

function ClubeContent() {
  const { t, i18n } = useTranslation();
  const [categoria, setCategoria] = useState<string>("");

  const { data, isLoading } = useQuery({
    queryKey: ["vantagens", "clube"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vantagens")
        .select(
          "id, titulo, descricao, parceiro_nome, parceiro_logo_url, categoria, desconto, cupom, link_url, validade, ordem",
        )
        .order("ordem", { ascending: true })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as VantagemRow[];
    },
  });

  const categorias = useMemo(() => {
    const set = new Set<string>();
    (data ?? []).forEach((v) => v.categoria && set.add(v.categoria));
    return Array.from(set).sort();
  }, [data]);

  const rows = useMemo(
    () => (data ?? []).filter((v) => (categoria ? v.categoria === categoria : true)),
    [data, categoria],
  );

  const fmtDate = (iso: string | null) =>
    iso
      ? new Intl.DateTimeFormat(i18n.language, { dateStyle: "medium" }).format(new Date(iso))
      : null;

  const copyCupom = async (cupom: string) => {
    try {
      await navigator.clipboard.writeText(cupom);
      toast.success(t("clube.copied"));
    } catch {
      toast.error(t("clube.copyError"));
    }
  };

  return (
    <div className="space-y-8">
      <header className="text-center">
        <div className="mx-auto mb-3 inline-flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/30 bg-primary/10">
          <Sparkles className="h-6 w-6 text-primary" />
        </div>
        <h1 className="font-display text-3xl font-bold md:text-4xl">{t("clube.title")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t("clube.subtitle")}</p>
      </header>

      {categorias.length > 0 && (
        <div className="flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => setCategoria("")}
            className={cn(
              "rounded-full border px-4 py-1.5 text-xs font-semibold transition",
              categoria === ""
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card/60 text-muted-foreground hover:text-foreground",
            )}
          >
            {t("clube.filterAll")}
          </button>
          {categorias.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCategoria(c)}
              className={cn(
                "rounded-full border px-4 py-1.5 text-xs font-semibold transition",
                categoria === c
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card/60 text-muted-foreground hover:text-foreground",
              )}
            >
              {c}
            </button>
          ))}
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-3xl border border-border bg-card/60 p-10 text-center text-sm text-muted-foreground">
          {t("clube.empty")}
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((v) => (
            <article
              key={v.id}
              className="flex flex-col rounded-3xl border border-border bg-card p-5 shadow-lg transition hover:border-primary/40"
            >
              <div className="flex items-start gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-background">
                  {v.parceiro_logo_url ? (
                    <img
                      src={v.parceiro_logo_url}
                      alt={v.parceiro_nome}
                      className="h-full w-full object-contain"
                      loading="lazy"
                    />
                  ) : (
                    <span className="text-sm font-bold text-muted-foreground">
                      {v.parceiro_nome[0]?.toUpperCase()}
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {v.parceiro_nome}
                  </p>
                  <h3 className="mt-0.5 line-clamp-2 font-display text-base font-bold text-foreground">
                    {v.titulo}
                  </h3>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-3 py-1 text-xs font-bold text-primary">
                  <Tag className="h-3 w-3" />
                  {v.desconto}
                </span>
                {v.categoria && (
                  <span className="inline-flex items-center rounded-full border border-border px-2.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                    {v.categoria}
                  </span>
                )}
              </div>

              {v.descricao && (
                <p className="mt-3 line-clamp-3 text-sm text-muted-foreground">{v.descricao}</p>
              )}

              {v.cupom && (
                <button
                  type="button"
                  onClick={() => copyCupom(v.cupom!)}
                  className="mt-4 flex items-center justify-between gap-2 rounded-xl border border-dashed border-primary/50 bg-primary/5 px-3 py-2 text-left transition hover:bg-primary/10"
                >
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {t("clube.coupon")}
                    </p>
                    <p className="truncate font-mono text-sm font-bold text-primary">{v.cupom}</p>
                  </div>
                  <Copy className="h-4 w-4 shrink-0 text-primary" />
                </button>
              )}

              <div className="mt-4 flex items-center justify-between gap-3 pt-2">
                {v.validade ? (
                  <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                    <CalendarClock className="h-3 w-3" />
                    {t("clube.validUntil")} {fmtDate(v.validade)}
                  </span>
                ) : (
                  <span />
                )}
                {v.link_url && (
                  <a
                    href={v.link_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-bold text-primary-foreground transition hover:brightness-110"
                  >
                    {t("clube.redeem")}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
