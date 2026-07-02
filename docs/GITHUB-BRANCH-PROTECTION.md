# Protecoes de branch no GitHub (configuracao manual)

O GitHub nao permite definir branch protection via arquivos do repo (sem GitHub Enterprise API).
Siga estes passos apos o primeiro push de `main` e `develop`.

## main (producao)

1. Repositorio → **Settings** → **Branches** → **Add branch protection rule**
2. Branch name pattern: `main`
3. Marcar:
   - [x] Require a pull request before merging
   - [x] Require approvals: **1**
   - [x] Do not allow bypassing the above settings
4. (Opcional) Require status checks to pass: selecionar workflow **CI**
5. Save changes

## develop (integracao)

1. Add branch protection rule
2. Branch name pattern: `develop`
3. Marcar:
   - [x] Require a pull request before merging
4. Save changes

## Convencao de nomes (referencia)

| Prefixo | Exemplo | Uso |
|---------|---------|-----|
| `feature/` | `feature/pcp-filtro-familia` | Nova funcionalidade |
| `fix/` | `fix/login-cookie-https` | Correcao de bug |
| `hotfix/` | `hotfix/erro-deploy` | Urgencia em producao (branch de `main`) |

Criar branches localmente:

```powershell
git checkout develop
git pull origin develop
git checkout -b feature/minha-tarefa
```

Script auxiliar: `powershell -File scripts/setup-branches.ps1`
