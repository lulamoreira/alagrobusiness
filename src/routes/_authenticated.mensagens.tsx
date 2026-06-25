import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { MessageSquare } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/mensagens")({
  component: ConversationListPage,
});

interface ConversaRow {
  id: string;
  anuncio_id: string;
  comprador_id: string;
  vendedor_id: string;
  last_message_at: string;
  anuncio: { id: string; titulo: string } | null;
  comprador: { id: string; nome_completo: string | null; avatar_url: string | null } | null;
  vendedor: { id: string; nome_completo: string | null; avatar_url: string | null } | null;
}

interface MensagemRow {
  id: string;
  conversa_id: string;
  remetente_id: string;
  conteudo: string;
  lida: boolean;
  created_at: string;
}

function formatTime(iso: string, locale: string, todayLabel: string, yesterdayLabel: string): string {
  const date = new Date(iso);
  const now = new Date();
  const sameDay =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();
  if (sameDay) {
    return `${todayLabel} ${date.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })}`;
  }
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear();
  if (isYesterday) {
    return `${yesterdayLabel} ${date.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })}`;
  }
  return date.toLocaleDateString(locale, { day: "2-digit", month: "2-digit", year: "2-digit" });
}

function ConversationListPage() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const userId = user?.id;

  const conversasQuery = useQuery({
    queryKey: ["conversas_list", userId],
    enabled: !!userId,
    queryFn: async (): Promise<ConversaRow[]> => {
      const { data, error } = await supabase
        .from("conversas")
        .select(
          `
            id,
            anuncio_id,
            comprador_id,
            vendedor_id,
            last_message_at,
            anuncio:anuncios ( id, titulo ),
            comprador:profiles!conversas_comprador_id_fkey ( id, nome_completo, avatar_url ),
            vendedor:profiles!conversas_vendedor_id_fkey ( id, nome_completo, avatar_url )
          `,
        )
        .is("deleted_at", null)
        .order("last_message_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as ConversaRow[];
    },
  });

  const conversaIds = useMemo(
    () => (conversasQuery.data ?? []).map((c) => c.id),
    [conversasQuery.data],
  );

  const messagesQuery = useQuery({
    queryKey: ["conversas_last_msgs", conversaIds.join(",")],
    enabled: conversaIds.length > 0,
    queryFn: async (): Promise<MensagemRow[]> => {
      const { data, error } = await supabase
        .from("mensagens")
        .select("id, conversa_id, remetente_id, conteudo, lida, created_at")
        .in("conversa_id", conversaIds)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as MensagemRow[];
    },
  });

  // Realtime: invalida quando chega nova mensagem em qualquer das suas conversas.
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`mensagens-list-${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "mensagens" },
        () => {
          void messagesQuery.refetch();
          void conversasQuery.refetch();
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const byConversa = useMemo(() => {
    const last = new Map<string, MensagemRow>();
    const unread = new Map<string, number>();
    for (const m of messagesQuery.data ?? []) {
      if (!last.has(m.conversa_id)) last.set(m.conversa_id, m);
      if (!m.lida && m.remetente_id !== userId) {
        unread.set(m.conversa_id, (unread.get(m.conversa_id) ?? 0) + 1);
      }
    }
    return { last, unread };
  }, [messagesQuery.data, userId]);

  if (!userId) return null;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-bold md:text-3xl">{t("messages.title")}</h1>
      </header>

      {conversasQuery.isLoading ? (
        <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
      ) : (conversasQuery.data ?? []).length === 0 ? (
        <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 rounded-2xl border border-border bg-card/40 p-8 text-center">
          <MessageSquare className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{t("messages.empty")}</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {(conversasQuery.data ?? []).map((c) => {
            const isBuyer = c.comprador_id === userId;
            const other = isBuyer ? c.vendedor : c.comprador;
            const last = byConversa.last.get(c.id);
            const unread = byConversa.unread.get(c.id) ?? 0;
            const initial = (other?.nome_completo ?? "?").trim()[0]?.toUpperCase() ?? "?";
            return (
              <li key={c.id}>
                <Link
                  to="/mensagens/$conversaId"
                  params={{ conversaId: c.id }}
                  className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 transition-colors hover:bg-accent"
                >
                  <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-primary/20 text-sm font-bold text-primary">
                    {initial}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="truncate text-sm font-semibold">
                        {other?.nome_completo ?? "—"}
                      </p>
                      <span className="flex-shrink-0 text-[10px] text-muted-foreground">
                        {formatTime(
                          c.last_message_at,
                          i18n.language,
                          t("messages.today"),
                          t("messages.yesterday"),
                        )}
                      </span>
                    </div>
                    <p className="truncate text-xs text-muted-foreground">
                      {c.anuncio?.titulo ?? "—"}
                    </p>
                    <p className={cn(
                      "mt-0.5 truncate text-xs",
                      unread > 0 ? "font-semibold text-foreground" : "text-muted-foreground",
                    )}>
                      {last
                        ? `${last.remetente_id === userId ? `${t("messages.you")}: ` : ""}${last.conteudo}`
                        : t("messages.newMessage")}
                    </p>
                  </div>
                  {unread > 0 && (
                    <span className="ml-2 inline-flex h-6 min-w-[1.5rem] flex-shrink-0 items-center justify-center rounded-full bg-primary px-2 text-[11px] font-bold text-primary-foreground">
                      {unread}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
