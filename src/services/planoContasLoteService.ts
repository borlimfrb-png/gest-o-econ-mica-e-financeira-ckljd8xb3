/**
 * Serviço de importação e aplicação em lote de Plano de Contas.
 *
 * Garante:
 * 1. Reutilização de Contas, Centros e Tipos de Despesa existentes (por nome/código)
 *    ou criação automática quando inexistentes.
 * 2. Criação sequencial de itens em `plano_contas` vinculados à empresa selecionada.
 * 3. O hook `on_plano_conta_create_codigo` atribui `PC-001`, `PC-002`, ... isolado por empresa.
 * 4. Validação de duplicidade na mesma empresa para evitar criar vínculos idênticos
 *    (mesma conta + mesmo centro + mesmo tipo_despesa).
 */

import {
  contasService,
  centrosService,
  tiposDespesaService,
  planoContasService,
} from '@/services/financeService'
import type {
  PlanoContaRecord,
  ContaRecord,
  CentroRecord,
  TipoDespesaRecord,
  TipoConta,
  TipoCentro,
} from '@/types/finance'
import { MODELO_PLANO_CONTAS_PADRAO, type ItemModeloPadrao } from '@/lib/planoContasPadrao'

export interface ItemImportacaoPlano {
  codigo?: string // Código contábil ou código informado
  contaNome: string // Nome da conta
  contaTipo?: TipoConta // Ativo, Passivo, Patrimônio Líquido, Receita, Despesa
  contaGrupo?: string // Grupo da conta
  centroNome?: string // Centro de custo
  centroTipo?: TipoCentro // Receita ou Despesa
  tipoDespesaNome?: string // Tipo de despesa (ex: Fixas, Variáveis)
  descricao?: string
  linhaOrigem?: number
  valido?: boolean
  erroValidacao?: string
}

export interface ResultadoLotePlano {
  totalSolicitados: number
  totalCriados: number
  totalIgnoradosDuplicados: number
  totalErros: number
  itensCriados: PlanoContaRecord[]
  errosDetalhes: string[]
}

/**
 * Normaliza strings para comparação insensível a maiúsculas/acentos/espaços extras.
 */
function normalizar(str?: string | null): string {
  if (!str) return ''
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
}

/**
 * Inspeciona ou cria dependências (Contas, Centros, Tipos de Despesa) em cache local
 * para evitar chamadas redundantes e garantir consistência.
 */
class CatalogoDependenciasCache {
  private contas: ContaRecord[] = []
  private centros: CentroRecord[] = []
  private tipos: TipoDespesaRecord[] = []

  async carregar() {
    const [cList, ceList, tList] = await Promise.all([
      contasService.getAll(),
      centrosService.getAll(),
      tiposDespesaService.getAll(),
    ])
    this.contas = cList
    this.centros = ceList
    this.tipos = tList
  }

  getContas() {
    return this.contas
  }

  getCentros() {
    return this.centros
  }

  getTipos() {
    return this.tipos
  }

  async obterOuCriarConta(
    nome: string,
    tipoDefault: TipoConta = 'Despesa',
    grupoDefault?: string,
    codigoSugerido?: string,
  ): Promise<ContaRecord> {
    const norm = normalizar(nome)
    const existente = this.contas.find((c) => normalizar(c.nome) === norm)
    if (existente) return existente

    // Cria nova conta
    const nova = await contasService.create({
      nome: nome.trim(),
      tipo: tipoDefault,
      grupo: grupoDefault || undefined,
      descricao: codigoSugerido ? `Código sugerido: ${codigoSugerido}` : undefined,
    })
    this.contas.push(nova)
    return nova
  }

  async obterOuCriarCentro(
    nome: string,
    tipoDefault: TipoCentro = 'Despesa',
  ): Promise<CentroRecord> {
    const norm = normalizar(nome)
    const existente = this.centros.find((c) => normalizar(c.nome) === norm)
    if (existente) return existente

    const novo = await centrosService.create({
      nome: nome.trim(),
      tipo: tipoDefault,
    })
    this.centros.push(novo)
    return novo
  }

  async obterOuCriarTipoDespesa(nome: string): Promise<TipoDespesaRecord | undefined> {
    if (!nome.trim()) return undefined
    const norm = normalizar(nome)
    const existente = this.tipos.find((t) => normalizar(t.nome) === norm)
    if (existente) return existente

    const novo = await tiposDespesaService.create({
      nome: nome.trim(),
    })
    this.tipos.push(novo)
    return novo
  }
}

