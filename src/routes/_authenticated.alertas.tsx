import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

function Soon() {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <div className="text-center">
        <div className="mb-3 inline-block rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold uppercase text-primary">
          {t("placeholders.soon")}
        </div>
        <p className="text-sm text-muted-foreground">{t("placeholders.soonDesc")}</p>
      </div>
    </div>
  );
}

export const Route = createFileRoute("/_authenticated/alertas")({ component: Soon });
