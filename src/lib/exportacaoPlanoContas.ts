import * as XLSX from 'xlsx'
import type {
  PlanoContaRecord,
  ContaRecord,
  CentroRecord,
  TipoDespesaRecord,
  EmpresaRecord,
} from '@/types/finance'

export interface DadosItemPlanoExport {
  codigo: string
  contaNome: string
  contaCodigo?: string
  tipoConta: string
  grupoConta?: string
  centroNome: string
  centroCodigo?: string
  tipoDespesaNome?: string
  tipoDespesaCodigo?: string
  descricao?: string
}

/**
 * Normaliza o nome da empresa para ser usado em nomes de arquivo
 */
export function sanitizeNomeArquivo(nome: string): string {
  return nome
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()
}

/**
 * Constrói a lista de dados estruturados para exportação com base nos mapas de lookup
 */
export function prepararDadosExportacaoPlano(
  itens: PlanoContaRecord[],
  contaMap: Map<string, ContaRecord>,
  centroMap: Map<string, CentroRecord>,
  tipoMap: Map<string, TipoDespesaRecord>,
): DadosItemPlanoExport[] {
  return itens.map((item) => {
    const conta = contaMap.get(item.conta)
    const centro = centroMap.get(item.centro)
    const tipo = item.tipo_despesa ? tipoMap.get(item.tipo_despesa) : undefined

    return {
      codigo: item.codigo || '',
      contaNome: conta?.nome || '',
      contaCodigo: conta?.codigo || '',
      tipoConta: conta?.tipo || '',
      grupoConta: conta?.grupo || '',
      centroNome: centro?.nome || '',
      centroCodigo: centro?.codigo || '',
      tipoDespesaNome: tipo?.nome || '',
      tipoDespesaCodigo: tipo?.codigo || '',
      descricao: item.descricao || '',
    }
  })
}

/**
 * Gera e baixa o arquivo Excel (.xlsx) com o plano de contas da empresa
 * Cabeçalhos em português: Código, Conta/Nome, Tipo/Natureza, Grupo/Categoria, Centro de Custo, Tipo de Despesa, Descrição
 */
export function exportarPlanoContasExcel(
  empresa: EmpresaRecord | null | undefined,
  itens: PlanoContaRecord[],
  contaMap: Map<string, ContaRecord>,
  centroMap: Map<string, CentroRecord>,
  tipoMap: Map<string, TipoDespesaRecord>,
) {
  const dados = prepararDadosExportacaoPlano(itens, contaMap, centroMap, tipoMap)
  const nomeEmpresa = empresa?.nome || 'empresa'
  const dataStr = new Date().toISOString().slice(0, 10)
  const safeEmpresa = sanitizeNomeArquivo(nomeEmpresa)
  const fileName = `plano-contas-${safeEmpresa}-${dataStr}.xlsx`

  const rows = dados.map((d) => ({
    Código: d.codigo,
    'Conta/Nome': d.contaCodigo ? `${d.contaCodigo} - ${d.contaNome}` : d.contaNome,
    'Tipo/Natureza': d.tipoConta,
    'Grupo/Categoria': d.grupoConta || '—',
    'Centro de Custo': d.centroCodigo ? `${d.centroCodigo} - ${d.centroNome}` : d.centroNome,
    'Tipo de Despesa': d.tipoDespesaNome || '—',
    Descrição: d.descricao || '',
  }))

  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.json_to_sheet(rows)

  // Ajusta larguras das colunas
  ws['!cols'] = [
    { wch: 12 }, // Código
    { wch: 36 }, // Conta/Nome
    { wch: 20 }, // Tipo/Natureza
    { wch: 28 }, // Grupo/Categoria
    { wch: 28 }, // Centro de Custo
    { wch: 22 }, // Tipo de Despesa
    { wch: 32 }, // Descrição
  ]

  XLSX.utils.book_append_sheet(wb, ws, 'Plano de Contas')
  XLSX.writeFile(wb, fileName)
}

/**
 * Gera e baixa o arquivo CSV com o plano de contas da empresa (formato pt-BR com separador ';' e UTF-8 BOM)
 */
export function exportarPlanoContasCsv(
  empresa: EmpresaRecord | null | undefined,
  itens: PlanoContaRecord[],
  contaMap: Map<string, ContaRecord>,
  centroMap: Map<string, CentroRecord>,
  tipoMap: Map<string, TipoDespesaRecord>,
) {
  const dados = prepararDadosExportacaoPlano(itens, contaMap, centroMap, tipoMap)
  const nomeEmpresa = empresa?.nome || 'empresa'
  const dataStr = new Date().toISOString().slice(0, 10)
  const safeEmpresa = sanitizeNomeArquivo(nomeEmpresa)
  const fileName = `plano-contas-${safeEmpresa}-${dataStr}.csv`

  const escapeCsv = (val: string | number | undefined | null): string => {
    if (val === null || val === undefined) return ''
    const s = String(val)
    if (/[;"\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
    return s
  }

  const colunas = [
    'Código',
    'Conta/Nome',
    'Tipo/Natureza',
    'Grupo/Categoria',
    'Centro de Custo',
    'Tipo de Despesa',
    'Descrição',
  ]

  const linhas: string[] = []
  linhas.push(colunas.map(escapeCsv).join(';'))

  for (const d of dados) {
    const contaStr = d.contaCodigo ? `${d.contaCodigo} - ${d.contaNome}` : d.contaNome
    const centroStr = d.centroCodigo ? `${d.centroCodigo} - ${d.centroNome}` : d.centroNome
    linhas.push(
      [
        d.codigo,
        contaStr,
        d.tipoConta,
        d.grupoConta || '',
        centroStr,
        d.tipoDespesaNome || '',
        d.descricao || '',
      ]
        .map(escapeCsv)
        .join(';'),
    )
  }

  const csvContent = '\uFEFF' + linhas.join('\n')
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.setAttribute('download', fileName)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(link.href)
}
