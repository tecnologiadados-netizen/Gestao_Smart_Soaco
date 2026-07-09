#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'frontend', 'src', 'modules', 'qualidade');

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (/\.(tsx?|jsx?)$/.test(entry.name)) {
      let s = fs.readFileSync(full, 'utf8');
      const orig = s;
      s = s.replace(/const searchParams = useSearchParams\(\)/g, 'const [searchParams] = useSearchParams()');
      const prefixes = ['documentos', 'calibracoes', 'registros', 'configuracoes', 'avaliacao-fornecedor'];
      for (const p of prefixes) {
        s = s.replace(new RegExp(`to=\\{\`/${p}`, 'g'), `to={\`/qualidade/${p}`);
        s = s.replace(new RegExp(`to="/${p}`, 'g'), `to="/qualidade/${p}`);
        s = s.replace(new RegExp(`to='/${p}`, 'g'), `to='/qualidade/${p}`);
        s = s.replace(new RegExp(`navigate\\(\`/${p}`, 'g'), `navigate(\`/qualidade/${p}`);
        s = s.replace(new RegExp(`navigate\\("/${p}`, 'g'), `navigate("/qualidade/${p}`);
        s = s.replace(new RegExp(`navigate\\('/${p}`, 'g'), `navigate('/qualidade/${p}`);
        s = s.replace(new RegExp(`"/${p}`, 'g'), (m, off) => {
          const before = s.slice(Math.max(0, off - 12), off);
          if (before.includes('qualidade')) return m;
          return `"/qualidade/${p}`;
        });
      }
      if (s !== orig) fs.writeFileSync(full, s, 'utf8');
    }
  }
}

walk(ROOT);
console.log('paths fixed');
