import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Pause, Play, CheckCircle2, Trash2, Sparkles, Warehouse } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PillButton } from "@/components/PillButton";
import { deleteAnuncioPhotos } from "@/lib/storage";
import { AnuncioPhoto } from "@/components/AnuncioCard";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { MarkAsSoldDialog } from "@/components/MarkAsSoldDialog";
import { DestaqueBuyDialog } from "@/components/DestaqueBuyDialog";
import { EstoquePanel } from "@/components/EstoquePanel";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/vender/")({ component: SellPage });

type AnuncioRow = {
  id: string;
  titulo: string;
  produto: string;
  status: "ativo" | "pausado" | "vendido";
  preco: number;
  moeda: "BRL" | "USD" | "EUR";
  preco_unidade_id: string;
  quantidade_disponivel: number;
  quantidade_unidade_id: string;
  fotos: string[];
  updated_at: string;
  estado: string | null;
  cidade: string | null;
  destaque_ate: string | null;
  tipo_oferta: "produto" | "servico" | null;

};

function PhotoThumb({ path, productLabel }: { path: string | null | undefined; productLabel: string }) {
  return (
    <div className="group h-20 w-20 flex-shrink-0 overflow-hidden rounded-xl bg-muted">
      <AnuncioPhoto path={path} productLabel={productLabel} compact />
    </div>
  );
}

function statusClass(status: AnuncioRow["status"]) {
  if (status === "ativo") return "bg-primary/15 text-primary";
  if (status === "pausado") return "bg-yellow-500/15 text-yellow-500";
  return "bg-muted text-muted-foreground";
}

