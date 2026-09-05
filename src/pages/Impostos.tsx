import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { useFilter } from '@/contexts/FilterContext'
import {
  configuracoesTributariasService,
  produtosService,
  materiasPrimasService,
  fichasTecnicasService,
} from '@/services/formacaoPrecoService'
import { dreService } from '@/services/financeService'
import {
  ConfiguracaoTributariaRecord,
  ConfiguracaoTributariaInput,
  RegimeTributarioFormacaoPreco,
  ProdutoRecord,
  FichaTecnicaRecord,
  MateriaPrimaRecord,
  DreRecord,
} from '@/types/finance'
import {
  gerarComparativoRegimesPreco,
  gerarMatrizSensibilidade,
  simularEnquadramentoPorRbt12,
  calcularPrecoPorDentro,
  calcularTributosMateriaPrima,
  type ComparativoRegimesPrecoItem,
  type MatrizSensibilidadeItem,
  type SimulacaoEnquadramentoRbt12,
} from '@/lib/taxCalculations'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useToast } from '@/hooks/use-toast'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Percent,
  Calculator,
  Building2,
  Save,
  RotateCcw,
  Sparkles,
  Info,
  ArrowRight,
  TrendingUp,
  DollarSign,
  Layers,
  HelpCircle,
  CheckCircle2,
  AlertTriangle,
  Receipt,
  FileSpreadsheet,
  Grid3X3,
  Scale,
  Activity,
  Award,
  Download,
  AlertCircle,
  CheckCircle,
  BarChart3,
  FileText,
  Printer,
  GitCompare,
  ArrowUpDown,
  ShieldCheck,
} from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Cell,
  Legend,
} from 'recharts'
import { ModalPdfImpostos } from '@/components/ModalPdfImpostos'

