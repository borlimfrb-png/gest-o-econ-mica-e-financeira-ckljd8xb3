import { useState, useEffect, useMemo, useCallback } from 'react'
import { useFilter } from '@/contexts/FilterContext'
import { balancosService, dreService, empresasService } from '@/services/financeService'
import { bscService } from '@/services/bscService'
import { useRealtime } from '@/hooks/use-realtime'
import {
  CATALOGO_INDICADORES,
  CATEGORIAS_INDICADORES,
  type CategoriaIndicador,
  type IndicadorCatalogoItem,
  type ContextoCalculoIndicadores,
} from '@/lib/catalogoApresentacaoIndicadores'
import { ModalPdfApresentacaoIndicadores } from '@/components/ModalPdfApresentacaoIndicadores'
import { GraficoRadarCategorias } from '@/components/GraficoRadarCategorias'
import { calcularDiagnosticoRadar } from '@/lib/diagnosticoRadarApresentacao'
import type { BalancoRecord, DreRecord, BscKpiRecord, EmpresaRecord } from '@/types/finance'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Activity,
  Coins,
  TrendingDown,
  TrendingUp,
  Scale,
  Building2,
  Target,
  Flame,
  LayoutGrid,
  Presentation,
  Maximize2,
  Minimize2,
  ChevronLeft,
  ChevronRight,
  Download,
  Printer,
  Search,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  HelpCircle,
  Lightbulb,
  Sparkles,
  RefreshCw,
  Building,
  ArrowRight,
  BookOpen,
} from 'lucide-react'

// Mapa de ícones para as categorias
const ICONE_CATEGORIA: Record<CategoriaIndicador, React.ElementType> = {
  liquidez: Activity,
  capital_giro: Coins,
  endividamento: TrendingDown,
  rentabilidade: TrendingUp,
  ponto_equilibrio: Scale,
  valuation: Building2,
  bsc: Target,
  economicos_solvencia: Flame,
}

