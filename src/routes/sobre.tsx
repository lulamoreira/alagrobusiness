import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { PublicShell } from "@/components/PublicShell";

export const Route = createFileRoute("/sobre")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Sobre — AGROBUSINESS" },
      { name: "description", content: "Conheça o AGROBUSINESS, o marketplace do agronegócio brasileiro." },
    ],
  }),
  component: SobrePage,
});

function SobrePage() {
  const { t } = useTranslation();
  const paragraphs = [1, 2, 3] as const;
  return (
    <PublicShell>
      <article className="mx-auto max-w-3xl px-4 py-16 sm:px-6 md:py-24">
        <header className="mb-10">
          <h1 className="font-display text-4xl font-bold text-foreground md:text-5xl">{t("about.title")}</h1>
          <p className="mt-3 text-muted-foreground">{t("about.subtitle")}</p>
        </header>
        <div className="space-y-5 text-base leading-relaxed text-muted-foreground">
          {paragraphs.map((i) => (
            <p key={i}>{t(`about.p${i}`)}</p>
          ))}
        </div>

        <section className="mt-14 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {(["mission", "vision", "values"] as const).map((v) => (
            <div key={v} className="rounded-2xl border border-border bg-card/60 p-6 backdrop-blur">
              <h3 className="font-display text-lg font-semibold text-foreground">{t(`about.${v}.title`)}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{t(`about.${v}.desc`)}</p>
            </div>
          ))}
        </section>
      </article>
    </PublicShell>
  );
}
