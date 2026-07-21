import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { PublicShell } from "@/components/PublicShell";
import { AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/privacidade")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Política de Privacidade — Entreposto Virtual" },
      { name: "description", content: "Política de Privacidade do Entreposto Virtual." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PrivacidadePage,
});

function PrivacidadePage() {
  const { t } = useTranslation();
  const sections = [1, 2, 3, 4, 5, 6] as const;
  return (
    <PublicShell>
      <article className="mx-auto max-w-3xl px-4 py-16 sm:px-6 md:py-24">
        <header className="mb-8">
          <h1 className="font-display text-4xl font-bold text-foreground md:text-5xl">{t("legal.privacy.title")}</h1>
          <p className="mt-3 text-sm text-muted-foreground">{t("legal.updatedAt")}</p>
        </header>

        <div className="mb-8 flex items-start gap-3 rounded-2xl border border-primary/40 bg-primary/10 p-4 text-sm text-foreground">
          <AlertTriangle className="mt-0.5 h-5 w-5 flex-none text-primary" />
          <p>{t("legal.draftNotice")}</p>
        </div>

        <div className="space-y-8 text-base leading-relaxed text-muted-foreground">
          {sections.map((i) => (
            <section key={i}>
              <h2 className="mb-2 font-display text-xl font-semibold text-foreground">
                {t(`legal.privacy.s${i}.title`)}
              </h2>
              <p>{t(`legal.privacy.s${i}.body`)}</p>
            </section>
          ))}
        </div>
      </article>
    </PublicShell>
  );
}
