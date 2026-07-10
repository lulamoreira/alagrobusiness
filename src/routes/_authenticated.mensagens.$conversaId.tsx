import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Languages, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/mensagens/$conversaId")({
  component: ConversationThreadPage,
});

interface ConversaDetail {
  id: string;
  anuncio_id: string;
  comprador_id: string;
  vendedor_id: string;
  anuncio: { id: string; titulo: string } | null;
  comprador: { id: string; nome_completo: string | null } | null;
  vendedor: { id: string; nome_completo: string | null } | null;
}

interface MensagemRow {
  id: string;
  conversa_id: string;
  remetente_id: string;
  conteudo: string;
  lida: boolean;
  created_at: string;
  idioma: string | null;
}

function ConversationThreadPage() {
  const { t, i18n } = useTranslation();
  const { conversaId } = Route.useParams();
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const userId = user?.id;
  const isBlocked = profile?.status === "bloqueado";
  const idiomaDestino = (profile?.idioma_preferido as string | undefined) ?? i18n.language ?? "pt-BR";

  const storageKey = `traduzir:${conversaId}`;
  const [translate, setTranslate] = useState<boolean>(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    setTranslate(window.localStorage.getItem(storageKey) === "1");
  }, [storageKey]);
  const toggleTranslate = () => {
    setTranslate((prev) => {
      const next = !prev;
      if (typeof window !== "undefined") {
        window.localStorage.setItem(storageKey, next ? "1" : "0");
      }
      return next;
    });
  };

  const [translations, setTranslations] = useState<Record<string, string>>({});
  const [showOriginal, setShowOriginal] = useState<Record<string, boolean>>({});
  const [translateError, setTranslateError] = useState<string | null>(null);

  const conversaQuery = useQuery({
    queryKey: ["conversa", conversaId],
    enabled: !!conversaId,
    queryFn: async (): Promise<ConversaDetail | null> => {
      const { data, error } = await supabase
        .from("conversas")
        .select(
          `
            id, anuncio_id, comprador_id, vendedor_id,
            anuncio:anuncios ( id, titulo ),
            comprador:profiles!conversas_comprador_id_fkey ( id, nome_completo ),
            vendedor:profiles!conversas_vendedor_id_fkey ( id, nome_completo )
          `,
        )
        .eq("id", conversaId)
        .is("deleted_at", null)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as unknown as ConversaDetail | null;
    },
  });

  const messagesQuery = useQuery({
    queryKey: ["mensagens", conversaId],
    enabled: !!conversaId,
    queryFn: async (): Promise<MensagemRow[]> => {
      const { data, error } = await supabase
        .from("mensagens")
        .select("id, conversa_id, remetente_id, conteudo, lida, created_at, idioma")
        .eq("conversa_id", conversaId)
        .is("deleted_at", null)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as MensagemRow[];
    },
  });

  // Realtime
  useEffect(() => {
    if (!conversaId) return;
    const channel = supabase
      .channel(`mensagens-thread-${conversaId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "mensagens",
          filter: `conversa_id=eq.${conversaId}`,
        },
        () => {
          void messagesQuery.refetch();
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversaId]);

  // Marca lidas
  useEffect(() => {
    if (!userId || !messagesQuery.data) return;
    const hasUnread = messagesQuery.data.some(
      (m) => !m.lida && m.remetente_id !== userId,
    );
    if (!hasUnread) return;
    void supabase
      .rpc("marcar_mensagens_lidas", { p_conversa_id: conversaId })
      .then(() => {
        void queryClient.invalidateQueries({ queryKey: ["mensagens", conversaId] });
      });
  }, [messagesQuery.data, userId, conversaId, queryClient]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messagesQuery.data?.length]);

  // Tradução: dispara ao ativar toggle ou ao chegar mensagem nova
  const fetchTranslations = useCallback(async () => {
    if (!translate || !conversaId) return;
    setTranslateError(null);
    const { data, error } = await supabase.functions.invoke("traduzir-conversa", {
      body: { conversa_id: conversaId, idioma_destino: idiomaDestino },
    });
    if (error) {
      setTranslateError(t("messages.translateError"));
      return;
    }
    const map = (data as { translations?: Record<string, string> } | null)?.translations ?? {};
    setTranslations((prev) => ({ ...prev, ...map }));
  }, [translate, conversaId, idiomaDestino, t]);

  useEffect(() => {
    void fetchTranslations();
  }, [fetchTranslations, messagesQuery.data?.length]);

  const conv = conversaQuery.data;
  const other = useMemo(() => {
    if (!conv || !userId) return null;
    return conv.comprador_id === userId ? conv.vendedor : conv.comprador;
  }, [conv, userId]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId || isBlocked) return;
    const conteudo = text.trim();
    if (!conteudo) return;
    setSending(true);
    setError(null);
    const { error: insErr } = await supabase.from("mensagens").insert({
      conversa_id: conversaId,
      remetente_id: userId,
      conteudo,
    });
    setSending(false);
    if (insErr) {
      setError(t("messages.sendError"));
      return;
    }
    setText("");
    void messagesQuery.refetch();
  };

  if (conversaQuery.isLoading) {
    return <p className="text-sm text-muted-foreground">{t("common.loading")}</p>;
  }
  if (!conv) {
    return <p className="text-sm text-muted-foreground">{t("messages.notFound")}</p>;
  }

  const initial = (other?.nome_completo ?? "?").trim()[0]?.toUpperCase() ?? "?";

  return (
    <div className="flex h-[calc(100vh-10rem)] flex-col lg:h-[calc(100vh-8rem)]">
      {/* Header */}
      <header className="flex items-center gap-3 rounded-2xl border border-border bg-card/60 p-3">
        <button
          onClick={() => navigate({ to: "/mensagens" })}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-accent text-muted-foreground hover:text-foreground lg:hidden"
          aria-label={t("messages.backToList")}
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-primary/20 text-sm font-bold text-primary">
          {initial}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{other?.nome_completo ?? "—"}</p>
          {conv.anuncio?.id && (
            <Link
              to="/anuncio/$id"
              params={{ id: conv.anuncio.id }}
              className="block truncate text-xs text-primary hover:underline"
            >
              {t("messages.regarding")}: {conv.anuncio.titulo}
            </Link>
          )}
        </div>
        <button
          type="button"
          onClick={toggleTranslate}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-medium transition-colors",
            translate
              ? "border-primary/40 bg-primary/15 text-primary"
              : "border-border bg-accent text-muted-foreground hover:text-foreground",
          )}
          aria-pressed={translate}
          title={t("messages.translate")}
        >
          <Languages className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">{t("messages.translate")}</span>
        </button>
      </header>

      {/* Messages */}
      <div className="mt-3 flex-1 overflow-y-auto rounded-2xl border border-border bg-card/30 p-3">
        {(messagesQuery.data ?? []).length === 0 ? (
          <p className="py-12 text-center text-xs text-muted-foreground">
            {t("messages.newMessage")}
          </p>
        ) : (
          <ul className="space-y-2">
            {(messagesQuery.data ?? []).map((m) => {
              const mine = m.remetente_id === userId;
              const traducao = translations[m.id];
              const isTranslated =
                translate && !!traducao && m.idioma !== idiomaDestino;
              const showOrig = showOriginal[m.id] === true;
              const textoExibido = isTranslated && !showOrig ? traducao : m.conteudo;
              return (
                <li
                  key={m.id}
                  className={cn("flex", mine ? "justify-end" : "justify-start")}
                >
                  <div
                    className={cn(
                      "max-w-[80%] rounded-2xl px-3 py-2 text-sm",
                      mine
                        ? "rounded-br-sm bg-primary text-primary-foreground"
                        : "rounded-bl-sm bg-accent text-foreground",
                    )}
                  >
                    <p className="whitespace-pre-wrap break-words">{textoExibido}</p>
                    {isTranslated && (
                      <div
                        className={cn(
                          "mt-1 flex items-center justify-end gap-2 text-[10px]",
                          mine ? "text-primary-foreground/80" : "text-muted-foreground",
                        )}
                      >
                        <span className="inline-flex items-center gap-1 rounded-full bg-background/20 px-1.5 py-0.5">
                          <Languages className="h-2.5 w-2.5" />
                          {t("messages.translated")}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setShowOriginal((prev) => ({ ...prev, [m.id]: !prev[m.id] }))
                          }
                          className="underline underline-offset-2 hover:opacity-80"
                        >
                          {showOrig ? t("messages.hideOriginal") : t("messages.showOriginal")}
                        </button>
                      </div>
                    )}
                    <p
                      className={cn(
                        "mt-1 text-right text-[10px]",
                        mine ? "text-primary-foreground/70" : "text-muted-foreground",
                      )}
                    >
                      {new Date(m.created_at).toLocaleTimeString(i18n.language, {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <div ref={bottomRef} />
      </div>

      {translateError && (
        <p className="mt-2 text-center text-[11px] text-destructive">{translateError}</p>
      )}

      {/* Composer */}
      {isBlocked ? (
        <p className="mt-3 rounded-2xl border border-destructive/40 bg-destructive/10 p-3 text-center text-xs text-destructive">
          {t("messages.blockedHint")}
        </p>
      ) : (
        <form onSubmit={handleSend} className="mt-3 flex gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t("messages.placeholder")}
            className="flex-1 rounded-full border border-border bg-card px-4 py-2.5 text-sm outline-none focus:border-primary"
            disabled={sending}
          />
          <button
            type="submit"
            disabled={sending || !text.trim()}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-primary text-primary-foreground transition-opacity disabled:opacity-50"
            aria-label={t("messages.send")}
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
      )}
      {error && (
        <p className="mt-2 text-center text-xs text-destructive">{error}</p>
      )}
    </div>
  );
}
