import type { PlanejamentoEconomicoAnalise } from '@/services/planejamentoEconomicoService'

/**
 * Exportação Excel/CSV do Planejamento Econômico — padrão Borlim
 * (CSV com separador ";" e BOM UTF-8; XLSX via SheetJS quando disponível).
 */

function baixarBlob(blob: Blob, nomeArquivo: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nomeArquivo
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function fmtBRL(valor: number): string {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function fmtPct(valor: number | null): string {
  if (valor === null || isNaN(valor)) return '—'
  return `${valor.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`
}

/** CSV no padrão Borlim: separador ";" + BOM UTF-8. */
export function exportarCsvPlanejamento(p: PlanejamentoEconomicoAnalise, nomeEmpresa: string) {
  const esc = (v: unknown) => {
    const s = String(v ?? '')
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const linhas: string[][] = []
  linhas.push(['BORLIM CONSULTORIA EMPRESARIAL — PLANEJAMENTO ECONÔMICO'])
  linhas.push([`Empresa: ${nomeEmpresa}`])
  linhas.push([`Exercício base: ${p.ano_base}`, `Ano projetado: ${p.ano_projecao}`])
  linhas.push([`Benchmark setorial: ${p.benchmark_rotulo || '—'}`])
  linhas.push([])
  linhas.push([
    'Classificação DRE',
    'Código',
    'Conta',
    ...(p.contas[0]?.anos.map((a) => String(a)).reverse() ?? ['A-3', 'A-2', 'A-1']),
    String(p.ano_base),
    `Projeção ${p.ano_projecao}`,
    'Variação % vs atual',
    'Confiança',
    'Comentário do Agente',
  ])
  for (const c of p.contas) {
    linhas.push([
      c.classificacao,
      c.codigo || '',
      c.nome,
      ...c.anos.map((v) => fmtBRL(v)),
      fmtBRL(c.atual),
      fmtBRL(c.valor_projetado),
      fmtPct(c.variacao_pct),
      c.confianca,
      c.comentario || '',
    ])
  }
  linhas.push([])
  linhas.push(['Receita projetada', fmtBRL(p.receita_projetada)])
  linhas.push(['Benchmark (análise do agente)', p.benchmark_mencionado || ''])
  linhas.push(['Parecer geral do agente', p.parecer_geral || ''])

  const csv = '\uFEFF' + linhas.map((l) => l.map(esc).join(';')).join('\n')
  const nome = `planejamento-economico-${nomeEmpresa.replace(/\s+/g, '-')}-${p.ano_projecao}.csv`
  baixarBlob(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), nome)
}

/** Linhas tabulares para o XLSX (uma linha por conta + cabeçalho e rodapé). */
export function montarLinhasXlsxPlanejamento(
  p: PlanejamentoEconomicoAnalise,
  nomeEmpresa: string,
): string[][] {
  const linhas: string[][] = []
  linhas.push(['BORLIM CONSULTORIA EMPRESARIAL — PLANEJAMENTO ECONÔMICO'])
  linhas.push([`Empresa: ${nomeEmpresa}`])
  linhas.push([`Exercício base: ${p.ano_base}`, `Ano projetado: ${p.ano_projecao}`])
  linhas.push([`Benchmark setorial: ${p.benchmark_rotulo || '—'}`])
  linhas.push([])
  linhas.push([
    'Classificação DRE',
    'Código',
    'Conta',
    'Histórico (anos anteriores mais antigos → recentes)',
    String(p.ano_base),
    `Projeção ${p.ano_projecao}`,
    'Variação % vs atual',
    'Confiança',
    'Comentário do Agente',
  ])
  for (const c of p.contas) {
    linhas.push([
      c.classificacao,
      c.codigo || '',
      c.nome,
      c.anos.map((v) => fmtBRL(v)).join(' | '),
      fmtBRL(c.atual),
      fmtBRL(c.valor_projetado),
      fmtPct(c.variacao_pct),
      c.confianca,
      c.comentario || '',
    ])
  }
  linhas.push([])
  linhas.push(['Receita projetada', fmtBRL(p.receita_projetada)])
  linhas.push(['Benchmark (análise do agente)', p.benchmark_mencionado || ''])
  linhas.push(['Parecer geral do agente', p.parecer_geral || ''])
  return linhas
}

/** XLSX real via SheetJS (padrão Borlim); fallback CSV se a lib não estiver presente. */
export async function exportarXlsxPlanejamento(
  p: PlanejamentoEconomicoAnalise,
  nomeEmpresa: string,
) {
  try {
    const XLSX = await import('xlsx')
    const ws = XLSX.utils.aoa_to_sheet(montarLinhasXlsxPlanejamento(p, nomeEmpresa))
    ws['!cols'] = [
      { wch: 18 },
      { wch: 12 },
      { wch: 42 },
      { wch: 46 },
      { wch: 16 },
      { wch: 16 },
      { wch: 12 },
      { wch: 10 },
      { wch: 70 },
    ]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, `Planejamento ${p.ano_projecao}`)
    const saida = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
    const nome = `planejamento-economico-${nomeEmpresa.replace(/\s+/g, '-')}-${p.ano_projecao}.xlsx`
    baixarBlob(
      new Blob([saida], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      }),
      nome,
    )
  } catch {
    exportarCsvPlanejamento(p, nomeEmpresa)
  }
}
