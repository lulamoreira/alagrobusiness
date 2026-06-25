import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Mail, Megaphone, Newspaper, DollarSign } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/alertas")({
  component: AlertsPage,
});

interface NotificacaoRow {
  id: string;
  tipo: string;
  titulo: string;
  mensagem: string | null;
  link: string | null;
  lida: boolean;
  created_at: string;
}

const ICON_BY_TYPE: Record<string, typeof Bell> = {
  mensagem: Mail,
  alerta: Megaphone,
  noticia: Newspaper,
  preco: DollarSign,
  sistema: Bell,
};

function AlertsPage() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const userId = user?.id;

  const query = useQuery({
    queryKey: ["notificacoes_list", userId],
    enabled: !!userId,
    queryFn: async (): Promise<NotificacaoRow[]> => {
      const { data, error } = await supabase
        .from("notificacoes")
        .select("id, tipo, titulo, mensagem, link, lida, created_at")
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as NotificacaoRow[];
    },
  });

  // Realtime simples: revalida lista quando notificacoes muda.
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`notif-${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notificacoes" },
        () => {
          void query.refetch();
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const items = query.data ?? [];
  const hasUnread = items.some((n) => !n.lida);

  const markRead = async (id: string) => {
    await supabase.from("notificacoes").update({ lida: true }).eq("id", id);
    void queryClient.invalidateQueries({ queryKey: ["notificacoes_list", userId] });
  };

  const markAll = async () => {
    if (!userId) return;
    await supabase
      .from("notificacoes")
      .update({ lida: true })
      .eq("usuario_id", userId)
      .eq("lida", false);
    void queryClient.invalidateQueries({ queryKey: ["notificacoes_list", userId] });
  };

  const handleClick = async (n: NotificacaoRow) => {
    if (!n.lida) await markRead(n.id);
    if (n.link) {
      // Links internos do app começam com '/'. Externos abrem em nova aba.
      if (n.link.startsWith("/")) {
        navigate({ to: n.link });
      } else {
        window.open(n.link, "_blank", "noopener,noreferrer");
      }
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold md:text-3xl">{t("alerts.title")}</h1>
        {hasUnread && (
          <button
            onClick={markAll}
            className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
          >
            {t("alerts.markAllRead")}
          </button>
        )}
      </header>

      {query.isLoading ? (
        <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
      ) : items.length === 0 ? (
        <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 rounded-2xl border border-border bg-card/40 p-8 text-center">
          <Bell className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{t("alerts.empty")}</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map((n) => {
            const Icon = ICON_BY_TYPE[n.tipo] ?? Bell;
            return (
              <li key={n.id}>
                <button
                  onClick={() => void handleClick(n)}
                  className={cn(
                    "flex w-full items-start gap-3 rounded-2xl border p-4 text-left transition-colors",
                    n.lida
                      ? "border-border bg-card/60 hover:bg-accent"
                      : "border-primary/40 bg-card hover:bg-accent",
                  )}
                >
                  <div
                    className={cn(
                      "flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full",
                      n.lida ? "bg-accent text-muted-foreground" : "bg-primary/15 text-primary",
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className={cn("truncate text-sm", n.lida ? "font-medium" : "font-semibold")}>
                        {n.titulo}
                      </p>
                      <span className="flex-shrink-0 text-[10px] text-muted-foreground">
                        {new Date(n.created_at).toLocaleString(i18n.language, {
                          day: "2-digit",
                          month: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    {n.mensagem && (
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {n.mensagem}
                      </p>
                    )}
                    <p className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                      {t(`notifTypes.${n.tipo}`, { defaultValue: n.tipo })}
                    </p>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
