import * as XLSX from 'xlsx'
import type { ProjecaoResultado } from './projecaoDreCalculo'
import { montarLinhasMesesProjecao } from './projecaoDreCalculo'
import type { MesItem } from './dreGerencialTypes'
import { sanitizeNomeArquivo } from './exportacaoPlanoContas'

export interface OpcoesExportacaoProjecao {
  empresaNome?: string
  isGrupo?: boolean
  nomeGrupo?: string
  exercicioAno?: number
}

interface ContextoExport {
  identificador: string
  exercicio: number
  fileNameBase: string
}

function resolverContexto(
  projecao: ProjecaoResultado,
  mesesExercicio: MesItem[],
  opcoes?: OpcoesExportacaoProjecao,
): ContextoExport {
  const identificador =
    opcoes?.isGrupo && opcoes?.nomeGrupo
      ? `Grupo_${opcoes.nomeGrupo}`
      : opcoes?.empresaNome || 'Consolidado'
  const safeEntidade = sanitizeNomeArquivo(identificador)
  const exercicio = opcoes?.exercicioAno || mesesExercicio[0]?.ano || new Date().getFullYear()
  return {
    identificador,
    exercicio,
    fileNameBase: `DRE_Projecao_${safeEntidade}_${exercicio}`,
  }
}

interface LinhaExport {
  Estrutura: string
  Tipo: string
  [chaveMes: string]: string | number
}

function montarLinhas(projecao: ProjecaoResultado, mesesExercicio: MesItem[]): LinhaExport[] {
  const linhasMeses = montarLinhasMesesProjecao(
    mesesExercicio,
    projecao.mesesRealizadosComMovimento,
  )
  const colunaMes = (lm: { rotuloCurto: string; projetado: boolean }) =>
    `${lm.rotuloCurto}${lm.projetado ? ' (proj.)' : ''}`

  const rows: LinhaExport[] = []

  for (const grupo of projecao.grupos) {
    const linha: LinhaExport = {
      Estrutura: grupo.titulo,
      Tipo: 'Grupo',
    }
    for (const lm of linhasMeses) {
      linha[colunaMes(lm)] = grupo.valoresPorMes[lm.chave] || 0
    }
    linha['Realizado'] = grupo.realizadoTotal
    linha['Projetado'] = grupo.projetadoTotal
    linha['Total Ano'] = grupo.totalAno
    rows.push(linha)
  }

  rows.push({ Estrutura: '', Tipo: '' })

  // Lucro ou Prejuízo por mês (mesma fórmula da DRE Gerencial)
  const lpReal: LinhaExport = { Estrutura: '= Lucro ou Prejuízo (Resultado)', Tipo: 'Resultado' }
  const lpProj: LinhaExport = { Estrutura: '= Lucro Projetado (meses futuros)', Tipo: 'Resultado' }
  for (const lm of linhasMeses) {
    const rec =
      projecao.grupos.find((g) => g.classificacao === 'Receita')?.valoresPorMes[lm.chave] || 0
    const despVar =
      projecao.grupos.find((g) => g.classificacao === 'Despesa Variável')?.valoresPorMes[
        lm.chave
      ] || 0
    const despFix =
      projecao.grupos.find((g) => g.classificacao === 'Despesa Fixa')?.valoresPorMes[lm.chave] || 0
    const despFin =
      projecao.grupos.find((g) => g.classificacao === 'Despesa Financeira')?.valoresPorMes[
        lm.chave
      ] || 0
    const recFin =
      projecao.grupos.find((g) => g.classificacao === 'Receita Financeira')?.valoresPorMes[
        lm.chave
      ] || 0
    const lp = rec - despVar - despFix - despFin + recFin
    lpReal[colunaMes(lm)] = lm.projetado ? 0 : lp
    lpProj[colunaMes(lm)] = lm.projetado ? lp : 0
  }
  lpReal['Realizado'] = projecao.lucroPrejuizoRealizado
  lpReal['Projetado'] = 0
  lpReal['Total Ano'] = projecao.lucroPrejuizoRealizado
  lpProj['Realizado'] = 0
  lpProj['Projetado'] = projecao.lucroPrejuizoProjetado
  lpProj['Total Ano'] = projecao.lucroPrejuizoProjetado
  rows.push(lpReal, lpProj)

  rows.push({ Estrutura: '', Tipo: '' })

  // Resumo
  rows.push({
    Estrutura: 'Receita — Total Ano (realizado + projetado)',
    Tipo: 'Resumo',
    'Total Ano': projecao.receitaTotalAno,
  })
  rows.push({
    Estrutura: 'Resultado — Total Ano (realizado + projetado)',
    Tipo: 'Resumo',
    'Total Ano': projecao.lucroPrejuizoTotalAno,
  })
  if (projecao.tendenciaVsAnoAnterior) {
    const t = projecao.tendenciaVsAnoAnterior
    rows.push({
      Estrutura: `Tendência vs. exercício ${t.anoAnterior} (resultado)`,
      Tipo: 'Resumo',
      'Total Ano':
        t.variacaoPercentual !== null
          ? `${t.variacaoPercentual >= 0 ? '+' : ''}${t.variacaoPercentual.toFixed(2)}%`
          : '—',
    })
  }
  if (projecao.mesesRealizadosComMovimento.length > 0) {
    rows.push({
      Estrutura: `Base da projeção: média mensal de ${projecao.mesesRealizadosComMovimento.length} mês(es) com movimento`,
      Tipo: 'Nota',
    })
  }

  return rows
}

