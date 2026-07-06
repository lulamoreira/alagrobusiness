import { ProGate } from "@/components/ProGate";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Handshake, MessageSquare, CheckCircle2, ChevronDown, Info } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { MarkAsSoldDialog } from "@/components/MarkAsSoldDialog";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/negociacoes")({
  component: () => (<ProGate featureKey="plan.feature.negotiations"><NegociacoesPage /></ProGate>),
});

type Status = "iniciado" | "em_negociacao" | "fechado" | "descartado";

const STATUS_ORDER: Status[] = ["iniciado", "em_negociacao", "fechado", "descartado"];

interface Row {
  id: string;
  anuncio_id: string;
  comprador_id: string;
  vendedor_id: string;
  status_negociacao: Status;
  last_message_at: string;
  anuncio: {
    id: string;
    titulo: string;
    produto: string;
    preco: number;
    moeda: "BRL" | "USD" | "EUR";
    quantidade_disponivel: number;
    quantidade_unidade_id: string;
    preco_unidade_id: string;
  } | null;
  comprador: { id: string; nome_completo: string | null } | null;
  ultima: { conteudo: string; created_at: string } | null;
}

function statusDot(s: Status) {
  if (s === "iniciado") return "bg-sky-400";
  if (s === "em_negociacao") return "bg-yellow-400";
  if (s === "fechado") return "bg-primary";
  return "bg-muted-foreground";
}