function SellPage() {
  const { t, i18n } = useTranslation();
  const { user, profile } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [soldDialog, setSoldDialog] = useState<AnuncioRow | null>(null);
  const [soldToast, setSoldToast] = useState<string | null>(null);
  const [destaqueDialog, setDestaqueDialog] = useState<AnuncioRow | null>(null);

  const { data: anuncios, isLoading } = useQuery({
    queryKey: ["my_anuncios", user?.id],
    queryFn: async () =>
      (
        await supabase
          .from("anuncios")
          .select("*")
          .eq("vendedor_id", user!.id)
          .is("deleted_at", null)
          .order("updated_at", { ascending: false })
      ).data ?? [],
    enabled: !!user,
  });

  const { data: cotacoes } = useQuery({
    queryKey: ["cotacoes_dolar"],
    queryFn: async () => (await supabase.from("cotacoes_dolar").select("tipo, valor_brl")).data ?? [],
    staleTime: 1000 * 60 * 30,
  });

  const { data: unidades } = useQuery({
    queryKey: ["unidades_all"],
    queryFn: async () =>
      (await supabase.from("unidades").select("*").is("deleted_at", null)).data ?? [],
    staleTime: 1000 * 60 * 30,
  });

  const updateStatus = async (id: string, status: "ativo" | "pausado" | "vendido") => {
    setBusyId(id);
    setActionError(null);
    const { error } = await supabase.from("anuncios").update({ status }).eq("id", id);
    setBusyId(null);
    if (error) setActionError(t("sell.actionError"));
    else qc.invalidateQueries({ queryKey: ["my_anuncios", user?.id] });
  };

  const softDelete = async (id: string, fotos: string[]) => {
    if (!confirm(t("sell.confirmDelete"))) return;
    setBusyId(id);
    setActionError(null);
    const { error } = await supabase.from("anuncios").update({ deleted_at: new Date().toISOString() }).eq("id", id);
    setBusyId(null);
    if (error) {
      setActionError(t("sell.actionError"));
      return;
    }
    // Best-effort: clean up storage
    deleteAnuncioPhotos(fotos).catch(() => undefined);
    qc.invalidateQueries({ queryKey: ["my_anuncios", user?.id] });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold md:text-3xl">{t("sell.title")}</h1>
        <PillButton onClick={() => navigate({ to: "/vender/novo" })}>
          <Plus className="h-4 w-4" />
          {t("sell.newListing")}
        </PillButton>
      </div>

      {actionError && <p className="text-sm text-destructive">{actionError}</p>}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
      ) : !anuncios || anuncios.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/40 p-10 text-center">
          <p className="text-sm text-muted-foreground">{t("sell.noListings")}</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {(anuncios as AnuncioRow[]).map((a) => {
            const unit = unidades?.find((u) => u.id === a.preco_unidade_id);
            const price = formatMoney(
              a.preco,
              profile?.moeda_preferida ?? "BRL",
              profile?.tipo_dolar_preferido ?? "comercial",
              cotacoes ?? [],
              i18n.language,
            );
            const statusLabel =
              a.status === "ativo"
                ? t("sell.statusActive")
                : a.status === "pausado"
                  ? t("sell.statusPaused")
                  : t("sell.statusSold");
            return (
              <li
                key={a.id}
                className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-4 md:flex-row md:items-center"
              >
                <PhotoThumb path={a.fotos?.[0]} productLabel={a.produto} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase", statusClass(a.status))}>
                      {statusLabel}
                    </span>
                    {a.destaque_ate && new Date(a.destaque_ate) > new Date() && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold uppercase text-primary">
                        <Sparkles className="h-2.5 w-2.5" />
                        {t("detail.destaque.ate", { data: new Date(a.destaque_ate).toLocaleDateString(i18n.language) })}
                      </span>
                    )}
                    <span className="text-[10px] text-muted-foreground">
                      {t("sell.updatedAt")} {new Date(a.updated_at).toLocaleDateString(i18n.language)}
                    </span>
                  </div>
                  <h2 className="mt-1 font-display text-base font-bold">{a.produto}</h2>
                  <p className="line-clamp-1 text-xs text-muted-foreground">{a.titulo}</p>
                  <p className="mt-1 text-sm font-semibold text-primary">
                    {price} {unit ? `/ ${t(`units.${unit.nome_chave}`)}` : ""}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    to="/anuncio/$id"
                    params={{ id: a.id }}
                    className="text-xs font-medium text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
                  >
                    {a.titulo.length > 0 ? "↗" : "↗"}
                  </Link>
                  <Link
                    to="/vender/editar/$id"
                    params={{ id: a.id }}
                    className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium hover:bg-accent"
                  >
                    <Pencil className="h-3 w-3" />
                    {t("sell.edit")}
                  </Link>
                  {a.status !== "vendido" && (
                    <button
                      type="button"
                      disabled={busyId === a.id}
                      onClick={() => updateStatus(a.id, a.status === "ativo" ? "pausado" : "ativo")}
                      className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium hover:bg-accent disabled:opacity-50"
                    >
                      {a.status === "ativo" ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                      {a.status === "ativo" ? t("sell.pause") : t("sell.activate")}
                    </button>
                  )}
                  {a.status !== "vendido" && (
                    <button
                      type="button"
                      disabled={busyId === a.id}
                      onClick={() => setSoldDialog(a)}
                      className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium hover:bg-accent disabled:opacity-50"
                    >
                      <CheckCircle2 className="h-3 w-3" />
                      {t("sell.markSold")}
                    </button>
                  )}
                  {a.status === "ativo" && (
                    <button
                      type="button"
                      onClick={() => setDestaqueDialog(a)}
                      className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20"
                    >
                      <Sparkles className="h-3 w-3" />
                      {t("detail.destaque.buyCta")}
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={busyId === a.id}
                    onClick={() => softDelete(a.id, a.fotos)}
                    className="inline-flex items-center gap-1 rounded-full border border-destructive/30 bg-destructive/10 px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/20 disabled:opacity-50"
                  >
                    <Trash2 className="h-3 w-3" />
                    {t("sell.delete")}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {soldToast && (
        <div className="fixed bottom-24 left-1/2 z-40 -translate-x-1/2 rounded-full border border-primary/40 bg-primary/15 px-4 py-2 text-xs font-medium text-primary backdrop-blur md:bottom-6">
          {soldToast}
        </div>
      )}

      {soldDialog && (
        <MarkAsSoldDialog
          open={!!soldDialog}
          anuncio={soldDialog}
          onClose={() => setSoldDialog(null)}
          onSuccess={() => {
            setSoldToast(t("sell.markSoldDialog.success"));
            window.setTimeout(() => setSoldToast(null), 3000);
          }}
        />
      )}
      {destaqueDialog && (
        <DestaqueBuyDialog
          open={!!destaqueDialog}
          anuncioId={destaqueDialog.id}
          destaqueAte={destaqueDialog.destaque_ate}
          onClose={() => setDestaqueDialog(null)}
        />
      )}
    </div>
  );
}