export const planoContasLoteService = {
  /**
   * Copia o conjunto contábil padrão predefinido para a empresa selecionada.
   * Evita duplicar vínculos se a mesma conta + centro já existirem para a empresa.
   */
  async aplicarModeloPadrao(
    empresaId: string,
    onProgress?: (atual: number, total: number) => void,
  ): Promise<ResultadoLotePlano> {
    if (!empresaId) {
      throw new Error('Empresa obrigatória para aplicar o plano de contas padrão.')
    }

    const catalogo = new CatalogoDependenciasCache()
    await catalogo.carregar()

    // Carrega itens atuais do plano para esta empresa para detectar duplicidade
    const itensAtuais = await planoContasService.getAll({ empresaId })
    const chavesExistentes = new Set<string>()
    for (const it of itensAtuais) {
      // chave: contaId::centroId::tipoId
      chavesExistentes.add(`${it.conta}::${it.centro}::${it.tipo_despesa || ''}`)
    }

    const resultado: ResultadoLotePlano = {
      totalSolicitados: MODELO_PLANO_CONTAS_PADRAO.length,
      totalCriados: 0,
      totalIgnoradosDuplicados: 0,
      totalErros: 0,
      itensCriados: [],
      errosDetalhes: [],
    }

    let indice = 0
    for (const item of MODELO_PLANO_CONTAS_PADRAO) {
      indice++
      if (onProgress) onProgress(indice, MODELO_PLANO_CONTAS_PADRAO.length)

      try {
        const conta = await catalogo.obterOuCriarConta(
          item.contaNome,
          item.contaTipo,
          item.contaGrupo,
          item.codigoSugerido,
        )

        const centro = await catalogo.obterOuCriarCentro(item.centroNome, item.centroTipo)

        let tipoDespesa: TipoDespesaRecord | undefined
        if (item.tipoDespesaNome) {
          tipoDespesa = await catalogo.obterOuCriarTipoDespesa(item.tipoDespesaNome)
        }

        const chaveVinculo = `${conta.id}::${centro.id}::${tipoDespesa?.id || ''}`
        if (chavesExistentes.has(chaveVinculo)) {
          resultado.totalIgnoradosDuplicados++
          continue
        }

        const descricaoFinal = item.codigoSugerido
          ? `[${item.codigoSugerido}] ${item.descricao || item.contaNome}`
          : item.descricao

        const novoPlano = await planoContasService.create({
          empresa: empresaId,
          conta: conta.id,
          centro: centro.id,
          tipo_despesa: tipoDespesa?.id,
          descricao: descricaoFinal,
        })

        chavesExistentes.add(chaveVinculo)
        resultado.totalCriados++
        resultado.itensCriados.push(novoPlano)
      } catch (err: any) {
        resultado.totalErros++
        const msg = `Conta "${item.contaNome}": ${err?.message || 'Falha ao gravar'}`
        resultado.errosDetalhes.push(msg)
        console.error('Erro ao gravar item do modelo padrão:', err)
      }
    }

    return resultado
  },

  /**
   * Grava em lote uma lista arbitrária de itens modelo (usado pelo Assistente de Contas por Segmento).
   * Valida duplicidade contra o plano atual da empresa e reaproveita cadastros de Contas/Centros.
   */
  async aplicarContasSugeridas(
    empresaId: string,
    itens: ItemModeloPadrao[],
    onProgress?: (atual: number, total: number) => void,
  ): Promise<ResultadoLotePlano> {
    if (!empresaId) {
      throw new Error('Empresa obrigatória para aplicar contas sugeridas.')
    }

    const catalogo = new CatalogoDependenciasCache()
    await catalogo.carregar()

    const itensAtuais = await planoContasService.getAll({ empresaId })
    const chavesExistentes = new Set<string>()
    for (const it of itensAtuais) {
      chavesExistentes.add(`${it.conta}::${it.centro}::${it.tipo_despesa || ''}`)
    }

    const resultado: ResultadoLotePlano = {
      totalSolicitados: itens.length,
      totalCriados: 0,
      totalIgnoradosDuplicados: 0,
      totalErros: 0,
      itensCriados: [],
      errosDetalhes: [],
    }

    let indice = 0
    for (const item of itens) {
      indice++
      if (onProgress) onProgress(indice, itens.length)

      try {
        const conta = await catalogo.obterOuCriarConta(
          item.contaNome,
          item.contaTipo,
          item.contaGrupo,
          item.codigoSugerido,
        )

        const centro = await catalogo.obterOuCriarCentro(item.centroNome, item.centroTipo)

        let tipoDespesa: TipoDespesaRecord | undefined
        if (item.tipoDespesaNome) {
          tipoDespesa = await catalogo.obterOuCriarTipoDespesa(item.tipoDespesaNome)
        }

        const chaveVinculo = `${conta.id}::${centro.id}::${tipoDespesa?.id || ''}`
        if (chavesExistentes.has(chaveVinculo)) {
          resultado.totalIgnoradosDuplicados++
          continue
        }

        const descricaoFinal = item.codigoSugerido
          ? `[${item.codigoSugerido}] ${item.descricao || item.contaNome}`
          : item.descricao

        const novoPlano = await planoContasService.create({
          empresa: empresaId,
          conta: conta.id,
          centro: centro.id,
          tipo_despesa: tipoDespesa?.id,
          descricao: descricaoFinal,
        })

        chavesExistentes.add(chaveVinculo)
        resultado.totalCriados++
        resultado.itensCriados.push(novoPlano)
      } catch (err: any) {
        resultado.totalErros++
        const msg = `Conta "${item.contaNome}": ${err?.message || 'Falha ao gravar'}`
        resultado.errosDetalhes.push(msg)
        console.error('Erro ao gravar conta sugerida:', err)
      }
    }

    return resultado
  },

  /**
   * Importa uma lista de itens analisados de arquivo Excel ou CSV para a empresa selecionada.
   */
  async importarItens(
    empresaId: string,
    itens: ItemImportacaoPlano[],
    onProgress?: (atual: number, total: number) => void,
  ): Promise<ResultadoLotePlano> {
    if (!empresaId) {
      throw new Error('Empresa obrigatória para importar o plano de contas.')
    }

    const catalogo = new CatalogoDependenciasCache()
    await catalogo.carregar()

    // Carrega itens atuais do plano para esta empresa
    const itensAtuais = await planoContasService.getAll({ empresaId })
    const chavesExistentes = new Set<string>()
    for (const it of itensAtuais) {
      chavesExistentes.add(`${it.conta}::${it.centro}::${it.tipo_despesa || ''}`)
    }

    const resultado: ResultadoLotePlano = {
      totalSolicitados: itens.length,
      totalCriados: 0,
      totalIgnoradosDuplicados: 0,
      totalErros: 0,
      itensCriados: [],
      errosDetalhes: [],
    }

    let indice = 0
    for (const item of itens) {
      indice++
      if (onProgress) onProgress(indice, itens.length)

      if (!item.contaNome || !item.contaNome.trim()) {
        resultado.totalErros++
        resultado.errosDetalhes.push(`Linha ${item.linhaOrigem || indice}: Nome da conta vazio`)
        continue
      }

      try {
        const tipoConta = inferirTipoConta(item.contaTipo, item.contaNome)
        const grupoConta = item.contaGrupo?.trim() || inferirGrupoConta(tipoConta, item.contaNome)

        const conta = await catalogo.obterOuCriarConta(
          item.contaNome,
          tipoConta,
          grupoConta,
          item.codigo,
        )

        // Centro de custo: se não informado na planilha, usa padrão coerente com o tipo de conta
        const centroNomeFinal = item.centroNome?.trim() || sugerirCentroPadrao(tipoConta)
        const centroTipoFinal: TipoCentro =
          item.centroTipo || (tipoConta === 'Receita' ? 'Receita' : 'Despesa')
        const centro = await catalogo.obterOuCriarCentro(centroNomeFinal, centroTipoFinal)

        let tipoDespesa: TipoDespesaRecord | undefined
        if (item.tipoDespesaNome && item.tipoDespesaNome.trim()) {
          tipoDespesa = await catalogo.obterOuCriarTipoDespesa(item.tipoDespesaNome.trim())
        }

        const chaveVinculo = `${conta.id}::${centro.id}::${tipoDespesa?.id || ''}`
        if (chavesExistentes.has(chaveVinculo)) {
          resultado.totalIgnoradosDuplicados++
          continue
        }

        const descricaoParts: string[] = []
        if (item.codigo) descricaoParts.push(`[${item.codigo}]`)
        if (item.descricao) descricaoParts.push(item.descricao)

        const novoPlano = await planoContasService.create({
          empresa: empresaId,
          conta: conta.id,
          centro: centro.id,
          tipo_despesa: tipoDespesa?.id,
          descricao: descricaoParts.join(' ').trim() || undefined,
        })

        chavesExistentes.add(chaveVinculo)
        resultado.totalCriados++
        resultado.itensCriados.push(novoPlano)
      } catch (err: any) {
        resultado.totalErros++
        const msg = `Linha ${item.linhaOrigem || indice} (${item.contaNome}): ${
          err?.message || 'Erro ao processar'
        }`
        resultado.errosDetalhes.push(msg)
        console.error('Erro ao importar linha:', err)
      }
    }

    return resultado
  },
}

