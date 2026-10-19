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

export interface OpcoesDownloadModeloExcel {
  planoContas?: PlanoContaRecord[]
  nomeEmpresaOuGrupo?: string
  anoReferencia?: number
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
        Data: `${ano}-01-15`,
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

    const nomeArquivo = `modelo_importacao_lancamentos_${safeEntidade}_${dataHoje}.xlsx`
    XLSX.writeFile(wb, nomeArquivo)

    return { totalContas: planoOrdenado.length, nomeArquivo }
  }

  // Fallback: modelo genérico/vazio quando a empresa/grupo não possui plano de contas
  const templateGenerico: LinhaModeloExcelLancamentos[] = [
    {
      'Codigo Plano': 'PC-001',
      Conta: 'Vendas de Produtos',
      Centro: 'Comercial',
      Data: `${ano}-01-15`,
      Valor: 15000.0,
      Historico: 'Vendas da primeira quinzena',
      Recorrente: 'NAO',
    },
    {
      'Codigo Plano': 'PC-002',
      Conta: 'Salários e Ordenados',
      Centro: 'Administrativo',
      Data: `${ano}-01-05`,
      Valor: 8500.0,
      Historico: 'Folha de pagamento Janeiro',
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

  const nomeArquivo = 'modelo_importacao_lancamentos.xlsx'
  XLSX.writeFile(wb, nomeArquivo)

  return { totalContas: 0, nomeArquivo }
}
