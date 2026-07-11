import { ProGate } from "@/components/ProGate";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Handshake, MessageSquare, CheckCircle2, Info, GripVertical } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { MarkAsSoldDialog } from "@/components/MarkAsSoldDialog";
import { cn } from "@/lib/utils";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
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

function CardBody({
  row,
  t,
  lang,
  onDetails,
  onSold,
  dragHandleProps,
  dragging,
}: {
  row: Row;
  t: (k: string) => string;
  lang: string;
  onDetails: (r: Row) => void;
  onSold: (r: Row) => void;
  dragHandleProps?: Record<string, unknown>;
  dragging?: boolean;
}) {
  const buyerName = row.comprador?.nome_completo?.trim() || "—";
  const initial = (buyerName[0] ?? "?").toUpperCase();
  const time = row.ultima?.created_at ?? row.last_message_at;

  return (
    <div
      className={cn(
        "group min-w-0 rounded-xl border border-border bg-card p-3 transition-colors hover:border-primary/40",
        dragging && "opacity-50",
      )}
    >
      <div className="flex items-start gap-2">
        <button
          type="button"
          {...(dragHandleProps ?? {})}
          className="mt-1 cursor-grab touch-none rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground active:cursor-grabbing"
          aria-label={t("nego.drag")}
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => onDetails(row)}
          className="flex flex-1 items-start gap-3 text-left"
          aria-label={t("nego.viewDetails")}
        >
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-primary/20 text-xs font-bold text-primary">
            {initial}
          </div>
          <div className="min-w-0 flex-1">
            <p className="break-words text-sm font-semibold leading-snug">{buyerName}</p>
            <p className="break-words text-[11px] text-muted-foreground leading-snug">
              {row.anuncio?.titulo ?? "—"}
            </p>
          </div>
          <span className="shrink-0 text-[10px] text-muted-foreground tabular-nums">
            {new Date(time).toLocaleTimeString(lang, {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        </button>
      </div>

      <p className="mt-2 line-clamp-2 rounded-lg bg-background/40 px-2 py-1.5 text-[11px] text-muted-foreground break-words">
        {row.ultima?.conteudo ?? t("nego.noMessageYet")}
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={() => onDetails(row)}
          className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2.5 py-1 text-[11px] font-medium hover:bg-accent"
        >
          <Info className="h-3 w-3" />
          {t("nego.viewDetails")}
        </button>
        <Link
          to="/mensagens/$conversaId"
          params={{ conversaId: row.id }}
          className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2.5 py-1 text-[11px] font-medium hover:bg-accent"
        >
          <MessageSquare className="h-3 w-3" />
          {t("nego.openChat")}
        </Link>
        {row.status_negociacao !== "fechado" && row.anuncio && (
          <button
            type="button"
            onClick={() => onSold(row)}
            className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary hover:bg-primary/20"
          >
            <CheckCircle2 className="h-3 w-3" />
            {t("nego.registerSale")}
          </button>
        )}
      </div>
    </div>
  );
}

function DraggableCard(props: {
  row: Row;
  t: (k: string) => string;
  lang: string;
  onDetails: (r: Row) => void;
  onSold: (r: Row) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: props.row.id,
    data: { status: props.row.status_negociacao },
  });
  return (
    <li ref={setNodeRef}>
      <CardBody
        {...props}
        dragHandleProps={{ ...attributes, ...listeners }}
        dragging={isDragging}
      />
    </li>
  );
}

function DroppableColumn({
  status,
  children,
  isOver,
}: {
  status: Status;
  children: React.ReactNode;
  isOver: boolean;
}) {
  const { setNodeRef } = useDroppable({ id: status });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex min-h-[120px] flex-1 flex-col rounded-xl transition-colors",
        isOver && "bg-primary/5 ring-2 ring-primary/40",
      )}
    >
      {children}
    </div>
  );
}

