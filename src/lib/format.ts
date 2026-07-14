type DolarRow = { tipo: "comercial" | "turismo" | "paralelo"; valor_brl: number };
type Moeda = "BRL" | "USD" | "EUR";
type TipoDolar = "comercial" | "turismo" | "paralelo";

/** Linha de câmbio consultada em public.cotacoes_cambio (USD/EUR → BRL). */
export type CambioRow = { moeda: "USD" | "EUR"; valor_brl: number };

/** Converte valor em qualquer moeda para BRL usando cotacoes_cambio. Retorna null se faltar taxa. */
export function toBRL(valor: number, moeda: Moeda, cambio: CambioRow[] | null | undefined): number | null {
  if (moeda === "BRL") return valor;
  const row = cambio?.find((c) => c.moeda === moeda);
  if (!row || !(row.valor_brl > 0)) return null;
  return valor * Number(row.valor_brl);
}

/** Converte de BRL para a moeda alvo. Retorna null se faltar taxa. */
export function fromBRL(valorBRL: number, moeda: Moeda, cambio: CambioRow[] | null | undefined): number | null {
  if (moeda === "BRL") return valorBRL;
  const row = cambio?.find((c) => c.moeda === moeda);
  if (!row || !(row.valor_brl > 0)) return null;
  return valorBRL / Number(row.valor_brl);
}

/**
 * Formata um preço convertendo da moeda de origem (ex.: moeda do anúncio) para a
 * moeda de exibição preferida do usuário. Se faltar alguma taxa necessária,
 * degrada exibindo na MOEDA ORIGINAL do anúncio (nunca fingindo que é BRL).
 */
export function formatPrice(
  preco: number | null | undefined,
  precoMoeda: Moeda,
  displayMoeda: Moeda,
  cambio: CambioRow[] | null | undefined,
  locale = "pt-BR",
): string {
  if (preco == null || isNaN(preco)) return "—";
  const brl = toBRL(preco, precoMoeda, cambio);
  if (brl == null) {
    // Degrada: sem taxa para converter a origem → mostra na moeda do anúncio
    return new Intl.NumberFormat(locale, { style: "currency", currency: precoMoeda }).format(preco);
  }
  const out = fromBRL(brl, displayMoeda, cambio);
  if (out == null) {
    // Degrada: sem taxa para a moeda de destino → mostra na moeda do anúncio
    return new Intl.NumberFormat(locale, { style: "currency", currency: precoMoeda }).format(preco);
  }
  return new Intl.NumberFormat(locale, { style: "currency", currency: displayMoeda }).format(out);
}



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
