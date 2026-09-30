import pb from '@/lib/pocketbase/client'
import * as XLSX from 'xlsx'
import { parseBrlNumber } from '@/lib/pdfParser'
import { findBestPlanoContaMatch } from '@/lib/pdfMatching'
import type { EmpresaRecord, PlanoContaRecord, MemoriaFornecedorRecord } from '@/types/finance'

export interface ColumnMappingState {
  data: string
  historico: string
  valor: string
  tipo: string // 'Receita' | 'Despesa' ou coluna
  codigoConta: string
  nomeConta: string
  centroCusto: string
  documento: string
  formaPagamento: string
}

export interface LancamentoExcelLinha {
  id: string
  linhaPlanilha: number
  dataStr: string
  dataIso: string
  ano: number
  mes: number // 1 a 12
  historico: string
  valor: number
  tipo: 'Receita' | 'Despesa'
  codigoContaPlanilha?: string
  nomeContaPlanilha?: string
  centroCustoPlanilha?: string
  documentoPlanilha?: string
  formaPagamentoPlanilha?: string
  // Vínculo inteligente com Plano de Contas
  planoContaId?: string
  planoContaCodigo?: string
  planoContaNome?: string
  planoContaTipo?: string
  planoContaObj?: PlanoContaRecord
  matchConfidence: 'memoria' | 'codigo_empresa' | 'exato' | 'similar' | 'manual' | 'nao_encontrado'
  status: 'valido' | 'alerta' | 'fora_periodo' | 'duplicado' | 'erro'
  errosOuAlertas: string[]
  selecionado: boolean
  isDuplicadoExistente?: boolean
}

export interface ResumoImportacaoExcelLancamentos {
  totalLidos: number
  totalNoPeriodo: number
  totalForaPeriodo: number
  totalValidos: number
  totalComProblema: number
  totalDuplicados: number
  totalReceitas: number
  totalDespesas: number
  valorTotalReceitas: number
  valorTotalDespesas: number
  mesesDetectados: { [mes: number]: { count: number; valor: number } }
}

export const NOMES_MESES_EXTENSO = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
]

/**
 * Normaliza datas do Excel (número serial, Date, string ISO, DD/MM/AAAA, etc)
 */
export function normalizarDataExcel(
  val: unknown,
): { iso: string; ano: number; mes: number; display: string } | null {
  if (val === null || val === undefined || val === '') return null

  let d: Date | null = null

  if (val instanceof Date && !isNaN(val.getTime())) {
    d = val
  } else if (typeof val === 'number') {
    // Serial do Excel: dias desde 1899-12-30
    const parsed = XLSX.SSF.parse_date_code(val)
    if (parsed) {
      d = new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d))
    }
  } else if (typeof val === 'string') {
    const s = val.trim()
    // Tenta formato DD/MM/YYYY ou DD-MM-YYYY
    const brMatch = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})/)
    if (brMatch) {
      const dia = parseInt(brMatch[1], 10)
      const mes = parseInt(brMatch[2], 10)
      let ano = parseInt(brMatch[3], 10)
      if (ano < 100) ano += 2000
      d = new Date(ano, mes - 1, dia)
    } else {
      // Tenta formato YYYY-MM-DD
      const isoMatch = s.match(/^(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})/)
      if (isoMatch) {
        const ano = parseInt(isoMatch[1], 10)
        const mes = parseInt(isoMatch[2], 10)
        const dia = parseInt(isoMatch[3], 10)
        d = new Date(ano, mes - 1, dia)
      } else {
        const timestamp = Date.parse(s)
        if (!isNaN(timestamp)) {
          d = new Date(timestamp)
        }
      }
    }
  }

  if (!d || isNaN(d.getTime())) return null

  const ano = d.getFullYear()
  const mes = d.getMonth() + 1
  const dia = d.getDate()
  const pad = (n: number) => String(n).padStart(2, '0')
  const iso = `${ano}-${pad(mes)}-${pad(dia)}`
  const display = `${pad(dia)}/${pad(mes)}/${ano}`

  return { iso, ano, mes, display }
}