export function IndicadoresApresentacao() {
  const { selectedEmpresaId, selectedAno } = useFilter()

  // Estados de dados
  const [empresaAtiva, setEmpresaAtiva] = useState<EmpresaRecord | null>(null)
  const [balancos, setBalancos] = useState<BalancoRecord[]>([])
  const [dres, setDres] = useState<DreRecord[]>([])
  const [bscKpis, setBscKpis] = useState<BscKpiRecord[]>([])
  const [carregando, setCarregando] = useState(false)

  // Estados de UI e navegação
  const [modoVisualizacao, setModoVisualizacao] = useState<'grade' | 'slides' | 'radar'>('grade')
  const [categoriaAtiva, setCategoriaAtiva] = useState<string>('todas')
  const [termoBusca, setTermoBusca] = useState<string>('')
  const [slideIndex, setSlideIndex] = useState<number>(0)
  const [telaCheia, setTelaCheia] = useState<boolean>(false)
  const [modalPdfOpen, setModalPdfOpen] = useState<boolean>(false)

  // Carregar dados da empresa e demonstrações
  const carregarDados = useCallback(async () => {
    if (!selectedEmpresaId) {
      setEmpresaAtiva(null)
      setBalancos([])
      setDres([])
      setBscKpis([])
      return
    }

    try {
      setCarregando(true)

      const [empresaRes, bListRes, dListRes, kpisRes] = await Promise.allSettled([
        empresasService.getById(selectedEmpresaId),
        balancosService.getByEmpresa(selectedEmpresaId),
        dreService.getByEmpresa(selectedEmpresaId),
        bscService.getByEmpresaEAno(selectedEmpresaId, selectedAno),
      ])

      if (empresaRes.status === 'fulfilled') setEmpresaAtiva(empresaRes.value)
      setBalancos(bListRes.status === 'fulfilled' ? bListRes.value : [])
      setDres(dListRes.status === 'fulfilled' ? dListRes.value : [])
      setBscKpis(kpisRes.status === 'fulfilled' ? kpisRes.value : [])
    } catch (err) {
      console.error('Erro ao carregar demonstrações para apresentação:', err)
    } finally {
      setCarregando(false)
    }
  }, [selectedEmpresaId, selectedAno])

  useEffect(() => {
    carregarDados()
  }, [carregarDados])

  // Realtime updates
  useRealtime<BalancoRecord>('balancos', () => {
    carregarDados()
  })
  useRealtime<DreRecord>('dre', () => {
    carregarDados()
  })
  useRealtime<BscKpiRecord>('bsc_kpis', () => {
    carregarDados()
  })

  // Encontra balanços e DREs do ano atual e do ano anterior
  const balancoAtual = useMemo(
    () => balancos.find((b) => b.ano === selectedAno) || null,
    [balancos, selectedAno],
  )
  const dreAtual = useMemo(
    () => dres.find((d) => d.ano === selectedAno) || null,
    [dres, selectedAno],
  )
  const balancoAnterior = useMemo(
    () => balancos.find((b) => b.ano === selectedAno - 1) || null,
    [balancos, selectedAno],
  )
  const dreAnterior = useMemo(
    () => dres.find((d) => d.ano === selectedAno - 1) || null,
    [dres, selectedAno],
  )

  // Contexto de cálculo passado para cada indicador
  const contextoCalculo: ContextoCalculoIndicadores = useMemo(() => {
    return {
      balancoAtual,
      dreAtual,
      balancoAnterior,
      dreAnterior,
      bscKpis,
      anoAtual: selectedAno,
      anoAnterior: selectedAno - 1,
    }
  }, [balancoAtual, dreAtual, balancoAnterior, dreAnterior, bscKpis, selectedAno])

  // Diagnóstico e pontuação por categoria para o gráfico de Radar
  const diagnosticoRadar = useMemo(() => {
    return calcularDiagnosticoRadar(contextoCalculo)
  }, [contextoCalculo])

  // Filtragem de indicadores
  const indicadoresFiltrados = useMemo(() => {
    return CATALOGO_INDICADORES.filter((ind) => {
      const matchCat = categoriaAtiva === 'todas' || ind.categoria === categoriaAtiva
      const matchTexto =
        !termoBusca ||
        ind.nome.toLowerCase().includes(termoBusca.toLowerCase()) ||
        ind.sigla.toLowerCase().includes(termoBusca.toLowerCase()) ||
        ind.oQueMede.toLowerCase().includes(termoBusca.toLowerCase()) ||
        ind.formulaLegivel.toLowerCase().includes(termoBusca.toLowerCase())
      return matchCat && matchTexto
    })
  }, [categoriaAtiva, termoBusca])

  // Ajusta slide index se a lista encolher
  useEffect(() => {
    if (slideIndex >= indicadoresFiltrados.length) {
      setSlideIndex(Math.max(0, indicadoresFiltrados.length - 1))
    }
  }, [indicadoresFiltrados.length, slideIndex])

  // Navegação no modo slides via teclado
  useEffect(() => {
    if (modoVisualizacao !== 'slides') return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') {
        e.preventDefault()
        setSlideIndex((prev) => (prev < indicadoresFiltrados.length - 1 ? prev + 1 : prev))
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault()
        setSlideIndex((prev) => (prev > 0 ? prev - 1 : prev))
      } else if (e.key === 'Escape' && telaCheia) {
        setTelaCheia(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [modoVisualizacao, telaCheia, indicadoresFiltrados.length])

  // Alternar tela cheia nativa
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {})
      setTelaCheia(true)
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {})
      }
      setTelaCheia(false)
    }
  }

  // Exportação CSV do catálogo completo com os valores calculados e o resumo do Radar
  const exportarCsv = () => {
    // 1. Seção de Pontuação das 8 Categorias (Radar)
    const cabecalhoRadar = [
      'Resumo Diagnóstico por Categoria (Radar)',
      `Score (${selectedAno}) 0-100`,
      `Score Anterior (${selectedAno - 1})`,
      'Classificação de Saúde',
      'Diagnóstico Consultivo',
    ]

    const linhasRadar = diagnosticoRadar.itens.map((item) => [
      `"${item.categoriaNome}"`,
      `"${item.scoreAtual !== null ? item.scoreAtual : 'Sem dados'}"`,
      `"${item.scoreAnterior !== null ? item.scoreAnterior : 'Sem dados'}"`,
      `"${item.statusSaude === 'forte' ? 'Força (Verde)' : item.statusSaude === 'moderado' ? 'Atenção (Âmbar)' : item.statusSaude === 'fragil' ? 'Fragilidade (Vermelho)' : 'Sem Apuração'}"`,
      `"${item.destaqueTexto.replace(/"/g, '""')}"`,
    ])

    // 2. Seção Detalhada dos 24 Indicadores
    const cabecalho = [
      'Categoria',
      'Sigla',
      'Nome do Indicador',
      'Fórmula Legível',
      'O que Mede',
      'Como Interpretar',
      'Faixa Ideal',
      'Faixa Atenção',
      'Faixa Crítico',
      'Recomendação Consultiva',
      `Valor Apurado (${selectedAno})`,
      'Status da Faixa',
      'Comparativo Ano Anterior',
    ]

    const linhas = CATALOGO_INDICADORES.map((ind) => {
      const extraido = ind.extrairValor(contextoCalculo)
      const catConfig = CATEGORIAS_INDICADORES.find((c) => c.id === ind.categoria)
      return [
        `"${catConfig?.nome || ind.categoria}"`,
        `"${ind.sigla}"`,
        `"${ind.nome}"`,
        `"${ind.formulaLegivel}"`,
        `"${ind.oQueMede.replace(/"/g, '""')}"`,
        `"${ind.comoInterpretar.replace(/"/g, '""')}"`,
        `"${ind.faixas.ideal.replace(/"/g, '""')}"`,
        `"${ind.faixas.atencao.replace(/"/g, '""')}"`,
        `"${ind.faixas.critico.replace(/"/g, '""')}"`,
        `"${ind.dicaPratica.replace(/"/g, '""')}"`,
        `"${extraido.textoExibicao}"`,
        `"${extraido.faixaStatus}"`,
        `"${extraido.textoComparacao || 'Sem comparativo'}"`,
      ].join(';')
    })

    const secoes = [
      cabecalhoRadar.join(';'),
      ...linhasRadar.map((r) => r.join(';')),
      '',
      `"Score Geral da Empresa: ${diagnosticoRadar.scoreGeralAtual !== null ? `${diagnosticoRadar.scoreGeralAtual} pts` : 'Sem apuração'}"`,
      '',
      cabecalho.join(';'),
      ...linhas,
    ]

    const conteudoCsv = '\uFEFF' + secoes.join('\r\n')
    const blob = new Blob([conteudoCsv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute(
      'download',
      `Apresentacao_Indicadores_${empresaAtiva?.razao_social || 'Empresa'}_${selectedAno}.csv`,
    )
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const indicadorAtualSlide = indicadoresFiltrados[slideIndex]

  // Contadores para o cabeçalho
  const contagemPorFaixa = useMemo(() => {
    let verdes = 0
    let ambars = 0
    let vermelhos = 0
    let indefinidos = 0

    CATALOGO_INDICADORES.forEach((ind) => {
      const ex = ind.extrairValor(contextoCalculo)
      if (ex.faixaStatus === 'verde') verdes++
      else if (ex.faixaStatus === 'ambar') ambars++
      else if (ex.faixaStatus === 'vermelho') vermelhos++
      else indefinidos++
    })

    return { verdes, ambars, vermelhos, indefinidos }
  }, [contextoCalculo])

  return (
    <div
      className={`space-y-6 pb-12 ${telaCheia ? 'fixed inset-0 z-50 bg-background p-6 overflow-y-auto' : ''}`}
    >
      {/* CABEÇALHO DA PÁGINA */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-b pb-5">
        <div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
              <Sparkles className="h-3 w-3 mr-1" />
              Guia & Apresentação Educativa
            </Badge>
            {empresaAtiva && (
              <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <Building className="h-3.5 w-3.5 text-primary" />
                {empresaAtiva.razao_social} ({selectedAno})
              </span>
            )}
          </div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground mt-1">
            Apresentação Geral de Indicadores
          </h1>
          <p className="text-sm text-muted-foreground max-w-3xl mt-1">
            Catálogo metodológico completo com todos os indicadores do sistema, fórmulas passo a
            passo, interpretações consultivas e apuração em tempo real para apresentar e educar
            clientes.
          </p>
        </div>

        {/* Ações superiores */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Seletor de Modo: Grade / Radar / Slides */}
          <div className="flex items-center rounded-lg border bg-muted/50 p-1">
            <Button
              variant={modoVisualizacao === 'grade' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setModoVisualizacao('grade')}
              className="gap-1.5 h-8 text-xs"
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              Grade
            </Button>
            <Button
              variant={modoVisualizacao === 'radar' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setModoVisualizacao('radar')}
              className="gap-1.5 h-8 text-xs"
            >
              <Target className="h-3.5 w-3.5" />
              Radar 360°
            </Button>
            <Button
              variant={modoVisualizacao === 'slides' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setModoVisualizacao('slides')}
              className="gap-1.5 h-8 text-xs"
            >
              <Presentation className="h-3.5 w-3.5" />
              Modo Slides
            </Button>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={exportarCsv}
            className="gap-1.5 h-8 text-xs"
            title="Exportar catálogo e valores em formato CSV"
          >
            <Download className="h-3.5 w-3.5" />
            CSV
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setModalPdfOpen(true)}
            className="gap-1.5 h-8 text-xs bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100"
            title="Visualizar laudo A4 institucional para impressão ou PDF"
          >
            <Printer className="h-3.5 w-3.5" />
            Imprimir A4
          </Button>

          {modoVisualizacao === 'slides' && (
            <Button
              variant="outline"
              size="sm"
              onClick={toggleFullscreen}
              className="gap-1.5 h-8 text-xs"
              title="Tela cheia para projetor ou reunião"
            >
              {telaCheia ? (
                <Minimize2 className="h-3.5 w-3.5" />
              ) : (
                <Maximize2 className="h-3.5 w-3.5" />
              )}
              {telaCheia ? 'Sair da Tela Cheia' : 'Tela Cheia'}
            </Button>
          )}

          <Button
            variant="ghost"
            size="icon"
            onClick={carregarDados}
            disabled={carregando}
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            title="Recarregar dados"
          >
            <RefreshCw className={`h-4 w-4 ${carregando ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* BANNER CONSULTIVO RESUMO DO DIAGNÓSTICO */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card className="p-3 bg-muted/30 border-dashed">
          <div className="text-xs text-muted-foreground font-medium">Total de Indicadores</div>
          <div className="text-xl font-bold mt-0.5">{CATALOGO_INDICADORES.length} métricas</div>
          <div className="text-[11px] text-muted-foreground mt-0.5">8 categorias gerenciais</div>
        </Card>
        <Card className="p-3 bg-emerald-50/60 border-emerald-200">
          <div className="text-xs text-emerald-800 font-medium flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3 text-emerald-600" />
            Na Faixa Ideal
          </div>
          <div className="text-xl font-bold text-emerald-900 mt-0.5">{contagemPorFaixa.verdes}</div>
          <div className="text-[11px] text-emerald-700 mt-0.5">Dentro da meta saudável</div>
        </Card>
        <Card className="p-3 bg-amber-50/60 border-amber-200">
          <div className="text-xs text-amber-800 font-medium flex items-center gap-1">
            <AlertTriangle className="h-3 w-3 text-amber-600" />
            Em Atenção
          </div>
          <div className="text-xl font-bold text-amber-900 mt-0.5">{contagemPorFaixa.ambars}</div>
          <div className="text-[11px] text-amber-700 mt-0.5">Equilíbrio moderado</div>
        </Card>
        <Card className="p-3 bg-rose-50/60 border-rose-200">
          <div className="text-xs text-rose-800 font-medium flex items-center gap-1">
            <XCircle className="h-3 w-3 text-rose-600" />
            Faixa Crítica
          </div>
          <div className="text-xl font-bold text-rose-900 mt-0.5">{contagemPorFaixa.vermelhos}</div>
          <div className="text-[11px] text-rose-700 mt-0.5">Exigem intervenção imediata</div>
        </Card>
        <Card className="p-3 bg-slate-50 border-slate-200 col-span-2 md:col-span-1">
          <div className="text-xs text-slate-700 font-medium flex items-center gap-1">
            <HelpCircle className="h-3 w-3 text-slate-500" />
            Sem Apuração
          </div>
          <div className="text-xl font-bold text-slate-800 mt-0.5">
            {contagemPorFaixa.indefinidos}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">Aguardando lançamentos</div>
        </Card>
      </div>

      {/* SEÇÃO DESTACADA: GRÁFICO DE RADAR POR CATEGORIA */}
      {modoVisualizacao !== 'slides' && (
        <section aria-label="Visão Geral por Categoria (Radar)">
          <GraficoRadarCategorias
            diagnostico={diagnosticoRadar}
            anoAtual={selectedAno}
            anoAnterior={selectedAno - 1}
            empresaNome={empresaAtiva?.razao_social || 'Empresa Ativa'}
            onSelecionarCategoria={(catId) => {
              setCategoriaAtiva(catId)
              setModoVisualizacao('grade')
              // Rola suavemente até os cards
              const elem = document.getElementById('grade-indicadores')
              if (elem) elem.scrollIntoView({ behavior: 'smooth' })
            }}
          />
        </section>
      )}

      {/* FILTROS E BUSCA */}
      <div
        id="grade-indicadores"
        className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3"
      >
        {/* Barra de Categorias */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
          <Button
            variant={categoriaAtiva === 'todas' ? 'default' : 'outline'}
            size="sm"
            onClick={() => {
              setCategoriaAtiva('todas')
              setSlideIndex(0)
            }}
            className="text-xs h-8 shrink-0 rounded-full"
          >
            Todas as Categorias ({CATALOGO_INDICADORES.length})
          </Button>
          {CATEGORIAS_INDICADORES.map((cat) => {
            const Icone = ICONE_CATEGORIA[cat.id] || BookOpen
            const qtd = CATALOGO_INDICADORES.filter((i) => i.categoria === cat.id).length
            return (
              <Button
                key={cat.id}
                variant={categoriaAtiva === cat.id ? 'default' : 'outline'}
                size="sm"
                onClick={() => {
                  setCategoriaAtiva(cat.id)
                  setSlideIndex(0)
                }}
                className="text-xs h-8 shrink-0 rounded-full gap-1.5"
              >
                <Icone className="h-3.5 w-3.5" />
                {cat.nome.replace(/^\d+\.\s*/, '')} ({qtd})
              </Button>
            )
          })}
        </div>

        {/* Input de Busca */}
        <div className="relative w-full md:w-72 shrink-0">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, sigla ou fórmula..."
            value={termoBusca}
            onChange={(e) => {
              setTermoBusca(e.target.value)
              setSlideIndex(0)
            }}
            className="pl-9 h-9 text-xs"
          />
        </div>
      </div>

      {/* CONTEÚDO PRINCIPAL: MODO RADAR EXCLUSIVO, MODO SLIDES OU MODO GRADE */}
      {modoVisualizacao === 'radar' ? (
        /* ==================================================== */
        /* MODO RADAR FOCADO: DETALHAMENTO DAS 8 CATEGORIAS */
        /* ==================================================== */
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-muted/40 p-3 rounded-lg border">
            <div>
              <span className="text-xs font-bold text-foreground">
                Detalhamento dos Indicadores por Categoria
              </span>
              <p className="text-[11px] text-muted-foreground">
                Abaixo estão reunidos os indicadores apurados para cada eixo do radar com seus
                respectivos atingimentos.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setModoVisualizacao('grade')}
              className="text-xs h-7"
            >
              Ver Grade Completa
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {diagnosticoRadar.itens.map((cat) => (
              <Card
                key={cat.categoriaId}
                className="p-3.5 border hover:border-primary/50 transition-all cursor-pointer"
                onClick={() => {
                  setCategoriaAtiva(cat.categoriaId)
                  setModoVisualizacao('grade')
                }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="font-bold text-xs text-foreground line-clamp-1">
                    {cat.categoriaNomeCurto}
                  </div>
                  <Badge
                    variant="outline"
                    className={`text-[10px] px-1.5 py-0 font-mono font-bold shrink-0 ${cat.badgeBg}`}
                  >
                    {cat.scoreAtual !== null ? `${cat.scoreAtual} pts` : '—'}
                  </Badge>
                </div>

                <p className="text-[11px] text-muted-foreground mt-1 line-clamp-1">
                  {cat.destaqueTexto}
                </p>

                <div className="mt-2.5 pt-2 border-t flex items-center justify-between text-[10px] text-muted-foreground">
                  <span>
                    {cat.indicadoresIdeais} verdes • {cat.indicadoresCriticos} críticos
                  </span>
                  <span className="text-primary font-semibold flex items-center gap-0.5">
                    Ver métricas &rarr;
                  </span>
                </div>
              </Card>
            ))}
          </div>
        </div>
      ) : indicadoresFiltrados.length === 0 ? (
        <Card className="p-12 text-center">
          <HelpCircle className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <h3 className="font-semibold text-foreground">Nenhum indicador encontrado</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Tente mudar a categoria selecionada ou limpe o termo de busca.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setCategoriaAtiva('todas')
              setTermoBusca('')
            }}
            className="mt-4"
          >
            Limpar Filtros
          </Button>
        </Card>
      ) : modoVisualizacao === 'slides' ? (
        /* ==================================================== */
        /* MODO SLIDES / APRESENTAÇÃO */
        /* ==================================================== */
        <div className="space-y-4">
          {/* Barra de controle dos slides */}
          <div className="flex items-center justify-between bg-card border rounded-lg px-4 py-2.5 shadow-sm">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Slide {slideIndex + 1} de {indicadoresFiltrados.length}
              </span>
              <Badge variant="outline" className="text-xs">
                {CATEGORIAS_INDICADORES.find((c) => c.id === indicadorAtualSlide.categoria)?.nome}
              </Badge>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSlideIndex((prev) => Math.max(0, prev - 1))}
                disabled={slideIndex === 0}
                className="gap-1 h-8 text-xs"
              >
                <ChevronLeft className="h-4 w-4" />
                Anterior
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={() =>
                  setSlideIndex((prev) => Math.min(indicadoresFiltrados.length - 1, prev + 1))
                }
                disabled={slideIndex === indicadoresFiltrados.length - 1}
                className="gap-1 h-8 text-xs bg-emerald-600 hover:bg-emerald-700"
              >
                Próximo
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Cartão Gigante do Slide */}
          <SlideIndicadorCard
            indicador={indicadorAtualSlide}
            contexto={contextoCalculo}
            empresaNome={empresaAtiva?.razao_social || 'Empresa Ativa'}
            ano={selectedAno}
          />

          {/* Navegação Rápida (Miniaturas/Dots de Progresso) */}
          <div className="flex items-center justify-center gap-1.5 flex-wrap pt-2">
            {indicadoresFiltrados.map((item, idx) => {
              const ex = item.extrairValor(contextoCalculo)
              const dotColor =
                idx === slideIndex
                  ? 'ring-2 ring-primary bg-primary scale-125'
                  : ex.faixaStatus === 'verde'
                    ? 'bg-emerald-500 hover:bg-emerald-600'
                    : ex.faixaStatus === 'ambar'
                      ? 'bg-amber-500 hover:bg-amber-600'
                      : ex.faixaStatus === 'vermelho'
                        ? 'bg-rose-500 hover:bg-rose-600'
                        : 'bg-muted-foreground/30 hover:bg-muted-foreground/60'

              return (
                <button
                  key={item.id}
                  onClick={() => setSlideIndex(idx)}
                  className={`h-2.5 w-2.5 rounded-full transition-all ${dotColor}`}
                  title={`${idx + 1}. ${item.nome} (${item.sigla})`}
                />
              )
            })}
          </div>
        </div>
      ) : (
        /* ==================================================== */
        /* MODO GRADE / CARDS */
        /* ==================================================== */
        <div className="space-y-8">
          {CATEGORIAS_INDICADORES.filter(
            (cat) => categoriaAtiva === 'todas' || categoriaAtiva === cat.id,
          ).map((cat) => {
            const itensDestaCat = indicadoresFiltrados.filter((i) => i.categoria === cat.id)
            if (itensDestaCat.length === 0) return null

            const Icone = ICONE_CATEGORIA[cat.id] || BookOpen

            return (
              <div key={cat.id} className="space-y-3">
                {/* Cabeçalho da Categoria */}
                <div className="flex items-center justify-between border-b pb-2">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-md bg-emerald-100 text-emerald-800">
                      <Icone className="h-4 w-4" />
                    </div>
                    <div>
                      <h2 className="text-base font-bold text-foreground">{cat.nome}</h2>
                      <p className="text-xs text-muted-foreground">{cat.descricao}</p>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {itensDestaCat.length} indicadores
                  </Badge>
                </div>

                {/* Grade de Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {itensDestaCat.map((ind) => (
                    <CardIndicadorCompacto
                      key={ind.id}
                      indicador={ind}
                      contexto={contextoCalculo}
                      ano={selectedAno}
                      onVerNoSlide={() => {
                        const globalIdx = indicadoresFiltrados.findIndex((i) => i.id === ind.id)
                        if (globalIdx >= 0) {
                          setSlideIndex(globalIdx)
                          setModoVisualizacao('slides')
                        }
                      }}
                    />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal de Impressão PDF A4 */}
      <ModalPdfApresentacaoIndicadores
        open={modalPdfOpen}
        onOpenChange={setModalPdfOpen}
        contexto={contextoCalculo}
        empresaNome={empresaAtiva?.razao_social || 'Empresa Geral'}
        ano={selectedAno}
      />
    </div>
  )
}

// Subcomponente: Card no Modo Grade
interface CardIndicadorCompactoProps {
  indicador: IndicadorCatalogoItem
  contexto: ContextoCalculoIndicadores
  ano: number
  onVerNoSlide: () => void
}

function CardIndicadorCompacto({
  indicador,
  contexto,
  ano,
  onVerNoSlide,
}: CardIndicadorCompactoProps) {
  const extraido = indicador.extrairValor(contexto)

  const statusBadge =
    extraido.faixaStatus === 'verde'
      ? {
          cor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
          icone: CheckCircle2,
          texto: 'Ideal',
        }
      : extraido.faixaStatus === 'ambar'
        ? {
            cor: 'bg-amber-50 text-amber-700 border-amber-200',
            icone: AlertTriangle,
            texto: 'Atenção',
          }
        : extraido.faixaStatus === 'vermelho'
          ? {
              cor: 'bg-rose-50 text-rose-700 border-rose-200',
              icone: XCircle,
              texto: 'Crítico',
            }
          : {
              cor: 'bg-slate-50 text-slate-600 border-slate-200',
              icone: HelpCircle,
              texto: 'Sem dados',
            }

  const IconeStatus = statusBadge.icone

  return (
    <Card className="flex flex-col justify-between hover:shadow-md transition-shadow border-border/80">
      <CardHeader className="p-4 pb-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <Badge
              variant="outline"
              className="text-[10px] px-1.5 py-0 h-4 font-mono uppercase text-muted-foreground"
            >
              {indicador.sigla}
            </Badge>
            <CardTitle className="text-sm font-bold text-foreground mt-1 line-clamp-1">
              {indicador.nome}
            </CardTitle>
          </div>
          <Badge
            variant="outline"
            className={`text-[10px] gap-1 px-1.5 py-0.5 shrink-0 ${statusBadge.cor}`}
          >
            <IconeStatus className="h-3 w-3" />
            {statusBadge.texto}
          </Badge>
        </div>

        {/* Fórmula */}
        <div className="mt-2 rounded bg-muted/60 px-2 py-1 text-[11px] font-mono text-muted-foreground">
          {indicador.formulaLegivel}
        </div>
      </CardHeader>

      <CardContent className="p-4 pt-1 flex-1 flex flex-col justify-between space-y-3">
        {/* Valor Calculado */}
        <div className="rounded-lg border bg-gradient-to-r from-card to-muted/30 p-2.5">
          <div className="flex items-baseline justify-between">
            <span className="text-[11px] font-medium text-muted-foreground">
              Valor Real ({ano})
            </span>
            {extraido.textoComparacao && (
              <span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                {extraido.textoComparacao}
              </span>
            )}
          </div>
          <div className="text-lg font-black tracking-tight text-foreground mt-0.5">
            {extraido.textoExibicao}
          </div>
        </div>

        {/* O que mede */}
        <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
          {indicador.oQueMede}
        </p>

        {/* Dica consultiva */}
        <div className="rounded-md bg-emerald-50/50 dark:bg-emerald-950/20 p-2 border border-emerald-100/60 dark:border-emerald-900/40 text-[11px] text-emerald-900 dark:text-emerald-200">
          <div className="font-semibold flex items-center gap-1 text-[10px] text-emerald-700 dark:text-emerald-400 uppercase tracking-wider mb-0.5">
            <Lightbulb className="h-3 w-3" />
            Dica Prática
          </div>
          <p className="line-clamp-2">{indicador.dicaPratica}</p>
        </div>

        {/* Botão de Ver Detalhes / Apresentar */}
        <Button
          variant="ghost"
          size="sm"
          onClick={onVerNoSlide}
          className="w-full text-xs h-7 text-primary hover:text-primary gap-1 pt-1 justify-center"
        >
          Apresentar no Slide
          <ArrowRight className="h-3 w-3" />
        </Button>
      </CardContent>
    </Card>
  )
}

// Subcomponente: Card no Modo Slides (Apresentação Profissional)
interface SlideIndicadorCardProps {
  indicador: IndicadorCatalogoItem
  contexto: ContextoCalculoIndicadores
  empresaNome: string
  ano: number
}

function SlideIndicadorCard({ indicador, contexto, empresaNome, ano }: SlideIndicadorCardProps) {
  const extraido = indicador.extrairValor(contexto)
  const catConfig = CATEGORIAS_INDICADORES.find((c) => c.id === indicador.categoria)
  const Icone = catConfig ? ICONE_CATEGORIA[catConfig.id] : BookOpen

  const statusInfo =
    extraido.faixaStatus === 'verde'
      ? {
          corFundo:
            'bg-emerald-50 border-emerald-300 dark:bg-emerald-950/30 dark:border-emerald-800',
          corTexto: 'text-emerald-800 dark:text-emerald-300',
          rotulo: 'Status: Faixa Ideal / Saudável',
          icone: CheckCircle2,
        }
      : extraido.faixaStatus === 'ambar'
        ? {
            corFundo: 'bg-amber-50 border-amber-300 dark:bg-amber-950/30 dark:border-amber-800',
            corTexto: 'text-amber-800 dark:text-amber-300',
            rotulo: 'Status: Ponto de Atenção Moderada',
            icone: AlertTriangle,
          }
        : extraido.faixaStatus === 'vermelho'
          ? {
              corFundo: 'bg-rose-50 border-rose-300 dark:bg-rose-950/30 dark:border-rose-800',
              corTexto: 'text-rose-800 dark:text-rose-300',
              rotulo: 'Status: Faixa Crítica / Intervenção Necessária',
              icone: XCircle,
            }
          : {
              corFundo: 'bg-slate-50 border-slate-300 dark:bg-slate-900/30 dark:border-slate-800',
              corTexto: 'text-slate-700 dark:text-slate-300',
              rotulo: 'Status: Não apurado neste exercício',
              icone: HelpCircle,
            }

  const IconeStatus = statusInfo.icone

  return (
    <Card className="border-2 shadow-lg overflow-hidden transition-all duration-200">
      {/* Topo do Slide */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white p-6 md:p-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className="border-slate-600 bg-slate-800/80 text-emerald-400 text-xs"
              >
                {catConfig?.nome}
              </Badge>
              <span className="text-xs text-slate-400 font-mono tracking-wider font-semibold">
                SIGLA: {indicador.sigla}
              </span>
            </div>
            <h2 className="text-2xl md:text-4xl font-extrabold tracking-tight text-white flex items-center gap-3">
              <Icone className="h-8 w-8 text-emerald-400 shrink-0" />
              {indicador.nome}
            </h2>
          </div>

          {/* Destaque do Valor da Empresa */}
          <div
            className={`rounded-xl border-2 p-4 text-right backdrop-blur-sm ${statusInfo.corFundo}`}
          >
            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center justify-end gap-1">
              <IconeStatus className="h-3.5 w-3.5" />
              {empresaNome} ({ano})
            </div>
            <div className="text-2xl md:text-3xl font-black mt-0.5 text-foreground">
              {extraido.textoExibicao}
            </div>
            {extraido.textoComparacao && (
              <div className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 mt-1">
                {extraido.textoComparacao}
              </div>
            )}
            <div className={`text-[11px] font-bold mt-1 ${statusInfo.corTexto}`}>
              {statusInfo.rotulo}
            </div>
          </div>
        </div>

        {/* Banner da Fórmula */}
        <div className="mt-6 rounded-lg bg-black/40 border border-slate-700/80 p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs text-slate-400 uppercase tracking-wider font-semibold">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            Fórmula Metodológica:
          </div>
          <div className="text-sm md:text-base font-mono font-bold text-emerald-300">
            {indicador.formulaLegivel}
          </div>
        </div>
      </div>

      {/* Corpo do Slide: Detalhes Consultivos */}
      <CardContent className="p-6 md:p-8 space-y-6">
        {/* Seção 1: O que mede e Como Interpretar */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2 rounded-xl bg-muted/40 p-5 border">
            <div className="flex items-center gap-2 text-primary font-bold text-sm uppercase tracking-wider">
              <BookOpen className="h-4 w-4" />
              O Que Mede?
            </div>
            <p className="text-sm md:text-base leading-relaxed text-foreground">
              {indicador.oQueMede}
            </p>
          </div>

          <div className="space-y-2 rounded-xl bg-muted/40 p-5 border">
            <div className="flex items-center gap-2 text-primary font-bold text-sm uppercase tracking-wider">
              <Scale className="h-4 w-4" />
              Como Interpretar os Resultados?
            </div>
            <p className="text-sm md:text-base leading-relaxed text-foreground">
              {indicador.comoInterpretar}
            </p>
          </div>
        </div>

        {/* Seção 2: Régua das Faixas de Mercado (Verde / Âmbar / Vermelho) */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <Scale className="h-3.5 w-3.5 text-primary" />
            Parâmetros & Faixas de Referência de Mercado
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Ideal */}
            <div className="rounded-lg border-2 border-emerald-300 bg-emerald-50/70 dark:bg-emerald-950/20 p-4">
              <div className="flex items-center gap-1.5 font-bold text-emerald-800 dark:text-emerald-300 text-xs uppercase tracking-wider">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                Faixa Ideal (Verde)
              </div>
              <p className="text-xs font-medium text-emerald-900 dark:text-emerald-200 mt-2 leading-relaxed">
                {indicador.faixas.ideal}
              </p>
            </div>

            {/* Atenção */}
            <div className="rounded-lg border-2 border-amber-300 bg-amber-50/70 dark:bg-amber-950/20 p-4">
              <div className="flex items-center gap-1.5 font-bold text-amber-800 dark:text-amber-300 text-xs uppercase tracking-wider">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                Faixa de Atenção (Âmbar)
              </div>
              <p className="text-xs font-medium text-amber-900 dark:text-amber-200 mt-2 leading-relaxed">
                {indicador.faixas.atencao}
              </p>
            </div>

            {/* Crítico */}
            <div className="rounded-lg border-2 border-rose-300 bg-rose-50/70 dark:bg-rose-950/20 p-4">
              <div className="flex items-center gap-1.5 font-bold text-rose-800 dark:text-rose-300 text-xs uppercase tracking-wider">
                <XCircle className="h-4 w-4 text-rose-600" />
                Faixa Crítica (Vermelho)
              </div>
              <p className="text-xs font-medium text-rose-900 dark:text-rose-200 mt-2 leading-relaxed">
                {indicador.faixas.critico}
              </p>
            </div>
          </div>
        </div>

        {/* Seção 3: Recomendação Consultiva / Dica Prática */}
        <div className="rounded-xl border border-emerald-200 bg-gradient-to-r from-emerald-50/90 to-teal-50/90 dark:from-emerald-950/30 dark:to-teal-950/30 p-5">
          <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-bold text-sm uppercase tracking-wider mb-2">
            <Lightbulb className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            Recomendação & Ação Consultiva para o Cliente
          </div>
          <p className="text-sm md:text-base leading-relaxed text-emerald-950 dark:text-emerald-100 font-medium">
            {indicador.dicaPratica}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

export default IndicadoresApresentacao