/**
 * Inferência de tipo contábil baseada em texto fornecido ou palavras-chave
 */
export function inferirTipoConta(tipoBruto?: string, nomeConta: string = ''): TipoConta {
  if (tipoBruto) {
    const t = normalizar(tipoBruto)
    if (t.includes('ativo') || t === '1' || t.startsWith('1.')) return 'Ativo'
    if (t.includes('passivo') || t === '2' || t.startsWith('2.')) return 'Passivo'
    if (t.includes('patrimonio') || t.includes('pl') || t === '3' || t.startsWith('3.')) {
      return 'Patrimônio Líquido'
    }
    if (t.includes('receita') || t === '4' || t.startsWith('4.')) return 'Receita'
    if (
      t.includes('despesa') ||
      t.includes('custo') ||
      t === '5' ||
      t.startsWith('5.') ||
      t.startsWith('6.')
    ) {
      return 'Despesa'
    }
  }

  const n = normalizar(nomeConta)
  if (
    n.includes('receita') ||
    n.includes('faturamento') ||
    n.includes('venda') ||
    n.includes('honorarios')
  ) {
    return 'Receita'
  }
  if (
    n.includes('caixa') ||
    n.includes('banco') ||
    n.includes('aplicacao') ||
    n.includes('cliente') ||
    n.includes('estoque') ||
    n.includes('imobilizado')
  ) {
    return 'Ativo'
  }
  if (
    n.includes('fornecedor') ||
    n.includes('salarios a pagar') ||
    n.includes('impostos a recolher') ||
    n.includes('emprestimo')
  ) {
    return 'Passivo'
  }
  if (n.includes('capital social') || n.includes('reserva') || n.includes('lucros acumulados')) {
    return 'Patrimônio Líquido'
  }

  return 'Despesa'
}

