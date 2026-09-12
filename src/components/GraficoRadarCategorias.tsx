import { useMemo } from 'react'
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  ShieldCheck,
  AlertTriangle,
  Flame,
  HelpCircle,
  TrendingUp,
  TrendingDown,
  Sparkles,
  Info,
  CheckCircle2,
  XCircle,
} from 'lucide-react'
import type {
  DiagnosticoRadarResult,
  PontuacaoCategoriaItem,
} from '@/lib/diagnosticoRadarApresentacao'

export interface GraficoRadarCategoriasProps {
  diagnostico: DiagnosticoRadarResult
  anoAtual: number
  anoAnterior: number
  empresaNome?: string
  onSelecionarCategoria?: (categoriaId: string) => void
}

export function GraficoRadarCategorias({
  diagnostico,
  anoAtual,
  anoAnterior,
  empresaNome,
  onSelecionarCategoria,
}: GraficoRadarCategoriasProps) {
  const {
    itens,
    temDadosAtual,
    temDadosAnterior,
    scoreGeralAtual,
    scoreGeralAnterior,
    categoriasFortes,
    categoriasFrageis,
    categoriasModeradas,
  } = diagnostico

  // Formatação dos dados para o Recharts RadarChart
  const radarData = useMemo(() => {
    return itens.map((item) => ({
      categoriaId: item.categoriaId,
      categoriaNomeCurto: item.categoriaNomeCurto,
      categoriaNomeCompleto: item.categoriaNome,
      scoreAtual: item.scoreAtual ?? 0,
      scoreAnterior: item.scoreAnterior ?? 0,
      itemRaw: item,
      // Linha de referência de excelência (100)
      referencia: 100,
    }))
  }, [itens])

  // Cor primária dinâmica para a série do ano atual com base na média geral
  const corSerieAtual = useMemo(() => {
    if (scoreGeralAtual === null) return '#10B981'
    if (scoreGeralAtual >= 75) return '#10B981' // Verde esmeralda saudável
    if (scoreGeralAtual >= 50) return '#F59E0B' // Âmbar alerta
    return '#EF4444' // Vermelho vulnerável
  }, [scoreGeralAtual])

  const diferencaAno =
    scoreGeralAtual !== null && scoreGeralAnterior !== null
      ? scoreGeralAtual - scoreGeralAnterior
      : null

  // Se NÃO houver dados calculáveis para o ano
  if (!temDadosAtual) {
    return (
      <Card className="border-dashed border-2 border-slate-300 dark:border-slate-800 bg-muted/20">
        <CardContent className="py-12 px-6 text-center space-y-4 max-w-xl mx-auto">
          <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400 mx-auto flex items-center justify-center">
            <HelpCircle className="h-7 w-7" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-foreground">
              Radar por Categoria Indisponível para {anoAtual}
            </h3>
            <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
              O gráfico de radar multidimensional é gerado automaticamente a partir do{' '}
              <strong>Balanço Patrimonial</strong> e da <strong>DRE</strong> lançados para{' '}
              <strong>{empresaNome || 'a empresa selecionada'}</strong> no exercício de {anoAtual}.
            </p>
          </div>
          <div className="rounded-lg bg-background p-3.5 border text-xs text-left text-muted-foreground space-y-1.5">
            <div className="font-semibold text-foreground flex items-center gap-1.5 text-[11px] uppercase tracking-wider">
              <Info className="h-3.5 w-3.5 text-primary" />
              Como habilitar o Radar:
            </div>
            <ul className="list-disc list-inside space-y-1 text-[11px]">
              <li>Selecione outro exercício no topo da página onde já existam dados lançados;</li>
              <li>
                Ou importe o balancete/DRE em <strong>Menu &gt; Importação &gt; Balancetes</strong>;
              </li>
              <li>
                Ou cadastre os valores manuais em <strong>Demonstrações &gt; Balanço / DRE</strong>.
              </li>
            </ul>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-border shadow-xs overflow-hidden">
      <CardHeader className="p-4 sm:p-6 pb-2 border-b bg-gradient-to-r from-background via-muted/20 to-background flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="bg-emerald-50 text-emerald-800 border-emerald-300">
              <Sparkles className="h-3 w-3 mr-1" />
              Radar Multidimensional por Categoria
            </Badge>
            <span className="text-xs text-muted-foreground font-medium">
              8 Grupos de Indicadores Metodológicos
            </span>
          </div>
          <CardTitle className="text-lg md:text-xl font-bold tracking-tight text-foreground mt-1">
            Mapeamento de Força &amp; Vulnerabilidade
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground mt-0.5">
            Visão 360° do equilíbrio econômico-financeiro da empresa. Cada eixo representa a
            pontuação de 0 a 100 da respectiva categoria de indicadores.
          </CardDescription>
        </div>

        {/* Resumo do Score Geral */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="rounded-xl border bg-card p-3 text-right shadow-2xs">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Score Global ({anoAtual})
            </div>
            <div className="text-2xl font-black tracking-tight" style={{ color: corSerieAtual }}>
              {scoreGeralAtual !== null ? `${scoreGeralAtual} pts` : '—'}
            </div>
            {diferencaAno !== null && (
              <div
                className={`text-[11px] font-bold flex items-center justify-end gap-0.5 ${
                  diferencaAno > 0
                    ? 'text-emerald-600'
                    : diferencaAno < 0
                      ? 'text-rose-600'
                      : 'text-slate-500'
                }`}
              >
                {diferencaAno > 0 ? (
                  <TrendingUp className="h-3 w-3" />
                ) : (
                  <TrendingDown className="h-3 w-3" />
                )}
                <span>
                  {diferencaAno > 0 ? `+${diferencaAno}` : diferencaAno} pts vs {anoAnterior}
                </span>
              </div>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-4 sm:p-6 space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          {/* LADO ESQUERDO: GRÁFICO RADAR (7 colunas em telas grandes) */}
          <div className="lg:col-span-7 flex flex-col items-center">
            <div className="h-72 sm:h-80 md:h-96 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart
                  cx="50%"
                  cy="50%"
                  outerRadius="72%"
                  data={radarData}
                  margin={{ top: 12, right: 30, left: 30, bottom: 12 }}
                >
                  <PolarGrid stroke="#CBD5E1" strokeDasharray="3 3" />
                  <PolarAngleAxis
                    dataKey="categoriaNomeCurto"
                    tick={{
                      fill: '#0F172A',
                      fontSize: 11,
                      fontWeight: 700,
                    }}
                  />
                  <PolarRadiusAxis
                    angle={30}
                    domain={[0, 100]}
                    tick={{ fill: '#64748B', fontSize: 10 }}
                    stroke="#CBD5E1"
                  />

                  {/* Tooltip personalizado e detalhado */}
                  <RechartsTooltip
                    content={({ active, payload }) => {
                      if (!active || !payload || !payload.length) return null
                      const d = payload[0].payload as (typeof radarData)[0]
                      const item = d.itemRaw

                      return (
                        <div className="bg-slate-900 text-white p-3.5 rounded-xl shadow-xl text-xs space-y-2 border border-slate-700 min-w-[260px] max-w-[320px]">
                          <div className="border-b border-slate-700 pb-1.5">
                            <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold block">
                              Categoria Avaliada
                            </span>
                            <strong className="text-sm font-bold text-white block">
                              {item.categoriaNome}
                            </strong>
                          </div>

                          {/* Série do Ano Atual */}
                          <div className="flex items-center justify-between gap-3">
                            <span className="flex items-center gap-1.5 text-slate-300">
                              <span
                                className="w-2.5 h-2.5 rounded-full"
                                style={{ backgroundColor: item.corSaude }}
                              />
                              Exercício {anoAtual}:
                            </span>
                            <strong className="font-mono text-white text-sm">
                              {item.scoreAtual !== null
                                ? `${item.scoreAtual}/100 pts`
                                : 'Sem dados'}
                            </strong>
                          </div>

                          {/* Série do Exercício Anterior (se existir) */}
                          {temDadosAnterior && item.scoreAnterior !== null && (
                            <div className="flex items-center justify-between gap-3 text-slate-400">
                              <span className="flex items-center gap-1.5">
                                <span className="w-2.5 h-0.5 bg-slate-400 border border-dashed" />
                                Exercício {anoAnterior}:
                              </span>
                              <strong className="font-mono text-slate-300">
                                {item.scoreAnterior}/100 pts
                              </strong>
                            </div>
                          )}

                          {/* Diagnóstico Rápido */}
                          <div className="pt-1.5 border-t border-slate-800 text-[11px] space-y-1">
                            <div className="text-slate-300">
                              <span className="text-slate-400">Diagnóstico: </span>
                              <span
                                className="font-semibold"
                                style={{
                                  color:
                                    item.statusSaude === 'forte'
                                      ? '#34D399'
                                      : item.statusSaude === 'moderado'
                                        ? '#FBBF24'
                                        : '#F87171',
                                }}
                              >
                                {item.destaqueTexto}
                              </span>
                            </div>
                            <div className="text-[10px] text-slate-400">
                              {item.indicadoresIdeais} ideais • {item.indicadoresAtencao} atenção •{' '}
                              {item.indicadoresCriticos} críticos (total: {item.totalIndicadores})
                            </div>
                          </div>
                        </div>
                      )
                    }}
                  />

                  {/* Linha de Referência de Excelência (100) pontilhada */}
                  <Radar
                    name="Faixa Ideal (100%)"
                    dataKey="referencia"
                    stroke="#CBD5E1"
                    fill="#E2E8F0"
                    fillOpacity={0.15}
                    strokeWidth={1}
                    strokeDasharray="4 4"
                  />

                  {/* Série 2: Exercício Anterior (se houver dados) */}
                  {temDadosAnterior && (
                    <Radar
                      name={`Exercício ${anoAnterior}`}
                      dataKey="scoreAnterior"
                      stroke="#94A3B8"
                      fill="#94A3B8"
                      fillOpacity={0.15}
                      strokeWidth={1.8}
                      strokeDasharray="3 3"
                    />
                  )}

                  {/* Série 1: Exercício Atual */}
                  <Radar
                    name={`Exercício ${anoAtual}`}
                    dataKey="scoreAtual"
                    stroke={corSerieAtual}
                    fill={corSerieAtual}
                    fillOpacity={temDadosAnterior ? 0.35 : 0.45}
                    strokeWidth={2.5}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>

            {/* Legenda do Gráfico */}
            <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-muted-foreground pt-3 border-t w-full">
              <span className="flex items-center gap-1.5 font-medium">
                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: corSerieAtual }} />
                Ano-Base ({anoAtual})
              </span>
              {temDadosAnterior && (
                <span className="flex items-center gap-1.5">
                  <span className="w-3.5 h-0.5 bg-slate-400 border border-dashed border-slate-400" />
                  Exercício Anterior ({anoAnterior})
                </span>
              )}
              <span className="flex items-center gap-1.5 text-slate-400">
                <span className="w-3.5 h-0.5 bg-slate-300" />
                Meta de Excelência (100 pts)
              </span>
            </div>
          </div>

          {/* LADO DIREITO: CARTOES DE FORÇAS, FRAGILIDADES E TABELA RESUMO (5 colunas) */}
          <div className="lg:col-span-5 space-y-4">
            {/* Bloco de Forças */}
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 dark:bg-emerald-950/20 p-3.5">
              <div className="flex items-center gap-1.5 font-bold text-xs uppercase tracking-wider text-emerald-800 dark:text-emerald-300 mb-2">
                <ShieldCheck className="h-4 w-4 text-emerald-600" />
                Pontos Fortes da Empresa ({categoriasFortes.length})
              </div>
              {categoriasFortes.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">
                  Nenhuma categoria atingiu a faixa de excelência (≥75 pts) no exercício.
                </p>
              ) : (
                <div className="space-y-1.5">
                  {categoriasFortes.map((cat) => (
                    <div
                      key={cat.categoriaId}
                      className="flex items-center justify-between text-xs bg-white dark:bg-card p-2 rounded-lg border border-emerald-100 shadow-2xs"
                    >
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                        <span className="font-semibold text-foreground">
                          {cat.categoriaNomeCurto}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className="bg-emerald-50 text-emerald-700 border-emerald-300 font-mono text-[11px]"
                        >
                          {cat.scoreAtual} pts
                        </Badge>
                        {onSelecionarCategoria && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onSelecionarCategoria(cat.categoriaId)}
                            className="h-6 px-1.5 text-[10px] text-primary hover:text-primary"
                          >
                            Ver
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Bloco de Fragilidades / Riscos */}
            <div className="rounded-xl border border-rose-200 bg-rose-50/50 dark:bg-rose-950/20 p-3.5">
              <div className="flex items-center gap-1.5 font-bold text-xs uppercase tracking-wider text-rose-800 dark:text-rose-300 mb-2">
                <Flame className="h-4 w-4 text-rose-600" />
                Vulnerabilidades &amp; Pontos Críticos ({categoriasFrageis.length})
              </div>
              {categoriasFrageis.length === 0 ? (
                <p className="text-xs text-emerald-700 dark:text-emerald-300 italic">
                  Parabéns! Nenhuma categoria em estado crítico (&lt;50 pts).
                </p>
              ) : (
                <div className="space-y-1.5">
                  {categoriasFrageis.map((cat) => (
                    <div
                      key={cat.categoriaId}
                      className="flex items-center justify-between text-xs bg-white dark:bg-card p-2 rounded-lg border border-rose-100 shadow-2xs"
                    >
                      <div className="flex items-center gap-2">
                        <XCircle className="h-3.5 w-3.5 text-rose-600 shrink-0" />
                        <span className="font-semibold text-foreground">
                          {cat.categoriaNomeCurto}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className="bg-rose-50 text-rose-700 border-rose-300 font-mono text-[11px]"
                        >
                          {cat.scoreAtual} pts
                        </Badge>
                        {onSelecionarCategoria && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onSelecionarCategoria(cat.categoriaId)}
                            className="h-6 px-1.5 text-[10px] text-rose-700 hover:text-rose-800"
                          >
                            Ajustar
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Bloco de Categorias em Atenção Moderada (se houver) */}
            {categoriasModeradas.length > 0 && (
              <div className="rounded-xl border border-amber-200 bg-amber-50/40 dark:bg-amber-950/20 p-3.5">
                <div className="flex items-center gap-1.5 font-bold text-xs uppercase tracking-wider text-amber-800 dark:text-amber-300 mb-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  Em Atenção Moderada ({categoriasModeradas.length})
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {categoriasModeradas.map((cat) => (
                    <Badge
                      key={cat.categoriaId}
                      variant="outline"
                      className="bg-amber-50 text-amber-800 border-amber-300 text-xs font-normal"
                    >
                      {cat.categoriaNomeCurto}:{' '}
                      <strong className="ml-1">{cat.scoreAtual} pts</strong>
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Régua explicativa de saúde */}
            <div className="rounded-lg bg-muted/40 p-3 border text-[11px] text-muted-foreground space-y-1">
              <div className="font-semibold text-foreground">Interpretação da Escala 0–100:</div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
                <span>
                  <strong>≥ 75 pts (Verde):</strong> Força comprovada, equilíbrio saudável.
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0" />
                <span>
                  <strong>50 a 74 pts (Âmbar):</strong> Atenção moderada, requer calibragem.
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0" />
                <span>
                  <strong>&lt; 50 pts (Vermelho):</strong> Fragilidade, risco de desequilíbrio.
                </span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
