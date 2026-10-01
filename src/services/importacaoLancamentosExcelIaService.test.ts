import { describe, it, expect, vi } from 'vitest'
import {
  sugerirMapeamentoHeuristico,
  processarLinhasPlanilha,
  gerarPlanilhaModeloExcel,
  colIndexToExcelLetter,
  formatarNomeColunaExcel,
  sanitizarValorCelula,
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
