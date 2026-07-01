type DolarRow = { tipo: "comercial" | "turismo" | "paralelo"; valor_brl: number };
type Moeda = "BRL" | "USD" | "EUR";
type TipoDolar = "comercial" | "turismo" | "paralelo";

/** Converte um valor em BRL para a moeda alvo do usuário. Retorna { value, currency } ou null se degradado. */
function convertToUserCurrency(
  valorBRL: number,
  moeda: Moeda,
  tipoDolar: TipoDolar,
  cotacoes: DolarRow[] | null | undefined,
): { value: number; currency: "BRL" | "USD" } | null {
  if (moeda === "BRL") return { value: valorBRL, currency: "BRL" };
  if (moeda === "USD") {
    const row = cotacoes?.find((c) => c.tipo === tipoDolar);
    if (row && row.valor_brl > 0) return { value: valorBRL / Number(row.valor_brl), currency: "USD" };
    return null;
  }
  // EUR sem fonte: degrada
  return null;
}

export function formatMoney(
  valorBRL: number | null | undefined,
  moeda: Moeda,
  tipoDolar: TipoDolar,
  cotacoes: DolarRow[] | null | undefined,
  locale = "pt-BR",
): string {
  if (valorBRL == null || isNaN(valorBRL)) return "—";
  const brl = (v: number) =>
    new Intl.NumberFormat(locale, { style: "currency", currency: "BRL" }).format(v);
  const conv = convertToUserCurrency(valorBRL, moeda, tipoDolar, cotacoes);
  if (!conv) return `${brl(valorBRL)} (BRL)`;
  return new Intl.NumberFormat(locale, { style: "currency", currency: conv.currency }).format(
    conv.value,
  );
}

/**
 * Formato compacto para KPIs (evita estouro em cards).
 * Abaixo de 100 mil (no valor exibido), usa formato cheio.
 * Acima, usa notation: 'compact' → "R$ 97,5 mil", "R$ 1,2 mi", "US$ 3,4 bi".
 */
export function formatMoneyCompact(
  valorBRL: number | null | undefined,
  moeda: Moeda,
  tipoDolar: TipoDolar,
  cotacoes: DolarRow[] | null | undefined,
  locale = "pt-BR",
): string {
  if (valorBRL == null || isNaN(valorBRL)) return "—";
  const conv = convertToUserCurrency(valorBRL, moeda, tipoDolar, cotacoes);
  if (!conv) {
    // degrada — usa BRL cheio (small values fit)
    const brl = new Intl.NumberFormat(locale, { style: "currency", currency: "BRL" }).format(valorBRL);
    return `${brl} (BRL)`;
  }
  const abs = Math.abs(conv.value);
  if (abs < 1_000_000) {
    return new Intl.NumberFormat(locale, { style: "currency", currency: conv.currency }).format(
      conv.value,
    );
  }
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: conv.currency,
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(conv.value);
}

export function formatDolarValue(valor: number, locale = "pt-BR") {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
  }).format(valor);
}
