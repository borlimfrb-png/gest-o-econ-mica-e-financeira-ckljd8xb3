import React, { useState, useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useFilter } from '@/contexts/FilterContext'
import {
  produtosService,
  materiasPrimasService,
  fichasTecnicasService,
  configuracoesTributariasService,
} from '@/services/formacaoPrecoService'
import { calcularPrecoPorDentro, calcularTributosMateriaPrima } from '@/lib/taxCalculations'
import {
  ProdutoRecord,
  MateriaPrimaRecord,
  FichaTecnicaRecord,
  ItemFichaTecnica,
  ConfiguracaoTributariaRecord,
} from '@/types/finance'
import { useRealtime } from '@/hooks/use-realtime'
import { useToast } from '@/hooks/use-toast'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  ClipboardList,
  Plus,
  Pencil,
  Trash2,
  Search,
  Download,
  AlertCircle,
  Percent,
  Layers,
  Package,
  Calculator,
  Coins,
  TrendingUp,
  TrendingDown,
  Info,
  DollarSign,
  PlusCircle,
  X,
  Sparkles,
  Copy,
  BarChart3,
  CheckCircle2,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  Link as LinkIcon,
  PieChart as PieChartIcon,
  Check,
  Zap,
  Printer,
  FileText,
  Scale,
  GitCompare,
  ArrowRight,
  ShieldCheck,
  SlidersHorizontal,
  ArrowUpDown,
  Receipt,
} from 'lucide-react'
import { ModalPdfFichaTecnica } from '@/components/ModalPdfFichaTecnica'
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
} from 'recharts'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'

function formatBrl(val: number | null | undefined): string {
  if (val === null || val === undefined || isNaN(val)) return '—'
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(val)
}

function formatPct(val: number | null | undefined): string {
  if (val === null || val === undefined || isNaN(val)) return '—'
  return `${val.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 2 })}%`
}

interface ItemFormState {
  materia_prima_id: string
  quantidade: string
  custo_unitario: string
}

interface FichaFormData {
  produto_id: string
  outros_custos: string
  margem_desejada: string
  markup_desejado: string
  observacoes: string
  itens: ItemFormState[]
}

const EMPTY_FICHA: FichaFormData = {
  produto_id: '',
  outros_custos: '0.00',
  margem_desejada: '40',
  markup_desejado: '66.67',
  observacoes: '',
  itens: [
    {
      materia_prima_id: '',
      quantidade: '1',
      custo_unitario: '0',
    },
  ],
}

type FichaFormErrors = Partial<
  Record<'produto_id' | 'itens' | 'general' | 'margem_desejada' | 'markup_desejado', string>
>

