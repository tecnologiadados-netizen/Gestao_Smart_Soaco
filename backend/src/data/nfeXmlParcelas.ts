/**
 * Parcelas da NF-e a partir do XML (cobr/dup) e da resposta do conferente
 * quando a nota não traz fatura.
 */

export type OrigemParcelasNf =
  | 'nomus'
  | 'xml'
  | 'ja_paga'
  | 'boleto_externo'
  | 'pendente'
  | 'sem_xml';

export type ParcelaXml = {
  numero: number;
  dataVencimento: string;
  valor: number;
  /** true = já paga; false = ainda a vencer. Só no lançamento completo do conferente. */
  paga?: boolean;
};

export type ParcelaPrazoXml = {
  numero: number;
  dataBase: string | null;
  dataVencimento: string | null;
  dias: number | null;
  valor: number | null;
  /** true = já paga; false = ainda a vencer. */
  paga?: boolean | null;
};

export type RespostaPagamentoUsuario = {
  situacao: 'ja_paga' | 'boleto_externo';
  parcelas: ParcelaXml[];
  condicaoPagamento?: string | null;
  formaPagamento?: string | null;
  /** Texto de condicaopagamento.regra, como 30,60,90 ou 0 50%,15 50%. */
  regra?: string | null;
  /** Dia de onde os prazos são contados. Sem valor, vale a emissão da NF. */
  dataBase?: string | null;
};

export type NfeXmlPagamento = {
  dhEmi: string | null;
  vNF: number | null;
  temFatura: boolean;
  dups: ParcelaXml[];
};

