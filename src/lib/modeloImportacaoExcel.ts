import * as XLSX from 'xlsx'
import type { PlanoContaRecord } from '@/types/finance'
import { parseBrlNumber } from './pdfParser'
import { compararCodigosHierarquicos } from './dreGerencialTypes'

export interface LinhaModeloExcelLancamentos {
  'Codigo Plano': string
  Conta: string
  Centro: string
  Data: string
  Valor: number | string
  Historico: string
  Recorrente: string
}

export interface LinhaReferenciaPlanoContas {
  'Codigo Hierarquico': string
  'Codigo Plano (Sistema)': string
  'Codigo Empresa': string
  'Nome da Conta': string
  'Tipo / Natureza': string
  'Centro de Custo': string
  'Tipo de Despesa': string
  Descricao: string
}

export interface LinhaExcelValidada {
  codigo_pc?: string
  conta_nome?: string
  centro_nome?: string
  tipo_despesa_nome?: string
  data: string
  valor: number
  historico?: string
  recorrente?: boolean
  plano_conta_id?: string
  status: 'valido' | 'erro'
  erro_msg?: string
}

export const COLUNAS_MESES_12 = [
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
] as const

export interface LinhaModeloExcel12MesesColunas {
  'Codigo Plano': string
  Conta: string
  Centro: string
  'Tipo Despesa': string
  Janeiro: number | string
  Fevereiro: number | string
  Março: number | string
  Abril: number | string
  Maio: number | string
  Junho: number | string
  Julho: number | string
  Agosto: number | string
  Setembro: number | string
  Outubro: number | string
  Novembro: number | string
  Dezembro: number | string
  Historico?: string
}

export interface LancamentoExtraidoMes12Colunas {
  mes: number // 1 a 12
  codigo_pc: string
  conta_nome: string
  centro_nome: string
  tipo_despesa_nome?: string
  plano_conta_id?: string
  data: string // YYYY-MM-DD
  valor: number
  historico: string
  status: 'valido' | 'erro'
  erro_msg?: string
}

export interface Planilha12MesesParsedResult {
  anoExercicio: number
  totalLinhasLidas: number
  totalLancamentosValidos: number
  porMes: Record<
    number,
    {
      mes: number
      nomeMes: string
      totalLancamentos: number
      totalValor: number
      lancamentos: LancamentoExtraidoMes12Colunas[]
      lancamentosValidos: LancamentoExtraidoMes12Colunas[]
      lancamentosComErro: LancamentoExtraidoMes12Colunas[]
    }
  >
  inconsistenciasGerais: string[]
}

/**
 * Faz o parsing e validação das linhas de uma planilha Excel de lançamentos
 * compatível com o modelo padrão Borlim.
 */
