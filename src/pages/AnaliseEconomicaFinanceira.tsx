import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Scale,
  BarChart3,
  Tags,
  PieChart,
  TrendingUp,
  ArrowRight,
  Building2,
  Calendar,
  Sparkles,
  ShieldCheck,
  ChevronRight,
} from 'lucide-react'
import { useFilter } from '@/contexts/FilterContext'
import { useAuth } from '@/contexts/AuthContext'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface HubShortcut {
  id: string
  titulo: string
  subtitulo: string
  descricao: string
  badge: string
  badgeVariant?: 'blue' | 'emerald' | 'amber' | 'cyan'
  icon: typeof Scale
  gradient: string
  borderGlow: string
  iconBg: string
  rota: (empresaId: string | null) => string
  metricasTexto: string
}

export default function AnaliseEconomicaFinanceira() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { selectedEmpresa, selectedEmpresaId, selectedAno } = useFilter()

  const empresaAtivaId =
    selectedEmpresaId && !selectedEmpresaId.startsWith('grupo-')
      ? selectedEmpresaId
      : selectedEmpresa?.id || null

  const empresaNome = selectedEmpresa?.nome || 'Empresa Ativa'

  const atalhos: HubShortcut[] = useMemo(
    () => [
      {
        id: 'balanco',
        titulo: 'Balanço Patrimonial',
        subtitulo: 'Ativo, Passivo & Patrimônio Líquido',
        descricao:
          'Visão analítica da posição estática e estrutura de capital da empresa no exercício selecionado.',
        badge: 'Balanço',
        badgeVariant: 'cyan',
        icon: Scale,
        gradient: 'from-[#0F2D54] to-[#0B1F3A]',
        borderGlow: 'hover:border-cyan-400/60 hover:shadow-cyan-500/10',
        iconBg: 'bg-cyan-500/20 text-cyan-300 border-cyan-400/30',
        rota: (empId) => (empId ? `/empresas/${empId}?aba=balanco` : '/empresas'),
        metricasTexto: 'Ativo Circulante, Realizável L.P., Passivos e PL',
      },
      {
        id: 'dre',
        titulo: 'DRE Gerencial',
        subtitulo: 'Demonstração do Resultado do Exercício',
        descricao:
          'Acompanhamento mensal detalhado de receitas, custos, despesas, margens de contribuição e lucro líquido.',
        badge: 'Gerencial',
        badgeVariant: 'emerald',
        icon: BarChart3,
        gradient: 'from-[#0F354A] to-[#0B1F3A]',
        borderGlow: 'hover:border-emerald-400/60 hover:shadow-emerald-500/10',
        iconBg: 'bg-emerald-500/20 text-emerald-300 border-emerald-400/30',
        rota: () => '/gerencial/dre',
        metricasTexto: 'Receita Líquida, Margem de Contribuição e Resultado Líquido',
      },
      {
        id: 'despesas-fixas',
        titulo: 'Despesas Fixas',
        subtitulo: 'Estrutura Operacional & Administrativa',
        descricao:
          'Detalhamento das despesas fixas recorrentes, evolução mensal e percentual de impacto sobre o faturamento.',
        badge: 'Fixas',
        badgeVariant: 'blue',
        icon: Tags,
        gradient: 'from-[#142850] to-[#0B1F3A]',
        borderGlow: 'hover:border-blue-400/60 hover:shadow-blue-500/10',
        iconBg: 'bg-blue-500/20 text-blue-300 border-blue-400/30',
        rota: () => '/gerencial/despesas-fixas',
        metricasTexto: 'Alocação por tipo de conta, centro de custo e matriz mensal',
      },
      {
        id: 'despesas-variaveis',
        titulo: 'Despesas Variáveis',
        subtitulo: 'Custos Comerciais & Operacionais',
        descricao:
          'Análise das despesas diretamente ligadas às operações de venda (impostos, fretes, comissões e taxas).',
        badge: 'Variáveis',
        badgeVariant: 'amber',
        icon: PieChart,
        gradient: 'from-[#222E4A] to-[#0B1F3A]',
        borderGlow: 'hover:border-amber-400/60 hover:shadow-amber-500/10',
        iconBg: 'bg-amber-500/20 text-amber-300 border-amber-400/30',
        rota: () => '/gerencial/despesas-variaveis',
        metricasTexto: 'Comissões, fretes de entrega e alíquotas variáveis apuradas',
      },
      {
        id: 'faturamento',
        titulo: 'Análise de Faturamento',
        subtitulo: 'Evolução de Vendas & Sazonalidade',
        descricao:
          'Histórico plurianual de faturamento mensal, comparativo ano a ano, taxas de crescimento e curvas de vendas.',
        badge: 'Faturamento',
        badgeVariant: 'emerald',
        icon: TrendingUp,
        gradient: 'from-[#0A3644] to-[#0B1F3A]',
        borderGlow: 'hover:border-teal-400/60 hover:shadow-teal-500/10',
        iconBg: 'bg-teal-500/20 text-teal-300 border-teal-400/30',
        rota: () => '/gerencial/analise-faturamento',
        metricasTexto: 'Sazonalidade Jan-Dez, participação percentual e comparativos',
      },
    ],
    [],
  )

  return (
    <div className="space-y-6 pb-8 animate-fadeIn">
      {/* Banner Principal com Tema Azul-Marinho #0B1F3A e Glassmorphism */}
      <div className="relative overflow-hidden rounded-3xl bg-[#0B1F3A] border border-blue-900/40 p-6 sm:p-8 text-white shadow-xl">
        {/* Luzes de fundo / Glassmorphism decorativo */}
        <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-blue-500/10 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-96 h-96 rounded-full bg-cyan-500/10 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-3xl">
            <div className="flex items-center gap-2.5 flex-wrap">
              <Badge className="bg-cyan-500/20 text-cyan-200 border-cyan-400/30 text-xs font-semibold px-2.5 py-0.5 backdrop-blur-md">
                <Sparkles className="w-3 h-3 mr-1 text-cyan-300" />
                Painel Executivo Integrado
              </Badge>
              {user?.role === 'cliente' && (
                <Badge className="bg-white/10 text-slate-200 border-white/20 text-xs font-medium px-2 py-0.5">
                  Acesso Cliente
                </Badge>
              )}
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              Análise Econômica e Financeira
            </h1>

            <p className="text-sm text-slate-300/90 leading-relaxed">
              Central estratégica de demonstrações contábeis e gerenciais. Acesse o Balanço
              Patrimonial, DRE, acompanhamento minucioso de custos fixos e variáveis e histórico de
              faturamento da empresa selecionada.
            </p>
          </div>

          {/* Card compacto com contexto da empresa e exercício ativo */}
          <div className="shrink-0 bg-white/5 border border-white/15 rounded-2xl p-4 backdrop-blur-md flex flex-col sm:flex-row md:flex-col gap-3 min-w-[240px]">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-200 shrink-0">
                <Building2 className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold block">
                  Empresa Ativa
                </span>
                <span
                  className="text-xs font-bold text-white truncate block max-w-[190px]"
                  title={empresaNome}
                >
                  {empresaNome}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2.5 pt-2 sm:pt-0 md:pt-2 border-t sm:border-t-0 md:border-t border-white/10">
              <div className="w-9 h-9 rounded-xl bg-cyan-500/20 border border-cyan-400/30 flex items-center justify-center text-cyan-200 shrink-0">
                <Calendar className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold block">
                  Exercício de Referência
                </span>
                <span className="text-xs font-bold text-cyan-200">Ano {selectedAno}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Grid de 5 Cards Grandes com Efeito Glassmorphism e Navegação Direta */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-[#0B1F3A]">
              Módulos e Demonstrações Disponíveis
            </h2>
          </div>
          <span className="text-xs text-slate-500 font-medium">5 relatórios estruturados</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {atalhos.map((item, index) => {
            const Icon = item.icon
            const destino = item.rota(empresaAtivaId)

            return (
              <Card
                key={item.id}
                onClick={() => navigate(destino)}
                className={`group relative overflow-hidden bg-gradient-to-br ${item.gradient} border border-slate-700/60 rounded-2xl p-6 text-white cursor-pointer transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl ${item.borderGlow} flex flex-col justify-between min-h-[260px] backdrop-blur-md`}
              >
                {/* Efeito sutil de vidro reflexivo */}
                <div className="absolute inset-0 bg-white/[0.03] opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

                {/* Topo do Card: Ícone Grande + Badge */}
                <div className="space-y-4 relative z-10">
                  <div className="flex items-center justify-between">
                    <div
                      className={`w-14 h-14 rounded-2xl flex items-center justify-center border transition-all duration-300 group-hover:scale-110 shadow-lg ${item.iconBg}`}
                    >
                      <Icon className="w-7 h-7" />
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-mono text-slate-400 font-bold bg-white/5 border border-white/10 px-2 py-0.5 rounded-full">
                        0{index + 1}
                      </span>
                      <Badge
                        variant="secondary"
                        className="bg-white/10 text-white border-white/15 text-[10px] font-bold"
                      >
                        {item.badge}
                      </Badge>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-bold text-white group-hover:text-cyan-200 transition-colors flex items-center gap-1.5">
                      {item.titulo}
                    </h3>
                    <p className="text-xs font-semibold text-slate-300/80 mt-0.5">
                      {item.subtitulo}
                    </p>
                    <p className="text-xs text-slate-300/70 mt-2.5 leading-relaxed line-clamp-3">
                      {item.descricao}
                    </p>
                  </div>
                </div>

                {/* Base do Card: Metadados + Botão de Ação */}
                <div className="pt-4 mt-4 border-t border-white/10 flex items-center justify-between text-xs relative z-10">
                  <span className="text-[11px] text-slate-400 truncate max-w-[190px]">
                    {item.metricasTexto}
                  </span>

                  <div className="flex items-center gap-1 font-semibold text-cyan-300 group-hover:text-cyan-200 transition-colors shrink-0">
                    <span>Acessar</span>
                    <ArrowRight className="w-3.5 h-3.5 transition-transform duration-200 group-hover:translate-x-1" />
                  </div>
                </div>
              </Card>
            )
          })}

          {/* Card Resumo / Guia de Apoio para fechar o grid harmoniosamente */}
          <Card className="bg-[#0B1F3A]/60 border border-dashed border-slate-700/80 rounded-2xl p-6 text-white flex flex-col justify-between backdrop-blur-md">
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-blue-600/20 border border-blue-400/30 flex items-center justify-center text-blue-300">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-white">Governança & Consultoria</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                As demonstrações contábeis e gerenciais são integradas em tempo real com os
                lançamentos e balancetes da empresa. Utilize os filtros globais no cabeçalho
                superior para alternar entre diferentes exercícios e anos contábeis.
              </p>
            </div>

            <div className="pt-4 border-t border-white/10 flex items-center justify-between text-xs text-slate-400">
              <span className="text-[11px]">Ambiente Seguro & Auditado</span>
              <div className="flex items-center gap-1 text-slate-300">
                <ChevronRight className="w-3.5 h-3.5" />
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
