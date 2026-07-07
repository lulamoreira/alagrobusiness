import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Mail, Loader2, CheckCircle2, Circle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAdminPerms } from "@/lib/adminPerms";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/admin/contatos")({
  component: AdminContatosPage,
});

interface ContatoRow {
  id: string;
  nome: string;
  email: string;
  assunto: string;
  mensagem: string;
  lida: boolean;
  created_at: string;
}

function AdminContatosPage() {
  const { t, i18n } = useTranslation();
  const { isAdmin } = useAdminPerms();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<"all" | "unread">("all");

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "contatos"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contatos")
        .select("id, nome, email, assunto, mensagem, lida, created_at")
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ContatoRow[];
    },
  });

  const rows = useMemo(
    () => (data ?? []).filter((r) => (filter === "unread" ? !r.lida : true)),
    [data, filter],
  );

  const fmtDate = (iso: string) =>
    new Intl.DateTimeFormat(i18n.language, { dateStyle: "short", timeStyle: "short" }).format(
      new Date(iso),
    );

  const toggleRead = async (row: ContatoRow) => {
    const { error } = await supabase
      .from("contatos")
      .update({ lida: !row.lida })
      .eq("id", row.id);
    if (error) {
      toast.error(t("contact.errorGeneric"));
      return;
    }
    qc.invalidateQueries({ queryKey: ["admin", "contatos"] });
  };

  if (!isAdmin) {
    return <div className="p-6 text-sm text-muted-foreground">{t("common.not_found")}</div>;
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-6 sm:px-6">
      <header className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <Mail className="h-5 w-5 text-primary" />
          <h1 className="font-display text-2xl font-bold text-foreground">
            {t("adminContatos.title")}
          </h1>
        </div>
        <p className="text-sm text-muted-foreground">{t("adminContatos.subtitle")}</p>
      </header>

      <div className="flex gap-2">
        <Button
          variant={filter === "all" ? "default" : "outline"}
          size="sm"
          onClick={() => setFilter("all")}
        >
          {t("adminContatos.filterAll")}
        </Button>
        <Button
          variant={filter === "unread" ? "default" : "outline"}
          size="sm"
          onClick={() => setFilter("unread")}
        >
          {t("adminContatos.filterUnread")}
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card/60 p-10 text-center text-sm text-muted-foreground">
          {t("adminContatos.empty")}
        </div>
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => (
            <li
              key={r.id}
              className={
                "rounded-2xl border p-4 backdrop-blur transition " +
                (r.lida
                  ? "border-border bg-card/50"
                  : "border-primary/40 bg-card/80")
              }
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={
                        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold " +
                        (r.lida
                          ? "bg-muted text-muted-foreground"
                          : "bg-primary/20 text-primary")
                      }
                    >
                      {r.lida ? (
                        <CheckCircle2 className="h-3 w-3" />
                      ) : (
                        <Circle className="h-3 w-3" />
                      )}
                      {r.lida ? t("adminContatos.read") : t("adminContatos.unread")}
                    </span>
                    <span className="text-xs text-muted-foreground">{fmtDate(r.created_at)}</span>
                  </div>
                  <h3 className="mt-2 truncate font-semibold text-foreground">{r.assunto}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t("adminContatos.from")}: <span className="text-foreground">{r.nome}</span>{" "}
                    &lt;<a className="hover:underline" href={`mailto:${r.email}`}>{r.email}</a>&gt;
                  </p>
                  <p className="mt-3 whitespace-pre-wrap text-sm text-foreground/90">{r.mensagem}</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => toggleRead(r)}>
                  {r.lida ? t("adminContatos.markUnread") : t("adminContatos.markRead")}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
