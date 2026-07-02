// Rode: node read-colunas.cjs "C:\Users\yagol\OneDrive\Área de Trabalho\Colunas.xlsx"
const XLSX = require('xlsx');
const path = process.argv[2] || require('path').join(process.env.USERPROFILE, 'OneDrive', 'Área de Trabalho', 'Colunas.xlsx');
try {
  const wb = XLSX.readFile(path);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });
  const headers = rows[0] || [];
  console.log('Colunas na ordem do arquivo:');
  headers.forEach((h, i) => console.log((i + 1) + '. ' + (h || '(vazio)')));
} catch (e) {
  console.error('Erro:', e.message);
}
