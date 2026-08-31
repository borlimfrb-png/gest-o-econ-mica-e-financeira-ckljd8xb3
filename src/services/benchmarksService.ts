import pb from '@/lib/pocketbase/client'
import type {
  BenchmarkSetorialRecord,
  BenchmarkEmpresaRecord,
  SegmentoEmpresa,
  EmpresaRecord,
} from '@/types/finance'
import { BENCHMARKS_SETORIAIS, type BenchmarkSetorValores } from '@/lib/benchmarks'

export interface CsvBenchmarkRow {
  setor: string
  descricao: string
  liquidezCorrente: number
  liquidezSeca: number
  liquidezImediata: number
  liquidezGeral: number
  endividamentoGeral: number
  composicaoEndividamento: number
  participacaoCapitalTerceiros: number
  imobilizacaoPL: number
  margemBruta: number
  margemOperacional: number
  margemLiquida: number
  roa: number
  roe: number
  giroAtivo: number
  autonomiaFinanceira: number
  dependenciaFinanceira: number
  dividaEquity: number
  margemEbitda: number
  coberturaJuros: number
  pme: number
  pmr: number
  pmp: number
  cicloOperacional: number
  cicloFinanceiro: number
  giroEstoque: number
  giroReceber: number
  giroFornecedores: number
  roic: number
  wacc: number
  spread: number
}

export const CSV_BENCHMARK_COLUMNS: { key: keyof CsvBenchmarkRow; label: string }[] = [
  { key: 'setor', label: 'Setor' },
  { key: 'descricao', label: 'Descrição' },
  { key: 'liquidezCorrente', label: 'Liquidez Corrente (x)' },
  { key: 'liquidezSeca', label: 'Liquidez Seca (x)' },
  { key: 'liquidezImediata', label: 'Liquidez Imediata (x)' },
  { key: 'liquidezGeral', label: 'Liquidez Geral (x)' },
  { key: 'endividamentoGeral', label: 'Endividamento Geral (%)' },
  { key: 'composicaoEndividamento', label: 'Composição Endividamento (%)' },
  { key: 'participacaoCapitalTerceiros', label: 'Participação Cap. Terceiros (%)' },
  { key: 'imobilizacaoPL', label: 'Imobilização do PL (%)' },
  { key: 'margemBruta', label: 'Margem Bruta (%)' },
  { key: 'margemOperacional', label: 'Margem Operacional (%)' },
  { key: 'margemLiquida', label: 'Margem Líquida (%)' },
  { key: 'roa', label: 'ROA (%)' },
  { key: 'roe', label: 'ROE (%)' },
  { key: 'giroAtivo', label: 'Giro do Ativo (x)' },
  { key: 'autonomiaFinanceira', label: 'Autonomia Financeira (%)' },
  { key: 'dependenciaFinanceira', label: 'Dependência Financeira (%)' },
  { key: 'dividaEquity', label: 'Dívida / Equity (x)' },
  { key: 'margemEbitda', label: 'Margem EBITDA (%)' },
  { key: 'coberturaJuros', label: 'Cobertura de Juros (x)' },
  { key: 'pme', label: 'PME (dias)' },
  { key: 'pmr', label: 'PMR (dias)' },
  { key: 'pmp', label: 'PMP (dias)' },
  { key: 'cicloOperacional', label: 'Ciclo Operacional (dias)' },
  { key: 'cicloFinanceiro', label: 'Ciclo Financeiro (dias)' },
  { key: 'giroEstoque', label: 'Giro de Estoque (x)' },
  { key: 'giroReceber', label: 'Giro a Receber (x)' },
  { key: 'giroFornecedores', label: 'Giro Fornecedores (x)' },
  { key: 'roic', label: 'ROIC (%)' },
  { key: 'wacc', label: 'WACC (%)' },
  { key: 'spread', label: 'Spread Econômico (%)' },
]

