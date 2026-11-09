/**
 * Exportador do Termômetro de Insolvência (Z-Score de Altman) para Excel (.xlsx) e CSV.
 * Padrão Borlim: separador ";" + BOM no CSV, colunas dimensionadas no XLSX.
 */

import * as XLSX from 'xlsx'
import type { EmpresaRecord } from '@/types/finance'
import { sanitizeNomeArquivo } from './exportacaoPlanoContas'
import type { ZScoreResultado } from './termometroInsolvenciaCalculo'
import { ROTULO_ZONA } from './termometroInsolvenciaCalculo'

const fmtNum = (v: number | null, dec = 4): string =>
  v === null || v === undefined || Number.isNaN(v) ? '—' : v.toFixed(dec).replace('.', ',')

const fmtBrl = (v: number | null): string =>
  v === null || v === undefined || Number.isNaN(v)
    ? '—'
    : new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(
        v,
      )

export function exportarTermometroExcel(
  z: ZScoreResultado,
  empresa?: EmpresaRecord | null,
  exercicioAno?: number,
) {
  const nomeEmpresa = empresa?.nome || 'Empresa'
  const safeEmpresa = sanitizeNomeArquivo(nomeEmpresa)
  const fileName = `termometro-insolvencia-altman-${safeEmpresa}-${exercicioAno || new Date().getFullYear()}.xlsx`

  const wb = XLSX.utils.book_new()

  // Aba 1: Síntese
  const linhasSintese = [
    { Indicador: 'Empresa', Valor: nomeEmpresa },
    { Indicador: 'Exercício', Valor: exercicioAno || '—' },
    { Indicador: "Z-Score (Modelo Privado Z'')", Valor: fmtNum(z.zPrivada, 3) },
    {
      Indicador: 'Zona (Modelo Privado)',
      Valor: z.zonaPrivada ? ROTULO_ZONA[z.zonaPrivada] : 'Sem dados',
    },
    { Indicador: 'Z-Score (Modelo Clássico 1968)', Valor: fmtNum(z.zClassica, 3) },
    {
      Indicador: 'Zona (Modelo Clássico)',
      Valor: z.zonaClassica ? ROTULO_ZONA[z.zonaClassica] : 'Sem dados',
    },
    { Indicador: 'Ativo Total (R$)', Valor: fmtBrl(z.ativoTotal) },
    { Indicador: 'Capital de Giro Líquido (R$)', Valor: fmtBrl(z.capitalGiroLiquido) },
    { Indicador: 'Lucros Acumulados + Reservas (R$)', Valor: fmtBrl(z.lucrosAcumulados) },
    { Indicador: 'EBIT ≈ EBITDA oficial (R$)', Valor: fmtBrl(z.ebitAproximado) },
    { Indicador: 'Patrimônio Líquido (R$)', Valor: fmtBrl(z.patrimonioLiquido) },
    { Indicador: 'Passivo Total (R$)', Valor: fmtBrl(z.passivoTotal) },
    { Indicador: 'Receita Líquida (R$)', Valor: fmtBrl(z.receitaLiquida) },
  ]
  const wsSintese = XLSX.utils.json_to_sheet(linhasSintese)
  wsSintese['!cols'] = [{ wch: 40 }, { wch: 30 }]
  XLSX.utils.book_append_sheet(wb, wsSintese, 'Síntese Altman')

  // Aba 2: Componentes (ambos os modelos)
  const linhasComponentes = [...z.componentesPrivada, ...z.componentesClassica].map((c) => ({
    Modelo: c.modelo === 'privada' ? "Z'' (Privada)" : 'Z Clássica (1968)',
    Componente: `${c.codigo} — ${c.nome}`,
    Fórmula: c.formula,
    Valor: fmtNum(c.valor),
    Peso: fmtNum(c.peso, 2),
    Contribuição: fmtNum(c.contribuicao),
  }))
  const wsComp = XLSX.utils.json_to_sheet(linhasComponentes)
  wsComp['!cols'] = [{ wch: 18 }, { wch: 42 }, { wch: 52 }, { wch: 12 }, { wch: 10 }, { wch: 14 }]
  XLSX.utils.book_append_sheet(wb, wsComp, 'Componentes X1..X5')

  XLSX.writeFile(wb, fileName)
}

export function exportarTermometroCsv(
  z: ZScoreResultado,
  empresa?: EmpresaRecord | null,
  exercicioAno?: number,
) {
  const nomeEmpresa = empresa?.nome || 'Empresa'
  const safeEmpresa = sanitizeNomeArquivo(nomeEmpresa)
  const fileName = `termometro-insolvencia-altman-${safeEmpresa}-${exercicioAno || new Date().getFullYear()}.csv`

  const escapeCsv = (val: unknown): string => {
    if (val === null || val === undefined) return ''
    const s = String(val)
    if (/[;"\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
    return s
  }

  const linhas: string[] = []
  linhas.push(['Empresa', 'Exercício'].map(escapeCsv).join(';'))
  linhas.push([nomeEmpresa, exercicioAno || ''].map(escapeCsv).join(';'))
  linhas.push('')
  linhas.push(
    ['Modelo', 'Componente', 'Fórmula', 'Valor', 'Peso', 'Contribuição'].map(escapeCsv).join(';'),
  )

  const adicionar = (modelo: string, comps: ZScoreResultado['componentesPrivada']) => {
    for (const c of comps) {
      linhas.push(
        [
          modelo,
          `${c.codigo} — ${c.nome}`,
          c.formula,
          fmtNum(c.valor),
          fmtNum(c.peso, 2),
          fmtNum(c.contribuicao),
        ]
          .map(escapeCsv)
          .join(';'),
      )
    }
  }

  adicionar("Z'' (Privada)", z.componentesPrivada)
  adicionar('Z Clássica (1968)', z.componentesClassica)

  linhas.push('')
  linhas.push(
    ['Resumo', "Z'' Privada", 'Zona Privada', 'Z Clássica', 'Zona Clássica']
      .map(escapeCsv)
      .join(';'),
  )
  linhas.push(
    [
      'Resultado',
      fmtNum(z.zPrivada, 3),
      z.zonaPrivada ? ROTULO_ZONA[z.zonaPrivada] : 'Sem dados',
      fmtNum(z.zClassica, 3),
      z.zonaClassica ? ROTULO_ZONA[z.zonaClassica] : 'Sem dados',
    ]
      .map(escapeCsv)
      .join(';'),
  )

  const csvContent = '\uFEFF' + linhas.join('\r\n')
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.setAttribute('href', url)
  link.setAttribute('download', fileName)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