/**
 * Lê arquivo Excel ou CSV usando a biblioteca xlsx
 */
export async function extrairLinhasExcel(file: File): Promise<{
  headers: string[]
  rawRows: Array<Record<string, unknown>>
}> {
  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, {
    type: 'array',
    cellDates: true,
    raw: false,
    dateNF: 'yyyy-mm-dd',
  })

  const firstSheetName = workbook.SheetNames[0]
  if (!firstSheetName) {
    throw new Error('A planilha está vazia ou não possui abas.')
  }

  const sheet = workbook.Sheets[firstSheetName]
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: '',
    raw: false,
  })

  if (rows.length === 0) {
    throw new Error('Nenhuma linha de dados encontrada na planilha.')
  }

  const headers = Object.keys(rows[0] || {})
  return { headers, rawRows: rows }
}

/**
 * Heurística preliminar rápida de detecção de colunas
 */
export function sugerirMapeamentoHeuristico(headers: string[]): ColumnMappingState {
  const clean = (s: string) =>
    s
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '')

  const mapping: ColumnMappingState = {
    data: '',
    historico: '',
    valor: '',
    tipo: '',
    codigoConta: '',
    nomeConta: '',
    centroCusto: '',
    documento: '',
    formaPagamento: '',
  }

  for (const h of headers) {
    const c = clean(h)
    if (
      !mapping.data &&
      (c.includes('data') ||
        c.includes('dt') ||
        c.includes('competencia') ||
        c.includes('vencimento') ||
        c.includes('pagamento'))
    ) {
      mapping.data = h
    } else if (
      !mapping.valor &&
      (c.includes('valor') ||
        c.includes('total') ||
        c.includes('quantia') ||
        c.includes('debito') ||
        c.includes('credito') ||
        c.includes('montante'))
    ) {
      mapping.valor = h
    } else if (
      !mapping.historico &&
      (c.includes('historico') ||
        c.includes('descricao') ||
        c.includes('fornecedor') ||
        c.includes('cliente') ||
        c.includes('detalhe') ||
        c.includes('complemento'))
    ) {
      mapping.historico = h
    } else if (
      !mapping.tipo &&
      (c === 'tipo' ||
        c.includes('natureza') ||
        c.includes('operacao') ||
        c.includes('entradasaida') ||
        c.includes('d_c') ||
        c.includes('dc'))
    ) {
      mapping.tipo = h
    } else if (
      !mapping.codigoConta &&
      (c.includes('codconta') ||
        c.includes('codigoconta') ||
        c.includes('reduzido') ||
        c.includes('contared') ||
        c.includes('classificacao'))
    ) {
      mapping.codigoConta = h
    } else if (
      !mapping.nomeConta &&
      (c.includes('nomeconta') ||
        c.includes('conta') ||
        c.includes('tituloconta') ||
        c.includes('categoria'))
    ) {
      mapping.nomeConta = h
    } else if (
      !mapping.centroCusto &&
      (c.includes('centro') ||
        c.includes('cc') ||
        c.includes('departamento') ||
        c.includes('unidade'))
    ) {
      mapping.centroCusto = h
    } else if (
      !mapping.documento &&
      (c.includes('documento') ||
        c.includes('doc') ||
        c.includes('nf') ||
        c.includes('numero') ||
        c.includes('nota'))
    ) {
      mapping.documento = h
    } else if (
      !mapping.formaPagamento &&
      (c.includes('forma') || c.includes('pagamento') || c.includes('meio') || c.includes('banco'))
    ) {
      mapping.formaPagamento = h
    }
  }

  // Fallbacks seguros se ainda não encontrou
  if (!mapping.data) {
    const firstDateCol = headers.find((h) => clean(h).includes('dt') || clean(h).includes('dia'))
    if (firstDateCol) mapping.data = firstDateCol
  }

  if (!mapping.historico) {
    const firstTextCol = headers.find(
      (h) =>
        h !== mapping.data &&
        h !== mapping.valor &&
        !clean(h).includes('cod') &&
        !clean(h).includes('id'),
    )
    if (firstTextCol) mapping.historico = firstTextCol
  }

  return mapping
}

