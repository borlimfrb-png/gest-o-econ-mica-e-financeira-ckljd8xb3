import pb from '@/lib/pocketbase/client'
import type { BenchmarkSetorialRecord, SegmentoEmpresa } from '@/types/finance'
import { BENCHMARKS_SETORIAIS, type BenchmarkSetorValores } from '@/lib/benchmarks'

export const benchmarksService = {
  /**
   * Busca todos os benchmarks personalizados salvos do usuário atual
   */
  async getAll(): Promise<BenchmarkSetorialRecord[]> {
    try {
      const records = await pb
        .collection<BenchmarkSetorialRecord>('benchmarks_setoriais')
        .getFullList({
          sort: 'setor',
        })
      return records
    } catch (err) {
      console.error('Erro ao buscar benchmarks setoriais:', err)
      return []
    }
  },

  /**
   * Busca o benchmark de um setor específico para o usuário atual
   */
  async getBySetor(setor: string): Promise<BenchmarkSetorialRecord | null> {
    try {
      const record = await pb
        .collection<BenchmarkSetorialRecord>('benchmarks_setoriais')
        .getFirstListItem(`setor = "${setor}"`)
      return record
    } catch {
      return null
    }
  },

  /**
   * Salva ou atualiza o benchmark de um determinado setor para o usuário atual
   */
  async saveSetor(
    setor: string,
    valores: Partial<BenchmarkSetorValores>,
  ): Promise<BenchmarkSetorialRecord> {
    const userId = pb.authStore.record?.id
    if (!userId) {
      throw new Error('Usuário não autenticado.')
    }

    // Tentar localizar registro existente
    let existing: BenchmarkSetorialRecord | null = null
    try {
      existing = await pb
        .collection<BenchmarkSetorialRecord>('benchmarks_setoriais')
        .getFirstListItem(`setor = "${setor}"`)
    } catch {
      existing = null
    }

    const payload: Partial<BenchmarkSetorialRecord> = {
      user: userId,
      setor: setor as SegmentoEmpresa,
      descricao: valores.descricao || `Benchmark personalizado para ${setor}`,
      liquidezCorrente: valores.liquidezCorrente,
      liquidezSeca: valores.liquidezSeca,
      liquidezImediata: valores.liquidezImediata,
      liquidezGeral: valores.liquidezGeral,
      endividamentoGeral: valores.endividamentoGeral,
      composicaoEndividamento: valores.composicaoEndividamento,
      participacaoCapitalTerceiros: valores.participacaoCapitalTerceiros,
      imobilizacaoPL: valores.imobilizacaoPL,
      margemBruta: valores.margemBruta,
      margemOperacional: valores.margemOperacional,
      margemLiquida: valores.margemLiquida,
      roa: valores.roa,
      roe: valores.roe,
      giroAtivo: valores.giroAtivo,
      autonomiaFinanceira: valores.autonomiaFinanceira,
      dependenciaFinanceira: valores.dependenciaFinanceira,
      dividaEquity: valores.dividaEquity,
      margemEbitda: valores.margemEbitda,
      coberturaJuros: valores.coberturaJuros,
      pme: valores.pme,
      pmr: valores.pmr,
      pmp: valores.pmp,
      cicloOperacional: valores.cicloOperacional,
      cicloFinanceiro: valores.cicloFinanceiro,
      giroEstoque: valores.giroEstoque,
      giroReceber: valores.giroReceber,
      giroFornecedores: valores.giroFornecedores,
      roic: valores.roic,
      wacc: valores.wacc,
      spread: valores.spread,
    }

    if (existing?.id) {
      return await pb
        .collection<BenchmarkSetorialRecord>('benchmarks_setoriais')
        .update<BenchmarkSetorialRecord>(existing.id, payload)
    } else {
      return await pb
        .collection<BenchmarkSetorialRecord>('benchmarks_setoriais')
        .create<BenchmarkSetorialRecord>(payload)
    }
  },

  /**
   * Restaura os valores padrão de fábrica para um setor específico
   */
  async restorePadrao(setor: string): Promise<BenchmarkSetorialRecord | null> {
    const padrao = BENCHMARKS_SETORIAIS[setor] || BENCHMARKS_SETORIAIS['Outros']
    if (!padrao) return null
    return await this.saveSetor(setor, padrao)
  },

  /**
   * Converte uma lista de BenchmarkSetorialRecord em um dicionário Record<string, BenchmarkSetorValores>
   * mesclando com os padrões padrão para qualquer setor faltante.
   */
  mergeBenchmarksMap(
    customRecords: BenchmarkSetorialRecord[],
  ): Record<string, BenchmarkSetorValores> {
    const map: Record<string, BenchmarkSetorValores> = { ...BENCHMARKS_SETORIAIS }

    for (const rec of customRecords) {
      if (rec.setor && map[rec.setor]) {
        map[rec.setor] = {
          ...map[rec.setor],
          setor: rec.setor,
          descricao: rec.descricao || map[rec.setor].descricao,
          liquidezCorrente: rec.liquidezCorrente ?? map[rec.setor].liquidezCorrente,
          liquidezSeca: rec.liquidezSeca ?? map[rec.setor].liquidezSeca,
          liquidezImediata: rec.liquidezImediata ?? map[rec.setor].liquidezImediata,
          liquidezGeral: rec.liquidezGeral ?? map[rec.setor].liquidezGeral,
          endividamentoGeral: rec.endividamentoGeral ?? map[rec.setor].endividamentoGeral,
          composicaoEndividamento:
            rec.composicaoEndividamento ?? map[rec.setor].composicaoEndividamento,
          participacaoCapitalTerceiros:
            rec.participacaoCapitalTerceiros ?? map[rec.setor].participacaoCapitalTerceiros,
          imobilizacaoPL: rec.imobilizacaoPL ?? map[rec.setor].imobilizacaoPL,
          margemBruta: rec.margemBruta ?? map[rec.setor].margemBruta,
          margemOperacional: rec.margemOperacional ?? map[rec.setor].margemOperacional,
          margemLiquida: rec.margemLiquida ?? map[rec.setor].margemLiquida,
          roa: rec.roa ?? map[rec.setor].roa,
          roe: rec.roe ?? map[rec.setor].roe,
          giroAtivo: rec.giroAtivo ?? map[rec.setor].giroAtivo,
          autonomiaFinanceira: rec.autonomiaFinanceira ?? map[rec.setor].autonomiaFinanceira,
          dependenciaFinanceira: rec.dependenciaFinanceira ?? map[rec.setor].dependenciaFinanceira,
          dividaEquity: rec.dividaEquity ?? map[rec.setor].dividaEquity,
          margemEbitda: rec.margemEbitda ?? map[rec.setor].margemEbitda,
          coberturaJuros: rec.coberturaJuros ?? map[rec.setor].coberturaJuros,
          pme: rec.pme ?? map[rec.setor].pme,
          pmr: rec.pmr ?? map[rec.setor].pmr,
          pmp: rec.pmp ?? map[rec.setor].pmp,
          cicloOperacional: rec.cicloOperacional ?? map[rec.setor].cicloOperacional,
          cicloFinanceiro: rec.cicloFinanceiro ?? map[rec.setor].cicloFinanceiro,
          giroEstoque: rec.giroEstoque ?? map[rec.setor].giroEstoque,
          giroReceber: rec.giroReceber ?? map[rec.setor].giroReceber,
          giroFornecedores: rec.giroFornecedores ?? map[rec.setor].giroFornecedores,
          roic: rec.roic ?? map[rec.setor].roic,
          wacc: rec.wacc ?? map[rec.setor].wacc,
          spread: rec.spread ?? map[rec.setor].spread,
        }
      }
    }

    return map
  },
}
