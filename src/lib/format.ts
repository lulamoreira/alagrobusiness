type DolarRow = { tipo: "comercial" | "turismo" | "paralelo"; valor_brl: number };

export function formatMoney(
  valorBRL: number | null | undefined,
  moeda: "BRL" | "USD" | "EUR",
  tipoDolar: "comercial" | "turismo" | "paralelo",
  cotacoes: DolarRow[] | null | undefined,
  locale = "pt-BR",
): string {
  if (valorBRL == null || isNaN(valorBRL)) return "—";
  const brl = (v: number) =>
    new Intl.NumberFormat(locale, { style: "currency", currency: "BRL" }).format(v);
  if (moeda === "BRL") return brl(valorBRL);

  if (moeda === "USD") {
    const row = cotacoes?.find((c) => c.tipo === tipoDolar);
    if (row && row.valor_brl > 0) {
      return new Intl.NumberFormat(locale, { style: "currency", currency: "USD" }).format(
        valorBRL / Number(row.valor_brl),
      );
    }
    return `${brl(valorBRL)} (BRL)`;
  }

  // EUR — sem fonte nesta fase, degrada para BRL
  return `${brl(valorBRL)} (BRL)`;
}

export function formatDolarValue(valor: number, locale = "pt-BR") {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
  }).format(valor);
}