export type PagamentoPreEntradaResolvido = {
  origem: OrigemParcelasNf;
  pendente: boolean;
  dataBase: string | null;
  condicao: string | null;
  regra: string | null;
  formaPagamento: string | null;
  parcelas: ParcelaPrazoXml[];
  valorNf: number | null;
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function xmlLegivel(xml: string): string {
  const s = xml.trim();
  if (s.includes('<dup>') || s.includes('<pag>') || s.includes('<nNF>') || s.includes('<ide>')) {
    return s;
  }
  if (!s.includes('&lt;')) return s;
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&');
}

function tagValor(bloco: string, nome: string): string | null {
  const m = bloco.match(new RegExp(`<${nome}>([^<]*)</${nome}>`));
  const v = m?.[1]?.trim();
  return v ? v : null;
}

export function ymdDeDataXml(v: string | null | undefined): string | null {
  if (!v) return null;
  const m = String(v).match(/(\d{4}-\d{2}-\d{2})/);
  return m && DATE_RE.test(m[1]) ? m[1] : null;
}

function numeroXml(v: string | null): number | null {
  if (v == null || v.trim() === '') return null;
  const n = Number(v.trim().replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

export function diasEntreYmdXml(base: string | null, venc: string | null): number | null {
  if (!base || !venc) return null;
  const da = Date.parse(`${base}T12:00:00Z`);
  const db = Date.parse(`${venc}T12:00:00Z`);
  if (!Number.isFinite(da) || !Number.isFinite(db)) return null;
  return Math.round((db - da) / 86400000);
}

export function extrairPagamentoXmlNfe(xml: string | null | undefined): NfeXmlPagamento {
  const vazio: NfeXmlPagamento = { dhEmi: null, vNF: null, temFatura: false, dups: [] };
  if (!xml || !xml.trim()) return vazio;
  const texto = xmlLegivel(xml);
  const dhEmi = ymdDeDataXml(tagValor(texto, 'dhEmi') ?? tagValor(texto, 'dEmi'));
  const vNF = numeroXml(tagValor(texto, 'vNF'));
  const dups: ParcelaXml[] = [];
  for (const m of texto.matchAll(/<dup>([\s\S]*?)<\/dup>/g)) {
    const bloco = m[1] ?? '';
    const dataVencimento = ymdDeDataXml(tagValor(bloco, 'dVenc'));
    const valor = numeroXml(tagValor(bloco, 'vDup'));
    if (!dataVencimento || valor == null) continue;
    const nDup = Number(String(tagValor(bloco, 'nDup') ?? '').replace(/\D/g, ''));
    dups.push({
      numero: Number.isFinite(nDup) && nDup > 0 ? nDup : dups.length + 1,
      dataVencimento,
      valor,
    });
  }
  dups.sort((a, b) => a.numero - b.numero || a.dataVencimento.localeCompare(b.dataVencimento));
  dups.forEach((d, i) => {
    d.numero = i + 1;
  });
  return { dhEmi, vNF, temFatura: dups.length > 0, dups };
}

function parcelaPrazo(
  numero: number,
  dataBase: string | null,
  dataVencimento: string | null,
  valor: number | null,
  diasForcado?: number,
  paga?: boolean | null
): ParcelaPrazoXml {
  return {
    numero,
    dataBase,
    dataVencimento,
    dias: diasForcado ?? diasEntreYmdXml(dataBase, dataVencimento),
    valor,
    paga: paga ?? null,
  };
}

function textoPreenchido(v: string | null | undefined): string | null {
  const s = (v ?? '').trim();
  return s ? s : null;
}

/** O boleto externo só vale quando a condição inteira foi lançada e classificada. */
export function motivoLancamentoBoletoIncompleto(params: {
  condicaoPagamento?: string | null;
  formaPagamento?: string | null;
  regra?: string | null;
  parcelas: { valor?: number; paga?: boolean | null }[];
}): string | null {
  if (!textoPreenchido(params.condicaoPagamento)) return 'Informe a condição de pagamento.';
  if (!textoPreenchido(params.formaPagamento)) return 'Informe a forma de pagamento.';
  if (!textoPreenchido(params.regra)) return 'Informe a regra para gerar parcelas.';
  if (params.parcelas.length === 0) return 'Lance todas as parcelas da condição.';
  if (params.parcelas.some((p) => p.paga !== true && p.paga !== false)) {
    return 'Classifique cada parcela como já paga ou ainda a vencer.';
  }
  if (!params.parcelas.some((p) => p.paga === false)) {
    return 'Se todas as parcelas já foram pagas, marque Já foi paga.';
  }
  return null;
}

export function resolverParcelasPreEntrada(params: {
  xml: string | null | undefined;
  resposta: RespostaPagamentoUsuario | null;
  dataBaseDocumento: string | null;
}): PagamentoPreEntradaResolvido {
  const extraido = extrairPagamentoXmlNfe(params.xml);
  const temXml = Boolean(params.xml && params.xml.trim());
  const dataBase = extraido.dhEmi ?? params.dataBaseDocumento;

  if (!temXml) {
    return {
      origem: 'sem_xml',
      pendente: true,
      dataBase,
      condicao: null,
      regra: null,
      formaPagamento: null,
      parcelas: [],
      valorNf: null,
    };
  }

  if (extraido.temFatura) {
    const parcelas = extraido.dups.map((d, i) =>
      parcelaPrazo(i + 1, dataBase, d.dataVencimento, d.valor)
    );
    return {
      origem: 'xml',
      pendente: false,
      dataBase,
      condicao: 'Fatura da NF',
      regra: null,
      formaPagamento: null,
      parcelas,
      valorNf: extraido.vNF,
    };
  }

  if (params.resposta?.situacao === 'ja_paga') {
    return {
      origem: 'ja_paga',
      pendente: false,
      dataBase,
      condicao: 'À vista',
      regra: '0',
      formaPagamento: null,
      parcelas: [parcelaPrazo(1, dataBase, dataBase, extraido.vNF, 0, true)],
      valorNf: extraido.vNF,
    };
  }

  if (params.resposta?.situacao === 'boleto_externo' && params.resposta.parcelas.length > 0) {
    const ordenadas = [...params.resposta.parcelas].sort((a, b) =>
      a.dataVencimento.localeCompare(b.dataVencimento)
    );
    const completa =
      motivoLancamentoBoletoIncompleto(params.resposta) == null &&
      somaParcelasFechaValorNf(ordenadas, extraido.vNF);
    const dataBaseInformada = textoPreenchido(params.resposta.dataBase)?.slice(0, 10) ?? '';
    const dataBaseBoleto = /^\d{4}-\d{2}-\d{2}$/.test(dataBaseInformada) ? dataBaseInformada : dataBase;
    return {
      origem: completa ? 'boleto_externo' : 'pendente',
      pendente: !completa,
      dataBase: dataBaseBoleto,
      condicao: textoPreenchido(params.resposta.condicaoPagamento),
      regra: textoPreenchido(params.resposta.regra),
      formaPagamento: textoPreenchido(params.resposta.formaPagamento),
      parcelas: ordenadas.map((p, i) =>
        parcelaPrazo(i + 1, dataBaseBoleto, p.dataVencimento, p.valor, undefined, p.paga ?? null)
      ),
      valorNf: extraido.vNF,
    };
  }

  return {
    origem: 'pendente',
    pendente: true,
    dataBase,
    condicao: null,
    regra: null,
    formaPagamento: null,
    parcelas: [],
    valorNf: extraido.vNF,
  };
}

export function centavos(n: number): number {
  return Math.round((n + Number.EPSILON) * 100);
}

export function somaParcelasFechaValorNf(parcelas: { valor: number }[], vNF: number | null): boolean {
  if (vNF == null) return true;
  const soma = parcelas.reduce((s, p) => s + centavos(p.valor), 0);
  return soma === centavos(vNF);
}
