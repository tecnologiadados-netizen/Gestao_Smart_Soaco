#!/usr/bin/env node
/**
 * Copia o código do SGQ para frontend/src/modules/qualidade e adapta imports Next → React Router.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SGQ_SRC = path.join(ROOT, 'qualidade', 'sgq', 'src');
const DEST = path.join(ROOT, 'frontend', 'src', 'modules', 'qualidade');

const COPY_DIRS = ['components', 'hooks', 'lib', 'types'];

const PAGE_MAP = [
  ['app/(dashboard)/documentos/page.tsx', 'pages/DocumentosPage.tsx'],
  ['app/(dashboard)/documentos/consulta/page.tsx', 'pages/DocumentosConsultaPage.tsx'],
  ['app/(dashboard)/documentos/novo/page.tsx', 'pages/DocumentosNovoPage.tsx'],
  ['app/(dashboard)/documentos/[id]/page.tsx', 'pages/DocumentoDetalhePage.tsx'],
  ['app/(dashboard)/documentos/[id]/elaborar/page.tsx', 'pages/DocumentoElaborarPage.tsx'],
  ['app/(dashboard)/documentos/[id]/consenso/page.tsx', 'pages/DocumentoConsensoPage.tsx'],
  ['app/(dashboard)/documentos/[id]/aprovacao/page.tsx', 'pages/DocumentoAprovacaoPage.tsx'],
  ['app/(dashboard)/calibracoes/page.tsx', 'pages/CalibracoesPage.tsx'],
  ['app/(dashboard)/calibracoes/consulta/page.tsx', 'pages/CalibracoesConsultaPage.tsx'],
  ['app/(dashboard)/calibracoes/consulta/consulta-content.tsx', 'pages/CalibracoesConsultaContent.tsx'],
  ['app/(dashboard)/calibracoes/cadastros/equipamentos/page.tsx', 'pages/CalibracoesEquipamentosPage.tsx'],
  ['app/(dashboard)/calibracoes/visao-geral/page.tsx', 'pages/CalibracoesVisaoGeralPage.tsx'],
  ['app/(dashboard)/registros/page.tsx', 'pages/RegistrosPage.tsx'],
  ['app/(dashboard)/registros/consulta/page.tsx', 'pages/RegistrosConsultaPage.tsx'],
  ['app/(dashboard)/registros/consulta/consulta-content.tsx', 'pages/RegistrosConsultaContent.tsx'],
  ['app/(dashboard)/avaliacao-fornecedor/page.tsx', 'pages/AvaliacaoFornecedorPage.tsx'],
  ['app/(dashboard)/avaliacao-fornecedor/historico/page.tsx', 'pages/AvaliacaoFornecedorHistoricoPage.tsx'],
  ['app/(dashboard)/configuracoes/page.tsx', 'pages/ConfiguracoesPage.tsx'],
  ['app/(dashboard)/configuracoes/usuarios/page.tsx', 'pages/ConfiguracoesUsuariosPage.tsx'],
  ['app/(dashboard)/configuracoes/setores/page.tsx', 'pages/ConfiguracoesSetoresPage.tsx'],
  ['app/(dashboard)/configuracoes/tipos-documento/page.tsx', 'pages/ConfiguracoesTiposDocumentoPage.tsx'],
  ['app/documentos/visualizar/page.tsx', 'pages/DocumentosVisualizarPage.tsx'],
];

function rmDir(dir) {
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
}

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

function transformContent(content, filePath) {
  let s = content;
  s = s.replace(/^"use client";\s*\n/gm, '');
  s = s.replace(/^'use client';\s*\n/gm, '');
  s = s.replace(/from "@\//g, 'from "@qualidade/');
  s = s.replace(/from '@\//g, "from '@qualidade/");
  s = s.replace(/import Link from "next\/link"/g, "import { Link } from 'react-router-dom'");
  s = s.replace(/import Link from 'next\/link'/g, "import { Link } from 'react-router-dom'");
  s = s.replace(/\bhref=/g, 'to=');
  s = s.replace(
    /import\s*\{([^}]*)\}\s*from\s*"next\/navigation"/g,
    (match, imports) => {
      const parts = imports.split(',').map((p) => p.trim()).filter(Boolean);
      const rr = [];
      const extra = [];
      for (const p of parts) {
        if (p === 'useRouter') extra.push('useNavigate');
        else if (p === 'usePathname') extra.push('useLocation');
        else if (p === 'useSearchParams' || p === 'useParams') rr.push(p);
        else rr.push(p);
      }
      const all = [...new Set([...rr, ...extra])];
      return `import { ${all.join(', ')} } from 'react-router-dom'`;
    }
  );
  s = s.replace(/\bconst router = useRouter\(\)/g, 'const navigate = useNavigate()');
  s = s.replace(/\brouter\.push\(/g, 'navigate(');
  s = s.replace(/\brouter\.replace\(/g, 'navigate(');
  s = s.replace(/\bconst pathname = usePathname\(\)/g, 'const { pathname } = useLocation()');

  // Prefixo /qualidade nas rotas internas do módulo
  s = s.replace(/to="\/(documentos|calibracoes|registros|configuracoes|avaliacao-fornecedor)/g, 'to="/qualidade/$1');
  s = s.replace(/to='\/(documentos|calibracoes|registros|configuracoes|avaliacao-fornecedor)/g, "to='/qualidade/$1");
  s = s.replace(/navigate\("\/(documentos|calibracoes|registros|configuracoes|avaliacao-fornecedor)/g, 'navigate("/qualidade/$1');
  s = s.replace(/navigate\('\/(documentos|calibracoes|registros|configuracoes|avaliacao-fornecedor)/g, "navigate('/qualidade/$1");
  s = s.replace(/window\.location\.href = (['"])\/(documentos|calibracoes|registros|configuracoes)/g, 'window.location.href = $1/qualidade/$2');

  if (filePath.endsWith('use-transition-router.ts')) {
    s = `import { useNavigate } from 'react-router-dom';\nimport { useCallback, useEffect, useRef, useState } from 'react';\nimport { UI_TRANSITION_MS } from '@qualidade/lib/motion';\n\nexport function useTransitionRouter() {\n  const navigate = useNavigate();\n  const [exiting, setExiting] = useState(false);\n  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);\n\n  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);\n\n  const push = useCallback((href: string, options?: { delay?: number; animateExit?: boolean }) => {\n    const delay = options?.delay ?? UI_TRANSITION_MS;\n    const animateExit = options?.animateExit ?? true;\n    if (timerRef.current) clearTimeout(timerRef.current);\n    if (animateExit) setExiting(true);\n    timerRef.current = setTimeout(() => {\n      navigate(href.startsWith('/qualidade') ? href : \`/qualidade\${href.startsWith('/') ? href : \`/\${href}\`}\`);\n      setExiting(false);\n      timerRef.current = null;\n    }, delay);\n  }, [navigate]);\n\n  return { push, exiting, navigate };\n}\n`;
  }

  return s;
}

function walkTransform(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkTransform(full);
    else if (/\.(tsx?|jsx?)$/.test(entry.name)) {
      const raw = fs.readFileSync(full, 'utf8');
      fs.writeFileSync(full, transformContent(raw, full), 'utf8');
    }
  }
}

rmDir(DEST);
fs.mkdirSync(DEST, { recursive: true });

for (const dir of COPY_DIRS) {
  copyDir(path.join(SGQ_SRC, dir), path.join(DEST, dir));
}

fs.mkdirSync(path.join(DEST, 'pages'), { recursive: true });
for (const [srcRel, destRel] of PAGE_MAP) {
  const src = path.join(SGQ_SRC, srcRel);
  if (!fs.existsSync(src)) {
    console.warn('skip missing', srcRel);
    continue;
  }
  let content = fs.readFileSync(src, 'utf8');
  content = content.replace(/export default function (\w+)/, 'export function $1');
  if (!content.includes('export function') && content.includes('export default')) {
    content = content.replace(/export default function/, 'export function');
  }
  fs.writeFileSync(path.join(DEST, destRel), transformContent(content, destRel), 'utf8');
}

walkTransform(DEST);

// Remove header standalone do módulo (gestão já tem shell)
const headerPath = path.join(DEST, 'components', 'layout', 'app-header.tsx');
if (fs.existsSync(headerPath)) fs.unlinkSync(headerPath);

console.log('Migração SGQ → frontend/src/modules/qualidade concluída.');
