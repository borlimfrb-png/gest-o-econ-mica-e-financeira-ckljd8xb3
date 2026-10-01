import { describe, it, expect } from 'vitest'
import {
  conciliarImportacaoExcel,
  extrairLinhasPendentesParaReimportacao,
} from './conferenciaImportacaoService'
import type { LancamentoExcelLinha } from './importacaoLancamentosExcelIaService'
import type { LancamentoRecord, PlanoContaRecord } from '@/types/finance'

describe('conferenciaImportacaoService', () => {
  const planoContasMock: PlanoContaRecord[] = [
    {
      id: 'pc_1',
      collectionId: 'plano_contas',
      collectionName: 'plano_contas',
      user: 'u1',
      conta: 'conta_1',
      centro: 'centro_1',
      codigo: '4.1.01',
      codigo_empresa: '101',
      descricao: 'Aluguel Escritório',
      natureza: 'Despesa',
      created: '',
      updated: '',
      expand: {
        conta: {
          id: 'conta_1',
          collectionId: 'contas',
          collectionName: 'contas',
          user: 'u1',
          nome: 'Aluguel',
          tipo: 'Despesa',
          classificacao_dre: 'Despesa Fixa',
          created: '',
          updated: '',
        } as any,
      },
    },
    {
      id: 'pc_2',
      collectionId: 'plano_contas',
      collectionName: 'plano_contas',
      user: 'u1',
      conta: 'conta_2',
      centro: 'centro_1',
      codigo: '4.1.02',
      codigo_empresa: '102',
      descricao: 'Energia Elétrica',
      natureza: 'Despesa',
      created: '',
      updated: '',
      expand: {
        conta: {
          id: 'conta_2',
          collectionId: 'contas',
          collectionName: 'contas',
          user: 'u1',
          nome: 'Energia Elétrica',
          tipo: 'Despesa',
          classificacao_dre: undefined, // Sem DRE
          created: '',
          updated: '',
        } as any,
      },
    },
  ]

  const criarLinha = (
    id: string,
    contaStr: string,
    mes: number,
    valor: number,
    pcId?: string,
    status: LancamentoExcelLinha['status'] = 'valido',
  ): LancamentoExcelLinha => ({
    id,
    linhaPlanilha: 2,
    dataStr: `31/${String(mes).padStart(2, '0')}/2025`,
    dataIso: `2025-${String(mes).padStart(2, '0')}-28`,
    ano: 2025,
    mes,
    historico: `${contaStr} - Mês ${mes}`,
    valor,
    tipo: 'Despesa',
    nomeContaPlanilha: contaStr,
    planoContaId: pcId,
    matchConfidence: pcId ? 'exato' : 'nao_encontrado',
    status,
    errosOuAlertas: pcId ? [] : ['Conta não encontrada'],
    selecionado: true,
  })

  it('classifica corretamente como ✅ Importado quando todos os meses/linhas foram gravados', () => {
    const linhas: LancamentoExcelLinha[] = [
      criarLinha('l1', 'Aluguel', 1, 1500, 'pc_1'),
      criarLinha('l2', 'Aluguel', 2, 1500, 'pc_1'),
    ]

    const gravados: LancamentoRecord[] = [
      {
        id: 'rec_1',
        collectionId: 'lancamentos',
        collectionName: 'lancamentos',
        empresa: 'emp_1',
        plano_conta: 'pc_1',
        data: '2025-01-28',
        valor: 1500,
        historico: 'Aluguel - Mês 1',
        user: 'u1',
        created: '',
        updated: '',
      },
      {
        id: 'rec_2',
        collectionId: 'lancamentos',
        collectionName: 'lancamentos',
        empresa: 'emp_1',
        plano_conta: 'pc_1',
        data: '2025-02-28',
        valor: 1500,
        historico: 'Aluguel - Mês 2',
        user: 'u1',
        created: '',
        updated: '',
      },
    ]

    const { itens, resumo } = conciliarImportacaoExcel({
      linhasPlanilha: linhas,
      lancamentosGravados: gravados,
      planoContas: planoContasMock,
      isMatriz: true,
    })

    expect(itens).toHaveLength(1)
    expect(itens[0].statusGeral).toBe('importado')
    expect(itens[0].totalLinhasEsperadas).toBe(2)
    expect(itens[0].totalLinhasGravadas).toBe(2)
    expect(itens[0].diferencaValor).toBe(0)
    expect(resumo.contasImportadas).toBe(1)
    expect(resumo.contasParciais).toBe(0)
    expect(resumo.contasNaoImportadas).toBe(0)
  })

  it('classifica como ⚠️ Parcial quando parte dos meses foi gravada e detecta pendências', () => {
    const linhas: LancamentoExcelLinha[] = [
      criarLinha('l1', 'Aluguel', 1, 1500, 'pc_1'),
      criarLinha('l2', 'Aluguel', 2, 1500, 'pc_1'),
      criarLinha('l3', 'Aluguel', 3, 1500, 'pc_1'),
    ]

    // Gravou apenas Mês 1
    const gravados: LancamentoRecord[] = [
      {
        id: 'rec_1',
        collectionId: 'lancamentos',
        collectionName: 'lancamentos',
        empresa: 'emp_1',
        plano_conta: 'pc_1',
        data: '2025-01-28',
        valor: 1500,
        historico: 'Aluguel - Mês 1',
        user: 'u1',
        created: '',
        updated: '',
      },
    ]

    const { itens, resumo } = conciliarImportacaoExcel({
      linhasPlanilha: linhas,
      lancamentosGravados: gravados,
      planoContas: planoContasMock,
      isMatriz: true,
    })

    expect(itens).toHaveLength(1)
    expect(itens[0].statusGeral).toBe('parcial')
    expect(itens[0].totalLinhasEsperadas).toBe(3)
    expect(itens[0].totalLinhasGravadas).toBe(1)
    expect(itens[0].diferencaValor).toBe(3000)
    expect(resumo.contasParciais).toBe(1)
    expect(resumo.totalItensPendentes).toBe(2)

    // Reimportação deve extrair exatamente os 2 meses faltantes (Mês 2 e 3)
    const reimp = extrairLinhasPendentesParaReimportacao({
      itensConferencia: itens,
      lancamentosJaGravados: gravados,
    })

    expect(reimp.linhasProntasParaGravar).toHaveLength(2)
    expect(reimp.linhasProntasParaGravar.map((l) => l.mes)).toEqual([2, 3])
  })

  it('classifica como ❌ Não importado com motivo claro (ex: sem conta vinculada)', () => {
    const linhas: LancamentoExcelLinha[] = [
      criarLinha('l1', 'Conta Desconhecida', 1, 800, undefined, 'alerta'),
    ]

    const { itens, resumo } = conciliarImportacaoExcel({
      linhasPlanilha: linhas,
      lancamentosGravados: [],
      planoContas: planoContasMock,
      isMatriz: true,
    })

    expect(itens).toHaveLength(1)
    expect(itens[0].statusGeral).toBe('nao_importado')
    expect(itens[0].motivosNaoImportacao).toContain('sem_conta_vinculada')
    expect(resumo.contasNaoImportadas).toBe(1)

    // Bloqueia reimportação até que o usuário vincule uma conta
    const reimpBloq = extrairLinhasPendentesParaReimportacao({
      itensConferencia: itens,
      lancamentosJaGravados: [],
    })
    expect(reimpBloq.linhasProntasParaGravar).toHaveLength(0)
    expect(reimpBloq.linhasAindaBloqueadas).toHaveLength(1)
    expect(reimpBloq.linhasAindaBloqueadas[0].motivoBloqueio).toContain('não vinculada')

    // Se o usuário vincula a conta no item de conferência
    itens[0].planoContaId = 'pc_1'
    itens[0].planoContaNome = 'Aluguel'

    const reimpLiberado = extrairLinhasPendentesParaReimportacao({
      itensConferencia: itens,
      lancamentosJaGravados: [],
    })
    expect(reimpLiberado.linhasProntasParaGravar).toHaveLength(1)
    expect(reimpLiberado.linhasProntasParaGravar[0].planoContaId).toBe('pc_1')
  })

  it('detecta contas sem classificacao_dre para oferecer o modal de ajuste DRE', () => {
    const linhas: LancamentoExcelLinha[] = [
      criarLinha('l1', 'Energia Elétrica', 1, 500, 'pc_2'), // pc_2 não tem DRE
    ]

    const { resumo } = conciliarImportacaoExcel({
      linhasPlanilha: linhas,
      lancamentosGravados: [],
      planoContas: planoContasMock,
      isMatriz: true,
    })

    expect(resumo.contasSemClassificacaoDre).toBe(1)
    expect(resumo.idsContasSemDre).toContain('conta_2')
  })
})