export default function CadastroFichaTecnica() {
  const { toast } = useToast()
  const { selectedEmpresaId } = useFilter()
  const [searchParams] = useSearchParams()

  const [fichas, setFichas] = useState<FichaTecnicaRecord[]>([])
  const [produtos, setProdutos] = useState<ProdutoRecord[]>([])
  const [materias, setMaterias] = useState<MateriaPrimaRecord[]>([])
  const [configTributaria, setConfigTributaria] = useState<ConfiguracaoTributariaRecord | null>(
    null,
  )
  const [loading, setLoading] = useState(true)

  // Filtros
  const [search, setSearch] = useState('')

  // Aba ativa: 'fichas' | 'comparacao' | 'relatorio'
  const [activeTab, setActiveTab] = useState<'fichas' | 'comparacao' | 'relatorio'>('fichas')

  // Estado para Comparação Lado a Lado de Fichas Técnicas
  const [fichaComparadaAId, setFichaComparadaAId] = useState<string>('')
  const [fichaComparadaBId, setFichaComparadaBId] = useState<string>('')

  // Modal Novo / Edição
  const [modalOpen, setModalOpen] = useState(false)
  const [editingFicha, setEditingFicha] = useState<FichaTecnicaRecord | null>(null)
  const [formData, setFormData] = useState<FichaFormData>(EMPTY_FICHA)
  const [errors, setErrors] = useState<FichaFormErrors>({})
  const [saving, setSaving] = useState(false)

  // Modal Exclusão
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [fichaToDelete, setFichaToDelete] = useState<FichaTecnicaRecord | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Visualização rápida de detalhes
  const [selectedFicha, setSelectedFicha] = useState<FichaTecnicaRecord | null>(null)

  // Modal Clonar / Duplicar Ficha com Variação e Insumos em Lote
  const [cloneOpen, setCloneOpen] = useState(false)
  const [fichaToClone, setFichaToClone] = useState<FichaTecnicaRecord | null>(null)
  const [cloneNovoNome, setCloneNovoNome] = useState('')
  const [cloneNovoCodigo, setCloneNovoCodigo] = useState('')
  const [cloneNovaCategoria, setCloneNovaCategoria] = useState('')
  const [cloneNovaUnidade, setCloneNovaUnidade] = useState('UN')
  const [cloneObservacoes, setCloneObservacoes] = useState('')
  const [cloneAjustePercentual, setCloneAjustePercentual] = useState('0')
  const [cloning, setCloning] = useState(false)

  // Modal Vincular Preço ao Produto
  const [vincularModalOpen, setVincularModalOpen] = useState(false)
  const [fichaParaVincular, setFichaParaVincular] = useState<FichaTecnicaRecord | null>(null)
  const [tipoPrecoVinculo, setTipoPrecoVinculo] = useState<'margem' | 'markup'>('margem')
  const [vinculandoPreco, setVinculandoPreco] = useState(false)

  // Modo de visualização do gráfico de composição de custo: 'donut' | 'bar'
  const [tipoGraficoComposicao, setTipoGraficoComposicao] = useState<'donut' | 'bar'>('donut')

  // Filtros específicos do Relatório de Margem Real
  const [relatorioSearch, setRelatorioSearch] = useState('')
  const [filtroStatusMargem, setFiltroStatusMargem] = useState<
    'todos' | 'acima' | 'abaixo' | 'alerta'
  >('todos')

  // Modal de PDF da Ficha Técnica
  const [pdfModalOpen, setPdfModalOpen] = useState(false)
  const [fichaParaPdf, setFichaParaPdf] = useState<FichaTecnicaRecord | null>(null)

  const loadData = async () => {
    try {
      setLoading(true)
      const [fList, pList, mList, cfg] = await Promise.all([
        fichasTecnicasService.getAll(),
        produtosService.getAll(),
        materiasPrimasService.getAll(),
        selectedEmpresaId
          ? configuracoesTributariasService.getByEmpresa(selectedEmpresaId).catch(() => null)
          : Promise.resolve(null),
      ])

      setConfigTributaria(cfg)
      setFichas(fList)
      setProdutos(pList)
      setMaterias(mList)

      // Se passou param ?produto=ID ou ?novoPara=ID na URL
      const prodParam = searchParams.get('produto')
      const novoParaParam = searchParams.get('novoPara')
      if (prodParam) {
        const found = fList.find((f) => f.produto === prodParam)
        if (found) setSelectedFicha(found)
      } else if (novoParaParam) {
        handleOpenNewWithProduct(novoParaParam, pList)
      }
    } catch (err) {
      console.error('Erro ao carregar fichas técnicas:', err)
      toast({
        variant: 'destructive',
        title: 'Erro ao carregar',
        description: 'Não foi possível carregar as fichas técnicas.',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [selectedEmpresaId])

  useRealtime<FichaTecnicaRecord>('fichas_tecnicas', () => loadData())
  useRealtime<ProdutoRecord>('produtos', () => loadData())
  useRealtime<MateriaPrimaRecord>('materias_primas', () => loadData())

  const produtosMap = useMemo(() => {
    const map = new Map<string, ProdutoRecord>()
    for (const p of produtos) map.set(p.id, p)
    return map
  }, [produtos])

  const materiasMap = useMemo(() => {
    const map = new Map<string, MateriaPrimaRecord>()
    for (const m of materias) map.set(m.id, m)
    return map
  }, [materias])

  // Produtos que ainda não possuem ficha técnica (para novo cadastro)
  const produtosSemFicha = useMemo(() => {
    const comFichaSet = new Set(fichas.map((f) => f.produto))
    return produtos.filter((p) => !comFichaSet.has(p.id))
  }, [produtos, fichas])

  // Fichas filtradas
  const fichasFiltradas = useMemo(() => {
    return fichas.filter((f) => {
      const prod = produtosMap.get(f.produto)
      const prodNome = prod ? prod.nome.toLowerCase() : ''
      const prodCod = prod?.codigo ? prod.codigo.toLowerCase() : ''
      const q = search.toLowerCase()
      return (
        q === '' ||
        prodNome.includes(q) ||
        prodCod.includes(q) ||
        (f.observacoes && f.observacoes.toLowerCase().includes(q))
      )
    })
  }, [fichas, produtosMap, search])

  // Dados calculados para o Relatório de Custos e Margem Real
  const relatorioData = useMemo(() => {
    return fichas.map((f) => {
      const prod = produtosMap.get(f.produto)

      // Cálculo detalhado dos insumos (Bruto, Créditos, Acréscimos e Líquido)
      let custoMPBrutoCalc = 0
      let creditosTotaisCalc = 0
      let acrescimosTotaisCalc = 0
      let custoMPLiquidoCalc = 0

      if (f.itens && Array.isArray(f.itens)) {
        for (const it of f.itens) {
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

          custoMPBrutoCalc += subtotalBruto
          creditosTotaisCalc += qtd * trib.totalCreditos
          acrescimosTotaisCalc += qtd * trib.totalAcrescimos
          custoMPLiquidoCalc += qtd * trib.custoLiquido
        }
      }

      // Custo MP Bruto e Líquido
      const custoMPBruto =
        custoMPBrutoCalc > 0 ? custoMPBrutoCalc : Number(f.custo_materia_prima) || 0
      const creditosTotais =
        f.creditos_tributarios_totais !== undefined && f.creditos_tributarios_totais !== null
          ? Number(f.creditos_tributarios_totais)
          : creditosTotaisCalc
      const acrescimosTotais = acrescimosTotaisCalc
      const custoMPLiquido =
        f.custo_materia_prima_liquido !== undefined && f.custo_materia_prima_liquido !== null
          ? Number(f.custo_materia_prima_liquido)
          : custoMPLiquidoCalc > 0
            ? custoMPLiquidoCalc
            : Math.max(0, custoMPBruto - creditosTotais + acrescimosTotais)

      const outrosCustos = Number(f.outros_custos) || 0
      const custoTotalLiquido =
        f.custo_total_liquido !== undefined && f.custo_total_liquido !== null
          ? Number(f.custo_total_liquido)
          : custoMPLiquido + outrosCustos
      const custoTotalBruto = custoMPBruto + outrosCustos
      const custoTotal = custoTotalLiquido // Usar sempre o Custo Líquido como base real

      // Preço de venda praticado no cadastro do produto (ou sugerido se produto não tem preço)
      const precoVenda = Number(prod?.preco_venda) || Number(f.preco_venda_sugerido) || 0
      const margemDesejada = Number(f.margem_desejada) || Number(prod?.margem_desejada) || 0

      // Margem Real (%) = ((Preço de Venda - Custo Total) / Preço de Venda) * 100
      let margemReal = 0
      let lucroUnitario = 0
      if (precoVenda > 0) {
        lucroUnitario = precoVenda - custoTotal
        margemReal = (lucroUnitario / precoVenda) * 100
      }

      // Diferença em pontos percentuais (Margem Real - Margem Desejada)
      const diffMargem = margemReal - margemDesejada

      // Status de desempenho de margem
      let statusMargem: 'acima' | 'abaixo' | 'critica' | 'atingida' = 'atingida'
      if (margemReal < 0) {
        statusMargem = 'critica'
      } else if (diffMargem >= 0.5) {
        statusMargem = 'acima'
      } else if (diffMargem <= -0.5) {
        statusMargem = 'abaixo'
      } else {
        statusMargem = 'atingida'
      }

      return {
        ficha: f,
        produto: prod,
        produtoNome: prod?.nome || 'Produto não encontrado',
        produtoCodigo: prod?.codigo || '',
        unidade: prod?.unidade || 'UN',
        categoria: prod?.categoria || '',
        itensCount: f.itens?.length || 0,
        custoMP: custoMPLiquido,
        custoMPBruto,
        custoMPLiquido,
        creditosTotais,
        acrescimosTotais,
        outrosCustos,
        custoTotal,
        custoTotalBruto,
        custoTotalLiquido,
        precoVenda,
        precoSugerido: Number(f.preco_venda_sugerido) || 0,
        margemDesejada,
        margemReal,
        lucroUnitario,
        diffMargem,
        statusMargem,
      }
    })
  }, [fichas, produtosMap, materiasMap])

  // Relatório filtrado
  const relatorioFiltrado = useMemo(() => {
    return relatorioData.filter((item) => {
      const q = relatorioSearch.toLowerCase()
      const matchText =
        q === '' ||
        item.produtoNome.toLowerCase().includes(q) ||
        item.produtoCodigo.toLowerCase().includes(q) ||
        item.categoria.toLowerCase().includes(q)

      const matchStatus =
        filtroStatusMargem === 'todos' ||
        (filtroStatusMargem === 'acima' &&
          (item.statusMargem === 'acima' || item.statusMargem === 'atingida')) ||
        (filtroStatusMargem === 'abaixo' && item.statusMargem === 'abaixo') ||
        (filtroStatusMargem === 'alerta' && item.statusMargem === 'critica')

      return matchText && matchStatus
    })
  }, [relatorioData, relatorioSearch, filtroStatusMargem])

  // Estatísticas do Relatório de Custos e Margem Real
  const relatorioStats = useMemo(() => {
    const total = relatorioData.length
    if (total === 0) {
      return {
        total: 0,
        margemMediaReal: 0,
        margemMediaDesejada: 0,
        acimaOuAtingida: 0,
        abaixoCount: 0,
        criticaCount: 0,
      }
    }

    const somaMargemReal = relatorioData.reduce((acc, it) => acc + it.margemReal, 0)
    const somaMargemDesejada = relatorioData.reduce((acc, it) => acc + it.margemDesejada, 0)
    const acimaOuAtingida = relatorioData.filter(
      (it) => it.statusMargem === 'acima' || it.statusMargem === 'atingida',
    ).length
    const abaixoCount = relatorioData.filter((it) => it.statusMargem === 'abaixo').length
    const criticaCount = relatorioData.filter((it) => it.statusMargem === 'critica').length

    const totalCustoMPGeral = relatorioData.reduce((acc, it) => acc + it.custoMP, 0)
    const totalOutrosCustosGeral = relatorioData.reduce((acc, it) => acc + it.outrosCustos, 0)
    const totalCustoTotalGeral = relatorioData.reduce((acc, it) => acc + it.custoTotal, 0)
    const totalPrecoVendaGeral = relatorioData.reduce((acc, it) => acc + it.precoVenda, 0)
    const totalLucroGeral = relatorioData.reduce((acc, it) => acc + it.lucroUnitario, 0)

    return {
      total,
      margemMediaReal: somaMargemReal / total,
      margemMediaDesejada: somaMargemDesejada / total,
      acimaOuAtingida,
      abaixoCount,
      criticaCount,
      totalCustoMPGeral,
      totalOutrosCustosGeral,
      totalCustoTotalGeral,
      totalPrecoVendaGeral,
      totalLucroGeral,
    }
  }, [relatorioData])

  // Composição consolidada de Custo por Categoria de Matéria-Prima no Relatório
  const composicaoCategoriasRelatorio = useMemo(() => {
    let custoMPGlobal = 0
    let custoTotalGlobal = 0
    let outrosCustosGlobal = 0
    const catMap = new Map<
      string,
      {
        categoria: string
        totalCusto: number
        itensCount: number
        produtosCount: Set<string>
      }
    >()

    for (const item of relatorioData) {
      custoMPGlobal += item.custoMP
      custoTotalGlobal += item.custoTotal
      outrosCustosGlobal += item.outrosCustos

      const itensFicha = item.ficha.itens || []
      for (const it of itensFicha) {
        const mp = materiasMap.get(it.materia_prima_id)
        const subtotal =
          Number(it.subtotal) || Number(it.quantidade) * Number(it.custo_unitario) || 0
        const catNome = mp?.categoria?.trim() || 'Geral / Não categorizado'

        const cur = catMap.get(catNome) || {
          categoria: catNome,
          totalCusto: 0,
          itensCount: 0,
          produtosCount: new Set<string>(),
        }

        cur.totalCusto += subtotal
        cur.itensCount += 1
        cur.produtosCount.add(item.ficha.produto)
        catMap.set(catNome, cur)
      }
    }

    const lista = Array.from(catMap.values())
      .map((c) => ({
        categoria: c.categoria,
        totalCusto: c.totalCusto,
        itensCount: c.itensCount,
        produtosCount: c.produtosCount.size,
        pctSobreMP: custoMPGlobal > 0 ? (c.totalCusto / custoMPGlobal) * 100 : 0,
        pctSobreTotal: custoTotalGlobal > 0 ? (c.totalCusto / custoTotalGlobal) * 100 : 0,
      }))
      .sort((a, b) => b.totalCusto - a.totalCusto)

    return {
      categorias: lista,
      custoMPGlobal,
      custoTotalGlobal,
      outrosCustosGlobal,
    }
  }, [relatorioData, materiasMap])
  // Estatísticas de Fichas
  const stats = useMemo(() => {
    const total = fichas.length
    const custoMedioMP =
      fichas.length > 0
        ? fichas.reduce((acc, f) => acc + (Number(f.custo_materia_prima) || 0), 0) / fichas.length
        : 0
    const custoTotalMedio =
      fichas.length > 0
        ? fichas.reduce((acc, f) => acc + (Number(f.custo_total) || 0), 0) / fichas.length
        : 0
    const precoMedioSugerido =
      fichas.length > 0
        ? fichas.reduce((acc, f) => acc + (Number(f.preco_venda_sugerido) || 0), 0) / fichas.length
        : 0

    return { total, custoMedioMP, custoTotalMedio, precoMedioSugerido }
  }, [fichas])

  // Cálculos em tempo real para o formulário aberto (considerando créditos de impostos na matéria-prima)
  const formCalculations = useMemo(() => {
    let custoMPBruto = 0
    let custoMPLiquido = 0
    let creditosTotais = 0
    const itensValidos: ItemFichaTecnica[] = []

    for (const item of formData.itens) {
      if (!item.materia_prima_id) continue
      const mp = materiasMap.get(item.materia_prima_id)
      const qtd = Number(item.quantidade.replace(',', '.')) || 0
      const unitBruto =
        item.custo_unitario.trim() !== ''
          ? Number(item.custo_unitario.replace(',', '.'))
          : mp?.custo_unitario || 0
      const subtotalBruto = qtd * unitBruto

      const isIsenta = Boolean(
        mp?.isenta_st ||
        mp?.tipo_tributacao === 'isenta' ||
        mp?.tipo_tributacao === 'substituicao_tributaria',
      )
      const icms = isIsenta ? 0 : Number(mp?.icms_percentual || 0)
      const pis = isIsenta ? 0 : Number(mp?.pis_percentual || 0)
      const cofins = isIsenta ? 0 : Number(mp?.cofins_percentual || 0)
      const ipi = Number(mp?.ipi_percentual || 0)
      const frete = Number(mp?.frete_percentual || 0)
      const perdas = Number(mp?.perdas_percentual || 0)

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

      const subtotalLiquido = qtd * trib.custoLiquido
      const creditoItemTotal = qtd * trib.totalCreditos
      const acrescimosItemTotal = qtd * trib.totalAcrescimos

      custoMPBruto += subtotalBruto
      custoMPLiquido += subtotalLiquido
      creditosTotais += creditoItemTotal

      itensValidos.push({
        materia_prima_id: item.materia_prima_id,
        materia_prima_nome: mp?.nome || 'Insumo',
        unidade: mp?.unidade || 'UN',
        custo_unitario: unitBruto,
        quantidade: qtd,
        subtotal: subtotalBruto,
        custo_unitario_liquido: trib.custoLiquido,
        subtotal_liquido: subtotalLiquido,
        icms_percentual: trib.icmsPercentual,
        pis_percentual: trib.pisPercentual,
        cofins_percentual: trib.cofinsPercentual,
        ipi_percentual: trib.ipiPercentual,
        frete_percentual: trib.fretePercentual,
        perdas_percentual: trib.perdasPercentual,
        credito_icms: qtd * trib.creditoIcms,
        credito_pis: qtd * trib.creditoPis,
        credito_cofins: qtd * trib.creditoCofins,
        credito_total: creditoItemTotal,
        valor_ipi: qtd * trib.valorIpi,
        valor_frete: qtd * trib.valorFrete,
        valor_perdas: qtd * trib.valorPerdas,
        acrescimos_total: acrescimosItemTotal,
        isenta_st: trib.isIsentaOuST,
        tipo_tributacao: mp?.tipo_tributacao,
      })
    }

    const outros = Number(formData.outros_custos.replace(',', '.')) || 0
    // Custo Total Base Líquida (Custo MP Líquido + Outros Custos)
    const custoTotalLiquido = custoMPLiquido + outros
    // Custo Total Bruto (para referência e comparação)
    const custoTotalBruto = custoMPBruto + outros

    const margem = Number(formData.margem_desejada.replace(',', '.')) || 0
    const markup = Number(formData.markup_desejado.replace(',', '.')) || 0

    // Preço Sugerido por Margem baseado no CUSTO LÍQUIDO (divisor): Custo Líquido / (1 - Margem/100)
    let precoSugeridoMargem = 0
    if (margem < 100 && margem >= 0 && custoTotalLiquido > 0) {
      precoSugeridoMargem = custoTotalLiquido / (1 - margem / 100)
    } else if (custoTotalLiquido > 0) {
      precoSugeridoMargem = custoTotalLiquido
    }

    // Preço Sugerido por Markup baseado no CUSTO LÍQUIDO (multiplicador): Custo Líquido * (1 + markup/100)
    let precoSugeridoMarkup = 0
    if (custoTotalLiquido > 0) {
      precoSugeridoMarkup = custoTotalLiquido * (1 + (markup >= 0 ? markup : 0) / 100)
    }

    const lucroBrutoMargem = precoSugeridoMargem - custoTotalLiquido
    const lucroBrutoMarkup = precoSugeridoMarkup - custoTotalLiquido

    // Cálculo com impostos por dentro sobre Custo Líquido
    const cargaTrib = Number(configTributaria?.carga_tributaria_total) || 0
    let precoSugeridoComImpostos = precoSugeridoMargem
    const divisorComImpostos = 1 - (margem + cargaTrib) / 100
    if (cargaTrib > 0 && divisorComImpostos > 0.01 && custoTotalLiquido > 0) {
      precoSugeridoComImpostos = custoTotalLiquido / divisorComImpostos
    } else if (cargaTrib > 0 && custoTotalLiquido > 0) {
      precoSugeridoComImpostos = precoSugeridoMargem * (1 + cargaTrib / 100)
    }

    return {
      custoMP: custoMPLiquido, // Custo MP Líquido como padrão operacional
      custoMPBruto,
      custoMPLiquido,
      creditosTotais,
      outros,
      custoTotal: custoTotalLiquido, // Custo Total Líquido
      custoTotalLiquido,
      custoTotalBruto,
      margem,
      markup,
      cargaTrib,
      precoSugeridoMargem,
      precoSugeridoMarkup,
      precoSugeridoComImpostos,
      precoSugerido: precoSugeridoMargem,
      lucroBrutoMargem,
      lucroBrutoMarkup,
      itensValidos,
    }
  }, [formData, materiasMap, configTributaria])

  // Handlers do Form
  const handleOpenNew = () => {
    setEditingFicha(null)
    setFormData(EMPTY_FICHA)
    setErrors({})
    setModalOpen(true)
  }

  const handleOpenNewWithProduct = (prodId: string, pList: ProdutoRecord[] = produtos) => {
    setEditingFicha(null)
    const prod = pList.find((p) => p.id === prodId)
    const margemDefault =
      prod?.margem_desejada !== undefined && prod?.margem_desejada !== null
        ? Number(prod.margem_desejada)
        : 40
    const markupDefault =
      margemDefault < 100 && margemDefault > 0 ? (margemDefault / (100 - margemDefault)) * 100 : 50

    setFormData({
      ...EMPTY_FICHA,
      produto_id: prodId,
      margem_desejada: String(margemDefault),
      markup_desejado: markupDefault.toFixed(2),
    })
    setErrors({})
    setModalOpen(true)
  }

  const handleOpenEdit = (f: FichaTecnicaRecord) => {
    setEditingFicha(f)
    const itensForm: ItemFormState[] =
      f.itens && f.itens.length > 0
        ? f.itens.map((it) => ({
            materia_prima_id: it.materia_prima_id,
            quantidade: String(it.quantidade),
            custo_unitario: String(it.custo_unitario),
          }))
        : [{ materia_prima_id: '', quantidade: '1', custo_unitario: '0' }]

    const margemVal =
      f.margem_desejada !== undefined && f.margem_desejada !== null ? Number(f.margem_desejada) : 40
    const markupVal =
      f.markup_desejado !== undefined && f.markup_desejado !== null
        ? Number(f.markup_desejado)
        : margemVal < 100 && margemVal > 0
          ? (margemVal / (100 - margemVal)) * 100
          : 50

    setFormData({
      produto_id: f.produto,
      outros_custos:
        f.outros_custos !== undefined && f.outros_custos !== null ? String(f.outros_custos) : '0',
      margem_desejada: String(margemVal),
      markup_desejado: markupVal.toFixed(2),
      observacoes: f.observacoes || '',
      itens: itensForm,
    })
    setErrors({})
    setModalOpen(true)
  }

  const handleAddItem = () => {
    setFormData((prev) => ({
      ...prev,
      itens: [
        ...prev.itens,
        {
          materia_prima_id: '',
          quantidade: '1',
          custo_unitario: '0',
        },
      ],
    }))
  }

  const handleRemoveItem = (index: number) => {
    setFormData((prev) => {
      const updated = [...prev.itens]
      updated.splice(index, 1)
      if (updated.length === 0) {
        updated.push({ materia_prima_id: '', quantidade: '1', custo_unitario: '0' })
      }
      return { ...prev, itens: updated }
    })
  }

  const handleItemChange = (index: number, field: keyof ItemFormState, value: string) => {
    setFormData((prev) => {
      const updated = [...prev.itens]
      const current = { ...updated[index], [field]: value }

      // Se mudou a matéria-prima, auto-preenche o custo unitário atual dela
      if (field === 'materia_prima_id') {
        const mp = materiasMap.get(value)
        if (mp && mp.custo_unitario !== undefined) {
          current.custo_unitario = String(mp.custo_unitario)
        }
      }

      updated[index] = current
      return { ...prev, itens: updated }
    })
  }

  const validate = (): boolean => {
    const errs: FichaFormErrors = {}
    if (!formData.produto_id) {
      errs.produto_id = 'Selecione o produto desta ficha técnica'
    }

    const validItens = formData.itens.filter(
      (it) => it.materia_prima_id && Number(it.quantidade.replace(',', '.')) > 0,
    )
    if (validItens.length === 0) {
      errs.itens = 'Adicione ao menos uma matéria-prima com quantidade maior que zero'
    }

    const margem = Number(formData.margem_desejada.replace(',', '.'))
    if (isNaN(margem) || margem < 0 || margem >= 100) {
      errs.margem_desejada = 'A margem desejada deve estar entre 0% e 99.9%'
    }

    const markup = Number(formData.markup_desejado.replace(',', '.'))
    if (isNaN(markup) || markup < 0) {
      errs.markup_desejado = 'Informe um percentual de markup válido (>= 0%)'
    }

    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return

    setSaving(true)
    try {
      const {
        custoMPBruto,
        custoMPLiquido,
        creditosTotais,
        outros,
        custoTotalLiquido,
        margem,
        markup,
        precoSugeridoMargem,
        precoSugeridoMarkup,
        itensValidos,
      } = formCalculations

      const payload = {
        produto: formData.produto_id,
        itens: itensValidos,
        custo_materia_prima: custoMPBruto,
        custo_materia_prima_liquido: custoMPLiquido,
        creditos_tributarios_totais: creditosTotais,
        outros_custos: outros,
        custo_total: custoTotalLiquido,
        custo_total_liquido: custoTotalLiquido,
        margem_desejada: margem,
        preco_venda_sugerido: Math.round(precoSugeridoMargem * 100) / 100,
        preco_venda_sugerido_liquido: Math.round(precoSugeridoMargem * 100) / 100,
        markup_desejado: markup,
        preco_venda_markup: Math.round(precoSugeridoMarkup * 100) / 100,
        preco_venda_markup_liquido: Math.round(precoSugeridoMarkup * 100) / 100,
        observacoes: formData.observacoes.trim() || undefined,
      }

      if (editingFicha) {
        await fichasTecnicasService.update(editingFicha.id, payload)
        toast({
          title: 'Ficha Técnica atualizada',
          description: 'A composição e os preços foram recalculados com sucesso.',
        })
      } else {
        await fichasTecnicasService.create(payload)
        toast({
          title: 'Ficha Técnica criada',
          description: 'A composição do produto foi cadastrada com sucesso.',
        })
      }

      setModalOpen(false)
      loadData()
    } catch (err: any) {
      console.error(err)
      setErrors((prev) => ({
        ...prev,
        general: err?.message || 'Erro ao salvar a ficha técnica.',
      }))
    } finally {
      setSaving(false)
    }
  }

  // Handlers para Vincular Preço ao Produto
  const handleOpenVincularPreco = (f: FichaTecnicaRecord) => {
    setFichaParaVincular(f)
    setTipoPrecoVinculo('margem')
    setVincularModalOpen(true)
  }

  const handleConfirmarVinculoPreco = async () => {
    if (!fichaParaVincular) return
    const prod = produtosMap.get(fichaParaVincular.produto)
    if (!prod) return

    const custoTotal = Number(fichaParaVincular.custo_total) || 0
    const margem = Number(fichaParaVincular.margem_desejada) || 0
    const markup =
      fichaParaVincular.markup_desejado !== undefined && fichaParaVincular.markup_desejado !== null
        ? Number(fichaParaVincular.markup_desejado)
        : margem < 100 && margem > 0
          ? (margem / (100 - margem)) * 100
          : 50

    const precoMargem =
      Number(fichaParaVincular.preco_venda_sugerido) ||
      (margem < 100 && custoTotal > 0 ? custoTotal / (1 - margem / 100) : custoTotal)
    const precoMarkup =
      Number(fichaParaVincular.preco_venda_markup) ||
      (custoTotal > 0 ? custoTotal * (1 + markup / 100) : custoTotal)

    const precoFinal = tipoPrecoVinculo === 'margem' ? precoMargem : precoMarkup
    const margemFinal =
      tipoPrecoVinculo === 'margem'
        ? margem
        : precoFinal > 0
          ? ((precoFinal - custoTotal) / precoFinal) * 100
          : margem

    setVinculandoPreco(true)
    try {
      await fichasTecnicasService.vincularPrecoAoProduto(prod.id, precoFinal, margemFinal)
      toast({
        title: 'Preço vinculado com sucesso!',
        description: `O preço de venda de "${prod.nome}" foi atualizado para ${formatBrl(
          precoFinal,
        )} (${tipoPrecoVinculo === 'margem' ? 'por margem' : 'por markup'}).`,
      })
      setVincularModalOpen(false)
      setFichaParaVincular(null)
      await loadData()
    } catch (err: any) {
      console.error(err)
      toast({
        variant: 'destructive',
        title: 'Erro ao vincular preço',
        description: err?.message || 'Não foi possível atualizar o preço do produto.',
      })
    } finally {
      setVinculandoPreco(false)
    }
  }

  // Handlers para Clonagem de Ficha
  const handleOpenClone = (f: FichaTecnicaRecord) => {
    const prod = produtosMap.get(f.produto)
    setFichaToClone(f)
    setCloneNovoNome(prod ? `${prod.nome} (Variação)` : 'Produto (Variação)')
    setCloneNovoCodigo(prod?.codigo ? `${prod.codigo}-VAR` : '')
    setCloneNovaCategoria(prod?.categoria || '')
    setCloneNovaUnidade(prod?.unidade || 'UN')
    setCloneObservacoes(f.observacoes ? `Cópia/Variação de ${prod?.nome}. ${f.observacoes}` : '')
    setCloneAjustePercentual('0')
    setCloneOpen(true)
  }

  const handleConfirmClone = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!fichaToClone) return
    if (!cloneNovoNome.trim()) {
      toast({
        variant: 'destructive',
        title: 'Nome obrigatório',
        description: 'Informe o nome para o novo produto da ficha clonada.',
      })
      return
    }

    setCloning(true)
    try {
      const ajusteNum = Number(cloneAjustePercentual.replace(',', '.')) || 0

      const novaFicha = await fichasTecnicasService.clone(fichaToClone.id, {
        criarNovoProduto: true,
        novoProdutoNome: cloneNovoNome.trim(),
        novoProdutoCodigo: cloneNovoCodigo.trim() || undefined,
        novoProdutoCategoria: cloneNovaCategoria.trim() || undefined,
        novoProdutoUnidade: cloneNovaUnidade.trim() || 'UN',
        observacoes: cloneObservacoes.trim() || undefined,
        ajustePercentualInsumos: ajusteNum,
      })

      toast({
        title: 'Ficha Técnica duplicada com sucesso!',
        description: `Criada variação "${cloneNovoNome}" com todos os ${fichaToClone.itens?.length || 0} insumos copiados em lote.`,
      })

      setCloneOpen(false)
      setFichaToClone(null)
      await loadData()
      setSelectedFicha(novaFicha)
    } catch (err: any) {
      console.error(err)
      toast({
        variant: 'destructive',
        title: 'Erro ao duplicar',
        description: err?.message || 'Não foi possível duplicar a ficha técnica.',
      })
    } finally {
      setCloning(false)
    }
  }

  // Inicializa a comparação com as duas primeiras fichas se não estiverem selecionadas
  useEffect(() => {
    if (fichas.length >= 2) {
      if (!fichaComparadaAId || !fichas.some((f) => f.id === fichaComparadaAId)) {
        setFichaComparadaAId(fichas[0].id)
      }
      if (
        !fichaComparadaBId ||
        !fichas.some((f) => f.id === fichaComparadaBId) ||
        fichaComparadaBId === fichas[0].id
      ) {
        setFichaComparadaBId(fichas[1].id)
      }
    } else if (fichas.length === 1) {
      setFichaComparadaAId(fichas[0].id)
    }
  }, [fichas])

  // Dados calculados para a Comparação Lado a Lado
  const comparacaoData = useMemo(() => {
    const fichaA = fichas.find((f) => f.id === fichaComparadaAId) || null
    const fichaB = fichas.find((f) => f.id === fichaComparadaBId) || null

    if (!fichaA || !fichaB) return null

    const prodA = produtosMap.get(fichaA.produto)
    const prodB = produtosMap.get(fichaB.produto)

    const custoMP_A = Number(fichaA.custo_materia_prima) || 0
    const outrosCustos_A = Number(fichaA.outros_custos) || 0
    const custoTotal_A = Number(fichaA.custo_total) || 0
    const margem_A = Number(fichaA.margem_desejada) || 0
    const markup_A =
      fichaA.markup_desejado !== undefined && fichaA.markup_desejado !== null
        ? Number(fichaA.markup_desejado)
        : margem_A < 100 && margem_A > 0
          ? (margem_A / (100 - margem_A)) * 100
          : 50
    const precoMargem_A =
      Number(fichaA.preco_venda_sugerido) ||
      (margem_A < 100 && custoTotal_A > 0 ? custoTotal_A / (1 - margem_A / 100) : custoTotal_A)
    const precoMarkup_A =
      Number(fichaA.preco_venda_markup) ||
      (custoTotal_A > 0 ? custoTotal_A * (1 + markup_A / 100) : custoTotal_A)
    const precoPraticado_A = Number(prodA?.preco_venda) || precoMargem_A

    const custoMP_B = Number(fichaB.custo_materia_prima) || 0
    const outrosCustos_B = Number(fichaB.outros_custos) || 0
    const custoTotal_B = Number(fichaB.custo_total) || 0
    const margem_B = Number(fichaB.margem_desejada) || 0
    const markup_B =
      fichaB.markup_desejado !== undefined && fichaB.markup_desejado !== null
        ? Number(fichaB.markup_desejado)
        : margem_B < 100 && margem_B > 0
          ? (margem_B / (100 - margem_B)) * 100
          : 50
    const precoMargem_B =
      Number(fichaB.preco_venda_sugerido) ||
      (margem_B < 100 && custoTotal_B > 0 ? custoTotal_B / (1 - margem_B / 100) : custoTotal_B)
    const precoMarkup_B =
      Number(fichaB.preco_venda_markup) ||
      (custoTotal_B > 0 ? custoTotal_B * (1 + markup_B / 100) : custoTotal_B)
    const precoPraticado_B = Number(prodB?.preco_venda) || precoMargem_B

    // Carga Tributária e Fator Gross-up (Por Dentro)
    const cargaTrib = Number(configTributaria?.carga_tributaria_total) || 0
    const fatorGrossUp =
      configTributaria?.fator_por_dentro !== undefined &&
      configTributaria?.fator_por_dentro !== null &&
      Number(configTributaria.fator_por_dentro) > 0
        ? Number(configTributaria.fator_por_dentro)
        : cargaTrib > 0 && cargaTrib < 100
          ? Number((1 / (1 - cargaTrib / 100)).toFixed(4))
          : 1
    const regimeNome = configTributaria?.regime_tributario || 'Regime Padrão'

    // Cálculo do Preço com Impostos por Dentro para Ficha A e Ficha B
    // Fórmula padrão de tributação por dentro: Custo / (1 - (Margem + Carga)/100)
    let precoComImpostos_A = precoMargem_A
    const divisorComImpostos_A = 1 - (margem_A + cargaTrib) / 100
    if (cargaTrib > 0 && divisorComImpostos_A > 0.01 && custoTotal_A > 0) {
      precoComImpostos_A = custoTotal_A / divisorComImpostos_A
    } else if (cargaTrib > 0 && custoTotal_A > 0) {
      precoComImpostos_A = precoMargem_A * fatorGrossUp
    }

    let precoComImpostos_B = precoMargem_B
    const divisorComImpostos_B = 1 - (margem_B + cargaTrib) / 100
    if (cargaTrib > 0 && divisorComImpostos_B > 0.01 && custoTotal_B > 0) {
      precoComImpostos_B = custoTotal_B / divisorComImpostos_B
    } else if (cargaTrib > 0 && custoTotal_B > 0) {
      precoComImpostos_B = precoMargem_B * fatorGrossUp
    }

    const valorImpostos_A = Math.max(0, precoComImpostos_A * (cargaTrib / 100))
    const valorImpostos_B = Math.max(0, precoComImpostos_B * (cargaTrib / 100))

    // Diferenças (B vs A)
    const diffCustoTotal = custoTotal_B - custoTotal_A
    const pctDiffCustoTotal = custoTotal_A > 0 ? (diffCustoTotal / custoTotal_A) * 100 : 0

    const diffCustoMP = custoMP_B - custoMP_A
    const pctDiffCustoMP = custoMP_A > 0 ? (diffCustoMP / custoMP_A) * 100 : 0

    const diffOutros = outrosCustos_B - outrosCustos_A
    const pctDiffOutros = outrosCustos_A > 0 ? (diffOutros / outrosCustos_A) * 100 : 0

    const diffPrecoMargem = precoMargem_B - precoMargem_A
    const pctDiffPrecoMargem = precoMargem_A > 0 ? (diffPrecoMargem / precoMargem_A) * 100 : 0

    const diffPrecoMarkup = precoMarkup_B - precoMarkup_A
    const pctDiffPrecoMarkup = precoMarkup_A > 0 ? (diffPrecoMarkup / precoMarkup_A) * 100 : 0

    const diffPrecoComImpostos = precoComImpostos_B - precoComImpostos_A
    const pctDiffPrecoComImpostos =
      precoComImpostos_A > 0 ? (diffPrecoComImpostos / precoComImpostos_A) * 100 : 0

    // Identificar inversão de vantagem devido a tributos/margens
    // Virada ocorre quando diffCustoTotal e diffPrecoComImpostos têm sinais opostos (ex: A tem menor custo bruto, mas B fica com menor preço com impostos ou vice-versa)
    const viradaImpostos =
      (diffCustoTotal < 0 && diffPrecoComImpostos > 0) ||
      (diffCustoTotal > 0 && diffPrecoComImpostos < 0)

    // Conclusão de qual é mais barata / econômica
    let conclusao = {
      maisEconomica: diffCustoTotal === 0 ? 'iguais' : diffCustoTotal < 0 ? 'B' : 'A',
      diferencaAbsoluta: Math.abs(diffCustoTotal),
      diferencaPercentual: Math.abs(pctDiffCustoTotal),
      produtoEconomicoNome:
        diffCustoTotal < 0 ? prodB?.nome || 'Produto B' : prodA?.nome || 'Produto A',
      produtoCaroNome: diffCustoTotal < 0 ? prodA?.nome || 'Produto A' : prodB?.nome || 'Produto B',
      // Conclusão com impostos
      maisEconomicaImpostos:
        diffPrecoComImpostos === 0 ? 'iguais' : diffPrecoComImpostos < 0 ? 'B' : 'A',
      diferencaAbsolutaImpostos: Math.abs(diffPrecoComImpostos),
      diferencaPercentualImpostos: Math.abs(pctDiffPrecoComImpostos),
      produtoEconomicoImpostosNome:
        diffPrecoComImpostos < 0 ? prodB?.nome || 'Produto B' : prodA?.nome || 'Produto A',
      viradaImpostos,
    }

    // Comparativo de Insumos (Em Comum vs Divergentes)
    const itensMapA = new Map<string, ItemFichaTecnica>()
    for (const it of fichaA.itens || []) {
      itensMapA.set(it.materia_prima_id, it)
    }

    const itensMapB = new Map<string, ItemFichaTecnica>()
    for (const it of fichaB.itens || []) {
      itensMapB.set(it.materia_prima_id, it)
    }

    // Todos os IDs únicos de insumos envolvidos
    const allMpIds = Array.from(
      new Set([...Array.from(itensMapA.keys()), ...Array.from(itensMapB.keys())]),
    )

    const insumosEmComum: Array<{
      materia_prima_id: string
      nome: string
      unidade: string
      itemA: ItemFichaTecnica
      itemB: ItemFichaTecnica
      diffQtd: number
      diffCusto: number
      diffSubtotal: number
      pctDiffSubtotal: number
    }> = []

    const insumosApenasA: Array<{
      materia_prima_id: string
      nome: string
      unidade: string
      item: ItemFichaTecnica
    }> = []

    const insumosApenasB: Array<{
      materia_prima_id: string
      nome: string
      unidade: string
      item: ItemFichaTecnica
    }> = []

    for (const mpId of allMpIds) {
      const itA = itensMapA.get(mpId)
      const itB = itensMapB.get(mpId)
      const mp = materiasMap.get(mpId)
      const nome = itA?.materia_prima_nome || itB?.materia_prima_nome || mp?.nome || 'Insumo'
      const unidade = itA?.unidade || itB?.unidade || mp?.unidade || 'UN'

      if (itA && itB) {
        const diffQtd = Number(itB.quantidade) - Number(itA.quantidade)
        const diffCusto = Number(itB.custo_unitario) - Number(itA.custo_unitario)
        const subA = Number(itA.subtotal) || Number(itA.quantidade) * Number(itA.custo_unitario)
        const subB = Number(itB.subtotal) || Number(itB.quantidade) * Number(itB.custo_unitario)
        const diffSubtotal = subB - subA
        const pctDiffSubtotal = subA > 0 ? (diffSubtotal / subA) * 100 : 0

        insumosEmComum.push({
          materia_prima_id: mpId,
          nome,
          unidade,
          itemA: itA,
          itemB: itB,
          diffQtd,
          diffCusto,
          diffSubtotal,
          pctDiffSubtotal,
        })
      } else if (itA && !itB) {
        insumosApenasA.push({
          materia_prima_id: mpId,
          nome,
          unidade,
          item: itA,
        })
      } else if (!itA && itB) {
        insumosApenasB.push({
          materia_prima_id: mpId,
          nome,
          unidade,
          item: itB,
        })
      }
    }

    return {
      fichaA,
      fichaB,
      prodA,
      prodB,
      custoMP_A,
      outrosCustos_A,
      custoTotal_A,
      margem_A,
      markup_A,
      precoMargem_A,
      precoMarkup_A,
      precoPraticado_A,
      precoComImpostos_A,
      valorImpostos_A,
      custoMP_B,
      outrosCustos_B,
      custoTotal_B,
      margem_B,
      markup_B,
      precoMargem_B,
      precoMarkup_B,
      precoPraticado_B,
      precoComImpostos_B,
      valorImpostos_B,
      cargaTrib,
      fatorGrossUp,
      regimeNome,
      diffCustoTotal,
      pctDiffCustoTotal,
      diffCustoMP,
      pctDiffCustoMP,
      diffOutros,
      pctDiffOutros,
      diffPrecoMargem,
      pctDiffPrecoMargem,
      diffPrecoMarkup,
      pctDiffPrecoMarkup,
      diffPrecoComImpostos,
      pctDiffPrecoComImpostos,
      conclusao,
      insumosEmComum,
      insumosApenasA,
      insumosApenasB,
    }
  }, [fichas, fichaComparadaAId, fichaComparadaBId, produtosMap, materiasMap, configTributaria])

  const confirmDelete = (f: FichaTecnicaRecord) => {
    setFichaToDelete(f)
    setDeleteOpen(true)
  }

  const handleDelete = async () => {
    if (!fichaToDelete) return
    setDeleting(true)
    try {
      await fichasTecnicasService.delete(fichaToDelete.id)
      toast({
        title: 'Ficha Técnica excluída',
        description: 'A ficha técnica foi removida.',
      })
      if (selectedFicha?.id === fichaToDelete.id) setSelectedFicha(null)
      setDeleteOpen(false)
      setFichaToDelete(null)
      loadData()
    } catch (err: any) {
      console.error(err)
      toast({
        variant: 'destructive',
        title: 'Erro ao excluir',
        description: err?.message || 'Não foi possível excluir a ficha técnica.',
      })
    } finally {
      setDeleting(false)
    }
  }

  // Exportar CSV de Fichas
  const handleExportCsv = () => {
    if (fichas.length === 0) {
      toast({
        variant: 'destructive',
        title: 'Nada para exportar',
        description: 'Não há fichas técnicas cadastradas.',
      })
      return
    }

    const escapeCsv = (val: string | number | undefined | null): string => {
      if (val === null || val === undefined) return ''
      const s = String(val)
      if (/[;"\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
      return s
    }

    const fmtNum = (n?: number) =>
      n !== undefined && n !== null
        ? n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        : ''

    const headers = [
      'Código Produto',
      'Produto',
      'Qtd de Insumos',
      'Custo Matéria-Prima (R$)',
      'Outros Custos (R$)',
      'Custo Total (R$)',
      'Margem Desejada (%)',
      'Preço Sugerido por Margem (R$)',
      'Markup Desejado (%)',
      'Preço Sugerido por Markup (R$)',
      'Observações',
    ]

    const linhas = [headers.map(escapeCsv).join(';')]

    for (const f of fichasFiltradas) {
      const prod = produtosMap.get(f.produto)
      const custoTotal = Number(f.custo_total) || 0
      const markupVal =
        f.markup_desejado !== undefined && f.markup_desejado !== null
          ? f.markup_desejado
          : f.margem_desejada && f.margem_desejada < 100
            ? (f.margem_desejada / (100 - f.margem_desejada)) * 100
            : 50
      const precoMarkup =
        f.preco_venda_markup || (custoTotal > 0 ? custoTotal * (1 + markupVal / 100) : 0)

      linhas.push(
        [
          prod?.codigo || '',
          prod?.nome || 'Produto',
          f.itens?.length || 0,
          fmtNum(f.custo_materia_prima),
          fmtNum(f.outros_custos),
          fmtNum(f.custo_total),
          f.margem_desejada !== undefined ? f.margem_desejada.toFixed(1) + '%' : '',
          fmtNum(f.preco_venda_sugerido),
          markupVal !== undefined ? markupVal.toFixed(1) + '%' : '',
          fmtNum(precoMarkup),
          f.observacoes || '',
        ]
          .map(escapeCsv)
          .join(';'),
      )
    }

    const csvContent = '\uFEFF' + linhas.join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    const dataStr = new Date().toISOString().slice(0, 10)
    link.setAttribute('download', `fichas-tecnicas-${dataStr}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    toast({
      title: 'Exportação concluída',
      description: 'O arquivo CSV com as fichas técnicas foi baixado.',
    })
  }

  // Exportar CSV do Relatório de Custos e Margem Real
  const handleOpenPdfModal = (f: FichaTecnicaRecord) => {
    setFichaParaPdf(f)
    setPdfModalOpen(true)
  }

  const handleExportRelatorioCsv = () => {
    if (relatorioData.length === 0) {
      toast({
        variant: 'destructive',
        title: 'Nada para exportar',
        description: 'Não há produtos com ficha técnica para gerar relatório.',
      })
      return
    }

    const escapeCsv = (val: string | number | undefined | null): string => {
      if (val === null || val === undefined) return ''
      const s = String(val)
      if (/[;"\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
      return s
    }

    const fmtNum = (n?: number) =>
      n !== undefined && n !== null
        ? n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        : ''

    const headers = [
      'Código',
      'Produto',
      'Categoria',
      'Unidade',
      'Qtd Insumos',
      'Custo MP Bruto (R$)',
      'Créditos Tributários (ICMS/PIS/COFINS) (R$)',
      'Acréscimos (IPI/Frete/Perdas) (R$)',
      'Custo MP Líquido (R$)',
      'Outros Custos (R$)',
      'Custo Total Bruto (R$)',
      'Custo Total Líquido (R$)',
      'Preço de Venda Praticado (R$)',
      'Preço Sugerido por Margem (R$)',
      'Preço Sugerido por Markup (R$)',
      'Markup Desejado (%)',
      'Lucro Unitário Real (R$)',
      'Margem Desejada (%)',
      'Margem Real (%)',
      'Diferença Margem (p.p.)',
      'Status Margem',
    ]

    const linhas: string[] = [
      ['RELATÓRIO COMPARATIVO DE CUSTOS E MARGEM REAL (BASE CUSTO LÍQUIDO)']
        .map(escapeCsv)
        .join(';'),
      ['Data de Exportação:', new Date().toLocaleDateString('pt-BR')].map(escapeCsv).join(';'),
      '',
      ['1. PRODUTOS E COMPARAÇÃO DE MARGEM'].map(escapeCsv).join(';'),
      headers.map(escapeCsv).join(';'),
    ]

    for (const item of relatorioFiltrado) {
      const statusLabel =
        item.statusMargem === 'critica'
          ? 'Margem Negativa / Prejuízo'
          : item.statusMargem === 'abaixo'
            ? 'Abaixo do Desejado'
            : item.statusMargem === 'atingida'
              ? 'Meta Atingida'
              : 'Acima do Desejado'

      const mkDesejado =
        item.ficha.markup_desejado !== undefined && item.ficha.markup_desejado !== null
          ? item.ficha.markup_desejado
          : item.margemDesejada < 100 && item.margemDesejada > 0
            ? (item.margemDesejada / (100 - item.margemDesejada)) * 100
            : 50

      const precoMk =
        item.ficha.preco_venda_markup ||
        (item.custoTotal > 0 ? item.custoTotal * (1 + mkDesejado / 100) : 0)

      linhas.push(
        [
          item.produtoCodigo,
          item.produtoNome,
          item.categoria,
          item.unidade,
          item.itensCount,
          fmtNum(item.custoMPBruto),
          fmtNum(item.creditosTotais),
          fmtNum(item.acrescimosTotais),
          fmtNum(item.custoMPLiquido),
          fmtNum(item.outrosCustos),
          fmtNum(item.custoTotalBruto),
          fmtNum(item.custoTotalLiquido),
          fmtNum(item.precoVenda),
          fmtNum(item.precoSugerido),
          fmtNum(precoMk),
          mkDesejado.toFixed(1) + '%',
          fmtNum(item.lucroUnitario),
          item.margemDesejada.toFixed(2) + '%',
          item.margemReal.toFixed(2) + '%',
          (item.diffMargem >= 0 ? '+' : '') + item.diffMargem.toFixed(2) + ' p.p.',
          statusLabel,
        ]
          .map(escapeCsv)
          .join(';'),
      )
    }

    // Seção de Totais Consolidados por Categoria de Matéria-Prima no CSV
    linhas.push('')
    linhas.push(
      ['2. COMPOSIÇÃO CONSOLIDADA DE CUSTO POR CATEGORIA DE MATÉRIA-PRIMA']
        .map(escapeCsv)
        .join(';'),
    )
    linhas.push(
      [
        'Categoria de Matéria-Prima',
        'Produtos Atendidos',
        'Total de Usos (Itens)',
        'Custo Consolidado (R$)',
        '% sobre Custo MP Total',
        '% sobre Custo Geral Total',
      ]
        .map(escapeCsv)
        .join(';'),
    )

    for (const cat of composicaoCategoriasRelatorio.categorias) {
      linhas.push(
        [
          cat.categoria,
          cat.produtosCount,
          cat.itensCount,
          fmtNum(cat.totalCusto),
          cat.pctSobreMP.toFixed(2) + '%',
          cat.pctSobreTotal.toFixed(2) + '%',
        ]
          .map(escapeCsv)
          .join(';'),
      )
    }

    linhas.push(
      [
        'SUBTOTAL MATÉRIAS-PRIMAS',
        '-',
        '-',
        fmtNum(composicaoCategoriasRelatorio.custoMPGlobal),
        '100,00%',
        (composicaoCategoriasRelatorio.custoTotalGlobal > 0
          ? (
              (composicaoCategoriasRelatorio.custoMPGlobal /
                composicaoCategoriasRelatorio.custoTotalGlobal) *
              100
            ).toFixed(2)
          : '100.00') + '%',
      ]
        .map(escapeCsv)
        .join(';'),
    )

    linhas.push(
      [
        'OUTROS CUSTOS / MOD',
        '-',
        '-',
        fmtNum(composicaoCategoriasRelatorio.outrosCustosGlobal),
        '-',
        (composicaoCategoriasRelatorio.custoTotalGlobal > 0
          ? (
              (composicaoCategoriasRelatorio.outrosCustosGlobal /
                composicaoCategoriasRelatorio.custoTotalGlobal) *
              100
            ).toFixed(2)
          : '0.00') + '%',
      ]
        .map(escapeCsv)
        .join(';'),
    )

    linhas.push(
      [
        'CUSTO TOTAL GERAL',
        '-',
        '-',
        fmtNum(composicaoCategoriasRelatorio.custoTotalGlobal),
        '-',
        '100,00%',
      ]
        .map(escapeCsv)
        .join(';'),
    )

    const csvContent = '\uFEFF' + linhas.join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    const dataStr = new Date().toISOString().slice(0, 10)
    link.setAttribute('download', `relatorio-custos-margem-real-${dataStr}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    toast({
      title: 'Relatório exportado',
      description:
        'O arquivo CSV do relatório de custos, margem real e composição por categoria foi baixado.',
    })
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Abas Superiores: Gestão de Fichas vs Relatório de Custos e Margem Real */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div>
          <h2 className="text-lg font-bold text-[#0B1F3A] flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-blue-600" />
            Fichas Técnicas & Formação de Custo
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Gerencie composições de produtos, clone fichas e acompanhe a margem real praticada vs
            desejada.
          </p>
        </div>

        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as any)}
          className="w-full lg:w-auto"
        >
          <TabsList className="bg-slate-100 p-1 w-full lg:w-auto grid grid-cols-3">
            <TabsTrigger
              value="fichas"
              className="text-xs font-semibold data-[state=active]:bg-white data-[state=active]:text-blue-700 data-[state=active]:shadow-xs gap-1.5"
            >
              <ClipboardList className="w-3.5 h-3.5" />
              Fichas ({fichas.length})
            </TabsTrigger>
            <TabsTrigger
              value="comparacao"
              className="text-xs font-semibold data-[state=active]:bg-white data-[state=active]:text-indigo-700 data-[state=active]:shadow-xs gap-1.5"
            >
              <GitCompare className="w-3.5 h-3.5" />
              Comparar Fichas
            </TabsTrigger>
            <TabsTrigger
              value="relatorio"
              className="text-xs font-semibold data-[state=active]:bg-white data-[state=active]:text-emerald-700 data-[state=active]:shadow-xs gap-1.5"
            >
              <BarChart3 className="w-3.5 h-3.5" />
              Margem Real
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* RENDERIZAÇÃO DAS ABAS */}
      {activeTab === 'fichas' ? (
        <>
          {/* Cards de Métricas de Fichas */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="bg-white border-slate-200 shadow-xs">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-500 font-medium">Fichas Cadastradas</p>
                  <h3 className="text-xl font-bold text-[#0B1F3A] mt-1">{stats.total}</h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">Produtos parametrizados</p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <ClipboardList className="w-5 h-5" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white border-slate-200 shadow-xs">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-500 font-medium">Custo Médio MP</p>
                  <h3 className="text-xl font-bold text-amber-700 mt-1">
                    {formatBrl(stats.custoMedioMP)}
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">Matérias-primas</p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                  <Layers className="w-5 h-5" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white border-slate-200 shadow-xs">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-500 font-medium">Custo Total Médio</p>
                  <h3 className="text-xl font-bold text-slate-900 mt-1">
                    {formatBrl(stats.custoTotalMedio)}
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">MP + Outros custos</p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center">
                  <Coins className="w-5 h-5" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white border-slate-200 shadow-xs">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-500 font-medium">Preço Sugerido Médio</p>
                  <h3 className="text-xl font-bold text-emerald-700 mt-1">
                    {formatBrl(stats.precoMedioSugerido)}
                  </h3>
                  <p className="text-[11px] text-emerald-600 font-medium mt-0.5">
                    Com margem aplicada
                  </p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Lista de Fichas Técnicas */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
            {/* Coluna 1 & 2: Tabela Principal de Fichas */}
            <div className="xl:col-span-2 space-y-6">
              <Card className="bg-white border-slate-200 shadow-xs">
                <CardHeader className="pb-3 border-b border-slate-100">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <CardTitle className="text-base font-bold text-[#0B1F3A] flex items-center gap-2">
                        <ClipboardList className="w-4 h-4 text-blue-600" />
                        Fichas Técnicas de Produtos
                      </CardTitle>
                      <CardDescription className="text-xs">
                        Estrutura de custo, lista de insumos e preço de venda sugerido.
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Button
                        type="button"
                        onClick={handleExportCsv}
                        variant="outline"
                        size="sm"
                        className="h-9 text-xs font-semibold border-slate-200 text-slate-700 hover:bg-slate-50"
                      >
                        <Download className="w-3.5 h-3.5 mr-1.5" />
                        Exportar CSV
                      </Button>
                      <Button
                        type="button"
                        onClick={handleOpenNew}
                        size="sm"
                        className="h-9 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-xs"
                      >
                        <Plus className="w-3.5 h-3.5 mr-1.5" />
                        Nova Ficha Técnica
                      </Button>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="p-4">
                  <div className="mb-4">
                    <div className="relative">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <Input
                        placeholder="Buscar ficha por produto ou código..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-9 h-9 text-xs"
                      />
                    </div>
                  </div>

                  {loading ? (
                    <div className="py-16 flex justify-center items-center">
                      <div className="w-7 h-7 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
                    </div>
                  ) : fichasFiltradas.length === 0 ? (
                    <div className="py-16 text-center">
                      <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-3 text-slate-400">
                        <ClipboardList className="w-6 h-6" />
                      </div>
                      <h4 className="text-sm font-semibold text-slate-800">
                        Nenhuma ficha técnica cadastrada
                      </h4>
                      <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                        {fichas.length === 0
                          ? 'Crie a primeira ficha técnica vinculando um produto aos seus insumos de fabricação.'
                          : 'Nenhum resultado para os termos pesquisados.'}
                      </p>
                      {fichas.length === 0 && (
                        <Button
                          onClick={handleOpenNew}
                          size="sm"
                          className="mt-4 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white"
                        >
                          <Plus className="w-3.5 h-3.5 mr-1.5" />
                          Criar Primeira Ficha Técnica
                        </Button>
                      )}
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-lg border border-slate-200">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-slate-200 bg-slate-50/80 text-slate-700 font-semibold">
                            <th className="py-3 px-3.5">Produto</th>
                            <th className="py-3 px-3.5 text-center">Itens</th>
                            <th className="py-3 px-3.5 text-right">Custo MP (R$)</th>
                            <th className="py-3 px-3.5 text-right">Outros (R$)</th>
                            <th className="py-3 px-3.5 text-right">Custo Total (R$)</th>
                            <th className="py-3 px-3.5 text-right">Margem (%)</th>
                            <th className="py-3 px-3.5 text-right">Preço Sugerido (R$)</th>
                            <th className="py-3 px-3.5 text-right">Ações</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {fichasFiltradas.map((f) => {
                            const prod = produtosMap.get(f.produto)
                            const isSel = selectedFicha?.id === f.id

                            return (
                              <tr
                                key={f.id}
                                onClick={() => setSelectedFicha(f)}
                                className={`cursor-pointer transition-colors ${
                                  isSel ? 'bg-blue-50/90' : 'hover:bg-slate-50/70'
                                }`}
                              >
                                <td className="py-3 px-3.5">
                                  <div className="font-semibold text-slate-900">
                                    {prod?.nome || 'Produto não encontrado'}
                                  </div>
                                  <div className="text-[11px] text-slate-400 font-mono">
                                    {prod?.codigo || 'Sem código'} · {prod?.unidade || 'UN'}
                                  </div>
                                </td>
                                <td className="py-3 px-3.5 text-center whitespace-nowrap">
                                  <Badge variant="outline" className="text-[10px] bg-slate-50">
                                    {f.itens?.length || 0} item(ns)
                                  </Badge>
                                </td>
                                <td className="py-3 px-3.5 text-right font-medium text-slate-700 whitespace-nowrap">
                                  {formatBrl(f.custo_materia_prima)}
                                </td>
                                <td className="py-3 px-3.5 text-right text-slate-500 whitespace-nowrap">
                                  {formatBrl(f.outros_custos)}
                                </td>
                                <td className="py-3 px-3.5 text-right font-bold text-slate-900 whitespace-nowrap">
                                  {formatBrl(f.custo_total)}
                                </td>
                                <td className="py-3 px-3.5 text-right font-semibold text-amber-700 whitespace-nowrap">
                                  <div>{formatPct(f.margem_desejada)}</div>
                                  <div className="text-[10px] text-slate-400 font-normal">
                                    Mk:{' '}
                                    {formatPct(
                                      f.markup_desejado ??
                                        (f.margem_desejada && f.margem_desejada < 100
                                          ? (f.margem_desejada / (100 - f.margem_desejada)) * 100
                                          : 50),
                                    )}
                                  </div>
                                </td>
                                <td className="py-3 px-3.5 text-right whitespace-nowrap">
                                  <div className="font-bold text-emerald-700">
                                    {formatBrl(f.preco_venda_sugerido)}
                                  </div>
                                  <div
                                    className="text-[10px] text-blue-600 font-medium"
                                    title="Preço Sugerido por Markup"
                                  >
                                    Mk:{' '}
                                    {formatBrl(
                                      f.preco_venda_markup ||
                                        (Number(f.custo_total) > 0
                                          ? Number(f.custo_total) *
                                            (1 +
                                              (f.markup_desejado ??
                                                (f.margem_desejada && f.margem_desejada < 100
                                                  ? (f.margem_desejada /
                                                      (100 - f.margem_desejada)) *
                                                    100
                                                  : 50)) /
                                                100)
                                          : 0),
                                    )}
                                  </div>
                                </td>
                                <td className="py-3 px-3.5 text-right whitespace-nowrap">
                                  <div className="flex items-center justify-end gap-1">
                                    <Button
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        handleOpenVincularPreco(f)
                                      }}
                                      size="sm"
                                      variant="ghost"
                                      className="h-7 px-2 text-[11px] text-blue-700 hover:text-blue-800 hover:bg-blue-50 font-semibold"
                                      title="Vincular preço sugerido ao produto"
                                    >
                                      <LinkIcon className="w-3 h-3 mr-1" />
                                      Vincular
                                    </Button>
                                    <Button
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        handleOpenPdfModal(f)
                                      }}
                                      size="sm"
                                      variant="ghost"
                                      className="h-7 px-2 text-[11px] text-[#0B1F3A] hover:bg-slate-100 font-semibold gap-1"
                                      title="Gerar PDF da Ficha Técnica (A4)"
                                    >
                                      <Printer className="w-3.5 h-3.5 text-blue-600" />
                                      PDF
                                    </Button>
                                    <Button
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        handleOpenClone(f)
                                      }}
                                      size="sm"
                                      variant="ghost"
                                      className="h-7 w-7 p-0 text-slate-500 hover:text-emerald-700 hover:bg-emerald-50"
                                      title="Clonar ficha técnica para outro produto"
                                    >
                                      <Copy className="w-3.5 h-3.5" />
                                    </Button>
                                    <Button
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        handleOpenEdit(f)
                                      }}
                                      size="sm"
                                      variant="ghost"
                                      className="h-7 w-7 p-0 text-slate-500 hover:text-blue-600 hover:bg-blue-50"
                                      title="Editar ficha técnica"
                                    >
                                      <Pencil className="w-3.5 h-3.5" />
                                    </Button>
                                    <Button
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        confirmDelete(f)
                                      }}
                                      size="sm"
                                      variant="ghost"
                                      className="h-7 w-7 p-0 text-slate-500 hover:text-red-600 hover:bg-red-50"
                                      title="Excluir ficha técnica"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </Button>{' '}
                                  </div>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Coluna 3: Detalhamento da Ficha Selecionada */}
            <div className="space-y-6">
              {!selectedFicha ? (
                <Card className="bg-white border-dashed border-slate-300 shadow-xs">
                  <CardContent className="py-16 text-center">
                    <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-3 text-slate-400">
                      <Calculator className="w-6 h-6" />
                    </div>
                    <h4 className="text-sm font-semibold text-slate-800">Selecione uma Ficha</h4>
                    <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
                      Clique em qualquer ficha técnica da tabela para visualizar a composição
                      detalhada de insumos e fórmula de precificação.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                (() => {
                  const prod = produtosMap.get(selectedFicha.produto)
                  const itens = selectedFicha.itens || []
                  const custoMPBruto = Number(selectedFicha.custo_materia_prima) || 0
                  const outrosCustos = Number(selectedFicha.outros_custos) || 0
                  const margem = Number(selectedFicha.margem_desejada) || 0
                  const markup =
                    selectedFicha.markup_desejado !== undefined &&
                    selectedFicha.markup_desejado !== null
                      ? Number(selectedFicha.markup_desejado)
                      : margem < 100 && margem > 0
                        ? (margem / (100 - margem)) * 100
                        : 50

                  // Cálculo dinâmico de créditos tributários e acréscimos se não estiverem gravados
                  let totalCreditosInsumos = 0
                  let custoMPLiquidoCalc = 0
                  for (const it of itens) {
                    const mp = materiasMap.get(it.materia_prima_id)
                    const isIsenta = Boolean(
                      it.isenta_st ??
                      (mp?.isenta_st ||
                        mp?.tipo_tributacao === 'isenta' ||
                        mp?.tipo_tributacao === 'substituicao_tributaria'),
                    )
                    const icms = isIsenta
                      ? 0
                      : Number(it.icms_percentual ?? mp?.icms_percentual ?? 0)
                    const pis = isIsenta ? 0 : Number(it.pis_percentual ?? mp?.pis_percentual ?? 0)
                    const cofins = isIsenta
                      ? 0
                      : Number(it.cofins_percentual ?? mp?.cofins_percentual ?? 0)
                    const ipi = Number(it.ipi_percentual ?? mp?.ipi_percentual ?? 0)
                    const frete = Number(it.frete_percentual ?? mp?.frete_percentual ?? 0)
                    const perdas = Number(it.perdas_percentual ?? mp?.perdas_percentual ?? 0)
                    const cBruto = Number(it.custo_unitario) || 0
                    const qtd = Number(it.quantidade) || 0
                    const trib = calcularTributosMateriaPrima(
                      cBruto,
                      icms,
                      pis,
                      cofins,
                      isIsenta,
                      mp?.tipo_tributacao,
                      ipi,
                      frete,
                      perdas,
                    )
                    totalCreditosInsumos += qtd * trib.totalCreditos
                    custoMPLiquidoCalc += qtd * trib.custoLiquido
                  }

                  const creditosTotais =
                    selectedFicha.creditos_tributarios_totais !== undefined
                      ? Number(selectedFicha.creditos_tributarios_totais)
                      : totalCreditosInsumos

                  const custoMPLiquido =
                    selectedFicha.custo_materia_prima_liquido !== undefined
                      ? Number(selectedFicha.custo_materia_prima_liquido)
                      : custoMPLiquidoCalc

                  const custoTotalLiquido =
                    selectedFicha.custo_total_liquido !== undefined
                      ? Number(selectedFicha.custo_total_liquido)
                      : Number(selectedFicha.custo_total) || custoMPLiquido + outrosCustos

                  const custoTotal = custoTotalLiquido

                  const precoMargem =
                    Number(
                      selectedFicha.preco_venda_sugerido_liquido ||
                        selectedFicha.preco_venda_sugerido,
                    ) ||
                    (margem < 100 && custoTotal > 0 ? custoTotal / (1 - margem / 100) : custoTotal)

                  const precoMarkup =
                    Number(
                      selectedFicha.preco_venda_markup_liquido || selectedFicha.preco_venda_markup,
                    ) || (custoTotal > 0 ? custoTotal * (1 + markup / 100) : custoTotal)

                  // Preparação de dados categorizados para o gráfico de composição
                  // Agrupa insumos por categoria (ex: Insumos principais, Embalagem, etc.) ou lista itens + outros custos
                  const categoriasInsumosMap = new Map<string, number>()
                  for (const it of itens) {
                    const mp = materiasMap.get(it.materia_prima_id)
                    const catName = mp?.categoria?.trim() || 'Matéria-Prima Direta'
                    const prev = categoriasInsumosMap.get(catName) || 0
                    categoriasInsumosMap.set(catName, prev + (it.subtotal || 0))
                  }

                  const chartDataList: Array<{ name: string; value: number; color: string }> = []
                  const PALETTE = ['#2563EB', '#0D9488', '#F59E0B', '#8B5CF6', '#EC4899', '#06B6D4']
                  let pIdx = 0

                  if (categoriasInsumosMap.size > 0) {
                    categoriasInsumosMap.forEach((val, key) => {
                      if (val > 0) {
                        chartDataList.push({
                          name: key,
                          value: Math.round(val * 100) / 100,
                          color: PALETTE[pIdx % PALETTE.length],
                        })
                        pIdx++
                      }
                    })
                  } else if (custoMPLiquido > 0) {
                    chartDataList.push({
                      name: 'Matéria-Prima',
                      value: Math.round(custoMPLiquido * 100) / 100,
                      color: '#2563EB',
                    })
                  }

                  if (outrosCustos > 0) {
                    chartDataList.push({
                      name: 'Outros Custos / MOD',
                      value: Math.round(outrosCustos * 100) / 100,
                      color: '#F97316',
                    })
                  }

                  // Se tudo estiver zerado
                  if (chartDataList.length === 0) {
                    chartDataList.push({
                      name: 'Sem custo apurado',
                      value: 1,
                      color: '#CBD5E1',
                    })
                  }

                  const precoVendaAtualProd = Number(prod?.preco_venda) || 0

                  return (
                    <Card className="bg-white border-slate-200 shadow-xs">
                      <CardHeader className="pb-3 border-b border-slate-100">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                              Ficha Técnica Detalhada
                            </span>
                            <CardTitle className="text-base font-bold text-[#0B1F3A] mt-1.5">
                              {prod?.nome || 'Produto'}
                            </CardTitle>
                            <CardDescription className="text-xs">
                              {prod?.codigo ? `Código: ${prod.codigo} · ` : ''}Unidade:{' '}
                              {prod?.unidade || 'UN'}
                              {prod?.categoria ? ` · Categoria: ${prod.categoria}` : ''}
                            </CardDescription>
                          </div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <Button
                              onClick={() => handleOpenPdfModal(selectedFicha)}
                              size="sm"
                              className="h-8 text-xs font-semibold bg-[#0B1F3A] hover:bg-[#15325b] text-white gap-1 shadow-xs"
                              title="Gerar PDF A4 Profissional desta Ficha Técnica"
                            >
                              <Printer className="w-3.5 h-3.5" />
                              Gerar PDF
                            </Button>
                            <Button
                              onClick={() => handleOpenClone(selectedFicha)}
                              size="sm"
                              variant="outline"
                              className="h-8 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 border-emerald-200"
                              title="Clonar esta ficha técnica"
                            >
                              <Copy className="w-3 h-3 mr-1" />
                              Clonar
                            </Button>
                            <Button
                              onClick={() => handleOpenEdit(selectedFicha)}
                              size="sm"
                              variant="outline"
                              className="h-8 text-xs font-semibold"
                            >
                              <Pencil className="w-3 h-3 mr-1" />
                              Editar
                            </Button>
                          </div>
                        </div>
                      </CardHeader>

                      <CardContent className="p-4 space-y-5">
                        {/* 1. GRÁFICO DE COMPOSIÇÃO DE CUSTO DA FICHA TÉCNICA */}
                        <div className="p-3.5 bg-slate-50/90 border border-slate-200 rounded-xl space-y-3">
                          <div className="flex items-center justify-between">
                            <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                              <PieChartIcon className="w-3.5 h-3.5 text-blue-600" />
                              Composição do Custo Total
                            </h4>
                            <div className="flex items-center bg-white border border-slate-200 rounded p-0.5 text-[10px]">
                              <button
                                type="button"
                                onClick={() => setTipoGraficoComposicao('donut')}
                                className={`px-2 py-0.5 rounded font-semibold transition-colors ${
                                  tipoGraficoComposicao === 'donut'
                                    ? 'bg-blue-600 text-white'
                                    : 'text-slate-600 hover:text-slate-900'
                                }`}
                              >
                                Rosca
                              </button>
                              <button
                                type="button"
                                onClick={() => setTipoGraficoComposicao('bar')}
                                className={`px-2 py-0.5 rounded font-semibold transition-colors ${
                                  tipoGraficoComposicao === 'bar'
                                    ? 'bg-blue-600 text-white'
                                    : 'text-slate-600 hover:text-slate-900'
                                }`}
                              >
                                Barras
                              </button>
                            </div>
                          </div>

                          {custoTotal > 0 ? (
                            <>
                              <div className="h-44 w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                  {tipoGraficoComposicao === 'donut' ? (
                                    <PieChart>
                                      <Tooltip
                                        formatter={(val: any, name: any) => [
                                          `${formatBrl(Number(val))} (${(
                                            (Number(val) / custoTotal) *
                                            100
                                          ).toFixed(1)}%)`,
                                          name,
                                        ]}
                                        contentStyle={{
                                          backgroundColor: '#0F172A',
                                          color: '#fff',
                                          borderRadius: '8px',
                                          fontSize: '11px',
                                          border: 'none',
                                        }}
                                      />
                                      <Pie
                                        data={chartDataList}
                                        dataKey="value"
                                        nameKey="name"
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={36}
                                        outerRadius={65}
                                        paddingAngle={3}
                                      >
                                        {chartDataList.map((entry, index) => (
                                          <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                      </Pie>
                                    </PieChart>
                                  ) : (
                                    <BarChart
                                      data={chartDataList}
                                      layout="vertical"
                                      margin={{ top: 5, right: 20, left: 20, bottom: 5 }}
                                    >
                                      <CartesianGrid
                                        strokeDasharray="3 3"
                                        horizontal={false}
                                        stroke="#E2E8F0"
                                      />
                                      <XAxis
                                        type="number"
                                        tickFormatter={(v) => `R$ ${v}`}
                                        fontSize={10}
                                      />
                                      <YAxis
                                        type="category"
                                        dataKey="name"
                                        width={80}
                                        fontSize={10}
                                      />
                                      <Tooltip
                                        formatter={(val: any) => [formatBrl(Number(val)), 'Custo']}
                                        contentStyle={{
                                          backgroundColor: '#0F172A',
                                          color: '#fff',
                                          borderRadius: '8px',
                                          fontSize: '11px',
                                        }}
                                      />
                                      <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                                        {chartDataList.map((entry, index) => (
                                          <Cell key={`cell-bar-${index}`} fill={entry.color} />
                                        ))}
                                      </Bar>
                                    </BarChart>
                                  )}
                                </ResponsiveContainer>
                              </div>

                              {/* Legenda com R$ e % */}
                              <div className="space-y-1.5 pt-1 border-t border-slate-200">
                                {chartDataList.map((item, idx) => {
                                  const pct = custoTotal > 0 ? (item.value / custoTotal) * 100 : 0
                                  return (
                                    <div
                                      key={idx}
                                      className="flex items-center justify-between text-xs text-slate-700"
                                    >
                                      <div className="flex items-center gap-1.5 truncate pr-2">
                                        <span
                                          className="w-2.5 h-2.5 rounded-full shrink-0"
                                          style={{ backgroundColor: item.color }}
                                        />
                                        <span className="truncate">{item.name}</span>
                                      </div>
                                      <div className="font-semibold shrink-0 text-slate-900">
                                        {formatBrl(item.value)}{' '}
                                        <span className="text-[11px] text-slate-400 font-normal">
                                          ({pct.toFixed(1)}%)
                                        </span>
                                      </div>
                                    </div>
                                  )
                                })}
                              </div>
                            </>
                          ) : (
                            <div className="py-6 text-center text-xs text-slate-400">
                              Nenhum custo cadastrado nesta ficha para gerar gráfico.
                            </div>
                          )}
                        </div>

                        {/* 2. BOTÃO E PAINEL: VINCULAR PREÇO AO PRODUTO */}
                        <div className="p-3.5 bg-gradient-to-br from-blue-50/80 to-indigo-50/70 border border-blue-200 rounded-xl space-y-2.5">
                          <div className="flex items-center justify-between">
                            <div>
                              <span className="text-[10px] font-bold text-blue-700 uppercase tracking-wider block">
                                Integração Produto
                              </span>
                              <span className="text-xs font-bold text-slate-900">
                                Preço no Catálogo: {formatBrl(precoVendaAtualProd)}
                              </span>
                            </div>
                            <Button
                              type="button"
                              onClick={() => handleOpenVincularPreco(selectedFicha)}
                              size="sm"
                              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs h-8 shadow-xs gap-1.5"
                            >
                              <LinkIcon className="w-3.5 h-3.5" />
                              Vincular Preço ao Produto
                            </Button>
                          </div>
                          <p className="text-[11px] text-slate-600">
                            Atualize o preço de venda do cadastro do produto com o preço sugerido
                            por margem ou markup.
                          </p>
                        </div>

                        {/* 3. COMPOSIÇÃO DE INSUMOS */}
                        <div>
                          <h4 className="text-xs font-bold text-slate-700 mb-2 flex items-center gap-1.5">
                            <Layers className="w-3.5 h-3.5 text-amber-600" />
                            Composição de Insumos ({itens.length})
                          </h4>

                          <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                            {itens.map((it, idx) => {
                              const mp = materiasMap.get(it.materia_prima_id)
                              const isIsenta = Boolean(
                                it.isenta_st ??
                                (mp?.isenta_st ||
                                  mp?.tipo_tributacao === 'isenta' ||
                                  mp?.tipo_tributacao === 'substituicao_tributaria'),
                              )
                              const icms = isIsenta
                                ? 0
                                : Number(it.icms_percentual ?? mp?.icms_percentual ?? 0)
                              const pis = isIsenta
                                ? 0
                                : Number(it.pis_percentual ?? mp?.pis_percentual ?? 0)
                              const cofins = isIsenta
                                ? 0
                                : Number(it.cofins_percentual ?? mp?.cofins_percentual ?? 0)
                              const ipi = Number(it.ipi_percentual ?? mp?.ipi_percentual ?? 0)
                              const frete = Number(it.frete_percentual ?? mp?.frete_percentual ?? 0)
                              const perdas = Number(
                                it.perdas_percentual ?? mp?.perdas_percentual ?? 0,
                              )
                              const trib = calcularTributosMateriaPrima(
                                Number(it.custo_unitario) || 0,
                                icms,
                                pis,
                                cofins,
                                isIsenta,
                                mp?.tipo_tributacao,
                                ipi,
                                frete,
                                perdas,
                              )
                              const subtotalLiquido =
                                (Number(it.quantidade) || 0) * trib.custoLiquido
                              const creditoItemTotal =
                                (Number(it.quantidade) || 0) * trib.totalCreditos
                              const acrescimosItemTotal =
                                (Number(it.quantidade) || 0) * trib.totalAcrescimos

                              return (
                                <div
                                  key={idx}
                                  className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-between text-xs gap-2"
                                >
                                  <div>
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <p className="font-semibold text-slate-800">
                                        {it.materia_prima_nome || mp?.nome || 'Insumo'}
                                      </p>
                                      {isIsenta ? (
                                        <Badge className="text-[9px] px-1 py-0 bg-slate-100 text-slate-600">
                                          Isenta / ST
                                        </Badge>
                                      ) : (
                                        creditoItemTotal > 0 && (
                                          <Badge className="text-[9px] px-1 py-0 bg-blue-50 text-blue-800 border-blue-200">
                                            Crédito -{formatBrl(creditoItemTotal)}
                                          </Badge>
                                        )
                                      )}
                                      {acrescimosItemTotal > 0 && (
                                        <Badge className="text-[9px] px-1 py-0 bg-amber-50 text-amber-800 border-amber-200">
                                          Acréscimos +{formatBrl(acrescimosItemTotal)}
                                        </Badge>
                                      )}
                                    </div>
                                    <p className="text-[11px] text-slate-500 mt-0.5">
                                      {it.quantidade} {it.unidade || mp?.unidade || 'UN'} ×{' '}
                                      {formatBrl(it.custo_unitario)} (Bruto) → Líq:{' '}
                                      <strong className="text-blue-900">
                                        {formatBrl(trib.custoLiquido)}
                                      </strong>
                                      /un
                                    </p>
                                  </div>
                                  <div className="text-right shrink-0">
                                    <span className="font-bold text-blue-950 font-mono block">
                                      {formatBrl(subtotalLiquido)}
                                    </span>
                                    <span className="text-[10px] text-slate-400 block">
                                      Bruto: {formatBrl(it.subtotal)}
                                    </span>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </div>

                        {/* 4. COMPARATIVO DE PREÇOS SUGERIDOS: MARGEM VS MARKUP SOBRE CUSTO LÍQUIDO */}
                        <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2.5">
                          <div className="flex justify-between text-xs text-slate-600">
                            <span>Subtotal Matéria-Prima (Bruto):</span>
                            <span className="font-semibold text-slate-800">
                              {formatBrl(custoMPBruto)}
                            </span>
                          </div>
                          <div className="flex justify-between text-xs text-emerald-800">
                            <span>Créditos Tributários Dedução:</span>
                            <span className="font-semibold text-emerald-700 font-mono">
                              -{formatBrl(creditosTotais)}
                            </span>
                          </div>
                          <div className="flex justify-between text-xs text-blue-900 font-semibold">
                            <span>Subtotal Matéria-Prima (Líquido):</span>
                            <span className="font-mono">{formatBrl(custoMPLiquido)}</span>
                          </div>
                          <div className="flex justify-between text-xs text-slate-600">
                            <span>Outros Custos (MOD/Despesas):</span>
                            <span className="font-semibold text-slate-800">
                              {formatBrl(outrosCustos)}
                            </span>
                          </div>
                          <div className="flex justify-between text-xs font-bold text-indigo-950 border-t border-slate-200 pt-1.5">
                            <span>Custo Total Unitário Líquido (Base Real):</span>
                            <span className="font-mono text-sm">{formatBrl(custoTotal)}</span>
                          </div>

                          {/* Comparativo dos Preços Sugeridos com Impostos */}
                          {(() => {
                            const cargaTrib = Number(configTributaria?.carga_tributaria_total) || 0
                            let precoComImpostos = precoMargem
                            const div = 1 - (margem + cargaTrib) / 100
                            if (cargaTrib > 0 && div > 0.01 && custoTotal > 0) {
                              precoComImpostos = custoTotal / div
                            } else if (cargaTrib > 0 && custoTotal > 0) {
                              precoComImpostos = precoMargem * (1 + cargaTrib / 100)
                            }

                            return (
                              <div className="space-y-2 pt-2 border-t border-slate-200">
                                <div className="grid grid-cols-2 gap-2">
                                  <div className="bg-emerald-50/90 border border-emerald-200 rounded-lg p-2.5 text-center">
                                    <span className="text-[10px] font-bold text-emerald-800 block">
                                      Por Margem ({formatPct(margem)})
                                    </span>
                                    <span className="text-xs text-slate-500 block text-[10px]">
                                      Divisor: Custo / (1 - M)
                                    </span>
                                    <span className="text-sm font-extrabold text-emerald-800 mt-1 block">
                                      {formatBrl(precoMargem)}
                                    </span>
                                  </div>

                                  <div className="bg-blue-50/90 border border-blue-200 rounded-lg p-2.5 text-center">
                                    <span className="text-[10px] font-bold text-blue-800 block">
                                      Por Markup ({formatPct(markup)})
                                    </span>
                                    <span className="text-xs text-slate-500 block text-[10px]">
                                      Custo × (1 + Mk/100)
                                    </span>
                                    <span className="text-sm font-extrabold text-blue-800 mt-1 block">
                                      {formatBrl(precoMarkup)}
                                    </span>
                                  </div>
                                </div>

                                {cargaTrib > 0 && (
                                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5 text-center">
                                    <div className="flex items-center justify-between text-amber-900">
                                      <span className="text-[10px] font-bold">
                                        Com Impostos ({configTributaria?.regime_tributario} -{' '}
                                        {cargaTrib}% por dentro)
                                      </span>
                                      <span className="text-xs font-extrabold text-amber-950">
                                        {formatBrl(precoComImpostos)}
                                      </span>
                                    </div>
                                  </div>
                                )}
                              </div>
                            )
                          })()}
                        </div>

                        {selectedFicha.observacoes && (
                          <div className="text-xs text-slate-600 bg-blue-50/50 p-2.5 rounded border border-blue-100">
                            <span className="font-semibold text-blue-900 block mb-0.5">
                              Observações:
                            </span>
                            {selectedFicha.observacoes}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )
                })()
              )}
            </div>
          </div>
        </>
      ) : activeTab === 'comparacao' ? (
        /* ========================================================= */
        /* ABA DE COMPARAÇÃO DE DUAS FICHAS TÉCNICAS LADO A LADO    */
        /* ========================================================= */
        <div className="space-y-6 animate-fadeIn">
          {/* Cabeçalho de Seleção dos Dois Produtos para Comparar */}
          <Card className="bg-white border-slate-200 shadow-xs">
            <CardHeader className="pb-3 border-b border-slate-100">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-base font-bold text-[#0B1F3A] flex items-center gap-2">
                    <GitCompare className="w-4 h-4 text-indigo-600" />
                    Comparação de Fichas Técnicas Lado a Lado
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Analise dois produtos simultaneamente: custos de matéria-prima, outros custos,
                    markup, preços sugeridos e divergência de insumos.
                  </CardDescription>
                </div>
                {fichas.length >= 2 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const temp = fichaComparadaAId
                      setFichaComparadaAId(fichaComparadaBId)
                      setFichaComparadaBId(temp)
                    }}
                    className="h-8 text-xs font-semibold text-indigo-700 hover:bg-indigo-50 border-indigo-200 gap-1.5"
                  >
                    <ArrowUpDown className="w-3.5 h-3.5" />
                    Inverter Lados (A ⇄ B)
                  </Button>
                )}
              </div>
            </CardHeader>

            <CardContent className="p-4">
              {fichas.length < 2 ? (
                <div className="py-12 text-center">
                  <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-3">
                    <AlertCircle className="w-6 h-6" />
                  </div>
                  <h4 className="text-sm font-semibold text-slate-800">
                    Você precisa de ao menos 2 fichas técnicas para comparar
                  </h4>
                  <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                    Atualmente existem {fichas.length} ficha(s) técnica(s) cadastrada(s). Crie ou
                    clone mais fichas para habilitar a comparação lado a lado.
                  </p>
                  {fichas.length === 1 && (
                    <Button
                      onClick={() => handleOpenClone(fichas[0])}
                      size="sm"
                      className="mt-4 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      <Copy className="w-3.5 h-3.5 mr-1.5" />
                      Clonar Ficha Existente para Criar Variação
                    </Button>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Seletor Produto A */}
                  <div className="p-3.5 rounded-xl bg-blue-50/60 border border-blue-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <Label
                        htmlFor="comp-ficha-a"
                        className="text-xs font-bold text-blue-900 flex items-center gap-1.5"
                      >
                        <span className="w-2.5 h-2.5 rounded-full bg-blue-600 inline-block" />
                        Ficha Técnica A (Referência Base)
                      </Label>
                      <Badge className="text-[10px] bg-blue-100 text-blue-800 border-blue-300">
                        Produto A
                      </Badge>
                    </div>
                    <select
                      id="comp-ficha-a"
                      value={fichaComparadaAId}
                      onChange={(e) => setFichaComparadaAId(e.target.value)}
                      className="w-full h-9 text-xs bg-white border border-blue-300 rounded-md px-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
                    >
                      {fichas.map((f) => {
                        const p = produtosMap.get(f.produto)
                        return (
                          <option key={f.id} value={f.id} disabled={f.id === fichaComparadaBId}>
                            {p?.codigo ? `[${p.codigo}] ` : ''}
                            {p?.nome || 'Produto'} — Custo: {formatBrl(f.custo_total)}
                          </option>
                        )
                      })}
                    </select>
                  </div>

                  {/* Seletor Produto B */}
                  <div className="p-3.5 rounded-xl bg-purple-50/60 border border-purple-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <Label
                        htmlFor="comp-ficha-b"
                        className="text-xs font-bold text-purple-900 flex items-center gap-1.5"
                      >
                        <span className="w-2.5 h-2.5 rounded-full bg-purple-600 inline-block" />
                        Ficha Técnica B (Comparativo)
                      </Label>
                      <Badge className="text-[10px] bg-purple-100 text-purple-800 border-purple-300">
                        Produto B
                      </Badge>
                    </div>
                    <select
                      id="comp-ficha-b"
                      value={fichaComparadaBId}
                      onChange={(e) => setFichaComparadaBId(e.target.value)}
                      className="w-full h-9 text-xs bg-white border border-purple-300 rounded-md px-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-600"
                    >
                      {fichas.map((f) => {
                        const p = produtosMap.get(f.produto)
                        return (
                          <option key={f.id} value={f.id} disabled={f.id === fichaComparadaAId}>
                            {p?.codigo ? `[${p.codigo}] ` : ''}
                            {p?.nome || 'Produto'} — Custo: {formatBrl(f.custo_total)}
                          </option>
                        )
                      })}
                    </select>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* PAINEL DE RESULTADOS DA COMPARAÇÃO */}
          {comparacaoData && (
            <div className="space-y-6">
              {/* 1. CARD DE CONCLUSÃO EXECUTIVA / VEREDICTO DE ECONOMIA & PREÇO COM IMPOSTOS */}
              <div
                className={`p-4 rounded-xl border shadow-xs transition-all ${
                  comparacaoData.conclusao.viradaImpostos
                    ? 'bg-gradient-to-r from-amber-950 via-slate-900 to-indigo-950 text-white border-amber-500/60 ring-1 ring-amber-400/30'
                    : comparacaoData.conclusao.maisEconomica === 'iguais'
                      ? 'bg-slate-50 border-slate-300 text-slate-800'
                      : comparacaoData.conclusao.maisEconomica === 'B'
                        ? 'bg-gradient-to-r from-emerald-950 via-teal-900 to-slate-900 text-white border-emerald-500/50'
                        : 'bg-gradient-to-r from-blue-950 via-indigo-900 to-slate-900 text-white border-blue-500/50'
                }`}
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-bold uppercase tracking-wider border border-emerald-400/30">
                        Veredicto de Custo & Competitividade
                      </span>
                      {comparacaoData.cargaTrib > 0 && (
                        <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-bold uppercase tracking-wider border border-amber-400/30 flex items-center gap-1">
                          <Receipt className="w-3 h-3" />
                          {comparacaoData.regimeNome} ({formatPct(comparacaoData.cargaTrib)} por
                          dentro)
                        </span>
                      )}
                      {comparacaoData.conclusao.viradaImpostos && (
                        <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 text-[10px] font-bold uppercase tracking-wider border border-rose-400/40 animate-pulse">
                          ⚠️ Inversão de Vantagem no Preço Final
                        </span>
                      )}
                    </div>

                    <h3 className="text-base font-bold flex items-center gap-2">
                      <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
                      {comparacaoData.conclusao.maisEconomica === 'iguais' ? (
                        'Ambas as fichas possuem o mesmo Custo Total exato'
                      ) : (
                        <>
                          <span className="text-emerald-300 font-extrabold">
                            {comparacaoData.conclusao.produtoEconomicoNome}
                          </span>{' '}
                          tem o menor custo de fabricação (
                          {formatBrl(comparacaoData.conclusao.diferencaAbsoluta)} mais barato ·{' '}
                          {comparacaoData.conclusao.diferencaPercentual.toFixed(1)}% de economia no
                          custo)
                        </>
                      )}
                    </h3>

                    {/* Destaque com Impostos & Virada se houver */}
                    {comparacaoData.conclusao.viradaImpostos ? (
                      <div className="bg-amber-950/60 border border-amber-400/40 rounded-lg p-2.5 text-xs text-amber-100 space-y-1">
                        <p className="font-semibold text-amber-200">
                          Atenção Executiva: A composição de margem e gross-up tributário inverteu o
                          menor preço final!
                        </p>
                        <p className="text-[11px] text-slate-200">
                          Embora <strong>"{comparacaoData.conclusao.produtoEconomicoNome}"</strong>{' '}
                          tenha menor custo bruto (
                          {formatBrl(
                            Math.min(comparacaoData.custoTotal_A, comparacaoData.custoTotal_B),
                          )}
                          ), o produto{' '}
                          <strong>"{comparacaoData.conclusao.produtoEconomicoImpostosNome}"</strong>{' '}
                          atinge o menor preço com impostos (
                          {formatBrl(
                            Math.min(
                              comparacaoData.precoComImpostos_A,
                              comparacaoData.precoComImpostos_B,
                            ),
                          )}{' '}
                          vs{' '}
                          {formatBrl(
                            Math.max(
                              comparacaoData.precoComImpostos_A,
                              comparacaoData.precoComImpostos_B,
                            ),
                          )}
                          ).
                        </p>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-200">
                        Comparação entre <strong>"{comparacaoData.prodA?.nome}"</strong> (Custo:{' '}
                        {formatBrl(comparacaoData.custoTotal_A)} | Preço c/ Impostos:{' '}
                        {formatBrl(comparacaoData.precoComImpostos_A)}) e{' '}
                        <strong>"{comparacaoData.prodB?.nome}"</strong> (Custo:{' '}
                        {formatBrl(comparacaoData.custoTotal_B)} | Preço c/ Impostos:{' '}
                        {formatBrl(comparacaoData.precoComImpostos_B)}).
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0 flex-wrap sm:flex-nowrap">
                    <div className="bg-white/10 backdrop-blur-xs p-2.5 rounded-lg border border-white/20 text-center min-w-[130px] flex-1 sm:flex-initial">
                      <span className="text-[10px] text-slate-300 uppercase font-medium block">
                        Dif. Custo (R$)
                      </span>
                      <span className="text-sm font-black font-mono block">
                        {comparacaoData.diffCustoTotal > 0 ? '+' : ''}
                        {formatBrl(comparacaoData.diffCustoTotal)}
                      </span>
                      <span className="text-[10px] text-slate-300 block font-mono">
                        {comparacaoData.pctDiffCustoTotal > 0 ? '+' : ''}
                        {comparacaoData.pctDiffCustoTotal.toFixed(1)}%
                      </span>
                    </div>

                    <div className="bg-amber-500/15 backdrop-blur-xs p-2.5 rounded-lg border border-amber-400/30 text-center min-w-[140px] flex-1 sm:flex-initial">
                      <span className="text-[10px] text-amber-200 uppercase font-semibold block">
                        Dif. Preço c/ Impostos
                      </span>
                      <span className="text-sm font-black font-mono text-amber-300 block">
                        {comparacaoData.diffPrecoComImpostos > 0 ? '+' : ''}
                        {formatBrl(comparacaoData.diffPrecoComImpostos)}
                      </span>
                      <span className="text-[10px] text-amber-200 block font-mono">
                        {comparacaoData.pctDiffPrecoComImpostos > 0 ? '+' : ''}
                        {comparacaoData.pctDiffPrecoComImpostos.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 2. TABELA COMPARATIVA DE INDICADORES DE CUSTO & PREÇO LADO A LADO */}
              <Card className="bg-white border-slate-200 shadow-xs">
                <CardHeader className="pb-3 border-b border-slate-100">
                  <CardTitle className="text-base font-bold text-[#0B1F3A] flex items-center gap-2">
                    <Scale className="w-4 h-4 text-indigo-600" />
                    Quadro Comparativo Estrutural (Valores e Indicadores)
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Comparação direta de custos diretos, indiretos, markup e formação de preço
                    sugerido.
                  </CardDescription>
                </CardHeader>

                <CardContent className="p-0 overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50/80 text-slate-700 font-semibold">
                        <th className="py-3 px-4 w-1/3">Métrica / Indicador</th>
                        <th className="py-3 px-4 w-1/4 text-right bg-blue-50/40 text-blue-950">
                          {comparacaoData.prodA?.nome || 'Produto A'}
                        </th>
                        <th className="py-3 px-4 w-1/4 text-right bg-purple-50/40 text-purple-950">
                          {comparacaoData.prodB?.nome || 'Produto B'}
                        </th>
                        <th className="py-3 px-4 w-1/6 text-right">Diferença (B vs A)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {/* Código / Categoria */}
                      <tr className="hover:bg-slate-50/50">
                        <td className="py-2.5 px-4 font-semibold text-slate-700">
                          Código & Categoria
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono bg-blue-50/10">
                          {comparacaoData.prodA?.codigo || '—'} ·{' '}
                          {comparacaoData.prodA?.categoria || 'Geral'}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono bg-purple-50/10">
                          {comparacaoData.prodB?.codigo || '—'} ·{' '}
                          {comparacaoData.prodB?.categoria || 'Geral'}
                        </td>
                        <td className="py-2.5 px-4 text-right text-slate-400">—</td>
                      </tr>

                      {/* Quantidade de Insumos */}
                      <tr className="hover:bg-slate-50/50">
                        <td className="py-2.5 px-4 font-semibold text-slate-700">
                          Quantidade de Insumos
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono bg-blue-50/10 font-bold">
                          {comparacaoData.fichaA.itens?.length || 0} itens
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono bg-purple-50/10 font-bold">
                          {comparacaoData.fichaB.itens?.length || 0} itens
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono font-semibold text-slate-700">
                          {(comparacaoData.fichaB.itens?.length || 0) -
                            (comparacaoData.fichaA.itens?.length || 0) >
                          0
                            ? '+'
                            : ''}
                          {(comparacaoData.fichaB.itens?.length || 0) -
                            (comparacaoData.fichaA.itens?.length || 0)}{' '}
                          itens
                        </td>
                      </tr>

                      {/* Custo Matéria-Prima */}
                      <tr className="hover:bg-slate-50/50">
                        <td className="py-2.5 px-4 font-semibold text-slate-700">
                          Custo Matéria-Prima (R$)
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono bg-blue-50/10 font-bold text-slate-800">
                          {formatBrl(comparacaoData.custoMP_A)}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono bg-purple-50/10 font-bold text-slate-800">
                          {formatBrl(comparacaoData.custoMP_B)}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono font-bold whitespace-nowrap">
                          <span
                            className={
                              comparacaoData.diffCustoMP < 0
                                ? 'text-emerald-700'
                                : comparacaoData.diffCustoMP > 0
                                  ? 'text-rose-600'
                                  : 'text-slate-600'
                            }
                          >
                            {comparacaoData.diffCustoMP > 0 ? '+' : ''}
                            {formatBrl(comparacaoData.diffCustoMP)} (
                            {comparacaoData.pctDiffCustoMP > 0 ? '+' : ''}
                            {comparacaoData.pctDiffCustoMP.toFixed(1)}%)
                          </span>
                        </td>
                      </tr>

                      {/* Outros Custos / MOD */}
                      <tr className="hover:bg-slate-50/50">
                        <td className="py-2.5 px-4 font-semibold text-slate-700">
                          Outros Custos / MOD (R$)
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono bg-blue-50/10 text-slate-700">
                          {formatBrl(comparacaoData.outrosCustos_A)}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono bg-purple-50/10 text-slate-700">
                          {formatBrl(comparacaoData.outrosCustos_B)}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono font-semibold whitespace-nowrap">
                          <span
                            className={
                              comparacaoData.diffOutros < 0
                                ? 'text-emerald-700'
                                : comparacaoData.diffOutros > 0
                                  ? 'text-rose-600'
                                  : 'text-slate-600'
                            }
                          >
                            {comparacaoData.diffOutros > 0 ? '+' : ''}
                            {formatBrl(comparacaoData.diffOutros)}
                          </span>
                        </td>
                      </tr>

                      {/* CUSTO TOTAL UNITÁRIO (DESTAQUE) */}
                      <tr className="bg-slate-100/80 font-black text-slate-900 border-y-2 border-slate-300">
                        <td className="py-3 px-4 text-sm uppercase">Custo Total Unitário (R$)</td>
                        <td className="py-3 px-4 text-right font-mono text-sm bg-blue-100/50 text-blue-950">
                          {formatBrl(comparacaoData.custoTotal_A)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-sm bg-purple-100/50 text-purple-950">
                          {formatBrl(comparacaoData.custoTotal_B)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-sm whitespace-nowrap">
                          <Badge
                            className={`text-xs font-black px-2 py-0.5 ${
                              comparacaoData.diffCustoTotal < 0
                                ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                : comparacaoData.diffCustoTotal > 0
                                  ? 'bg-rose-100 text-rose-800 border-rose-300'
                                  : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {comparacaoData.diffCustoTotal > 0 ? '+' : ''}
                            {formatBrl(comparacaoData.diffCustoTotal)} (
                            {comparacaoData.pctDiffCustoTotal > 0 ? '+' : ''}
                            {comparacaoData.pctDiffCustoTotal.toFixed(1)}%)
                          </Badge>
                        </td>
                      </tr>

                      {/* Margem Desejada (%) */}
                      <tr className="hover:bg-slate-50/50">
                        <td className="py-2.5 px-4 font-semibold text-slate-700">
                          Margem Desejada (%)
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono bg-blue-50/10 text-amber-800 font-bold">
                          {formatPct(comparacaoData.margem_A)}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono bg-purple-50/10 text-amber-800 font-bold">
                          {formatPct(comparacaoData.margem_B)}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono text-slate-700">
                          {comparacaoData.margem_B - comparacaoData.margem_A > 0 ? '+' : ''}
                          {(comparacaoData.margem_B - comparacaoData.margem_A).toFixed(1)} p.p.
                        </td>
                      </tr>

                      {/* Markup Desejado (%) */}
                      <tr className="hover:bg-slate-50/50">
                        <td className="py-2.5 px-4 font-semibold text-slate-700">
                          Markup sobre Custo (%)
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono bg-blue-50/10 text-blue-700 font-bold">
                          {formatPct(comparacaoData.markup_A)}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono bg-purple-50/10 text-blue-700 font-bold">
                          {formatPct(comparacaoData.markup_B)}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono text-slate-700">
                          {comparacaoData.markup_B - comparacaoData.markup_A > 0 ? '+' : ''}
                          {(comparacaoData.markup_B - comparacaoData.markup_A).toFixed(1)} p.p.
                        </td>
                      </tr>

                      {/* Preço Sugerido por Margem */}
                      <tr className="hover:bg-slate-50/50">
                        <td className="py-2.5 px-4 font-semibold text-slate-700">
                          Preço Sugerido (por Margem)
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono bg-blue-50/10 font-bold text-emerald-800">
                          {formatBrl(comparacaoData.precoMargem_A)}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono bg-purple-50/10 font-bold text-emerald-800">
                          {formatBrl(comparacaoData.precoMargem_B)}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono font-bold whitespace-nowrap">
                          <span
                            className={
                              comparacaoData.diffPrecoMargem < 0
                                ? 'text-emerald-700'
                                : comparacaoData.diffPrecoMargem > 0
                                  ? 'text-rose-600'
                                  : 'text-slate-600'
                            }
                          >
                            {comparacaoData.diffPrecoMargem > 0 ? '+' : ''}
                            {formatBrl(comparacaoData.diffPrecoMargem)}
                          </span>
                        </td>
                      </tr>

                      {/* Preço Sugerido por Markup */}
                      <tr className="hover:bg-slate-50/50">
                        <td className="py-2.5 px-4 font-semibold text-slate-700">
                          Preço Sugerido (por Markup)
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono bg-blue-50/10 font-bold text-blue-800">
                          {formatBrl(comparacaoData.precoMarkup_A)}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono bg-purple-50/10 font-bold text-blue-800">
                          {formatBrl(comparacaoData.precoMarkup_B)}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono font-bold whitespace-nowrap">
                          <span
                            className={
                              comparacaoData.diffPrecoMarkup < 0
                                ? 'text-emerald-700'
                                : comparacaoData.diffPrecoMarkup > 0
                                  ? 'text-rose-600'
                                  : 'text-slate-600'
                            }
                          >
                            {comparacaoData.diffPrecoMarkup > 0 ? '+' : ''}
                            {formatBrl(comparacaoData.diffPrecoMarkup)}
                          </span>
                        </td>
                      </tr>

                      {/* Carga Tributária Vigente & Fator Gross-up */}
                      <tr className="bg-amber-50/30">
                        <td className="py-2.5 px-4 font-semibold text-amber-900 flex items-center gap-1.5">
                          <Receipt className="w-3.5 h-3.5 text-amber-600" />
                          Carga Tributária & Gross-up ({comparacaoData.regimeNome})
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono bg-amber-50/20 text-amber-900 font-semibold">
                          {formatPct(comparacaoData.cargaTrib)} (Fator{' '}
                          {comparacaoData.fatorGrossUp.toFixed(4)})
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono bg-amber-50/20 text-amber-900 font-semibold">
                          {formatPct(comparacaoData.cargaTrib)} (Fator{' '}
                          {comparacaoData.fatorGrossUp.toFixed(4)})
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono text-slate-500 text-[11px]">
                          Mesmo Regime
                        </td>
                      </tr>

                      {/* PREÇO SUGERIDO COM IMPOSTOS (POR DENTRO / GROSS-UP) */}
                      <tr className="bg-amber-100/60 font-black text-amber-950 border-t-2 border-amber-300 hover:bg-amber-100/80 transition-colors">
                        <td className="py-3 px-4 text-xs font-bold text-amber-950">
                          <div className="flex items-center gap-1.5">
                            <Percent className="w-4 h-4 text-amber-700" />
                            <span>Preço Sugerido com Impostos (Por Dentro)</span>
                          </div>
                          <span className="text-[10px] text-amber-800 font-normal block mt-0.5">
                            Gross-up: Custo / (1 - (Margem + {formatPct(comparacaoData.cargaTrib)}))
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-sm bg-blue-100/60 text-blue-950 font-black">
                          {formatBrl(comparacaoData.precoComImpostos_A)}
                          <span className="text-[10px] text-slate-600 font-normal block">
                            Tributos: {formatBrl(comparacaoData.valorImpostos_A)}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-sm bg-purple-100/60 text-purple-950 font-black">
                          {formatBrl(comparacaoData.precoComImpostos_B)}
                          <span className="text-[10px] text-slate-600 font-normal block">
                            Tributos: {formatBrl(comparacaoData.valorImpostos_B)}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-sm whitespace-nowrap">
                          <Badge
                            className={`text-xs font-black px-2 py-0.5 ${
                              comparacaoData.diffPrecoComImpostos < 0
                                ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                : comparacaoData.diffPrecoComImpostos > 0
                                  ? 'bg-rose-100 text-rose-800 border-rose-300'
                                  : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {comparacaoData.diffPrecoComImpostos > 0 ? '+' : ''}
                            {formatBrl(comparacaoData.diffPrecoComImpostos)} (
                            {comparacaoData.pctDiffPrecoComImpostos > 0 ? '+' : ''}
                            {comparacaoData.pctDiffPrecoComImpostos.toFixed(1)}%)
                          </Badge>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </CardContent>
              </Card>

              {/* 3. COMPARAÇÃO DETALHADA DE INSUMOS: EM COMUM VS EXCLUSIVOS */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Coluna 1 & 2: Insumos em Comum nas Duas Fichas */}
                <div className="lg:col-span-2 space-y-4">
                  <Card className="bg-white border-slate-200 shadow-xs">
                    <CardHeader className="pb-3 border-b border-slate-100">
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="text-sm font-bold text-[#0B1F3A] flex items-center gap-2">
                            <Layers className="w-4 h-4 text-amber-600" />
                            Insumos Presentes em Ambas as Fichas (
                            {comparacaoData.insumosEmComum.length})
                          </CardTitle>
                          <CardDescription className="text-xs">
                            Comparativo de quantidade utilizada e impacto no subtotal de cada
                            produto.
                          </CardDescription>
                        </div>
                        <Badge variant="outline" className="text-xs bg-slate-50">
                          Em Comum
                        </Badge>
                      </div>
                    </CardHeader>

                    <CardContent className="p-0">
                      {comparacaoData.insumosEmComum.length === 0 ? (
                        <div className="py-8 text-center text-xs text-slate-400">
                          Não há insumos em comum compartilhados entre estas duas fichas.
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs border-collapse">
                            <thead>
                              <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-700 font-semibold">
                                <th className="py-2.5 px-3.5">Matéria-Prima</th>
                                <th className="py-2.5 px-3 text-right bg-blue-50/30 text-blue-950">
                                  Qtd (A)
                                </th>
                                <th className="py-2.5 px-3 text-right bg-purple-50/30 text-purple-950">
                                  Qtd (B)
                                </th>
                                <th className="py-2.5 px-3 text-right bg-blue-50/30 text-blue-950">
                                  Subtotal A
                                </th>
                                <th className="py-2.5 px-3 text-right bg-purple-50/30 text-purple-950">
                                  Subtotal B
                                </th>
                                <th className="py-2.5 px-3.5 text-right">Diferença</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {comparacaoData.insumosEmComum.map((item, idx) => {
                                const subA =
                                  item.itemA.subtotal ||
                                  item.itemA.quantidade * item.itemA.custo_unitario
                                const subB =
                                  item.itemB.subtotal ||
                                  item.itemB.quantidade * item.itemB.custo_unitario
                                const diff = subB - subA

                                return (
                                  <tr key={idx} className="hover:bg-slate-50/60 transition-colors">
                                    <td className="py-2.5 px-3.5 font-semibold text-slate-900">
                                      {item.nome}
                                      <span className="text-[10px] text-slate-400 font-normal block">
                                        Custo un: {formatBrl(item.itemA.custo_unitario)}/
                                        {item.unidade}
                                      </span>
                                    </td>
                                    <td className="py-2.5 px-3 text-right font-mono bg-blue-50/10">
                                      {item.itemA.quantidade} {item.unidade}
                                    </td>
                                    <td className="py-2.5 px-3 text-right font-mono bg-purple-50/10">
                                      {item.itemB.quantidade} {item.unidade}
                                    </td>
                                    <td className="py-2.5 px-3 text-right font-mono bg-blue-50/10 text-slate-700">
                                      {formatBrl(subA)}
                                    </td>
                                    <td className="py-2.5 px-3 text-right font-mono bg-purple-50/10 text-slate-700">
                                      {formatBrl(subB)}
                                    </td>
                                    <td className="py-2.5 px-3.5 text-right font-mono font-bold whitespace-nowrap">
                                      <span
                                        className={
                                          diff < 0
                                            ? 'text-emerald-700'
                                            : diff > 0
                                              ? 'text-rose-600'
                                              : 'text-slate-500'
                                        }
                                      >
                                        {diff > 0 ? '+' : ''}
                                        {formatBrl(diff)}
                                      </span>
                                    </td>
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* Coluna 3: Insumos Divergentes / Exclusivos */}
                <div className="space-y-4">
                  {/* Exclusivos de A */}
                  <Card className="bg-white border-blue-200 shadow-xs">
                    <CardHeader className="py-2.5 px-3.5 border-b border-blue-100 bg-blue-50/40">
                      <CardTitle className="text-xs font-bold text-blue-950 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-blue-600" />
                        Insumos Apenas em "{comparacaoData.prodA?.nome}" (
                        {comparacaoData.insumosApenasA.length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-3">
                      {comparacaoData.insumosApenasA.length === 0 ? (
                        <p className="text-xs text-slate-400 italic text-center py-2">
                          Nenhum insumo exclusivo neste produto.
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {comparacaoData.insumosApenasA.map((it, idx) => (
                            <div
                              key={idx}
                              className="p-2 rounded bg-slate-50 border border-slate-100 flex items-center justify-between text-xs"
                            >
                              <div>
                                <p className="font-semibold text-slate-800">{it.nome}</p>
                                <p className="text-[10px] text-slate-500">
                                  {it.item.quantidade} {it.unidade} ×{' '}
                                  {formatBrl(it.item.custo_unitario)}
                                </p>
                              </div>
                              <span className="font-bold text-slate-900 font-mono">
                                {formatBrl(it.item.subtotal)}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Exclusivos de B */}
                  <Card className="bg-white border-purple-200 shadow-xs">
                    <CardHeader className="py-2.5 px-3.5 border-b border-purple-100 bg-purple-50/40">
                      <CardTitle className="text-xs font-bold text-purple-950 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-purple-600" />
                        Insumos Apenas em "{comparacaoData.prodB?.nome}" (
                        {comparacaoData.insumosApenasB.length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-3">
                      {comparacaoData.insumosApenasB.length === 0 ? (
                        <p className="text-xs text-slate-400 italic text-center py-2">
                          Nenhum insumo exclusivo neste produto.
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {comparacaoData.insumosApenasB.map((it, idx) => (
                            <div
                              key={idx}
                              className="p-2 rounded bg-slate-50 border border-slate-100 flex items-center justify-between text-xs"
                            >
                              <div>
                                <p className="font-semibold text-slate-800">{it.nome}</p>
                                <p className="text-[10px] text-slate-500">
                                  {it.item.quantidade} {it.unidade} ×{' '}
                                  {formatBrl(it.item.custo_unitario)}
                                </p>
                              </div>
                              <span className="font-bold text-slate-900 font-mono">
                                {formatBrl(it.item.subtotal)}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* ABA DO RELATÓRIO DE CUSTOS E MARGEM REAL */
        <div className="space-y-6">
          {/* Métricas do Relatório */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="bg-white border-slate-200 shadow-xs">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-500 font-medium">Margem Real Média</p>
                  <h3
                    className={`text-xl font-bold mt-1 ${
                      relatorioStats.margemMediaReal >= relatorioStats.margemMediaDesejada
                        ? 'text-emerald-700'
                        : 'text-amber-700'
                    }`}
                  >
                    {formatPct(relatorioStats.margemMediaReal)}
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Meta média: {formatPct(relatorioStats.margemMediaDesejada)}
                  </p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white border-slate-200 shadow-xs">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-500 font-medium">Produtos na Meta / Acima</p>
                  <h3 className="text-xl font-bold text-emerald-700 mt-1">
                    {relatorioStats.acimaOuAtingida}
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {relatorioStats.total > 0
                      ? Math.round((relatorioStats.acimaOuAtingida / relatorioStats.total) * 100)
                      : 0}
                    % das fichas técnicas
                  </p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white border-slate-200 shadow-xs">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-500 font-medium">Abaixo da Margem Desejada</p>
                  <h3 className="text-xl font-bold text-amber-700 mt-1">
                    {relatorioStats.abaixoCount}
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">Requer ajuste de preço/custo</p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white border-slate-200 shadow-xs">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-500 font-medium">Margem Negativa (Prejuízo)</p>
                  <h3 className="text-xl font-bold text-rose-600 mt-1">
                    {relatorioStats.criticaCount}
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">Preço menor que custo total</p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
                  <TrendingDown className="w-5 h-5" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* ========================================================= */}
          {/* SEÇÃO: COMPOSIÇÃO DE CUSTO POR CATEGORIA DE MATÉRIA-PRIMA */}
          {/* ========================================================= */}
          {composicaoCategoriasRelatorio.categorias.length > 0 && (
            <Card className="bg-white border-slate-200 shadow-xs">
              <CardHeader className="pb-3 border-b border-slate-100">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <CardTitle className="text-base font-bold text-[#0B1F3A] flex items-center gap-2">
                      <PieChartIcon className="w-4 h-4 text-blue-600" />
                      Composição de Custo por Categoria de Matéria-Prima
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Totais consolidados de custo agrupados por categoria de insumo (R$ e % sobre o
                      custo total de fabricação).
                    </CardDescription>
                  </div>
                  <Badge
                    variant="outline"
                    className="text-xs bg-slate-50 font-semibold text-slate-700 w-fit"
                  >
                    {composicaoCategoriasRelatorio.categorias.length} categoria(s) de insumo
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-4 space-y-4">
                {/* Resumo em 3 Mini Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl space-y-0.5">
                    <span className="text-[10px] font-bold uppercase text-amber-800 block">
                      Total Matérias-Primas (Todas as Fichas)
                    </span>
                    <strong className="text-base font-black font-mono text-amber-900 block">
                      {formatBrl(composicaoCategoriasRelatorio.custoMPGlobal)}
                    </strong>
                    <span className="text-[10px] text-amber-700 block">
                      {composicaoCategoriasRelatorio.custoTotalGlobal > 0
                        ? `${((composicaoCategoriasRelatorio.custoMPGlobal / composicaoCategoriasRelatorio.custoTotalGlobal) * 100).toFixed(1)}% do custo total consolidado`
                        : '100%'}
                    </span>
                  </div>

                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-0.5">
                    <span className="text-[10px] font-bold uppercase text-slate-500 block">
                      Outros Custos / Mão de Obra
                    </span>
                    <strong className="text-base font-black font-mono text-slate-800 block">
                      {formatBrl(composicaoCategoriasRelatorio.outrosCustosGlobal)}
                    </strong>
                    <span className="text-[10px] text-slate-500 block">
                      {composicaoCategoriasRelatorio.custoTotalGlobal > 0
                        ? `${((composicaoCategoriasRelatorio.outrosCustosGlobal / composicaoCategoriasRelatorio.custoTotalGlobal) * 100).toFixed(1)}% do custo total consolidado`
                        : '0%'}
                    </span>
                  </div>

                  <div className="p-3 bg-blue-50/80 border border-blue-200 rounded-xl space-y-0.5">
                    <span className="text-[10px] font-bold uppercase text-blue-900 block">
                      Custo Total Consolidado
                    </span>
                    <strong className="text-base font-black font-mono text-blue-900 block">
                      {formatBrl(composicaoCategoriasRelatorio.custoTotalGlobal)}
                    </strong>
                    <span className="text-[10px] text-blue-700 block">
                      Soma dos custos de todas as fichas ativas
                    </span>
                  </div>
                </div>

                {/* Tabela de Composição por Categoria */}
                <div className="overflow-x-auto rounded-lg border border-slate-200">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50/80 text-slate-700 font-semibold">
                        <th className="py-2.5 px-3">Categoria de Matéria-Prima</th>
                        <th className="py-2.5 px-3 text-center">Produtos Atendidos</th>
                        <th className="py-2.5 px-3 text-center">Qtd Itens</th>
                        <th className="py-2.5 px-3 text-right">Total Custo (R$)</th>
                        <th className="py-2.5 px-3 text-right">% sobre Custo MP</th>
                        <th className="py-2.5 px-3 text-right">% sobre Custo Total</th>
                        <th className="py-2.5 px-3 text-left">Representatividade</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {composicaoCategoriasRelatorio.categorias.map((cat, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-2.5 px-3">
                            <div className="font-semibold text-slate-900 flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-blue-600" />
                              {cat.categoria}
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono text-slate-600">
                            {cat.produtosCount} produto(s)
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono text-slate-600">
                            {cat.itensCount}
                          </td>
                          <td className="py-2.5 px-3 text-right font-bold text-slate-900 font-mono whitespace-nowrap">
                            {formatBrl(cat.totalCusto)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-medium text-amber-800 font-mono whitespace-nowrap">
                            {cat.pctSobreMP.toFixed(1)}%
                          </td>
                          <td className="py-2.5 px-3 text-right font-bold text-blue-700 font-mono whitespace-nowrap">
                            {cat.pctSobreTotal.toFixed(1)}%
                          </td>
                          <td className="py-2.5 px-3 w-40">
                            <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                              <div
                                className={`h-2 rounded-full ${
                                  idx === 0
                                    ? 'bg-blue-600'
                                    : idx === 1
                                      ? 'bg-emerald-600'
                                      : idx === 2
                                        ? 'bg-amber-500'
                                        : 'bg-indigo-500'
                                }`}
                                style={{
                                  width: `${Math.min(100, Math.max(3, cat.pctSobreTotal))}%`,
                                }}
                              />
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-slate-300 bg-slate-50/90 font-bold text-slate-900">
                        <td className="py-2.5 px-3 uppercase text-[11px]">
                          Subtotal Matérias-Primas
                        </td>
                        <td className="py-2.5 px-3 text-center text-slate-500">—</td>
                        <td className="py-2.5 px-3 text-center font-mono">
                          {composicaoCategoriasRelatorio.categorias.reduce(
                            (acc, c) => acc + c.itensCount,
                            0,
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-sm text-slate-900">
                          {formatBrl(composicaoCategoriasRelatorio.custoMPGlobal)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-[11px] text-amber-800">
                          100,0%
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-[11px] text-blue-700">
                          {composicaoCategoriasRelatorio.custoTotalGlobal > 0
                            ? `${((composicaoCategoriasRelatorio.custoMPGlobal / composicaoCategoriasRelatorio.custoTotalGlobal) * 100).toFixed(1)}%`
                            : '100%'}
                        </td>
                        <td className="py-2.5 px-3 text-slate-400">—</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Card Principal do Relatório */}
          <Card className="bg-white border-slate-200 shadow-xs">
            <CardHeader className="pb-3 border-b border-slate-100">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-base font-bold text-[#0B1F3A] flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-emerald-700" />
                    Relatório Comparativo de Custos e Margem Real
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Comparação produto a produto: Custo Total da Ficha × Preço de Venda Praticado ×
                    Margem Real vs Margem Desejada.
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Button
                    type="button"
                    onClick={handleExportRelatorioCsv}
                    size="sm"
                    className="h-9 text-xs font-semibold bg-emerald-700 hover:bg-emerald-800 text-white shadow-xs"
                  >
                    <Download className="w-3.5 h-3.5 mr-1.5" />
                    Exportar Relatório CSV
                  </Button>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row items-center gap-3 mb-4">
                <div className="relative flex-1 w-full">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <Input
                    placeholder="Buscar por produto, código ou categoria..."
                    value={relatorioSearch}
                    onChange={(e) => setRelatorioSearch(e.target.value)}
                    className="pl-9 h-9 text-xs"
                  />
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <span className="text-xs text-slate-500 shrink-0 font-medium">Status:</span>
                  <select
                    value={filtroStatusMargem}
                    onChange={(e) => setFiltroStatusMargem(e.target.value as any)}
                    className="h-9 text-xs bg-white border border-slate-200 rounded-md px-2.5 text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-600 w-full sm:w-48"
                  >
                    <option value="todos">Todos os desempenhos</option>
                    <option value="acima">🟢 Meta Atingida ou Acima</option>
                    <option value="abaixo">🟡 Abaixo do Desejado</option>
                    <option value="alerta">🔴 Margem Negativa (Prejuízo)</option>
                  </select>
                </div>
              </div>

              {relatorioFiltrado.length === 0 ? (
                <div className="py-16 text-center">
                  <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-3 text-slate-400">
                    <BarChart3 className="w-6 h-6" />
                  </div>
                  <h4 className="text-sm font-semibold text-slate-800">
                    Nenhum dado encontrado no relatório
                  </h4>
                  <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                    {relatorioData.length === 0
                      ? 'Cadastre fichas técnicas para gerar a análise comparativa de margem real.'
                      : 'Nenhum produto corresponde aos filtros aplicados.'}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-slate-200">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50/80 text-slate-700 font-semibold">
                        <th className="py-3 px-3.5">Código</th>
                        <th className="py-3 px-3.5">Produto</th>
                        <th className="py-3 px-3.5">Categoria</th>
                        <th className="py-3 px-3.5 text-right" title="Custo Bruto dos Insumos">
                          Custo Bruto MP
                        </th>
                        <th
                          className="py-3 px-3.5 text-right text-emerald-700"
                          title="Créditos Tributários: ICMS, PIS e COFINS deduzidos"
                        >
                          Créditos (-)
                        </th>
                        <th
                          className="py-3 px-3.5 text-right text-amber-700"
                          title="Acréscimos: IPI, Frete e Perdas somados"
                        >
                          Acréscimos (+)
                        </th>
                        <th
                          className="py-3 px-3.5 text-right font-bold text-blue-900"
                          title="Custo Líquido = Bruto - Créditos + Acréscimos"
                        >
                          Custo Líq. MP
                        </th>
                        <th className="py-3 px-3.5 text-right">Outros Custos</th>
                        <th className="py-3 px-3.5 text-right">Custo Total Líq.</th>
                        <th className="py-3 px-3.5 text-right">Preço Venda</th>
                        <th className="py-3 px-3.5 text-right">Preço Sug.</th>
                        <th className="py-3 px-3.5 text-right">Margem Desejada</th>
                        <th className="py-3 px-3.5 text-right">Margem Real</th>
                        <th className="py-3 px-3.5 text-center">Desempenho</th>
                        <th className="py-3 px-3.5 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {relatorioFiltrado.map((item) => {
                        const isAtingida = item.statusMargem === 'atingida'
                        const isAbaixo = item.statusMargem === 'abaixo'
                        const isCritica = item.statusMargem === 'critica'
                        const markupVal =
                          item.ficha.markup_desejado !== undefined &&
                          item.ficha.markup_desejado !== null
                            ? item.ficha.markup_desejado
                            : item.margemDesejada < 100 && item.margemDesejada > 0
                              ? (item.margemDesejada / (100 - item.margemDesejada)) * 100
                              : 50
                        const precoMk =
                          item.ficha.preco_venda_markup ||
                          (item.custoTotal > 0 ? item.custoTotal * (1 + markupVal / 100) : 0)

                        return (
                          <tr
                            key={item.ficha.id}
                            className="hover:bg-slate-50/70 transition-colors"
                          >
                            <td className="py-3 px-3.5 font-mono text-slate-600 font-semibold">
                              {item.produtoCodigo ? (
                                <Badge variant="outline" className="text-[10px] bg-slate-50">
                                  {item.produtoCodigo}
                                </Badge>
                              ) : (
                                <span className="text-slate-400 italic">—</span>
                              )}
                            </td>
                            <td className="py-3 px-3.5">
                              <div className="font-semibold text-slate-900">{item.produtoNome}</div>
                              <div className="text-[11px] text-slate-400">
                                {item.itensCount} insumo(s) · Unidade: {item.unidade}
                              </div>
                            </td>
                            <td className="py-3 px-3.5 text-slate-600">
                              {item.categoria ? (
                                <Badge className="text-[10px] font-medium bg-blue-50 text-blue-700 border border-blue-200">
                                  {item.categoria}
                                </Badge>
                              ) : (
                                <span className="text-slate-400 italic">—</span>
                              )}
                            </td>
                            <td className="py-3 px-3.5 text-right text-slate-600 font-mono whitespace-nowrap">
                              {formatBrl(item.custoMPBruto)}
                            </td>
                            <td className="py-3 px-3.5 text-right font-mono whitespace-nowrap">
                              {item.creditosTotais > 0 ? (
                                <span className="text-emerald-700 font-medium">
                                  -{formatBrl(item.creditosTotais)}
                                </span>
                              ) : (
                                <span className="text-slate-400">R$ 0,00</span>
                              )}
                            </td>
                            <td className="py-3 px-3.5 text-right font-mono whitespace-nowrap">
                              {item.acrescimosTotais > 0 ? (
                                <span className="text-amber-700 font-medium">
                                  +{formatBrl(item.acrescimosTotais)}
                                </span>
                              ) : (
                                <span className="text-slate-400">R$ 0,00</span>
                              )}
                            </td>
                            <td className="py-3 px-3.5 text-right font-bold text-blue-900 font-mono whitespace-nowrap">
                              {formatBrl(item.custoMPLiquido)}
                            </td>
                            <td className="py-3 px-3.5 text-right text-slate-500 font-mono whitespace-nowrap">
                              {formatBrl(item.outrosCustos)}
                            </td>
                            <td className="py-3 px-3.5 text-right font-bold text-slate-900 font-mono whitespace-nowrap">
                              {formatBrl(item.custoTotalLiquido)}
                            </td>
                            <td className="py-3 px-3.5 text-right font-bold text-slate-900 font-mono whitespace-nowrap">
                              {formatBrl(item.precoVenda)}
                            </td>
                            <td className="py-3 px-3.5 text-right font-semibold text-emerald-700 font-mono whitespace-nowrap">
                              {formatBrl(item.precoSugerido)}
                            </td>
                            <td className="py-3 px-3.5 text-right font-medium text-slate-600 whitespace-nowrap">
                              <div>{formatPct(item.margemDesejada)}</div>
                              <div className="text-[10px] text-slate-400">
                                Mk: {formatPct(markupVal)}
                              </div>
                            </td>
                            <td className="py-3 px-3.5 text-right whitespace-nowrap">
                              <span
                                className={`font-bold ${
                                  isCritica
                                    ? 'text-rose-600'
                                    : isAbaixo
                                      ? 'text-amber-700'
                                      : 'text-emerald-700'
                                }`}
                              >
                                {formatPct(item.margemReal)}
                              </span>
                            </td>
                            <td className="py-3 px-3.5 text-center whitespace-nowrap">
                              {isCritica ? (
                                <Badge className="text-[10px] bg-rose-100 text-rose-700 hover:bg-rose-100 border-rose-300 gap-1 font-bold">
                                  <ArrowDownRight className="w-3 h-3" />
                                  Negativa ({item.diffMargem.toFixed(1)} p.p.)
                                </Badge>
                              ) : isAbaixo ? (
                                <Badge className="text-[10px] bg-amber-100 text-amber-800 hover:bg-amber-100 border-amber-300 gap-1 font-bold">
                                  <ArrowDownRight className="w-3 h-3" />
                                  Abaixo ({item.diffMargem.toFixed(1)} p.p.)
                                </Badge>
                              ) : isAtingida ? (
                                <Badge className="text-[10px] bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border-emerald-300 gap-1 font-semibold">
                                  <CheckCircle2 className="w-3 h-3" />
                                  Meta Atingida
                                </Badge>
                              ) : (
                                <Badge className="text-[10px] bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border-emerald-300 gap-1 font-bold">
                                  <ArrowUpRight className="w-3 h-3" />
                                  Acima (+{item.diffMargem.toFixed(1)} p.p.)
                                </Badge>
                              )}
                            </td>
                            <td className="py-3 px-3.5 text-right whitespace-nowrap">
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  onClick={() => handleOpenPdfModal(item.ficha)}
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 text-[11px] text-[#0B1F3A] hover:bg-slate-100 px-2 font-medium gap-1"
                                  title="Gerar PDF A4 da ficha"
                                >
                                  <Printer className="w-3 h-3 text-blue-600" />
                                  PDF
                                </Button>
                                <Button
                                  onClick={() => {
                                    setSelectedFicha(item.ficha)
                                    setActiveTab('fichas')
                                  }}
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 text-[11px] text-blue-600 hover:bg-blue-50 px-2 font-medium"
                                  title="Ver ficha técnica"
                                >
                                  Ver Ficha
                                </Button>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Modal Criar / Editar Ficha Técnica */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto bg-white">
          <form onSubmit={handleSave}>
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-[#0B1F3A] flex items-center gap-2">
                <ClipboardList className="w-4 h-4 text-blue-600" />
                {editingFicha ? 'Editar Ficha Técnica' : 'Nova Ficha Técnica'}
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                Selecione o produto, adicione as matérias-primas e configure outros custos e margem.
              </DialogDescription>
            </DialogHeader>

            {errors.general && (
              <Alert
                variant="destructive"
                className="mt-4 bg-red-50 border-red-200 text-red-800 py-2"
              >
                <AlertCircle className="h-4 w-4 text-red-600" />
                <AlertDescription className="text-xs font-medium">
                  {errors.general}
                </AlertDescription>
              </Alert>
            )}

            <div className="space-y-4 py-4">
              {/* Seleção do Produto */}
              <div className="space-y-1.5">
                <Label htmlFor="ficha-produto" className="text-xs font-semibold text-slate-700">
                  Produto *
                </Label>
                {editingFicha ? (
                  <Input
                    readOnly
                    value={produtosMap.get(formData.produto_id)?.nome || 'Produto'}
                    className="h-9 text-xs bg-slate-50 font-semibold text-slate-700 cursor-not-allowed"
                  />
                ) : (
                  <select
                    id="ficha-produto"
                    value={formData.produto_id}
                    onChange={(e) => {
                      const id = e.target.value
                      const prod = produtosMap.get(id)
                      setFormData((prev) => ({
                        ...prev,
                        produto_id: id,
                        margem_desejada:
                          prod?.margem_desejada !== undefined && prod?.margem_desejada !== null
                            ? String(prod.margem_desejada)
                            : prev.margem_desejada,
                      }))
                      if (errors.produto_id)
                        setErrors((prev) => ({ ...prev, produto_id: undefined }))
                    }}
                    className={`w-full h-9 text-xs bg-white border rounded-md px-2.5 text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-600 ${
                      errors.produto_id ? 'border-red-500' : 'border-slate-200'
                    }`}
                  >
                    <option value="">Selecione o produto...</option>
                    {produtosSemFicha.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.codigo ? `[${p.codigo}] ` : ''}
                        {p.nome} ({p.unidade})
                      </option>
                    ))}
                  </select>
                )}
                {errors.produto_id && (
                  <p className="text-[11px] text-red-600 font-medium">{errors.produto_id}</p>
                )}
              </div>

              {/* Seção Itens de Matéria Prima */}
              <div className="space-y-2 border-t border-slate-100 pt-3">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-amber-600" />
                      Composição de Matérias-Primas *
                    </Label>
                    <p className="text-[11px] text-slate-400">
                      Selecione o insumo e a quantidade utilizada por unidade do produto.
                    </p>
                  </div>
                  <Button
                    type="button"
                    onClick={handleAddItem}
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs font-semibold text-blue-600 border-blue-200 hover:bg-blue-50"
                  >
                    <Plus className="w-3 h-3 mr-1" />
                    Adicionar Insumo
                  </Button>
                </div>

                {errors.itens && (
                  <p className="text-[11px] text-red-600 font-medium">{errors.itens}</p>
                )}

                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {formData.itens.map((item, idx) => {
                    const mp = materiasMap.get(item.materia_prima_id)
                    const qtd = Number(item.quantidade.replace(',', '.')) || 0
                    const custo = Number(item.custo_unitario.replace(',', '.')) || 0
                    const subtotal = qtd * custo

                    return (
                      <div
                        key={idx}
                        className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center gap-2"
                      >
                        {/* Select Matéria Prima */}
                        <div className="flex-1 w-full sm:w-auto">
                          <select
                            value={item.materia_prima_id}
                            onChange={(e) =>
                              handleItemChange(idx, 'materia_prima_id', e.target.value)
                            }
                            className="w-full h-8 text-xs bg-white border border-slate-200 rounded px-2 text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-600"
                          >
                            <option value="">Selecione o insumo...</option>
                            {materias.map((m) => (
                              <option key={m.id} value={m.id}>
                                {m.codigo ? `[${m.codigo}] ` : ''}
                                {m.nome} ({m.unidade}) · {formatBrl(m.custo_unitario)}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Quantidade */}
                        <div className="w-full sm:w-28 flex items-center gap-1">
                          <Input
                            type="number"
                            inputMode="decimal"
                            step="0.001"
                            min="0.001"
                            placeholder="Qtd"
                            value={item.quantidade}
                            onChange={(e) => handleItemChange(idx, 'quantidade', e.target.value)}
                            className="h-8 text-xs bg-white"
                          />
                          <span className="text-[11px] text-slate-500 font-semibold uppercase min-w-[24px]">
                            {mp?.unidade || 'UN'}
                          </span>
                        </div>

                        {/* Custo Unitário */}
                        <div className="w-full sm:w-28">
                          <Input
                            type="number"
                            inputMode="decimal"
                            step="0.01"
                            min="0"
                            placeholder="Custo un."
                            value={item.custo_unitario}
                            onChange={(e) =>
                              handleItemChange(idx, 'custo_unitario', e.target.value)
                            }
                            className="h-8 text-xs bg-white"
                            title="Custo unitário do insumo"
                          />
                        </div>

                        {/* Subtotal e Remover */}
                        <div className="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-28">
                          <div className="text-right">
                            <span className="text-xs font-bold text-slate-800 block">
                              {formatBrl(subtotal)}
                            </span>
                            {mp &&
                              (mp.isenta_st ||
                              mp.tipo_tributacao === 'isenta' ||
                              mp.tipo_tributacao === 'substituicao_tributaria' ? (
                                <span className="text-[10px] text-slate-500 block">
                                  Isenta / ST
                                </span>
                              ) : (
                                <span className="text-[10px] text-emerald-700 block font-semibold">
                                  c/ crédito trib.
                                </span>
                              ))}
                          </div>
                          <Button
                            type="button"
                            onClick={() => handleRemoveItem(idx)}
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0 text-slate-400 hover:text-red-600 hover:bg-red-50"
                            title="Remover item"
                          >
                            <X className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Seção Outros Custos, Margem e Markup */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 border-t border-slate-100 pt-3">
                <div className="space-y-1.5">
                  <Label htmlFor="ficha-outros" className="text-xs font-semibold text-slate-700">
                    Outros Custos / MOD (R$)
                  </Label>
                  <Input
                    id="ficha-outros"
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={formData.outros_custos}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, outros_custos: e.target.value }))
                    }
                    className="h-9 text-xs"
                  />
                  <p className="text-[10px] text-slate-400">Mão de obra, energia, embalagem etc.</p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="ficha-margem" className="text-xs font-semibold text-slate-700">
                    Margem Desejada (%) *
                  </Label>
                  <Input
                    id="ficha-margem"
                    type="number"
                    inputMode="decimal"
                    step="0.1"
                    min="0"
                    max="99.9"
                    placeholder="Ex: 40.0"
                    value={formData.margem_desejada}
                    onChange={(e) => {
                      const val = e.target.value
                      const m = Number(val.replace(',', '.'))
                      // Se usuário altera margem, auto-atualiza markup equivalente para conveniência
                      let mkEquivalent = formData.markup_desejado
                      if (!isNaN(m) && m >= 0 && m < 100) {
                        mkEquivalent = ((m / (100 - m)) * 100).toFixed(2)
                      }
                      setFormData((prev) => ({
                        ...prev,
                        margem_desejada: val,
                        markup_desejado: mkEquivalent,
                      }))
                    }}
                    className={`h-9 text-xs ${errors.margem_desejada ? 'border-red-500' : ''}`}
                  />
                  {errors.margem_desejada ? (
                    <p className="text-[10px] text-red-600 font-medium">{errors.margem_desejada}</p>
                  ) : (
                    <p className="text-[10px] text-slate-400">Divisor: PV = Custo / (1 - Margem)</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="ficha-markup" className="text-xs font-semibold text-slate-700">
                    Markup sobre Custo Total (%) *
                  </Label>
                  <Input
                    id="ficha-markup"
                    type="number"
                    inputMode="decimal"
                    step="0.1"
                    min="0"
                    placeholder="Ex: 66.7"
                    value={formData.markup_desejado}
                    onChange={(e) => {
                      const val = e.target.value
                      setFormData((prev) => ({ ...prev, markup_desejado: val }))
                    }}
                    className={`h-9 text-xs ${errors.markup_desejado ? 'border-red-500' : ''}`}
                  />
                  {errors.markup_desejado ? (
                    <p className="text-[10px] text-red-600 font-medium">{errors.markup_desejado}</p>
                  ) : (
                    <p className="text-[10px] text-slate-400">
                      Multiplicador: PV = Custo × (1 + Mk)
                    </p>
                  )}
                </div>
              </div>

              {/* Painel de Apuração e Preços Sugeridos (Margem vs Markup) */}
              <div className="p-4 bg-gradient-to-r from-blue-50/70 via-indigo-50/50 to-emerald-50/70 border border-blue-200/70 rounded-xl space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-[#0B1F3A]">
                  <Sparkles className="w-4 h-4 text-blue-600" />
                  Apuração de Custos & Preços Sugeridos
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center">
                  <div className="bg-white p-2 rounded-lg border border-slate-200">
                    <span className="text-[10px] text-slate-500 font-medium block">
                      Custo MP (Bruto)
                    </span>
                    <span className="text-xs font-bold text-slate-800 mt-0.5 block">
                      {formatBrl(formCalculations.custoMPBruto)}
                    </span>
                  </div>
                  <div className="bg-emerald-50 p-2 rounded-lg border border-emerald-200">
                    <span className="text-[10px] text-emerald-800 font-medium block">
                      Créditos Deduzidos
                    </span>
                    <span className="text-xs font-bold text-emerald-700 mt-0.5 block">
                      -{formatBrl(formCalculations.creditosTotais)}
                    </span>
                  </div>
                  <div className="bg-blue-50/70 p-2 rounded-lg border border-blue-200">
                    <span className="text-[10px] text-blue-900 font-medium block">
                      Custo MP (Líquido)
                    </span>
                    <span className="text-xs font-bold text-blue-900 mt-0.5 block">
                      {formatBrl(formCalculations.custoMPLiquido)}
                    </span>
                  </div>
                  <div className="bg-white p-2 rounded-lg border border-slate-200">
                    <span className="text-[10px] text-slate-500 font-medium block">
                      Outros Custos
                    </span>
                    <span className="text-xs font-bold text-slate-800 mt-0.5 block">
                      {formatBrl(formCalculations.outros)}
                    </span>
                  </div>
                  <div className="bg-indigo-50 p-2 rounded-lg border border-indigo-200">
                    <span className="text-[10px] text-indigo-900 font-bold block">
                      Custo Total Líquido
                    </span>
                    <span className="text-xs font-black text-indigo-950 mt-0.5 block">
                      {formatBrl(formCalculations.custoTotalLiquido)}
                    </span>
                  </div>
                  <div className="bg-emerald-700 text-white p-2 rounded-lg shadow-xs">
                    <span className="text-[10px] font-medium block text-emerald-100">
                      Preço Sugerido (Margem)
                    </span>
                    <span className="text-xs font-extrabold mt-0.5 block">
                      {formatBrl(formCalculations.precoSugeridoMargem)}
                    </span>
                  </div>
                  <div className="bg-blue-700 text-white p-2 rounded-lg shadow-xs col-span-2 sm:col-span-1">
                    <span className="text-[10px] font-medium block text-blue-100">
                      Preço Sugerido (Markup)
                    </span>
                    <span className="text-xs font-extrabold mt-0.5 block">
                      {formatBrl(formCalculations.precoSugeridoMarkup)}
                    </span>
                  </div>
                  {formCalculations.cargaTrib > 0 && (
                    <div className="bg-amber-600 text-white p-2 rounded-lg shadow-xs col-span-2 sm:col-span-5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-medium text-amber-100">
                          Preço Sugerido com Impostos (
                          {configTributaria?.regime_tributario || 'Tributos'} -{' '}
                          {formCalculations.cargaTrib}% por dentro)
                        </span>
                        <span className="text-xs font-extrabold">
                          {formatBrl(formCalculations.precoSugeridoComImpostos)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="ficha-obs" className="text-xs font-semibold text-slate-700">
                  Observações da Ficha
                </Label>
                <Textarea
                  id="ficha-obs"
                  placeholder="Instruções de montagem, tempo padrão de fabricação etc."
                  value={formData.observacoes}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, observacoes: e.target.value }))
                  }
                  className="min-h-[60px] text-xs resize-y"
                />
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => setModalOpen(false)}
                disabled={saving}
                className="text-xs h-9"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={saving}
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs h-9 shadow-xs"
              >
                {saving
                  ? 'Salvando...'
                  : editingFicha
                    ? 'Salvar Alterações'
                    : 'Criar Ficha Técnica'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal Duplicar / Clonar Ficha Técnica Inteira com Insumos em Lote & Variação */}
      <Dialog open={cloneOpen} onOpenChange={setCloneOpen}>
        <DialogContent className="sm:max-w-[560px] bg-white">
          <form onSubmit={handleConfirmClone}>
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-[#0B1F3A] flex items-center gap-2">
                <Copy className="w-4 h-4 text-emerald-700" />
                Duplicar Ficha Técnica Inteira com Insumos em Lote
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                Gera uma cópia integral com todos os insumos, quantidades, custos e parâmetros de
                precificação para criar um novo produto ou variação.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3.5 py-3">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1.5">
                <div className="text-[11px] font-bold text-slate-500 uppercase">
                  Ficha Técnica Original:
                </div>
                <div className="font-bold text-slate-900 text-sm">
                  {produtosMap.get(fichaToClone?.produto || '')?.nome || 'Produto Original'}
                </div>
                <div className="text-[11px] text-slate-600 flex items-center justify-between pt-1 border-t border-slate-200">
                  <span>
                    Insumos a copiar em lote:{' '}
                    <strong>{fichaToClone?.itens?.length || 0} itens</strong>
                  </span>
                  <span>
                    Custo Total original: <strong>{formatBrl(fichaToClone?.custo_total)}</strong>
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1 sm:col-span-2">
                  <Label htmlFor="clone-nome" className="text-xs font-semibold text-slate-700">
                    Nome do Novo Produto / Variação *
                  </Label>
                  <Input
                    id="clone-nome"
                    required
                    placeholder="Ex: Mesa de Centro 120cm - Acabamento Carvalho"
                    value={cloneNovoNome}
                    onChange={(e) => setCloneNovoNome(e.target.value)}
                    className="h-9 text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="clone-codigo" className="text-xs font-semibold text-slate-700">
                    Código / SKU
                  </Label>
                  <Input
                    id="clone-codigo"
                    placeholder="Ex: PRD-001-VAR"
                    value={cloneNovoCodigo}
                    onChange={(e) => setCloneNovoCodigo(e.target.value)}
                    className="h-9 text-xs uppercase"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="clone-categoria" className="text-xs font-semibold text-slate-700">
                    Categoria do Produto
                  </Label>
                  <Input
                    id="clone-categoria"
                    placeholder="Ex: Móveis, Usinagem, Linha Premium"
                    value={cloneNovaCategoria}
                    onChange={(e) => setCloneNovaCategoria(e.target.value)}
                    className="h-9 text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="clone-unidade" className="text-xs font-semibold text-slate-700">
                    Unidade de Medida
                  </Label>
                  <Input
                    id="clone-unidade"
                    placeholder="UN, KG, M, CX"
                    value={cloneNovaUnidade}
                    onChange={(e) => setCloneNovaUnidade(e.target.value)}
                    className="h-9 text-xs uppercase"
                  />
                </div>
              </div>

              {/* Ajuste Percentual Opcional em Lote nos Custos dos Insumos */}
              <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-lg space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label
                    htmlFor="clone-ajuste"
                    className="text-xs font-bold text-emerald-900 flex items-center gap-1.5"
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5 text-emerald-700" />
                    Ajuste Geral de Custo dos Insumos (% Opcional)
                  </Label>
                  <span className="text-[10px] text-emerald-700 font-mono font-semibold">
                    {Number(cloneAjustePercentual) > 0
                      ? `+${cloneAjustePercentual}%`
                      : `${cloneAjustePercentual}%`}
                  </span>
                </div>
                <Input
                  id="clone-ajuste"
                  type="number"
                  step="0.5"
                  placeholder="0 (Manter custos iguais)"
                  value={cloneAjustePercentual}
                  onChange={(e) => setCloneAjustePercentual(e.target.value)}
                  className="h-8 text-xs bg-white"
                />
                <p className="text-[10px] text-emerald-800">
                  Ex: Digite <strong>10</strong> para aumentar 10% no custo unitário de todos os
                  insumos, ou <strong>-5</strong> para aplicar 5% de desconto.
                </p>
              </div>

              <div className="space-y-1">
                <Label htmlFor="clone-obs" className="text-xs font-semibold text-slate-700">
                  Observações da Nova Ficha Técnica
                </Label>
                <Textarea
                  id="clone-obs"
                  placeholder="Informações sobre a variação de cor, acabamento ou tamanho..."
                  value={cloneObservacoes}
                  onChange={(e) => setCloneObservacoes(e.target.value)}
                  className="min-h-[50px] text-xs resize-y"
                />
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => setCloneOpen(false)}
                disabled={cloning}
                className="text-xs h-9"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={cloning}
                className="bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-xs h-9 shadow-xs gap-1.5"
              >
                <Copy className="w-3.5 h-3.5" />
                {cloning ? 'Duplicando...' : 'Confirmar e Duplicar Ficha Inteira'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal PDF A4 da Ficha Técnica */}
      <ModalPdfFichaTecnica
        open={pdfModalOpen}
        onOpenChange={setPdfModalOpen}
        ficha={fichaParaPdf}
        produto={fichaParaPdf ? produtosMap.get(fichaParaPdf.produto) || null : null}
        materiasMap={materiasMap}
      />

      {/* Modal Vincular Preço ao Produto */}
      <Dialog open={vincularModalOpen} onOpenChange={setVincularModalOpen}>
        <DialogContent className="sm:max-w-[480px] bg-white">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-[#0B1F3A] flex items-center gap-2">
              <LinkIcon className="w-4 h-4 text-blue-600" />
              Vincular Preço Sugerido ao Produto
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Escolha qual preço sugerido pela ficha técnica você deseja aplicar como preço de venda
              oficial do produto.
            </DialogDescription>
          </DialogHeader>

          {fichaParaVincular &&
            (() => {
              const prod = produtosMap.get(fichaParaVincular.produto)
              const custoTotal = Number(fichaParaVincular.custo_total) || 0
              const margem = Number(fichaParaVincular.margem_desejada) || 0
              const markup =
                fichaParaVincular.markup_desejado !== undefined &&
                fichaParaVincular.markup_desejado !== null
                  ? Number(fichaParaVincular.markup_desejado)
                  : margem < 100 && margem > 0
                    ? (margem / (100 - margem)) * 100
                    : 50

              const precoMargem =
                Number(fichaParaVincular.preco_venda_sugerido) ||
                (margem < 100 && custoTotal > 0 ? custoTotal / (1 - margem / 100) : custoTotal)
              const precoMarkup =
                Number(fichaParaVincular.preco_venda_markup) ||
                (custoTotal > 0 ? custoTotal * (1 + markup / 100) : custoTotal)

              return (
                <div className="space-y-4 py-3">
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1">
                    <div className="text-slate-500">Produto selecionado:</div>
                    <div className="font-bold text-slate-900 text-sm">
                      {prod?.nome || 'Produto'}
                    </div>
                    <div className="text-slate-500 flex items-center justify-between pt-1 border-t border-slate-200 mt-1">
                      <span>Preço de venda atual:</span>
                      <span className="font-semibold text-slate-800">
                        {formatBrl(prod?.preco_venda)}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs font-semibold text-slate-700">
                      Selecione o Preço Sugerido a Aplicar:
                    </Label>

                    {/* Opção 1: Preço por Margem */}
                    <div
                      onClick={() => setTipoPrecoVinculo('margem')}
                      className={`p-3 rounded-lg border cursor-pointer transition-all flex items-center justify-between ${
                        tipoPrecoVinculo === 'margem'
                          ? 'bg-emerald-50/80 border-emerald-500 ring-1 ring-emerald-500'
                          : 'bg-white border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                            tipoPrecoVinculo === 'margem'
                              ? 'border-emerald-600 bg-emerald-600 text-white'
                              : 'border-slate-300 bg-white'
                          }`}
                        >
                          {tipoPrecoVinculo === 'margem' && <Check className="w-2.5 h-2.5" />}
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-900">
                            Preço Sugerido por Margem ({formatPct(margem)})
                          </p>
                          <p className="text-[11px] text-slate-500">
                            Fórmula divisor: Custo / (1 - Margem)
                          </p>
                        </div>
                      </div>
                      <span className="text-sm font-bold text-emerald-800">
                        {formatBrl(precoMargem)}
                      </span>
                    </div>

                    {/* Opção 2: Preço por Markup */}
                    <div
                      onClick={() => setTipoPrecoVinculo('markup')}
                      className={`p-3 rounded-lg border cursor-pointer transition-all flex items-center justify-between ${
                        tipoPrecoVinculo === 'markup'
                          ? 'bg-blue-50/80 border-blue-500 ring-1 ring-blue-500'
                          : 'bg-white border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                            tipoPrecoVinculo === 'markup'
                              ? 'border-blue-600 bg-blue-600 text-white'
                              : 'border-slate-300 bg-white'
                          }`}
                        >
                          {tipoPrecoVinculo === 'markup' && <Check className="w-2.5 h-2.5" />}
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-900">
                            Preço Sugerido por Markup ({formatPct(markup)})
                          </p>
                          <p className="text-[11px] text-slate-500">
                            Fórmula multiplicador: Custo × (1 + Mk/100)
                          </p>
                        </div>
                      </div>
                      <span className="text-sm font-bold text-blue-800">
                        {formatBrl(precoMarkup)}
                      </span>
                    </div>
                  </div>

                  <div className="text-[11px] text-amber-700 bg-amber-50 p-2.5 rounded border border-amber-200 flex items-start gap-1.5">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
                    <span>
                      Ao confirmar, o preço de venda do produto <strong>"{prod?.nome}"</strong> será
                      atualizado no catálogo e refletirá imediatamente nas listagens e relatórios.
                    </span>
                  </div>
                </div>
              )
            })()}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setVincularModalOpen(false)}
              disabled={vinculandoPreco}
              className="text-xs h-9"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleConfirmarVinculoPreco}
              disabled={vinculandoPreco}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs h-9 shadow-xs"
            >
              {vinculandoPreco ? 'Vinculando...' : 'Confirmar e Atualizar Preço'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmação de Exclusão */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent className="bg-white">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-bold text-red-600 flex items-center gap-2">
              <AlertCircle className="w-5 h-5" /> Excluir Ficha Técnica?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-slate-600">
              Tem certeza que deseja excluir a ficha técnica do produto{' '}
              <strong className="text-slate-900">
                "{produtosMap.get(fichaToDelete?.produto || '')?.nome || 'selecionado'}"
              </strong>
              ? O produto não será excluído, mas voltará a não ter ficha técnica vinculada.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting} className="text-xs h-9">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700 text-white font-semibold text-xs h-9"
            >
              {deleting ? 'Excluindo...' : 'Sim, Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