/**
 * Exporta a Projeção de DRE para Excel (.xlsx) no padrão Borlim (colunas mensais, p.p. de DRE Gerencial)
 */
export function exportarProjecaoDreExcel(
  projecao: ProjecaoResultado,
  mesesExercicio: MesItem[],
  opcoes?: OpcoesExportacaoProjecao,
) {
  const ctx = resolverContexto(projecao, mesesExercicio, opcoes)
  const rows = montarLinhas(projecao, mesesExercicio)

  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.json_to_sheet(rows)
  ws['!cols'] = [
    { wch: 44 }, // Estrutura
    { wch: 12 }, // Tipo
    ...mesesExercicio.map(() => ({ wch: 15 })),
    { wch: 16 }, // Realizado
    { wch: 16 }, // Projetado
    { wch: 16 }, // Total Ano
  ]
  XLSX.utils.book_append_sheet(wb, ws, 'DRE Projeção')
  XLSX.writeFile(wb, `${ctx.fileNameBase}.xlsx`)
}

/**
 * Exporta a Projeção de DRE em CSV (ponto e vírgula, UTF-8 BOM) no padrão do sistema
 */
export function exportarProjecaoDreCsv(
  projecao: ProjecaoResultado,
  mesesExercicio: MesItem[],
  opcoes?: OpcoesExportacaoProjecao,
) {
  const ctx = resolverContexto(projecao, mesesExercicio, opcoes)
  const rows = montarLinhas(projecao, mesesExercicio)

  if (rows.length === 0) return

  const escapeCsv = (val: unknown): string => {
    if (val === null || val === undefined) return ''
    const s = String(val)
    if (/[;"\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
    return s
  }
  const formatMoedaCsv = (v: unknown) => {
    if (typeof v !== 'number') return s(v)
    return v.toFixed(2).replace('.', ',')
  }
  const s = (val: unknown) => (val === null || val === undefined ? '' : String(val))

  const colunas = Object.keys(rows[0])
  const linhas: string[] = [colunas.map(escapeCsv).join(';')]

  for (const row of rows) {
    linhas.push(
      colunas
        .map((c) => {
          const v = row[c]
          // Primeira coluna mensal em diante: valores numéricos em formato BR
          if (c === 'Estrutura' || c === 'Tipo') return escapeCsv(s(v))
          return escapeCsv(formatMoedaCsv(v))
        })
        .join(';'),
    )
  }

  const csvContent = '\uFEFF' + linhas.join('\n')
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.setAttribute('download', `${ctx.fileNameBase}.csv`)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(link.href)
}
