import forge from 'node-forge';

export type CertificadoAberto = {
  certPem: string;
  keyPem: string;
  cnpj: string;
  titular: string;
  validoAte: Date;
};

function soDigitos(v: string): string {
  return v.replace(/\D/g, '');
}

export function abrirPfx(pfx: Buffer, senha: string): CertificadoAberto {
  const der = forge.util.createBuffer(pfx.toString('binary'));
  const asn1 = forge.asn1.fromDer(der);
  const p12 = forge.pkcs12.pkcs12FromAsn1(asn1, senha);
  const keyBag = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[forge.pki.oids.pkcs8ShroudedKeyBag]?.[0];
  const certBag = p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag]?.[0];
  if (!keyBag?.key || !certBag?.cert) {
    throw new Error('Não foi possível ler a chave ou o certificado deste arquivo.');
  }
  const cert = certBag.cert;
  const agora = new Date();
  if (cert.validity.notAfter < agora) {
    throw new Error('Certificado vencido.');
  }
  const attrs = cert.subject.attributes as { type?: string; name?: string; value?: string; shortName?: string }[];
  const cnpjAttr = attrs.find((a) => a.type === '2.16.76.1.3.3' || a.name === '2.16.76.1.3.3');
  const cn = attrs.find((a) => a.shortName === 'CN')?.value ?? '';
  const cnpj = soDigitos(String(cnpjAttr?.value ?? cn)).slice(0, 14);
  return {
    certPem: forge.pki.certificateToPem(cert),
    keyPem: forge.pki.privateKeyToPem(keyBag.key),
    cnpj,
    titular: String(cn),
    validoAte: cert.validity.notAfter,
  };
}

export function assinarInfNfe(xmlInf: string, id: string, certPem: string, keyPem: string): string {
  const pki = forge.pki;
  const cert = pki.certificateFromPem(certPem);
  const key = pki.privateKeyFromPem(keyPem);
  const md = forge.md.sha1.create();
  md.update(xmlInf, 'utf8');
  const digest = forge.util.encode64(md.digest().bytes());

  const signedInfo =
    `<SignedInfo xmlns="http://www.w3.org/2000/09/xmldsig#">` +
    `<CanonicalizationMethod Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/>` +
    `<SignatureMethod Algorithm="http://www.w3.org/2000/09/xmldsig#rsa-sha1"/>` +
    `<Reference URI="#${id}">` +
    `<Transforms>` +
    `<Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"/>` +
    `<Transform Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/>` +
    `</Transforms>` +
    `<DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"/>` +
    `<DigestValue>${digest}</DigestValue>` +
    `</Reference>` +
    `</SignedInfo>`;

  const mdSign = forge.md.sha1.create();
  mdSign.update(signedInfo, 'utf8');
  const signature = forge.util.encode64((key as forge.pki.rsa.PrivateKey).sign(mdSign));
  const certB64 = forge.util.encode64(
    forge.asn1.toDer(pki.certificateToAsn1(cert)).getBytes(),
  );

  return (
    `<Signature xmlns="http://www.w3.org/2000/09/xmldsig#">` +
    signedInfo +
    `<SignatureValue>${signature}</SignatureValue>` +
    `<KeyInfo><X509Data><X509Certificate>${certB64}</X509Certificate></X509Data></KeyInfo>` +
    `</Signature>`
  );
}
