import { ProGate } from "@/components/ProGate";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Plus,
  Pencil,
  Trash2,
  CheckCircle2,
  Circle,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PillButton } from "@/components/PillButton";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/agenda")({
  component: () => (<ProGate featureKey="plan.feature.agenda"><AgendaPage /></ProGate>),
});

type TipoEvento = "plantio" | "colheita" | "entrega" | "pagamento" | "reuniao" | "outro";

const TIPOS: TipoEvento[] = ["plantio", "colheita", "entrega", "pagamento", "reuniao", "outro"];

// Distinct semantic tones per tipo (uses theme tokens via opacity).
const TIPO_DOT: Record<TipoEvento, string> = {
  plantio: "bg-emerald-400",
  colheita: "bg-amber-400",
  entrega: "bg-sky-400",
  pagamento: "bg-primary",
  reuniao: "bg-violet-400",
  outro: "bg-muted-foreground",
};
const TIPO_BADGE: Record<TipoEvento, string> = {
  plantio: "bg-emerald-500/15 text-emerald-400",
  colheita: "bg-amber-500/15 text-amber-400",
  entrega: "bg-sky-500/15 text-sky-400",
  pagamento: "bg-primary/15 text-primary",
  reuniao: "bg-violet-500/15 text-violet-400",
  outro: "bg-muted text-muted-foreground",
};

interface EventoRow {
  id: string;
  titulo: string;
  descricao: string | null;
  tipo: TipoEvento;
  data: string;
  hora: string | null;
  concluido: boolean;
  anuncio_id: string | null;
  venda_id: string | null;
}

