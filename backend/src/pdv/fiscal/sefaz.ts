/** Webservices públicos da NF-e 4.00 / NFC-e. Sem API paga. SVRS cobre o Piauí e a maior parte das UFs. */

const CUF: Record<string, string> = {
  AC: '12', AL: '27', AM: '13', AP: '16', BA: '29', CE: '23', DF: '53', ES: '32', GO: '52',
  MA: '21', MG: '31', MS: '50', MT: '51', PA: '15', PB: '25', PE: '26', PI: '22', PR: '41',
  RJ: '33', RN: '24', RO: '11', RR: '14', RS: '43', SC: '42', SE: '28', SP: '35', TO: '17',
};

const PROPRIO_NFE = new Set(['AM', 'BA', 'GO', 'MG', 'MS', 'MT', 'PE', 'PR', 'RS', 'SP']);

export function codigoUf(uf: string): string {
  return CUF[uf.trim().toUpperCase()] ?? '22';
}

export function urlAutorizacao(uf: string, modelo: '55' | '65', ambiente: 'homologacao' | 'producao'): string {
  const u = uf.trim().toUpperCase();
  const hom = ambiente === 'homologacao';
  if (modelo === '65') {
    if (u === 'SP') {
      return hom
        ? 'https://homologacao.nfce.fazenda.sp.gov.br/ws/NFeAutorizacao4.asmx'
        : 'https://nfce.fazenda.sp.gov.br/ws/NFeAutorizacao4.asmx';
    }
    if (u === 'PR') {
      return hom
        ? 'https://homologacao.nfce.sefa.pr.gov.br/nfce/NFeAutorizacao4'
        : 'https://nfce.sefa.pr.gov.br/nfce/NFeAutorizacao4';
    }
    return hom
      ? 'https://nfce-homologacao.svrs.rs.gov.br/ws/NfeAutorizacao/NFeAutorizacao4.asmx'
      : 'https://nfce.svrs.rs.gov.br/ws/NfeAutorizacao/NFeAutorizacao4.asmx';
  }
  if (u === 'SP' && PROPRIO_NFE.has(u)) {
    return hom
      ? 'https://homologacao.nfe.fazenda.sp.gov.br/ws/nfeautorizacao4.asmx'
      : 'https://nfe.fazenda.sp.gov.br/ws/nfeautorizacao4.asmx';
  }
  return hom
    ? 'https://nfe-homologacao.svrs.rs.gov.br/ws/NfeAutorizacao/NFeAutorizacao4.asmx'
    : 'https://nfe.svrs.rs.gov.br/ws/NfeAutorizacao/NFeAutorizacao4.asmx';
}

export function urlQrCode(uf: string, ambiente: 'homologacao' | 'producao'): { qr: string; chave: string } {
  const u = uf.trim().toUpperCase();
  const hom = ambiente === 'homologacao';
  if (u === 'SP') {
    return {
      qr: hom
        ? 'https://www.homologacao.nfce.fazenda.sp.gov.br/qrcode'
        : 'https://www.nfce.fazenda.sp.gov.br/qrcode',
      chave: hom
        ? 'https://www.homologacao.nfce.fazenda.sp.gov.br/consulta'
        : 'https://www.nfce.fazenda.sp.gov.br/consulta',
    };
  }
  return {
    qr: hom
      ? 'https://nfce-homologacao.svrs.rs.gov.br/ws/qrcode/index.aspx'
      : 'https://nfce.svrs.rs.gov.br/ws/qrcode/index.aspx',
    chave: hom
      ? 'https://dfe-portal.svrs.rs.gov.br/nfce/consulta'
      : 'https://dfe-portal.svrs.rs.gov.br/nfce/consulta',
  };
}
