-- Componentes válidos para exibição no Calendário de produção (materiais do dia / críticos).
-- Critérios: lista Produção/Precificação/Parcial ativa e padrão, não alternativo,
-- produto ativo, vínculo com setor Almoxarifado Material Secundário.
-- Placeholder `__IDS__` é substituído por lista de IDs (`1,2,3`) no serviço.
-- COLLATE unifica dwlc_componentes (em geral utf8mb4_general_ci) com produto/conexão (0900).

WITH setor_alvo AS (
    SELECT id
    FROM setorestoque
    WHERE nome COLLATE utf8mb4_general_ci LIKE '%ALMOXARIFADO%MATERIAL%SECUND%'
),

componentes_validos AS (
    SELECT DISTINCT c.`Código do produto componente` AS codigo
    FROM dwlc_componentes c
    JOIN produto        prp ON prp.nome COLLATE utf8mb4_general_ci
                           = c.`Código do produto pai` COLLATE utf8mb4_general_ci
                           AND prp.ativo     = 1
    JOIN produtoempresa pep ON pep.idProduto = prp.id
                           AND pep.idEmpresa = 1
    WHERE (   c.`Descrição da lista de materiais` COLLATE utf8mb4_general_ci LIKE 'Lista%Produ__o'
           OR c.`Descrição da lista de materiais` COLLATE utf8mb4_general_ci LIKE 'Lista%Precifica__o'
           OR c.`Descrição da lista de materiais` COLLATE utf8mb4_general_ci LIKE 'Lista%Parci%')
      AND c.`Lista de materiais ativa?`  COLLATE utf8mb4_general_ci = 'Sim'
      AND c.`Lista de materiais padrão?` COLLATE utf8mb4_general_ci = 'Sim'
      AND c.`Componente é alternativo?`  COLLATE utf8mb4_general_ci = 'Não'
      AND c.`Código do produto componente` IS NOT NULL
)

SELECT DISTINCT
    pr.id AS idProduto
FROM componentes_validos cv
JOIN produto pr ON pr.nome COLLATE utf8mb4_general_ci = cv.codigo COLLATE utf8mb4_general_ci
                AND pr.ativo = 1
JOIN produtoempresa pe ON pe.idProduto = pr.id
                      AND pe.idEmpresa = 1
JOIN produtoempresa_setorestoque vinc
       ON vinc.idProdutoEmpresa = pe.id
      AND vinc.idSetorEstoque   IN (SELECT id FROM setor_alvo)
WHERE pr.id IN (__IDS__)
;
