import * as XLSX from 'xlsx'
import type { PlanoContaRecord } from '@/types/finance'
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