/**
 * Envia cabeçalho e amostra para o assistente de IA analisar mapeamento
 */
export async function analisarColunasComIA(
  headers: string[],
  sampleRows: Array<Record<string, unknown>>,
): Promise<{ mapping: Partial<ColumnMappingState>; confianca: number; observacoes?: string }> {
  try {
    const backendUrl = import.meta.env.VITE_POCKETBASE_URL || ''
    const token = pb.authStore.token
    if (!token) {
      throw new Error('Não autenticado')
    }

    const res = await fetch(`${backendUrl}/backend/v1/agent-lancamentos/analisar-colunas`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: token,
      },
      body: JSON.stringify({
        headers,
        sampleRows: sampleRows.slice(0, 10),
      }),
    })

    if (!res.ok) {
      throw new Error(`Falha no assistente IA (${res.status})`)
    }

    const data = await res.json()
    return data
  } catch (err) {
    console.warn('[analisarColunasComIA] Fallback heurístico aplicado:', err)
    const heur = sugerirMapeamentoHeuristico(headers)
    return {
      mapping: heur,
      confianca: 0.7,
      observacoes: 'Mapeamento inteligente por regras contábeis locais.',
    }
  }
}

/**
 * Processa as linhas cruas da planilha de acordo com o mapeamento e regras de negócio
 */