function NegociacoesPage() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [moveError, setMoveError] = useState<string | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [soldFor, setSoldFor] = useState<Row | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["negociacoes", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<Row[]> => {
      const { data: convs, error } = await supabase
        .from("conversas")
        .select(
          `id, anuncio_id, comprador_id, vendedor_id, status_negociacao, last_message_at,
           anuncio:anuncios ( id, titulo, produto, preco, moeda, quantidade_disponivel, quantidade_unidade_id, preco_unidade_id ),
           comprador:profiles!conversas_comprador_id_fkey ( id, nome_completo )`,
        )
        .eq("vendedor_id", user!.id)
        .is("deleted_at", null)
        .order("last_message_at", { ascending: false });
      if (error) throw error;
      const list = (convs ?? []) as unknown as Row[];

      // Fetch last message preview per conversa (best-effort, one round trip)
      const ids = list.map((c) => c.id);
      const previews = new Map<string, { conteudo: string; created_at: string }>();
      if (ids.length > 0) {
        const { data: msgs } = await supabase
          .from("mensagens")
          .select("conversa_id, conteudo, created_at")
          .in("conversa_id", ids)
          .is("deleted_at", null)
          .order("created_at", { ascending: false });
        for (const m of msgs ?? []) {
          const k = m.conversa_id as string;
          if (!previews.has(k)) {
            previews.set(k, { conteudo: m.conteudo as string, created_at: m.created_at as string });
          }
        }
      }
      return list.map((r) => ({ ...r, ultima: previews.get(r.id) ?? null }));
    },
  });

  const grouped = useMemo(() => {
    const g: Record<Status, Row[]> = {
      iniciado: [],
      em_negociacao: [],
      fechado: [],
      descartado: [],
    };
    for (const r of data ?? []) g[r.status_negociacao].push(r);
    return g;
  }, [data]);

  const moveTo = async (row: Row, next: Status) => {
    setBusyId(row.id);
    setMoveError(null);
    setMenuOpenId(null);
    const { error } = await supabase.rpc("set_status_negociacao", {
      p_conversa_id: row.id,
      p_status: next,
    });
    setBusyId(null);
    if (error) {
      setMoveError(t("nego.moveError"));
      return;
    }
    qc.invalidateQueries({ queryKey: ["negociacoes", user?.id] });
    qc.invalidateQueries({ queryKey: ["business_kpis", user?.id] });
  };

  const total = (data ?? []).length;

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <span className="rounded-2xl bg-primary/15 p-2.5 text-primary">
          <Handshake className="h-5 w-5" />
        </span>
        <div>
          <h1 className="font-display text-2xl font-bold md:text-3xl">{t("nego.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("nego.subtitle")}</p>
        </div>
      </div>

      {moveError && <p className="text-sm text-destructive">{moveError}</p>}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
      ) : total === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/40 p-10 text-center">
          <p className="text-sm text-muted-foreground">{t("nego.empty")}</p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-4">
          {STATUS_ORDER.map((s) => (
            <section
              key={s}
              className="flex flex-col rounded-2xl border border-border bg-card/40 p-3"
            >
              <header className="mb-3 flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <span className={cn("h-2 w-2 rounded-full", statusDot(s))} />
                  <h2 className="text-sm font-semibold">{t(`nego.status.${s}`)}</h2>
                </div>
                <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground tabular-nums">
                  {grouped[s].length}
                </span>
              </header>

              <ul className="space-y-2">
                {grouped[s].length === 0 && (
                  <li className="rounded-xl border border-dashed border-border/60 bg-background/30 p-4 text-center text-[11px] text-muted-foreground">
                    {t("nego.emptyColumn")}
                  </li>
                )}
                {grouped[s].map((row) => {
                  const buyerName = row.comprador?.nome_completo?.trim() || "—";
                  const initial = (buyerName[0] ?? "?").toUpperCase();
                  const time = row.ultima?.created_at ?? row.last_message_at;
                  const otherStatuses = STATUS_ORDER.filter((x) => x !== s);
                  return (
                    <li
                      key={row.id}
                      className="group rounded-xl border border-border bg-card p-3 transition-colors hover:border-primary/40"
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-primary/20 text-xs font-bold text-primary">
                          {initial}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold">{buyerName}</p>
                          <p className="truncate text-[11px] text-muted-foreground">
                            {row.anuncio?.titulo ?? "—"}
                          </p>
                        </div>
                        <span className="text-[10px] text-muted-foreground tabular-nums">
                          {new Date(time).toLocaleTimeString(i18n.language, {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>

                      <p className="mt-2 line-clamp-2 rounded-lg bg-background/40 px-2 py-1.5 text-[11px] text-muted-foreground">
                        {row.ultima?.conteudo ?? t("nego.noMessageYet")}
                      </p>

                      <div className="mt-3 flex flex-wrap items-center gap-1.5">
                        <Link
                          to="/mensagens/$conversaId"
                          params={{ conversaId: row.id }}
                          className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2.5 py-1 text-[11px] font-medium hover:bg-accent"
                        >
                          <MessageSquare className="h-3 w-3" />
                          {t("nego.openChat")}
                        </Link>

                        {s !== "fechado" && row.anuncio && (
                          <button
                            type="button"
                            onClick={() => setSoldFor(row)}
                            className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary hover:bg-primary/20"
                          >
                            <CheckCircle2 className="h-3 w-3" />
                            {t("nego.registerSale")}
                          </button>
                        )}

                        <div className="relative ml-auto">
                          <button
                            type="button"
                            disabled={busyId === row.id}
                            onClick={() =>
                              setMenuOpenId((cur) => (cur === row.id ? null : row.id))
                            }
                            className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2.5 py-1 text-[11px] font-medium hover:bg-accent disabled:opacity-50"
                          >
                            {t("nego.moveTo")}
                            <ChevronDown className="h-3 w-3" />
                          </button>
                          {menuOpenId === row.id && (
                            <div className="absolute right-0 z-10 mt-1 w-40 overflow-hidden rounded-xl border border-border bg-card shadow-xl">
                              {otherStatuses.map((next) => (
                                <button
                                  key={next}
                                  type="button"
                                  onClick={() => void moveTo(row, next)}
                                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-[11px] font-medium hover:bg-accent"
                                >
                                  <span className={cn("h-2 w-2 rounded-full", statusDot(next))} />
                                  {t(`nego.status.${next}`)}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}

      {soldFor?.anuncio && (
        <MarkAsSoldDialog
          open={!!soldFor}
          anuncio={soldFor.anuncio}
          conversaId={soldFor.id}
          initialBuyerName={soldFor.comprador?.nome_completo ?? ""}
          onClose={() => setSoldFor(null)}
          onSuccess={() => setSoldFor(null)}
        />
      )}
    </div>
  );
}