export const benchmarksService = {
  // ==========================================
  // BENCHMARKS POR SETOR
  // ==========================================

  /**
   * Busca todos os benchmarks setoriais personalizados do usuário
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
   * Busca o benchmark setorial de um setor específico para o usuário atual
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
   * Salva ou atualiza o benchmark de um determinado setor
   */
  async saveSetor(
    setor: string,
    valores: Partial<BenchmarkSetorValores>,
  ): Promise<BenchmarkSetorialRecord> {
    const userId = pb.authStore.record?.id
    if (!userId) {
      throw new Error('Usuário não autenticado.')
    }

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
   * Restaura os valores padrão para um setor
   */
  async restorePadrao(setor: string): Promise<BenchmarkSetorialRecord | null> {
    const padrao = BENCHMARKS_SETORIAIS[setor] || BENCHMARKS_SETORIAIS['Outros']
    if (!padrao) return null
    return await this.saveSetor(setor, padrao)
  },

  /**
   * Converte uma lista de BenchmarkSetorialRecord em um mapa mesclado com os padrões
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

  // ==========================================
  // BENCHMARKS POR EMPRESA
  // ==========================================

  /**
   * Busca todos os benchmarks por empresa cadastrados pelo usuário
   */
  async getAllEmpresas(): Promise<BenchmarkEmpresaRecord[]> {
    try {
      const records = await pb
        .collection<BenchmarkEmpresaRecord>('benchmarks_empresas')
        .getFullList({
          expand: 'empresa',
          sort: '-created',
        })
      return records
    } catch (err) {
      console.error('Erro ao buscar benchmarks de empresas:', err)
      return []
    }
  },

  /**
   * Busca o benchmark específico de uma empresa
   */
  async getByEmpresa(empresaId: string): Promise<BenchmarkEmpresaRecord | null> {
    if (!empresaId) return null
    try {
      const record = await pb
        .collection<BenchmarkEmpresaRecord>('benchmarks_empresas')
        .getFirstListItem(`empresa = "${empresaId}"`, {
          expand: 'empresa',
        })
      return record
    } catch {
      return null
    }
  },

  /**
   * Salva ou atualiza os benchmarks/metas específicos de uma empresa
   */
  async saveEmpresa(
    empresaId: string,
    valores: Partial<BenchmarkSetorValores>,
  ): Promise<BenchmarkEmpresaRecord> {
    const userId = pb.authStore.record?.id
    if (!userId) {
      throw new Error('Usuário não autenticado.')
    }
    if (!empresaId) {
      throw new Error('ID da empresa é obrigatório.')
    }

    let existing: BenchmarkEmpresaRecord | null = null
    try {
      existing = await pb
        .collection<BenchmarkEmpresaRecord>('benchmarks_empresas')
        .getFirstListItem(`empresa = "${empresaId}"`)
    } catch {
      existing = null
    }

    const payload: Partial<BenchmarkEmpresaRecord> = {
      user: userId,
      empresa: empresaId,
      descricao: valores.descricao || 'Metas específicas da empresa',
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
        .collection<BenchmarkEmpresaRecord>('benchmarks_empresas')
        .update<BenchmarkEmpresaRecord>(existing.id, payload)
    } else {
      return await pb
        .collection<BenchmarkEmpresaRecord>('benchmarks_empresas')
        .create<BenchmarkEmpresaRecord>(payload)
    }
  },

  /**
   * Remove o benchmark específico de uma empresa (voltando a herdar o do setor)
   */
  async deleteEmpresa(empresaId: string): Promise<boolean> {
    try {
      const existing = await pb
        .collection<BenchmarkEmpresaRecord>('benchmarks_empresas')
        .getFirstListItem(`empresa = "${empresaId}"`)
      if (existing) {
        await pb.collection('benchmarks_empresas').delete(existing.id)
        return true
      }
      return false
    } catch {
      return false
    }
  },

  /**
   * Duplica as metas/benchmarks de uma empresa de origem para uma empresa de destino
   */
  async duplicateEmpresaMetas(
    origemEmpresaId: string,
    destinoEmpresaId: string,
    metasValores?: Partial<BenchmarkSetorValores> | null,
    empresaDestinoNome?: string,
  ): Promise<BenchmarkEmpresaRecord> {
    const userId = pb.authStore.record?.id
    if (!userId) {
      throw new Error('Usuário não autenticado.')
    }
    if (!origemEmpresaId || !destinoEmpresaId) {
      throw new Error('IDs de empresa de origem e destino são obrigatórios.')
    }

    let valoresParaCopiar: Partial<BenchmarkSetorValores> | null = metasValores || null

    if (!valoresParaCopiar) {
      const recOrigem = await this.getByEmpresa(origemEmpresaId)
      if (!recOrigem) {
        throw new Error('Empresa de origem não possui metas individuais cadastradas.')
      }
      valoresParaCopiar = {
        descricao:
          recOrigem.descricao || `Metas duplicadas para ${empresaDestinoNome || 'a empresa'}`,
        liquidezCorrente: recOrigem.liquidezCorrente,
        liquidezSeca: recOrigem.liquidezSeca,
        liquidezImediata: recOrigem.liquidezImediata,
        liquidezGeral: recOrigem.liquidezGeral,
        endividamentoGeral: recOrigem.endividamentoGeral,
        composicaoEndividamento: recOrigem.composicaoEndividamento,
        participacaoCapitalTerceiros: recOrigem.participacaoCapitalTerceiros,
        imobilizacaoPL: recOrigem.imobilizacaoPL,
        margemBruta: recOrigem.margemBruta,
        margemOperacional: recOrigem.margemOperacional,
        margemLiquida: recOrigem.margemLiquida,
        roa: recOrigem.roa,
        roe: recOrigem.roe,
        giroAtivo: recOrigem.giroAtivo,
        autonomiaFinanceira: recOrigem.autonomiaFinanceira,
        dependenciaFinanceira: recOrigem.dependenciaFinanceira,
        dividaEquity: recOrigem.dividaEquity,
        margemEbitda: recOrigem.margemEbitda,
        coberturaJuros: recOrigem.coberturaJuros,
        pme: recOrigem.pme,
        pmr: recOrigem.pmr,
        pmp: recOrigem.pmp,
        cicloOperacional: recOrigem.cicloOperacional,
        cicloFinanceiro: recOrigem.cicloFinanceiro,
        giroEstoque: recOrigem.giroEstoque,
        giroReceber: recOrigem.giroReceber,
        giroFornecedores: recOrigem.giroFornecedores,
        roic: recOrigem.roic,
        wacc: recOrigem.wacc,
        spread: recOrigem.spread,
      }
    }

    const payloadComDestino: Partial<BenchmarkSetorValores> = {
      ...valoresParaCopiar,
      descricao:
        valoresParaCopiar.descricao || `Metas duplicadas para ${empresaDestinoNome || 'a empresa'}`,
    }

    return await this.saveEmpresa(destinoEmpresaId, payloadComDestino)
  },

  // ==========================================
  // EXPORTAÇÃO E IMPORTAÇÃO CSV
  // ==========================================

  /**
   * Gera conteúdo CSV da tabela de benchmarks setoriais (mesclados com personalizações)
   */
  exportToCsv(benchmarksMap: Record<string, BenchmarkSetorValores>): string {
    const headers = CSV_BENCHMARK_COLUMNS.map((col) => `"${col.label}"`).join(';')
    const rows: string[] = [headers]

    const setores = Object.keys(BENCHMARKS_SETORIAIS)

    for (const setor of setores) {
      const item = benchmarksMap[setor] || BENCHMARKS_SETORIAIS[setor]
      if (!item) continue

      const values = [
        `"${item.setor || setor}"`,
        `"${(item.descricao || '').replace(/"/g, '""')}"`,
        item.liquidezCorrente ?? 0,
        item.liquidezSeca ?? 0,
        item.liquidezImediata ?? 0,
        item.liquidezGeral ?? 0,
        item.endividamentoGeral ?? 0,
        item.composicaoEndividamento ?? 0,
        item.participacaoCapitalTerceiros ?? 0,
        item.imobilizacaoPL ?? 0,
        item.margemBruta ?? 0,
        item.margemOperacional ?? 0,
        item.margemLiquida ?? 0,
        item.roa ?? 0,
        item.roe ?? 0,
        item.giroAtivo ?? 0,
        item.autonomiaFinanceira ?? 0,
        item.dependenciaFinanceira ?? 0,
        item.dividaEquity ?? 0,
        item.margemEbitda ?? 0,
        item.coberturaJuros ?? 0,
        item.pme ?? 0,
        item.pmr ?? 0,
        item.pmp ?? 0,
        item.cicloOperacional ?? 0,
        item.cicloFinanceiro ?? 0,
        item.giroEstoque ?? 0,
        item.giroReceber ?? 0,
        item.giroFornecedores ?? 0,
        item.roic ?? 0,
        item.wacc ?? 0,
        item.spread ?? 0,
      ]

      rows.push(values.join(';'))
    }

    return '\uFEFF' + rows.join('\r\n')
  },

  /**
   * Faz o download do arquivo CSV no navegador
   */
  downloadCsv(csvContent: string, filename = 'benchmarks_setoriais.csv') {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', filename)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  },

  /**
   * Analisa e valida uma string CSV importada
   */
  parseAndValidateCsv(csvText: string): {
    success: boolean
    data: Record<string, BenchmarkSetorValores>
    errors: string[]
    totalSetores: number
  } {
    const errors: string[] = []
    const cleanedText = csvText.replace(/^\uFEFF/, '').trim()
    if (!cleanedText) {
      return {
        success: false,
        data: {},
        errors: ['O arquivo CSV está vazio.'],
        totalSetores: 0,
      }
    }

    // Dividir em linhas
    const lines = cleanedText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)
    if (lines.length < 2) {
      return {
        success: false,
        data: {},
        errors: ['O CSV deve conter pelo menos uma linha de cabeçalho e uma linha de dados.'],
        totalSetores: 0,
      }
    }

    // Identificar delimitador (ponto e vírgula ou vírgula)
    const headerLine = lines[0]
    const delimiter = headerLine.includes(';') ? ';' : ','

    // Função para separar campos respeitando aspas
    const parseLine = (line: string): string[] => {
      const result: string[] = []
      let current = ''
      let inQuotes = false

      for (let i = 0; i < line.length; i++) {
        const char = line[i]
        if (char === '"') {
          if (inQuotes && line[i + 1] === '"') {
            current += '"'
            i++
          } else {
            inQuotes = !inQuotes
          }
        } else if (char === delimiter && !inQuotes) {
          result.push(current.trim())
          current = ''
        } else {
          current += char
        }
      }
      result.push(current.trim())
      return result
    }

    const headers = parseLine(headerLine).map((h) =>
      h
        .replace(/^["']|["']$/g, '')
        .trim()
        .toLowerCase(),
    )

    // Mapa de cabeçalhos esperados
    const findColumnIndex = (possibleNames: string[]): number => {
      return headers.findIndex((h) => possibleNames.some((name) => h.includes(name.toLowerCase())))
    }

    const idxSetor = findColumnIndex(['setor', 'segmento'])
    if (idxSetor === -1) {
      errors.push('Coluna obrigatória "Setor" não foi encontrada no cabeçalho.')
      return { success: false, data: {}, errors, totalSetores: 0 }
    }

    const parseNum = (valStr: string | undefined, fieldName: string, lineNum: number): number => {
      if (!valStr || valStr === '') return 0
      // Aceita formato BR com vírgula ou US com ponto
      const normalized = valStr
        .replace(/^["']|["']$/g, '')
        .replace(',', '.')
        .trim()
      const num = parseFloat(normalized)
      if (isNaN(num)) {
        errors.push(`Linha ${lineNum}: valor inválido "${valStr}" para o campo "${fieldName}".`)
        return 0
      }
      return num
    }

    const idxMap: Record<keyof CsvBenchmarkRow, number> = {
      setor: idxSetor,
      descricao: findColumnIndex(['descri']),
      liquidezCorrente: findColumnIndex(['liquidez corrente', 'lc']),
      liquidezSeca: findColumnIndex(['liquidez seca', 'ls']),
      liquidezImediata: findColumnIndex(['liquidez imediata', 'li']),
      liquidezGeral: findColumnIndex(['liquidez geral', 'lg']),
      endividamentoGeral: findColumnIndex(['endividamento geral', 'eg']),
      composicaoEndividamento: findColumnIndex(['composição endividamento', 'composicao']),
      participacaoCapitalTerceiros: findColumnIndex([
        'participação cap',
        'capital terceiros',
        'pct',
      ]),
      imobilizacaoPL: findColumnIndex(['imobilização', 'imobilizacao', 'ipl']),
      margemBruta: findColumnIndex(['margem bruta', 'mb']),
      margemOperacional: findColumnIndex(['margem operacional', 'mo']),
      margemLiquida: findColumnIndex(['margem líquida', 'margem liquida', 'ml']),
      roa: findColumnIndex(['roa']),
      roe: findColumnIndex(['roe']),
      giroAtivo: findColumnIndex(['giro do ativo', 'giro ativo']),
      autonomiaFinanceira: findColumnIndex(['autonomia']),
      dependenciaFinanceira: findColumnIndex(['dependência', 'dependencia']),
      dividaEquity: findColumnIndex(['dívida / equity', 'divida / equity', 'equity', 'd/e']),
      margemEbitda: findColumnIndex(['ebitda']),
      coberturaJuros: findColumnIndex(['cobertura']),
      pme: findColumnIndex(['pme', 'estocagem']),
      pmr: findColumnIndex(['pmr', 'recebimento']),
      pmp: findColumnIndex(['pmp', 'pagamento']),
      cicloOperacional: findColumnIndex(['ciclo operacional']),
      cicloFinanceiro: findColumnIndex(['ciclo financeiro']),
      giroEstoque: findColumnIndex(['giro de estoque', 'giro estoque']),
      giroReceber: findColumnIndex(['giro a receber', 'giro receber']),
      giroFornecedores: findColumnIndex(['giro fornecedores']),
      roic: findColumnIndex(['roic']),
      wacc: findColumnIndex(['wacc']),
      spread: findColumnIndex(['spread']),
    }

    const validSetores = Object.keys(BENCHMARKS_SETORIAIS)
    const resultMap: Record<string, BenchmarkSetorValores> = {}

    for (let i = 1; i < lines.length; i++) {
      const lineNum = i + 1
      const cols = parseLine(lines[i])
      if (cols.length === 0 || (cols.length === 1 && !cols[0])) continue

      let setorNome = cols[idxSetor]?.replace(/^["']|["']$/g, '').trim() || ''

      // Tenta normalizar o nome do setor
      const setorEncontrado = validSetores.find((s) => s.toLowerCase() === setorNome.toLowerCase())

      if (!setorEncontrado) {
        errors.push(
          `Linha ${lineNum}: setor "${setorNome}" não é reconhecido. Setores válidos: ${validSetores.join(', ')}.`,
        )
        continue
      }

      setorNome = setorEncontrado
      const padrao = BENCHMARKS_SETORIAIS[setorNome] || BENCHMARKS_SETORIAIS['Outros']

      const getValue = (key: keyof CsvBenchmarkRow, defaultVal: number): number => {
        const colIdx = idxMap[key]
        if (colIdx !== -1 && cols[colIdx] !== undefined && cols[colIdx] !== '') {
          return parseNum(cols[colIdx], key, lineNum)
        }
        return defaultVal
      }

      const descIdx = idxMap.descricao
      const descricao =
        descIdx !== -1 && cols[descIdx]
          ? cols[descIdx].replace(/^["']|["']$/g, '').trim()
          : padrao.descricao

      const roic = getValue('roic', padrao.roic)
      const wacc = getValue('wacc', padrao.wacc)
      const spread =
        idxMap.spread !== -1 && cols[idxMap.spread] !== undefined && cols[idxMap.spread] !== ''
          ? parseNum(cols[idxMap.spread], 'spread', lineNum)
          : Number((roic - wacc).toFixed(2))

      resultMap[setorNome] = {
        setor: setorNome,
        descricao,
        liquidezCorrente: getValue('liquidezCorrente', padrao.liquidezCorrente),
        liquidezSeca: getValue('liquidezSeca', padrao.liquidezSeca),
        liquidezImediata: getValue('liquidezImediata', padrao.liquidezImediata),
        liquidezGeral: getValue('liquidezGeral', padrao.liquidezGeral),
        endividamentoGeral: getValue('endividamentoGeral', padrao.endividamentoGeral),
        composicaoEndividamento: getValue(
          'composicaoEndividamento',
          padrao.composicaoEndividamento,
        ),
        participacaoCapitalTerceiros: getValue(
          'participacaoCapitalTerceiros',
          padrao.participacaoCapitalTerceiros,
        ),
        imobilizacaoPL: getValue('imobilizacaoPL', padrao.imobilizacaoPL),
        margemBruta: getValue('margemBruta', padrao.margemBruta),
        margemOperacional: getValue('margemOperacional', padrao.margemOperacional),
        margemLiquida: getValue('margemLiquida', padrao.margemLiquida),
        roa: getValue('roa', padrao.roa),
        roe: getValue('roe', padrao.roe),
        giroAtivo: getValue('giroAtivo', padrao.giroAtivo),
        autonomiaFinanceira: getValue('autonomiaFinanceira', padrao.autonomiaFinanceira),
        dependenciaFinanceira: getValue('dependenciaFinanceira', padrao.dependenciaFinanceira),
        dividaEquity: getValue('dividaEquity', padrao.dividaEquity),
        margemEbitda: getValue('margemEbitda', padrao.margemEbitda),
        coberturaJuros: getValue('coberturaJuros', padrao.coberturaJuros),
        pme: getValue('pme', padrao.pme),
        pmr: getValue('pmr', padrao.pmr),
        pmp: getValue('pmp', padrao.pmp),
        cicloOperacional: getValue('cicloOperacional', padrao.cicloOperacional),
        cicloFinanceiro: getValue('cicloFinanceiro', padrao.cicloFinanceiro),
        giroEstoque: getValue('giroEstoque', padrao.giroEstoque),
        giroReceber: getValue('giroReceber', padrao.giroReceber),
        giroFornecedores: getValue('giroFornecedores', padrao.giroFornecedores),
        roic,
        wacc,
        spread,
      }
    }

    const totalSetores = Object.keys(resultMap).length

    if (totalSetores === 0) {
      return {
        success: false,
        data: {},
        errors: errors.length > 0 ? errors : ['Nenhum registro de benchmark pôde ser lido do CSV.'],
        totalSetores: 0,
      }
    }

    return {
      success: errors.length === 0 || totalSetores > 0,
      data: resultMap,
      errors,
      totalSetores,
    }
  },

  /**
   * Salva múltiplos setores importados do CSV no backend
   */
  async saveImportedCsvData(dataMap: Record<string, BenchmarkSetorValores>): Promise<number> {
    let savedCount = 0
    for (const [setor, valores] of Object.entries(dataMap)) {
      try {
        await this.saveSetor(setor, valores)
        savedCount++
      } catch (err) {
        console.error(`Erro ao persistir benchmark do setor ${setor}:`, err)
      }
    }
    return savedCount
  },
}
