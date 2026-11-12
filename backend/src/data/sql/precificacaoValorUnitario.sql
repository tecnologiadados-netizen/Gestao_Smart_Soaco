Select Distinct cunit.idProduto,
  round(Case When cunit.bobina <> '' Then bobin.valorUnitarioTotal
    Else cunit.valorUnitarioTotal End, 2) As valorUnitario,
  Case When cunit.bobina <> '' Then bobin.dataEntrada Else cunit.dataEntrada
  End As dataEntrada,
  Coalesce(tm.opcao, 'Material Secundário') As opcao
From (Select ud.idProduto,
    Replace((Case When p.descricao Like 'BOBINA%X%MM%' Then (Case
        When Length(p.descricao) - Length(Replace(Upper(p.descricao), 'X',
        '')) = 1 Then Concat(Trim(SubString_Index(Upper(p.descricao), 'X',
        1)), SubString(Upper(p.descricao), Locate('MM', Upper(p.descricao)) +
        2))
        Else Concat(Left(Upper(p.descricao),
        Length(SubString_Index(p.descricao, 'X', 2))),
        SubString(Upper(p.descricao), Locate('MM', Upper(p.descricao)) + 2))
      End) Else '' End), 'BOBINA INTEIRA', 'BOBINA SLITADA') As bobina,
    Case
      When m.idTipoMovimentacao = 142 Then (m.valorUnitario +
      ((m.valorUnitario * Coalesce(round((m.valorTotalFrete / tn.totalnota),
      2), 0)))) Else ((m.valorUnitario - (m.valorUnitario * Coalesce((Case
        When m.idTipoMovimentacao In (71, 142) Then bob.aliquotaICMS
        Else t.aliquotaICMS End / 100), 0) + m.valorUnitario * Coalesce((Case
        When m.idTipoMovimentacao In (71, 142) Then IfNull(bob.aliquotaCOFINS,
        7.6) Else IfNull(t.aliquotaCOFINS, 7.6)
      End / 100), 0) + m.valorUnitario * Coalesce((Case
        When m.idTipoMovimentacao In (71, 142) Then IfNull(bob.aliquotaPIS,
        1.65) Else IfNull(t.aliquotaPIS, 1.65)
      End / 100), 0))) + ((m.valorUnitario * Coalesce(round((m.valorTotalFrete
      / tn.totalnota), 2), 0)))) End As valorUnitarioTotal,
    ud.dataEntrada
  From (Select ide.idProduto,
      Max(d.dataEntrada) As dataEntrada
    From itemdocumentoestoque ide
      Left Join documentoestoque d On d.id = ide.idDocumentoEstoque
      Left Join produto p On p.id = ide.idProduto
    Where (ide.idTipoMovimentacao In (11, 71, 116, 115, 114, 113, 112, 111,
      142)) And (ide.idSetorEntrada In (2, 19, 20, 32))
    Group By ide.idProduto) ud
    Left Join (Select ide.id,
      ide.idDocumentoEstoque As idDocumentoEntrada,
      ide.idProduto,
      ide.idTipoMovimentacao,
      d.dataEntrada,
      d.valorTotalFrete,
      p.nome,
      ide.qtde,
      ide.valorUnitario
    From itemdocumentoestoque ide
      Left Join documentoestoque d On d.id = ide.idDocumentoEstoque
      Left Join produto p On p.id = ide.idProduto
    Where (ide.idTipoMovimentacao In (11, 71, 116, 115, 114, 113, 112, 111,
      142)) And (ide.idSetorEntrada In (2, 19, 20, 32))) m
      On (m.idProduto = ud.idProduto) And (ud.dataEntrada = m.dataEntrada)
    Left Join tributacao t On t.idItemDocumentoEstoque = m.id
    Left Join (Select ide.idDocumentoEstoque As idDocumentoEntrada,
      Count(Distinct ide.idProduto) As qtditens
    From itemdocumentoestoque ide
      Left Join documentoestoque d On d.id = ide.idDocumentoEstoque
      Left Join produto p On p.id = ide.idProduto
    Where (ide.idSetorEntrada In (2, 19, 20, 32)) And
      (ide.idTipoMovimentacao In (11, 71, 116, 115, 114, 113, 112, 111, 142))
    Group By ide.idDocumentoEstoque) q On q.idDocumentoEntrada =
      m.idDocumentoEntrada
    Left Join (Select ide.idDocumentoEstoque As idDocumentoEntrada,
      Sum((ide.qtde * ide.valorUnitario)) As totalnota
    From itemdocumentoestoque ide
      Left Join documentoestoque d On d.id = ide.idDocumentoEstoque
      Left Join produto p On p.id = ide.idProduto
    Where (ide.idTipoMovimentacao In (11, 71, 116, 115, 114, 113, 112, 111,
      142)) And (ide.idSetorEntrada In (2, 19, 20, 32))
    Group By ide.idDocumentoEstoque) tn On tn.idDocumentoEntrada =
      m.idDocumentoEntrada
    Left Join (Select documentoestoque.id,
      Case When documentoestoque.modalidadeTransporte = 0 Then 'CIF'
        When documentoestoque.modalidadeTransporte = 1 Then 'FOB'
        When documentoestoque.modalidadeTransporte = 2 Then 'Terceiros'
        When documentoestoque.modalidadeTransporte = 3 Then 'Remetente'
        When documentoestoque.modalidadeTransporte = 4 Then 'Destinatário'
        Else 'Sem Transporte' End As modalidadeTransporte,
      documentoestoque.valorTotalFrete
    From documentoestoque) mf On mf.id = m.idDocumentoEntrada
    Left Join produto p On m.idProduto = p.id
    Left Join (Select df.id,
      df.chaveAcessoNFe As chaveentradaslitada,
      df.idDocumentoEntrada As documentoentradaslitada,
      nf.idDocumentoEstoque As documentosaidainteira,
      de.idTipoMovimentacao,
      ide.idProduto,
      dfe.chaveAcessoNFe,
      nfe.idDocumentoEstoque As documentoentradainteira,
      t.aliquotaICMS,
      IfNull(t.aliquotaCOFINS, 7.6) As aliquotaCOFINS,
      IfNull(t.aliquotaPIS, 1.65) As aliquotaPIS,
      t.aliquotaIPI
    From documentofiscal df
      Left Join nfe nf On nf.chave = df.chaveAcessoNFe
      Left Join documentoestoque de On de.id = nf.idDocumentoEstoque
      Left Join documentofiscal dfe On nf.idDocumentoEstoque =
        dfe.idDocumentoSaida
      Left Join nfe nfe On nfe.chave = dfe.chaveAcessoNFe
      Left Join itemdocumentoestoque ide On ide.idDocumentoEstoque =
        nfe.idDocumentoEstoque
      Left Join tributacao t On t.idItemDocumentoEstoque = ide.id
    Where de.idTipoMovimentacao In (70, 142)) bob
      On bob.documentoentradaslitada = m.idDocumentoEntrada
    where ud.idProduto in (__IN_IDS__)) cunit
  Left Join (Select Distinct ud.bobina,
    Avg(Case
      When m.idTipoMovimentacao = 142 Then (m.valorUnitario +
      ((m.valorUnitario * Coalesce(round((m.valorTotalFrete / tn.totalnota),
      2), 0)))) Else ((m.valorUnitario - (m.valorUnitario * (Case
        When m.idTipoMovimentacao In (71, 142) Then bob.aliquotaICMS
        Else t.aliquotaICMS End / 100) + m.valorUnitario * (Case
        When m.idTipoMovimentacao In (71, 142) Then IfNull(bob.aliquotaCOFINS,
        7.6) Else IfNull(t.aliquotaCOFINS, 7.6)
      End / 100) + m.valorUnitario * (Case
        When m.idTipoMovimentacao In (71, 142) Then IfNull(bob.aliquotaPIS,
        1.65) Else IfNull(t.aliquotaPIS, 1.65)
      End / 100))) + ((m.valorUnitario * round((m.valorTotalFrete /
      tn.totalnota), 2)))) End) As valorUnitarioTotal,
    ud.dataEntrada
  From (Select p.descricao,
      (Case
        When Length(p.descricao) - Length(Replace(Upper(p.descricao), 'X',
        '')) = 1 Then Concat(Trim(SubString_Index(Upper(p.descricao), 'X',
        1)), SubString(Upper(p.descricao), Locate('MM', Upper(p.descricao)) +
        2))
        Else Concat(Left(Upper(p.descricao),
        Length(SubString_Index(p.descricao, 'X', 2))),
        SubString(Upper(p.descricao), Locate('MM', Upper(p.descricao)) + 2))
      End) As bobina,
      Max(d.dataEntrada) As dataEntrada
    From itemdocumentoestoque ide
      Left Join documentoestoque d On d.id = ide.idDocumentoEstoque
      Left Join produto p On p.id = ide.idProduto
    Where (ide.idTipoMovimentacao In (11, 71, 116, 115, 114, 113, 112, 111,
      142)) And (ide.idSetorEntrada In (2, 19, 20, 32)) And
      (Replace(Upper(p.descricao), 'INOX', 'INO') Like 'BOBINA%X%MM%') And
      (Replace(Upper(p.descricao), 'INOX', 'INO') Not Like '%ETIQUETA%')
    Group By (Case
        When Length(p.descricao) - Length(Replace(Upper(p.descricao), 'X',
        '')) = 1 Then Concat(Trim(SubString_Index(Upper(p.descricao), 'X',
        1)), SubString(Upper(p.descricao), Locate('MM', Upper(p.descricao)) +
        2))
        Else Concat(Left(Upper(p.descricao),
        Length(SubString_Index(p.descricao, 'X', 2))),
        SubString(Upper(p.descricao), Locate('MM', Upper(p.descricao)) + 2))
      End)) ud
    Left Join (Select ide.id,
      ide.idDocumentoEstoque As idDocumentoEntrada,
      ide.idProduto,
      ide.idTipoMovimentacao,
      d.dataEntrada,
      d.valorTotalFrete,
      p.nome,
      Replace(Case When Upper(p.descricao) Like 'BOBINA%X%MM%' Then (Case
          When Length(p.descricao) - Length(Replace(Upper(p.descricao), 'X',
          '')) = 1 Then Concat(Trim(SubString_Index(Upper(p.descricao), 'X',
          1)), SubString(Upper(p.descricao), Locate('MM', Upper(p.descricao))
          + 2))
          Else Concat(Left(Upper(p.descricao),
          Length(SubString_Index(p.descricao, 'X', 2))),
          SubString(Upper(p.descricao), Locate('MM', Upper(p.descricao)) + 2))
        End) Else Upper(p.descricao)
      End, 'BOBINA INTEIRA', 'BOBINA SLITADA') As bobina,
      ide.qtde,
      ide.valorUnitario
    From itemdocumentoestoque ide
      Left Join documentoestoque d On d.id = ide.idDocumentoEstoque
      Left Join produto p On p.id = ide.idProduto
    Where (ide.idTipoMovimentacao In (11, 71, 116, 115, 114, 113, 112, 111,
      142)) And (ide.idSetorEntrada In (2, 19, 20, 32))) m
      On (m.bobina = ud.bobina) And (ud.dataEntrada = m.dataEntrada)
    Left Join tributacao t On t.idItemDocumentoEstoque = m.id
    Left Join (Select ide.idDocumentoEstoque As idDocumentoEntrada,
      Count(Distinct ide.idProduto) As qtditens
    From itemdocumentoestoque ide
      Left Join documentoestoque d On d.id = ide.idDocumentoEstoque
      Left Join produto p On p.id = ide.idProduto
    Where (ide.idSetorEntrada In (2, 19, 20, 32)) And
      (ide.idTipoMovimentacao In (11, 71, 116, 115, 114, 113, 112, 111, 142))
    Group By ide.idDocumentoEstoque) q On q.idDocumentoEntrada =
      m.idDocumentoEntrada
    Left Join (Select ide.idDocumentoEstoque As idDocumentoEntrada,
      Sum((ide.qtde * ide.valorUnitario)) As totalnota
    From itemdocumentoestoque ide
      Left Join documentoestoque d On d.id = ide.idDocumentoEstoque
      Left Join produto p On p.id = ide.idProduto
    Where (ide.idTipoMovimentacao In (11, 71, 116, 115, 114, 113, 112, 111,
      142)) And (ide.idSetorEntrada In (2, 19, 20, 32))
    Group By ide.idDocumentoEstoque) tn On tn.idDocumentoEntrada =
      m.idDocumentoEntrada
    Left Join (Select documentoestoque.id,
      Case When documentoestoque.modalidadeTransporte = 0 Then 'CIF'
        When documentoestoque.modalidadeTransporte = 1 Then 'FOB'
        When documentoestoque.modalidadeTransporte = 2 Then 'Terceiros'
        When documentoestoque.modalidadeTransporte = 3 Then 'Remetente'
        When documentoestoque.modalidadeTransporte = 4 Then 'Destinatário'
        Else 'Sem Transporte' End As modalidadeTransporte,
      documentoestoque.valorTotalFrete
    From documentoestoque) mf On mf.id = m.idDocumentoEntrada
    Left Join produto p On m.idProduto = p.id
    Left Join (Select df.id,
      df.chaveAcessoNFe As chaveentradaslitada,
      df.idDocumentoEntrada As documentoentradaslitada,
      nf.idDocumentoEstoque As documentosaidainteira,
      de.idTipoMovimentacao,
      ide.idProduto,
      dfe.chaveAcessoNFe,
      nfe.idDocumentoEstoque As documentoentradainteira,
      t.aliquotaICMS,
      IfNull(t.aliquotaCOFINS, 7.6) As aliquotaCOFINS,
      IfNull(t.aliquotaPIS, 1.65) As aliquotaPIS,
      t.aliquotaIPI
    From documentofiscal df
      Left Join nfe nf On nf.chave = df.chaveAcessoNFe
      Left Join documentoestoque de On de.id = nf.idDocumentoEstoque
      Left Join documentofiscal dfe On nf.idDocumentoEstoque =
        dfe.idDocumentoSaida
      Left Join nfe nfe On nfe.chave = dfe.chaveAcessoNFe
      Left Join itemdocumentoestoque ide On ide.idDocumentoEstoque =
        nfe.idDocumentoEstoque
      Left Join tributacao t On t.idItemDocumentoEstoque = ide.id
    Where de.idTipoMovimentacao In (70, 142)) bob
      On bob.documentoentradaslitada = m.idDocumentoEntrada
  Where Case When Upper(p.descricao) Like 'BOBINA%X%MM%' Then 1 Else 0 End = 1
  Group By ud.bobina,
    ud.dataEntrada) bobin On bobin.bobina = cunit.bobina
  Left Join (Select apv.idProduto,
    alo.opcao
  From atributoprodutovalor apv
    Left Join atributolistaopcao alo On alo.id = apv.idListaOpcao
  Where apv.idAtributo = 540 and apv.idproduto in (__IN_IDS__)) tm On tm.idProduto = cunit.idProduto