export function processarLinhasPlanilha(options: {
  rawRows: Array<Record<string, unknown>>
  mapping: ColumnMappingState
  anoSelecionado: number
  mesInicial: number // 1 a 12
  mesFinal: number // 1 a 12
  mesesHabilitados?: Set<number>
  planoContas: PlanoContaRecord[]
  memoriasFornecedores?: MemoriaFornecedorRecord[]
  mapeamentosAprendidos?: Array<{ codigo_empresa: string; plano_conta: string }>
  lancamentosExistentes?: Array<{
    data: string
    valor: number
    historico?: string
    plano_conta?: string
  }>
}): {
  linhas: LancamentoExcelLinha[]
  resumo: ResumoImportacaoExcelLancamentos
} {
  const {
    rawRows,
    mapping,
    anoSelecionado,
    mesInicial,
    mesFinal,
    mesesHabilitados,
    planoContas,
    memoriasFornecedores,
    mapeamentosAprendidos,
    lancamentosExistentes = [],
  } = options

  const minMes = Math.min(mesInicial, mesFinal)
  const maxMes = Math.max(mesInicial, mesFinal)

  // Cache de duplicatas existentes no banco para checagem rápida
  const existingSet = new Set<string>()
  for (const l of lancamentosExistentes) {
    const dStr = (l.data || '').slice(0, 10)
    const vStr = Math.abs(Number(l.valor) || 0).toFixed(2)
    const hStr = (l.historico || '').toLowerCase().trim()
    const pStr = l.plano_conta || ''
    // Chave única: data + valor + historico
    existingSet.add(`${dStr}|${vStr}|${hStr}`)
    if (pStr) {
      existingSet.add(`${dStr}|${vStr}|${hStr}|${pStr}`)
    }
  }

  const linhas: LancamentoExcelLinha[] = []

  let totalLidos = 0
  let totalNoPeriodo = 0
  let totalForaPeriodo = 0
  let totalValidos = 0
  let totalComProblema = 0
  let totalDuplicados = 0
  let totalReceitas = 0
  let totalDespesas = 0
  let valorTotalReceitas = 0
  let valorTotalDespesas = 0
  const mesesDetectados: { [mes: number]: { count: number; valor: number } } = {}

  rawRows.forEach((row, idx) => {
    totalLidos++
    const linhaPlanilha = idx + 2 // Linha 1 é cabeçalho

    // 1. Data
    const rawData = mapping.data ? row[mapping.data] : ''
    const dataParsed = normalizarDataExcel(rawData)

    // 2. Valor
    const rawValor = mapping.valor ? row[mapping.valor] : ''
    let valorNum = 0
    let valorNegativoDetectado = false

    if (typeof rawValor === 'number') {
      valorNegativoDetectado = rawValor < 0
      valorNum = Math.abs(rawValor)
    } else if (typeof rawValor === 'string' && rawValor.trim()) {
      valorNegativoDetectado = rawValor.includes('-') || /^\(.*\)$/.test(rawValor.trim())
      valorNum = Math.abs(parseBrlNumber(rawValor))
    }

    // 3. Histórico / Descrição
    const rawHist = mapping.historico ? String(row[mapping.historico] || '').trim() : ''

    // 4. Tipo (Receita / Despesa)
    let tipoFinal: 'Receita' | 'Despesa' = 'Despesa'
    const rawTipo = mapping.tipo
      ? String(row[mapping.tipo] || '')
          .trim()
          .toLowerCase()
      : ''

    if (rawTipo) {
      if (
        rawTipo.includes('rec') ||
        rawTipo.includes('ent') ||
        rawTipo.includes('cred') ||
        rawTipo === 'c' ||
        rawTipo === 'r'
      ) {
        tipoFinal = 'Receita'
      } else if (
        rawTipo.includes('desp') ||
        rawTipo.includes('sai') ||
        rawTipo.includes('deb') ||
        rawTipo === 'd'
      ) {
        tipoFinal = 'Despesa'
      }
    } else if (valorNegativoDetectado) {
      // Se valor na planilha era negativo, geralmente indica saída / despesa
      tipoFinal = 'Despesa'
    } else {
      // Tenta inferir pelo histórico
      const histLower = rawHist.toLowerCase()
      if (
        histLower.includes('venda') ||
        histLower.includes('faturamento') ||
        histLower.includes('receita') ||
        histLower.includes('recebimento') ||
        histLower.includes('servico prestado')
      ) {
        tipoFinal = 'Receita'
      }
    }

    // Campos adicionais
    const codigoContaPlanilha = mapping.codigoConta
      ? String(row[mapping.codigoConta] || '').trim()
      : undefined
    const nomeContaPlanilha = mapping.nomeConta
      ? String(row[mapping.nomeConta] || '').trim()
      : undefined
    const centroCustoPlanilha = mapping.centroCusto
      ? String(row[mapping.centroCusto] || '').trim()
      : undefined
    const documentoPlanilha = mapping.documento
      ? String(row[mapping.documento] || '').trim()
      : undefined
    const formaPagamentoPlanilha = mapping.formaPagamento
      ? String(row[mapping.formaPagamento] || '').trim()
      : undefined

    // 5. Match inteligente com Plano de Contas
    const termoBuscaConta = nomeContaPlanilha || rawHist || ''
    const matchRes = findBestPlanoContaMatch(
      termoBuscaConta,
      planoContas,
      codigoContaPlanilha || rawHist,
      mapeamentosAprendidos,
    )

    let planoContaObj = matchRes.match
    let matchConfidence: LancamentoExcelLinha['matchConfidence'] = 'nao_encontrado'

    if (matchRes.type === 'aprendido') {
      matchConfidence = 'memoria'
    } else if (matchRes.type === 'codigo_empresa') {
      matchConfidence = 'codigo_empresa'
    } else if (matchRes.type === 'exact') {
      matchConfidence = 'exato'
    } else if (matchRes.type === 'contains' || matchRes.type === 'code') {
      matchConfidence = 'similar'
    }

    // Se ainda não encontrou, tenta buscar na memória de fornecedores
    if (!planoContaObj && memoriasFornecedores && memoriasFornecedores.length > 0 && rawHist) {
      const histClean = rawHist.toLowerCase()
      const mem = memoriasFornecedores.find((m) => {
        const termo = (m.termo_busca || m.fornecedor_padrao || '').toLowerCase().trim()
        return termo && (histClean.includes(termo) || termo.includes(histClean))
      })

      if (mem && mem.plano_conta) {
        const pc = planoContas.find((p) => p.id === mem.plano_conta)
        if (pc) {
          planoContaObj = pc
          matchConfidence = 'memoria'
        }
      }
    }

    // Se o plano encontrado tem tipo e ainda não determinamos claramente o tipo
    if (planoContaObj?.expand?.conta?.tipo) {
      const tipoConta = planoContaObj.expand.conta.tipo
      if (tipoConta === 'Receita') tipoFinal = 'Receita'
      if (tipoConta === 'Despesa') tipoFinal = 'Despesa'
    }

    // 6. Validação e Status
    const errosOuAlertas: string[] = []
    let status: LancamentoExcelLinha['status'] = 'valido'

    if (!dataParsed) {
      errosOuAlertas.push('Data inválida ou não informada')
      status = 'erro'
    } else if (dataParsed.ano !== anoSelecionado) {
      errosOuAlertas.push(`Ano ${dataParsed.ano} difere do ano selecionado (${anoSelecionado})`)
      status = 'fora_periodo'
    } else {
      const estaNoPeriodo = mesesHabilitados
        ? mesesHabilitados.has(dataParsed.mes)
        : dataParsed.mes >= minMes && dataParsed.mes <= maxMes

      if (!estaNoPeriodo) {
        errosOuAlertas.push(
          `Mês de ${NOMES_MESES_EXTENSO[dataParsed.mes - 1]} (${dataParsed.mes}) fora do período (${minMes} a ${maxMes})`,
        )
        status = 'fora_periodo'
      }
    }

    if (valorNum <= 0) {
      errosOuAlertas.push('Valor zerado ou não identificado')
      if (status !== 'fora_periodo') status = 'erro'
    }

    if (!planoContaObj) {
      errosOuAlertas.push('Conta contábil não localizada no Plano de Contas')
      if (status === 'valido') status = 'alerta'
    }

    // Checagem de duplicidade
    let isDuplicadoExistente = false
    if (dataParsed && valorNum > 0 && status !== 'erro' && status !== 'fora_periodo') {
      const chaveSimples = `${dataParsed.iso}|${valorNum.toFixed(2)}|${rawHist.toLowerCase().trim()}`
      if (existingSet.has(chaveSimples)) {
        isDuplicadoExistente = true
        errosOuAlertas.push('Lançamento com mesma data, valor e histórico já existe no sistema')
        status = 'duplicado'
      }
    }

    // Atualiza contadores
    if (status === 'fora_periodo') {
      totalForaPeriodo++
    } else {
      totalNoPeriodo++

      if (dataParsed) {
        if (!mesesDetectados[dataParsed.mes]) {
          mesesDetectados[dataParsed.mes] = { count: 0, valor: 0 }
        }
        mesesDetectados[dataParsed.mes].count++
        mesesDetectados[dataParsed.mes].valor += valorNum
      }

      if (tipoFinal === 'Receita') {
        totalReceitas++
        valorTotalReceitas += valorNum
      } else {
        totalDespesas++
        valorTotalDespesas += valorNum
      }

      if (status === 'valido') {
        totalValidos++
      } else if (status === 'alerta' || status === 'erro') {
        totalComProblema++
      } else if (status === 'duplicado') {
        totalDuplicados++
      }
    }

    // Linhas válidas ou com alerta são marcadas para importação por padrão; erros e duplicados começam desmarcados
    const selecionadoPadrao = status === 'valido' || status === 'alerta'

    linhas.push({
      id: `linha_${idx}_${Math.random().toString(36).substring(2, 7)}`,
      linhaPlanilha,
      dataStr: dataParsed?.display || String(rawData || 'Data inválida'),
      dataIso: dataParsed?.iso || '',
      ano: dataParsed?.ano || 0,
      mes: dataParsed?.mes || 0,
      historico: rawHist || `Lançamento linha ${linhaPlanilha}`,
      valor: valorNum,
      tipo: tipoFinal,
      codigoContaPlanilha,
      nomeContaPlanilha,
      centroCustoPlanilha,
      documentoPlanilha,
      formaPagamentoPlanilha,
      planoContaId: planoContaObj?.id,
      planoContaCodigo: planoContaObj?.codigo,
      planoContaNome: planoContaObj?.expand?.conta?.nome || planoContaObj?.descricao,
      planoContaTipo: planoContaObj?.expand?.conta?.tipo,
      planoContaObj,
      matchConfidence,
      status,
      errosOuAlertas,
      selecionado: selecionadoPadrao,
      isDuplicadoExistente,
    })
  })

  return {
    linhas,
    resumo: {
      totalLidos,
      totalNoPeriodo,
      totalForaPeriodo,
      totalValidos,
      totalComProblema,
      totalDuplicados,
      totalReceitas,
      totalDespesas,
      valorTotalReceitas,
      valorTotalDespesas,
      mesesDetectados,
    },
  }
}

