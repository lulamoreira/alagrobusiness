import type { TFunction } from "i18next";

/**
 * Renders a title/message stored as "i18nKey::arg1::arg2..." OR free text.
 * Shared between the NotificationBell and the Alerts page.
 */
export function formatNotifText(
  raw: string | null | undefined,
  t: TFunction,
): string {
  if (!raw) return "";
  if (!raw.includes("::")) return t(raw, { defaultValue: raw }) as string;
  const [key, ...args] = raw.split("::");
  if (key === "alerts.notif.commodityTitle") {
    const [product, condition, value, currency] = args;
    return t(key, {
      product: t(`commodities.${product}`, { defaultValue: product }),
      condition: t(`alerts.${condition === "acima" ? "above" : "below"}`),
      value: Number(value),
      currency,
    }) as string;
  }
  if (key === "alerts.notif.dolarTitle") {
    const [type, condition, value, currency] = args;
    return t(key, {
      type: t(`quote.${type}`, { defaultValue: type }),
      condition: t(`alerts.${condition === "acima" ? "above" : "below"}`),
      value: Number(value),
      currency,
    }) as string;
  }
  if (key === "alerts.notif.message") {
    const [current, currency] = args;
    return t(key, { current: Number(current), currency }) as string;
  }
  return raw;
}

export function formatNotifType(tipo: string | null | undefined, t: TFunction): string {
  const key = `notifications.type.${tipo ?? "default"}`;
  return t(key, { defaultValue: t("notifications.type.default") }) as string;
}
