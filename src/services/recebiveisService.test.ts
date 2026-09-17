import { describe, it, expect, beforeEach, vi } from 'vitest'
import { recebiveisService } from './recebiveisService'
import pb from '@/lib/pocketbase/client'
import { normalizarPeriodoCobranca, gerarParcelasDePeriodos } from '@/lib/periodosCobranca'

describe('Integração Contratos -> Recebíveis e Reconciliação', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('deve gerar 13 parcelas a partir do exemplo do usuário (P1: 4 meses x 1500 + P2: 9 meses x 2000)', () => {
    const periodos = [
      normalizarPeriodoCobranca({
        data_inicio: '2026-10-16',
        data_final: '2027-01-16',
        valor_mensal: 1500,
        forma_pagamento: 'Pix',
      }),
      normalizarPeriodoCobranca({
        data_inicio: '2027-02-16',
        data_final: '2027-10-16',
        valor_mensal: 2000,
        forma_pagamento: 'Boleto Bancário',
      }),
    ]

    const parcelas = gerarParcelasDePeriodos(periodos, 16)
    expect(parcelas).toHaveLength(13)

    // Conferência das primeiras 4 parcelas (Período 1)
    expect(parcelas[0].parcela).toBe(1)
    expect(parcelas[0].vencimento).toBe('2026-10-16')
    expect(parcelas[0].valor).toBe(1500)
    expect(parcelas[0].forma_pagamento).toBe('Pix')
    expect(parcelas[0].periodo_ordem).toBe(1)

    expect(parcelas[3].parcela).toBe(4)
    expect(parcelas[3].vencimento).toBe('2027-01-16')
    expect(parcelas[3].valor).toBe(1500)

    // Conferência das próximas 9 parcelas (Período 2)
    expect(parcelas[4].parcela).toBe(5)
    expect(parcelas[4].vencimento).toBe('2027-02-16')
    expect(parcelas[4].valor).toBe(2000)
    expect(parcelas[4].forma_pagamento).toBe('Boleto Bancário')
    expect(parcelas[4].periodo_ordem).toBe(2)

    expect(parcelas[12].parcela).toBe(13)
    expect(parcelas[12].vencimento).toBe('2027-10-16')
    expect(parcelas[12].valor).toBe(2000)
  })

  it('deve reconciliar títulos mantendo parcelas já PAGAS e atualizando ou criando pendentes', async () => {
    const contratoMock = {
      id: 'contrato_123',
      contratante: 'empresa_abc',
      data_inicio: '2026-10-16',
      dia_vencimento: 16,
      quantidade_meses: 12,
      descricaoContrato: 'Contrato Cliente ABC',
    }

    // Mock dos títulos existentes no backend:
    // Parcela 1: PAGA (R$ 1.500)
    // Parcela 2: Pendente (R$ 1.500, antigo)
    const titulosExistentes: any[] = [
      {
        id: 'rec_1',
        contrato: 'contrato_123',
        parcela: 1,
        vencimento: '2026-10-16 12:00:00',
        valor: 1500,
        status: 'Pago',
        data_pagamento: '2026-10-15',
        descricao: 'Contrato Cliente ABC — Parcela 1/13',
        forma_pagamento: 'Pix',
      },
      {
        id: 'rec_2',
        contrato: 'contrato_123',
        parcela: 2,
        vencimento: '2026-11-16 12:00:00',
        valor: 1500,
        status: 'Pendente',
        descricao: 'Contrato Antigo',
        forma_pagamento: 'Pix',
      },
    ]

    const criados: any[] = []
    const atualizados: any[] = []
    const excluidos: string[] = []

    vi.spyOn(pb, 'collection').mockImplementation((colName: string) => {
      if (colName === 'recebiveis') {
        return {
          getFullList: vi.fn().mockResolvedValue(titulosExistentes),
          create: vi.fn().mockImplementation((data) => {
            criados.push(data)
            return Promise.resolve({ id: `rec_novo_${criados.length}`, ...data })
          }),
          update: vi.fn().mockImplementation((id, data) => {
            atualizados.push({ id, ...data })
            return Promise.resolve({ id, ...data })
          }),
          delete: vi.fn().mockImplementation((id) => {
            excluidos.push(id)
            return Promise.resolve(true)
          }),
        } as any
      }
      return {} as any
    })

    // Novo cronograma com 3 parcelas (parcela 1, parcela 2 com valor reajustado para 1600, parcela 3 nova)
    const novoCronograma = [
      {
        parcela: 1,
        vencimento: '2026-10-16',
        valor: 1500,
        forma_pagamento: 'Pix',
      },
      {
        parcela: 2,
        vencimento: '2026-11-16',
        valor: 1600, // alterou valor
        forma_pagamento: 'Pix',
      },
      {
        parcela: 3,
        vencimento: '2026-12-16',
        valor: 1600, // nova
        forma_pagamento: 'Pix',
      },
    ]

    const resultado = await recebiveisService.sincronizarTitulosContrato(
      contratoMock,
      novoCronograma,
    )

    expect(resultado.mantidosPagos).toBe(1) // Parcela 1 paga preservada
    expect(resultado.atualizados).toBe(1) // Parcela 2 atualizada
    expect(resultado.criados).toBe(1) // Parcela 3 criada
    expect(resultado.removidos).toBe(0)

    // A parcela 1 paga NÃO foi reescrita com valor novo
    const updateParcela1 = atualizados.find((u) => u.id === 'rec_1')
    expect(updateParcela1?.valor).toBeUndefined() // Não alterou valor do pago

    // A parcela 2 pendente teve o valor alterado para 1600
    const updateParcela2 = atualizados.find((u) => u.id === 'rec_2')
    expect(updateParcela2?.valor).toBe(1600)

    // A parcela 3 foi criada com status Pendente
    expect(criados[0].parcela).toBe(3)
    expect(criados[0].status).toBe('Pendente')
    expect(criados[0].valor).toBe(1600)
    expect(criados[0].contrato).toBe('contrato_123')
  })

  it('NUNCA deve remover parcela já PAGA mesmo se excluída do cronograma', async () => {
    const contratoMock = {
      id: 'contrato_123',
      contratante: 'empresa_abc',
      data_inicio: '2026-10-16',
    }

    // Parcela 1 Paga e Parcela 2 Pendente
    const titulosExistentes: any[] = [
      {
        id: 'rec_pago',
        contrato: 'contrato_123',
        parcela: 1,
        vencimento: '2026-10-16 12:00:00',
        valor: 1500,
        status: 'Pago',
      },
      {
        id: 'rec_pendente_excedente',
        contrato: 'contrato_123',
        parcela: 2,
        vencimento: '2026-11-16 12:00:00',
        valor: 1500,
        status: 'Pendente',
      },
    ]

    const excluidos: string[] = []

    vi.spyOn(pb, 'collection').mockImplementation((colName: string) => {
      if (colName === 'recebiveis') {
        return {
          getFullList: vi.fn().mockResolvedValue(titulosExistentes),
          create: vi.fn().mockResolvedValue({}),
          update: vi.fn().mockResolvedValue({}),
          delete: vi.fn().mockImplementation((id) => {
            excluidos.push(id)
            return Promise.resolve(true)
          }),
        } as any
      }
      return {} as any
    })

    // Novo cronograma reduziu para apenas 0 parcelas novas (ex: cancelou o contrato ou apagou tudo)
    const cronogramaVazio: any[] = []

    const resultado = await recebiveisService.sincronizarTitulosContrato(
      contratoMock,
      cronogramaVazio,
    )

    // Apenas a parcela pendente foi excluída
    expect(excluidos).toContain('rec_pendente_excedente')
    expect(excluidos).not.toContain('rec_pago')
    expect(resultado.removidos).toBe(1)
    expect(resultado.mantidosPagos).toBe(1)
  })
})
