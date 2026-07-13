// Maps Brazilian state names to their 2-letter UF code.
// Accepts full names in any case; returns UF when known, otherwise the input trimmed
// (or the input as-is if already 2 letters).

const MAP: Record<string, string> = {
  acre: "AC",
  alagoas: "AL",
  amapa: "AP",
  amazonas: "AM",
  bahia: "BA",
  ceara: "CE",
  "distrito federal": "DF",
  "espirito santo": "ES",
  goias: "GO",
  maranhao: "MA",
  "mato grosso": "MT",
  "mato grosso do sul": "MS",
  "minas gerais": "MG",
  para: "PA",
  paraiba: "PB",
  parana: "PR",
  pernambuco: "PE",
  piaui: "PI",
  "rio de janeiro": "RJ",
  "rio grande do norte": "RN",
  "rio grande do sul": "RS",
  rondonia: "RO",
  roraima: "RR",
  "santa catarina": "SC",
  "sao paulo": "SP",
  sergipe: "SE",
  tocantins: "TO",
};

function stripAccents(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export function toUF(estado: string | null | undefined): string {
  if (!estado) return "";
  const raw = estado.trim();
  if (!raw) return "";
  if (raw.length === 2) return raw.toUpperCase();
  const key = stripAccents(raw.toLowerCase());
  return MAP[key] ?? raw;
}
