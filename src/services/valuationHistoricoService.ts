import pb from '@/lib/pocketbase/client'
import type {
  ValuationHistoricoRecord,
  MetodologiaValuation,
  HistoricoValuationPontoAno,
} from '@/types/finance'

export interface SalvarValuationHistoricoInput {
  empresa: string
  ano: number
  metodologia: MetodologiaValuation
  valor: number
  detalhes?: Record<string, any>
  data_calculo?: string
}

export const valuationHistoricoService = {
  /**
   * Busca registros de histórico de uma empresa ordenados por ano
   */
  async getByEmpresa(empresaId: string): Promise<ValuationHistoricoRecord[]> {
    if (!empresaId) return []
    try {
      return await pb.collection('valuation_historico').getFullList<ValuationHistoricoRecord>({
        filter: `empresa = "${empresaId}"`,
        sort: 'ano,metodologia',
        requestKey: null,
      })
    } catch (err: any) {
      if (err?.status === 404) return []
      console.warn('Erro ao buscar histórico de valuation:', err)
      return []
    }
  },

  /**
   * Busca registro de histórico por empresa, ano e metodologia
   */
  async getByEmpresaAnoEMetodologia(
    empresaId: string,
    ano: number,
    metodologia: MetodologiaValuation,
  ): Promise<ValuationHistoricoRecord | null> {
    if (!empresaId || !ano || !metodologia) return null
    try {
      const records = await pb
        .collection('valuation_historico')
        .getFullList<ValuationHistoricoRecord>({
          filter: `empresa = "${empresaId}" && ano = ${ano} && metodologia = "${metodologia}"`,
          sort: '-updated',
          requestKey: null,
        })
      return records.length > 0 ? records[0] : null
    } catch (err: any) {
      if (err?.status === 404) return null
      console.warn('Erro ao buscar snapshot de valuation:', err)
      return null
    }
  },

  /**
   * Upsert idempotente de um snapshot de valuation por empresa+ano+metodologia
   */
  async salvarSnapshot(data: SalvarValuationHistoricoInput): Promise<ValuationHistoricoRecord> {
    const existing = await this.getByEmpresaAnoEMetodologia(
      data.empresa,
      data.ano,
      data.metodologia,
    )
    const authId = pb.authStore.model?.id

    const payload = {
      ...data,
      user: authId || undefined,
      data_calculo: data.data_calculo || new Date().toISOString(),
    }

    if (existing) {
      return await pb
        .collection('valuation_historico')
        .update<ValuationHistoricoRecord>(existing.id, payload)
    } else {
      return await pb.collection('valuation_historico').create<ValuationHistoricoRecord>(payload)
    }
  },

  /**
   * Salva em lote snapshots dos métodos calculados para um determinado ano
   */
  async salvarSnapshotsAno(
    empresaId: string,
    ano: number,
    snapshots: {
      fcd?: { valor: number; detalhes?: Record<string, any> } | null
      superlucro?: { valor: number; detalhes?: Record<string, any> } | null
      multiplos?: { valor: number; detalhes?: Record<string, any> } | null
      consenso?: { valor: number; detalhes?: Record<string, any> } | null
    },
  ): Promise<ValuationHistoricoRecord[]> {
    if (!empresaId || !ano) return []

    const resultados: ValuationHistoricoRecord[] = []
    const agora = new Date().toISOString()

    const promessas: Promise<ValuationHistoricoRecord>[] = []

    if (snapshots.fcd && snapshots.fcd.valor > 0) {
      promessas.push(
        this.salvarSnapshot({
          empresa: empresaId,
          ano,
          metodologia: 'fcd',
          valor: snapshots.fcd.valor,
          detalhes: snapshots.fcd.detalhes,
          data_calculo: agora,
        }),
      )
    }

    if (snapshots.superlucro && snapshots.superlucro.valor !== undefined) {
      promessas.push(
        this.salvarSnapshot({
          empresa: empresaId,
          ano,
          metodologia: 'superlucro',
          valor: snapshots.superlucro.valor,
          detalhes: snapshots.superlucro.detalhes,
          data_calculo: agora,
        }),
      )
    }

    if (snapshots.multiplos && snapshots.multiplos.valor > 0) {
      promessas.push(
        this.salvarSnapshot({
          empresa: empresaId,
          ano,
          metodologia: 'multiplos',
          valor: snapshots.multiplos.valor,
          detalhes: snapshots.multiplos.detalhes,
          data_calculo: agora,
        }),
      )
    }

    if (snapshots.consenso && snapshots.consenso.valor > 0) {
      promessas.push(
        this.salvarSnapshot({
          empresa: empresaId,
          ano,
          metodologia: 'consenso',
          valor: snapshots.consenso.valor,
          detalhes: snapshots.consenso.detalhes,
          data_calculo: agora,
        }),
      )
    }

    if (promessas.length > 0) {
      const saved = await Promise.all(promessas)
      resultados.push(...saved)
    }

    return resultados
  },

  /**
   * Deleta registro de histórico
   */
  async delete(id: string): Promise<boolean> {
    try {
      await pb.collection('valuation_historico').delete(id)
      return true
    } catch (err) {
      console.error('Erro ao deletar valuation_historico:', err)
      throw err
    }
  },

  /**
   * Consolida a série histórica combinando registros persistidos no banco
   * com cálculos dinâmicos em memória para anos com balanço/DRE.
   */
  consolidarSerieHistorica(
    registrosDb: ValuationHistoricoRecord[],
    anosDisponiveis: number[],
    calculadorAno: (ano: number) => {
      valorFcd: number | null
      valorSuperlucro: number | null
      valorMultiplos: number | null
      detalhesFcd?: Record<string, any>
      detalhesSuperlucro?: Record<string, any>
      detalhesMultiplos?: Record<string, any>
    },
  ): HistoricoValuationPontoAno[] {
    const mapaAnos = new Map<number, HistoricoValuationPontoAno>()

    // 1. Processar registros salvos do DB
    for (const reg of registrosDb) {
      const a = reg.ano
      if (!mapaAnos.has(a)) {
        mapaAnos.set(a, {
          ano: a,
          valorFcd: null,
          valorSuperlucro: null,
          valorMultiplos: null,
          consenso: 0,
          minimo: 0,
          maximo: 0,
          metodosContados: 0,
          origem: 'snapshot',
        })
      }

      const ponto = mapaAnos.get(a)!
      if (reg.metodologia === 'fcd') {
        ponto.valorFcd = reg.valor
        ponto.detalhesFcd = reg.detalhes
      } else if (reg.metodologia === 'superlucro') {
        ponto.valorSuperlucro = reg.valor
        ponto.detalhesSuperlucro = reg.detalhes
      } else if (reg.metodologia === 'multiplos') {
        ponto.valorMultiplos = reg.valor
        ponto.detalhesMultiplos = reg.detalhes
      }
    }

    // 2. Preencher ou complementar com anos disponíveis calculados em memória
    for (const a of anosDisponiveis) {
      const calc = calculadorAno(a)
      if (!mapaAnos.has(a)) {
        mapaAnos.set(a, {
          ano: a,
          valorFcd: calc.valorFcd,
          valorSuperlucro: calc.valorSuperlucro,
          valorMultiplos: calc.valorMultiplos,
          consenso: 0,
          minimo: 0,
          maximo: 0,
          metodosContados: 0,
          detalhesFcd: calc.detalhesFcd,
          detalhesSuperlucro: calc.detalhesSuperlucro,
          detalhesMultiplos: calc.detalhesMultiplos,
          origem: 'calculado',
        })
      } else {
        const ponto = mapaAnos.get(a)!
        // Se no snapshot faltava algum método, complementa com o cálculo
        if (ponto.valorFcd === null && calc.valorFcd !== null) {
          ponto.valorFcd = calc.valorFcd
          ponto.detalhesFcd = calc.detalhesFcd
        }
        if (ponto.valorSuperlucro === null && calc.valorSuperlucro !== null) {
          ponto.valorSuperlucro = calc.valorSuperlucro
          ponto.detalhesSuperlucro = calc.detalhesSuperlucro
        }
        if (ponto.valorMultiplos === null && calc.valorMultiplos !== null) {
          ponto.valorMultiplos = calc.valorMultiplos
          ponto.detalhesMultiplos = calc.detalhesMultiplos
        }
      }
    }

    // 3. Calcular consenso, mín, máx para cada ano
    const listaOrdenada = Array.from(mapaAnos.values()).sort((a, b) => a.ano - b.ano)

    for (const ponto of listaOrdenada) {
      const valoresValidos: number[] = []
      if (ponto.valorFcd !== null && ponto.valorFcd > 0) valoresValidos.push(ponto.valorFcd)
      if (ponto.valorSuperlucro !== null && ponto.valorSuperlucro > 0)
        valoresValidos.push(ponto.valorSuperlucro)
      if (ponto.valorMultiplos !== null && ponto.valorMultiplos > 0)
        valoresValidos.push(ponto.valorMultiplos)

      ponto.metodosContados = valoresValidos.length
      if (valoresValidos.length > 0) {
        ponto.consenso = valoresValidos.reduce((acc, v) => acc + v, 0) / valoresValidos.length
        ponto.minimo = Math.min(...valoresValidos)
        ponto.maximo = Math.max(...valoresValidos)
      } else {
        ponto.consenso = 0
        ponto.minimo = 0
        ponto.maximo = 0
      }
    }

    // Filtrar anos que possuam ao menos 1 método válido ou valor > 0
    const pontosValidos = listaOrdenada.filter((p) => p.metodosContados > 0 || p.consenso > 0)

    // 4. Calcular variação percentual vs ano anterior
    for (let i = 0; i < pontosValidos.length; i++) {
      if (i === 0) {
        pontosValidos[i].variacaoPercentualVsAnterior = null
      } else {
        const anterior = pontosValidos[i - 1].consenso
        const atual = pontosValidos[i].consenso
        if (anterior > 0) {
          pontosValidos[i].variacaoPercentualVsAnterior = ((atual - anterior) / anterior) * 100
        } else {
          pontosValidos[i].variacaoPercentualVsAnterior = null
        }
      }
    }

    return pontosValidos
  },

  /**
   * Calcula o CAGR (Taxa de Crescimento Anual Composta) entre o primeiro e último ano da série
   */
  calcularCagr(serie: HistoricoValuationPontoAno[]): number | null {
    if (!serie || serie.length < 2) return null
    const primeiro = serie[0].consenso
    const ultimo = serie[serie.length - 1].consenso
    const anosDiferenca = serie[serie.length - 1].ano - serie[0].ano

    if (primeiro <= 0 || ultimo <= 0 || anosDiferenca <= 0) return null

    // CAGR = (VF / VI)^(1 / n) - 1
    const cagr = Math.pow(ultimo / primeiro, 1 / anosDiferenca) - 1
    return cagr * 100
  },
}
