import { describe, it, expect, vi } from 'vitest'
import {
  sugerirMapeamentoHeuristico,
  processarLinhasPlanilha,
  gerarPlanilhaModeloExcel,
  gerarPlanilhaModeloMatrizMensalExcel,
  colIndexToExcelLetter,
  formatarNomeColunaExcel,
  sanitizarValorCelula,
  getUltimoDiaDoMes,
  formatarUltimoDiaDoMes,
  getRotulosColunasMatrizMensal,
  identificarMesDaColuna,
  detectarFormatoMatrizMensal,
} from './importacaoLancamentosExcelIaService'
import type { PlanoContaRecord } from '@/types/finance'
import * as XLSX from 'xlsx'

describe('importacaoLancamentosExcelIaService', () => {
  describe('sugerirMapeamentoHeuristico com novo modelo Excel', () => {
    it('deve priorizar e reconhecer exatamente as 4 colunas essenciais do modelo', () => {
      const headers = [
        'Data do Lançamento',
        'Código da Conta',
        'Nome da Conta',
        'Valor',
        'Histórico',
        'Tipo',
        'Centro de Custo',
        'Documento',
        'Forma de Pagamento',
      ]

      const mapping = sugerirMapeamentoHeuristico(headers)

      expect(mapping.data).toBe('Data do Lançamento')
      expect(mapping.codigoConta).toBe('Código da Conta')
      expect(mapping.nomeConta).toBe('Nome da Conta')
      expect(mapping.valor).toBe('Valor')
      expect(mapping.historico).toBe('Histórico')
      expect(mapping.tipo).toBe('Tipo')
      expect(mapping.centroCusto).toBe('Centro de Custo')
      expect(mapping.documento).toBe('Documento')
      expect(mapping.formaPagamento).toBe('Forma de Pagamento')
    })

    it('deve funcionar com variações sem acentuação das 4 colunas essenciais', () => {
      const headers = ['Data do Lancamento', 'Codigo da Conta', 'Nome da Conta', 'Valor']

      const mapping = sugerirMapeamentoHeuristico(headers)

      expect(mapping.data).toBe('Data do Lancamento')
      expect(mapping.codigoConta).toBe('Codigo da Conta')
      expect(mapping.nomeConta).toBe('Nome da Conta')
      expect(mapping.valor).toBe('Valor')
    })
  })

  describe('processarLinhasPlanilha - Resolução de contas por código e nome', () => {
    const planoContasMock: PlanoContaRecord[] = [
      {
        id: 'pc-1',
        empresa: 'emp-1',
        codigo: '3.1.01',
        codigo_empresa: 'REC-01',
        descricao: 'Prestação de Serviços',
        tipo_conta: 'analitica',
        expand: {
          conta: {
            id: 'c-1',
            nome: 'Receita de Serviços Especializados',
            codigo: '3.1.01',
            tipo: 'Receita',
          },
        },
      } as unknown as PlanoContaRecord,
      {
        id: 'pc-2',
        empresa: 'emp-1',
        codigo: '4.1.01',
        codigo_empresa: 'DESP-ALUG',
        descricao: 'Aluguel do Galpão',
        tipo_conta: 'analitica',
        expand: {
          conta: {
            id: 'c-2',
            nome: 'Aluguéis e Condomínios',
            codigo: '4.1.01',
            tipo: 'Despesa',
          },
        },
      } as unknown as PlanoContaRecord,
    ]

    it('deve vincular a conta PRIMEIRO pelo código informado na linha', () => {
      const rawRows = [
        {
          'Data do Lançamento': '10/02/2025',
          'Código da Conta': 'REC-01',
          'Nome da Conta': 'Outro Nome Qualquer',
          Valor: '1.500,00',
          Histórico: 'Recebimento de cliente',
        },
      ]

      const mapping = {
        data: 'Data do Lançamento',
        codigoConta: 'Código da Conta',
        nomeConta: 'Nome da Conta',
        valor: 'Valor',
        historico: 'Histórico',
        tipo: '',
        centroCusto: '',
        documento: '',
        formaPagamento: '',
      }

      const res = processarLinhasPlanilha({
        rawRows,
        mapping,
        anoSelecionado: 2025,
        mesInicial: 1,
        mesFinal: 12,
        planoContas: planoContasMock,
      })

      expect(res.linhas).toHaveLength(1)
      const l = res.linhas[0]
      expect(l.status).toBe('valido')
      expect(l.planoContaId).toBe('pc-1')
      expect(l.matchConfidence).toBe('codigo_empresa')
      expect(l.valor).toBe(1500)
    })

    it('se o código não existir, deve tentar pelo nome da conta', () => {
      const rawRows = [
        {
          'Data do Lançamento': '15/03/2025',
          'Código da Conta': 'COD-INEXISTENTE',
          'Nome da Conta': 'Aluguéis e Condomínios',
          Valor: '2.300,00',
        },
      ]

      const mapping = {
        data: 'Data do Lançamento',
        codigoConta: 'Código da Conta',
        nomeConta: 'Nome da Conta',
        valor: 'Valor',
        historico: '',
        tipo: '',
        centroCusto: '',
        documento: '',
        formaPagamento: '',
      }

      const res = processarLinhasPlanilha({
        rawRows,
        mapping,
        anoSelecionado: 2025,
        mesInicial: 1,
        mesFinal: 12,
        planoContas: planoContasMock,
      })

      expect(res.linhas).toHaveLength(1)
      const l = res.linhas[0]
      expect(l.planoContaId).toBe('pc-2')
      expect(l.matchConfidence).toBe('exato')
      expect(l.valor).toBe(2300)
    })

    it('deve filtrar e sinalizar lançamentos fora do ano ou do período informado', () => {
      const rawRows = [
        {
          'Data do Lançamento': '10/05/2024', // Ano diferente (2024 vs 2025)
          'Código da Conta': 'REC-01',
          'Nome da Conta': 'Receita',
          Valor: '100,00',
        },
        {
          'Data do Lançamento': '10/08/2025', // Mês 8 (período selecionado: mês 1 a 3)
          'Código da Conta': 'REC-01',
          'Nome da Conta': 'Receita',
          Valor: '200,00',
        },
      ]

      const mapping = {
        data: 'Data do Lançamento',
        codigoConta: 'Código da Conta',
        nomeConta: 'Nome da Conta',
        valor: 'Valor',
        historico: '',
        tipo: '',
        centroCusto: '',
        documento: '',
        formaPagamento: '',
      }

      const res = processarLinhasPlanilha({
        rawRows,
        mapping,
        anoSelecionado: 2025,
        mesInicial: 1,
        mesFinal: 3,
        planoContas: planoContasMock,
      })

      expect(res.resumo.totalForaPeriodo).toBe(2)
      expect(res.linhas[0].status).toBe('fora_periodo')
      expect(res.linhas[1].status).toBe('fora_periodo')
    })
  })

  describe('colIndexToExcelLetter e utilitários de coluna', () => {
    it('deve converter índices numéricos para letras estilo Excel corretamente', () => {
      expect(colIndexToExcelLetter(0)).toBe('A')
      expect(colIndexToExcelLetter(1)).toBe('B')
      expect(colIndexToExcelLetter(25)).toBe('Z')
      expect(colIndexToExcelLetter(26)).toBe('AA')
      expect(colIndexToExcelLetter(27)).toBe('AB')
      expect(colIndexToExcelLetter(51)).toBe('AZ')
      expect(colIndexToExcelLetter(52)).toBe('BA')
    })

    it('deve formatar cabeçalhos cru __EMPTY ou vazios amigavelmente', () => {
      expect(formatarNomeColunaExcel('__EMPTY', 0)).toBe('Coluna A (Sem cabeçalho)')
      expect(formatarNomeColunaExcel('__EMPTY_1', 1)).toBe('Coluna B (Sem cabeçalho)')
      expect(formatarNomeColunaExcel('__EMPTY_2', 2)).toBe('Coluna C (Sem cabeçalho)')
      expect(formatarNomeColunaExcel('_EMPTY_', 3)).toBe('Coluna D (Sem cabeçalho)')
      expect(formatarNomeColunaExcel('', 0)).toBe('Coluna A (Sem cabeçalho)')
      expect(formatarNomeColunaExcel('Data do Lançamento', 0)).toBe('Data do Lançamento')
    })

    it('deve sanitizar valores de célula removendo strings cruas de EMPTY', () => {
      expect(sanitizarValorCelula('__EMPTY')).toBe('')
      expect(sanitizarValorCelula('__EMPTY_1')).toBe('')
      expect(sanitizarValorCelula('_EMPTY_')).toBe('')
      expect(sanitizarValorCelula(null)).toBe('')
      expect(sanitizarValorCelula(undefined)).toBe('')
      expect(sanitizarValorCelula('Pagamento Fornecedor')).toBe('Pagamento Fornecedor')
    })
  })

  describe('Matriz Mensal (Padrão: Coluna A = Contas, Colunas B..M = Último dia do mês)', () => {
    const mockPlanoContasLocal: PlanoContaRecord[] = [
      {
        id: 'pc_aluguel',
        empresa: 'emp-1',
        codigo: '4.1.01',
        descricao: 'Aluguel Comercial',
        tipo_conta: 'analitica',
        expand: {
          conta: {
            id: 'c-alug',
            nome: 'Aluguel Comercial',
            codigo: '4.1.01',
            tipo: 'Despesa',
          },
        },
      } as unknown as PlanoContaRecord,
      {
        id: 'pc_energia',
        empresa: 'emp-1',
        codigo: '4.1.02',
        codigo_empresa: 'ENERG-01',
        descricao: 'Energia Elétrica',
        tipo_conta: 'analitica',
        expand: {
          conta: {
            id: 'c-energ',
            nome: 'Energia Elétrica',
            codigo: '4.1.02',
            tipo: 'Despesa',
          },
        },
      } as unknown as PlanoContaRecord,
    ]

    it('deve calcular corretamente o último dia do mês para anos normais e bissextos (28/02 vs 29/02)', () => {
      // 2027 não é bissexto: fev = 28
      expect(getUltimoDiaDoMes(2027, 1)).toBe(31)
      expect(getUltimoDiaDoMes(2027, 2)).toBe(28)
      expect(getUltimoDiaDoMes(2027, 3)).toBe(31)
      expect(getUltimoDiaDoMes(2027, 4)).toBe(30)
      expect(getUltimoDiaDoMes(2027, 5)).toBe(31)
      expect(getUltimoDiaDoMes(2027, 6)).toBe(30)
      expect(getUltimoDiaDoMes(2027, 7)).toBe(31)
      expect(getUltimoDiaDoMes(2027, 8)).toBe(31)
      expect(getUltimoDiaDoMes(2027, 9)).toBe(30)
      expect(getUltimoDiaDoMes(2027, 10)).toBe(31)
      expect(getUltimoDiaDoMes(2027, 11)).toBe(30)
      expect(getUltimoDiaDoMes(2027, 12)).toBe(31)
      expect(formatarUltimoDiaDoMes(2027, 2)).toBe('28/02/2027')

      // 2024 e 2028 são bissextos: fev = 29
      expect(getUltimoDiaDoMes(2024, 2)).toBe(29)
      expect(formatarUltimoDiaDoMes(2024, 2)).toBe('29/02/2024')
      expect(getUltimoDiaDoMes(2028, 2)).toBe(29)
      expect(formatarUltimoDiaDoMes(2028, 2)).toBe('29/02/2028')

      // Ano centenário não bissexto (2100) vs ano quadricentenário bissexto (2000)
      expect(getUltimoDiaDoMes(2100, 2)).toBe(28)
      expect(getUltimoDiaDoMes(2000, 2)).toBe(29)
    })

    it('deve gerar rótulos com 29/02 em ano bissexto (ex: 2024 e 2028)', () => {
      const rotulos2024 = getRotulosColunasMatrizMensal(2024)
      expect(rotulos2024[2]).toBe('29/02/2024')
      expect(rotulos2024[1]).toBe('31/01/2024')
      expect(rotulos2024[12]).toBe('31/12/2024')

      const rotulos2028 = getRotulosColunasMatrizMensal(2028)
      expect(rotulos2028[2]).toBe('29/02/2028')
    })

    it('deve gerar os 12 rótulos de meses com dia/mês + ano selecionado', () => {
      const rotulos2027 = getRotulosColunasMatrizMensal(2027)
      expect(rotulos2027[1]).toBe('31/01/2027')
      expect(rotulos2027[2]).toBe('28/02/2027')
      expect(rotulos2027[3]).toBe('31/03/2027')
      expect(rotulos2027[4]).toBe('30/04/2027')
      expect(rotulos2027[5]).toBe('31/05/2027')
      expect(rotulos2027[6]).toBe('30/06/2027')
      expect(rotulos2027[7]).toBe('31/07/2027')
      expect(rotulos2027[8]).toBe('31/08/2027')
      expect(rotulos2027[9]).toBe('30/09/2027')
      expect(rotulos2027[10]).toBe('31/10/2027')
      expect(rotulos2027[11]).toBe('30/11/2027')
      expect(rotulos2027[12]).toBe('31/12/2027')
    })

    it('deve identificar o mês da coluna com variações razoáveis', () => {
      expect(identificarMesDaColuna('31/01', 2027)).toBe(1)
      expect(identificarMesDaColuna('28/02/2027', 2027)).toBe(2)
      expect(identificarMesDaColuna('31-03-2027', 2027)).toBe(3)
      expect(identificarMesDaColuna('jan', 2027)).toBe(1)
      expect(identificarMesDaColuna('fevereiro', 2027)).toBe(2)
      expect(identificarMesDaColuna('dez', 2027)).toBe(12)
    })

    it('deve detectar o formato matriz mensal com Coluna A e colunas de meses', () => {
      const headers = [
        'Conta das despesas',
        '31/01/2027',
        '28/02/2027',
        '31/03/2027',
        '30/04/2027',
        '31/05/2027',
        '30/06/2027',
        '31/07/2027',
        '31/08/2027',
        '30/09/2027',
        '31/10/2027',
        '30/11/2027',
        '31/12/2027',
      ]
      const check = detectarFormatoMatrizMensal(headers, 2027)
      expect(check.isMatriz).toBe(true)
      expect(check.colunaConta).toBe('Conta das despesas')
      expect(check.colunasMeses[1]).toBe('31/01/2027')
      expect(check.colunasMeses[12]).toBe('31/12/2027')

      const mapping = sugerirMapeamentoHeuristico(headers, 2027)
      expect(mapping.formato).toBe('matriz_mensal')
      expect(mapping.colunaContaMatriz).toBe('Conta das despesas')
      expect(mapping.colunasMesesMatriz?.[1]).toBe('31/01/2027')
    })

    it('deve desdobrar cada linha da matriz mensal em até 12 lançamentos com último dia do mês', () => {
      const headers = [
        'Conta das despesas',
        '31/01/2027',
        '28/02/2027',
        '31/03/2027',
        '30/04/2027',
        '31/05/2027',
        '30/06/2027',
        '31/07/2027',
        '31/08/2027',
        '30/09/2027',
        '31/10/2027',
        '30/11/2027',
        '31/12/2027',
      ]
      const mapping = sugerirMapeamentoHeuristico(headers, 2027)

      const rawRows = [
        {
          'Conta das despesas': '4.1.01 - Aluguel Comercial',
          '31/01/2027': 2500,
          '28/02/2027': '2.500,00',
          '31/03/2027': '—', // célula vazia/traço ignorada
          '30/04/2027': '', // vazia ignorada
          '31/05/2027': 2600,
        },
      ]

      const resultado = processarLinhasPlanilha({
        rawRows,
        mapping,
        planoContas: mockPlanoContasLocal,
        anoSelecionado: 2027,
        mesInicial: 1,
        mesFinal: 12,
      })

      // Linhas geradas: jan (2500), fev (2500), mai (2600) -> 3 lançamentos
      expect(resultado.linhas.length).toBe(3)

      const jan = resultado.linhas.find((l) => l.mes === 1)
      expect(jan).toBeDefined()
      expect(jan?.dataStr).toBe('31/01/2027')
      expect(jan?.dataIso).toBe('2027-01-31')
      expect(jan?.valor).toBe(2500)
      expect(jan?.tipo).toBe('Despesa')
      expect(jan?.planoContaId).toBe('pc_aluguel')

      const fev = resultado.linhas.find((l) => l.mes === 2)
      expect(fev).toBeDefined()
      expect(fev?.dataStr).toBe('28/02/2027')
      expect(fev?.valor).toBe(2500)

      const mai = resultado.linhas.find((l) => l.mes === 5)
      expect(mai).toBeDefined()
      expect(mai?.dataStr).toBe('31/05/2027')
      expect(mai?.valor).toBe(2600)
    })

    it('deve desdobrar ano bissexto (2024) gerando 29/02/2024 no lançamento de fevereiro', () => {
      const headers2024 = ['Conta', '31/01/2024', '29/02/2024', '31/03/2024']
      const mapping = sugerirMapeamentoHeuristico(headers2024, 2024)

      const rawRows = [
        {
          Conta: 'ENERG-01 - Energia Elétrica',
          '31/01/2024': 850.5,
          '29/02/2024': '920,00',
          '31/03/2024': 0, // valor zero ignorado
        },
      ]

      const resultado = processarLinhasPlanilha({
        rawRows,
        mapping,
        planoContas: mockPlanoContasLocal,
        anoSelecionado: 2024,
        mesInicial: 1,
        mesFinal: 12,
      })

      expect(resultado.linhas.length).toBe(2)
      const fev = resultado.linhas.find((l) => l.mes === 2)
      expect(fev).toBeDefined()
      expect(fev?.dataStr).toBe('29/02/2024')
      expect(fev?.dataIso).toBe('2024-02-29')
      expect(fev?.valor).toBe(920)
      expect(fev?.planoContaId).toBe('pc_energia')
      expect(fev?.matchConfidence).toBe('codigo_empresa')
    })

    it('deve ignorar corretamente células vazias, hífens, traços, zeros ou nulas', () => {
      const headers = ['Conta', '31/01/2027', '28/02/2027', '31/03/2027', '30/04/2027']
      const mapping = sugerirMapeamentoHeuristico(headers, 2027)

      const rawRows = [
        {
          Conta: '4.1.01 - Aluguel Comercial',
          '31/01/2027': '—',
          '28/02/2027': '-',
          '31/03/2027': '0,00',
          '30/04/2027': null,
        },
      ]

      const resultado = processarLinhasPlanilha({
        rawRows,
        mapping,
        planoContas: mockPlanoContasLocal,
        anoSelecionado: 2027,
        mesInicial: 1,
        mesFinal: 12,
      })

      expect(resultado.linhas.length).toBe(0)
      expect(resultado.resumo.totalValidos).toBe(0)
    })

    it('deve respeitar a seleção de meses individuais via mesesHabilitados', () => {
      const headers = ['Conta', '31/01/2027', '28/02/2027', '31/03/2027', '30/04/2027']
      const mapping = sugerirMapeamentoHeuristico(headers, 2027)

      const rawRows = [
        {
          Conta: '4.1.01 - Aluguel Comercial',
          '31/01/2027': 1000,
          '28/02/2027': 1000,
          '31/03/2027': 1000,
          '30/04/2027': 1000,
        },
      ]

      // Apenas meses 1 e 3 habilitados
      const resultado = processarLinhasPlanilha({
        rawRows,
        mapping,
        planoContas: mockPlanoContasLocal,
        anoSelecionado: 2027,
        mesInicial: 1,
        mesFinal: 12,
        mesesHabilitados: new Set([1, 3]),
      })

      const jan = resultado.linhas.find((l) => l.mes === 1)
      const fev = resultado.linhas.find((l) => l.mes === 2)
      const mar = resultado.linhas.find((l) => l.mes === 3)
      const abr = resultado.linhas.find((l) => l.mes === 4)

      expect(jan?.status).toBe('valido')
      expect(fev?.status).toBe('fora_periodo')
      expect(mar?.status).toBe('valido')
      expect(abr?.status).toBe('fora_periodo')
      expect(resultado.resumo.totalNoPeriodo).toBe(2)
      expect(resultado.resumo.totalForaPeriodo).toBe(2)
    })

    it('deve marcar lançamentos como fora do período se o mês selecionado não englobar', () => {
      const headers = ['Conta', '31/01/2027', '28/02/2027', '31/03/2027', '30/04/2027']
      const mapping = sugerirMapeamentoHeuristico(headers, 2027)

      const rawRows = [
        {
          Conta: '4.1.01 - Aluguel Comercial',
          '31/01/2027': 1000,
          '28/02/2027': 1000,
          '31/03/2027': 1000,
        },
      ]

      // Apenas mês 1 (Janeiro) selecionado
      const resultado = processarLinhasPlanilha({
        rawRows,
        mapping,
        planoContas: mockPlanoContasLocal,
        anoSelecionado: 2027,
        mesInicial: 1,
        mesFinal: 1,
      })

      const jan = resultado.linhas.find((l) => l.mes === 1)
      const fev = resultado.linhas.find((l) => l.mes === 2)
      const mar = resultado.linhas.find((l) => l.mes === 3)

      expect(jan?.status).toBe('valido')
      expect(fev?.status).toBe('fora_periodo')
      expect(mar?.status).toBe('fora_periodo')
      expect(resultado.resumo.totalForaPeriodo).toBe(2)
      expect(resultado.resumo.totalNoPeriodo).toBe(1)
    })

    it('deve gerar planilha no formato modelo matriz mensal com sucesso', () => {
      const writeFileSpy = vi.spyOn(XLSX, 'writeFile').mockImplementation(() => {})

      gerarPlanilhaModeloMatrizMensalExcel({
        ano: 2027,
        nomeEmpresa: 'Minha Empresa',
        planoContas: mockPlanoContasLocal,
      })

      expect(writeFileSpy).toHaveBeenCalled()
      const callArgs = writeFileSpy.mock.calls[0]
      const workbook = callArgs[0] as XLSX.WorkBook
      const fileName = callArgs[1]

      expect(fileName).toContain('modelo_matriz_despesas_minha_empresa_2027.xlsx')
      expect(workbook.SheetNames).toContain('Matriz_Despesas_2027')
      expect(workbook.SheetNames).toContain('Instruções')

      const sheetData = XLSX.utils.sheet_to_json<Record<string, unknown>>(
        workbook.Sheets['Matriz_Despesas_2027'],
      )
      expect(sheetData.length).toBeGreaterThan(0)
      const firstRow = sheetData[0]
      expect(firstRow).toHaveProperty('Conta das despesas')
      expect(firstRow).toHaveProperty('31/01/2027')
      expect(firstRow).toHaveProperty('28/02/2027')
      expect(firstRow).toHaveProperty('31/12/2027')

      writeFileSpy.mockRestore()
    })
  })

  describe('gerarPlanilhaModeloExcel', () => {
    it('deve gerar planilha Excel com abas e colunas corretas', () => {
      const writeFileSpy = vi.spyOn(XLSX, 'writeFile').mockImplementation(() => {})

      gerarPlanilhaModeloExcel({
        ano: 2025,
        nomeEmpresa: 'Empresa Teste',
        planoContas: [
          {
            id: 'pc-1',
            codigo: '3.1.01',
            codigo_empresa: 'REC-01',
            descricao: 'Receita de Teste',
            tipo_conta: 'analitica',
            totalizadora: false,
            expand: {
              conta: {
                id: 'c-1',
                nome: 'Receita Teste',
                tipo: 'Receita',
              },
            },
          } as unknown as PlanoContaRecord,
        ],
      })

      expect(writeFileSpy).toHaveBeenCalled()
      const callArgs = writeFileSpy.mock.calls[0]
      const workbook = callArgs[0] as XLSX.WorkBook
      const fileName = callArgs[1]

      expect(fileName).toContain('modelo_lancamentos_empresa_teste_2025.xlsx')
      expect(workbook.SheetNames).toContain('Modelo_Lancamentos')
      expect(workbook.SheetNames).toContain('Instruções')
      expect(workbook.SheetNames).toContain('Contas_Disponiveis')

      const sheetData = XLSX.utils.sheet_to_json<Record<string, unknown>>(
        workbook.Sheets['Modelo_Lancamentos'],
      )
      expect(sheetData.length).toBeGreaterThan(0)
      const firstRow = sheetData[0]
      expect(firstRow).toHaveProperty('Data do Lançamento')
      expect(firstRow).toHaveProperty('Código da Conta')
      expect(firstRow).toHaveProperty('Nome da Conta')
      expect(firstRow).toHaveProperty('Valor')

      writeFileSpy.mockRestore()
    })
  })
})
