import { createHash } from 'crypto';
import https from 'https';
import QRCode from 'qrcode';
import { assinarInfNfe, type CertificadoAberto } from './certificado.js';
import { codigoUf, urlAutorizacao, urlQrCode } from './sefaz.js';

export type ItemNota = {
  codigo: string;
  descricao: string;
  ncm: string;
  origem: string;
  unidade: string;
  quantidade: number;
  valorUnitario: number;
  desconto: number;
  aliquotaIpi: number;
};

export type EmitenteNota = {
  cnpj: string;
  nome: string;
  fantasia: string;
  ie: string;
  crt: string;
  logradouro: string;
  numero: string;
  bairro: string;
  municipio: string;
  cMun: string;
  uf: string;
  cep: string;
};

export type DestinatarioNota = {
  documento: string;
  nome: string;
  ie: string;
  uf: string;
  contribuinte: boolean;
} | null;

function xml(v: string): string {
  return v
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function dec(n: number, casas = 2): string {
  return (Number.isFinite(n) ? n : 0).toFixed(casas);
}

function digitos(v: string, tam: number): string {
  return v.replace(/\D/g, '').padStart(tam, '0').slice(-tam);
}

function dvChave(chave43: string): string {
  let peso = 2;
  let soma = 0;
  for (let i = chave43.length - 1; i >= 0; i--) {
    soma += Number(chave43[i]) * peso;
    peso = peso === 9 ? 2 : peso + 1;
  }
  const resto = soma % 11;
  return String(resto < 2 ? 0 : 11 - resto);
}

function crtCodigo(crt: string): string {
  const codigo = crt.trim().match(/^[1-4]/)?.[0];
  return codigo ?? '1';
}

export async function emitirNota(input: {
  modelo: '55' | '65';
  ambiente: 'homologacao' | 'producao';
  serie: number;
  numero: number;
  emitente: EmitenteNota;
  destinatario: DestinatarioNota;
  itens: ItemNota[];
  pagamentos: { tPag: string; valor: number }[];
  certificado: CertificadoAberto;
  cscId: string;
  csc: string;
}): Promise<{ autorizado: boolean; chave: string; protocolo: string; motivo: string; xml: string; qrDataUrl: string }> {
  const uf = input.emitente.uf || 'PI';
  const cUF = codigoUf(uf);
  const tpAmb = input.ambiente === 'producao' ? '1' : '2';
  const agora = new Date();
  const aamm = `${String(agora.getFullYear()).slice(2)}${String(agora.getMonth() + 1).padStart(2, '0')}`;
  const cnpj = digitos(input.certificado.cnpj || input.emitente.cnpj, 14);
  const cNF = String(Math.floor(Math.random() * 1e8)).padStart(8, '0');
  const base =
    cUF +
    aamm +
    cnpj +
    input.modelo +
    digitos(String(input.serie), 3) +
    digitos(String(input.numero), 9) +
    '1' +
    cNF;
  const chave = base + dvChave(base);
  const dh = agora.toISOString().replace(/\.\d{3}Z$/, '-03:00');

  let vProd = 0;
  let vDesc = 0;
  let vIpi = 0;
  const dets = input.itens.map((item, idx) => {
    const bruto = item.quantidade * item.valorUnitario;
    const desc = Math.min(bruto, item.desconto);
    const liquido = bruto - desc;
    const ipi = liquido * (item.aliquotaIpi / 100);
    vProd += bruto;
    vDesc += desc;
    vIpi += ipi;
    const xProd =
      input.ambiente === 'homologacao' && idx === 0
        ? 'NF-E EMITIDA EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL'
        : item.descricao || item.codigo;
    const origem = digitos(item.origem || '0', 1).slice(-1) || '0';
    return (
      `<det nItem="${idx + 1}"><prod>` +
      `<cProd>${xml(item.codigo || String(idx + 1))}</cProd>` +
      `<cEAN>SEM GTIN</cEAN>` +
      `<xProd>${xml(xProd.slice(0, 120))}</xProd>` +
      `<NCM>${digitos(item.ncm || '00000000', 8)}</NCM>` +
      `<CFOP>${input.modelo === '65' ? '5102' : '5102'}</CFOP>` +
      `<uCom>${xml(item.unidade || 'UN')}</uCom>` +
      `<qCom>${dec(item.quantidade, 4)}</qCom>` +
      `<vUnCom>${dec(item.valorUnitario, 10)}</vUnCom>` +
      `<vProd>${dec(bruto)}</vProd>` +
      `<cEANTrib>SEM GTIN</cEANTrib>` +
      `<uTrib>${xml(item.unidade || 'UN')}</uTrib>` +
      `<qTrib>${dec(item.quantidade, 4)}</qTrib>` +
      `<vUnTrib>${dec(item.valorUnitario, 10)}</vUnTrib>` +
      (desc > 0 ? `<vDesc>${dec(desc)}</vDesc>` : '') +
      `<indTot>1</indTot></prod><imposto>` +
      `<ICMS><ICMSSN102><orig>${origem}</orig><CSOSN>102</CSOSN></ICMSSN102></ICMS>` +
      (item.aliquotaIpi > 0
        ? `<IPI><cEnq>999</cEnq><IPITrib><CST>50</CST><vBC>${dec(liquido)}</vBC><pIPI>${dec(item.aliquotaIpi)}</pIPI><vIPI>${dec(ipi)}</vIPI></IPITrib></IPI>`
        : `<IPI><cEnq>999</cEnq><IPINT><CST>53</CST></IPINT></IPI>`) +
      `<PIS><PISNT><CST>07</CST></PISNT></PIS>` +
      `<COFINS><COFINSNT><CST>07</CST></COFINSNT></COFINS>` +
      `</imposto></det>`
    );
  });

  const vNF = vProd - vDesc + vIpi;
  const pagamentos = input.pagamentos.length
    ? input.pagamentos
    : [{ tPag: '01', valor: vNF }];
  const detPag = pagamentos
    .map((p) => `<detPag><tPag>${digitos(p.tPag || '01', 2)}</tPag><vPag>${dec(p.valor)}</vPag></detPag>`)
    .join('');

  const dest = input.destinatario
    ? `<dest>` +
      (input.destinatario.documento.replace(/\D/g, '').length > 11
        ? `<CNPJ>${digitos(input.destinatario.documento, 14)}</CNPJ>`
        : `<CPF>${digitos(input.destinatario.documento, 11)}</CPF>`) +
      `<xNome>${xml((input.ambiente === 'homologacao' ? 'NF-E EMITIDA EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL' : input.destinatario.nome).slice(0, 60))}</xNome>` +
      `<indIEDest>${input.destinatario.contribuinte ? '1' : '9'}</indIEDest>` +
      (input.destinatario.contribuinte && input.destinatario.ie ? `<IE>${xml(input.destinatario.ie)}</IE>` : '') +
      `</dest>`
    : input.modelo === '65'
      ? ''
      : '';

  const inf =
    `<infNFe Id="NFe${chave}" versao="4.00">` +
    `<ide><cUF>${cUF}</cUF><cNF>${cNF}</cNF><natOp>VENDA</natOp><mod>${input.modelo}</mod>` +
    `<serie>${input.serie}</serie><nNF>${input.numero}</nNF><dhEmi>${dh}</dhEmi>` +
    `<tpNF>1</tpNF><idDest>1</idDest><cMunFG>${digitos(input.emitente.cMun || '2211001', 7)}</cMunFG>` +
    `<tpImp>${input.modelo === '65' ? '4' : '1'}</tpImp><tpEmis>1</tpEmis><cDV>${chave.slice(-1)}</cDV>` +
    `<tpAmb>${tpAmb}</tpAmb><finNFe>1</finNFe><indFinal>${input.modelo === '65' ? '1' : '0'}</indFinal>` +
    `<indPres>1</indPres><procEmi>0</procEmi><verProc>GestaoSmartPDV</verProc></ide>` +
    `<emit><CNPJ>${cnpj}</CNPJ><xNome>${xml(input.emitente.nome.slice(0, 60))}</xNome>` +
    `<enderEmit><xLgr>${xml(input.emitente.logradouro || 'NAO INFORMADO')}</xLgr>` +
    `<nro>${xml(input.emitente.numero || 'S/N')}</nro><xBairro>${xml(input.emitente.bairro || 'CENTRO')}</xBairro>` +
    `<cMun>${digitos(input.emitente.cMun || '2211001', 7)}</cMun><xMun>${xml(input.emitente.municipio || 'TERESINA')}</xMun>` +
    `<UF>${xml(uf)}</UF><CEP>${digitos(input.emitente.cep || '64000000', 8)}</CEP><cPais>1058</cPais><xPais>BRASIL</xPais></enderEmit>` +
    `<IE>${xml(input.emitente.ie || 'ISENTO')}</IE><CRT>${crtCodigo(input.emitente.crt)}</CRT></emit>` +
    dest +
    dets.join('') +
    `<total><ICMSTot><vBC>0.00</vBC><vICMS>0.00</vICMS><vICMSDeson>0.00</vICMSDeson><vFCP>0.00</vFCP>` +
    `<vBCST>0.00</vBCST><vST>0.00</vST><vFCPST>0.00</vFCPST><vFCPSTRet>0.00</vFCPSTRet>` +
    `<vProd>${dec(vProd)}</vProd><vFrete>0.00</vFrete><vSeg>0.00</vSeg><vDesc>${dec(vDesc)}</vDesc><vII>0.00</vII>` +
    `<vIPI>${dec(vIpi)}</vIPI><vIPIDevol>0.00</vIPIDevol><vPIS>0.00</vPIS><vCOFINS>0.00</vCOFINS><vOutro>0.00</vOutro>` +
    `<vNF>${dec(vNF)}</vNF></ICMSTot></total>` +
    `<transp><modFrete>9</modFrete></transp>` +
    `<pag>${detPag}</pag>` +
    `</infNFe>`;

  const assinatura = assinarInfNfe(inf, `NFe${chave}`, input.certificado.certPem, input.certificado.keyPem);
  let supl = '';
  let qrTexto = '';
  if (input.modelo === '65') {
    const urls = urlQrCode(uf, input.ambiente);
    const semHash = `${chave}|2|${tpAmb}|${input.cscId || '1'}`;
    const hash = createHash('sha1')
      .update(semHash + (input.csc || ''))
      .digest('hex');
    qrTexto = `${urls.qr}?p=${semHash}|${hash}`;
    supl = `<infNFeSupl><qrCode>${xml(qrTexto)}</qrCode><urlChave>${xml(urls.chave)}</urlChave></infNFeSupl>`;
  }
  const nfe = `<?xml version="1.0" encoding="UTF-8"?><NFe xmlns="http://www.portalfiscal.inf.br/nfe">${inf}${assinatura}${supl}</NFe>`;
  const lote = String(input.numero).padStart(15, '0');
  const envi = `<enviNFe xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00"><idLote>${lote}</idLote><indSinc>1</indSinc>${nfe}</enviNFe>`;
  const soap =
    `<?xml version="1.0" encoding="utf-8"?>` +
    `<soap12:Envelope xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">` +
    `<soap12:Body><nfeDadosMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeAutorizacao4">${envi}</nfeDadosMsg></soap12:Body>` +
    `</soap12:Envelope>`;

  const url = urlAutorizacao(uf, input.modelo, input.ambiente);
  const resposta = await postSefaz(url, soap, input.certificado.certPem, input.certificado.keyPem);
  const cStat = /<cStat>(\d+)<\/cStat>/g;
  const stats = [...resposta.matchAll(cStat)].map((m) => m[1]);
  const motivos = [...resposta.matchAll(/<xMotivo>([^<]*)<\/xMotivo>/g)].map((m) => m[1]);
  const protocolo = resposta.match(/<nProt>([^<]+)<\/nProt>/)?.[1] ?? '';
  const autorizado = stats.includes('100') || stats.includes('150');
  const motivo = motivos[motivos.length - 1] || (resposta ? 'Resposta da SEFAZ sem motivo.' : 'Sem resposta da SEFAZ.');
  const qrDataUrl = qrTexto ? await QRCode.toDataURL(qrTexto) : '';
  return { autorizado, chave, protocolo, motivo, xml: nfe, qrDataUrl };
}

function postSefaz(url: string, soap: string, certPem: string, keyPem: string): Promise<string> {
  const alvo = new URL(url);
  const agent = new https.Agent({ cert: certPem, key: keyPem, rejectUnauthorized: true });
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        protocol: alvo.protocol,
        hostname: alvo.hostname,
        port: alvo.port || 443,
        path: alvo.pathname + alvo.search,
        method: 'POST',
        agent,
        headers: {
          'Content-Type': 'application/soap+xml; charset=utf-8',
          'Content-Length': Buffer.byteLength(soap),
        },
        timeout: 30000,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c) => chunks.push(Buffer.from(c)));
        res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
      },
    );
    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error('Tempo esgotado ao falar com a SEFAZ.')));
    req.write(soap);
    req.end();
  });
}