export default function Impostos() {
  const { toast } = useToast()
  const { empresas, selectedEmpresaId, setSelectedEmpresaId, selectedEmpresa, selectedAno } =
    useFilter()

  const [activeTab, setActiveTab] = useState<string>('configuracao')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [existingConfig, setExistingConfig] = useState<ConfiguracaoTributariaRecord | null>(null)
  const [dresEmpresa, setDresEmpresa] = useState<DreRecord[]>([])

  // Form states de Configuração
  const [regime, setRegime] = useState<RegimeTributarioFormacaoPreco>('Simples Nacional')
  const [aliquotaSimples, setAliquotaSimples] = useState<number>(6.0)
  const [anexoSimples, setAnexoSimples] = useState<string>('Anexo I - Comércio')
  const [faixaSimples, setFaixaSimples] = useState<string>('1ª Faixa (até R$ 180.000,00)')

  // Lucro Real / Presumido
  const [aliquotaPis, setAliquotaPis] = useState<number>(0.65)
  const [aliquotaCofins, setAliquotaCofins] = useState<number>(3.0)
  const [aliquotaIcms, setAliquotaIcms] = useState<number>(18.0)
  const [aliquotaIpi, setAliquotaIpi] = useState<number>(0.0)
  const [aliquotaIss, setAliquotaIss] = useState<number>(0.0)
  const [aliquotaIrpj, setAliquotaIrpj] = useState<number>(1.2)
  const [aliquotaCsll, setAliquotaCsll] = useState<number>(1.08)
  const [outrosImpostos, setOutrosImpostos] = useState<number>(0.0)
  const [observacoes, setObservacoes] = useState<string>('')

  // Simulador de Preço e Dados Base
  const [produtos, setProdutos] = useState<ProdutoRecord[]>([])
  const [fichas, setFichas] = useState<FichaTecnicaRecord[]>([])
  const [materiasPrimas, setMateriasPrimas] = useState<MateriaPrimaRecord[]>([])
  const [selectedProdutoId, setSelectedProdutoId] = useState<string>('custom')
  const [volumeProjetadoSimulacao, setVolumeProjetadoSimulacao] = useState<number | ''>('')
  const [custoBaseSimulacao, setCustoBaseSimulacao] = useState<number>(50.0)
  const [margemDesejadaSimulacao, setMargemDesejadaSimulacao] = useState<number>(30.0)
  const [despesasVariaveisSimulacao, setDespesasVariaveisSimulacao] = useState<number>(0.0)

  // Estados específicos para Análise de Sensibilidade
  const [passoCargaSensibilidade, setPassoCargaSensibilidade] = useState<number>(3) // ex: +/- 3%
  const [passoMargemSensibilidade, setPassoMargemSensibilidade] = useState<number>(5) // ex: +/- 5%

  // Estados para o Modal de Exportação PDF Executivo
  const [pdfModalOpen, setPdfModalOpen] = useState(false)
  const [pdfTipo, setPdfTipo] = useState<'comparativo_regimes' | 'enquadramento_rbt12'>(
    'comparativo_regimes',
  )

  // Estados para Comparativo de Carga Tributária entre 2 Empresas
  const [empresaCompAId, setEmpresaCompAId] = useState<string>('')
  const [empresaCompBId, setEmpresaCompBId] = useState<string>('')
  const [configEmpresaCompA, setConfigEmpresaCompA] = useState<ConfiguracaoTributariaRecord | null>(
    null,
  )
  const [configEmpresaCompB, setConfigEmpresaCompB] = useState<ConfiguracaoTributariaRecord | null>(
    null,
  )
  const [loadingCompEmpresas, setLoadingCompEmpresas] = useState(false)

  // Empresa atual selecionada
  const empresaAtual = useMemo(() => {
    return empresas.find((e) => e.id === selectedEmpresaId) || selectedEmpresa || null
  }, [empresas, selectedEmpresaId, selectedEmpresa])

  // Carrega configurações tributárias da empresa selecionada e DREs
  const carregarConfiguracaoEDre = useCallback(
    async (empresaId: string) => {
      if (!empresaId) return
      setLoading(true)
      try {
        const [config, listaDre] = await Promise.all([
          configuracoesTributariasService.getByEmpresa(empresaId),
          dreService.getByEmpresa(empresaId),
        ])

        setDresEmpresa(listaDre || [])

        if (config) {
          setExistingConfig(config)
          setRegime(config.regime_tributario || 'Simples Nacional')
          setAliquotaSimples(config.aliquota_simples_efetiva ?? 6.0)
          setAnexoSimples(config.anexo_simples || 'Anexo I - Comércio')
          setFaixaSimples(config.faixa_simples || '1ª Faixa (até R$ 180.000,00)')
          setAliquotaPis(config.aliquota_pis ?? 0.65)
          setAliquotaCofins(config.aliquota_cofins ?? 3.0)
          setAliquotaIcms(config.aliquota_icms ?? 18.0)
          setAliquotaIpi(config.aliquota_ipi ?? 0.0)
          setAliquotaIss(config.aliquota_iss ?? 0.0)
          setAliquotaIrpj(config.aliquota_irpj ?? 1.2)
          setAliquotaCsll(config.aliquota_csll ?? 1.08)
          setOutrosImpostos(config.outros_impostos ?? 0.0)
          setObservacoes(config.observacoes || '')
        } else {
          setExistingConfig(null)
          setRegime('Simples Nacional')
          setAliquotaSimples(6.0)
          setAnexoSimples('Anexo I - Comércio')
          setFaixaSimples('1ª Faixa (até R$ 180.000,00)')
          setAliquotaPis(0.65)
          setAliquotaCofins(3.0)
          setAliquotaIcms(18.0)
          setAliquotaIpi(0.0)
          setAliquotaIss(0.0)
          setAliquotaIrpj(1.2)
          setAliquotaCsll(1.08)
          setOutrosImpostos(0.0)
          setObservacoes('')
        }
      } catch (err) {
        console.error('Erro ao carregar dados de impostos e DRE:', err)
        toast({
          title: 'Erro ao carregar dados',
          description: 'Não foi possível carregar as configurações de impostos da empresa.',
          variant: 'destructive',
        })
      } finally {
        setLoading(false)
      }
    },
    [toast],
  )

  // Carregar produtos, matérias-primas e fichas para o simulador
  const carregarProdutosEFichas = useCallback(async (empresaId?: string) => {
    try {
      const [listaProd, listaFichas, listaMaterias] = await Promise.all([
        produtosService.getAll(empresaId),
        fichasTecnicasService.getAll(empresaId),
        materiasPrimasService.getAll(empresaId),
      ])
      setProdutos(listaProd)
      setFichas(listaFichas)
      setMateriasPrimas(listaMaterias)
    } catch (err) {
      console.error('Erro ao carregar produtos/fichas/matérias:', err)
    }
  }, [])

  useEffect(() => {
    if (selectedEmpresaId) {
      carregarConfiguracaoEDre(selectedEmpresaId)
      carregarProdutosEFichas(selectedEmpresaId)
    }
  }, [selectedEmpresaId, carregarConfiguracaoEDre, carregarProdutosEFichas])

  // Inicializar seleção das duas empresas para comparação
  useEffect(() => {
    if (empresas.length >= 2) {
      if (!empresaCompAId || !empresas.some((e) => e.id === empresaCompAId)) {
        setEmpresaCompAId(selectedEmpresaId || empresas[0]?.id || '')
      }
      if (!empresaCompBId || !empresas.some((e) => e.id === empresaCompBId)) {
        const outra = empresas.find((e) => e.id !== (selectedEmpresaId || empresas[0]?.id))
        setEmpresaCompBId(outra?.id || empresas[1]?.id || '')
      }
    } else if (empresas.length === 1) {
      setEmpresaCompAId(empresas[0]?.id || '')
      setEmpresaCompBId('')
    }
  }, [empresas, selectedEmpresaId])

  // Carregar dados tributários das duas empresas selecionadas
  useEffect(() => {
    async function loadCompEmpresas() {
      if (!empresaCompAId && !empresaCompBId) return
      setLoadingCompEmpresas(true)
      try {
        const [cfgA, cfgB] = await Promise.all([
          empresaCompAId
            ? configuracoesTributariasService.getByEmpresa(empresaCompAId)
            : Promise.resolve(null),
          empresaCompBId
            ? configuracoesTributariasService.getByEmpresa(empresaCompBId)
            : Promise.resolve(null),
        ])
        setConfigEmpresaCompA(cfgA)
        setConfigEmpresaCompB(cfgB)
      } catch (err) {
        console.error('Erro ao carregar comparação entre empresas:', err)
      } finally {
        setLoadingCompEmpresas(false)
      }
    }
    loadCompEmpresas()
  }, [empresaCompAId, empresaCompBId])

  // Cálculos do comparativo entre 2 empresas
  const comparativoDuasEmpresas = useMemo(() => {
    const empA = empresas.find((e) => e.id === empresaCompAId) || null
    const empB = empresas.find((e) => e.id === empresaCompBId) || null

    const hasConfigA = Boolean(configEmpresaCompA)
    const hasConfigB = Boolean(configEmpresaCompB)

    const cargaA = hasConfigA ? Number(configEmpresaCompA?.carga_tributaria_total) || 0 : 0
    const cargaB = hasConfigB ? Number(configEmpresaCompB?.carga_tributaria_total) || 0 : 0

    const regimeA = hasConfigA
      ? configEmpresaCompA?.regime_tributario || 'Não configurado'
      : 'Sem configuração'
    const regimeB = hasConfigB
      ? configEmpresaCompB?.regime_tributario || 'Não configurado'
      : 'Sem configuração'

    const fatorA = cargaA < 100 ? Number((1 / Math.max(0.01, 1 - cargaA / 100)).toFixed(4)) : 1
    const fatorB = cargaB < 100 ? Number((1 / Math.max(0.01, 1 - cargaB / 100)).toFixed(4)) : 1

    const precoCalcA = calcularPrecoPorDentro(
      custoBaseSimulacao,
      margemDesejadaSimulacao,
      cargaA,
      despesasVariaveisSimulacao,
    )
    const precoCalcB = calcularPrecoPorDentro(
      custoBaseSimulacao,
      margemDesejadaSimulacao,
      cargaB,
      despesasVariaveisSimulacao,
    )

    const precoA = precoCalcA.precoFinal
    const precoB = precoCalcB.precoFinal

    const diffCarga = cargaB - cargaA // B vs A
    const diffPreco = precoB - precoA // B vs A

    let maisEconomica: 'A' | 'B' | 'iguais' = 'iguais'
    if (hasConfigA && hasConfigB) {
      if (cargaA < cargaB) maisEconomica = 'A'
      else if (cargaB < cargaA) maisEconomica = 'B'
      else maisEconomica = 'iguais'
    } else if (hasConfigA && !hasConfigB) {
      maisEconomica = 'A'
    } else if (!hasConfigA && hasConfigB) {
      maisEconomica = 'B'
    }

    const economiaRs = Math.abs(diffPreco)
    const economiaPctCarga = Math.abs(diffCarga)
    const maiorPreco = Math.max(precoA, precoB)
    const pctEconomiaPreco = maiorPreco > 0 ? (economiaRs / maiorPreco) * 100 : 0

    const nomeA = empA?.razao_social || empA?.nome_fantasia || empA?.nome || 'Empresa A'
    const nomeB = empB?.razao_social || empB?.nome_fantasia || empB?.nome || 'Empresa B'

    return {
      empA,
      empB,
      nomeA,
      nomeB,
      hasConfigA,
      hasConfigB,
      configA: configEmpresaCompA,
      configB: configEmpresaCompB,
      cargaA: Number(cargaA) || 0,
      cargaB: Number(cargaB) || 0,
      regimeA,
      regimeB,
      fatorA: Number(fatorA) || 1,
      fatorB: Number(fatorB) || 1,
      precoA: Number(precoA) || 0,
      precoB: Number(precoB) || 0,
      impostosA: Number(precoCalcA.valorImpostos) || 0,
      impostosB: Number(precoCalcB.valorImpostos) || 0,
      margemA: Number(precoCalcA.valorMargem) || 0,
      margemB: Number(precoCalcB.valorMargem) || 0,
      diffCarga: Number(diffCarga) || 0,
      diffPreco: Number(diffPreco) || 0,
      maisEconomica,
      economiaRs: Number(economiaRs) || 0,
      economiaPctCarga: Number(economiaPctCarga) || 0,
      pctEconomiaPreco: Number(pctEconomiaPreco) || 0,
    }
  }, [
    empresas,
    empresaCompAId,
    empresaCompBId,
    configEmpresaCompA,
    configEmpresaCompB,
    custoBaseSimulacao,
    margemDesejadaSimulacao,
    despesasVariaveisSimulacao,
  ])

  // Ao mudar o regime para preset comum
  const aplicarPresetRegime = (novoRegime: RegimeTributarioFormacaoPreco) => {
    setRegime(novoRegime)
    if (novoRegime === 'Simples Nacional') {
      setAliquotaSimples(6.0)
      setAnexoSimples('Anexo I - Comércio')
      setFaixaSimples('1ª Faixa (até R$ 180.000,00)')
    } else if (novoRegime === 'Lucro Presumido') {
      setAliquotaPis(0.65)
      setAliquotaCofins(3.0)
      setAliquotaIcms(18.0)
      setAliquotaIpi(0.0)
      setAliquotaIss(0.0)
      setAliquotaIrpj(1.2)
      setAliquotaCsll(1.08)
      setOutrosImpostos(0.0)
    } else if (novoRegime === 'Lucro Real') {
      setAliquotaPis(1.65)
      setAliquotaCofins(7.6)
      setAliquotaIcms(18.0)
      setAliquotaIpi(0.0)
      setAliquotaIss(0.0)
      setAliquotaIrpj(0.0)
      setAliquotaCsll(0.0)
      setOutrosImpostos(0.0)
    }
  }

  // Carga tributária total calculada
  const cargaTributariaTotal = useMemo(() => {
    if (regime === 'Simples Nacional') {
      return Number((aliquotaSimples || 0).toFixed(4))
    }
    const soma =
      (aliquotaPis || 0) +
      (aliquotaCofins || 0) +
      (aliquotaIcms || 0) +
      (aliquotaIpi || 0) +
      (aliquotaIss || 0) +
      (aliquotaIrpj || 0) +
      (aliquotaCsll || 0) +
      (outrosImpostos || 0)
    return Number(soma.toFixed(4))
  }, [
    regime,
    aliquotaSimples,
    aliquotaPis,
    aliquotaCofins,
    aliquotaIcms,
    aliquotaIpi,
    aliquotaIss,
    aliquotaIrpj,
    aliquotaCsll,
    outrosImpostos,
  ])

  // Fator "por dentro" = 1 / (1 - carga/100)
  const fatorPorDentro = useMemo(() => {
    const cargaDec = cargaTributariaTotal / 100
    if (cargaDec >= 1) return 1
    return Number((1 / (1 - cargaDec)).toFixed(4))
  }, [cargaTributariaTotal])

  const percentualEmbutido = useMemo(() => {
    if (fatorPorDentro <= 1) return 0
    return Number(((fatorPorDentro - 1) * 100).toFixed(2))
  }, [fatorPorDentro])

  // Mapa de Matérias Primas para consulta rápida
  const materiasMap = useMemo(() => {
    const map = new Map<string, MateriaPrimaRecord>()
    for (const m of materiasPrimas) {
      map.set(m.id, m)
    }
    return map
  }, [materiasPrimas])

  // Produto selecionado no simulador (com ficha técnica ou não)
  const produtoSelecionadoSimulador = useMemo(() => {
    if (selectedProdutoId === 'custom') return null
    return produtos.find((p) => p.id === selectedProdutoId) || null
  }, [selectedProdutoId, produtos])

  // Validador de Capacidade de Produção vs Volume Projetado
  const alertaCapacidadeSimulador = useMemo(() => {
    if (!produtoSelecionadoSimulador) return null
    const cap = Number(produtoSelecionadoSimulador.capacidade_producao)
    if (isNaN(cap) || cap <= 0) return null

    const vol = typeof volumeProjetadoSimulacao === 'number' ? volumeProjetadoSimulacao : 0
    if (vol > cap) {
      return {
        volumeProjetado: vol,
        capacidade: cap,
        unidade: produtoSelecionadoSimulador.unidade || 'un',
        mensagem: `Atenção: o volume projetado de ${vol.toLocaleString('pt-BR')} ${produtoSelecionadoSimulador.unidade || 'un'} excede a capacidade de produção cadastrada (${cap.toLocaleString('pt-BR')} ${produtoSelecionadoSimulador.unidade || 'un'}). Revise o volume ou planeje expansão de capacidade.`,
      }
    }
    return null
  }, [produtoSelecionadoSimulador, volumeProjetadoSimulacao])

  // Detalhamento de Custo dos Insumos da Ficha do Produto Selecionado
  const detalhesProdutoSimulado = useMemo(() => {
    if (selectedProdutoId === 'custom') return null
    const prod = produtos.find((p) => p.id === selectedProdutoId)
    const ficha = fichas.find((f) => f.produto === selectedProdutoId)
    if (!ficha) return null

    let custoMPBruto = 0
    let creditosTotais = 0
    let acrescimosTotais = 0
    let custoMPLiquido = 0
    let valorIpi = 0
    let valorFrete = 0
    let valorPerdas = 0
    let creditoIcms = 0
    let creditoPis = 0
    let creditoCofins = 0

    if (ficha.itens && Array.isArray(ficha.itens)) {
      for (const it of ficha.itens) {
        const mp = materiasMap.get(it.materia_prima_id)
        const qtd = Number(it.quantidade) || 0
        const unitBruto = Number(it.custo_unitario) || mp?.custo_unitario || 0
        const subtotalBruto = qtd * unitBruto

        const isIsenta = Boolean(
          it.isenta_st ??
          (mp?.isenta_st ||
            mp?.tipo_tributacao === 'isenta' ||
            mp?.tipo_tributacao === 'substituicao_tributaria'),
        )
        const icms = isIsenta ? 0 : Number(it.icms_percentual ?? mp?.icms_percentual ?? 0)
        const pis = isIsenta ? 0 : Number(it.pis_percentual ?? mp?.pis_percentual ?? 0)
        const cofins = isIsenta ? 0 : Number(it.cofins_percentual ?? mp?.cofins_percentual ?? 0)
        const ipi = Number(it.ipi_percentual ?? mp?.ipi_percentual ?? 0)
        const frete = Number(it.frete_percentual ?? mp?.frete_percentual ?? 0)
        const perdas = Number(it.perdas_percentual ?? mp?.perdas_percentual ?? 0)

        const trib = calcularTributosMateriaPrima(
          unitBruto,
          icms,
          pis,
          cofins,
          isIsenta,
          mp?.tipo_tributacao,
          ipi,
          frete,
          perdas,
        )

        custoMPBruto += subtotalBruto
        creditosTotais += qtd * trib.totalCreditos
        acrescimosTotais += qtd * trib.totalAcrescimos
        custoMPLiquido += qtd * trib.custoLiquido

        creditoIcms += qtd * trib.creditoIcms
        creditoPis += qtd * trib.creditoPis
        creditoCofins += qtd * trib.creditoCofins
        valorIpi += qtd * trib.valorIpi
        valorFrete += qtd * trib.valorFrete
        valorPerdas += qtd * trib.valorPerdas
      }
    }

    const outrosCustos = Number(ficha.outros_custos) || 0
    const custoTotalBruto =
      (custoMPBruto > 0 ? custoMPBruto : Number(ficha.custo_materia_prima) || 0) + outrosCustos
    const custoTotalLiquido =
      custoMPLiquido > 0
        ? custoMPLiquido + outrosCustos
        : Number(ficha.custo_total_liquido) || Number(ficha.custo_total) || 0

    return {
      prod,
      ficha,
      custoMPBruto: custoMPBruto > 0 ? custoMPBruto : Number(ficha.custo_materia_prima) || 0,
      creditosTotais:
        creditosTotais > 0 ? creditosTotais : Number(ficha.creditos_tributarios_totais) || 0,
      acrescimosTotais,
      custoMPLiquido:
        custoMPLiquido > 0
          ? custoMPLiquido
          : Math.max(0, custoMPBruto - creditosTotais + acrescimosTotais),
      outrosCustos,
      custoTotalBruto,
      custoTotalLiquido,
      creditoIcms,
      creditoPis,
      creditoCofins,
      valorIpi,
      valorFrete,
      valorPerdas,
      itensCount: ficha.itens?.length || 0,
    }
  }, [selectedProdutoId, produtos, fichas, materiasMap])

  // Atualização do produto selecionado no simulador
  const handleSelectProduto = (prodId: string) => {
    setSelectedProdutoId(prodId)
    if (prodId === 'custom') {
      setVolumeProjetadoSimulacao('')
      return
    }
    const prod = produtos.find((p) => p.id === prodId)
    if (!prod) return

    if (
      prod.quantidade_vendida !== undefined &&
      prod.quantidade_vendida !== null &&
      prod.quantidade_vendida > 0
    ) {
      setVolumeProjetadoSimulacao(Number(prod.quantidade_vendida))
    } else {
      setVolumeProjetadoSimulacao('')
    }

    const ficha = fichas.find((f) => f.produto === prodId)
    if (ficha) {
      // Calcular custo líquido apurado considerando IPI, Frete, Perdas e Créditos
      let custoLiquidoCalculado = 0
      if (ficha.itens && Array.isArray(ficha.itens) && ficha.itens.length > 0) {
        for (const it of ficha.itens) {
          const mp = materiasMap.get(it.materia_prima_id)
          const qtd = Number(it.quantidade) || 0
          const unitBruto = Number(it.custo_unitario) || mp?.custo_unitario || 0

          const isIsenta = Boolean(
            it.isenta_st ??
            (mp?.isenta_st ||
              mp?.tipo_tributacao === 'isenta' ||
              mp?.tipo_tributacao === 'substituicao_tributaria'),
          )
          const icms = isIsenta ? 0 : Number(it.icms_percentual ?? mp?.icms_percentual ?? 0)
          const pis = isIsenta ? 0 : Number(it.pis_percentual ?? mp?.pis_percentual ?? 0)
          const cofins = isIsenta ? 0 : Number(it.cofins_percentual ?? mp?.cofins_percentual ?? 0)
          const ipi = Number(it.ipi_percentual ?? mp?.ipi_percentual ?? 0)
          const frete = Number(it.frete_percentual ?? mp?.frete_percentual ?? 0)
          const perdas = Number(it.perdas_percentual ?? mp?.perdas_percentual ?? 0)

          const trib = calcularTributosMateriaPrima(
            unitBruto,
            icms,
            pis,
            cofins,
            isIsenta,
            mp?.tipo_tributacao,
            ipi,
            frete,
            perdas,
          )
          custoLiquidoCalculado += qtd * trib.custoLiquido
        }
        custoLiquidoCalculado += Number(ficha.outros_custos) || 0
      }

      const custoFinal =
        custoLiquidoCalculado > 0
          ? custoLiquidoCalculado
          : Number(ficha.custo_total_liquido) || Number(ficha.custo_total) || 0

      setCustoBaseSimulacao(Number(custoFinal.toFixed(2)))
      setMargemDesejadaSimulacao(ficha.margem_desejada || prod.margem_desejada || 30)
    } else if (prod.custo && prod.custo > 0) {
      setCustoBaseSimulacao(prod.custo)
      setMargemDesejadaSimulacao(prod.margem_desejada || 30)
    }
  }

  // Cálculos do simulador de formação de preço atual
  const simulacao = useMemo(() => {
    return calcularPrecoPorDentro(
      custoBaseSimulacao,
      margemDesejadaSimulacao,
      cargaTributariaTotal,
      despesasVariaveisSimulacao,
    )
  }, [
    custoBaseSimulacao,
    margemDesejadaSimulacao,
    cargaTributariaTotal,
    despesasVariaveisSimulacao,
  ])

  const precoSemImposto = useMemo(() => {
    const m = Number(margemDesejadaSimulacao) || 0
    const d = Number(despesasVariaveisSimulacao) || 0
    const divisor = Math.max(0.01, 1 - (m + d) / 100)
    return custoBaseSimulacao > 0 ? custoBaseSimulacao / divisor : 0
  }, [custoBaseSimulacao, margemDesejadaSimulacao, despesasVariaveisSimulacao])

  // =========================================================================
  // 1. MELHORIA: COMPARATIVO DOS 3 REGIMES TRIBUTÁRIOS LADO A LADO
  // =========================================================================
  const comparativoRegimes = useMemo(() => {
    return gerarComparativoRegimesPreco({
      custo: custoBaseSimulacao,
      margemDesejada: margemDesejadaSimulacao,
      despesasVariaveis: despesasVariaveisSimulacao,
      regimeAtualConfigurado: regime,
      aliquotaSimplesConfigurada: aliquotaSimples,
      anexoSimples,
      aliquotaPisConfigurada: aliquotaPis,
      aliquotaCofinsConfigurada: aliquotaCofins,
      aliquotaIcmsConfigurada: aliquotaIcms,
      aliquotaIpiConfigurada: aliquotaIpi,
      aliquotaIssConfigurada: aliquotaIss,
      aliquotaIrpjConfigurada: aliquotaIrpj,
      aliquotaCsllConfigurada: aliquotaCsll,
      outrosImpostosConfigurados: outrosImpostos,
    })
  }, [
    custoBaseSimulacao,
    margemDesejadaSimulacao,
    despesasVariaveisSimulacao,
    regime,
    aliquotaSimples,
    anexoSimples,
    aliquotaPis,
    aliquotaCofins,
    aliquotaIcms,
    aliquotaIpi,
    aliquotaIss,
    aliquotaIrpj,
    aliquotaCsll,
    outrosImpostos,
  ])

  const menorCargaRegime = useMemo(() => {
    return comparativoRegimes.find((r) => r.isMenorCarga) || comparativoRegimes[0]
  }, [comparativoRegimes])

  const maiorCargaRegime = useMemo(() => {
    return [...comparativoRegimes].sort(
      (a, b) => b.cargaTributariaTotal - a.cargaTributariaTotal,
    )[0]
  }, [comparativoRegimes])

  const diferencaMaxPreco = useMemo(() => {
    if (!maiorCargaRegime || !menorCargaRegime) return 0
    return Number(
      (maiorCargaRegime.precoVendaSugerido - menorCargaRegime.precoVendaSugerido).toFixed(2),
    )
  }, [maiorCargaRegime, menorCargaRegime])

  // Dados para Gráfico Recharts do Comparativo
  const dadosGraficoComparativo = useMemo(() => {
    return comparativoRegimes.map((item) => ({
      regime: item.regime,
      precoFinal: item.precoVendaSugerido,
      cargaTrib: item.cargaTributariaTotal,
      impostosNoPreco: item.valorImpostosPreco,
      custo: item.valorCustoPreco,
      margem: item.valorMargemPreco,
      isMenorCarga: item.isMenorCarga,
      isAtual: item.isRegimeAtual,
    }))
  }, [comparativoRegimes])

  // =========================================================================
  // 2. MELHORIA: ANÁLISE DE SENSIBILIDADE DE PREÇO (CARGA % × MARGEM %)
  // =========================================================================
  const cargasSensibilidade = useMemo(() => {
    const base = cargaTributariaTotal || 10
    const passo = passoCargaSensibilidade || 3
    const valores = [
      Math.max(0, Number((base - 2 * passo).toFixed(2))),
      Math.max(0, Number((base - passo).toFixed(2))),
      Number(base.toFixed(2)),
      Number((base + passo).toFixed(2)),
      Number((base + 2 * passo).toFixed(2)),
    ]
    // Remover duplicados se base for muito baixa
    return Array.from(new Set(valores)).sort((a, b) => a - b)
  }, [cargaTributariaTotal, passoCargaSensibilidade])

  const margensSensibilidade = useMemo(() => {
    const base = margemDesejadaSimulacao || 30
    const passo = passoMargemSensibilidade || 5
    const valores = [
      Math.max(5, Number((base - 2 * passo).toFixed(1))),
      Math.max(5, Number((base - passo).toFixed(1))),
      Number(base.toFixed(1)),
      Number((base + passo).toFixed(1)),
      Number((base + 2 * passo).toFixed(1)),
    ]
    return Array.from(new Set(valores)).sort((a, b) => a - b)
  }, [margemDesejadaSimulacao, passoMargemSensibilidade])

  const matrizSensibilidade = useMemo(() => {
    return gerarMatrizSensibilidade({
      custo: custoBaseSimulacao,
      cargasVariadas: cargasSensibilidade,
      margensVariadas: margensSensibilidade,
      despesasVariaveis: despesasVariaveisSimulacao,
      cargaAtual: Number(cargaTributariaTotal.toFixed(2)),
      margemAtual: Number(margemDesejadaSimulacao.toFixed(1)),
    })
  }, [
    custoBaseSimulacao,
    cargasSensibilidade,
    margensSensibilidade,
    despesasVariaveisSimulacao,
    cargaTributariaTotal,
    margemDesejadaSimulacao,
  ])

  // =========================================================================
  // 3. MELHORIA: SIMULAÇÃO DE ENQUADRAMENTO COM BASE NO RBT12 DO DRE
  // =========================================================================
  const simulacaoRbt12: SimulacaoEnquadramentoRbt12 = useMemo(() => {
    return simularEnquadramentoPorRbt12({
      dres: dresEmpresa,
      anexoSimples,
      margemLucroEstimada: margemDesejadaSimulacao,
    })
  }, [dresEmpresa, anexoSimples, margemDesejadaSimulacao])

  // Salvar configuração
  const handleSalvar = async () => {
    if (!selectedEmpresaId) {
      toast({
        title: 'Selecione uma empresa',
        description: 'É necessário selecionar uma empresa para salvar a configuração de impostos.',
        variant: 'destructive',
      })
      return
    }

    if (cargaTributariaTotal >= 100) {
      toast({
        title: 'Carga tributária inválida',
        description: 'A soma dos impostos não pode ser igual ou superior a 100%.',
        variant: 'destructive',
      })
      return
    }

    setSaving(true)
    try {
      const payload: ConfiguracaoTributariaInput = {
        empresa: selectedEmpresaId,
        regime_tributario: regime,
        aliquota_simples_efetiva: regime === 'Simples Nacional' ? aliquotaSimples : undefined,
        anexo_simples: regime === 'Simples Nacional' ? anexoSimples : undefined,
        faixa_simples: regime === 'Simples Nacional' ? faixaSimples : undefined,
        aliquota_pis: regime !== 'Simples Nacional' ? aliquotaPis : 0,
        aliquota_cofins: regime !== 'Simples Nacional' ? aliquotaCofins : 0,
        aliquota_icms: regime !== 'Simples Nacional' ? aliquotaIcms : 0,
        aliquota_ipi: regime !== 'Simples Nacional' ? aliquotaIpi : 0,
        aliquota_iss: regime !== 'Simples Nacional' ? aliquotaIss : 0,
        aliquota_irpj: regime !== 'Simples Nacional' ? aliquotaIrpj : 0,
        aliquota_csll: regime !== 'Simples Nacional' ? aliquotaCsll : 0,
        outros_impostos: regime !== 'Simples Nacional' ? outrosImpostos : 0,
        carga_tributaria_total: cargaTributariaTotal,
        fator_por_dentro: fatorPorDentro,
        observacoes: observacoes.trim(),
      }

      const saved = await configuracoesTributariasService.saveOrUpdate(payload)
      setExistingConfig(saved)

      toast({
        title: 'Configurações de Impostos Salvas!',
        description: `Configuração para ${empresaAtual?.razao_social || empresaAtual?.nome || 'a empresa'} atualizada com sucesso (${regime} - ${cargaTributariaTotal}%).`,
      })
    } catch (err) {
      console.error('Erro ao salvar configuração tributária:', err)
      toast({
        title: 'Erro ao salvar',
        description: 'Não foi possível salvar as configurações tributárias. Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  // Exportar Relatório Comparativo / Sensibilidade em CSV
  const handleExportCsv = () => {
    const nomeEmp = empresaAtual?.razao_social || empresaAtual?.nome || 'Empresa'
    let csv = '\uFEFF'
    csv += `RELATÓRIO DE TRIBUTAÇÃO E FORMAÇÃO DE PREÇO\n`
    csv += `Empresa;${nomeEmp}\n`
    csv += `Regime Configurado;${regime}\n`
    csv += `Carga Tributária Total;${cargaTributariaTotal}%\n`
    csv += `Custo Base Simulado;R$ ${custoBaseSimulacao.toFixed(2)}\n`
    csv += `Margem Desejada;${margemDesejadaSimulacao}%\n`
    csv += `Data de Emissão;${new Date().toLocaleDateString('pt-BR')}\n\n`

    csv += `1. COMPARATIVO DOS REGIMES TRIBUTÁRIOS (LADO A LADO)\n`
    csv += `Regime;Carga Trib (%);Fator Gross-up;Preço Sugerido (R$);Impostos no Preço (R$);Margem Líquida (R$);Markup;Menor Carga?\n`
    comparativoRegimes.forEach((r) => {
      csv += `${r.regime};${r.cargaTributariaTotal.toFixed(2)}%;${r.fatorPorDentro.toFixed(4)};R$ ${r.precoVendaSugerido.toFixed(2)};R$ ${r.valorImpostosPreco.toFixed(2)};R$ ${r.valorMargemPreco.toFixed(2)};${r.markupMultiplicador.toFixed(2)}x;${r.isMenorCarga ? 'SIM (Menor Carga)' : 'Não'}\n`
    })
    csv += `\n`

    csv += `2. ENQUADRAMENTO FISCAL RBT12 (DRE ÚLTIMOS 12 MESES)\n`
    csv += `Receita Bruta Acumulada 12M;${simulacaoRbt12.rbt12Formatado}\n`
    csv += `Período Analisado;${simulacaoRbt12.periodoDescricao}\n`
    csv += `Teto Simples Nacional;R$ 4.800.000,00 (${simulacaoRbt12.percentualTetoSimples}% consumido)\n`
    csv += `Sublimite Estadual (ICMS/ISS);R$ 3.600.000,00\n`
    csv += `Faixa Simples Sugerida;${simulacaoRbt12.faixaSugeridaSimples}\n`
    csv += `Alíquota Efetiva DAS Estimada;${simulacaoRbt12.aliquotaEfetivaSimples}%\n`
    csv += `Regime Recomendado;${simulacaoRbt12.regimeRecomendado}\n`
    csv += `Parecer Técnico;${simulacaoRbt12.motivoRecomendacao}\n\n`

    csv += `3. MATRIZ DE SENSIBILIDADE DE PREÇO DE VENDA (Carga Trib % × Margem %)\n`
    csv += `Carga Trib (%);` + margensSensibilidade.map((m) => `Margem ${m}%`).join(';') + `\n`
    matrizSensibilidade.forEach((linha) => {
      const carga = linha[0].cargaTributaria
      const valoresLinha = linha.map((it) => `R$ ${it.precoFinal.toFixed(2)}`).join(';')
      csv += `${carga.toFixed(1)}%;${valoresLinha}\n`
    })

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.setAttribute(
      'download',
      `tributacao_formacao_preco_${nomeEmp.toLowerCase().replace(/\s+/g, '_')}.csv`,
    )
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    toast({
      title: 'Exportação Concluída',
      description: 'O relatório completo de impostos e preços foi exportado com sucesso.',
    })
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Header com Seletor de Empresa e Ações Rápidas */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
              <Percent className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
                Impostos & Tributação no Preço de Venda
                <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                  Formação de Preço
                </Badge>
              </h1>
              <p className="text-xs text-slate-500">
                Configure alíquotas por empresa, compare os 3 regimes tributários lado a lado,
                avalie a sensibilidade de margem e simule o enquadramento pelo faturamento do DRE.
              </p>
            </div>
          </div>
        </div>

        {/* Seletor de Empresa e Exportar CSV */}
        <div className="flex items-center gap-3 shrink-0 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCsv}
            className="text-xs h-9 border-slate-300 text-slate-700 hover:bg-slate-50 shadow-xs"
          >
            <Download className="w-3.5 h-3.5 mr-1.5 text-slate-600" />
            Exportar CSV
          </Button>

          <div className="flex items-center gap-2">
            <Select
              value={selectedEmpresaId}
              onValueChange={(val) => {
                setSelectedEmpresaId(val)
              }}
            >
              <SelectTrigger className="w-[230px] bg-slate-50 border-slate-300 font-medium text-slate-800 text-xs h-9">
                <Building2 className="w-3.5 h-3.5 mr-1.5 text-slate-500 shrink-0" />
                <SelectValue placeholder="Selecione a empresa" />
              </SelectTrigger>
              <SelectContent>
                {empresas.map((emp) => (
                  <SelectItem key={emp.id} value={emp.id} className="text-xs">
                    {emp.razao_social || emp.nome_fantasia || emp.nome || 'Sem Nome'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Cards de Métricas Principais */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-white border-slate-200/80 shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500">Regime Vigente</p>
              <h3 className="text-lg font-bold text-slate-900 mt-1">{regime}</h3>
              <span className="text-[11px] text-slate-500">
                {regime === 'Simples Nacional'
                  ? anexoSimples.split(' - ')[0]
                  : 'Tributação por dentro'}
              </span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              <Receipt className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-slate-200/80 shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500">Carga Tributária Vigente</p>
              <h3 className="text-2xl font-bold text-amber-600 mt-0.5">
                {cargaTributariaTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}%
              </h3>
              <span className="text-[11px] text-slate-500">Soma das alíquotas incidentes</span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Percent className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-slate-200/80 shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-1">
                <p className="text-xs font-medium text-slate-500">Fator "Por Dentro" (Gross-up)</p>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs text-xs">
                      Fator de gross-up para recomposição da base tributária: 1 / (1 - Carga%).
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <h3 className="text-2xl font-bold text-indigo-600 mt-0.5">
                {fatorPorDentro.toFixed(4)}
              </h3>
              <span className="text-[11px] text-emerald-600 font-medium">
                +{percentualEmbutido}% no preço líquido
              </span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <TrendingUp className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-slate-200/80 shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500">Regime Menor Carga</p>
              <h3 className="text-base font-bold text-emerald-700 mt-1 flex items-center gap-1">
                <Award className="w-4 h-4 text-emerald-600" />
                {menorCargaRegime.regime}
              </h3>
              <span className="text-[11px] text-slate-500 block">
                Carga de {menorCargaRegime.cargaTributariaTotal.toFixed(2)}% (Preço R${' '}
                {menorCargaRegime.precoVendaSugerido.toFixed(2)})
              </span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Scale className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Navegação por Abas para as 3 Melhorias + Configuração Base */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-slate-100 p-1 border border-slate-200/80 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 h-auto gap-1">
          <TabsTrigger
            value="configuracao"
            className="data-[state=active]:bg-white data-[state=active]:text-blue-700 data-[state=active]:shadow-xs py-2 text-xs font-semibold flex items-center justify-center gap-1.5"
          >
            <Receipt className="w-3.5 h-3.5" />
            1. Configuração & Simulador
          </TabsTrigger>

          <TabsTrigger
            value="comparativo"
            className="data-[state=active]:bg-white data-[state=active]:text-blue-700 data-[state=active]:shadow-xs py-2 text-xs font-semibold flex items-center justify-center gap-1.5"
          >
            <Scale className="w-3.5 h-3.5" />
            2. Comparativo 3 Regimes
            <Badge className="ml-1 bg-blue-100 text-blue-700 border-none text-[10px] px-1 py-0">
              3 Vias
            </Badge>
          </TabsTrigger>

          <TabsTrigger
            value="comparar_empresas"
            className="data-[state=active]:bg-white data-[state=active]:text-indigo-700 data-[state=active]:shadow-xs py-2 text-xs font-semibold flex items-center justify-center gap-1.5"
          >
            <GitCompare className="w-3.5 h-3.5 text-indigo-600" />
            3. Comparar 2 Empresas
            <Badge className="ml-1 bg-indigo-100 text-indigo-700 border-none text-[10px] px-1 py-0">
              Setor
            </Badge>
          </TabsTrigger>

          <TabsTrigger
            value="sensibilidade"
            className="data-[state=active]:bg-white data-[state=active]:text-blue-700 data-[state=active]:shadow-xs py-2 text-xs font-semibold flex items-center justify-center gap-1.5"
          >
            <Grid3X3 className="w-3.5 h-3.5" />
            4. Sensibilidade de Preço
          </TabsTrigger>

          <TabsTrigger
            value="enquadramento"
            className="data-[state=active]:bg-white data-[state=active]:text-blue-700 data-[state=active]:shadow-xs py-2 text-xs font-semibold flex items-center justify-center gap-1.5"
          >
            <Activity className="w-3.5 h-3.5" />
            5. Enquadramento RBT12 (DRE)
          </TabsTrigger>
        </TabsList>

        {/* =========================================================================
            ABA 1: CONFIGURAÇÃO DE IMPOSTOS & SIMULADOR DE PREÇO BASE
           ========================================================================= */}
        <TabsContent value="configuracao" className="space-y-6 mt-0">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Coluna Esquerda: Configurações do Regime e Alíquotas (7 colunas) */}
            <div className="lg:col-span-7 space-y-6">
              <Card className="border-slate-200/80 shadow-xs">
                <CardHeader className="pb-4 border-b border-slate-100">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base font-bold text-slate-900">
                        Regime Tributário & Alíquotas
                      </CardTitle>
                      <CardDescription className="text-xs">
                        Defina como os impostos da empresa devem compor a formação de preço de
                        venda.
                      </CardDescription>
                    </div>
                    <Badge variant="secondary" className="font-semibold text-xs text-slate-700">
                      {empresaAtual?.razao_social || empresaAtual?.nome || 'Empresa Geral'}
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent className="pt-5 space-y-5">
                  {/* Seleção do Regime */}
                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Escolha o Regime Tributário
                    </Label>
                    <div className="grid grid-cols-3 gap-2">
                      {(
                        [
                          'Simples Nacional',
                          'Lucro Presumido',
                          'Lucro Real',
                        ] as RegimeTributarioFormacaoPreco[]
                      ).map((reg) => {
                        const isSelected = regime === reg
                        return (
                          <button
                            key={reg}
                            type="button"
                            onClick={() => aplicarPresetRegime(reg)}
                            className={`p-3 rounded-xl border text-left transition-all ${
                              isSelected
                                ? 'border-blue-600 bg-blue-50/70 text-blue-900 shadow-xs ring-2 ring-blue-500/20'
                                : 'border-slate-200 hover:border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-bold text-xs">{reg}</span>
                              {isSelected && <CheckCircle2 className="w-4 h-4 text-blue-600" />}
                            </div>
                            <span className="text-[10px] text-slate-500 line-clamp-1">
                              {reg === 'Simples Nacional'
                                ? 'Guia Única DAS'
                                : reg === 'Lucro Presumido'
                                  ? 'PIS/COFINS Cumulativo'
                                  : 'PIS/COFINS Não-Cumulativo'}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* Formulário Específico: Simples Nacional */}
                  {regime === 'Simples Nacional' && (
                    <div className="p-4 rounded-xl bg-blue-50/40 border border-blue-100 space-y-4 animate-in fade-in-50 duration-200">
                      <div className="flex items-center gap-2">
                        <Badge className="bg-blue-600 text-white hover:bg-blue-600 text-xs font-semibold">
                          Simples Nacional
                        </Badge>
                        <span className="text-xs text-slate-600 font-medium">
                          Guia Única DAS (Alíquota Efetiva)
                        </span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <Label
                            htmlFor="anexo-simples"
                            className="text-xs text-slate-700 font-medium"
                          >
                            Anexo do Simples
                          </Label>
                          <Select value={anexoSimples} onValueChange={setAnexoSimples}>
                            <SelectTrigger id="anexo-simples" className="bg-white">
                              <SelectValue placeholder="Selecione o anexo" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Anexo I - Comércio">
                                Anexo I - Comércio (4,0% a 19,0%)
                              </SelectItem>
                              <SelectItem value="Anexo II - Indústria">
                                Anexo II - Indústria (4,5% a 30,0%)
                              </SelectItem>
                              <SelectItem value="Anexo III - Serviços">
                                Anexo III - Serviços (6,0% a 33,0%)
                              </SelectItem>
                              <SelectItem value="Anexo IV - Serviços Específicos">
                                Anexo IV - Serviços Específicos (4,5% a 33,0%)
                              </SelectItem>
                              <SelectItem value="Anexo V - Serviços Fator R">
                                Anexo V - Serviços Fator R (15,5% a 30,5%)
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-1.5">
                          <Label
                            htmlFor="faixa-simples"
                            className="text-xs text-slate-700 font-medium"
                          >
                            Faixa de Faturamento RBT12
                          </Label>
                          <Select value={faixaSimples} onValueChange={setFaixaSimples}>
                            <SelectTrigger id="faixa-simples" className="bg-white">
                              <SelectValue placeholder="Selecione a faixa" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="1ª Faixa (até R$ 180.000,00)">
                                1ª Faixa (até R$ 180 mil/ano)
                              </SelectItem>
                              <SelectItem value="2ª Faixa (R$ 180.000 a R$ 360.000)">
                                2ª Faixa (R$ 180 mil a R$ 360 mil)
                              </SelectItem>
                              <SelectItem value="3ª Faixa (R$ 360.000 a R$ 720.000)">
                                3ª Faixa (R$ 360 mil a R$ 720 mil)
                              </SelectItem>
                              <SelectItem value="4ª Faixa (R$ 720.000 a R$ 1.800.000)">
                                4ª Faixa (R$ 720 mil a R$ 1,8 mi)
                              </SelectItem>
                              <SelectItem value="5ª Faixa (R$ 1.800.000 a R$ 3.600.000)">
                                5ª Faixa (R$ 1,8 mi a R$ 3,6 mi)
                              </SelectItem>
                              <SelectItem value="6ª Faixa (R$ 3.600.000 a R$ 4.800.000)">
                                6ª Faixa (R$ 3,6 mi a R$ 4,8 mi)
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <Label
                            htmlFor="aliquota-simples"
                            className="text-xs font-bold text-slate-800"
                          >
                            Alíquota Efetiva do DAS a aplicar na Formação de Preço (%)
                          </Label>
                          <span className="text-xs font-bold text-blue-700">
                            {aliquotaSimples}%
                          </span>
                        </div>
                        <div className="relative">
                          <Input
                            id="aliquota-simples"
                            type="number"
                            step="0.01"
                            min="0"
                            max="99.9"
                            value={aliquotaSimples}
                            onChange={(e) => setAliquotaSimples(parseFloat(e.target.value) || 0)}
                            className="bg-white pr-8 font-semibold text-slate-800 text-sm"
                            placeholder="Ex: 6.00"
                          />
                          <span className="absolute right-3 top-2.5 text-xs text-slate-400 font-bold">
                            %
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500">
                          Informe a alíquota apurada no PGDAS-D mensal do seu extrato para
                          precificação exata.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Formulário Lucro Presumido e Lucro Real */}
                  {(regime === 'Lucro Presumido' || regime === 'Lucro Real') && (
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-4 animate-in fade-in-50 duration-200">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge className="bg-slate-800 text-white hover:bg-slate-800 text-xs font-semibold">
                            {regime}
                          </Badge>
                          <span className="text-xs text-slate-600 font-medium">
                            Discriminação individual de tributos sobre a receita
                          </span>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => aplicarPresetRegime(regime)}
                          className="text-xs h-7 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                        >
                          <RotateCcw className="w-3 h-3 mr-1" />
                          Restaurar padrão
                        </Button>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {/* PIS */}
                        <div className="space-y-1">
                          <Label htmlFor="pis" className="text-xs font-medium text-slate-700">
                            PIS (%)
                          </Label>
                          <div className="relative">
                            <Input
                              id="pis"
                              type="number"
                              step="0.01"
                              min="0"
                              value={aliquotaPis}
                              onChange={(e) => setAliquotaPis(parseFloat(e.target.value) || 0)}
                              className="bg-white pr-7 text-xs font-semibold"
                            />
                            <span className="absolute right-2.5 top-2 text-xs text-slate-400 font-bold">
                              %
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-500">
                            {regime === 'Lucro Real' ? 'Normal: 1,65%' : 'Normal: 0,65%'}
                          </span>
                        </div>

                        {/* COFINS */}
                        <div className="space-y-1">
                          <Label htmlFor="cofins" className="text-xs font-medium text-slate-700">
                            COFINS (%)
                          </Label>
                          <div className="relative">
                            <Input
                              id="cofins"
                              type="number"
                              step="0.01"
                              min="0"
                              value={aliquotaCofins}
                              onChange={(e) => setAliquotaCofins(parseFloat(e.target.value) || 0)}
                              className="bg-white pr-7 text-xs font-semibold"
                            />
                            <span className="absolute right-2.5 top-2 text-xs text-slate-400 font-bold">
                              %
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-500">
                            {regime === 'Lucro Real' ? 'Normal: 7,60%' : 'Normal: 3,00%'}
                          </span>
                        </div>

                        {/* ICMS */}
                        <div className="space-y-1">
                          <Label htmlFor="icms" className="text-xs font-medium text-slate-700">
                            ICMS (%)
                          </Label>
                          <div className="relative">
                            <Input
                              id="icms"
                              type="number"
                              step="0.01"
                              min="0"
                              value={aliquotaIcms}
                              onChange={(e) => setAliquotaIcms(parseFloat(e.target.value) || 0)}
                              className="bg-white pr-7 text-xs font-semibold"
                            />
                            <span className="absolute right-2.5 top-2 text-xs text-slate-400 font-bold">
                              %
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-500">Ex: 18%, 12%, 7%</span>
                        </div>

                        {/* IPI */}
                        <div className="space-y-1">
                          <Label htmlFor="ipi" className="text-xs font-medium text-slate-700">
                            IPI (%) (indústria)
                          </Label>
                          <div className="relative">
                            <Input
                              id="ipi"
                              type="number"
                              step="0.01"
                              min="0"
                              value={aliquotaIpi}
                              onChange={(e) => setAliquotaIpi(parseFloat(e.target.value) || 0)}
                              className="bg-white pr-7 text-xs font-semibold"
                            />
                            <span className="absolute right-2.5 top-2 text-xs text-slate-400 font-bold">
                              %
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-500">0% se comércio/serviço</span>
                        </div>

                        {/* ISS */}
                        <div className="space-y-1">
                          <Label htmlFor="iss" className="text-xs font-medium text-slate-700">
                            ISS (%) (serviço)
                          </Label>
                          <div className="relative">
                            <Input
                              id="iss"
                              type="number"
                              step="0.01"
                              min="0"
                              value={aliquotaIss}
                              onChange={(e) => setAliquotaIss(parseFloat(e.target.value) || 0)}
                              className="bg-white pr-7 text-xs font-semibold"
                            />
                            <span className="absolute right-2.5 top-2 text-xs text-slate-400 font-bold">
                              %
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-500">Geralmente 2% a 5%</span>
                        </div>

                        {/* IRPJ (provisão sobre receita) */}
                        <div className="space-y-1">
                          <Label htmlFor="irpj" className="text-xs font-medium text-slate-700">
                            IRPJ (%) provisão
                          </Label>
                          <div className="relative">
                            <Input
                              id="irpj"
                              type="number"
                              step="0.01"
                              min="0"
                              value={aliquotaIrpj}
                              onChange={(e) => setAliquotaIrpj(parseFloat(e.target.value) || 0)}
                              className="bg-white pr-7 text-xs font-semibold"
                            />
                            <span className="absolute right-2.5 top-2 text-xs text-slate-400 font-bold">
                              %
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-500">Comércio: ~1,20%</span>
                        </div>

                        {/* CSLL (provisão sobre receita) */}
                        <div className="space-y-1">
                          <Label htmlFor="csll" className="text-xs font-medium text-slate-700">
                            CSLL (%) provisão
                          </Label>
                          <div className="relative">
                            <Input
                              id="csll"
                              type="number"
                              step="0.01"
                              min="0"
                              value={aliquotaCsll}
                              onChange={(e) => setAliquotaCsll(parseFloat(e.target.value) || 0)}
                              className="bg-white pr-7 text-xs font-semibold"
                            />
                            <span className="absolute right-2.5 top-2 text-xs text-slate-400 font-bold">
                              %
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-500">Comércio: ~1,08%</span>
                        </div>

                        {/* Outros Impostos / Taxas */}
                        <div className="space-y-1">
                          <Label htmlFor="outros" className="text-xs font-medium text-slate-700">
                            Outros / FCP (%)
                          </Label>
                          <div className="relative">
                            <Input
                              id="outros"
                              type="number"
                              step="0.01"
                              min="0"
                              value={outrosImpostos}
                              onChange={(e) => setOutrosImpostos(parseFloat(e.target.value) || 0)}
                              className="bg-white pr-7 text-xs font-semibold"
                            />
                            <span className="absolute right-2.5 top-2 text-xs text-slate-400 font-bold">
                              %
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-500">Combate à Pobreza</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Observações */}
                  <div className="space-y-1.5">
                    <Label htmlFor="observacoes" className="text-xs font-medium text-slate-700">
                      Notas / Observações Fiscais
                    </Label>
                    <Textarea
                      id="observacoes"
                      rows={2}
                      value={observacoes}
                      onChange={(e) => setObservacoes(e.target.value)}
                      placeholder="Ex: Alíquota referente ao exercício 2025 com redução de base de cálculo..."
                      className="bg-white text-xs resize-none"
                    />
                  </div>

                  {/* Botões de Ação */}
                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                    <div className="text-xs text-slate-500">
                      Carga Total:{' '}
                      <span className="font-bold text-slate-800">{cargaTributariaTotal}%</span>
                    </div>
                    <Button
                      onClick={handleSalvar}
                      disabled={saving || loading}
                      className="bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-xs"
                    >
                      <Save className="w-4 h-4 mr-2" />
                      {saving ? 'Salvando...' : 'Salvar Configurações Tributárias'}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Guia Didático Rápido */}
              <Card className="bg-slate-50/70 border-slate-200">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Info className="w-4 h-4 text-blue-600" />
                    Como os impostos impactam o Preço de Venda?
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-xs text-slate-600 space-y-2 pt-0">
                  <p>
                    No Brasil, os tributos sobre vendas (ICMS, PIS, COFINS, ISS e DAS) são cobrados{' '}
                    <strong>"por dentro"</strong>, o que significa que o imposto incide sobre o
                    próprio valor final de venda.
                  </p>
                  <div className="p-2.5 rounded-lg bg-white border border-slate-200 text-[11px] font-mono text-slate-700 space-y-1">
                    <div>Fórmula de Formação por Dentro:</div>
                    <div className="text-blue-700 font-bold">
                      Preço de Venda = Custo / [1 - (Margem% + Desp. Variáveis% + Impostos%) / 100]
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Coluna Direita: Simulador de Formação de Preço (5 colunas) */}
            <div className="lg:col-span-5 space-y-6">
              <Card className="border-amber-200/80 shadow-xs bg-linear-to-b from-amber-50/20 to-white">
                <CardHeader className="pb-3 border-b border-amber-100">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                        <Calculator className="w-4 h-4 text-amber-600" />
                        Simulador de Preço de Venda
                      </CardTitle>
                      <CardDescription className="text-xs">
                        Preço calculado em tempo real com base na carga tributária configurada.
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="pt-4 space-y-4">
                  {/* Seleção do Produto ou Modo Manual */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-slate-700">
                      Carregar Dados de um Produto (Opcional)
                    </Label>
                    <Select value={selectedProdutoId} onValueChange={handleSelectProduto}>
                      <SelectTrigger className="bg-white text-xs">
                        <SelectValue placeholder="Digitar custo manualmente..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="custom">-- Digitar Custo Manualmente --</SelectItem>
                        {produtos.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.codigo ? `[${p.codigo}] ` : ''}
                            {p.nome} (Custo: R$ {(p.custo || 0).toFixed(2)})
                            {p.capacidade_producao
                              ? ` · Cap: ${p.capacidade_producao} ${p.unidade || 'un'}`
                              : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Volume Projetado de Venda e Validação de Capacidade */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label
                        htmlFor="vol-proj-simulacao"
                        className="text-xs font-medium text-slate-700 flex items-center gap-1.5"
                      >
                        <TrendingUp className="w-3.5 h-3.5 text-blue-600" />
                        Volume Projetado de Venda (
                        {produtoSelecionadoSimulador?.unidade || 'unidades'})
                      </Label>
                      {produtoSelecionadoSimulador?.capacidade_producao !== undefined &&
                        produtoSelecionadoSimulador?.capacidade_producao !== null &&
                        produtoSelecionadoSimulador.capacidade_producao > 0 && (
                          <Badge
                            variant="outline"
                            className="text-[10px] bg-indigo-50 text-indigo-700 border-indigo-200"
                          >
                            Capacidade:{' '}
                            {produtoSelecionadoSimulador.capacidade_producao.toLocaleString(
                              'pt-BR',
                            )}{' '}
                            {produtoSelecionadoSimulador.unidade || 'un'}
                          </Badge>
                        )}
                    </div>
                    <Input
                      id="vol-proj-simulacao"
                      type="number"
                      min="0"
                      step="any"
                      placeholder={
                        produtoSelecionadoSimulador?.capacidade_producao
                          ? `Ex: ${produtoSelecionadoSimulador.capacidade_producao}`
                          : 'Ex: 1000'
                      }
                      value={volumeProjetadoSimulacao}
                      onChange={(e) => {
                        const val = e.target.value.trim()
                        setVolumeProjetadoSimulacao(val === '' ? '' : parseFloat(val) || 0)
                      }}
                      className="bg-white text-xs font-semibold"
                    />

                    {/* Alerta de estouro de capacidade */}
                    {alertaCapacidadeSimulador && (
                      <Alert className="bg-amber-50 border-amber-300 text-amber-900 py-2.5 animate-in fade-in-50">
                        <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                        <AlertDescription className="text-xs font-medium leading-relaxed">
                          {alertaCapacidadeSimulador.mensagem}
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>

                  {/* Quadro Demonstrativo da Apuração do Insumo: Créditos vs Acréscimos (quando produto selecionado) */}
                  {detalhesProdutoSimulado && (
                    <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-2.5">
                      <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                        <div className="flex items-center gap-1.5 font-bold text-slate-900">
                          <Layers className="w-4 h-4 text-amber-600" />
                          Apuração Tributária dos Insumos (Ficha Técnica)
                        </div>
                        <Badge
                          variant="outline"
                          className="text-[10px] bg-white text-blue-700 border-blue-200"
                        >
                          {detalhesProdutoSimulado.itensCount} insumo(s)
                        </Badge>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                        <div className="bg-white p-2 rounded-lg border border-slate-100">
                          <span className="text-slate-500 block">Custo Bruto MP</span>
                          <strong className="text-slate-900 font-mono block">
                            R$ {detalhesProdutoSimulado.custoMPBruto.toFixed(2)}
                          </strong>
                        </div>
                        <div className="bg-emerald-50/70 p-2 rounded-lg border border-emerald-100">
                          <span className="text-emerald-700 block font-medium">Créditos (-)</span>
                          <strong className="text-emerald-800 font-mono block">
                            -R$ {detalhesProdutoSimulado.creditosTotais.toFixed(2)}
                          </strong>
                          <span className="text-[9px] text-emerald-600">ICMS, PIS, COFINS</span>
                        </div>
                        <div className="bg-amber-50/70 p-2 rounded-lg border border-amber-100">
                          <span className="text-amber-800 block font-medium">Acréscimos (+)</span>
                          <strong className="text-amber-900 font-mono block">
                            +R$ {detalhesProdutoSimulado.acrescimosTotais.toFixed(2)}
                          </strong>
                          <span className="text-[9px] text-amber-700">IPI, Frete, Perdas</span>
                        </div>
                        <div className="bg-blue-50/70 p-2 rounded-lg border border-blue-100">
                          <span className="text-blue-900 block font-semibold">Custo Líq. MP</span>
                          <strong className="text-blue-950 font-mono block">
                            R$ {detalhesProdutoSimulado.custoMPLiquido.toFixed(2)}
                          </strong>
                          {detalhesProdutoSimulado.outrosCustos > 0 && (
                            <span className="text-[9px] text-slate-500">
                              + R$ {detalhesProdutoSimulado.outrosCustos.toFixed(2)} outros
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="text-[10px] text-slate-500 bg-white/80 p-2 rounded border border-slate-100 flex flex-wrap gap-x-3 gap-y-1">
                        <span>
                          Fórmula: <strong>Custo Líquido = Bruto − Créditos + Acréscimos</strong>
                        </span>
                        {detalhesProdutoSimulado.valorIpi > 0 && (
                          <span className="text-slate-600">
                            IPI: R$ {detalhesProdutoSimulado.valorIpi.toFixed(2)}
                          </span>
                        )}
                        {detalhesProdutoSimulado.valorFrete > 0 && (
                          <span className="text-slate-600">
                            Frete: R$ {detalhesProdutoSimulado.valorFrete.toFixed(2)}
                          </span>
                        )}
                        {detalhesProdutoSimulado.valorPerdas > 0 && (
                          <span className="text-slate-600">
                            Perdas: R$ {detalhesProdutoSimulado.valorPerdas.toFixed(2)}
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Parâmetros do Simulador */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label
                        htmlFor="custo-simulacao"
                        className="text-xs font-medium text-slate-700"
                      >
                        Custo Base (R$)
                      </Label>
                      <div className="relative">
                        <span className="absolute left-2.5 top-2 text-xs text-slate-400 font-medium">
                          R$
                        </span>
                        <Input
                          id="custo-simulacao"
                          type="number"
                          step="0.01"
                          min="0"
                          value={custoBaseSimulacao}
                          onChange={(e) => {
                            setSelectedProdutoId('custom')
                            setCustoBaseSimulacao(parseFloat(e.target.value) || 0)
                          }}
                          className="bg-white pl-8 text-xs font-bold text-slate-900"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <Label
                        htmlFor="margem-simulacao"
                        className="text-xs font-medium text-slate-700"
                      >
                        Margem Desejada (%)
                      </Label>
                      <div className="relative">
                        <Input
                          id="margem-simulacao"
                          type="number"
                          step="0.5"
                          min="0"
                          max="90"
                          value={margemDesejadaSimulacao}
                          onChange={(e) =>
                            setMargemDesejadaSimulacao(parseFloat(e.target.value) || 0)
                          }
                          className="bg-white pr-7 text-xs font-bold text-emerald-700"
                        />
                        <span className="absolute right-2.5 top-2 text-xs text-slate-400 font-bold">
                          %
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="desp-var" className="text-xs font-medium text-slate-700">
                      Despesas Variáveis Adicionais (% sobre venda - ex: Comissões, Cartão)
                    </Label>
                    <div className="relative">
                      <Input
                        id="desp-var"
                        type="number"
                        step="0.1"
                        min="0"
                        value={despesasVariaveisSimulacao}
                        onChange={(e) =>
                          setDespesasVariaveisSimulacao(parseFloat(e.target.value) || 0)
                        }
                        className="bg-white pr-7 text-xs font-medium"
                        placeholder="0.00"
                      />
                      <span className="absolute right-2.5 top-2 text-xs text-slate-400 font-bold">
                        %
                      </span>
                    </div>
                  </div>

                  {/* Resultado Destaque: Preço Sugerido */}
                  <div className="p-4 rounded-xl bg-slate-900 text-white space-y-3 shadow-md">
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span>PREÇO DE VENDA SUGERIDO (COM IMPOSTOS)</span>
                      <Badge className="bg-amber-500 text-slate-950 font-bold hover:bg-amber-500">
                        Por Dentro
                      </Badge>
                    </div>
                    <div className="flex items-baseline justify-between">
                      <span className="text-3xl font-extrabold tracking-tight text-white">
                        R${' '}
                        {simulacao.precoFinal.toLocaleString('pt-BR', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </span>
                      <span className="text-xs text-emerald-400 font-medium">
                        Markup: {simulacao.markup.toFixed(2)}x
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800 text-[11px]">
                      <div>
                        <span className="text-slate-400 block">Sem Impostos (Líquido):</span>
                        <span className="font-semibold text-slate-200">
                          R${' '}
                          {precoSemImposto.toLocaleString('pt-BR', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-slate-400 block">Total de Impostos Embutidos:</span>
                        <span className="font-semibold text-amber-300">
                          R${' '}
                          {simulacao.valorImpostos.toLocaleString('pt-BR', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}{' '}
                          ({cargaTributariaTotal}%)
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Breakdown da Composição do Preço */}
                  <div className="space-y-2 pt-2">
                    <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                      Breakdown do Preço de Venda
                    </h4>

                    <div className="space-y-1.5 text-xs">
                      {/* Custo */}
                      <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-200/60">
                        <span className="text-slate-600 flex items-center gap-1.5 font-medium">
                          <span className="w-2.5 h-2.5 rounded-full bg-slate-500" />
                          Custo do Produto / Ficha
                        </span>
                        <div className="text-right font-bold text-slate-800">
                          R$ {custoBaseSimulacao.toFixed(2)}{' '}
                          <span className="text-[10px] text-slate-400 font-normal">
                            (
                            {simulacao.precoFinal > 0
                              ? ((custoBaseSimulacao / simulacao.precoFinal) * 100).toFixed(1)
                              : 0}
                            %)
                          </span>
                        </div>
                      </div>

                      {/* Margem de Lucro */}
                      <div className="flex items-center justify-between p-2 rounded-lg bg-emerald-50/50 border border-emerald-100">
                        <span className="text-emerald-900 flex items-center gap-1.5 font-medium">
                          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                          Margem de Lucro Bruta ({margemDesejadaSimulacao}%)
                        </span>
                        <div className="text-right font-bold text-emerald-700">
                          R$ {simulacao.valorMargem.toFixed(2)}
                        </div>
                      </div>

                      {/* Impostos */}
                      <div className="flex items-center justify-between p-2 rounded-lg bg-amber-50/50 border border-amber-100">
                        <span className="text-amber-900 flex items-center gap-1.5 font-medium">
                          <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                          Carga Tributária ({cargaTributariaTotal}%)
                        </span>
                        <div className="text-right font-bold text-amber-700">
                          R$ {simulacao.valorImpostos.toFixed(2)}
                        </div>
                      </div>

                      {/* Despesas Variáveis */}
                      {despesasVariaveisSimulacao > 0 && (
                        <div className="flex items-center justify-between p-2 rounded-lg bg-indigo-50/50 border border-indigo-100">
                          <span className="text-indigo-900 flex items-center gap-1.5 font-medium">
                            <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
                            Despesas Variáveis ({despesasVariaveisSimulacao}%)
                          </span>
                          <div className="text-right font-bold text-indigo-700">
                            R$ {simulacao.valorDespVar.toFixed(2)}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* =========================================================================
            ABA 2: MELHORIA 1 - COMPARATIVO DOS 3 REGIMES TRIBUTÁRIOS LADO A LADO
           ========================================================================= */}
        <TabsContent value="comparativo" className="space-y-6 mt-0">
          {/* Card de Alerta Resumo do Melhor Regime + Ação de Gerar PDF */}
          <div className="p-5 rounded-xl bg-linear-to-r from-emerald-500/10 via-teal-500/10 to-blue-500/10 border border-emerald-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                <Award className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-sm text-emerald-950">
                    Regime Mais Competitivo: {menorCargaRegime.regime}
                  </h3>
                  <Badge className="bg-emerald-600 text-white hover:bg-emerald-600 text-[10px]">
                    Menor Carga Tributária
                  </Badge>
                </div>
                <p className="text-xs text-slate-600 mt-1">
                  Gera uma economia de até{' '}
                  <strong className="text-emerald-700 font-bold">
                    R$ {diferencaMaxPreco.toFixed(2)} por unidade vendida
                  </strong>{' '}
                  em relação ao regime de maior impacto tributário ({maiorCargaRegime?.regime}),
                  proporcionando preço final de{' '}
                  <strong>R$ {menorCargaRegime.precoVendaSugerido.toFixed(2)}</strong>.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setPdfTipo('comparativo_regimes')
                  setPdfModalOpen(true)
                }}
                className="text-xs bg-white border-slate-300 hover:bg-slate-50 text-slate-800 font-semibold gap-1.5 shadow-2xs"
              >
                <FileText className="w-3.5 h-3.5 text-blue-600" />
                Gerar PDF (A4)
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  aplicarPresetRegime(menorCargaRegime.regime)
                  setActiveTab('configuracao')
                }}
                className="text-xs bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700 font-semibold"
              >
                Aplicar {menorCargaRegime.regime}
                <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
              </Button>
            </div>
          </div>

          {/* Cards dos 3 Regimes Lado a Lado */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {comparativoRegimes.map((item) => {
              const isMenor = item.isMenorCarga
              const isAtual = item.isRegimeAtual

              return (
                <Card
                  key={item.regime}
                  className={`relative overflow-hidden transition-all duration-200 flex flex-col justify-between ${
                    isMenor
                      ? 'border-2 border-emerald-500 shadow-md ring-4 ring-emerald-500/10 bg-emerald-50/20'
                      : isAtual
                        ? 'border-2 border-blue-400 bg-blue-50/20 shadow-xs'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  {/* Badge de Destaque */}
                  <div className="absolute top-3 right-3 flex items-center gap-1.5">
                    {isMenor && (
                      <Badge className="bg-emerald-600 text-white hover:bg-emerald-600 text-[10px] font-bold">
                        🏆 Menor Carga
                      </Badge>
                    )}
                    {isAtual && (
                      <Badge
                        variant="outline"
                        className="bg-blue-50 text-blue-700 border-blue-200 text-[10px]"
                      >
                        Regime Atual
                      </Badge>
                    )}
                  </div>

                  <CardHeader className="pb-3 border-b border-slate-100">
                    <CardTitle className="text-base font-bold text-slate-900 pr-24">
                      {item.regime}
                    </CardTitle>
                    <CardDescription className="text-xs line-clamp-2">
                      {item.regimeDescricao}
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="pt-4 space-y-4 flex-1">
                    {/* Carga Total & Preço Final */}
                    <div className="p-3.5 rounded-xl bg-slate-900 text-white space-y-2">
                      <div className="flex items-center justify-between text-xs text-slate-400">
                        <span>Preço Sugerido (Gross-up)</span>
                        <span className="text-amber-400 font-bold">
                          Carga: {item.cargaTributariaTotal.toFixed(2)}%
                        </span>
                      </div>
                      <div className="text-2xl font-extrabold text-white">
                        R$ {item.precoVendaSugerido.toFixed(2)}
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1.5 border-t border-slate-800">
                        <span>Fator Gross-up: {item.fatorPorDentro.toFixed(4)}</span>
                        <span>Markup: {item.markupMultiplicador.toFixed(2)}x</span>
                      </div>
                    </div>

                    {/* Decomposição do Preço */}
                    <div className="space-y-1.5 text-xs">
                      <div className="flex items-center justify-between p-1.5 rounded bg-slate-50 text-slate-600">
                        <span>Custo Base do Produto:</span>
                        <span className="font-semibold text-slate-800">
                          R$ {item.valorCustoPreco.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between p-1.5 rounded bg-emerald-50/50 text-emerald-800">
                        <span>Margem de Lucro ({margemDesejadaSimulacao}%):</span>
                        <span className="font-semibold text-emerald-700">
                          R$ {item.valorMargemPreco.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between p-1.5 rounded bg-amber-50/50 text-amber-800">
                        <span>Total de Tributos Embutidos:</span>
                        <span className="font-semibold text-amber-700">
                          R$ {item.valorImpostosPreco.toFixed(2)}
                        </span>
                      </div>
                    </div>

                    {/* Lista dos Tributos Incidentes */}
                    <div className="pt-2 border-t border-slate-100 space-y-1.5">
                      <p className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                        Detalhamento de Tributos
                      </p>
                      <div className="space-y-1">
                        {item.detalhesTributos.map((trib, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between text-[11px] text-slate-600"
                          >
                            <span>{trib.nome}:</span>
                            <span className="font-medium text-slate-800">
                              {trib.aliquota.toFixed(2)}% (R$ {trib.valorNoPreco.toFixed(2)})
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Diferença vs Menor Carga */}
                    {!isMenor && (
                      <div className="p-2.5 rounded-lg bg-amber-50/70 border border-amber-200 text-xs text-amber-900 space-y-1">
                        <div className="flex items-center justify-between font-semibold">
                          <span>Impacto vs {menorCargaRegime.regime}:</span>
                          <span>+{item.diferencaCargaVsMenor}% carga</span>
                        </div>
                        <div className="text-[11px] text-amber-700">
                          Preço fica{' '}
                          <strong>R$ {item.diferencaPrecoVsMenor.toFixed(2)} mais caro</strong> por
                          unidade para manter a mesma margem.
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>

          {/* Gráfico Recharts Comparativo: Preço e Impostos nos 3 Regimes */}
          <Card className="border-slate-200/80 shadow-xs">
            <CardHeader className="pb-3 border-b border-slate-100">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-blue-600" />
                    Comparativo Visual: Preço Final Sugerido por Regime Tributário
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Impacto direto da carga tributária na composição do preço de venda unitário.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="h-[280px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={dadosGraficoComparativo}
                    margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="regime" tick={{ fontSize: 12 }} />
                    <YAxis
                      tick={{ fontSize: 11 }}
                      tickFormatter={(val) => `R$ ${val}`}
                      domain={[0, 'auto']}
                    />
                    <RechartsTooltip
                      formatter={(val: any, name: string) => {
                        if (name === 'precoFinal')
                          return [`R$ ${Number(val).toFixed(2)}`, 'Preço Final']
                        if (name === 'impostosNoPreco')
                          return [`R$ ${Number(val).toFixed(2)}`, 'Impostos no Preço']
                        return [val, name]
                      }}
                    />
                    <Legend
                      formatter={(value) => {
                        if (value === 'precoFinal') return 'Preço de Venda Sugerido (R$)'
                        if (value === 'impostosNoPreco') return 'Impostos Embutidos (R$)'
                        return value
                      }}
                    />
                    <Bar
                      dataKey="precoFinal"
                      name="precoFinal"
                      fill="#3b82f6"
                      radius={[4, 4, 0, 0]}
                    >
                      {dadosGraficoComparativo.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={
                            entry.isMenorCarga ? '#10b981' : entry.isAtual ? '#3b82f6' : '#64748b'
                          }
                        />
                      ))}
                    </Bar>
                    <Bar
                      dataKey="impostosNoPreco"
                      name="impostosNoPreco"
                      fill="#f59e0b"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* =========================================================================
            ABA 3: MELHORIA 1 - COMPARAR CARGA TRIBUTÁRIA ENTRE DUAS EMPRESAS
           ========================================================================= */}
        <TabsContent value="comparar_empresas" className="space-y-6 mt-0">
          {/* Header e Seleção de Empresas */}
          <Card className="border-slate-200/80 shadow-xs">
            <CardHeader className="pb-4 border-b border-slate-100">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <GitCompare className="w-4 h-4 text-indigo-600" />
                    Comparativo Setorial: Carga Tributária Entre Duas Empresas
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Identifique assimetrias de carga tributária, gross-up e preços de venda entre
                    empresas do mesmo grupo ou setor para capturar oportunidades de economia e
                    arbitragem fiscal.
                  </CardDescription>
                </div>

                {empresas.length < 2 && (
                  <Badge
                    variant="outline"
                    className="bg-amber-50 text-amber-800 border-amber-300 text-xs"
                  >
                    Requer ao menos 2 empresas cadastradas
                  </Badge>
                )}
              </div>
            </CardHeader>

            <CardContent className="pt-5 space-y-6">
              {/* Seletores das Duas Empresas */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200">
                {/* Empresa A */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold text-blue-900 flex items-center gap-1.5">
                      <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] font-bold">
                        A
                      </span>
                      Primeira Empresa (Base de Análise)
                    </Label>
                    {comparativoDuasEmpresas.hasConfigA ? (
                      <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[10px]">
                        Configurada
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className="bg-amber-50 text-amber-700 border-amber-300 text-[10px]"
                      >
                        Sem Tributos Salvos
                      </Badge>
                    )}
                  </div>
                  <Select value={empresaCompAId} onValueChange={setEmpresaCompAId}>
                    <SelectTrigger className="bg-white border-slate-300">
                      <SelectValue placeholder="Selecione a empresa A" />
                    </SelectTrigger>
                    <SelectContent>
                      {empresas.map((emp) => (
                        <SelectItem
                          key={emp.id}
                          value={emp.id}
                          disabled={emp.id === empresaCompBId}
                        >
                          {emp.razao_social || emp.nome_fantasia || emp.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Empresa B */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold text-indigo-900 flex items-center gap-1.5">
                      <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px] font-bold">
                        B
                      </span>
                      Segunda Empresa (Comparação)
                    </Label>
                    {comparativoDuasEmpresas.hasConfigB ? (
                      <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[10px]">
                        Configurada
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className="bg-amber-50 text-amber-700 border-amber-300 text-[10px]"
                      >
                        Sem Tributos Salvos
                      </Badge>
                    )}
                  </div>
                  <Select value={empresaCompBId} onValueChange={setEmpresaCompBId}>
                    <SelectTrigger className="bg-white border-slate-300">
                      <SelectValue placeholder="Selecione a empresa B" />
                    </SelectTrigger>
                    <SelectContent>
                      {empresas.map((emp) => (
                        <SelectItem
                          key={emp.id}
                          value={emp.id}
                          disabled={emp.id === empresaCompAId}
                        >
                          {emp.razao_social || emp.nome_fantasia || emp.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Alerta de Proteção: Quando uma ou ambas não têm configuração */}
              {(!comparativoDuasEmpresas.hasConfigA || !comparativoDuasEmpresas.hasConfigB) && (
                <div className="p-4 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-xs space-y-1">
                  <div className="flex items-center gap-2 font-bold text-amber-950">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>Atenção: Configuração tributária incompleta</span>
                  </div>
                  <p className="leading-relaxed">
                    {!comparativoDuasEmpresas.hasConfigA && !comparativoDuasEmpresas.hasConfigB
                      ? 'Nenhuma das duas empresas selecionadas possui alíquotas de impostos salvas. Acesse a aba "Configuração & Simulador" para definir as alíquotas de cada uma.'
                      : !comparativoDuasEmpresas.hasConfigA
                        ? `A empresa ${comparativoDuasEmpresas.nomeA} ainda não possui alíquotas salvas (carga considerada como 0,00%).`
                        : `A empresa ${comparativoDuasEmpresas.nomeB} ainda não possui alíquotas salvas (carga considerada como 0,00%).`}
                  </p>
                </div>
              )}

              {/* Card Destaque de Economia e Veredicto Executivo */}
              <div
                className={`p-5 rounded-xl border-2 flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                  comparativoDuasEmpresas.maisEconomica === 'iguais'
                    ? 'bg-slate-50 border-slate-300 text-slate-800'
                    : 'bg-gradient-to-r from-emerald-50 via-teal-50 to-blue-50 border-emerald-500/80 text-emerald-950'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-xs ${
                      comparativoDuasEmpresas.maisEconomica === 'iguais'
                        ? 'bg-slate-700 text-white'
                        : 'bg-emerald-600 text-white'
                    }`}
                  >
                    {comparativoDuasEmpresas.maisEconomica === 'iguais' ? (
                      <Scale className="w-5 h-5" />
                    ) : (
                      <Award className="w-5 h-5" />
                    )}
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-extrabold text-sm">
                        {comparativoDuasEmpresas.maisEconomica === 'iguais'
                          ? 'Cargas Tributárias Equivalentes'
                          : `Menor Carga Tributária: ${
                              comparativoDuasEmpresas.maisEconomica === 'A'
                                ? comparativoDuasEmpresas.nomeA
                                : comparativoDuasEmpresas.nomeB
                            }`}
                      </h3>
                      {comparativoDuasEmpresas.maisEconomica !== 'iguais' && (
                        <Badge className="bg-emerald-600 text-white hover:bg-emerald-600 text-[10px] font-bold">
                          🏆 Mais Competitiva
                        </Badge>
                      )}
                    </div>

                    <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                      {comparativoDuasEmpresas.maisEconomica === 'iguais' ? (
                        <>
                          Ambas as empresas operam com a mesma carga tributária ou sem dados
                          preenchidos.
                        </>
                      ) : (
                        <>
                          A empresa{' '}
                          <strong>
                            {comparativoDuasEmpresas.maisEconomica === 'A'
                              ? comparativoDuasEmpresas.nomeA
                              : comparativoDuasEmpresas.nomeB}
                          </strong>{' '}
                          possui carga tributária de{' '}
                          <strong className="text-emerald-700">
                            {(
                              Number(
                                comparativoDuasEmpresas.maisEconomica === 'A'
                                  ? comparativoDuasEmpresas.cargaA
                                  : comparativoDuasEmpresas.cargaB,
                              ) || 0
                            ).toFixed(2)}
                            %
                          </strong>
                          , gerando uma economia de{' '}
                          <strong className="text-emerald-700">
                            R$ {(Number(comparativoDuasEmpresas.economiaRs) || 0).toFixed(2)} por
                            unidade vendida
                          </strong>{' '}
                          ({(Number(comparativoDuasEmpresas.economiaPctCarga) || 0).toFixed(2)} p.p.
                          a menos de tributação) para o custo simulado de R${' '}
                          {(Number(custoBaseSimulacao) || 0).toFixed(2)}.
                        </>
                      )}
                    </p>
                  </div>
                </div>

                {comparativoDuasEmpresas.maisEconomica !== 'iguais' && (
                  <div className="text-right shrink-0 bg-white p-3 rounded-xl border border-emerald-200 shadow-2xs">
                    <span className="text-[10px] text-slate-500 block uppercase font-bold tracking-wider">
                      Diferencial por Unidade
                    </span>
                    <span className="text-xl font-extrabold text-emerald-700 font-mono">
                      -R$ {(Number(comparativoDuasEmpresas.economiaRs) || 0).toFixed(2)}
                    </span>
                    <span className="text-[10px] text-emerald-600 block font-semibold">
                      ({(Number(comparativoDuasEmpresas.pctEconomiaPreco) || 0).toFixed(1)}% de
                      vantagem no preço)
                    </span>
                  </div>
                )}
              </div>

              {/* Tabela Comparativa Estruturada Lado a Lado */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Card Empresa A */}
                <div
                  className={`p-5 rounded-xl border-2 space-y-4 ${
                    comparativoDuasEmpresas.maisEconomica === 'A'
                      ? 'border-emerald-500 bg-emerald-50/20 shadow-md ring-4 ring-emerald-500/10'
                      : 'border-slate-200 bg-white shadow-xs'
                  }`}
                >
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div>
                      <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider block">
                        Empresa A
                      </span>
                      <h4 className="text-base font-bold text-slate-900 line-clamp-1">
                        {comparativoDuasEmpresas.nomeA}
                      </h4>
                    </div>
                    {comparativoDuasEmpresas.maisEconomica === 'A' && (
                      <Badge className="bg-emerald-600 text-white text-[10px]">
                        🏆 Menor Carga
                      </Badge>
                    )}
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-900 text-white space-y-1.5">
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span>Preço de Venda Sugerido</span>
                      <span className="text-amber-400 font-bold">
                        Carga: {(Number(comparativoDuasEmpresas.cargaA) || 0).toFixed(2)}%
                      </span>
                    </div>
                    <div className="text-2xl font-extrabold text-white">
                      R$ {(Number(comparativoDuasEmpresas.precoA) || 0).toFixed(2)}
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-800">
                      <span>Regime: {comparativoDuasEmpresas.regimeA}</span>
                      <span>
                        Fator Gross-up: {(Number(comparativoDuasEmpresas.fatorA) || 1).toFixed(4)}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between p-2 rounded-lg bg-slate-50 border border-slate-200/60">
                      <span className="text-slate-600">Custo Base Simulado:</span>
                      <span className="font-semibold text-slate-900">
                        R$ {(Number(custoBaseSimulacao) || 0).toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between p-2 rounded-lg bg-emerald-50/60 border border-emerald-100">
                      <span className="text-emerald-900">
                        Margem Líquida ({margemDesejadaSimulacao}%):
                      </span>
                      <span className="font-bold text-emerald-700">
                        R$ {(Number(comparativoDuasEmpresas.margemA) || 0).toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between p-2 rounded-lg bg-amber-50/60 border border-amber-100">
                      <span className="text-amber-900">Tributos Embutidos no Preço:</span>
                      <span className="font-bold text-amber-700">
                        R$ {(Number(comparativoDuasEmpresas.impostosA) || 0).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Card Empresa B */}
                <div
                  className={`p-5 rounded-xl border-2 space-y-4 ${
                    comparativoDuasEmpresas.maisEconomica === 'B'
                      ? 'border-emerald-500 bg-emerald-50/20 shadow-md ring-4 ring-emerald-500/10'
                      : 'border-slate-200 bg-white shadow-xs'
                  }`}
                >
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div>
                      <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider block">
                        Empresa B
                      </span>
                      <h4 className="text-base font-bold text-slate-900 line-clamp-1">
                        {comparativoDuasEmpresas.nomeB}
                      </h4>
                    </div>
                    {comparativoDuasEmpresas.maisEconomica === 'B' && (
                      <Badge className="bg-emerald-600 text-white text-[10px]">
                        🏆 Menor Carga
                      </Badge>
                    )}
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-900 text-white space-y-1.5">
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span>Preço de Venda Sugerido</span>
                      <span className="text-amber-400 font-bold">
                        Carga: {(Number(comparativoDuasEmpresas.cargaB) || 0).toFixed(2)}%
                      </span>
                    </div>
                    <div className="text-2xl font-extrabold text-white">
                      R$ {(Number(comparativoDuasEmpresas.precoB) || 0).toFixed(2)}
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-800">
                      <span>Regime: {comparativoDuasEmpresas.regimeB}</span>
                      <span>
                        Fator Gross-up: {(Number(comparativoDuasEmpresas.fatorB) || 1).toFixed(4)}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between p-2 rounded-lg bg-slate-50 border border-slate-200/60">
                      <span className="text-slate-600">Custo Base Simulado:</span>
                      <span className="font-semibold text-slate-900">
                        R$ {(Number(custoBaseSimulacao) || 0).toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between p-2 rounded-lg bg-emerald-50/60 border border-emerald-100">
                      <span className="text-emerald-900">
                        Margem Líquida ({margemDesejadaSimulacao}%):
                      </span>
                      <span className="font-bold text-emerald-700">
                        R$ {(Number(comparativoDuasEmpresas.margemB) || 0).toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between p-2 rounded-lg bg-amber-50/60 border border-amber-100">
                      <span className="text-amber-900">Tributos Embutidos no Preço:</span>
                      <span className="font-bold text-amber-700">
                        R$ {(Number(comparativoDuasEmpresas.impostosB) || 0).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Gráfico Recharts de Barras Comparativas Entre as 2 Empresas */}
              <Card className="border-slate-200/80 shadow-xs">
                <CardHeader className="pb-3 border-b border-slate-100">
                  <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-indigo-600" />
                    Gráfico Comparativo: Preço Sugerido & Carga Tributária
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Comparação visual direta do preço sugerido (R$) e da carga tributária total (%)
                    entre as duas empresas.
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-4">
                  <div className="h-[280px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={[
                          {
                            empresa: comparativoDuasEmpresas.nomeA,
                            precoFinal: Number(comparativoDuasEmpresas.precoA) || 0,
                            impostos: Number(comparativoDuasEmpresas.impostosA) || 0,
                            carga: Number(comparativoDuasEmpresas.cargaA) || 0,
                            isMaisEconomica: comparativoDuasEmpresas.maisEconomica === 'A',
                          },
                          {
                            empresa: comparativoDuasEmpresas.nomeB,
                            precoFinal: Number(comparativoDuasEmpresas.precoB) || 0,
                            impostos: Number(comparativoDuasEmpresas.impostosB) || 0,
                            carga: Number(comparativoDuasEmpresas.cargaB) || 0,
                            isMaisEconomica: comparativoDuasEmpresas.maisEconomica === 'B',
                          },
                        ]}
                        margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey="empresa" tick={{ fontSize: 12 }} />
                        <YAxis
                          tick={{ fontSize: 11 }}
                          tickFormatter={(val) => `R$ ${val}`}
                          domain={[0, 'auto']}
                        />
                        <RechartsTooltip
                          formatter={(val: any, name: string) => {
                            if (name === 'precoFinal')
                              return [`R$ ${Number(val).toFixed(2)}`, 'Preço Final']
                            if (name === 'impostos')
                              return [`R$ ${Number(val).toFixed(2)}`, 'Tributos Embutidos']
                            return [val, name]
                          }}
                        />
                        <Legend
                          formatter={(value) => {
                            if (value === 'precoFinal') return 'Preço de Venda Sugerido (R$)'
                            if (value === 'impostos') return 'Tributos Embutidos (R$)'
                            return value
                          }}
                        />
                        <Bar
                          dataKey="precoFinal"
                          name="precoFinal"
                          fill="#4f46e5"
                          radius={[4, 4, 0, 0]}
                        />
                        <Bar
                          dataKey="impostos"
                          name="impostos"
                          fill="#f59e0b"
                          radius={[4, 4, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </CardContent>
          </Card>
        </TabsContent>

        {/* =========================================================================
            ABA 4: MELHORIA 2 - ANÁLISE DE SENSIBILIDADE DE PREÇO (CARGA % × MARGEM %)
           ========================================================================= */}
        <TabsContent value="sensibilidade" className="space-y-6 mt-0">
          <Card className="border-slate-200/80 shadow-xs">
            <CardHeader className="pb-4 border-b border-slate-100">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <Grid3X3 className="w-4 h-4 text-indigo-600" />
                    Matriz de Sensibilidade: Carga Tributária (%) × Margem Desejada (%)
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Avalie como o preço de venda final por dentro (gross-up) se comporta com
                    variações de alíquota de impostos e margem de lucro. A célula destacada em azul
                    representa sua configuração atual.
                  </CardDescription>
                </div>

                {/* Controles de Passo da Matriz */}
                <div className="flex items-center gap-3 shrink-0">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-slate-500">Passo Carga:</span>
                    <Select
                      value={String(passoCargaSensibilidade)}
                      onValueChange={(val) => setPassoCargaSensibilidade(Number(val))}
                    >
                      <SelectTrigger className="w-20 h-8 text-xs bg-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">± 1%</SelectItem>
                        <SelectItem value="2">± 2%</SelectItem>
                        <SelectItem value="3">± 3%</SelectItem>
                        <SelectItem value="5">± 5%</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-slate-500">Passo Margem:</span>
                    <Select
                      value={String(passoMargemSensibilidade)}
                      onValueChange={(val) => setPassoMargemSensibilidade(Number(val))}
                    >
                      <SelectTrigger className="w-20 h-8 text-xs bg-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="2">± 2%</SelectItem>
                        <SelectItem value="5">± 5%</SelectItem>
                        <SelectItem value="10">± 10%</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </CardHeader>

            <CardContent className="pt-5 space-y-4">
              {/* Resumo do Cenário Base */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-slate-500">Custo Base:</span>
                  <strong className="text-slate-800">R$ {custoBaseSimulacao.toFixed(2)}</strong>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-slate-500">Carga Atual:</span>
                  <strong className="text-amber-700">{cargaTributariaTotal.toFixed(2)}%</strong>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-slate-500">Margem Atual:</span>
                  <strong className="text-emerald-700">
                    {margemDesejadaSimulacao.toFixed(1)}%
                  </strong>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-slate-500">Preço Atual Calculado:</span>
                  <strong className="text-blue-700">R$ {simulacao.precoFinal.toFixed(2)}</strong>
                </div>
              </div>

              {/* Tabela / Matriz de Calor Heatmap */}
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-100/80 border-b border-slate-200 text-slate-700">
                      <th className="p-3 font-bold border-r border-slate-200 bg-slate-200/60 sticky left-0 z-10">
                        Carga Trib. (%) ↓ \ Margem (%) →
                      </th>
                      {margensSensibilidade.map((margem) => {
                        const isMargemAtual = Math.abs(margem - margemDesejadaSimulacao) < 0.01
                        return (
                          <th
                            key={margem}
                            className={`p-3 text-center font-bold border-r border-slate-200 last:border-r-0 ${
                              isMargemAtual ? 'bg-blue-100/70 text-blue-950 font-extrabold' : ''
                            }`}
                          >
                            {margem.toFixed(1)}%
                            {isMargemAtual && (
                              <span className="block text-[10px] text-blue-600 font-normal">
                                (Atual)
                              </span>
                            )}
                          </th>
                        )
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {matrizSensibilidade.map((linha, linhaIdx) => {
                      const cargaLinha = linha[0].cargaTributaria
                      const isCargaAtual = Math.abs(cargaLinha - cargaTributariaTotal) < 0.01

                      return (
                        <tr
                          key={linhaIdx}
                          className={`border-b border-slate-100 hover:bg-slate-50 transition-colors ${
                            isCargaAtual ? 'bg-amber-50/40 font-semibold' : ''
                          }`}
                        >
                          {/* Coluna de Carga Tributária Fixa */}
                          <td className="p-3 font-bold text-slate-800 border-r border-slate-200 bg-slate-50/80 sticky left-0 z-10 flex items-center justify-between">
                            <span>{cargaLinha.toFixed(1)}%</span>
                            {isCargaAtual && (
                              <Badge className="bg-amber-500 text-slate-950 text-[9px] px-1 py-0 ml-1">
                                Vigente
                              </Badge>
                            )}
                          </td>

                          {/* Células da Matriz */}
                          {linha.map((item, colIdx) => {
                            const isCenarioAtual = item.isAtual
                            const precoDifVsAtual = item.precoFinal - simulacao.precoFinal

                            return (
                              <td
                                key={colIdx}
                                className={`p-3 text-center border-r border-slate-100 last:border-r-0 transition-all ${
                                  isCenarioAtual
                                    ? 'bg-blue-600 text-white font-extrabold shadow-inner scale-[1.02] ring-2 ring-blue-700'
                                    : item.precoFinal > simulacao.precoFinal
                                      ? 'hover:bg-rose-50/50'
                                      : 'hover:bg-emerald-50/50'
                                }`}
                              >
                                <div className="space-y-0.5">
                                  <div
                                    className={`text-sm font-bold ${
                                      isCenarioAtual ? 'text-white' : 'text-slate-900'
                                    }`}
                                  >
                                    R$ {item.precoFinal.toFixed(2)}
                                  </div>
                                  <div
                                    className={`text-[10px] ${
                                      isCenarioAtual
                                        ? 'text-blue-100'
                                        : precoDifVsAtual > 0
                                          ? 'text-rose-600 font-medium'
                                          : precoDifVsAtual < 0
                                            ? 'text-emerald-600 font-medium'
                                            : 'text-slate-400'
                                    }`}
                                  >
                                    {isCenarioAtual
                                      ? 'CENÁRIO ATUAL'
                                      : precoDifVsAtual > 0
                                        ? `+R$ ${precoDifVsAtual.toFixed(2)}`
                                        : `-R$ ${Math.abs(precoDifVsAtual).toFixed(2)}`}
                                  </div>
                                  <div
                                    className={`text-[9px] ${
                                      isCenarioAtual ? 'text-blue-200' : 'text-slate-400'
                                    }`}
                                  >
                                    Markup: {item.markup.toFixed(2)}x
                                  </div>
                                </div>
                              </td>
                            )
                          })}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Guia de Leitura da Matriz */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs text-slate-600 pt-2">
                <div className="p-2.5 rounded-lg bg-blue-50 border border-blue-200 flex items-start gap-2">
                  <span className="w-3 h-3 rounded bg-blue-600 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-blue-900">Célula Azul (Centro):</strong>
                    <p className="text-[11px] text-blue-700">
                      Sua precificação vigente com margem de {margemDesejadaSimulacao}% e impostos
                      de {cargaTributariaTotal}%.
                    </p>
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 flex items-start gap-2">
                  <span className="w-3 h-3 rounded bg-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-emerald-900">Quadrante Inferior Esquerdo:</strong>
                    <p className="text-[11px] text-emerald-700">
                      Menor carga e menor margem: preços de venda mais baixos e competitivos no
                      mercado.
                    </p>
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 flex items-start gap-2">
                  <span className="w-3 h-3 rounded bg-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-rose-900">Quadrante Superior Direito:</strong>
                    <p className="text-[11px] text-rose-700">
                      Maior carga e maior margem: gross-up acentuado exigindo preços de venda mais
                      elevados.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* =========================================================================
            ABA 4: MELHORIA 3 - SIMULAR ENQUADRAMENTO COM BASE NO RBT12 DO DRE
           ========================================================================= */}
        <TabsContent value="enquadramento" className="space-y-6 mt-0">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Coluna Esquerda: Status do RBT12 e Termômetro de Teto (7 colunas) */}
            <div className="lg:col-span-7 space-y-6">
              <Card className="border-slate-200/80 shadow-xs">
                <CardHeader className="pb-4 border-b border-slate-100">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                        <Activity className="w-4 h-4 text-blue-600" />
                        Apuração do Faturamento RBT12 (DRE)
                      </CardTitle>
                      <CardDescription className="text-xs">
                        Cálculo automático da receita bruta acumulada nos últimos 12 meses
                        cadastrados na DRE da empresa.
                      </CardDescription>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setPdfTipo('enquadramento_rbt12')
                        setPdfModalOpen(true)
                      }}
                      className="text-xs bg-white border-slate-300 hover:bg-slate-50 text-slate-800 font-semibold gap-1.5 shadow-2xs"
                    >
                      <FileText className="w-3.5 h-3.5 text-blue-600" />
                      Gerar PDF (A4)
                    </Button>
                  </div>
                </CardHeader>

                <CardContent className="pt-5 space-y-5">
                  {/* Card Destaque RBT12 */}
                  <div className="p-4 rounded-xl bg-slate-900 text-white space-y-3">
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span>RECEITA BRUTA ACUMULADA 12 MESES (RBT12)</span>
                      <Badge
                        className={`${
                          simulacaoRbt12.isAcimaDoTetoSimples
                            ? 'bg-rose-500 text-white'
                            : simulacaoRbt12.isProximoDoTetoSimples
                              ? 'bg-amber-500 text-slate-950'
                              : 'bg-emerald-500 text-white'
                        }`}
                      >
                        {simulacaoRbt12.isAcimaDoTetoSimples
                          ? 'Estouro de Limite'
                          : simulacaoRbt12.isProximoDoTetoSimples
                            ? 'Atenção ao Teto'
                            : 'Dentro do Limite'}
                      </Badge>
                    </div>

                    <div className="flex items-baseline justify-between">
                      <span className="text-3xl font-extrabold tracking-tight text-white">
                        {simulacaoRbt12.rbt12Formatado}
                      </span>
                      <span className="text-xs text-slate-300">
                        {simulacaoRbt12.periodoDescricao}
                      </span>
                    </div>

                    {/* Barra de Progresso do Teto LC 123/2006 */}
                    <div className="space-y-1.5 pt-2 border-t border-slate-800">
                      <div className="flex items-center justify-between text-[11px] text-slate-400">
                        <span>Uso do Teto Simples Nacional (R$ 4,8 Milhões)</span>
                        <span className="font-bold text-slate-200">
                          {simulacaoRbt12.percentualTetoSimples}%
                        </span>
                      </div>
                      <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden flex">
                        <div
                          className={`h-full transition-all duration-500 ${
                            simulacaoRbt12.isAcimaDoTetoSimples
                              ? 'bg-rose-500'
                              : simulacaoRbt12.isProximoDoTetoSimples
                                ? 'bg-amber-400'
                                : 'bg-emerald-500'
                          }`}
                          style={{
                            width: `${Math.min(100, simulacaoRbt12.percentualTetoSimples)}%`,
                          }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-slate-500">
                        <span>R$ 0,00</span>
                        <span>Sublimite Estadual: R$ 3,6M</span>
                        <span>Teto: R$ 4,8M</span>
                      </div>
                    </div>
                  </div>

                  {/* Alertas Fiscais do Enquadramento */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                      Diagnóstico de Enquadramento
                    </h4>

                    {simulacaoRbt12.alertas.map((alerta, idx) => (
                      <div
                        key={idx}
                        className={`p-3.5 rounded-xl border flex items-start gap-3 ${
                          alerta.tipo === 'danger'
                            ? 'bg-rose-50/80 border-rose-200 text-rose-950'
                            : alerta.tipo === 'warning'
                              ? 'bg-amber-50/80 border-amber-200 text-amber-950'
                              : alerta.tipo === 'success'
                                ? 'bg-emerald-50/80 border-emerald-200 text-emerald-950'
                                : 'bg-blue-50/80 border-blue-200 text-blue-950'
                        }`}
                      >
                        {alerta.tipo === 'danger' && (
                          <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                        )}
                        {alerta.tipo === 'warning' && (
                          <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                        )}
                        {alerta.tipo === 'success' && (
                          <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                        )}
                        {alerta.tipo === 'info' && (
                          <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                        )}
                        <div>
                          <h5 className="font-bold text-xs">{alerta.titulo}</h5>
                          <p className="text-xs text-slate-700 mt-0.5 leading-relaxed">
                            {alerta.mensagem}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Coluna Direita: Recomendação Técnica de Enquadramento (5 colunas) */}
            <div className="lg:col-span-5 space-y-6">
              <Card className="border-slate-200/80 shadow-xs">
                <CardHeader className="pb-3 border-b border-slate-100">
                  <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Award className="w-4 h-4 text-emerald-600" />
                    Recomendação de Regime Viável
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Com base no faturamento real apurado na DRE e regras da Receita Federal.
                  </CardDescription>
                </CardHeader>

                <CardContent className="pt-4 space-y-4">
                  {/* Card Regime Recomendado */}
                  <div className="p-4 rounded-xl bg-linear-to-b from-blue-50/40 to-white border border-blue-200 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-500 font-medium">
                        Regime Recomendado:
                      </span>
                      <Badge className="bg-blue-700 text-white font-bold text-xs">
                        {simulacaoRbt12.regimeRecomendado}
                      </Badge>
                    </div>

                    <div className="p-3 rounded-lg bg-white border border-slate-200 text-xs text-slate-700 leading-relaxed">
                      {simulacaoRbt12.motivoRecomendacao}
                    </div>

                    {/* Detalhes de Faixa e Alíquota Efetiva do Simples */}
                    <div className="space-y-1.5 pt-2 border-t border-slate-100 text-xs">
                      <div className="flex items-center justify-between text-slate-600">
                        <span>Anexo Selecionado:</span>
                        <span className="font-bold text-slate-800">{anexoSimples}</span>
                      </div>
                      <div className="flex items-center justify-between text-slate-600">
                        <span>Faixa Apurada RBT12:</span>
                        <span className="font-semibold text-slate-800">
                          {simulacaoRbt12.faixaSugeridaSimples}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-slate-600">
                        <span>Alíquota Nominal da Faixa:</span>
                        <span className="font-semibold text-slate-800">
                          {(Number(simulacaoRbt12.aliquotaNominalSimples) || 0).toFixed(2)}%
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-slate-600">
                        <span>Parcela a Deduzir:</span>
                        <span className="font-semibold text-slate-800">
                          R$ {(Number(simulacaoRbt12.deducaoSimples) || 0).toLocaleString('pt-BR')}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-blue-900 bg-blue-50/70 p-2 rounded-lg font-bold">
                        <span>Alíquota Efetiva do DAS:</span>
                        <span className="text-sm text-blue-700">
                          {(Number(simulacaoRbt12.aliquotaEfetivaSimples) || 0).toFixed(2)}%
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Botão de Aplicar Alíquota Efetiva Apurada na Formação de Preço */}
                  {simulacaoRbt12.aliquotaEfetivaSimples > 0 && (
                    <Button
                      onClick={() => {
                        setRegime('Simples Nacional')
                        setAliquotaSimples(simulacaoRbt12.aliquotaEfetivaSimples)
                        setFaixaSimples(simulacaoRbt12.faixaSugeridaSimples)
                        toast({
                          title: 'Alíquota Aplicada na Formação de Preço!',
                          description: `Alíquota efetiva do DAS (${simulacaoRbt12.aliquotaEfetivaSimples}%) aplicada com sucesso na tela de configuração.`,
                        })
                        setActiveTab('configuracao')
                      }}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                      Aplicar {simulacaoRbt12.aliquotaEfetivaSimples}% na Formação de Preço
                    </Button>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Modal de Exportação PDF Executivo A4 */}
      <ModalPdfImpostos
        open={pdfModalOpen}
        onOpenChange={setPdfModalOpen}
        tipo={pdfTipo}
        empresa={empresaAtual}
        anoBase={selectedAno || new Date().getFullYear()}
        comparativoRegimes={comparativoRegimes}
        custoBaseSimulado={custoBaseSimulacao}
        margemDesejadaSimulada={margemDesejadaSimulacao}
        despesasVariaveisSimuladas={despesasVariaveisSimulacao}
        regimeAtualConfigurado={regime}
        simulacaoRbt12={simulacaoRbt12}
        anexoSimples={anexoSimples}
      />
    </div>
  )
}