const eventoSchema = z.object({
  titulo: z.string().trim().min(1, { message: "validation.required" }).max(200),
  tipo: z.enum(["plantio", "colheita", "entrega", "pagamento", "reuniao", "outro"]),
  data: z.string().min(1, { message: "validation.required" }),
  hora: z.string().optional().nullable(),
  descricao: z.string().trim().max(2000).optional().nullable(),
  anuncio_id: z.string().uuid().optional().nullable(),
  venda_id: z.string().uuid().optional().nullable(),
});

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function AgendaPage() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const qc = useQueryClient();

  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [tipoFilter, setTipoFilter] = useState<"todos" | TipoEvento>("todos");
  const [editing, setEditing] = useState<EventoRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<EventoRow | null>(null);

  const monthRange = useMemo(() => {
    const start = new Date(cursor.year, cursor.month, 1);
    const end = new Date(cursor.year, cursor.month + 1, 0);
    return {
      startISO: start.toISOString().slice(0, 10),
      endISO: end.toISOString().slice(0, 10),
      daysInMonth: end.getDate(),
      startWeekday: start.getDay(),
    };
  }, [cursor]);

  const { data: monthEvents } = useQuery({
    queryKey: ["agenda_month", user?.id, monthRange.startISO, monthRange.endISO],
    enabled: !!user,
    queryFn: async (): Promise<EventoRow[]> => {
      const { data, error } = await supabase
        .from("agenda_eventos")
        .select("id, titulo, descricao, tipo, data, hora, concluido, anuncio_id, venda_id")
        .eq("usuario_id", user!.id)
        .is("deleted_at", null)
        .gte("data", monthRange.startISO)
        .lte("data", monthRange.endISO)
        .order("data", { ascending: true })
        .order("hora", { ascending: true, nullsFirst: true });
      if (error) throw error;
      return (data ?? []) as EventoRow[];
    },
  });

  const { data: upcomingEvents } = useQuery({
    queryKey: ["agenda_upcoming", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<EventoRow[]> => {
      const { data, error } = await supabase
        .from("agenda_eventos")
        .select("id, titulo, descricao, tipo, data, hora, concluido, anuncio_id, venda_id")
        .eq("usuario_id", user!.id)
        .is("deleted_at", null)
        .gte("data", todayISO())
        .order("data", { ascending: true })
        .order("hora", { ascending: true, nullsFirst: true })
        .limit(20);
      if (error) throw error;
      return (data ?? []) as EventoRow[];
    },
  });

  // Group month events by day
  const eventsByDay = useMemo(() => {
    const m = new Map<string, EventoRow[]>();
    (monthEvents ?? []).forEach((e) => {
      if (tipoFilter !== "todos" && e.tipo !== tipoFilter) return;
      const arr = m.get(e.data) ?? [];
      arr.push(e);
      m.set(e.data, arr);
    });
    return m;
  }, [monthEvents, tipoFilter]);

  const filteredUpcoming = useMemo(
    () => (upcomingEvents ?? []).filter((e) => tipoFilter === "todos" || e.tipo === tipoFilter),
    [upcomingEvents, tipoFilter],
  );

  const selectedDayEvents = useMemo(() => {
    if (!selectedDate) return [];
    return (monthEvents ?? []).filter(
      (e) => e.data === selectedDate && (tipoFilter === "todos" || e.tipo === tipoFilter),
    );
  }, [monthEvents, selectedDate, tipoFilter]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["agenda_month"] });
    qc.invalidateQueries({ queryKey: ["agenda_upcoming"] });
    qc.invalidateQueries({ queryKey: ["agenda_upcoming_mini"] });
  };

  const toggleConcluido = async (e: EventoRow) => {
    const { error } = await supabase
      .from("agenda_eventos")
      .update({ concluido: !e.concluido })
      .eq("id", e.id);
    if (!error) invalidate();
  };

  const softDelete = async (e: EventoRow) => {
    const { error } = await supabase
      .from("agenda_eventos")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", e.id);
    if (error) return;
    setConfirmDelete(null);
    invalidate();
  };

  const monthName = new Intl.DateTimeFormat(i18n.language, {
    month: "long",
    year: "numeric",
  }).format(new Date(cursor.year, cursor.month, 1));

  const weekDays = useMemo(() => {
    const ref = new Date(2024, 5, 2); // Sunday
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(ref);
      d.setDate(ref.getDate() + i);
      return new Intl.DateTimeFormat(i18n.language, { weekday: "short" }).format(d);
    });
  }, [i18n.language]);

  const fmtDate = (iso: string) =>
    new Intl.DateTimeFormat(i18n.language, { day: "2-digit", month: "short", year: "numeric" }).format(
      new Date(iso + "T00:00:00"),
    );

  const goPrev = () =>
    setCursor((c) => (c.month === 0 ? { year: c.year - 1, month: 11 } : { ...c, month: c.month - 1 }));
  const goNext = () =>
    setCursor((c) => (c.month === 11 ? { year: c.year + 1, month: 0 } : { ...c, month: c.month + 1 }));

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold md:text-3xl">{t("agenda.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("agenda.subtitle")}</p>
        </div>
        <PillButton onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4" />
          {t("agenda.newEvent")}
        </PillButton>
      </header>

      {/* Filter */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setTipoFilter("todos")}
          className={cn(
            "rounded-full border px-3 py-1 text-xs font-semibold",
            tipoFilter === "todos"
              ? "border-primary bg-primary/15 text-primary"
              : "border-border bg-card text-muted-foreground hover:text-foreground",
          )}
        >
          {t("agenda.filterAll")}
        </button>
        {TIPOS.map((tp) => (
          <button
            key={tp}
            type="button"
            onClick={() => setTipoFilter(tp)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold",
              tipoFilter === tp
                ? "border-primary bg-primary/15 text-primary"
                : "border-border bg-card text-muted-foreground hover:text-foreground",
            )}
          >
            <span className={cn("h-2 w-2 rounded-full", TIPO_DOT[tp])} />
            {t(`agenda.types.${tp}`)}
          </button>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        {/* Upcoming list (mobile-first priority) */}
        <section className="order-1 lg:order-2 lg:row-start-1">
          <h2 className="mb-3 font-display text-lg font-bold">{t("agenda.upcomingTitle")}</h2>
          {!filteredUpcoming.length ? (
            <EmptyUpcoming />
          ) : (
            <ul className="space-y-2">
              {filteredUpcoming.map((e) => (
                <li
                  key={e.id}
                  className="rounded-2xl border border-border bg-card p-4 transition-colors hover:border-primary/40"
                >
                  <div className="flex items-start justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => toggleConcluido(e)}
                      className="mt-0.5 shrink-0 text-muted-foreground hover:text-primary"
                      aria-label={t("agenda.toggleDone")}
                      title={t("agenda.toggleDone")}
                    >
                      {e.concluido ? (
                        <CheckCircle2 className="h-5 w-5 text-primary" />
                      ) : (
                        <Circle className="h-5 w-5" />
                      )}
                    </button>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3
                          className={cn(
                            "truncate font-display text-base font-bold",
                            e.concluido && "text-muted-foreground line-through",
                          )}
                        >
                          {e.titulo}
                        </h3>
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                            TIPO_BADGE[e.tipo],
                          )}
                        >
                          {t(`agenda.types.${e.tipo}`)}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {fmtDate(e.data)}
                        {e.hora ? ` · ${e.hora.slice(0, 5)}` : ""}
                      </p>
                      {e.descricao ? (
                        <p className="mt-1.5 line-clamp-2 text-xs text-muted-foreground">
                          {e.descricao}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setEditing(e)}
                        className="rounded-full border border-border p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                        aria-label={t("agenda.edit")}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDelete(e)}
                        className="rounded-full border border-border p-1.5 text-muted-foreground hover:border-destructive/60 hover:bg-destructive/10 hover:text-destructive"
                        aria-label={t("agenda.delete")}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Calendar */}
        <section className="order-2 lg:order-1">
          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="mb-3 flex items-center justify-between">
              <button
                type="button"
                onClick={goPrev}
                className="rounded-full border border-border p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                aria-label={t("agenda.prevMonth")}
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <h2 className="font-display text-base font-bold capitalize">{monthName}</h2>
              <button
                type="button"
                onClick={goNext}
                className="rounded-full border border-border p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                aria-label={t("agenda.nextMonth")}
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            <div className="mb-1 grid grid-cols-7 gap-0.5 text-center text-[10px] font-semibold uppercase tracking-wide text-muted-foreground sm:gap-1">
              {weekDays.map((d, i) => (
                <div key={i}>{d}</div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-0.5 sm:gap-1">

              {Array.from({ length: monthRange.startWeekday }).map((_, i) => (
                <div key={`blank-${i}`} className="aspect-square" />
              ))}
              {Array.from({ length: monthRange.daysInMonth }).map((_, i) => {
                const day = i + 1;
                const iso = `${cursor.year}-${String(cursor.month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                const events = eventsByDay.get(iso) ?? [];
                const isToday = iso === todayISO();
                const isSelected = iso === selectedDate;
                const tipos = Array.from(new Set(events.map((e) => e.tipo))).slice(0, 4);
                return (
                  <button
                    key={iso}
                    type="button"
                    onClick={() => setSelectedDate(iso)}
                    className={cn(
                      "relative flex aspect-square flex-col items-center justify-start rounded-lg border p-1 text-xs transition-colors",
                      isSelected
                        ? "border-primary bg-primary/10 text-foreground"
                        : "border-transparent bg-background/40 text-muted-foreground hover:border-primary/40 hover:text-foreground",
                      isToday && !isSelected && "ring-1 ring-primary/40",
                    )}
                  >
                    <span className={cn("font-semibold", isToday && "text-primary")}>{day}</span>
                    {tipos.length > 0 && (
                      <span className="mt-auto flex items-center gap-0.5">
                        {tipos.map((tp) => (
                          <span
                            key={tp}
                            className={cn("h-1.5 w-1.5 rounded-full", TIPO_DOT[tp as TipoEvento])}
                          />
                        ))}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Selected day events */}
          {selectedDate && (
            <div className="mt-4 rounded-2xl border border-border bg-card p-4">
              <h3 className="mb-2 font-display text-sm font-bold">
                {t("agenda.eventsOf", { date: fmtDate(selectedDate) })}
              </h3>
              {selectedDayEvents.length === 0 ? (
                <p className="text-xs text-muted-foreground">{t("agenda.noEventsThisDay")}</p>
              ) : (
                <ul className="space-y-2">
                  {selectedDayEvents.map((e) => (
                    <li key={e.id} className="flex items-center justify-between gap-2 text-sm">
                      <span className="flex min-w-0 items-center gap-2">
                        <span className={cn("h-2 w-2 shrink-0 rounded-full", TIPO_DOT[e.tipo])} />
                        <span
                          className={cn(
                            "truncate",
                            e.concluido && "text-muted-foreground line-through",
                          )}
                        >
                          {e.titulo}
                        </span>
                      </span>
                      <span className="shrink-0 text-[11px] text-muted-foreground">
                        {e.hora ? e.hora.slice(0, 5) : t("agenda.allDay")}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </section>
      </div>

      {(creating || editing) && (
        <EventoDialog
          evento={editing}
          defaultDate={selectedDate ?? todayISO()}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSaved={() => {
            setCreating(false);
            setEditing(null);
            invalidate();
          }}
        />
      )}

      {confirmDelete && (
        <ConfirmDialog
          title={t("agenda.deleteConfirmTitle")}
          description={t("agenda.deleteConfirmDesc")}
          confirmLabel={t("agenda.deleteConfirm")}
          onCancel={() => setConfirmDelete(null)}
          onConfirm={() => softDelete(confirmDelete)}
        />
      )}
    </div>
  );
}

function EmptyUpcoming() {
  const { t } = useTranslation();
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card/40 p-10 text-center">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
        <CalendarDays className="h-5 w-5" />
      </div>
      <h3 className="font-display text-base font-bold">{t("agenda.emptyTitle")}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{t("agenda.emptyDescription")}</p>
    </div>
  );
}

function EventoDialog({
  evento,
  defaultDate,
  onClose,
  onSaved,
}: {
  evento: EventoRow | null;
  defaultDate: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const { user } = useAuth();

  const [titulo, setTitulo] = useState(evento?.titulo ?? "");
  const [tipo, setTipo] = useState<TipoEvento>(evento?.tipo ?? "outro");
  const [data, setData] = useState(evento?.data ?? defaultDate);
  const [hora, setHora] = useState(evento?.hora ? evento.hora.slice(0, 5) : "");
  const [descricao, setDescricao] = useState(evento?.descricao ?? "");
  const [anuncioId, setAnuncioId] = useState<string>(evento?.anuncio_id ?? "");
  const [vendaId, setVendaId] = useState<string>(evento?.venda_id ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const { data: anuncios } = useQuery({
    queryKey: ["meus_anuncios_min", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("anuncios")
        .select("id, titulo, produto")
        .eq("vendedor_id", user!.id)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(50);
      return data ?? [];
    },
  });

  const { data: vendas } = useQuery({
    queryKey: ["minhas_vendas_min", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("vendas")
        .select("id, comprador_nome, data_venda, valor_total")
        .eq("vendedor_id", user!.id)
        .is("deleted_at", null)
        .order("data_venda", { ascending: false })
        .limit(50);
      return data ?? [];
    },
  });

  const labelClass = "text-xs font-semibold uppercase tracking-wide text-muted-foreground";
  const inputClass =
    "w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary";

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErrors({});
    setSubmitError(null);

    const parsed = eventoSchema.safeParse({
      titulo: titulo.trim(),
      tipo,
      data,
      hora: hora || null,
      descricao: descricao.trim() || null,
      anuncio_id: anuncioId || null,
      venda_id: vendaId || null,
    });
    if (!parsed.success) {
      const e2: Record<string, string> = {};
      for (const iss of parsed.error.issues) e2[iss.path.join(".")] = iss.message;
      setErrors(e2);
      return;
    }

    setSubmitting(true);
    const payload = {
      usuario_id: user!.id,
      titulo: parsed.data.titulo,
      tipo: parsed.data.tipo,
      data: parsed.data.data,
      hora: parsed.data.hora,
      descricao: parsed.data.descricao,
      anuncio_id: parsed.data.anuncio_id,
      venda_id: parsed.data.venda_id,
    };

    const { error } = evento
      ? await supabase.from("agenda_eventos").update(payload).eq("id", evento.id)
      : await supabase.from("agenda_eventos").insert(payload);

    setSubmitting(false);
    if (error) {
      setSubmitError(t("agenda.errorGeneric"));
      return;
    }
    onSaved();
  };

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
          <h2 className="font-display text-lg font-bold">
            {evento ? t("agenda.editTitle") : t("agenda.newEvent")}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 text-muted-foreground hover:bg-accent"
            aria-label={t("common.cancel")}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className={labelClass}>{t("agenda.fieldTitle")}</label>
            <input
              type="text"
              className={cn(inputClass, errors.titulo && "border-destructive")}
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
            />
            {errors.titulo && (
              <p className="mt-1 text-[11px] text-destructive">{t(errors.titulo)}</p>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={labelClass}>{t("agenda.fieldType")}</label>
              <select
                className={inputClass}
                value={tipo}
                onChange={(e) => setTipo(e.target.value as TipoEvento)}
              >
                {TIPOS.map((tp) => (
                  <option key={tp} value={tp}>
                    {t(`agenda.types.${tp}`)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>{t("agenda.fieldDate")}</label>
              <input
                type="date"
                className={cn(inputClass, errors.data && "border-destructive")}
                value={data}
                onChange={(e) => setData(e.target.value)}
              />
              {errors.data && (
                <p className="mt-1 text-[11px] text-destructive">{t(errors.data)}</p>
              )}
            </div>
          </div>

          <div>
            <label className={labelClass}>{t("agenda.fieldTime")}</label>
            <input
              type="time"
              className={inputClass}
              value={hora}
              onChange={(e) => setHora(e.target.value)}
            />
          </div>

          <div>
            <label className={labelClass}>{t("agenda.fieldDescription")}</label>
            <textarea
              className={cn(inputClass, "min-h-[80px] resize-y")}
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={labelClass}>{t("agenda.fieldLinkAnuncio")}</label>
              <select
                className={inputClass}
                value={anuncioId}
                onChange={(e) => setAnuncioId(e.target.value)}
              >
                <option value="">{t("agenda.linkNone")}</option>
                {(anuncios ?? []).map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.titulo || t(`commodities.${a.produto}`)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>{t("agenda.fieldLinkVenda")}</label>
              <select
                className={inputClass}
                value={vendaId}
                onChange={(e) => setVendaId(e.target.value)}
              >
                <option value="">{t("agenda.linkNone")}</option>
                {(vendas ?? []).map((v) => (
                  <option key={v.id} value={v.id}>
                    {(v.comprador_nome || "—") + " · " + v.data_venda}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {submitError && <p className="text-xs text-destructive">{submitError}</p>}

          <div className="mt-4 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-border px-4 py-2 text-sm font-semibold text-muted-foreground hover:bg-accent"
            >
              {t("common.cancel")}
            </button>
            <PillButton type="submit" disabled={submitting}>
              {t("agenda.save")}
            </PillButton>
          </div>
        </form>
      </div>
    </div>
  );
}

function ConfirmDialog({
  title,
  description,
  confirmLabel,
  onCancel,
  onConfirm,
}: {
  title: string;
  description: string;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-end justify-center bg-background/80 p-0 backdrop-blur-sm md:items-center md:p-6"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div className="w-full max-w-md rounded-t-3xl border border-border bg-card p-6 shadow-2xl md:rounded-2xl">
        <h2 className="font-display text-lg font-bold">{title}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{description}</p>
        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full border border-border px-4 py-2 text-sm font-semibold text-muted-foreground hover:bg-accent"
          >
            {t("common.cancel")}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-full bg-destructive px-4 py-2 text-sm font-semibold text-destructive-foreground hover:bg-destructive/90"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
