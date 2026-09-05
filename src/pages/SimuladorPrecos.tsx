import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react'
import { useFilter } from '@/contexts/FilterContext'
import { useMinhaEmpresa } from '@/contexts/MinhaEmpresaContext'
import { useToast } from '@/hooks/use-toast'
import { useRealtime } from '@/hooks/use-realtime'
import {
  produtosService,
  fichasTecnicasService,
  materiasPrimasService,
  configuracoesTributariasService,
} from '@/services/formacaoPrecoService'
import { calcularTributosMateriaPrima } from '@/lib/taxCalculations'
import type {
  ProdutoRecord,
  FichaTecnicaRecord,
  MateriaPrimaRecord,
  ConfiguracaoTributariaRecord,
} from '@/types/finance'
import {
  Calculator,
  Percent,
  Plus,
  Trash2,
  Download,
  Printer,
  Sparkles,
  Info,
  HelpCircle,
  Package,
  Layers,
  ArrowRight,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Sliders,
  DollarSign,
  FileSpreadsheet,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'

// Parâmetros percentuais informados na coluna esquerda
export interface ParametrosMarkup {
  prazoDias: number // Prazo em dias (ex: 30 dias)
  jurosMesPct: number // Taxa de juros ao mês (%)
  icmsPct: number // %
  irpjPct: number // %
  csllPct: number // %
  pisPct: number // %
  cofinsPct: number // %
  simplesPct: number // %
  comissaoPct: number // %
  fretePct: number // %
  assistenciaPct: number // %
  outrosPct: number // %
  margemLucroPct: number // % Margem de lucro desejada
}

export const PARAMETROS_INICIAIS: ParametrosMarkup = {
  prazoDias: 30,
  jurosMesPct: 2.0,
  icmsPct: 18.0,
  irpjPct: 1.2,
  csllPct: 1.08,
  pisPct: 0.65,
  cofinsPct: 3.0,
  simplesPct: 0.0,
  comissaoPct: 3.0,
  fretePct: 2.5,
  assistenciaPct: 1.0,
  outrosPct: 1.5,
  margemLucroPct: 15.0,
}

// Item simulado na coluna direita
export interface ItemSimulado {
  id: string // id temporário ou do produto
  produtoId: string
  codigo: string
  nome: string
  unidade: string
  categoria?: string
  custoFicha: number // Custo Líquido da Ficha Técnica vinculada
  fichaId?: string
  temFicha: boolean
  precoVendaAtual?: number
}

function formatBrl(val?: number | null): string {
  if (val === undefined || val === null || isNaN(val)) return 'R$ 0,00'
  return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatPct(val?: number | null, dec: number = 2): string {
  if (val === undefined || val === null || isNaN(val)) return '0,00%'
  return `${Number(val).toLocaleString('pt-BR', { minimumFractionDigits: dec, maximumFractionDigits: dec })}%`
}

export default function SimuladorPrecos() {
  const { toast } = useToast()
  const { selectedEmpresaId, selectedEmpresa } = useFilter()
  const { minhaEmpresa, logoUrl } = useMinhaEmpresa()

  // Dados carregados do backend
  const [loading, setLoading] = useState(false)
  const [produtos, setProdutos] = useState<ProdutoRecord[]>([])
  const [fichas, setFichas] = useState<FichaTecnicaRecord[]>([])
  const [materias, setMaterias] = useState<MateriaPrimaRecord[]>([])
  const [configTributaria, setConfigTributaria] = useState<ConfiguracaoTributariaRecord | null>(
    null,
  )

  // Coluna esquerda: Parâmetros de Mark-Up
  const [params, setParams] = useState<ParametrosMarkup>(PARAMETROS_INICIAIS)

  // Coluna direita: Produtos selecionados para simulação
  const [itensSimulacao, setItensSimulacao] = useState<ItemSimulado[]>([])

  // Entrada de código(s) avulso(s) na coluna direita
  const [codigoInput, setCodigoInput] = useState<string>('')
  const [produtoBuscaSelect, setProdutoBuscaSelect] = useState<string>('')

  // Modal de Relatório PDF/A4
  const [modalPdfOpen, setModalPdfOpen] = useState(false)
  const printContainerRef = useRef<HTMLDivElement>(null)

  // Realtime para coleções de formação de preço
  useRealtime('produtos', () => {
    loadDados()
  })
  useRealtime('fichas_tecnicas', () => {
    loadDados()
  })
  useRealtime('configuracoes_tributarias', () => {
    loadDados()
  })

  // Carrega produtos, fichas e configuração tributária da empresa ativa
  const loadDados = useCallback(async () => {
    if (!selectedEmpresaId) return
    setLoading(true)
    try {
      const [prods, fchs, mats, cfg] = await Promise.all([
        produtosService.getAll(selectedEmpresaId),
        fichasTecnicasService.getAll(selectedEmpresaId),
        materiasPrimasService.getAll(selectedEmpresaId),
        configuracoesTributariasService.getByEmpresa(selectedEmpresaId),
      ])
      setProdutos(prods)
      setFichas(fchs)
      setMaterias(mats)
      setConfigTributaria(cfg)

      // Se a empresa possui configuração tributária gravada, pode pré-carregar os impostos dela
      if (cfg) {
        setParams((prev) => {
          // Se simples configurado com alíquota > 0
          const isSimples = cfg.regime_tributario === 'Simples Nacional'
          return {
            ...prev,
            simplesPct: isSimples ? cfg.aliquota_simples_efetiva || 6.0 : 0,
            icmsPct: isSimples ? 0 : (cfg.aliquota_icms ?? prev.icmsPct),
            pisPct: isSimples ? 0 : (cfg.aliquota_pis ?? prev.pisPct),
            cofinsPct: isSimples ? 0 : (cfg.aliquota_cofins ?? prev.cofinsPct),
            irpjPct: isSimples ? 0 : (cfg.aliquota_irpj ?? prev.irpjPct),
            csllPct: isSimples ? 0 : (cfg.aliquota_csll ?? prev.csllPct),
          }
        })
      }
    } catch (err) {
      console.error('Erro ao carregar dados do simulador:', err)
      toast({
        variant: 'destructive',
        title: 'Erro ao carregar dados',
        description: 'Não foi possível carregar produtos e fichas técnicas da empresa.',
      })
    } finally {
      setLoading(false)
    }
  }, [selectedEmpresaId, toast])

  useEffect(() => {
    loadDados()
  }, [loadDados])

  // Map rápido de matérias-primas
  const materiasMap = useMemo(() => {
    const map = new Map<string, MateriaPrimaRecord>()
    materias.forEach((m) => map.set(m.id, m))
    return map
  }, [materias])

  // Função auxiliar para obter o custo líquido real da ficha técnica
  const calcularCustoLiquidoFicha = useCallback(
    (ficha?: FichaTecnicaRecord | null, produto?: ProdutoRecord | null): number => {
      if (!ficha) {
        return Number(produto?.custo) || 0
      }

      // Se já possui custo_total_liquido salvo
      if (
        ficha.custo_total_liquido !== undefined &&
        ficha.custo_total_liquido !== null &&
        Number(ficha.custo_total_liquido) > 0
      ) {
        return Number(ficha.custo_total_liquido)
      }

      // Se não, calcula a partir dos insumos com deduções de créditos tributários e acréscimos
      let custoMPLiquido = 0
      if (ficha.itens && Array.isArray(ficha.itens)) {
        for (const it of ficha.itens) {
          const mp = materiasMap.get(it.materia_prima_id)
          const unitBruto = Number(it.custo_unitario) || Number(mp?.custo_unitario) || 0
          const qtd = Number(it.quantidade) || 0

          const isIsenta = Boolean(
            it.isenta_st ||
            mp?.isenta_st ||
            mp?.tipo_tributacao === 'isenta' ||
            mp?.tipo_tributacao === 'substituicao_tributaria',
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
          custoMPLiquido += qtd * trib.custoLiquido
        }
      }

      const outros = Number(ficha.outros_custos) || 0
      const totalLiq = custoMPLiquido + outros
      if (totalLiq > 0) return Math.round(totalLiq * 100) / 100

      // Fallback para custo_total ou custo do produto
      return Number(ficha.custo_total) || Number(produto?.custo) || 0
    },
    [materiasMap],
  )

  // Ao carregar produtos pela primeira vez na empresa, inicializar simulação com os produtos ativos
  useEffect(() => {
    if (produtos.length > 0 && itensSimulacao.length === 0) {
      // Pré-seleciona os primeiros produtos que tenham código ou ficha
      const iniciais: ItemSimulado[] = produtos.slice(0, 5).map((prod) => {
        const f = fichas.find((fc) => fc.produto === prod.id)
        const custoLiq = calcularCustoLiquidoFicha(f, prod)
        return {
          id: prod.id,
          produtoId: prod.id,
          codigo: prod.codigo || prod.id.slice(0, 6).toUpperCase(),
          nome: prod.nome,
          unidade: prod.unidade || 'UN',
          categoria: prod.categoria,
          custoFicha: custoLiq,
          fichaId: f?.id,
          temFicha: Boolean(f),
          precoVendaAtual: Number(prod.preco_venda) || undefined,
        }
      })
      setItensSimulacao(iniciais)
    }
  }, [produtos, fichas, calcularCustoLiquidoFicha])

  // -------------------------------------------------------------
  // CÁLCULO DO MARK-UP (DIVISOR)
  // -------------------------------------------------------------
  // Fórmula financeira clássica de Formação de Preço Divisor:
  // Juros no período = (prazoDias / 30) * jurosMesPct
  // Soma dos percentuais de deduções e margem =
  //   ICMS + IRPJ + CSLL + PIS + COFINS + Simples + Comissão + Frete + Assistência + Outros + JurosPeríodo + Margem
  // Mark-Up Divisor = (100 - SomaPercentuais) / 100 = 1 - (SomaPercentuais / 100)
  // Preço de Venda = Custo da Ficha Técnica / Mark-Up Divisor
  // Exemplo clássico: Se a soma dos percentuais for 31%, o Mark-Up Divisor é (100 - 31)/100 = 0,69 (ou fator 1/0,69 = 1,449 multiplicador)
  // O usuário pediu especificamente:
  // "nesse momento aí criar o Mark-Up. Na outra coluna eu vou informar os códigos dos produtos e você vai pegar o valor da ficha técnica e dividir pelo mark-up."
  // Portanto:
  // markUpDivisor = (100 - totalPercentuais) / 100
  // Preço = Custo / markUpDivisor.
  const calculoMarkup = useMemo(() => {
    const prazo = Math.max(0, Number(params.prazoDias) || 0)
    const jurosMes = Math.max(0, Number(params.jurosMesPct) || 0)
    // Juros proporcional ao prazo em dias
    const jurosPeriodoPct = (prazo / 30) * jurosMes

    const icms = Math.max(0, Number(params.icmsPct) || 0)
    const irpj = Math.max(0, Number(params.irpjPct) || 0)
    const csll = Math.max(0, Number(params.csllPct) || 0)
    const pis = Math.max(0, Number(params.pisPct) || 0)
    const cofins = Math.max(0, Number(params.cofinsPct) || 0)
    const simples = Math.max(0, Number(params.simplesPct) || 0)

    const totalImpostosPct = icms + irpj + csll + pis + cofins + simples

    const comissao = Math.max(0, Number(params.comissaoPct) || 0)
    const frete = Math.max(0, Number(params.fretePct) || 0)
    const assistencia = Math.max(0, Number(params.assistenciaPct) || 0)
    const outros = Math.max(0, Number(params.outrosPct) || 0)

    const totalDespesasVariaveisPct = comissao + frete + assistencia + outros + jurosPeriodoPct

    const margem = Math.max(0, Number(params.margemLucroPct) || 0)

    const totalPercentuais = totalImpostosPct + totalDespesasVariaveisPct + margem

    // Divisor: (100 - totalPercentuais) / 100
    // Evita divisão por zero ou negativa se totalPercentuais >= 100%
    const divisor = totalPercentuais < 99.99 ? (100 - totalPercentuais) / 100 : 0.01

    // Fator multiplicador equivalente (para referência didática: 1 / divisor)
    const fatorMultiplicador = divisor > 0 ? 1 / divisor : 1

    return {
      prazo,
      jurosMes,
      jurosPeriodoPct,
      icms,
      irpj,
      csll,
      pis,
      cofins,
      simples,
      totalImpostosPct,
      comissao,
      frete,
      assistencia,
      outros,
      totalDespesasVariaveisPct,
      margem,
      totalPercentuais,
      divisor: Math.round(divisor * 10000) / 10000,
      fatorMultiplicador: Math.round(fatorMultiplicador * 10000) / 10000,
      isDivisorCritico: totalPercentuais >= 90,
      isDivisorInvalido: totalPercentuais >= 100,
    }
  }, [params])

  // Simulação detalhada dos itens por produto
  const itensCalculados = useMemo(() => {
    return itensSimulacao.map((item) => {
      const custo = Math.max(0, item.custoFicha || 0)
      const divisor = calculoMarkup.divisor > 0 ? calculoMarkup.divisor : 0.01

      // Preço de venda = Custo da Ficha Técnica dividido pelo Mark-Up Divisor
      const precoSugerido = custo > 0 ? Math.round((custo / divisor) * 100) / 100 : 0

      // Componentes calculados em R$ sobre o preço de venda final
      const vImpostos = (precoSugerido * calculoMarkup.totalImpostosPct) / 100
      const vComissao = (precoSugerido * calculoMarkup.comissao) / 100
      const vFrete = (precoSugerido * calculoMarkup.frete) / 100
      const vJuros = (precoSugerido * calculoMarkup.jurosPeriodoPct) / 100
      const vAssistencia = (precoSugerido * calculoMarkup.assistencia) / 100
      const vOutros = (precoSugerido * calculoMarkup.outros) / 100
      const vMargemLucro = (precoSugerido * calculoMarkup.margem) / 100

      // Diferença em relação ao preço cadastrado no produto
      const precoAtual = item.precoVendaAtual || 0
      const diffPreco = precoAtual > 0 ? precoSugerido - precoAtual : 0
      const diffPrecoPct = precoAtual > 0 ? (diffPreco / precoAtual) * 100 : 0

      return {
        ...item,
        custo,
        divisor: calculoMarkup.divisor,
        fatorMultiplicador: calculoMarkup.fatorMultiplicador,
        precoSugerido,
        vImpostos,
        vComissao,
        vFrete,
        vJuros,
        vAssistencia,
        vOutros,
        vMargemLucro,
        diffPreco,
        diffPrecoPct,
      }
    })
  }, [itensSimulacao, calculoMarkup])

  // Totais consolidados da simulação
  const totaisSimulacao = useMemo(() => {
    const totalItens = itensCalculados.length
    const somaCustos = itensCalculados.reduce((acc, it) => acc + it.custo, 0)
    const somaPrecos = itensCalculados.reduce((acc, it) => acc + it.precoSugerido, 0)
    const somaLucros = itensCalculados.reduce((acc, it) => acc + it.vMargemLucro, 0)
    const somaImpostos = itensCalculados.reduce((acc, it) => acc + it.vImpostos, 0)
    const custoMedio = totalItens > 0 ? somaCustos / totalItens : 0
    const precoMedio = totalItens > 0 ? somaPrecos / totalItens : 0
    return {
      totalItens,
      somaCustos,
      somaPrecos,
      somaLucros,
      somaImpostos,
      custoMedio,
      precoMedio,
    }
  }, [itensCalculados])

  // -------------------------------------------------------------
  // ADICIONAR PRODUTOS POR CÓDIGO OU SELEÇÃO
  // -------------------------------------------------------------
  const handleAdicionarPorCodigo = () => {
    const raw = codigoInput.trim()
    if (!raw) return

    // Permite múltiplos códigos separados por vírgula, ponto-e-vírgula ou espaço
    const codigos = raw
      .split(/[,;\s]+/)
      .map((c) => c.trim().toLowerCase())
      .filter(Boolean)

    if (codigos.length === 0) return

    let adicionados = 0
    const novosItens: ItemSimulado[] = [...itensSimulacao]

    for (const cod of codigos) {
      // Procura produto pelo código ou nome ou id
      const prod = produtos.find(
        (p) =>
          p.codigo?.trim().toLowerCase() === cod ||
          p.id.toLowerCase() === cod ||
          p.nome.trim().toLowerCase() === cod,
      )

      if (prod) {
        // Verifica se já está na lista
        if (!novosItens.some((it) => it.produtoId === prod.id)) {
          const f = fichas.find((fc) => fc.produto === prod.id)
          const custoLiq = calcularCustoLiquidoFicha(f, prod)
          novosItens.push({
            id: prod.id,
            produtoId: prod.id,
            codigo: prod.codigo || prod.id.slice(0, 6).toUpperCase(),
            nome: prod.nome,
            unidade: prod.unidade || 'UN',
            categoria: prod.categoria,
            custoFicha: custoLiq,
            fichaId: f?.id,
            temFicha: Boolean(f),
            precoVendaAtual: Number(prod.preco_venda) || undefined,
          })
          adicionados++
        }
      } else {
        // Se o produto não foi encontrado, mas o usuário digitou um código customizado,
        // adiciona como produto avulso para permitir simulação manual
        if (!novosItens.some((it) => it.codigo.toLowerCase() === cod)) {
          novosItens.push({
            id: `custom-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
            produtoId: '',
            codigo: cod.toUpperCase(),
            nome: `Item Código ${cod.toUpperCase()}`,
            unidade: 'UN',
            custoFicha: 100.0, // custo inicial editável
            temFicha: false,
          })
          adicionados++
        }
      }
    }

    if (adicionados > 0) {
      setItensSimulacao(novosItens)
      setCodigoInput('')
      toast({
        title: `${adicionados} produto(s) adicionado(s)`,
        description: 'Custos da ficha técnica vinculados com sucesso.',
      })
    } else {
      toast({
        variant: 'destructive',
        title: 'Produto já adicionado ou não encontrado',
        description: `O(s) código(s) informado(s) já constam na tabela ou são inválidos.`,
      })
    }
  }

  const handleAdicionarPorSelect = (produtoId: string) => {
    if (!produtoId) return
    const prod = produtos.find((p) => p.id === produtoId)
    if (!prod) return

    if (itensSimulacao.some((it) => it.produtoId === prod.id)) {
      toast({
        title: 'Produto já adicionado',
        description: `"${prod.nome}" já está na tabela de simulação.`,
      })
      setProdutoBuscaSelect('')
      return
    }

    const f = fichas.find((fc) => fc.produto === prod.id)
    const custoLiq = calcularCustoLiquidoFicha(f, prod)

    setItensSimulacao((prev) => [
      ...prev,
      {
        id: prod.id,
        produtoId: prod.id,
        codigo: prod.codigo || prod.id.slice(0, 6).toUpperCase(),
        nome: prod.nome,
        unidade: prod.unidade || 'UN',
        categoria: prod.categoria,
        custoFicha: custoLiq,
        fichaId: f?.id,
        temFicha: Boolean(f),
        precoVendaAtual: Number(prod.preco_venda) || undefined,
      },
    ])
    setProdutoBuscaSelect('')
    toast({
      title: 'Produto adicionado',
      description: `"${prod.nome}" adicionado com custo da ficha técnica R$ ${custoLiq.toFixed(2)}.`,
    })
  }

  const handleAdicionarTodosComFicha = () => {
    const novos: ItemSimulado[] = []
    let addCount = 0

    for (const prod of produtos) {
      if (!itensSimulacao.some((it) => it.produtoId === prod.id)) {
        const f = fichas.find((fc) => fc.produto === prod.id)
        if (f) {
          const custoLiq = calcularCustoLiquidoFicha(f, prod)
          novos.push({
            id: prod.id,
            produtoId: prod.id,
            codigo: prod.codigo || prod.id.slice(0, 6).toUpperCase(),
            nome: prod.nome,
            unidade: prod.unidade || 'UN',
            categoria: prod.categoria,
            custoFicha: custoLiq,
            fichaId: f.id,
            temFicha: true,
            precoVendaAtual: Number(prod.preco_venda) || undefined,
          })
          addCount++
        }
      }
    }

    if (addCount > 0) {
      setItensSimulacao((prev) => [...prev, ...novos])
      toast({
        title: 'Produtos com Ficha Técnica Adicionados',
        description: `${addCount} produtos com ficha foram incluídos na simulação.`,
      })
    } else {
      toast({
        title: 'Nenhum novo produto com ficha técnica',
        description: 'Todos os produtos com ficha técnica já estão na simulação.',
      })
    }
  }

  const handleRemoverItem = (id: string) => {
    setItensSimulacao((prev) => prev.filter((it) => it.id !== id))
  }

  const handleLimparItens = () => {
    setItensSimulacao([])
  }

  const handleEditarCustoManual = (id: string, novoCusto: number) => {
    setItensSimulacao((prev) =>
      prev.map((it) => (it.id === id ? { ...it, custoFicha: Math.max(0, novoCusto) } : it)),
    )
  }

  // Predefinições rápidas de regime de mark-up
  const handleAplicarPreset = (preset: 'simples' | 'presumido' | 'lucroReal' | 'comercio') => {
    if (preset === 'simples') {
      setParams({
        ...params,
        simplesPct: 6.0,
        icmsPct: 0,
        pisPct: 0,
        cofinsPct: 0,
        irpjPct: 0,
        csllPct: 0,
        comissaoPct: 3.0,
        fretePct: 2.0,
        assistenciaPct: 1.0,
        outrosPct: 1.0,
        margemLucroPct: 18.0,
      })
    } else if (preset === 'presumido') {
      setParams({
        ...params,
        simplesPct: 0,
        icmsPct: 18.0,
        pisPct: 0.65,
        cofinsPct: 3.0,
        irpjPct: 1.2,
        csllPct: 1.08,
        comissaoPct: 3.5,
        fretePct: 2.5,
        assistenciaPct: 1.0,
        outrosPct: 1.5,
        margemLucroPct: 15.0,
      })
    } else if (preset === 'lucroReal') {
      setParams({
        ...params,
        simplesPct: 0,
        icmsPct: 18.0,
        pisPct: 1.65,
        cofinsPct: 7.6,
        irpjPct: 0, // No lucro real IRPJ é apurado trimestralmente sobre o resultado
        csllPct: 0,
        comissaoPct: 4.0,
        fretePct: 3.0,
        assistenciaPct: 1.5,
        outrosPct: 2.0,
        margemLucroPct: 15.0,
      })
    } else if (preset === 'comercio') {
      setParams({
        ...params,
        prazoDias: 45,
        jurosMesPct: 2.2,
        comissaoPct: 5.0,
        fretePct: 3.5,
        assistenciaPct: 1.5,
        outrosPct: 2.0,
        margemLucroPct: 20.0,
      })
    }
  }

  // -------------------------------------------------------------
  // EXPORTAÇÃO CSV
  // -------------------------------------------------------------
  const handleExportarCsv = () => {
    if (itensCalculados.length === 0) {
      toast({
        variant: 'destructive',
        title: 'Nenhum item para exportar',
        description: 'Adicione pelo menos um produto na simulação para exportar.',
      })
      return
    }

    const escapeCsv = (val: any): string => {
      if (val === null || val === undefined) return ''
      const s = String(val)
      if (/[;"\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
      return s
    }

    const fmtNum = (n?: number) =>
      n !== undefined && n !== null
        ? n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        : ''

    const linhas: string[] = [
      ['SIMULADOR DE PREÇOS & FORMAÇÃO DE MARK-UP'].map(escapeCsv).join(';'),
      [
        'Empresa',
        selectedEmpresa?.nome ||
          selectedEmpresa?.razao_social ||
          minhaEmpresa?.razao_social ||
          'Empresa Ativa',
        '',
      ]
        .map(escapeCsv)
        .join(';'),
      ['Data de Emissão', new Date().toLocaleDateString('pt-BR'), ''].map(escapeCsv).join(';'),
      '',
      ['PARÂMETROS DE MARK-UP UTILIZADOS', '', ''].map(escapeCsv).join(';'),
      ['Parâmetro', 'Percentual (%)', 'Observação'].map(escapeCsv).join(';'),
      ['Prazo Médio de Venda', `${params.prazoDias} dias`, 'Base de cálculo de juros']
        .map(escapeCsv)
        .join(';'),
      ['Juros ao Mês', `${params.jurosMesPct.toFixed(2)}% a.m.`, 'Taxa mensal']
        .map(escapeCsv)
        .join(';'),
      [
        'Juros no Período Proporcional',
        `${calculoMarkup.jurosPeriodoPct.toFixed(2)}%`,
        `Prazo de ${params.prazoDias} dias`,
      ]
        .map(escapeCsv)
        .join(';'),
      ['ICMS', `${params.icmsPct.toFixed(2)}%`, 'Imposto Estadual'].map(escapeCsv).join(';'),
      ['IRPJ', `${params.irpjPct.toFixed(2)}%`, 'Imposto de Renda'].map(escapeCsv).join(';'),
      ['CSLL', `${params.csllPct.toFixed(2)}%`, 'Contribuição Social'].map(escapeCsv).join(';'),
      ['PIS', `${params.pisPct.toFixed(2)}%`, 'PIS Faturamento'].map(escapeCsv).join(';'),
      ['COFINS', `${params.cofinsPct.toFixed(2)}%`, 'COFINS Faturamento'].map(escapeCsv).join(';'),
      ['Simples Nacional', `${params.simplesPct.toFixed(2)}%`, 'Guia única DAS']
        .map(escapeCsv)
        .join(';'),
      ['Total de Impostos', `${calculoMarkup.totalImpostosPct.toFixed(2)}%`, 'Soma tributos']
        .map(escapeCsv)
        .join(';'),
      ['Comissão', `${params.comissaoPct.toFixed(2)}%`, 'Despesa variável']
        .map(escapeCsv)
        .join(';'),
      ['Frete Vendas', `${params.fretePct.toFixed(2)}%`, 'Despesa variável']
        .map(escapeCsv)
        .join(';'),
      ['Assistência Técnica', `${params.assistenciaPct.toFixed(2)}%`, 'Despesa variável']
        .map(escapeCsv)
        .join(';'),
      ['Outros Encargos', `${params.outrosPct.toFixed(2)}%`, 'Despesa variável']
        .map(escapeCsv)
        .join(';'),
      ['Margem de Lucro Desejada', `${params.margemLucroPct.toFixed(2)}%`, 'Margem líquida']
        .map(escapeCsv)
        .join(';'),
      [
        'Soma Total de Deduções + Margem',
        `${calculoMarkup.totalPercentuais.toFixed(2)}%`,
        'Soma geral',
      ]
        .map(escapeCsv)
        .join(';'),
      [
        'MARK-UP DIVISOR RESULTANTE',
        `${calculoMarkup.divisor.toFixed(4)}`,
        'Fórmula: (100 - Soma%) / 100',
      ]
        .map(escapeCsv)
        .join(';'),
      [
        'Fator Multiplicador Equivalente',
        `${calculoMarkup.fatorMultiplicador.toFixed(4)}`,
        '1 / Mark-Up Divisor',
      ]
        .map(escapeCsv)
        .join(';'),
      '',
      ['RESULTADO DA SIMULAÇÃO POR PRODUTO', '', ''].map(escapeCsv).join(';'),
      [
        'Código',
        'Produto',
        'Unidade',
        'Custo Ficha Técnica (R$)',
        'Mark-Up Divisor',
        'Preço de Venda Sugerido (R$)',
        'Preço Atual Cadastrado (R$)',
        'Diferença Preço (R$)',
        'Impostos (R$)',
        'Comissão (R$)',
        'Frete (R$)',
        'Juros Período (R$)',
        'Margem de Lucro (R$)',
        'Possui Ficha Técnica',
      ]
        .map(escapeCsv)
        .join(';'),
    ]

    for (const it of itensCalculados) {
      linhas.push(
        [
          it.codigo,
          it.nome,
          it.unidade,
          fmtNum(it.custo),
          it.divisor.toFixed(4),
          fmtNum(it.precoSugerido),
          fmtNum(it.precoVendaAtual),
          fmtNum(it.diffPreco),
          fmtNum(it.vImpostos),
          fmtNum(it.vComissao),
          fmtNum(it.vFrete),
          fmtNum(it.vJuros),
          fmtNum(it.vMargemLucro),
          it.temFicha ? 'Sim' : 'Não (Custo Base/Manual)',
        ]
          .map(escapeCsv)
          .join(';'),
      )
    }

    linhas.push('')
    linhas.push(
      [
        'TOTAIS',
        `Qtd Itens: ${totaisSimulacao.totalItens}`,
        '',
        fmtNum(totaisSimulacao.somaCustos),
        '',
        fmtNum(totaisSimulacao.somaPrecos),
        '',
        '',
        fmtNum(totaisSimulacao.somaImpostos),
        '',
        '',
        '',
        fmtNum(totaisSimulacao.somaLucros),
      ]
        .map(escapeCsv)
        .join(';'),
    )

    const blob = new Blob(['\uFEFF' + linhas.join('\r\n')], {
      type: 'text/csv;charset=utf-8;',
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.setAttribute('href', url)
    link.setAttribute(
      'download',
      `simulador_precos_${selectedEmpresa?.nome?.replace(/\s+/g, '_') || 'empresa'}_${new Date().toISOString().slice(0, 10)}.csv`,
    )
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)

    toast({
      title: 'Exportação CSV gerada!',
      description: 'O arquivo com os parâmetros de mark-up e produtos foi baixado com sucesso.',
    })
  }

  // Impressão A4 do relatório
  const handleImprimirA4 = () => {
    window.print()
  }

  return (
    <TooltipProvider>
      <div className="space-y-6 max-w-7xl mx-auto pb-12">
        {/* CABEÇALHO */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold">
                <Calculator className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                  Simulador de Preços
                  <Badge
                    variant="outline"
                    className="bg-amber-50 text-amber-700 border-amber-200 text-xs"
                  >
                    Mark-Up Divisor
                  </Badge>
                </h1>
                <p className="text-xs text-slate-500">
                  Defina os parâmetros percentuais na coluna esquerda e simule o preço de venda dos
                  produtos pela ficha técnica.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportarCsv}
              disabled={itensCalculados.length === 0}
              className="text-xs gap-1.5 border-slate-300 hover:bg-slate-50 text-slate-700 font-medium"
            >
              <Download className="w-4 h-4 text-emerald-600" />
              Exportar CSV
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setModalPdfOpen(true)}
              disabled={itensCalculados.length === 0}
              className="text-xs gap-1.5 border-slate-300 hover:bg-slate-50 text-slate-700 font-medium"
            >
              <Printer className="w-4 h-4 text-blue-600" />
              Relatório A4
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={loadDados}
              disabled={loading}
              className="text-xs gap-1 text-slate-600 hover:text-slate-900"
              title="Recarregar dados"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        {/* ALERTA CASO TOTAL DE PERCENTUAIS SEJA CRÍTICO */}
        {calculoMarkup.isDivisorCritico && (
          <div className="p-4 rounded-xl border border-amber-300 bg-amber-50 text-amber-900 text-xs flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-amber-950">
                Atenção à soma de percentuais ({formatPct(calculoMarkup.totalPercentuais)})
              </p>
              <p className="text-amber-800 mt-0.5">
                A soma dos impostos, despesas e margem está muito próxima ou excede 100%, gerando um
                divisor muito baixo ({calculoMarkup.divisor.toFixed(4)}), o que eleva
                exponencialmente o preço final. Revise os percentuais para obter um mark-up
                equilibrado.
              </p>
            </div>
          </div>
        )}

        {/* DUAS COLUNAS PRINCIPAIS */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* ========================================================= */}
          {/* COLUNA ESQUERDA: PARÂMETROS DE MARK-UP (5 colunas no lg) */}
          {/* ========================================================= */}
          <div className="lg:col-span-5 space-y-4">
            <Card className="border-slate-200 shadow-xs bg-white">
              <CardHeader className="pb-3 border-b border-slate-100">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-amber-600" />
                    <CardTitle className="text-sm font-bold text-slate-800">
                      1. Parâmetros de Mark-Up
                    </CardTitle>
                  </div>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button className="text-slate-400 hover:text-slate-600">
                        <HelpCircle className="w-4 h-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs text-xs">
                      Preencha os percentuais que incidem sobre o preço de venda. O Mark-Up Divisor
                      é calculado por: (100% - Total Deduções%) / 100.
                    </TooltipContent>
                  </Tooltip>
                </div>
                <CardDescription className="text-xs text-slate-500">
                  Informe prazo, juros e os percentuais de impostos, despesas variáveis e margem.
                </CardDescription>

                {/* Atalhos de Predefinição */}
                <div className="flex items-center gap-1.5 pt-2 flex-wrap">
                  <span className="text-[10px] text-slate-400 font-semibold uppercase">
                    Predefinições:
                  </span>
                  <button
                    type="button"
                    onClick={() => handleAplicarPreset('simples')}
                    className="text-[11px] px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 transition-colors"
                  >
                    Simples Nac.
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAplicarPreset('presumido')}
                    className="text-[11px] px-2 py-0.5 rounded bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 transition-colors"
                  >
                    Presumido
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAplicarPreset('lucroReal')}
                    className="text-[11px] px-2 py-0.5 rounded bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200 transition-colors"
                  >
                    Lucro Real
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAplicarPreset('comercio')}
                    className="text-[11px] px-2 py-0.5 rounded bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200 transition-colors"
                  >
                    Comércio 45d
                  </button>
                  <button
                    type="button"
                    onClick={() => setParams(PARAMETROS_INICIAIS)}
                    title="Restaurar padrão"
                    className="text-[11px] px-1.5 py-0.5 rounded text-slate-500 hover:bg-slate-100 border border-slate-200"
                  >
                    <RotateCcw className="w-3 h-3 inline" />
                  </button>
                </div>
              </CardHeader>

              <CardContent className="space-y-4 pt-4 text-xs">
                {/* 1.1 Prazo e Juros ao mês */}
                <div className="bg-slate-50/80 p-3 rounded-xl border border-slate-100 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                      <DollarSign className="w-3.5 h-3.5 text-blue-600" />
                      Prazo & Custo Financeiro
                    </span>
                    <Badge variant="secondary" className="text-[10px] bg-blue-100 text-blue-800">
                      Juros Período: {formatPct(calculoMarkup.jurosPeriodoPct)}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-[11px] text-slate-600 font-medium">
                        Prazo de Venda (dias)
                      </Label>
                      <div className="relative mt-1">
                        <Input
                          type="number"
                          min="0"
                          step="1"
                          value={params.prazoDias}
                          onChange={(e) =>
                            setParams({
                              ...params,
                              prazoDias: Math.max(0, Number(e.target.value) || 0),
                            })
                          }
                          className="h-8 text-xs font-semibold pr-12"
                        />
                        <span className="absolute right-2.5 top-2 text-[10px] text-slate-400 font-medium">
                          dias
                        </span>
                      </div>
                    </div>

                    <div>
                      <Label className="text-[11px] text-slate-600 font-medium">
                        Juros ao Mês (%)
                      </Label>
                      <div className="relative mt-1">
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={params.jurosMesPct}
                          onChange={(e) =>
                            setParams({
                              ...params,
                              jurosMesPct: Math.max(0, Number(e.target.value) || 0),
                            })
                          }
                          className="h-8 text-xs font-semibold pr-7"
                        />
                        <span className="absolute right-2.5 top-2 text-[10px] text-slate-400 font-medium">
                          %
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 1.2 Impostos e Encargos Fiscais */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                      <Percent className="w-3.5 h-3.5 text-purple-600" />
                      Tributos sobre a Venda (%)
                    </span>
                    <span className="text-[11px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                      Total: {formatPct(calculoMarkup.totalImpostosPct)}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-1">
                    <div>
                      <Label className="text-[11px] text-slate-600">ICMS (%)</Label>
                      <div className="relative mt-0.5">
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={params.icmsPct}
                          onChange={(e) =>
                            setParams({
                              ...params,
                              icmsPct: Math.max(0, Number(e.target.value) || 0),
                            })
                          }
                          className="h-7 text-xs font-medium pr-6"
                        />
                        <span className="absolute right-2 top-1.5 text-[10px] text-slate-400">
                          %
                        </span>
                      </div>
                    </div>

                    <div>
                      <Label className="text-[11px] text-slate-600">IRPJ (%)</Label>
                      <div className="relative mt-0.5">
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={params.irpjPct}
                          onChange={(e) =>
                            setParams({
                              ...params,
                              irpjPct: Math.max(0, Number(e.target.value) || 0),
                            })
                          }
                          className="h-7 text-xs font-medium pr-6"
                        />
                        <span className="absolute right-2 top-1.5 text-[10px] text-slate-400">
                          %
                        </span>
                      </div>
                    </div>

                    <div>
                      <Label className="text-[11px] text-slate-600">CSLL (%)</Label>
                      <div className="relative mt-0.5">
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={params.csllPct}
                          onChange={(e) =>
                            setParams({
                              ...params,
                              csllPct: Math.max(0, Number(e.target.value) || 0),
                            })
                          }
                          className="h-7 text-xs font-medium pr-6"
                        />
                        <span className="absolute right-2 top-1.5 text-[10px] text-slate-400">
                          %
                        </span>
                      </div>
                    </div>

                    <div>
                      <Label className="text-[11px] text-slate-600">PIS (%)</Label>
                      <div className="relative mt-0.5">
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={params.pisPct}
                          onChange={(e) =>
                            setParams({
                              ...params,
                              pisPct: Math.max(0, Number(e.target.value) || 0),
                            })
                          }
                          className="h-7 text-xs font-medium pr-6"
                        />
                        <span className="absolute right-2 top-1.5 text-[10px] text-slate-400">
                          %
                        </span>
                      </div>
                    </div>

                    <div>
                      <Label className="text-[11px] text-slate-600">COFINS (%)</Label>
                      <div className="relative mt-0.5">
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={params.cofinsPct}
                          onChange={(e) =>
                            setParams({
                              ...params,
                              cofinsPct: Math.max(0, Number(e.target.value) || 0),
                            })
                          }
                          className="h-7 text-xs font-medium pr-6"
                        />
                        <span className="absolute right-2 top-1.5 text-[10px] text-slate-400">
                          %
                        </span>
                      </div>
                    </div>

                    <div>
                      <Label className="text-[11px] text-slate-600">Simples (%)</Label>
                      <div className="relative mt-0.5">
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={params.simplesPct}
                          onChange={(e) =>
                            setParams({
                              ...params,
                              simplesPct: Math.max(0, Number(e.target.value) || 0),
                            })
                          }
                          className="h-7 text-xs font-medium pr-6"
                        />
                        <span className="absolute right-2 top-1.5 text-[10px] text-slate-400">
                          %
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 1.3 Despesas Variáveis & Operacionais */}
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-emerald-600" />
                      Despesas Variáveis de Venda (%)
                    </span>
                    <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      Total: {formatPct(calculoMarkup.totalDespesasVariaveisPct)}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
                    <div>
                      <Label className="text-[11px] text-slate-600">Comissão (%)</Label>
                      <div className="relative mt-0.5">
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={params.comissaoPct}
                          onChange={(e) =>
                            setParams({
                              ...params,
                              comissaoPct: Math.max(0, Number(e.target.value) || 0),
                            })
                          }
                          className="h-7 text-xs font-medium pr-6"
                        />
                        <span className="absolute right-2 top-1.5 text-[10px] text-slate-400">
                          %
                        </span>
                      </div>
                    </div>

                    <div>
                      <Label className="text-[11px] text-slate-600">Frete (%)</Label>
                      <div className="relative mt-0.5">
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={params.fretePct}
                          onChange={(e) =>
                            setParams({
                              ...params,
                              fretePct: Math.max(0, Number(e.target.value) || 0),
                            })
                          }
                          className="h-7 text-xs font-medium pr-6"
                        />
                        <span className="absolute right-2 top-1.5 text-[10px] text-slate-400">
                          %
                        </span>
                      </div>
                    </div>

                    <div>
                      <Label className="text-[11px] text-slate-600">Assistência (%)</Label>
                      <div className="relative mt-0.5">
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={params.assistenciaPct}
                          onChange={(e) =>
                            setParams({
                              ...params,
                              assistenciaPct: Math.max(0, Number(e.target.value) || 0),
                            })
                          }
                          className="h-7 text-xs font-medium pr-6"
                        />
                        <span className="absolute right-2 top-1.5 text-[10px] text-slate-400">
                          %
                        </span>
                      </div>
                    </div>

                    <div>
                      <Label className="text-[11px] text-slate-600">Outros (%)</Label>
                      <div className="relative mt-0.5">
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={params.outrosPct}
                          onChange={(e) =>
                            setParams({
                              ...params,
                              outrosPct: Math.max(0, Number(e.target.value) || 0),
                            })
                          }
                          className="h-7 text-xs font-medium pr-6"
                        />
                        <span className="absolute right-2 top-1.5 text-[10px] text-slate-400">
                          %
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 1.4 Margem de Lucro Desejada */}
                <div className="p-3 bg-amber-50/60 rounded-xl border border-amber-200/80 space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                      Margem de Lucro Desejada (%)
                    </Label>
                    <span className="text-xs font-extrabold text-amber-800">
                      {formatPct(params.margemLucroPct)}
                    </span>
                  </div>
                  <div className="relative">
                    <Input
                      type="number"
                      min="0"
                      max="99"
                      step="0.1"
                      value={params.margemLucroPct}
                      onChange={(e) =>
                        setParams({
                          ...params,
                          margemLucroPct: Math.max(0, Number(e.target.value) || 0),
                        })
                      }
                      className="h-8 text-xs font-bold bg-white border-amber-300 focus-visible:ring-amber-500 pr-7"
                    />
                    <span className="absolute right-2.5 top-2 text-[10px] font-bold text-amber-700">
                      %
                    </span>
                  </div>
                </div>

                {/* RESUMO RESULTANTE DO MARK-UP */}
                <div className="p-4 rounded-xl bg-linear-to-br from-slate-900 to-[#0B1F3A] text-white shadow-md space-y-3">
                  <div className="flex items-center justify-between border-b border-white/10 pb-2">
                    <span className="text-xs font-semibold text-slate-300">
                      Mark-Up Divisor Resultante
                    </span>
                    <Badge className="bg-amber-400 text-slate-900 font-bold hover:bg-amber-400">
                      Fator Divisor
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-3 items-center">
                    <div>
                      <p className="text-[10px] text-slate-400 uppercase font-semibold">
                        Mark-Up Divisor
                      </p>
                      <p className="text-2xl font-black text-amber-300 tracking-tight">
                        {calculoMarkup.divisor.toFixed(4)}
                      </p>
                      <p className="text-[10px] text-slate-400">
                        (100% - {calculoMarkup.totalPercentuais.toFixed(2)}%) / 100
                      </p>
                    </div>

                    <div className="border-l border-white/10 pl-3">
                      <p className="text-[10px] text-slate-400 uppercase font-semibold">
                        Fator Multiplicador
                      </p>
                      <p className="text-lg font-bold text-white">
                        {calculoMarkup.fatorMultiplicador.toFixed(4)}x
                      </p>
                      <p className="text-[10px] text-slate-400">1 ÷ Mark-Up Divisor</p>
                    </div>
                  </div>

                  <div className="bg-white/5 rounded-lg p-2.5 text-[11px] space-y-1 font-mono">
                    <div className="flex justify-between text-slate-300">
                      <span>Total Impostos:</span>
                      <span className="font-semibold text-purple-300">
                        {formatPct(calculoMarkup.totalImpostosPct)}
                      </span>
                    </div>
                    <div className="flex justify-between text-slate-300">
                      <span>Total Despesas + Juros:</span>
                      <span className="font-semibold text-emerald-300">
                        {formatPct(calculoMarkup.totalDespesasVariaveisPct)}
                      </span>
                    </div>
                    <div className="flex justify-between text-slate-300">
                      <span>Margem de Lucro:</span>
                      <span className="font-semibold text-amber-300">
                        {formatPct(calculoMarkup.margem)}
                      </span>
                    </div>
                    <div className="flex justify-between text-white font-bold pt-1 border-t border-white/10">
                      <span>Soma Deduções + Lucro:</span>
                      <span>{formatPct(calculoMarkup.totalPercentuais)}</span>
                    </div>
                  </div>

                  <div className="text-[10px] text-slate-300/80 bg-white/5 p-2 rounded">
                    <strong>Regra aplicada:</strong> Preço de Venda = Custo da Ficha Técnica ÷{' '}
                    <span className="text-amber-300 font-bold">
                      {calculoMarkup.divisor.toFixed(4)}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* ========================================================= */}
          {/* COLUNA DIREITA: SIMULAÇÃO POR PRODUTO (7 colunas no lg)   */}
          {/* ========================================================= */}
          <div className="lg:col-span-7 space-y-4">
            <Card className="border-slate-200 shadow-xs bg-white">
              <CardHeader className="pb-3 border-b border-slate-100">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Package className="w-4 h-4 text-blue-600" />
                    <div>
                      <CardTitle className="text-sm font-bold text-slate-800">
                        2. Simulação por Produto
                      </CardTitle>
                      <CardDescription className="text-xs text-slate-500">
                        Informe o código do produto para buscar o custo da ficha técnica e calcular
                        o preço.
                      </CardDescription>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleAdicionarTodosComFicha}
                      className="h-7 text-[11px] gap-1 text-slate-700"
                      title="Adicionar todos os produtos que possuem ficha técnica cadastrada"
                    >
                      <Layers className="w-3 h-3 text-blue-600" />
                      Todos com Ficha
                    </Button>
                    {itensSimulacao.length > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleLimparItens}
                        className="h-7 text-[11px] text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        Limpar Lista
                      </Button>
                    )}
                  </div>
                </div>

                {/* BARRA DE ENTRADA DE CÓDIGO E BUSCA */}
                <div className="pt-3 grid grid-cols-1 sm:grid-cols-12 gap-2">
                  <div className="sm:col-span-7 flex gap-1.5">
                    <div className="relative flex-1">
                      <Input
                        type="text"
                        placeholder="Digitar código(s) (ex: PRD-01, PRD-02)..."
                        value={codigoInput}
                        onChange={(e) => setCodigoInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            handleAdicionarPorCodigo()
                          }
                        }}
                        className="h-8 text-xs font-mono uppercase"
                      />
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleAdicionarPorCodigo}
                      className="h-8 text-xs bg-blue-600 hover:bg-blue-700 text-white shrink-0 gap-1 px-3"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Inserir Código
                    </Button>
                  </div>

                  <div className="sm:col-span-5">
                    <select
                      value={produtoBuscaSelect}
                      onChange={(e) => {
                        const val = e.target.value
                        setProdutoBuscaSelect(val)
                        if (val) handleAdicionarPorSelect(val)
                      }}
                      className="w-full h-8 text-xs rounded-md border border-slate-200 bg-white px-2.5 py-1 text-slate-800 shadow-xs focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="">Ou buscar na lista da empresa...</option>
                      {produtos.map((p) => {
                        const temF = fichas.some((fc) => fc.produto === p.id)
                        return (
                          <option key={p.id} value={p.id}>
                            {p.codigo ? `[${p.codigo}] ` : ''}
                            {p.nome}
                            {temF ? ' (com ficha)' : ''}
                          </option>
                        )
                      })}
                    </select>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="p-0">
                {itensCalculados.length === 0 ? (
                  <div className="py-12 px-4 text-center">
                    <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3 text-slate-400">
                      <Search className="w-6 h-6" />
                    </div>
                    <h4 className="text-sm font-semibold text-slate-700">
                      Nenhum produto adicionado
                    </h4>
                    <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
                      Digite um ou mais códigos de produtos no campo acima ou selecione na lista da
                      empresa para carregar os custos das fichas técnicas e simular.
                    </p>
                    <div className="mt-4 flex justify-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleAdicionarTodosComFicha}
                        className="text-xs gap-1.5"
                      >
                        <Layers className="w-3.5 h-3.5 text-blue-600" />
                        Carregar produtos com ficha técnica
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader className="bg-slate-50">
                        <TableRow className="text-[11px] text-slate-600">
                          <TableHead className="w-[100px] font-bold">Código</TableHead>
                          <TableHead className="min-w-[150px] font-bold">Produto</TableHead>
                          <TableHead className="text-right font-bold">Custo Ficha</TableHead>
                          <TableHead className="text-center font-bold">Mark-Up Divisor</TableHead>
                          <TableHead className="text-right font-bold text-emerald-700 bg-emerald-50/70">
                            Preço Sugerido
                          </TableHead>
                          <TableHead className="text-right font-bold">Preço Atual</TableHead>
                          <TableHead className="text-right font-bold">Margem R$</TableHead>
                          <TableHead className="text-right font-bold">Impostos R$</TableHead>
                          <TableHead className="w-[50px] text-center"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {itensCalculados.map((it) => (
                          <TableRow key={it.id} className="text-xs hover:bg-slate-50/80">
                            <TableCell className="font-mono font-semibold text-slate-900">
                              <div className="flex items-center gap-1.5">
                                <Badge
                                  variant="outline"
                                  className="font-mono text-[10px] px-1.5 py-0"
                                >
                                  {it.codigo}
                                </Badge>
                              </div>
                            </TableCell>

                            <TableCell>
                              <div
                                className="font-medium text-slate-900 truncate max-w-[200px]"
                                title={it.nome}
                              >
                                {it.nome}
                              </div>
                              <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                                <span>{it.unidade}</span>
                                {it.temFicha ? (
                                  <Badge className="bg-emerald-100 text-emerald-800 border-none text-[9px] px-1 py-0 h-4">
                                    Ficha Líquida
                                  </Badge>
                                ) : (
                                  <Badge
                                    variant="outline"
                                    className="text-slate-500 border-slate-200 text-[9px] px-1 py-0 h-4"
                                  >
                                    Manual
                                  </Badge>
                                )}
                              </div>
                            </TableCell>

                            <TableCell className="text-right">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="inline-flex items-center gap-1">
                                    <input
                                      type="number"
                                      step="0.01"
                                      value={it.custo}
                                      onChange={(e) =>
                                        handleEditarCustoManual(it.id, Number(e.target.value) || 0)
                                      }
                                      className="w-20 text-right font-semibold text-slate-800 border border-transparent hover:border-slate-300 focus:border-blue-500 focus:bg-white rounded px-1 py-0.5 text-xs bg-slate-50"
                                    />
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent className="text-[11px]">
                                  {it.temFicha
                                    ? 'Custo líquido apurado pela Ficha Técnica (clique para editar avulso)'
                                    : 'Custo base cadastrado no produto (editável)'}
                                </TooltipContent>
                              </Tooltip>
                            </TableCell>

                            <TableCell className="text-center font-mono font-bold text-amber-700 bg-amber-50/40">
                              ÷ {it.divisor.toFixed(4)}
                            </TableCell>

                            <TableCell className="text-right font-bold text-emerald-700 bg-emerald-50/50 text-sm">
                              {formatBrl(it.precoSugerido)}
                            </TableCell>

                            <TableCell className="text-right text-slate-600">
                              {it.precoVendaAtual && it.precoVendaAtual > 0 ? (
                                <div>
                                  <span className="font-medium">
                                    {formatBrl(it.precoVendaAtual)}
                                  </span>
                                  {it.diffPreco !== 0 && (
                                    <div
                                      className={`text-[10px] font-semibold ${
                                        it.diffPreco > 0 ? 'text-emerald-600' : 'text-red-500'
                                      }`}
                                    >
                                      {it.diffPreco > 0 ? '+' : ''}
                                      {formatBrl(it.diffPreco)} ({it.diffPrecoPct.toFixed(1)}%)
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <span className="text-slate-400">—</span>
                              )}
                            </TableCell>

                            <TableCell className="text-right font-medium text-amber-700">
                              {formatBrl(it.vMargemLucro)}
                            </TableCell>

                            <TableCell className="text-right text-purple-700 font-medium">
                              {formatBrl(it.vImpostos)}
                            </TableCell>

                            <TableCell className="text-center">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRemoverItem(it.id)}
                                className="h-7 w-7 p-0 text-slate-400 hover:text-red-600"
                                title="Remover item da simulação"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>

              {itensCalculados.length > 0 && (
                <CardFooter className="bg-slate-50/90 border-t border-slate-200 py-3 px-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-4 text-slate-600 flex-wrap">
                    <span>
                      Total de produtos:{' '}
                      <strong className="text-slate-900">{totaisSimulacao.totalItens}</strong>
                    </span>
                    <span>
                      Soma Custo Ficha:{' '}
                      <strong className="text-slate-900">
                        {formatBrl(totaisSimulacao.somaCustos)}
                      </strong>
                    </span>
                    <span>
                      Soma Preço Sugerido:{' '}
                      <strong className="text-emerald-700 font-bold">
                        {formatBrl(totaisSimulacao.somaPrecos)}
                      </strong>
                    </span>
                  </div>

                  <div className="flex items-center gap-3 text-slate-600">
                    <span>
                      Lucro Total Estimado:{' '}
                      <strong className="text-amber-700 font-bold">
                        {formatBrl(totaisSimulacao.somaLucros)}
                      </strong>
                    </span>
                  </div>
                </CardFooter>
              )}
            </Card>

            {/* MEMÓRIA DE CÁLCULO E DETALHAMENTO DOS ENCARGOS */}
            {itensCalculados.length > 0 && (
              <Card className="border-slate-200 shadow-xs bg-white">
                <CardHeader className="py-3 px-4 border-b border-slate-100">
                  <CardTitle className="text-xs font-bold text-slate-800 flex items-center gap-2">
                    <Info className="w-4 h-4 text-blue-600" />
                    Detalhamento dos Componentes do Preço Sugerido
                  </CardTitle>
                  <CardDescription className="text-[11px] text-slate-500">
                    Distribuição dos encargos em R$ sobre o preço de venda para cada produto
                    informado.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader className="bg-slate-50/70">
                        <TableRow className="text-[10px] text-slate-600">
                          <TableHead className="font-bold">Produto</TableHead>
                          <TableHead className="text-right font-bold text-purple-700">
                            Impostos ({formatPct(calculoMarkup.totalImpostosPct)})
                          </TableHead>
                          <TableHead className="text-right font-bold text-slate-700">
                            Comissão ({formatPct(calculoMarkup.comissao)})
                          </TableHead>
                          <TableHead className="text-right font-bold text-slate-700">
                            Frete ({formatPct(calculoMarkup.frete)})
                          </TableHead>
                          <TableHead className="text-right font-bold text-blue-700">
                            Juros ({formatPct(calculoMarkup.jurosPeriodoPct)})
                          </TableHead>
                          <TableHead className="text-right font-bold text-slate-700">
                            Ass./Outros (
                            {formatPct(calculoMarkup.assistencia + calculoMarkup.outros)})
                          </TableHead>
                          <TableHead className="text-right font-bold text-amber-700">
                            Margem Líquida ({formatPct(calculoMarkup.margem)})
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {itensCalculados.map((it) => (
                          <TableRow key={it.id} className="text-xs">
                            <TableCell className="font-medium text-slate-800">
                              <span className="font-mono text-[10px] text-slate-500 mr-1.5">
                                [{it.codigo}]
                              </span>
                              {it.nome}
                            </TableCell>
                            <TableCell className="text-right font-mono text-purple-700">
                              {formatBrl(it.vImpostos)}
                            </TableCell>
                            <TableCell className="text-right font-mono text-slate-600">
                              {formatBrl(it.vComissao)}
                            </TableCell>
                            <TableCell className="text-right font-mono text-slate-600">
                              {formatBrl(it.vFrete)}
                            </TableCell>
                            <TableCell className="text-right font-mono text-blue-700 font-semibold">
                              {formatBrl(it.vJuros)}
                            </TableCell>
                            <TableCell className="text-right font-mono text-slate-600">
                              {formatBrl(it.vAssistencia + it.vOutros)}
                            </TableCell>
                            <TableCell className="text-right font-mono text-amber-700 font-bold">
                              {formatBrl(it.vMargemLucro)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* MODAL / RELATÓRIO A4 PARA IMPRESSÃO E LAUDO */}
        <Dialog open={modalPdfOpen} onOpenChange={setModalPdfOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-6">
            <DialogHeader className="border-b pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <Printer className="w-5 h-5 text-blue-600" />
                    Relatório Executivo de Simulação de Preços (A4)
                  </DialogTitle>
                  <DialogDescription className="text-xs text-slate-500">
                    Visualização formatada para conferência ou impressão em formato A4.
                  </DialogDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    onClick={handleImprimirA4}
                    className="bg-blue-600 hover:bg-blue-700 text-white text-xs gap-1.5"
                  >
                    <Printer className="w-4 h-4" />
                    Imprimir / Salvar PDF
                  </Button>
                </div>
              </div>
            </DialogHeader>

            {/* FOLHA A4 PARA IMPRESSÃO */}
            <div
              ref={printContainerRef}
              className="bg-white p-6 rounded-lg border border-slate-200 text-slate-800 space-y-6 text-xs print:p-0 print:border-none"
            >
              {/* CABEÇALHO DO LAUDO */}
              <div className="flex items-center justify-between border-b pb-4">
                <div className="flex items-center gap-3">
                  {logoUrl ? (
                    <img src={logoUrl} alt="Logo" className="w-12 h-12 object-contain rounded" />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-blue-900 text-white flex items-center justify-center font-bold text-xl">
                      GE
                    </div>
                  )}
                  <div>
                    <h2 className="text-base font-bold text-slate-900">
                      {minhaEmpresa?.razao_social || 'GESTÃO ECONÔMICA & FINANCEIRA'}
                    </h2>
                    <p className="text-[11px] text-slate-500">
                      Consultoria de Formação de Preço, Custos e Gestão Tributária
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <Badge variant="outline" className="border-blue-600 text-blue-700 font-bold mb-1">
                    LAUDO DE SIMULAÇÃO
                  </Badge>
                  <p className="text-[10px] text-slate-500">
                    Data: {new Date().toLocaleDateString('pt-BR')} às{' '}
                    {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                  <p className="text-[10px] font-semibold text-slate-700">
                    Empresa:{' '}
                    {selectedEmpresa?.nome || minhaEmpresa?.razao_social || 'Empresa Ativa'}
                  </p>
                </div>
              </div>

              {/* TABELA DE PARÂMETROS DO MARK-UP */}
              <div>
                <h3 className="font-bold text-slate-900 text-xs mb-2 uppercase tracking-wider text-blue-900 border-b pb-1">
                  1. Memória de Cálculo do Mark-Up Divisor
                </h3>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3 bg-slate-50 p-3 rounded border">
                  <div>
                    <span className="text-[10px] text-slate-500 block">Prazo Médio:</span>
                    <strong className="text-slate-900 text-xs">{params.prazoDias} dias</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block">Juros ao Mês:</span>
                    <strong className="text-slate-900 text-xs">
                      {params.jurosMesPct.toFixed(2)}% a.m.
                    </strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block">Juros no Período:</span>
                    <strong className="text-blue-700 text-xs">
                      {calculoMarkup.jurosPeriodoPct.toFixed(2)}%
                    </strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block">Total Impostos:</span>
                    <strong className="text-purple-700 text-xs">
                      {calculoMarkup.totalImpostosPct.toFixed(2)}%
                    </strong>
                  </div>
                </div>

                <table className="w-full text-[11px] border-collapse mb-3">
                  <thead>
                    <tr className="bg-slate-100 text-left border-y border-slate-300">
                      <th className="p-1.5">Componente</th>
                      <th className="p-1.5 text-right">Percentual (%)</th>
                      <th className="p-1.5">Componente</th>
                      <th className="p-1.5 text-right">Percentual (%)</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-slate-200">
                      <td className="p-1 text-slate-700">ICMS:</td>
                      <td className="p-1 text-right font-mono">{params.icmsPct.toFixed(2)}%</td>
                      <td className="p-1 text-slate-700">Comissão:</td>
                      <td className="p-1 text-right font-mono">{params.comissaoPct.toFixed(2)}%</td>
                    </tr>
                    <tr className="border-b border-slate-200">
                      <td className="p-1 text-slate-700">IRPJ:</td>
                      <td className="p-1 text-right font-mono">{params.irpjPct.toFixed(2)}%</td>
                      <td className="p-1 text-slate-700">Frete:</td>
                      <td className="p-1 text-right font-mono">{params.fretePct.toFixed(2)}%</td>
                    </tr>
                    <tr className="border-b border-slate-200">
                      <td className="p-1 text-slate-700">CSLL:</td>
                      <td className="p-1 text-right font-mono">{params.csllPct.toFixed(2)}%</td>
                      <td className="p-1 text-slate-700">Assistência:</td>
                      <td className="p-1 text-right font-mono">
                        {params.assistenciaPct.toFixed(2)}%
                      </td>
                    </tr>
                    <tr className="border-b border-slate-200">
                      <td className="p-1 text-slate-700">PIS:</td>
                      <td className="p-1 text-right font-mono">{params.pisPct.toFixed(2)}%</td>
                      <td className="p-1 text-slate-700">Outros:</td>
                      <td className="p-1 text-right font-mono">{params.outrosPct.toFixed(2)}%</td>
                    </tr>
                    <tr className="border-b border-slate-200">
                      <td className="p-1 text-slate-700">COFINS:</td>
                      <td className="p-1 text-right font-mono">{params.cofinsPct.toFixed(2)}%</td>
                      <td className="p-1 text-slate-700 font-bold">Margem de Lucro:</td>
                      <td className="p-1 text-right font-mono font-bold text-amber-700">
                        {params.margemLucroPct.toFixed(2)}%
                      </td>
                    </tr>
                    {params.simplesPct > 0 && (
                      <tr className="border-b border-slate-200">
                        <td className="p-1 text-slate-700">Simples Nacional:</td>
                        <td className="p-1 text-right font-mono">
                          {params.simplesPct.toFixed(2)}%
                        </td>
                        <td className="p-1"></td>
                        <td className="p-1"></td>
                      </tr>
                    )}
                    <tr className="bg-slate-100 font-bold border-y border-slate-300">
                      <td className="p-1.5 text-slate-900">SOMA DOS PERCENTUAIS:</td>
                      <td className="p-1.5 text-right font-mono">
                        {calculoMarkup.totalPercentuais.toFixed(2)}%
                      </td>
                      <td className="p-1.5 text-blue-900">MARK-UP DIVISOR:</td>
                      <td className="p-1.5 text-right font-mono text-blue-900 text-sm">
                        {calculoMarkup.divisor.toFixed(4)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* TABELA DE PRODUTOS SIMULADOS */}
              <div>
                <h3 className="font-bold text-slate-900 text-xs mb-2 uppercase tracking-wider text-blue-900 border-b pb-1">
                  2. Tabela de Preços Sugeridos por Produto
                </h3>

                <table className="w-full text-[11px] border-collapse">
                  <thead>
                    <tr className="bg-slate-800 text-white text-left">
                      <th className="p-1.5">Código</th>
                      <th className="p-1.5">Produto</th>
                      <th className="p-1.5 text-right">Custo Ficha</th>
                      <th className="p-1.5 text-center">Mark-Up Div.</th>
                      <th className="p-1.5 text-right">Preço Sugerido</th>
                      <th className="p-1.5 text-right">Impostos R$</th>
                      <th className="p-1.5 text-right">Margem R$</th>
                    </tr>
                  </thead>
                  <tbody>
                    {itensCalculados.map((it, idx) => (
                      <tr
                        key={it.id}
                        className={`border-b border-slate-200 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}`}
                      >
                        <td className="p-1.5 font-mono font-bold text-slate-900">{it.codigo}</td>
                        <td className="p-1.5">{it.nome}</td>
                        <td className="p-1.5 text-right font-mono">{formatBrl(it.custo)}</td>
                        <td className="p-1.5 text-center font-mono font-semibold">
                          ÷ {it.divisor.toFixed(4)}
                        </td>
                        <td className="p-1.5 text-right font-mono font-bold text-emerald-800">
                          {formatBrl(it.precoSugerido)}
                        </td>
                        <td className="p-1.5 text-right font-mono text-purple-700">
                          {formatBrl(it.vImpostos)}
                        </td>
                        <td className="p-1.5 text-right font-mono text-amber-700 font-semibold">
                          {formatBrl(it.vMargemLucro)}
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-slate-200 font-bold border-t-2 border-slate-400">
                      <td colSpan={2} className="p-1.5">
                        TOTAIS ({totaisSimulacao.totalItens} produtos)
                      </td>
                      <td className="p-1.5 text-right font-mono">
                        {formatBrl(totaisSimulacao.somaCustos)}
                      </td>
                      <td></td>
                      <td className="p-1.5 text-right font-mono text-emerald-900 text-xs">
                        {formatBrl(totaisSimulacao.somaPrecos)}
                      </td>
                      <td className="p-1.5 text-right font-mono text-purple-900">
                        {formatBrl(totaisSimulacao.somaImpostos)}
                      </td>
                      <td className="p-1.5 text-right font-mono text-amber-900">
                        {formatBrl(totaisSimulacao.somaLucros)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* NOTA DE RODAPÉ DO LAUDO */}
              <div className="pt-4 border-t text-[10px] text-slate-500 flex justify-between items-center">
                <span>
                  Relatório gerado automaticamente pelo Sistema de Formação de Preço & Gestão
                  Econômica.
                </span>
                <span>Página 1 de 1</span>
              </div>
            </div>

            <DialogFooter className="pt-3 border-t">
              <Button variant="outline" size="sm" onClick={() => setModalPdfOpen(false)}>
                Fechar
              </Button>
              <Button
                size="sm"
                onClick={handleImprimirA4}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                <Printer className="w-4 h-4 mr-1.5" />
                Imprimir Laudo
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  )
}