function NegociacoesPage() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [moveError, setMoveError] = useState<string | null>(null);
  const [soldFor, setSoldFor] = useState<Row | null>(null);
  const [detailsFor, setDetailsFor] = useState<Row | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<Status | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
  );

  const queryKey = ["negociacoes", user?.id] as const;

  const { data, isLoading } = useQuery({
    queryKey,
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

  // Realtime: subscribe to conversas where I'm the seller
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`negociacoes:${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "conversas",
          filter: `vendedor_id=eq.${user.id}`,
        },
        () => {
          qc.invalidateQueries({ queryKey });
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "mensagens" },
        () => {
          qc.invalidateQueries({ queryKey });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, qc]);

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

  const activeRow = useMemo(
    () => (data ?? []).find((r) => r.id === activeId) ?? null,
    [data, activeId],
  );

  const onDragStart = (e: DragStartEvent) => {
    setActiveId(String(e.active.id));
    setMoveError(null);
  };

  const onDragEnd = async (e: DragEndEvent) => {
    const id = String(e.active.id);
    const from = e.active.data.current?.status as Status | undefined;
    const to = e.over?.id as Status | undefined;
    setActiveId(null);
    setOverCol(null);
    if (!to || !from || from === to || !STATUS_ORDER.includes(to)) return;

    // Optimistic update
    qc.setQueryData<Row[]>(queryKey, (prev) =>
      (prev ?? []).map((r) => (r.id === id ? { ...r, status_negociacao: to } : r)),
    );

    const { error } = await supabase.rpc("set_status_negociacao", {
      p_conversa_id: id,
      p_status: to,
    });

    if (error) {
      setMoveError(t("nego.moveError"));
      qc.invalidateQueries({ queryKey });
      return;
    }
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
        <DndContext
          sensors={sensors}
          onDragStart={onDragStart}
          onDragOver={(e) => setOverCol((e.over?.id as Status) ?? null)}
          onDragEnd={onDragEnd}
          onDragCancel={() => {
            setActiveId(null);
            setOverCol(null);
          }}
        >
          <div className="grid gap-4 lg:grid-cols-4">
            {STATUS_ORDER.map((s) => (
              <section
                key={s}
                className="flex min-w-0 flex-col rounded-2xl border border-border bg-card/40 p-3"
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

                <DroppableColumn status={s} isOver={overCol === s && activeRow?.status_negociacao !== s}>
                  <ul className="space-y-2">
                    {grouped[s].length === 0 && (
                      <li className="rounded-xl border border-dashed border-border/60 bg-background/30 p-4 text-center text-[11px] text-muted-foreground">
                        {t("nego.emptyColumn")}
                      </li>
                    )}
                    {grouped[s].map((row) => (
                      <DraggableCard
                        key={row.id}
                        row={row}
                        t={t}
                        lang={i18n.language}
                        onDetails={setDetailsFor}
                        onSold={setSoldFor}
                      />
                    ))}
                  </ul>
                </DroppableColumn>
              </section>
            ))}
          </div>

          <DragOverlay dropAnimation={null}>
            {activeRow ? (
              <div className="w-[280px] rotate-2 cursor-grabbing shadow-2xl">
                <CardBody
                  row={activeRow}
                  t={t}
                  lang={i18n.language}
                  onDetails={() => {}}
                  onSold={() => {}}
                />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      <Dialog open={!!detailsFor} onOpenChange={(o) => !o && setDetailsFor(null)}>
        <DialogContent className="max-w-lg">
          {detailsFor && (
            <>
              <DialogHeader>
                <DialogTitle className="break-words">
                  {detailsFor.comprador?.nome_completo?.trim() || "—"}
                </DialogTitle>
                <DialogDescription>
                  <span className="inline-flex items-center gap-2">
                    <span className={cn("h-2 w-2 rounded-full", statusDot(detailsFor.status_negociacao))} />
                    {t(`nego.status.${detailsFor.status_negociacao}`)}
                  </span>
                </DialogDescription>
              </DialogHeader>

              <dl className="grid grid-cols-1 gap-3 text-sm">
                <div>
                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {t("nego.listing")}
                  </dt>
                  <dd className="mt-0.5 break-words font-medium">
                    {detailsFor.anuncio?.titulo ?? "—"}
                  </dd>
                </div>

                {detailsFor.anuncio && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        {t("nego.price")}
                      </dt>
                      <dd className="mt-0.5 font-medium tabular-nums">
                        {new Intl.NumberFormat(i18n.language, {
                          style: "currency",
                          currency: detailsFor.anuncio.moeda,
                        }).format(Number(detailsFor.anuncio.preco))}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        {t("nego.quantity")}
                      </dt>
                      <dd className="mt-0.5 font-medium tabular-nums">
                        {new Intl.NumberFormat(i18n.language).format(
                          Number(detailsFor.anuncio.quantidade_disponivel),
                        )}
                      </dd>
                    </div>
                  </div>
                )}

                <div>
                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {t("nego.lastMessage")}
                  </dt>
                  <dd className="mt-0.5 whitespace-pre-wrap break-words rounded-lg bg-background/40 px-3 py-2 text-sm text-muted-foreground">
                    {detailsFor.ultima?.conteudo ?? t("nego.noMessageYet")}
                  </dd>
                </div>

                <div>
                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {t("nego.lastActivity")}
                  </dt>
                  <dd className="mt-0.5 text-sm text-muted-foreground tabular-nums">
                    {new Date(detailsFor.ultima?.created_at ?? detailsFor.last_message_at).toLocaleString(
                      i18n.language,
                    )}
                  </dd>
                </div>
              </dl>

              <DialogFooter className="gap-2 sm:gap-2">
                <Link
                  to="/mensagens/$conversaId"
                  params={{ conversaId: detailsFor.id }}
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-accent"
                >
                  <MessageSquare className="h-4 w-4" />
                  {t("nego.openChat")}
                </Link>
                {detailsFor.status_negociacao !== "fechado" && detailsFor.anuncio && (
                  <button
                    type="button"
                    onClick={() => {
                      const row = detailsFor;
                      setDetailsFor(null);
                      setSoldFor(row);
                    }}
                    className="inline-flex items-center justify-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-4 py-2 text-sm font-medium text-primary hover:bg-primary/20"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    {t("nego.registerSale")}
                  </button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>


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