/**
 * Inferência de grupo contábil padrão
 */
function inferirGrupoConta(tipo: TipoConta, nomeConta: string = ''): string {
  const n = normalizar(nomeConta)
  if (tipo === 'Ativo') {
    if (n.includes('imobilizado') || n.includes('intangivel') || n.includes('veiculo')) {
      return 'Ativo Não Circulante'
    }
    return 'Ativo Circulante'
  }
  if (tipo === 'Passivo') {
    if (n.includes('longo prazo') || n.includes('lp')) {
      return 'Passivo Não Circulante'
    }
    return 'Passivo Circulante'
  }
  if (tipo === 'Patrimônio Líquido') {
    if (n.includes('capital')) return 'Capital Social'
    if (n.includes('reserva')) return 'Reservas de Lucros'
    return 'Lucros ou Prejuízos Acumulados'
  }
  if (tipo === 'Receita') {
    if (n.includes('financeira') || n.includes('rendimento')) return 'Receitas Financeiras'
    if (n.includes('deducao') || n.includes('imposto')) return 'Deduções da Receita Bruta'
    return 'Receita de Prestação de Serviços'
  }
  // Despesa
  if (n.includes('custo') || n.includes('cpv') || n.includes('csv')) {
    return 'Custos dos Produtos/Serviços Vendidos (CPV/CSV)'
  }
  if (
    n.includes('folha') ||
    n.includes('salario') ||
    n.includes('inss') ||
    n.includes('fgts') ||
    n.includes('beneficio')
  ) {
    return 'Despesas com Pessoal'
  }
  if (n.includes('comercial') || n.includes('vendas') || n.includes('marketing')) {
    return 'Despesas Comerciais / Vendas'
  }
  if (n.includes('financeira') || n.includes('juros') || n.includes('tarifa')) {
    return 'Despesas Financeiras'
  }
  return 'Despesas Administrativas'
}

/**
 * Sugestão de Centro de Custo padrão caso não venha na planilha
 */
function sugerirCentroPadrao(tipoConta: TipoConta): string {
  switch (tipoConta) {
    case 'Receita':
      return 'Receitas Operacionais'
    case 'Ativo':
      return 'Disponibilidades'
    case 'Passivo':
      return 'Operações Gerais'
    case 'Patrimônio Líquido':
      return 'Societário / Diretoria'
    case 'Despesa':
    default:
      return 'Despesas Administrativas'
  }
}
