import { describe, it, expect, vi } from 'vitest'
import * as XLSX from 'xlsx'
import {
  exportarDreGerencialExcel,
  exportarDreGerencialCsv,
  exportarDreComparativoExcel,
  exportarDreComparativoCsv,
} from './dreGerencialExport'
import { calcularDreGerencialMatriz, calcularComparativoDre } from './dreGerencialCalculo'
import { gerarListaMeses } from './dreGerencialTypes'
import type {
  ContaRecord,
  LancamentoRecord,
  PlanoContaRecord,
  EmpresaRecord,
} from '@/types/finance'

describe('DRE Gerencial - Exportação Excel e CSV', () => {
  const meses = gerarListaMeses(2024, 1, 3)

  const empresaMock: EmpresaRecord = {
    id: 'emp-1',
    collectionId: 'empresas',
    collectionName: 'empresas',
    user: 'u-1',
    nome: 'Empresa Teste S/A',
    cnpj: '00.000.000/0001-91',
    segmento: 'Indústria',
    created: '',
    updated: '',
  }

  const contasMock: ContaRecord[] = [
    {
      id: 'c-rec',
      collectionId: 'contas',
      collectionName: 'contas',
      user: 'u-1',
      nome: 'Receita Bruta de Vendas',
      codigo: '3.1.1.01',
      tipo: 'Receita',
      classificacao_dre: 'Receita',
      created: '',
    },
    {
      id: 'c-custo-var',
      collectionId: 'contas',
      collectionName: 'contas',
      user: 'u-1',
      nome: 'Comissões de Vendas',
      codigo: '4.1.2.01',
      tipo: 'Despesa',
      classificacao_dre: 'Despesa Variável',
      created: '',
    },
    {
      id: 'c-fixa',
      collectionId: 'contas',
      collectionName: 'contas',
      user: 'u-1',
      nome: 'Aluguel Administrativo',
      codigo: '4.2.1.05',
      tipo: 'Despesa',
      classificacao_dre: 'Despesa Fixa',
      created: '',
    },
  ]

  const planosMock: PlanoContaRecord[] = [
    {
      id: 'pc-1',
      collectionId: 'plano_contas',
      collectionName: 'plano_contas',
      user: 'u-1',
      codigo: '3.1.1.01',
      conta: 'c-rec',
      centro: 'cc-1',
      created: '',
    },
    {
      id: 'pc-2',
      collectionId: 'plano_contas',
      collectionName: 'plano_contas',
      user: 'u-1',
      codigo: '4.1.2.01',
      conta: 'c-custo-var',
      centro: 'cc-1',
      created: '',
    },
    {
      id: 'pc-3',
      collectionId: 'plano_contas',
      collectionName: 'plano_contas',
      user: 'u-1',
      codigo: '4.2.1.05',
      conta: 'c-fixa',
      centro: 'cc-1',
      created: '',
    },
  ]

  const lancamentosMock: LancamentoRecord[] = [
    {
      id: 'l-1',
      collectionId: 'lancamentos',
      collectionName: 'lancamentos',
      empresa: 'emp-1',
      plano_conta: 'pc-1',
      data: '2024-01-15',
      valor: 100000,
      user: 'u-1',
      created: '',
      expand: {
        plano_conta: {
          id: 'pc-1',
          collectionId: 'plano_contas',
          collectionName: 'plano_contas',
          user: 'u-1',
          codigo: '3.1.1.01',
          conta: 'c-rec',
          centro: 'cc-1',
          created: '',
          expand: { conta: contasMock[0] },
        },
      },
    },
    {
      id: 'l-2',
      collectionId: 'lancamentos',
      collectionName: 'lancamentos',
      empresa: 'emp-1',
      plano_conta: 'pc-2',
      data: '2024-01-20',
      valor: 15000,
      user: 'u-1',
      created: '',
      expand: {
        plano_conta: {
          id: 'pc-2',
          collectionId: 'plano_contas',
          collectionName: 'plano_contas',
          user: 'u-1',
          codigo: '4.1.2.01',
          conta: 'c-custo-var',
          centro: 'cc-1',
          created: '',
          expand: { conta: contasMock[1] },
        },
      },
    },
    {
      id: 'l-3',
      collectionId: 'lancamentos',
      collectionName: 'lancamentos',
      empresa: 'emp-1',
      plano_conta: 'pc-3',
      data: '2024-02-10',
      valor: 20000,
      user: 'u-1',
      created: '',
      expand: {
        plano_conta: {
          id: 'pc-3',
          collectionId: 'plano_contas',
          collectionName: 'plano_contas',
          user: 'u-1',
          codigo: '4.2.1.05',
          conta: 'c-fixa',
          centro: 'cc-1',
          created: '',
          expand: { conta: contasMock[2] },
        },
      },
    },
  ]

  const matriz = calcularDreGerencialMatriz(lancamentosMock, contasMock, meses, planosMock)

  it('gera planilha Excel da DRE com nome contendo empresa e exercício e estrutura completa', () => {
    const writeSpy = vi.spyOn(XLSX, 'writeFile').mockImplementation(() => {})
    const appendSpy = vi.spyOn(XLSX.utils, 'book_append_sheet')

    exportarDreGerencialExcel(matriz, {
      empresa: empresaMock,
      exercicioAno: 2024,
      periodoDescricao: 'Jan/24 a Mar/24',
    })

    expect(writeSpy).toHaveBeenCalledTimes(1)
    const callArgs = writeSpy.mock.calls[0]
    const fileName = callArgs[1] as string

    // 1. Verifica formato do nome do arquivo
    expect(fileName).toMatch(/^DRE_Gerencial_Empresa_Teste_S_A_2024\.xlsx$/)

    // 2. Verifica a estrutura da planilha
    expect(appendSpy).toHaveBeenCalledTimes(1)
    const ws = appendSpy.mock.calls[0][1]
    const sheetData = XLSX.utils.sheet_to_json<any>(ws)

    // Cabeçalho de Metadados / Contexto
    expect(sheetData.some((r) => r['Código']?.includes('DEMONSTRAÇÃO DO RESULTADO'))).toBe(true)
    expect(sheetData.some((r) => r['Código']?.includes('Empresa Teste S/A'))).toBe(true)

    // Seções principais
    expect(
      sheetData.some((r) => r['Nível'] === 'Seção' && r['Descrição']?.includes('RECEITAS')),
    ).toBe(true)
    expect(
      sheetData.some(
        (r) => r['Nível'] === 'Seção' && r['Descrição']?.includes('DESPESAS VARIÁVEIS'),
      ),
    ).toBe(true)
    expect(
      sheetData.some((r) => r['Nível'] === 'Seção' && r['Descrição']?.includes('DESPESAS FIXAS')),
    ).toBe(true)

    // Contas com código e descrição
    const rowRec = sheetData.find((r) => r['Código'] === '3.1.1.01')
    expect(rowRec).toBeDefined()
    expect(rowRec?.['Descrição']).toContain('Receita Bruta de Vendas')
    expect(rowRec?.['Jan/24']).toBe(100000)
    expect(rowRec?.['Total do Período']).toBe(100000)

    // Subtotais de seção
    expect(
      sheetData.some(
        (r) => r['Nível'] === 'Subtotal Seção' && r['Descrição']?.includes('SUBTOTAL'),
      ),
    ).toBe(true)

    // Linha Totalizadora: Lucro ou Prejuízo (Resultado)
    const rowResultado = sheetData.find((r) => r['Nível'] === 'Resultado Consolidado')
    expect(rowResultado).toBeDefined()
    // Jan: 100000 - 15000 = 85000
    expect(rowResultado?.['Jan/24']).toBe(85000)
    // Fev: 0 - 20000 = -20000
    expect(rowResultado?.['Fev/24']).toBe(-20000)
    // Total período = 65000
    expect(rowResultado?.['Total do Período']).toBe(65000)

    // Indicador: Margem Líquida
    const rowMargem = sheetData.find((r) => r['Nível'] === 'Indicador')
    expect(rowMargem).toBeDefined()
    expect(rowMargem?.['Jan/24']).toBe('85.00%')
    expect(rowMargem?.['Total do Período']).toBe('65.00%')

    writeSpy.mockRestore()
    appendSpy.mockRestore()
  })

  it('exporta com identificação do Grupo Econômico quando um Grupo estiver selecionado', () => {
    const writeSpy = vi.spyOn(XLSX, 'writeFile').mockImplementation(() => {})

    exportarDreGerencialExcel(matriz, {
      isGrupo: true,
      nomeGrupo: 'Alfa Participações',
      exercicioAno: 2024,
    })

    expect(writeSpy).toHaveBeenCalledTimes(1)
    const fileName = writeSpy.mock.calls[0][1] as string
    expect(fileName).toMatch(/^DRE_Gerencial_Grupo_Alfa_Participacoes_2024\.xlsx$/)

    writeSpy.mockRestore()
  })

  it('suporta modo comparativo de períodos com nome identificando entidade e exercício', () => {
    const writeSpy = vi.spyOn(XLSX, 'writeFile').mockImplementation(() => {})

    const mesesP2 = gerarListaMeses(2023, 1, 3)
    const matrizP2 = calcularDreGerencialMatriz([], contasMock, mesesP2, planosMock)
    const comparativo = calcularComparativoDre(
      matrizP2,
      matriz,
      'Jan/23 a Mar/23',
      'Jan/24 a Mar/24',
    )

    exportarDreComparativoExcel(comparativo, {
      empresa: empresaMock,
      exercicioAno: 2024,
    })

    expect(writeSpy).toHaveBeenCalledTimes(1)
    const fileName = writeSpy.mock.calls[0][1] as string
    expect(fileName).toMatch(/^DRE_Comparativo_Empresa_Teste_S_A_2024\.xlsx$/)

    writeSpy.mockRestore()
  })
})
