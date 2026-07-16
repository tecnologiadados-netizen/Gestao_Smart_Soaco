/** Normaliza rótulos de representante para comparação (sem acento, maiúsculas). */
export function normalizeRepresentanteLabel(value: string): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

/** Representantes que a Nomus marca como representante, mas não devem entrar no RH. */
export const ORGANICO_REPRESENTANTES_NEGADOS_RAW = [
  "IDELGASTO ALVES CAMPELO",
  "SÓ MÓVEIS LTDA ( para emissao de pedidos loja )",
  "T R P PEREIRA REPRESENTAÇÕES - ME",
  "Teresa Cristina Cruz de Sousa Pinto",
  "W B MARQUES - ME",
  "XTC HOSPITALAR COMERCIO E INSTRUMENTO HOSPITALARES",
  "Antonio carlos de medeiros costa",
  "DANILO CALACA DE SOUSA",
  "F S REPRESENTAÇÕES",
  "F.S. Representações e Comércio Ltda - Me",
  "FRANCISCO DAS CHAGAS MARQUES DE ARAUJO FILHO",
  "FRANCISCO DE ALENCAR SOBRINHO",
  "HOHNEER ELETRONICA LTDA",
  "JOSE NETO ARAUJO DE OLIVEIRA",
  "KLEBER REPRESENTACOES LTDA - ME",
  "MARCONIO DA SILVA RIBEIRO",
  "MARLON OLIVEIRA FERREIRA",
  "MARTINS COMERCIO E SERVICOS DE DISTRIBUICAO S/A",
  "MAX REPRESENTAÇÕES",
  "MIRIAM DA SILVA NEPOMUCENO",
  "OLISAN REPRESENTACAO LTDA",
  "P. DOS SANTOS MORENO REPRESENTACOES",
  "RM REPRESENTANTE COMERCIAL MOVELEIRO LTDA",
  "Rodrigo Bruna de Campos Mendes",
  "SO ACO INDUSTRIAL LTDA",
] as const;

const ORGANICO_REPRESENTANTES_NEGADOS = new Set(
  ORGANICO_REPRESENTANTES_NEGADOS_RAW.map((item) => normalizeRepresentanteLabel(item)),
);

export function isOrganicoRepresentanteNegado(nomeFantasia: string, nomeRazaoSocial: string): boolean {
  const labels = [nomeFantasia, nomeRazaoSocial]
    .map((item) => normalizeRepresentanteLabel(item))
    .filter(Boolean);
  if (labels.length === 0) return true;
  return labels.some((label) => ORGANICO_REPRESENTANTES_NEGADOS.has(label));
}

export function shouldIncludeOrganicoRepresentante(nomeFantasia: string, nomeRazaoSocial: string): boolean {
  const fantasia = String(nomeFantasia ?? "").trim();
  const razao = String(nomeRazaoSocial ?? "").trim();
  if (!fantasia && !razao) return false;
  return !isOrganicoRepresentanteNegado(fantasia, razao);
}

export function buildRepresentanteKey(nomeFantasia: string, nomeRazaoSocial: string): string {
  const razao = String(nomeRazaoSocial ?? "").trim();
  const fantasia = String(nomeFantasia ?? "").trim();
  return normalizeRepresentanteLabel(razao || fantasia);
}

export function resolveRepresentanteDisplayName(nomeFantasia: string, nomeRazaoSocial: string): string {
  const fantasia = String(nomeFantasia ?? "").trim();
  const razao = String(nomeRazaoSocial ?? "").trim();
  return fantasia || razao;
}

/** Mantém nome fantasia e razão social separados (Nomus: `nome` vs `nomeRazaoSocial`). */
export function splitRepresentanteNames(input: {
  nome?: string | null;
  nomeFantasia?: string | null;
  nomeRazaoSocial?: string | null;
}): { nome: string; nomeRazaoSocial: string } {
  const fantasia = String(input.nome ?? input.nomeFantasia ?? "").trim();
  const razao = String(input.nomeRazaoSocial ?? "").trim();

  if (fantasia && razao) {
    return { nome: fantasia, nomeRazaoSocial: razao };
  }

  const unico = razao || fantasia;
  return { nome: fantasia || razao, nomeRazaoSocial: unico };
}

export function representanteNomesDistintos(nome: string, nomeRazaoSocial: string): boolean {
  const fantasia = String(nome ?? "").trim();
  const razao = String(nomeRazaoSocial ?? "").trim();
  if (!fantasia || !razao) return false;
  return normalizeRepresentanteLabel(fantasia) !== normalizeRepresentanteLabel(razao);
}
