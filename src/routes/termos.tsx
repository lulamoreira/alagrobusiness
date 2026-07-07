import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { PublicShell } from "@/components/PublicShell";
import { AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/termos")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Termos de Uso — AGROBUSINESS" },
      { name: "description", content: "Termos de Uso do AGROBUSINESS." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: TermosPage,
});

function TermosPage() {
  const { t } = useTranslation();
  const sections = [1, 2, 3, 4, 5, 6] as const;
  return (
    <PublicShell>
      <article className="mx-auto max-w-3xl px-4 py-16 sm:px-6 md:py-24">
        <header className="mb-8">
          <h1 className="font-display text-4xl font-bold text-foreground md:text-5xl">{t("legal.terms.title")}</h1>
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
                {t(`legal.terms.s${i}.title`)}
              </h2>
              <p>{t(`legal.terms.s${i}.body`)}</p>
            </section>
          ))}
        </div>
      </article>
    </PublicShell>
  );
}
