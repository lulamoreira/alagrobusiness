import { useEffect, useMemo, useState } from "react";
import { Bell, Check } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { formatNotifText, formatNotifType } from "@/lib/notifFormat";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface Notif {
  id: string;
  tipo: string;
  titulo: string | null;
  mensagem: string | null;
  link: string | null;
  lida: boolean;
  created_at: string;
}

const NEGO_STATUS = new Set(["iniciado", "em_negociacao", "fechado", "descartado"]);

function timeAgo(iso: string, t: TFunction): string {
  const diff = Math.max(0, Date.now() - new Date(iso).getTime());
  const s = Math.floor(diff / 1000);
  if (s < 60) return t("notifications.time.now") as string;
  const m = Math.floor(s / 60);
  if (m < 60) return t("notifications.time.minutes", { count: m }) as string;
  const h = Math.floor(m / 60);
  if (h < 24) return t("notifications.time.hours", { count: h }) as string;
  const d = Math.floor(h / 24);
  return t("notifications.time.days", { count: d }) as string;
}

function renderMessage(n: Notif, t: TFunction): string {
  if (n.tipo === "negociacao_status" && n.mensagem && NEGO_STATUS.has(n.mensagem)) {
    return t("notifications.negociacaoMovedTo", {
      status: t(`nego.status.${n.mensagem}`),
    }) as string;
  }
  return formatNotifText(n.mensagem, t);
}

function renderTitle(n: Notif, t: TFunction): string {
  return formatNotifText(n.titulo, t);
}

export function NotificationBell() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<Notif[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!user) {
      setItems([]);
      return;
    }
    let mounted = true;

    const refresh = async () => {
      const { data } = await supabase
        .from("notificacoes")
        .select("id, tipo, titulo, mensagem, link, lida, created_at")
        .eq("usuario_id", user.id)
        .order("lida", { ascending: true })
        .order("created_at", { ascending: false })
        .limit(20);
      if (mounted) setItems((data ?? []) as Notif[]);
    };

    void refresh();

    const channel = supabase
      .channel(`notif-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notificacoes",
          filter: `usuario_id=eq.${user.id}`,
        },
        () => {
          void refresh();
        },
      )
      .subscribe();

    return () => {
      mounted = false;
      void supabase.removeChannel(channel);
    };
  }, [user]);

  const unread = useMemo(() => items.filter((i) => !i.lida).length, [items]);

  const markOne = async (id: string) => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, lida: true } : i)));
    await supabase.from("notificacoes").update({ lida: true }).eq("id", id);
  };

  const markAll = async () => {
    if (!user) return;
    const ids = items.filter((i) => !i.lida).map((i) => i.id);
    if (ids.length === 0) return;
    setItems((prev) => prev.map((i) => ({ ...i, lida: true })));
    await supabase.from("notificacoes").update({ lida: true }).in("id", ids);
  };

  const onClick = async (n: Notif) => {
    setOpen(false);
    if (!n.lida) await markOne(n.id);
    if (n.link) {
      navigate({ to: n.link as string });
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={t("notifications.bellAria")}
          className="relative inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card/60 text-foreground/80 hover:bg-accent hover:text-foreground"
        >
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <span className="absolute -right-1 -top-1 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold text-primary-foreground">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <p className="text-sm font-semibold">{t("notifications.title")}</p>
          <button
            type="button"
            onClick={markAll}
            disabled={unread === 0}
            className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-medium text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-40"
          >
            <Check className="h-3 w-3" />
            {t("notifications.markAllRead")}
          </button>
        </div>
        <div className="max-h-96 overflow-y-auto">
          {items.length === 0 ? (
            <p className="px-4 py-8 text-center text-xs text-muted-foreground">
              {t("notifications.empty")}
            </p>
          ) : (
            <ul className="divide-y divide-border/60">
              {items.map((n) => {
                const msg = renderMessage(n, t);
                const title = renderTitle(n, t);
                return (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={() => onClick(n)}
                      className={cn(
                        "flex w-full items-start gap-2 px-3 py-2.5 text-left hover:bg-accent/60",
                        !n.lida && "bg-primary/5",
                      )}
                    >
                      <span
                        className={cn(
                          "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                          n.lida ? "bg-muted-foreground/40" : "bg-primary",
                        )}
                      />
                      <div className="min-w-0 flex-1">
                        {title && (
                          <p className="truncate text-xs font-semibold">{title}</p>
                        )}
                        <p className="line-clamp-2 text-[11px] text-muted-foreground">
                          {msg}
                        </p>
                        <p className="mt-0.5 text-[10px] text-muted-foreground/70 tabular-nums">
                          {timeAgo(n.created_at, t)}
                        </p>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
