import type { PeriodoCobrancaItem } from '@/types/finance'
import type { ParcelaPreview } from '@/services/recebiveisService'

/**
 * Calcula a quantidade de mensalidades entre data_inicio e data_final inclusive.
 * Regra do usuário:
 * Período 1: 16/10/2026 a 16/01/2027 => 4 meses (Out/26, Nov/26, Dez/26, Jan/27).
 * Período 2: 16/02/2027 a 16/10/2027 => 9 meses (Fev, Mar, Abr, Mai, Jun, Jul, Ago, Set, Out/27).
 * Total de meses = (anoFim - anoIni) * 12 + (mesFim - mesIni) + 1.
 */
export function calcularMensalidadesPeriodo(dataInicio: string, dataFinal: string): number {
  if (!dataInicio || !dataFinal) return 0
  const dIni = dataInicio.slice(0, 10).split('-').map(Number)
  const dFim = dataFinal.slice(0, 10).split('-').map(Number)
  if (dIni.length !== 3 || dFim.length !== 3) return 0

  const [anoIni, mesIni] = dIni
  const [anoFim, mesFim] = dFim

  if (!anoIni || !mesIni || !anoFim || !mesFim) return 0

  const diffMeses = (anoFim - anoIni) * 12 + (mesFim - mesIni)
  if (diffMeses < 0) return 0

  return diffMeses + 1
}

/**
 * Normaliza um item de período calculando meses e total financeiro
 */
export function normalizarPeriodoCobranca(
  item: Partial<PeriodoCobrancaItem>,
  ordem = 1,
): PeriodoCobrancaItem {
  const dataIni = item.data_inicio || ''
  const dataFim = item.data_final || ''
  const valorMensal = Number(item.valor_mensal) || 0
  const meses = calcularMensalidadesPeriodo(dataIni, dataFim)
  const total = meses * valorMensal

  return {
    id: item.id || `periodo_${ordem}_${Date.now()}`,
    ordem: item.ordem ?? ordem,
    data_inicio: dataIni,
    data_final: dataFim,
    valor_mensal: valorMensal,
    forma_pagamento: item.forma_pagamento || 'Pix',
    meses,
    total,
  }
}

/**
 * Gera a lista detalhada de parcelas cronológicas a partir dos períodos informados.
 * O dia de vencimento padrão é o dia informado ou o dia da data inicial de cada período.
 */
export function gerarParcelasDePeriodos(
  periodos: PeriodoCobrancaItem[],
  diaVencimentoPadrao = 10,
  lembreteAgendado = true,
): ParcelaPreview[] {
  const parcelas: ParcelaPreview[] = []
  let contadorGlobal = 1

  for (const periodo of periodos) {
    if (!periodo.data_inicio || !periodo.data_final) continue

    const [anoIni, mesIni, diaIni] = periodo.data_inicio.slice(0, 10).split('-').map(Number)
    const [anoFim, mesFim] = periodo.data_final.slice(0, 10).split('-').map(Number)

    if (!anoIni || !mesIni || !anoFim || !mesFim) continue

    const totalMeses = (anoFim - anoIni) * 12 + (mesFim - mesIni) + 1
    if (totalMeses <= 0) continue

    // O dia de vencimento pode ser o dia da data inicial do período (ex: 16) ou o dia informado no contrato
    const diaVenc = diaVencimentoPadrao
      ? Math.min(Math.max(diaVencimentoPadrao, 1), 28)
      : Math.min(Math.max(diaIni || 10, 1), 28)

    for (let i = 0; i < totalMeses; i++) {
      const targetDate = new Date(anoIni, mesIni - 1 + i, 1)
      const year = targetDate.getFullYear()
      const month = targetDate.getMonth() + 1
      const vencimento = `${year}-${String(month).padStart(2, '0')}-${String(diaVenc).padStart(2, '0')}`

      parcelas.push({
        parcela: contadorGlobal++,
        vencimento,
        valor: Number(periodo.valor_mensal) || 0,
        status: 'Pendente',
        lembrete_agendado: lembreteAgendado,
      })
    }
  }

  return parcelas
}

/**
 * Converte número para extenso em português (até dezenas/centenas comuns de parcelas).
 */
export function numeroPorExtenso(num: number): string {
  const unidades = [
    'zero',
    'uma',
    'duas',
    'três',
    'quatro',
    'cinco',
    'seis',
    'sete',
    'oito',
    'nove',
    'dez',
    'onze',
    'doze',
    'treze',
    'quatorze',
    'quinze',
    'dezesseis',
    'dezessete',
    'dezoito',
    'dezenove',
    'vinte',
  ]

  if (num >= 0 && num <= 20) return unidades[num]

  const dezenas = [
    '',
    '',
    'vinte',
    'trinta',
    'quarenta',
    'cinquenta',
    'sessenta',
    'setenta',
    'oitenta',
    'noventa',
  ]
  if (num < 100) {
    const d = Math.floor(num / 10)
    const u = num % 10
    if (u === 0) return dezenas[d]
    return `${dezenas[d]} e ${unidades[u]}`
  }

  return String(num)
}
