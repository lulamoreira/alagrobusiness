import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, MapPin, Calendar, Package, BadgeCheck, Repeat2, Truck, ChevronLeft, ChevronRight, MessageCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PillButton } from "@/components/PillButton";
import { getSignedUrls } from "@/lib/storage";
import { formatMoney } from "@/lib/format";
import { getOrCreateConversation } from "@/lib/chat";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/anuncio/$id")({ component: DetailPage });

function DetailPage() {
  const { id } = Route.useParams();
  const { t, i18n } = useTranslation();
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [photoIdx, setPhotoIdx] = useState(0);
  const [interestStatus, setInterestStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [chatError, setChatError] = useState<string | null>(null);
  const [openingChat, setOpeningChat] = useState(false);

  const { data: anuncio, isLoading } = useQuery({
    queryKey: ["anuncio_detail", id],
    queryFn: async () =>
      (await supabase.from("anuncios").select("*").eq("id", id).is("deleted_at", null).maybeSingle()).data,
  });

  const { data: photoUrls } = useQuery({
    queryKey: ["anuncio_photos", id, anuncio?.fotos],
    queryFn: () => getSignedUrls(anuncio?.fotos ?? []),
    enabled: !!anuncio?.fotos && anuncio.fotos.length > 0,
  });

  const { data: vendedor } = useQuery({
    queryKey: ["anuncio_vendedor", anuncio?.vendedor_id],
    queryFn: async () =>
      (await supabase.from("profiles").select("nome_completo, cidade, estado").eq("id", anuncio!.vendedor_id).maybeSingle()).data,
    enabled: !!anuncio?.vendedor_id,
  });

  const { data: unidades } = useQuery({
    queryKey: ["unidades_all"],
    queryFn: async () =>
      (await supabase.from("unidades").select("*").is("deleted_at", null)).data ?? [],
    staleTime: 1000 * 60 * 30,
  });

  const { data: cotacoes } = useQuery({
    queryKey: ["cotacoes_dolar"],
    queryFn: async () => (await supabase.from("cotacoes_dolar").select("tipo, valor_brl")).data ?? [],
    staleTime: 1000 * 60 * 30,
  });

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">{t("common.loading")}</p>;
  }
  if (!anuncio) {
    return (
      <div className="space-y-4">
        <Link to="/comprar" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> {t("common.back")}
        </Link>
        <p className="text-sm text-muted-foreground">{t("detail.notFound")}</p>
      </div>
    );
  }

  const priceUnit = unidades?.find((u) => u.id === anuncio.preco_unidade_id);
  const qtyUnit = unidades?.find((u) => u.id === anuncio.quantidade_unidade_id);
  const priceLabel = formatMoney(
    Number(anuncio.preco),
    profile?.moeda_preferida ?? "BRL",
    profile?.tipo_dolar_preferido ?? "comercial",
    cotacoes ?? [],
    i18n.language,
  );
  const harvest = anuncio.data_colheita
    ? new Date(anuncio.data_colheita).toLocaleDateString(i18n.language, { day: "2-digit", month: "long", year: "numeric" })
    : null;

  const isOwner = user?.id === anuncio.vendedor_id;

  const sendInterest = async () => {
    if (!user || isOwner) return;
    setInterestStatus("sending");
    const { error } = await supabase.from("notificacoes").insert({
      usuario_id: anuncio.vendedor_id,
      tipo: "alerta",
      titulo: t("detail.interestNotification", { titulo: anuncio.titulo }),
      mensagem: t("detail.interestMessage"),
      link: `/anuncio/${anuncio.id}`,
    });
    setInterestStatus(error ? "error" : "sent");
  };

  const photos = photoUrls ?? [];
  const total = photos.length;
  const current = photos[photoIdx];

  return (
    <div className="space-y-6">
      <Link to="/comprar" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> {t("common.back")}
      </Link>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        {/* Carousel */}
        <div className="space-y-3">
          <div className="relative aspect-[4/3] overflow-hidden rounded-3xl border border-border bg-muted">
            {current ? (
              <img src={current} alt={anuncio.titulo} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                {t("form.photos")}
              </div>
            )}
            {total > 1 && (
              <>
                <button
                  type="button"
                  aria-label={t("common.back")}
                  onClick={() => setPhotoIdx((i) => (i - 1 + total) % total)}
                  className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-background/70 p-2 backdrop-blur hover:bg-background"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  aria-label={t("common.continue")}
                  onClick={() => setPhotoIdx((i) => (i + 1) % total)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-background/70 p-2 backdrop-blur hover:bg-background"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </>
            )}
          </div>
          {total > 1 && (
            <div className="flex gap-2 overflow-x-auto">
              {photos.map((u, i) => (
                <button
                  type="button"
                  key={i}
                  onClick={() => setPhotoIdx(i)}
                  className={cn(
                    "h-16 w-16 flex-shrink-0 overflow-hidden rounded-xl border-2",
                    i === photoIdx ? "border-primary" : "border-border opacity-60 hover:opacity-100",
                  )}
                >
                  <img src={u} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Info */}
        <div className="space-y-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">
              {t(`categories.${anuncio.categoria}`)}
            </p>
            <h1 className="font-display text-2xl font-bold md:text-3xl">{anuncio.produto}</h1>
            <p className="text-sm text-muted-foreground">{anuncio.titulo}</p>
          </div>

          <div className="rounded-2xl border border-border bg-card p-5">
            <p className="font-display text-3xl font-bold text-primary">{priceLabel}</p>
            {priceUnit && (
              <p className="text-xs text-muted-foreground">/ {t(`units.${priceUnit.nome_chave}`)}</p>
            )}
          </div>

          <ul className="space-y-2 text-sm">
            <li className="flex items-start gap-2">
              <Package className="mt-0.5 h-4 w-4 text-muted-foreground" />
              <span>
                <span className="text-muted-foreground">{t("detail.quantity")}: </span>
                {Number(anuncio.quantidade_disponivel).toLocaleString(i18n.language)}{" "}
                {qtyUnit ? t(`units.${qtyUnit.nome_chave}`) : ""}
              </span>
            </li>
            {anuncio.qualidade && (
              <li className="flex items-start gap-2">
                <BadgeCheck className="mt-0.5 h-4 w-4 text-muted-foreground" />
                <span>
                  <span className="text-muted-foreground">{t("detail.quality")}: </span>
                  {anuncio.qualidade}
                </span>
              </li>
            )}
            {harvest && (
              <li className="flex items-start gap-2">
                <Calendar className="mt-0.5 h-4 w-4 text-muted-foreground" />
                <span>
                  <span className="text-muted-foreground">{t("detail.harvest")}: </span>
                  {harvest}
                </span>
              </li>
            )}
            <li className="flex items-start gap-2">
              <Truck className="mt-0.5 h-4 w-4 text-muted-foreground" />
              <span>
                <span className="text-muted-foreground">{t("detail.delivery")}: </span>
                {t(`delivery.${anuncio.modalidade_entrega}`)}
                {anuncio.raio_entrega_km ? ` · ${anuncio.raio_entrega_km} km` : ""}
              </span>
            </li>
            {anuncio.aceita_permuta && (
              <li className="flex items-start gap-2">
                <Repeat2 className="mt-0.5 h-4 w-4 text-muted-foreground" />
                <span>
                  <span className="text-muted-foreground">{t("detail.barter")}: </span>
                  {anuncio.permuta_descricao ?? t("common.yes")}
                </span>
              </li>
            )}
            {(anuncio.cidade || anuncio.estado) && (
              <li className="flex items-start gap-2">
                <MapPin className="mt-0.5 h-4 w-4 text-muted-foreground" />
                <span>
                  <span className="text-muted-foreground">{t("detail.location")}: </span>
                  {[anuncio.cidade, anuncio.estado].filter(Boolean).join(" — ")}
                </span>
              </li>
            )}
          </ul>

          {anuncio.certificacoes && anuncio.certificacoes.length > 0 && (
            <div>
              <p className="mb-1 text-xs font-medium text-muted-foreground">{t("detail.certifications")}</p>
              <div className="flex flex-wrap gap-2">
                {anuncio.certificacoes.map((c: string) => (
                  <span key={c} className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                    {t(`cert.${c}`, { defaultValue: c })}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="rounded-2xl border border-border bg-card p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{t("detail.seller")}</p>
            <p className="font-display text-base font-bold">{vendedor?.nome_completo ?? "—"}</p>
            <p className="text-xs text-muted-foreground">
              {[vendedor?.cidade, vendedor?.estado].filter(Boolean).join(" — ") || "—"}
            </p>
          </div>

          {!isOwner && (
            <div className="space-y-2">
              <div className="flex flex-col gap-2 sm:flex-row">
                <PillButton
                  type="button"
                  onClick={sendInterest}
                  disabled={interestStatus === "sending" || interestStatus === "sent"}
                  fullWidth
                >
                  {interestStatus === "sent" ? t("detail.interestedSent") : t("detail.interested")}
                </PillButton>
                <PillButton
                  type="button"
                  variant="secondary"
                  fullWidth
                  disabled={openingChat || !user}
                  onClick={async () => {
                    if (!user) return;
                    setOpeningChat(true);
                    setChatError(null);
                    try {
                      const conversaId = await getOrCreateConversation({
                        anuncioId: anuncio.id,
                        vendedorId: anuncio.vendedor_id,
                        userId: user.id,
                      });
                      navigate({ to: "/mensagens/$conversaId", params: { conversaId } });
                    } catch {
                      setChatError(t("detail.chatError"));
                    } finally {
                      setOpeningChat(false);
                    }
                  }}
                >
                  <MessageCircle className="h-4 w-4" />
                  {t("detail.startChat")}
                </PillButton>
              </div>
              {interestStatus === "error" && (
                <p className="text-xs text-destructive">{t("detail.interestError")}</p>
              )}
              {chatError && (
                <p className="text-xs text-destructive">{chatError}</p>
              )}
            </div>
          )}
        </div>
      </div>

      {anuncio.descricao && (
        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="text-xs font-semibold uppercase text-muted-foreground">{t("form.description")}</p>
          <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">{anuncio.descricao}</p>
        </div>
      )}
    </div>
  );
}
