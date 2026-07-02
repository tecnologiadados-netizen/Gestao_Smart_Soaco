# Protecoes de branch no GitHub (configuracao manual)

O GitHub nao permite definir branch protection via arquivos do repo (sem GitHub Enterprise API).
Siga estes passos apos o push de `main`, `develop1`, `develop2` e `develop3`.

Repositorio: https://github.com/tecnologiadados-netizen/Gestao_Smart_Soaco

## main (producao)

1. Repositorio → **Settings** → **Branches** → **Add branch protection rule**
2. Branch name pattern: `main`
3. Marcar:
   - [x] Require a pull request before merging
   - [x] Require approvals: **1**
   - [x] Do not allow bypassing the above settings
4. (Opcional) Require status checks to pass: selecionar workflow **CI**
5. Save changes

## develop1, develop2 e develop3 (integracao por dev)

Repita para cada branch (`develop1`, `develop2`, `develop3`):

1. Add branch protection rule
2. Branch name pattern: `develop1` (depois `develop2`, depois `develop3`)
3. Marcar:
   - [x] Require a pull request before merging
4. Save changes

**Remover** regra antiga de `develop`, se ainda existir.

## Atribuicao sugerida

| Branch | Dev |
|--------|-----|
| `develop1` | Desenvolvedor 1 |
| `develop2` | Desenvolvedor 2 |
| `develop3` | Desenvolvedor 3 |

## Convencao de nomes (referencia)

| Prefixo | Exemplo | Uso |
|---------|---------|-----|
| `feature/` | `feature/pcp-filtro-familia` | Nova funcionalidade |
| `fix/` | `fix/login-cookie-https` | Correcao de bug |
| `hotfix/` | `hotfix/erro-deploy` | Urgencia em producao (branch de `main`) |

Criar branches localmente (cada dev usa a sua `developN`):

```powershell
git checkout develop2
git pull origin develop2
git checkout -b feature/minha-tarefa
```

Script auxiliar: `powershell -File scripts/setup-branches.ps1`
