import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslation } from "react-i18next";
import { CheckCircle2, ArrowLeft } from "lucide-react";
import { AmbientGlow } from "@/components/AmbientGlow";
import { Logo } from "@/components/Logo";
import { DarkInput } from "@/components/DarkInput";
import { PillButton } from "@/components/PillButton";
import { LanguageSelector } from "@/components/LanguageSelector";
import { supabase } from "@/integrations/supabase/client";

const contactSchema = z.object({
  nome: z.string().trim().min(2, { message: "validation2.nameMin" }).max(120),
  email: z.string().trim().email({ message: "validation.emailInvalid" }).max(255),
  assunto: z.string().trim().min(2, { message: "validation2.subjectMin" }).max(160),
  mensagem: z.string().trim().min(10, { message: "validation2.messageMin" }).max(4000),
  hp: z.string().optional(),
});
type ContactInput = z.infer<typeof contactSchema>;

export const Route = createFileRoute("/contato")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Contato — AGROBUSINESS" },
      { name: "description", content: "Fale com o AGROBUSINESS. Envie sua dúvida, sugestão ou parceria." },
      { property: "og:title", content: "Contato — AGROBUSINESS" },
      { property: "og:description", content: "Fale com o AGROBUSINESS." },
    ],
  }),
  component: ContactPage,
});

function ContactPage() {
  const { t } = useTranslation();
  const [sent, setSent] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ContactInput>({ resolver: zodResolver(contactSchema) });

  const onSubmit = async (data: ContactInput) => {
    setSubmitting(true);
    setServerError(null);
    try {
      const { data: res, error } = await supabase.functions.invoke("enviar-contato", {
        body: {
          nome: data.nome,
          email: data.email,
          assunto: data.assunto,
          mensagem: data.mensagem,
          hp: data.hp ?? "",
          origem: typeof window !== "undefined" ? window.location.origin : null,
        },
      });
      if (error || !res?.ok) {
        const detail = (res as { error?: string } | null)?.error;
        setServerError(detail === "rate_limited" ? t("contact.errorRate") : t("contact.errorGeneric"));
      } else {
        setSent(true);
        reset();
      }
    } catch {
      setServerError(t("contact.errorGeneric"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative min-h-screen">
      <AmbientGlow />
      <header className="sticky top-0 z-40 border-b border-border/40 bg-background/70 backdrop-blur-md">
        <div className="mx-auto flex max-w-4xl items-center gap-3 px-4 py-3 sm:px-6">
          <Logo size="sm" to="/" />
          <div className="ml-auto flex items-center gap-2">
            <LanguageSelector />
            <Link to="/">
              <PillButton variant="secondary" className="gap-1">
                <ArrowLeft className="h-4 w-4" />
                {t("common.back")}
              </PillButton>
            </Link>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
        <div className="rounded-3xl border border-border bg-card/70 p-6 backdrop-blur md:p-10">
          {sent ? (
            <div className="text-center">
              <span className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-full bg-primary/15 text-primary">
                <CheckCircle2 className="h-8 w-8" />
              </span>
              <h1 className="mt-4 font-display text-2xl font-bold text-foreground">
                {t("contact.successTitle")}
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">{t("contact.successMsg")}</p>
              <div className="mt-6 flex flex-col items-center gap-2 sm:flex-row sm:justify-center">
                <button onClick={() => setSent(false)}>
                  <PillButton variant="secondary">{t("contact.sendAnother")}</PillButton>
                </button>
                <Link to="/">
                  <PillButton variant="primary">{t("common.back_home")}</PillButton>
                </Link>
              </div>
            </div>
          ) : (
            <>
              <div>
                <h1 className="font-display text-3xl font-bold text-foreground">{t("contact.title")}</h1>
                <p className="mt-2 text-sm text-muted-foreground">{t("contact.subtitle")}</p>
              </div>
              <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4">
                {/* Honeypot */}
                <input
                  type="text"
                  tabIndex={-1}
                  autoComplete="off"
                  aria-hidden="true"
                  className="absolute -left-[9999px] h-0 w-0 opacity-0"
                  {...register("hp")}
                />
                <DarkInput
                  id="nome"
                  label={t("contact.name")}
                  autoComplete="name"
                  error={errors.nome?.message ? t(errors.nome.message) : undefined}
                  {...register("nome")}
                />
                <DarkInput
                  id="email"
                  type="email"
                  label={t("contact.email")}
                  autoComplete="email"
                  error={errors.email?.message ? t(errors.email.message) : undefined}
                  {...register("email")}
                />
                <DarkInput
                  id="assunto"
                  label={t("contact.subject")}
                  error={errors.assunto?.message ? t(errors.assunto.message) : undefined}
                  {...register("assunto")}
                />
                <div className="space-y-1.5">
                  <label htmlFor="mensagem" className="block text-xs font-medium text-muted-foreground">
                    {t("contact.message")}
                  </label>
                  <textarea
                    id="mensagem"
                    rows={5}
                    className="w-full rounded-2xl border border-border bg-card px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/60 outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/30"
                    {...register("mensagem")}
                  />
                  {errors.mensagem?.message && (
                    <p className="text-xs text-destructive">{t(errors.mensagem.message)}</p>
                  )}
                </div>
                {serverError && <p className="text-sm text-destructive">{serverError}</p>}
                <PillButton type="submit" fullWidth disabled={submitting}>
                  {submitting ? t("contact.sending") : t("contact.send")}
                </PillButton>
              </form>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