export function parsePlanilhaLancamentosExcel(
  rawData: Array<Record<string, unknown>>,
  planoContas: PlanoContaRecord[],
  opcoes?: {
    mesObrigatorio?: number // 1 a 12
    anoObrigatorio?: number
  },
): LinhaExcelValidada[] {
  return rawData.map((row) => {
    const codPC = String(
      row['Codigo Plano'] || row['codigo_plano'] || row['Codigo'] || row['codigo'] || '',
    ).trim()
    const rawDataLanc = row['Data'] || row['data'] || row['Data Lancamento'] || ''
    const rawValor = row['Valor'] || row['valor'] || 0
    const historico = String(row['Historico'] || row['historico'] || row['Descricao'] || '')
    const recorrente = Boolean(row['Recorrente'] || row['recorrente'])

    let dataFormatada = ''
    if (rawDataLanc instanceof Date) {
      dataFormatada = rawDataLanc.toISOString().split('T')[0]
    } else if (typeof rawDataLanc === 'string') {
      if (rawDataLanc.includes('/')) {
        const parts = rawDataLanc.split('/')
        if (parts.length === 3) {
          dataFormatada = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`
        }
      } else {
        dataFormatada = rawDataLanc
      }
    }

    let numValor = 0
    if (typeof rawValor === 'number') {
      numValor = rawValor
    } else if (typeof rawValor === 'string') {
      numValor = parseFloat(rawValor.replace(/[R$\s.]/g, '').replace(',', '.')) || 0
    }

    const rawContaNome = String(row['Conta'] || '')
      .trim()
      .toLowerCase()
    const pcEncontrado = planoContas.find(
      (p) =>
        (p.codigo_empresa &&
          (p.codigo_empresa.toLowerCase() === codPC.toLowerCase() ||
            p.codigo_empresa.toLowerCase() === rawContaNome)) ||
        (p.codigo && p.codigo.toLowerCase() === codPC.toLowerCase()) ||
        (p.expand?.conta?.nome && p.expand.conta.nome.trim().toLowerCase() === rawContaNome),
    )

    let status: 'valido' | 'erro' = 'valido'
    let erro_msg = ''

    if (!pcEncontrado && !codPC) {
      status = 'erro'
      erro_msg = 'Código do Plano de Contas não informado'
    } else if (!pcEncontrado) {
      status = 'erro'
      erro_msg = `Plano de contas "${codPC}" não encontrado`
    } else if (!dataFormatada || isNaN(Date.parse(dataFormatada))) {
      status = 'erro'
      erro_msg = 'Data inválida'
    } else if (numValor <= 0) {
      status = 'erro'
      erro_msg = 'Valor deve ser maior que zero'
    } else if (opcoes?.mesObrigatorio !== undefined || opcoes?.anoObrigatorio !== undefined) {
      const parts = dataFormatada.split('-')
      if (parts.length === 3) {
        const anoData = parseInt(parts[0], 10)
        const mesData = parseInt(parts[1], 10)
        if (opcoes.anoObrigatorio !== undefined && anoData !== opcoes.anoObrigatorio) {
          status = 'erro'
          erro_msg = `Data (${dataFormatada}) pertence ao ano ${anoData}, mas o exercício selecionado é ${opcoes.anoObrigatorio}`
        } else if (opcoes.mesObrigatorio !== undefined && mesData !== opcoes.mesObrigatorio) {
          status = 'erro'
          erro_msg = `Data (${dataFormatada}) é do mês ${mesData}, mas a etapa atual exige lançamentos do mês ${opcoes.mesObrigatorio}`
        }
      }
    }

    return {
      codigo_pc: codPC,
      conta_nome: pcEncontrado?.expand?.conta?.nome || String(row['Conta'] || ''),
      centro_nome: pcEncontrado?.expand?.centro?.nome || String(row['Centro'] || ''),
      tipo_despesa_nome: pcEncontrado?.expand?.tipo_despesa?.nome,
      data: dataFormatada,
      valor: numValor,
      historico,
      recorrente,
      plano_conta_id: pcEncontrado?.id,
      status,
      erro_msg,
    }
  })
}

export interface OpcoesDownloadModeloExcel {
  planoContas?: PlanoContaRecord[]
  nomeEmpresaOuGrupo?: string
  anoReferencia?: number
  mesReferencia?: number // 1 a 12
}

/**
 * Ordena contas determinística e hierarquicamente:
 * 1. Código da conta ou código hierárquico
 * 2. Nome da conta
 */
function ordenarPlanoContasHierarquico(itens: PlanoContaRecord[]): PlanoContaRecord[] {
  return [...itens].sort((a, b) => {
    const codA = (a.codigo_empresa || a.codigo || '').trim()
    const codB = (b.codigo_empresa || b.codigo || '').trim()
    const cmp = compararCodigosHierarquicos(codA, codB)
    if (cmp !== 0) return cmp

    const nomeA = (a.expand?.conta?.nome || a.descricao || '').trim()
    const nomeB = (b.expand?.conta?.nome || b.descricao || '').trim()
    return nomeA.localeCompare(nomeB, 'pt-BR', { sensitivity: 'base' })
  })
}

/**
 * Gera a planilha modelo de lançamentos (.xlsx) para a opção "Importar Excel".
 * Se houver Plano de Contas cadastrado para a empresa/grupo ativo:
 * - A aba principal 'Modelo_Lancamentos' vem preenchida com TODAS as contas do plano,
 *   usando as colunas padrão que o importador de Excel consome ("Codigo Plano", "Conta", "Centro", "Data", "Valor", "Historico", "Recorrente").
 * - O usuário só precisa preencher Data, Valor e Histórico (valores zerados por padrão para não importar lixo acidentalmente se subir sem mexer).
 * - Uma aba auxiliar 'Referencia_Plano_Contas' com a estrutura completa e hierárquica é incluída para consulta de códigos, tipos e centros.
 * - Uma aba de 'Instrucoes' orienta o usuário sobre como preencher e importar de volta sem erros.
 *
 * Se NÃO houver contas cadastradas:
 * - Gera o modelo genérico/vazio original com dados de exemplo.
 */
export function gerarPlanilhaModeloImportacaoExcel(opcoes?: OpcoesDownloadModeloExcel): {
  totalContas: number
  nomeArquivo: string
} {
  const plano = opcoes?.planoContas || []
  const ano = opcoes?.anoReferencia || new Date().getFullYear()
  const nomeEntidade = opcoes?.nomeEmpresaOuGrupo
  const dataHoje = new Date().toISOString().slice(0, 10)

  const wb = XLSX.utils.book_new()

  if (plano.length > 0) {
    const planoOrdenado = ordenarPlanoContasHierarquico(plano)

    const mesNum = opcoes?.mesReferencia ? Math.max(1, Math.min(12, opcoes.mesReferencia)) : 1
    const mesFormatado = String(mesNum).padStart(2, '0')
    const nomesMesesPt = [
      'janeiro',
      'fevereiro',
      'marco',
      'abril',
      'maio',
      'junho',
      'julho',
      'agosto',
      'setembro',
      'outubro',
      'novembro',
      'dezembro',
    ]
    const nomeMesSufixo = opcoes?.mesReferencia ? `_${nomesMesesPt[mesNum - 1]}` : ''

    // 1. Aba principal: Modelo_Lancamentos com TODAS as contas do plano
    const rowsLancamentos: LinhaModeloExcelLancamentos[] = planoOrdenado.map((pc) => {
      const codPlano = (pc.codigo_empresa || pc.codigo || '').trim()
      const contaNome = (pc.expand?.conta?.nome || pc.descricao || '').trim()
      const centroNome = (pc.expand?.centro?.nome || '').trim()
      const tipo = pc.expand?.conta?.tipo || pc.expand?.centro?.tipo || 'Despesa'
      const isReceita = tipo.toLowerCase().includes('receita')

      return {
        'Codigo Plano': codPlano,
        Conta: contaNome,
        Centro: centroNome,
        Data: `${ano}-${mesFormatado}-15`,
        Valor: 0.0,
        Historico: isReceita
          ? `Recebimento ref. ${contaNome || 'serviços/vendas'}`
          : `Lançamento ref. ${contaNome || 'despesa/custo'}`,
        Recorrente: 'NAO',
      }
    })

    const wsLancamentos = XLSX.utils.json_to_sheet(rowsLancamentos)
    wsLancamentos['!cols'] = [
      { wch: 18 }, // Codigo Plano
      { wch: 38 }, // Conta
      { wch: 26 }, // Centro
      { wch: 14 }, // Data (YYYY-MM-DD ou DD/MM/AAAA)
      { wch: 14 }, // Valor
      { wch: 45 }, // Historico
      { wch: 14 }, // Recorrente
    ]
    XLSX.utils.book_append_sheet(wb, wsLancamentos, 'Modelo_Lancamentos')

    // 2. Aba auxiliar de Referência Completa do Plano de Contas
    const rowsReferencia: LinhaReferenciaPlanoContas[] = planoOrdenado.map((pc) => {
      const conta = pc.expand?.conta
      const centro = pc.expand?.centro
      const tipoDespesa = pc.expand?.tipo_despesa

      return {
        'Codigo Hierarquico': conta?.codigo || pc.codigo_empresa || pc.codigo || '',
        'Codigo Plano (Sistema)': pc.codigo || '',
        'Codigo Empresa': pc.codigo_empresa || '',
        'Nome da Conta': conta?.nome || pc.descricao || '',
        'Tipo / Natureza': conta?.tipo || centro?.tipo || '',
        'Centro de Custo': centro?.nome || '',
        'Tipo de Despesa': tipoDespesa?.nome || '',
        Descricao: pc.descricao || conta?.descricao || '',
      }
    })

    const wsRef = XLSX.utils.json_to_sheet(rowsReferencia)
    wsRef['!cols'] = [
      { wch: 22 }, // Codigo Hierarquico
      { wch: 24 }, // Codigo Plano (Sistema)
      { wch: 20 }, // Codigo Empresa
      { wch: 38 }, // Nome da Conta
      { wch: 18 }, // Tipo / Natureza
      { wch: 26 }, // Centro de Custo
      { wch: 22 }, // Tipo de Despesa
      { wch: 35 }, // Descricao
    ]
    XLSX.utils.book_append_sheet(wb, wsRef, 'Referencia_Plano_Contas')

    // 3. Aba de Instruções de Preenchimento
    const instrucoes = [
      {
        Instrução: 'COMO USAR ESTA PLANILHA MODELO:',
        Detalhes:
          'Esta planilha já vem pré-preenchida com todas as contas ativas do seu Plano de Contas na primeira aba ("Modelo_Lancamentos").',
      },
      {
        Instrução: '1. Coluna "Codigo Plano":',
        Detalhes:
          'Pode manter o código do plano (PC-xxx ou código contábil da sua empresa). O importador reconhece tanto o código interno quanto o código da empresa.',
      },
      {
        Instrução: '2. Coluna "Conta":',
        Detalhes:
          'Nome cadastrado da conta. Se o código for omitido, o importador tentará localizar pelo nome exato.',
      },
      {
        Instrução: '3. Coluna "Data":',
        Detalhes:
          'Preencha com a data do lançamento no formato AAAA-MM-DD (ex: 2025-01-15) ou DD/MM/AAAA (ex: 15/01/2025).',
      },
      {
        Instrução: '4. Coluna "Valor":',
        Detalhes:
          'Informe o valor numérico maior que zero (ex: 1500.00 ou 1.500,00). Linhas com valor 0 são ignoradas na importação.',
      },
      {
        Instrução: '5. Coluna "Historico":',
        Detalhes:
          'Descrição amigável do lançamento (ex: "Pagamento fornecedor X ref. NF 1234"). Campo opcional.',
      },
      {
        Instrução: '6. Coluna "Recorrente":',
        Detalhes: 'Preencha com "SIM" ou "NAO".',
      },
      {
        Instrução: '7. Linhas não utilizadas:',
        Detalhes:
          'Contas que não tiveram movimentação no período podem ter o valor mantido em 0 ou suas linhas podem ser excluídas.',
      },
      {
        Instrução: '8. Aba "Referencia_Plano_Contas":',
        Detalhes:
          'Utilize como guia para conferir a hierarquia de códigos contábeis, tipos (Receita/Despesa), centros de custo e tipos de despesa.',
      },
    ]

    const wsInstrucoes = XLSX.utils.json_to_sheet(instrucoes)
    wsInstrucoes['!cols'] = [{ wch: 32 }, { wch: 95 }]
    XLSX.utils.book_append_sheet(wb, wsInstrucoes, 'Instrucoes')

    const safeEntidade = nomeEntidade
      ? nomeEntidade
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-zA-Z0-9_-]/g, '_')
          .toLowerCase()
      : 'plano_contas'

    const nomeArquivo = `modelo_importacao_lancamentos_${safeEntidade}${nomeMesSufixo}_${ano}.xlsx`
    XLSX.writeFile(wb, nomeArquivo)

    return { totalContas: planoOrdenado.length, nomeArquivo }
  }

  const mesNum = opcoes?.mesReferencia ? Math.max(1, Math.min(12, opcoes.mesReferencia)) : 1
  const mesFormatado = String(mesNum).padStart(2, '0')

  // Fallback: modelo genérico/vazio quando a empresa/grupo não possui plano de contas
  const templateGenerico: LinhaModeloExcelLancamentos[] = [
    {
      'Codigo Plano': 'PC-001',
      Conta: 'Vendas de Produtos',
      Centro: 'Comercial',
      Data: `${ano}-${mesFormatado}-15`,
      Valor: 15000.0,
      Historico: 'Vendas do mês',
      Recorrente: 'NAO',
    },
    {
      'Codigo Plano': 'PC-002',
      Conta: 'Salários e Ordenados',
      Centro: 'Administrativo',
      Data: `${ano}-${mesFormatado}-05`,
      Valor: 8500.0,
      Historico: 'Folha de pagamento do mês',
      Recorrente: 'SIM',
    },
  ]

  const wsGenerico = XLSX.utils.json_to_sheet(templateGenerico)
  wsGenerico['!cols'] = [
    { wch: 18 },
    { wch: 30 },
    { wch: 22 },
    { wch: 14 },
    { wch: 14 },
    { wch: 35 },
    { wch: 14 },
  ]
  XLSX.utils.book_append_sheet(wb, wsGenerico, 'Modelo_Lancamentos')

  const nomeArquivo = opcoes?.mesReferencia
    ? `modelo_importacao_lancamentos_mes_${mesFormatado}_${ano}.xlsx`
    : `modelo_importacao_lancamentos_${ano}.xlsx`
  XLSX.writeFile(wb, nomeArquivo)

  return { totalContas: 0, nomeArquivo }
}

export interface OpcoesDownloadModelo12MesesColunas {
  planoContas?: PlanoContaRecord[]
  nomeEmpresaOuGrupo?: string
  anoReferencia?: number
}

/**
 * Gera a planilha modelo Excel contendo os 12 meses como COLUNAS (Janeiro a Dezembro).
 * Uma linha por conta contábil do Plano de Contas da empresa/grupo.
 */
export function gerarPlanilhaModelo12MesesColunas(opcoes?: OpcoesDownloadModelo12MesesColunas): {
  totalContas: number
  nomeArquivo: string
} {
  const plano = opcoes?.planoContas || []
  const ano = opcoes?.anoReferencia || new Date().getFullYear()
  const nomeEntidade = opcoes?.nomeEmpresaOuGrupo

  const wb = XLSX.utils.book_new()

  const safeEntidade = nomeEntidade
    ? nomeEntidade
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9_-]/g, '_')
        .toLowerCase()
    : 'empresa'

  if (plano.length > 0) {
    const planoOrdenado = ordenarPlanoContasHierarquico(plano)

    // 1. Aba principal: Lançamentos com 12 Meses em Colunas
    const rows12Meses: LinhaModeloExcel12MesesColunas[] = planoOrdenado.map((pc) => {
      const codPlano = (pc.codigo_empresa || pc.codigo || '').trim()
      const contaNome = (pc.expand?.conta?.nome || pc.descricao || '').trim()
      const centroNome = (pc.expand?.centro?.nome || '').trim()
      const tipoDespesaNome = (pc.expand?.tipo_despesa?.nome || '').trim()

      return {
        'Codigo Plano': codPlano,
        Conta: contaNome,
        Centro: centroNome,
        'Tipo Despesa': tipoDespesaNome,
        Janeiro: 0.0,
        Fevereiro: 0.0,
        Março: 0.0,
        Abril: 0.0,
        Maio: 0.0,
        Junho: 0.0,
        Julho: 0.0,
        Agosto: 0.0,
        Setembro: 0.0,
        Outubro: 0.0,
        Novembro: 0.0,
        Dezembro: 0.0,
        Historico: '',
      }
    })

    const ws12Meses = XLSX.utils.json_to_sheet(rows12Meses)
    ws12Meses['!cols'] = [
      { wch: 18 }, // Codigo Plano
      { wch: 38 }, // Conta
      { wch: 24 }, // Centro
      { wch: 20 }, // Tipo Despesa
      { wch: 14 }, // Jan
      { wch: 14 }, // Fev
      { wch: 14 }, // Mar
      { wch: 14 }, // Abr
      { wch: 14 }, // Mai
      { wch: 14 }, // Jun
      { wch: 14 }, // Jul
      { wch: 14 }, // Ago
      { wch: 14 }, // Set
      { wch: 14 }, // Out
      { wch: 14 }, // Nov
      { wch: 14 }, // Dez
      { wch: 35 }, // Historico
    ]
    XLSX.utils.book_append_sheet(wb, ws12Meses, '12_Meses_Colunas')

    // 2. Aba de Referência
    const rowsReferencia: LinhaReferenciaPlanoContas[] = planoOrdenado.map((pc) => {
      const conta = pc.expand?.conta
      const centro = pc.expand?.centro
      const tipoDespesa = pc.expand?.tipo_despesa

      return {
        'Codigo Hierarquico': conta?.codigo || pc.codigo_empresa || pc.codigo || '',
        'Codigo Plano (Sistema)': pc.codigo || '',
        'Codigo Empresa': pc.codigo_empresa || '',
        'Nome da Conta': conta?.nome || pc.descricao || '',
        'Tipo / Natureza': conta?.tipo || centro?.tipo || '',
        'Centro de Custo': centro?.nome || '',
        'Tipo de Despesa': tipoDespesa?.nome || '',
        Descricao: pc.descricao || conta?.descricao || '',
      }
    })
    const wsRef = XLSX.utils.json_to_sheet(rowsReferencia)
    wsRef['!cols'] = [
      { wch: 22 },
      { wch: 24 },
      { wch: 20 },
      { wch: 38 },
      { wch: 18 },
      { wch: 26 },
      { wch: 22 },
      { wch: 35 },
    ]
    XLSX.utils.book_append_sheet(wb, wsRef, 'Referencia_Plano_Contas')

    // 3. Aba de Instruções
    const instrucoes = [
      {
        Instrução: 'COMO PREENCHER A PLANILHA DE 12 MESES EM COLUNAS:',
        Detalhes: `Esta planilha contém uma linha para cada conta contábil e 12 colunas correspondentes aos meses do exercício de ${ano}.`,
      },
      {
        Instrução: '1. Colunas de Janeiro a Dezembro:',
        Detalhes:
          'Preencha o valor contábil do mês na coluna correspondente (ex: 1500,00 ou 1500.00). Mês sem lançamento para aquela conta pode ficar zerado ou em branco.',
      },
      {
        Instrução: '2. Linhas e Contas:',
        Detalhes:
          'Não altere a coluna "Codigo Plano". Se criar novas linhas, informe o código contábil da conta já cadastrada no sistema.',
      },
      {
        Instrução: '3. Data de Competência Automática:',
        Detalhes: `Ao importar, o sistema deriva a data de competência automaticamente para o dia 15 de cada mês no exercício de ${ano} (ex: Janeiro = ${ano}-01-15).`,
      },
      {
        Instrução: '4. Fluxo Sequencial de Importação:',
        Detalhes:
          'Após o upload, o sistema lê todos os 12 meses e conduz a importação um mês de cada vez, liberando o próximo mês apenas após o sucesso do anterior.',
      },
      {
        Instrução: '5. Coluna Histórico (Opcional):',
        Detalhes:
          'Se preenchida, o texto será utilizado como histórico padrão dos lançamentos daquela conta em todos os meses preenchidos.',
      },
    ]
    const wsInstrucoes = XLSX.utils.json_to_sheet(instrucoes)
    wsInstrucoes['!cols'] = [{ wch: 32 }, { wch: 95 }]
    XLSX.utils.book_append_sheet(wb, wsInstrucoes, 'Instrucoes')

    const nomeArquivo = `modelo_12_meses_colunas_${safeEntidade}_${ano}.xlsx`
    XLSX.writeFile(wb, nomeArquivo)
    return { totalContas: planoOrdenado.length, nomeArquivo }
  }

  // Fallback genérico caso não haja plano de contas
  const rowsGenericas: LinhaModeloExcel12MesesColunas[] = [
    {
      'Codigo Plano': 'PC-001',
      Conta: 'Vendas de Produtos e Serviços',
      Centro: 'Comercial',
      'Tipo Despesa': '',
      Janeiro: 12000.0,
      Fevereiro: 14500.0,
      Março: 15200.0,
      Abril: 16000.0,
      Maio: 15800.0,
      Junho: 17200.0,
      Julho: 18000.0,
      Agosto: 17500.0,
      Setembro: 19000.0,
      Outubro: 20500.0,
      Novembro: 22000.0,
      Dezembro: 26000.0,
      Historico: 'Receita Operacional',
    },
    {
      'Codigo Plano': 'PC-002',
      Conta: 'Salários e Encargos',
      Centro: 'Administrativo',
      'Tipo Despesa': 'Fixa',
      Janeiro: 8500.0,
      Fevereiro: 8500.0,
      Março: 8500.0,
      Abril: 8500.0,
      Maio: 8500.0,
      Junho: 8500.0,
      Julho: 8500.0,
      Agosto: 8500.0,
      Setembro: 8500.0,
      Outubro: 8500.0,
      Novembro: 8500.0,
      Dezembro: 17000.0,
      Historico: 'Folha de Pagamento',
    },
  ]

  const wsGenerico = XLSX.utils.json_to_sheet(rowsGenericas)
  wsGenerico['!cols'] = [
    { wch: 18 },
    { wch: 38 },
    { wch: 24 },
    { wch: 20 },
    ...Array(12).fill({ wch: 14 }),
    { wch: 35 },
  ]
  XLSX.utils.book_append_sheet(wb, wsGenerico, '12_Meses_Colunas')

  const nomeArquivo = `modelo_12_meses_colunas_${ano}.xlsx`
  XLSX.writeFile(wb, nomeArquivo)
  return { totalContas: 0, nomeArquivo }
}

/**
 * Normaliza um rótulo de mês para o índice 1 a 12 (ex: "Janeiro", "jan", "1", "01", "Mês 1").
 */
export function normalizarNomeMesParaIndice(rotulo: string): number | null {
  if (!rotulo) return null
  const s = rotulo
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()

  const mapa: Record<string, number> = {
    janeiro: 1,
    jan: 1,
    '01': 1,
    '1': 1,
    fevereiro: 2,
    fev: 2,
    '02': 2,
    '2': 2,
    marco: 3,
    mar: 3,
    '03': 3,
    '3': 3,
    abril: 4,
    abr: 4,
    '04': 4,
    '4': 4,
    maio: 5,
    mai: 5,
    '05': 5,
    '5': 5,
    junho: 6,
    jun: 6,
    '06': 6,
    '6': 6,
    julho: 7,
    jul: 7,
    '07': 7,
    '7': 7,
    agosto: 8,
    ago: 8,
    '08': 8,
    '8': 8,
    setembro: 9,
    set: 9,
    '09': 9,
    '9': 9,
    outubro: 10,
    out: 10,
    '10': 10,
    novembro: 11,
    nov: 11,
    '11': 11,
    dezembro: 12,
    dez: 12,
    '12': 12,
  }

  if (mapa[s]) return mapa[s]

  // Procura padrão como "mes 1", "mes 01", "mês 12"
  const matchMes = s.match(/(?:mes|m)\s*(\d{1,2})/)
  if (matchMes) {
    const num = parseInt(matchMes[1], 10)
    if (num >= 1 && num <= 12) return num
  }

  return null
}

/**
 * Normaliza qualquer valor numérico ou monetário em formato brasileiro ou internacional.
 */
export function normalizarValorMonetarioExcel(raw: unknown): number {
  if (raw === null || raw === undefined) return 0
  if (typeof raw === 'number') {
    return isNaN(raw) ? 0 : raw
  }
  if (typeof raw === 'string') {
    const limpo = raw.trim()
    if (!limpo || limpo === '-' || limpo === '--') return 0
    return parseBrlNumber(limpo)
  }
  return 0
}

/**
 * Lê e analisa uma planilha preenchida no formato de 12 Meses em Colunas.
 * Produz lançamentos decompostos mês a mês com data de competência (AAAA-MM-15)
 * derivada do ano do exercício selecionado.
 */
export function parsePlanilha12MesesColunas(
  rawData: Array<Record<string, unknown>>,
  planoContas: PlanoContaRecord[],
  anoExercicio: number,
): Planilha12MesesParsedResult {
  const inconsistenciasGerais: string[] = []

  const porMes: Planilha12MesesParsedResult['porMes'] = {}
  for (let m = 1; m <= 12; m++) {
    porMes[m] = {
      mes: m,
      nomeMes: COLUNAS_MESES_12[m - 1],
      totalLancamentos: 0,
      totalValor: 0,
      lancamentos: [],
      lancamentosValidos: [],
      lancamentosComErro: [],
    }
  }

  if (!rawData || rawData.length === 0) {
    inconsistenciasGerais.push('A planilha está vazia ou não contém linhas de dados.')
    return {
      anoExercicio,
      totalLinhasLidas: 0,
      totalLancamentosValidos: 0,
      porMes,
      inconsistenciasGerais,
    }
  }

  // Mapeia colunas presentes no rawData para os 12 meses
  const primeiraLinha = rawData[0] || {}
  const chaves = Object.keys(primeiraLinha)
  const mapaColunasMes: Array<{ chaveOriginal: string; mes: number }> = []

  chaves.forEach((k) => {
    const mesIdx = normalizarNomeMesParaIndice(k)
    if (mesIdx !== null) {
      mapaColunasMes.push({ chaveOriginal: k, mes: mesIdx })
    }
  })

  if (mapaColunasMes.length === 0) {
    inconsistenciasGerais.push(
      'Não foram identificadas colunas de meses (Janeiro a Dezembro) na planilha. Verifique os cabeçalhos.',
    )
  }

  let totalValidos = 0

  rawData.forEach((row, rowIdx) => {
    // Código da conta
    const codPC = String(
      row['Codigo Plano'] ||
        row['codigo_plano'] ||
        row['Codigo'] ||
        row['codigo'] ||
        row['Cód. Plano'] ||
        row['Cod Plano'] ||
        '',
    ).trim()

    const rawContaNome = String(row['Conta'] || row['conta'] || row['Nome da Conta'] || '').trim()
    const rawCentroNome = String(
      row['Centro'] || row['centro'] || row['Centro de Custo'] || '',
    ).trim()
    const rawHistoricoPadrao = String(
      row['Historico'] || row['historico'] || row['Histórico'] || row['Descricao'] || '',
    ).trim()

    // Localiza plano de contas por código ou nome
    const pcEncontrado = planoContas.find((p) => {
      const pCodEmpresa = (p.codigo_empresa || '').trim().toLowerCase()
      const pCodigo = (p.codigo || '').trim().toLowerCase()
      const pNome = (p.expand?.conta?.nome || p.descricao || '').trim().toLowerCase()

      const cLower = codPC.toLowerCase()
      const nLower = rawContaNome.toLowerCase()

      if (cLower && (pCodEmpresa === cLower || pCodigo === cLower)) return true
      if (nLower && (pCodEmpresa === nLower || pNome === nLower)) return true
      return false
    })

    const contaResolvidaNome =
      pcEncontrado?.expand?.conta?.nome || pcEncontrado?.descricao || rawContaNome
    const centroResolvidoNome = pcEncontrado?.expand?.centro?.nome || rawCentroNome
    const tipoDespesaResolvidoNome = pcEncontrado?.expand?.tipo_despesa?.nome

    // Percorre as colunas de meses detectadas
    mapaColunasMes.forEach(({ chaveOriginal, mes }) => {
      const rawValor = row[chaveOriginal]
      const valor = normalizarValorMonetarioExcel(rawValor)

      // Regra: Mês sem valor na conta = sem lançamento para aquela conta naquele mês
      if (valor === 0) return

      const mesStr = String(mes).padStart(2, '0')
      const dataCompetencia = `${anoExercicio}-${mesStr}-15`

      let status: 'valido' | 'erro' = 'valido'
      let erro_msg = ''

      if (!pcEncontrado && !codPC) {
        status = 'erro'
        erro_msg = `Linha ${rowIdx + 2}: Código do Plano de Contas não informado`
      } else if (!pcEncontrado) {
        status = 'erro'
        erro_msg = `Linha ${rowIdx + 2}: Plano de contas "${codPC || rawContaNome}" não encontrado`
      } else if (valor < 0) {
        status = 'erro'
        erro_msg = `Linha ${rowIdx + 2} (${COLUNAS_MESES_12[mes - 1]}): Valor negativo não permitido (${valor})`
      }

      const historicoFinal =
        rawHistoricoPadrao ||
        `Lançamento ref. ${contaResolvidaNome || 'conta'} (${COLUNAS_MESES_12[mes - 1]}/${anoExercicio})`

      const item: LancamentoExtraidoMes12Colunas = {
        mes,
        codigo_pc: codPC || pcEncontrado?.codigo_empresa || pcEncontrado?.codigo || '',
        conta_nome: contaResolvidaNome,
        centro_nome: centroResolvidoNome,
        tipo_despesa_nome: tipoDespesaResolvidoNome,
        plano_conta_id: pcEncontrado?.id,
        data: dataCompetencia,
        valor,
        historico: historicoFinal,
        status,
        erro_msg,
      }

      porMes[mes].lancamentos.push(item)
      porMes[mes].totalLancamentos++
      porMes[mes].totalValor += valor

      if (status === 'valido') {
        porMes[mes].lancamentosValidos.push(item)
        totalValidos++
      } else {
        porMes[mes].lancamentosComErro.push(item)
      }
    })
  })

  return {
    anoExercicio,
    totalLinhasLidas: rawData.length,
    totalLancamentosValidos: totalValidos,
    porMes,
    inconsistenciasGerais,
  }
}
