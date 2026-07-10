import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Sparkles } from "lucide-react";

interface NotifRow {
  id: string;
  titulo: string;
  mensagem: string | null;
}

/**
 * Global single-shot modal that surfaces "categoria_aprovada" notifications
 * to the user. When closed, marks the notification as read once so it
 * doesn't reappear.
 */
export function CategoryApprovedModal() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [queue, setQueue] = useState<NotifRow[]>([]);
  const [current, setCurrent] = useState<NotifRow | null>(null);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("notificacoes")
        .select("id, titulo, mensagem")
        .eq("tipo", "categoria_aprovada")
        .eq("lida", false)
        .is("deleted_at", null)
        .order("created_at", { ascending: true })
        .limit(10);
      if (error || cancelled) return;
      const rows = (data ?? []) as NotifRow[];
      if (rows.length > 0) {
        setQueue(rows.slice(1));
        setCurrent(rows[0]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const close = async () => {
    if (!current || closing) return;
    setClosing(true);
    const id = current.id;
    await supabase.from("notificacoes").update({ lida: true }).eq("id", id);
    setClosing(false);
    if (queue.length > 0) {
      setCurrent(queue[0]);
      setQueue((q) => q.slice(1));
    } else {
      setCurrent(null);
    }
  };

  if (!current) return null;
  const name = current.titulo || current.mensagem || "";

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-background/80 p-4 backdrop-blur">
      <div className="w-full max-w-md space-y-4 rounded-3xl border border-border bg-card p-6 shadow-2xl">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/15 text-primary">
            <Sparkles className="h-5 w-5" />
          </div>
          <h2 className="font-display text-lg font-bold text-foreground">
            {t("catApproved.title")}
          </h2>
        </div>
        <p className="text-sm text-muted-foreground">
          {t("catApproved.body", { name })}
        </p>
        <div className="flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={close}
            disabled={closing}
            className="rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground disabled:opacity-60"
          >
            {t("catApproved.close")}
          </button>
          <Link
            to="/vender"
            onClick={close}
            className="rounded-full border border-primary bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
          >
            {t("catApproved.goToSell")}
          </Link>
        </div>
      </div>
    </div>
  );
}
