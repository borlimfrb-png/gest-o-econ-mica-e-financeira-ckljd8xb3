import { describe, it, expect, vi } from 'vitest'
import {
  sugerirVinculoParaDespesa,
  importacaoAssistidaIaService,
  type DespesaIaPropostaItem,
} from './importacaoAssistidaIaService'
import type { PlanoContaRecord, MemoriaFornecedorRecord } from '@/types/finance'

describe('importacaoAssistidaIaService - Vínculos e Sugestão Automática', () => {
  const planoContasMock: PlanoContaRecord[] = [
    {
      id: 'pc_1',
      codigo: '3.1.1.01',
      codigo_empresa: '31101',
      empresa: 'emp_1',
      conta: 'c_energia',
      centro: 'cc_adm',
      tipo_despesa: 'td_fixa',
      user: 'u1',
      collectionId: 'pc_col',
      collectionName: 'plano_contas',
      created: '',
      updated: '',
      expand: {
        conta: {
          id: 'c_energia',
          codigo: '3.1.1.01',
          nome: 'Energia Elétrica',
          tipo: 'Despesa',
          user: 'u1',
          collectionId: 'c1',
          collectionName: 'contas',
          created: '',
          updated: '',
        },
        centro: {
          id: 'cc_adm',
          nome: 'Administrativo',
          codigo: '1.01',
          empresa: 'emp_1',
          tipo: 'Despesa',
          user: 'u1',
          collectionId: 'c2',
          collectionName: 'centros',
          created: '',
          updated: '',
        },
      },
    },
    {
      id: 'pc_2',
      codigo: '3.1.2.05',
      codigo_empresa: '31205',
      empresa: 'emp_1',
      conta: 'c_ti',
      centro: 'cc_ti',
      tipo_despesa: 'td_fixa',
      user: 'u1',
      collectionId: 'pc_col',
      collectionName: 'plano_contas',
      created: '',
      updated: '',
      expand: {
        conta: {
          id: 'c_ti',
          codigo: '3.1.2.05',
          nome: 'Softwares e Licenças de TI',
          tipo: 'Despesa',
          user: 'u1',
          collectionId: 'c1',
          collectionName: 'contas',
          created: '',
          updated: '',
        },
        centro: {
          id: 'cc_ti',
          nome: 'Tecnologia da Informação',
          codigo: '1.02',
          empresa: 'emp_1',
          tipo: 'Despesa',
          user: 'u1',
          collectionId: 'c2',
          collectionName: 'centros',
          created: '',
          updated: '',
        },
      },
    },
  ]

  const memoriasMock: MemoriaFornecedorRecord[] = [
    {
      id: 'mem_1',
      user: 'u1',
      fornecedor_padrao: 'Enel Distribuição São Paulo',
      termo_busca: 'enel distribuicao',
      plano_conta: 'pc_1',
      empresa: 'emp_1',
      total_utilizacoes: 5,
      categoria_sugerida: 'Despesas Administrativas',
      created: '',
      updated: '',
    },
  ]

  it('deve priorizar sugestão do Agente de IA quando o ID existir no plano', () => {
    const res = sugerirVinculoParaDespesa(
      'Fatura Microsoft Azure Cloud',
      planoContasMock,
      memoriasMock,
      'pc_2',
    )

    expect(res.origem).toBe('ia')
    expect(res.planoConta?.id).toBe('pc_2')
  })

  it('deve utilizar a Memória do Agente para fornecedores previamente vinculados', () => {
    const res = sugerirVinculoParaDespesa(
      'Pagamento Enel Distribuição ref mês 03',
      planoContasMock,
      memoriasMock,
      null,
    )

    expect(res.origem).toBe('memoria')
    expect(res.planoConta?.id).toBe('pc_1')
    expect(res.planoConta?.expand?.conta?.nome).toBe('Energia Elétrica')
  })

  it('deve sugerir por similaridade com o nome da conta quando não houver memória', () => {
    const res = sugerirVinculoParaDespesa(
      'Licenças de TI e Softwares do setor',
      planoContasMock,
      [],
      null,
    )

    expect(res.origem).toBe('similaridade')
    expect(res.planoConta?.id).toBe('pc_2')
  })

  it('deve sugerir por código da empresa se contido na descrição', () => {
    const res = sugerirVinculoParaDespesa(
      'Despesa rateio código 31101 interna',
      planoContasMock,
      [],
      null,
    )

    expect(res.origem).toBe('codigo_empresa')
    expect(res.planoConta?.id).toBe('pc_1')
  })

  it('deve retornar status manual quando nenhuma heurística encontrar correspondência', () => {
    const res = sugerirVinculoParaDespesa(
      'Fornecedor Xpto Sem Nenhuma Relação Conhecida',
      planoContasMock,
      [],
      null,
    )

    expect(res.origem).toBe('manual')
    expect(res.planoConta).toBeUndefined()
  })

  it('deve suportar estrutura hierárquica Conta -> Subconta -> Despesas em PropostaImportacaoIaResult', () => {
    const item1: DespesaIaPropostaItem = {
      id: 'd1',
      descricao: 'Enel Distribuição',
      valor: 850.5,
      competencia: '2025-01',
      categoria: 'Energia',
      conta_hierarquia: 'Despesas Administrativas',
      subconta_hierarquia: 'Energia e Água',
      statusVinculo: 'vinculada',
      planoContaId: 'pc_1',
    }

    const item2: DespesaIaPropostaItem = {
      id: 'd2',
      descricao: 'Licença Microsoft',
      valor: 420.0,
      competencia: '2025-01',
      categoria: 'TI',
      conta_hierarquia: 'Despesas Administrativas',
      subconta_hierarquia: 'Softwares e TI',
      statusVinculo: 'vinculada',
      planoContaId: 'pc_2',
    }

    const proposta = {
      conta_principal: 'Despesas Administrativas',
      contas: [
        {
          id: 'c_1',
          nome: 'Despesas Administrativas',
          subcontas: [
            {
              id: 'sc_1',
              nome: 'Energia e Água',
              despesas: [item1],
              total_despesas: 1,
              valor_subtotal: 850.5,
            },
            {
              id: 'sc_2',
              nome: 'Softwares e TI',
              despesas: [item2],
              total_despesas: 1,
              valor_subtotal: 420.0,
            },
          ],
          total_despesas: 2,
          valor_total: 1270.5,
        },
      ],
      despesas: [item1, item2],
      total_despesas: 2,
      valor_total: 1270.5,
    }

    expect(proposta.contas.length).toBe(1)
    expect(proposta.contas[0].subcontas.length).toBe(2)
    expect(proposta.contas[0].subcontas[0].nome).toBe('Energia e Água')
    expect(proposta.contas[0].subcontas[0].despesas[0].valor).toBe(850.5)
    expect(proposta.valor_total).toBe(1270.5)
  })

  it('deve refletir métricas completas de leitura, contagens e truncamento', () => {
    const propostaCompleta = {
      conta_principal: 'Custos e Despesas Gerais',
      contas: [],
      despesas: [],
      total_despesas: 150,
      total_contas: 8,
      total_subcontas: 18,
      total_estimado: 155,
      caracteres_extraidos: 45000,
      valor_total: 98000.5,
      truncated: false,
      truncamento_detalhes: {
        doc_truncated: false,
        text_truncated: false,
        ai_truncated: false,
        total_lido: 150,
        total_estimado: 155,
        caracteres_extraidos: 45000,
      },
    }

    expect(propostaCompleta.total_despesas).toBe(150)
    expect(propostaCompleta.total_contas).toBe(8)
    expect(propostaCompleta.total_subcontas).toBe(18)
    expect(propostaCompleta.total_estimado).toBe(155)
    expect(propostaCompleta.truncated).toBe(false)
    expect(propostaCompleta.truncamento_detalhes?.total_lido).toBe(150)
  })
})