/**
 * Cria modelo Excel de exemplo para download
 */
export function gerarPlanilhaModeloExcel(): void {
  const data = [
    {
      Data: '15/01/2025',
      Historico: 'Recebimento de Prestação de Serviços de Consultoria',
      Valor: 12500.0,
      Tipo: 'Receita',
      'Conta Contabil': 'Receita de Prestação de Serviços',
      'Codigo Conta': '3.1.01',
      'Centro de Custo': 'Consultoria',
      Documento: 'NF-1024',
      'Forma de Pagamento': 'PIX',
    },
    {
      Data: '20/01/2025',
      Historico: 'Pagamento de Aluguel Escritório Central',
      Valor: 3200.0,
      Tipo: 'Despesa',
      'Conta Contabil': 'Aluguéis e Condomínio',
      'Codigo Conta': '4.1.02',
      'Centro de Custo': 'Administrativo',
      Documento: 'DOC-5541',
      'Forma de Pagamento': 'Boleto',
    },
    {
      Data: '05/02/2025',
      Historico: 'Folha de Pagamento Salários Mensais',
      Valor: 18450.0,
      Tipo: 'Despesa',
      'Conta Contabil': 'Salários e Ordenados',
      'Codigo Conta': '4.1.01',
      'Centro de Custo': 'Geral',
      Documento: 'FOLHA-02',
      'Forma de Pagamento': 'Transferência Bancária',
    },
    {
      Data: '10/02/2025',
      Historico: 'Venda de Produtos Linha Premium',
      Valor: 28900.0,
      Tipo: 'Receita',
      'Conta Contabil': 'Receita Bruta de Vendas',
      'Codigo Conta': '3.1.02',
      'Centro de Custo': 'Comercial',
      Documento: 'NFe-4081',
      'Forma de Pagamento': 'Cartão de Crédito',
    },
  ]

  const ws = XLSX.utils.json_to_sheet(data)
  // Largura das colunas amigável
  ws['!cols'] = [
    { wch: 12 },
    { wch: 45 },
    { wch: 14 },
    { wch: 12 },
    { wch: 32 },
    { wch: 14 },
    { wch: 18 },
    { wch: 14 },
    { wch: 22 },
  ]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Lancamentos_Mensais')
  XLSX.writeFile(wb, 'modelo_lancamentos_excel_ia.xlsx')
}
