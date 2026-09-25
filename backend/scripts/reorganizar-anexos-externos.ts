/**
 * Reorganiza anexos de documentos externos:
 * - mantém só o arquivo vigente em anexosJson / arquivoNome
 * - move os demais para externoRegistroJson.historicoAtualizacoes
 *
 * NÃO cria versões, NÃO apaga arquivos do disco, NÃO inventa datas.
 *
 * Uso:
 *   npx tsx scripts/reorganizar-anexos-externos.ts          # dry-run
 *   npx tsx scripts/reorganizar-anexos-externos.ts --apply  # grava
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const APPLY = process.argv.includes('--apply');

/** Código (com :00) → nome exato do arquivo vigente. */
const VIGENTE_POR_CODIGO: Record<string, string> = {
  'EXT-496341:00': 'NCC 25.11530_Rev0.pdf',
  'EXT-288524:00':
    'Cert_TNBR-29339 Plugue 2P+T 3A-10A 180°-90° (1).pdf',
  'EXT-310814:00': 'DSS_BRA22-00187 - BRA-CERT190100162-08.pdf',
  'EXT-609743:00': 'Certificado N5-13_611.pdf',
  'EXT-656223:00': 'certificado CE - C280.pdf',
  'EXT-035789:00': 'DSS_BRA25-00915 - BRA-CERT190500933-21.pdf',
  'EXT-237165:00':
    'DSS_BRA21-01186 - BRA-CERT180701796-09 _ADDED ALTERNATE OVERLOAD FOR STOCK USE.pdf',
  'EXT-755191:00': 'CE - 591 (1).pdf',
  'EXT-203910:00': 'MR 0855-2023 CC REV01 - Cabo PP Flexivel Circular.pdf',
  'EXT-282081:00':
    'RTAC002936 - PORTARIA Nº 102, DE 22 DE MARÇO DE 2022.pdf',
  'EXT-459164:00':
    'SDFY2.E251415 - Controladores de Refrigeração - Componente _ Product iQ - Product iQ.pdf',
  'EXT-473192:00':
    'Portaria 200_29 04 2021_Requisistos Gerais de Certificação de Produtos.pdf',
  'EXT-514424:00': 'Certificado plugues 10A.pdf',
  'EXT-586600:00':
    'RTAC002961 - PORTARIA N° 148, DE 28 DE MARÇO DE 2022.pdf',
  'EXT-216882:00':
    'RTAC002936 - PORTARIA Nº 102, DE 22 DE MARÇO DE 2022.pdf',
  'EXT-352104:00': 'Atestado - 51806_19.2.M3.pdf',
};

type Anexo = { nome?: string; storagePath?: string; dataUrl?: string };

function parseAnexos(json: string | null | undefined): Anexo[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function main() {
  console.log(APPLY ? '=== APPLY (gravando) ===' : '=== DRY-RUN (sem gravar) ===');
  let ok = 0;
  let skip = 0;
  let fail = 0;

  for (const [codigo, vigenteNome] of Object.entries(VIGENTE_POR_CODIGO)) {
    const doc = await prisma.sgqDocumento.findUnique({
      where: { codigo },
      include: { versoes: true },
    });
    if (!doc) {
      console.error(`[FAIL] ${codigo}: documento não encontrado`);
      fail++;
      continue;
    }
    if (doc.origem !== 'externo') {
      console.error(`[FAIL] ${codigo}: origem=${doc.origem} (esperado externo)`);
      fail++;
      continue;
    }

    const ver =
      doc.versoes.find((v) => v.versao === doc.versaoAtual) ?? doc.versoes[0];
    if (!ver) {
      console.error(`[FAIL] ${codigo}: sem versão atual`);
      fail++;
      continue;
    }

    const anexos = parseAnexos(ver.anexosJson);
    if (anexos.length <= 1) {
      console.log(`[SKIP] ${codigo}: já tem ${anexos.length} anexo(s) na versão`);
      skip++;
      continue;
    }

    const vigente = anexos.find((a) => a.nome === vigenteNome);
    if (!vigente?.nome) {
      console.error(
        `[FAIL] ${codigo}: vigente "${vigenteNome}" não achado. Anexos:`,
        anexos.map((a) => a.nome)
      );
      fail++;
      continue;
    }

    const demais = anexos.filter((a) => a.nome !== vigenteNome);
    const historico = demais.map((a) => ({
      nome: String(a.nome),
      ...(a.storagePath?.startsWith('/uploads/qualidade/')
        ? { storagePath: a.storagePath }
        : {}),
    }));

    const ext = doc.externoRegistroJson
      ? (JSON.parse(doc.externoRegistroJson) as Record<string, unknown>)
      : {};
    const historicoExistente = Array.isArray(ext.historicoAtualizacoes)
      ? (ext.historicoAtualizacoes as Array<{ nome?: string; storagePath?: string }>)
      : [];
    const historicoMerged = [...historicoExistente];
    for (const h of historico) {
      if (
        historicoMerged.some(
          (x) => x.nome === h.nome && x.storagePath === h.storagePath
        )
      ) {
        continue;
      }
      historicoMerged.push(h);
    }

    const novoExt = {
      ...ext,
      historicoAtualizacoes: historicoMerged,
      // espelha só o vigente (se havia lista de anexos no cadastro)
      ...(Array.isArray(ext.anexos)
        ? {
            anexos: [
              {
                nome: vigente.nome,
                ...(vigente.storagePath
                  ? { storagePath: vigente.storagePath }
                  : {}),
              },
            ],
          }
        : {}),
    };

    const novoAnexosJson = JSON.stringify([
      {
        nome: vigente.nome,
        ...(vigente.storagePath ? { storagePath: vigente.storagePath } : {}),
      },
    ]);

    console.log(
      `[OK] ${codigo}: vigente="${vigente.nome}" | move ${demais.length} → historico`
    );
    for (const d of demais) console.log(`      - ${d.nome}`);

    if (APPLY) {
      await prisma.$transaction([
        prisma.sgqDocumentoVersao.update({
          where: { id: ver.id },
          data: {
            anexosJson: novoAnexosJson,
            arquivoNome: vigente.nome,
            ...(vigente.storagePath
              ? { arquivoStoragePath: vigente.storagePath }
              : {}),
          },
        }),
        prisma.sgqDocumento.update({
          where: { id: doc.id },
          data: { externoRegistroJson: JSON.stringify(novoExt) },
        }),
      ]);
    }
    ok++;
  }

  console.log(`\nResumo: ok=${ok} skip=${skip} fail=${fail}`);
  if (!APPLY && ok > 0) {
    console.log('Rode de novo com --apply para gravar.');
  }
  if (fail > 0) process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
