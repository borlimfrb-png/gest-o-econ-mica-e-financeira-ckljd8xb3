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
  codigoEmpresa?: string // Código da Conta da Empresa
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

export interface OpcoesCopiarPlanoEmpresa {
  origemEmpresaId: string
  destinoEmpresaId: string
  modo: 'substituir' | 'adicionar' // 'substituir': remove plano anterior do destino; 'adicionar': pula duplicados
  copiarCentrosCusto?: boolean // se true, cria centros de custo no destino caso inexistentes e mapeia; se false, usa centros equivalentes no destino ou cria um padrão
  onProgress?: (progresso: {
    fase: string
    atual: number
    total: number
    percentual: number
  }) => void
}

export interface ResultadoCopiarPlanoEmpresa {
  totalOrigem: number
  totalCopiados: number
  totalIgnoradosDuplicados: number
  totalRemovidosAnteriores: number
  totalErros: number
  errosDetalhes: string[]
  contasCriadasNoDestino: number
  centrosCriadosNoDestino: number
  tiposCriadosNoDestino: number
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

  private empresaId?: string

  constructor(empresaId?: string) {
    this.empresaId = empresaId
  }

  async carregar() {
    const opts = this.empresaId ? { empresaId: this.empresaId } : undefined
    const [cList, ceList, tList] = await Promise.all([
      contasService.getAll(opts),
      centrosService.getAll(opts),
      tiposDespesaService.getAll(opts),
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
      empresa: this.empresaId || undefined,
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
      empresa: this.empresaId || undefined,
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
      empresa: this.empresaId || undefined,
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

    const catalogo = new CatalogoDependenciasCache(empresaId)
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

    const catalogo = new CatalogoDependenciasCache(empresaId)
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

    const catalogo = new CatalogoDependenciasCache(empresaId)
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
          codigo_empresa: item.codigoEmpresa?.trim() || item.codigo?.trim() || undefined,
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

  /**
   * Copia o plano de contas completo de uma empresa de origem para uma empresa de destino.
   * Suporta:
   * - Modo 'substituir': remove os itens atuais de plano_contas da empresa de destino e recria a partir da origem.
   * - Modo 'adicionar': pula contas/vínculos que já existam no destino (por código da empresa ou por nome da conta + centro).
   * - Vínculo com centros de custo: se copiarCentrosCusto=true, busca centros equivalentes por nome na empresa de destino ou cria automaticamente no destino.
   * - Criação/reaproveitamento automático de Contas e Tipos de Despesa para a empresa de destino.
   */
  async copiarPlanoEntreEmpresas(
    opcoes: OpcoesCopiarPlanoEmpresa,
  ): Promise<ResultadoCopiarPlanoEmpresa> {
    const {
      origemEmpresaId,
      destinoEmpresaId,
      modo,
      copiarCentrosCusto = true,
      onProgress,
    } = opcoes

    if (!origemEmpresaId || !destinoEmpresaId) {
      throw new Error('Empresas de origem e destino são obrigatórias.')
    }
    if (origemEmpresaId === destinoEmpresaId) {
      throw new Error('A empresa de origem e destino devem ser diferentes.')
    }

    const resultado: ResultadoCopiarPlanoEmpresa = {
      totalOrigem: 0,
      totalCopiados: 0,
      totalIgnoradosDuplicados: 0,
      totalRemovidosAnteriores: 0,
      totalErros: 0,
      errosDetalhes: [],
      contasCriadasNoDestino: 0,
      centrosCriadosNoDestino: 0,
      tiposCriadosNoDestino: 0,
    }

    onProgress?.({
      fase: 'Carregando dados da origem e destino...',
      atual: 0,
      total: 100,
      percentual: 5,
    })

    // 1. Carrega plano completo da origem e destino com expand
    const [
      itensOrigem,
      itensDestinoAtuais,
      contasOrigem,
      centrosOrigem,
      tiposOrigem,
      contasDestino,
      centrosDestino,
      tiposDestino,
    ] = await Promise.all([
      planoContasService.getAll({ empresaId: origemEmpresaId }),
      planoContasService.getAll({ empresaId: destinoEmpresaId }),
      contasService.getAll({ empresaId: origemEmpresaId }),
      centrosService.getAll({ empresaId: origemEmpresaId }),
      tiposDespesaService.getAll({ empresaId: origemEmpresaId }),
      contasService.getAll({ empresaId: destinoEmpresaId }),
      centrosService.getAll({ empresaId: destinoEmpresaId }),
      tiposDespesaService.getAll({ empresaId: destinoEmpresaId }),
    ])

    resultado.totalOrigem = itensOrigem.length

    if (itensOrigem.length === 0) {
      throw new Error('A empresa de origem não possui contas cadastradas no plano.')
    }

    // Mapas de lookup da origem
    const mapContaOrigem = new Map<string, ContaRecord>()
    for (const c of contasOrigem) mapContaOrigem.set(c.id, c)

    const mapCentroOrigem = new Map<string, CentroRecord>()
    for (const ce of centrosOrigem) mapCentroOrigem.set(ce.id, ce)

    const mapTipoOrigem = new Map<string, TipoDespesaRecord>()
    for (const tp of tiposOrigem) mapTipoOrigem.set(tp.id, tp)

    // Caches do destino para busca/criação por nome normalizado
    const contasDestinoCache = [...contasDestino]
    const centrosDestinoCache = [...centrosDestino]
    const tiposDestinoCache = [...tiposDestino]

    // 2. Se modo for 'substituir', remove os itens anteriores de plano_contas do destino
    if (modo === 'substituir' && itensDestinoAtuais.length > 0) {
      const totalParaRemover = itensDestinoAtuais.length
      onProgress?.({
        fase: `Removendo ${totalParaRemover} contas antigas do destino...`,
        atual: 0,
        total: totalParaRemover,
        percentual: 10,
      })

      for (let i = 0; i < itensDestinoAtuais.length; i++) {
        const itemRemover = itensDestinoAtuais[i]
        try {
          await planoContasService.delete(itemRemover.id)
          resultado.totalRemovidosAnteriores++
        } catch (err: any) {
          console.error(`Erro ao remover conta antiga ${itemRemover.id}:`, err)
          resultado.errosDetalhes.push(
            `Falha ao remover item anterior ${itemRemover.codigo}: ${err?.message || 'Erro'}`,
          )
        }
        onProgress?.({
          fase: `Removendo contas antigas do destino (${i + 1}/${totalParaRemover})...`,
          atual: i + 1,
          total: totalParaRemover,
          percentual: 10 + Math.round(((i + 1) / totalParaRemover) * 15),
        })
      }
    }

    // Conjunto de chaves existentes no destino (se modo adicionar)
    // Chaves consideradas duplicadas no destino:
    // a) pelo código da empresa (se informado e não vazio)
    // b) pela tupla contaNomeNorm + centroNomeNorm
    const codigosEmpresaExistentesNoDestino = new Set<string>()
    const tuplasContaCentroExistentesNoDestino = new Set<string>()

    if (modo === 'adicionar') {
      for (const it of itensDestinoAtuais) {
        if (it.codigo_empresa && it.codigo_empresa.trim()) {
          codigosEmpresaExistentesNoDestino.add(normalizar(it.codigo_empresa))
        }
        const cNome = it.expand?.conta?.nome || mapContaOrigem.get(it.conta)?.nome || ''
        const ceNome = it.expand?.centro?.nome || mapCentroOrigem.get(it.centro)?.nome || ''
        if (cNome) {
          tuplasContaCentroExistentesNoDestino.add(`${normalizar(cNome)}::${normalizar(ceNome)}`)
        }
      }
    }

    // Funções auxiliares para obter ou criar dependências no destino
    const obterOuCriarContaDestino = async (contaOrigem: ContaRecord): Promise<ContaRecord> => {
      const normNome = normalizar(contaOrigem.nome)
      const existente = contasDestinoCache.find((c) => normalizar(c.nome) === normNome)
      if (existente) return existente

      const nova = await contasService.create({
        nome: contaOrigem.nome,
        tipo: contaOrigem.tipo,
        grupo: contaOrigem.grupo || undefined,
        descricao: contaOrigem.descricao || undefined,
        empresa: destinoEmpresaId,
      })
      contasDestinoCache.push(nova)
      resultado.contasCriadasNoDestino++
      return nova
    }

    const obterOuCriarCentroDestino = async (
      centroOrigem: CentroRecord | undefined,
      tipoFallback: TipoConta,
    ): Promise<CentroRecord> => {
      if (copiarCentrosCusto && centroOrigem) {
        const normNome = normalizar(centroOrigem.nome)
        const existente = centrosDestinoCache.find((ce) => normalizar(ce.nome) === normNome)
        if (existente) return existente

        const novo = await centrosService.create({
          nome: centroOrigem.nome,
          tipo: centroOrigem.tipo,
          descricao: centroOrigem.descricao || undefined,
          meta_mensal: centroOrigem.meta_mensal,
          meta_anual: centroOrigem.meta_anual,
          empresa: destinoEmpresaId,
        })
        centrosDestinoCache.push(novo)
        resultado.centrosCriadosNoDestino++
        return novo
      }

      // Se copiarCentrosCusto for false ou centroOrigem indefinido:
      // Procurar primeiro algum centro de receita ou despesa no destino
      const tipoCentroAlvo: TipoCentro = tipoFallback === 'Receita' ? 'Receita' : 'Despesa'
      const existenteTipo = centrosDestinoCache.find((ce) => ce.tipo === tipoCentroAlvo)
      if (existenteTipo) return existenteTipo

      // Senão cria um centro padrão coerente
      const nomePadrao =
        tipoCentroAlvo === 'Receita' ? 'Receitas Operacionais' : 'Despesas Administrativas'
      const existenteNome = centrosDestinoCache.find(
        (ce) => normalizar(ce.nome) === normalizar(nomePadrao),
      )
      if (existenteNome) return existenteNome

      const novoPadrao = await centrosService.create({
        nome: nomePadrao,
        tipo: tipoCentroAlvo,
        empresa: destinoEmpresaId,
      })
      centrosDestinoCache.push(novoPadrao)
      resultado.centrosCriadosNoDestino++
      return novoPadrao
    }

    const obterOuCriarTipoDespesaDestino = async (
      tipoOrigem: TipoDespesaRecord | undefined,
    ): Promise<TipoDespesaRecord | undefined> => {
      if (!tipoOrigem) return undefined
      const normNome = normalizar(tipoOrigem.nome)
      const existente = tiposDestinoCache.find((t) => normalizar(t.nome) === normNome)
      if (existente) return existente

      const novo = await tiposDespesaService.create({
        nome: tipoOrigem.nome,
        descricao: tipoOrigem.descricao || undefined,
        empresa: destinoEmpresaId,
      })
      tiposDestinoCache.push(novo)
      resultado.tiposCriadosNoDestino++
      return novo
    }

    // 3. Itera sobre os itens da origem e realiza a cópia
    const totalItens = itensOrigem.length
    for (let i = 0; i < totalItens; i++) {
      const itemOrigem = itensOrigem[i]
      const progressoPct = Math.round(25 + ((i + 1) / totalItens) * 75)
      onProgress?.({
        fase: `Copiando contas (${i + 1}/${totalItens})...`,
        atual: i + 1,
        total: totalItens,
        percentual: progressoPct,
      })

      // Resolve conta da origem
      const contaOrigem = itemOrigem.expand?.conta || mapContaOrigem.get(itemOrigem.conta)
      if (!contaOrigem) {
        resultado.totalErros++
        resultado.errosDetalhes.push(
          `Item ${itemOrigem.codigo || i + 1}: Conta associada não encontrada na origem.`,
        )
        continue
      }

      // Resolve centro da origem
      const centroOrigem =
        itemOrigem.expand?.centro ||
        (itemOrigem.centro ? mapCentroOrigem.get(itemOrigem.centro) : undefined)

      // Resolve tipo de despesa da origem
      const tipoDespesaOrigem =
        itemOrigem.expand?.tipo_despesa ||
        (itemOrigem.tipo_despesa ? mapTipoOrigem.get(itemOrigem.tipo_despesa) : undefined)

      // Se modo for 'adicionar', checar duplicidades
      if (modo === 'adicionar') {
        const codEmpresaNorm = itemOrigem.codigo_empresa
          ? normalizar(itemOrigem.codigo_empresa)
          : ''
        const tuplaNorm = `${normalizar(contaOrigem.nome)}::${normalizar(centroOrigem?.nome || '')}`

        const existePorCodigo =
          codEmpresaNorm && codigosEmpresaExistentesNoDestino.has(codEmpresaNorm)
        const existePorTupla = tuplasContaCentroExistentesNoDestino.has(tuplaNorm)

        if (existePorCodigo || existePorTupla) {
          resultado.totalIgnoradosDuplicados++
          continue
        }
      }

      try {
        // Obter ou criar conta no destino
        const contaDestino = await obterOuCriarContaDestino(contaOrigem)

        // Obter ou criar centro no destino
        const centroDestino = await obterOuCriarCentroDestino(centroOrigem, contaOrigem.tipo)

        // Obter ou criar tipo de despesa no destino
        const tipoDestino = await obterOuCriarTipoDespesaDestino(tipoDespesaOrigem)

        // Criar registro em plano_contas para a empresa destino
        await planoContasService.create({
          empresa: destinoEmpresaId,
          conta: contaDestino.id,
          centro: centroDestino.id,
          tipo_despesa: tipoDestino?.id,
          descricao: itemOrigem.descricao || undefined,
          codigo_empresa: itemOrigem.codigo_empresa || undefined,
        })

        resultado.totalCopiados++

        // Registrar no conjunto de chaves do destino para evitar auto-duplicação se houver itens repetidos
        if (itemOrigem.codigo_empresa) {
          codigosEmpresaExistentesNoDestino.add(normalizar(itemOrigem.codigo_empresa))
        }
        const tuplaCriada = `${normalizar(contaOrigem.nome)}::${normalizar(centroOrigem?.nome || '')}`
        tuplasContaCentroExistentesNoDestino.add(tuplaCriada)
      } catch (err: any) {
        resultado.totalErros++
        const msg = `Conta "${contaOrigem.nome}": ${err?.message || 'Falha ao copiar'}`
        resultado.errosDetalhes.push(msg)
        console.error('Erro ao copiar conta entre empresas:', err)
      }
    }

    onProgress?.({
      fase: 'Finalizando processo de cópia...',
      atual: totalItens,
      total: totalItens,
      percentual: 100,
    })

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
