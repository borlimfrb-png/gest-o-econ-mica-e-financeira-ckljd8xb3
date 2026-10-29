import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Scale,
  BarChart3,
  Tags,
  PieChart,
  TrendingUp,
  Percent,
  ArrowRight,
  Building2,
  Calendar,
  Sparkles,
  ShieldCheck,
  ChevronRight,
  Gauge,
} from 'lucide-react'
import { useFilter } from '@/contexts/FilterContext'
import { useAuth } from '@/contexts/AuthContext'
import { lancamentosService, balancosService, dreService } from '@/services/financeService'
import { EstadoVazioClienteCard } from '@/components/EstadoVazioClienteCard'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { BorlimLogo } from '@/components/BorlimLogo'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { SelectEmpresaOuGrupoItems } from '@/components/SelectEmpresaOuGrupoItems'

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
  const {
    empresas,
    todasEntidades,
    selectedEmpresa,
    selectedEmpresaId,
    setSelectedEmpresaId,
    selectedAno,
    userEmpresasIds,
  } = useFilter()
  const isCliente = user?.role === 'cliente'
  const temMultiplosVinculos =
    (userEmpresasIds && userEmpresasIds.length > 1) ||
    empresas.length > 1 ||
    todasEntidades.length > 1

  const [verificandoDados, setVerificandoDados] = useState<boolean>(false)
  const [temDadosCliente, setTemDadosCliente] = useState<boolean>(true)

  const empresaAtivaId =
    selectedEmpresaId && !selectedEmpresaId.startsWith('grupo-')
      ? selectedEmpresaId
      : selectedEmpresa?.id || null

  const empresaNome = selectedEmpresa?.nome || 'Empresa Ativa'

  useEffect(() => {
    let cancelado = false

    const verificarPresencaDados = async () => {
      if (!isCliente) {
        setTemDadosCliente(true)
        return
      }

      if (!empresaAtivaId) {
        setTemDadosCliente(false)
        return
      }

      setVerificandoDados(true)
      try {
        const ano = selectedAno || new Date().getFullYear()

        const [balancos, dres, lancs] = await Promise.all([
          balancosService
            .getByEmpresa(empresaAtivaId)
            .then((list) => list.filter((b) => b.ano === ano))
            .catch(() => []),
          dreService
            .getByEmpresa(empresaAtivaId)
            .then((list) => list.filter((d) => d.ano === ano))
            .catch(() => []),
          lancamentosService
            .getAll({ empresaId: empresaAtivaId })
            .then((list) =>
              list.filter((l) => {
                const dataStr = l.data_competencia || l.data_pagamento || l.data_lancamento
                if (!dataStr) return false
                return new Date(dataStr).getFullYear() === ano
              }),
            )
            .catch(() => []),
        ])

        if (!cancelado) {
          const temAlgumDado = balancos.length > 0 || dres.length > 0 || lancs.length > 0
          setTemDadosCliente(temAlgumDado)
        }
      } catch (err) {
        console.error('Erro ao verificar dados da empresa para o cliente:', err)
        if (!cancelado) {
          // Em caso de falha de requisição, não bloqueia visualmente se tiver dúvida
          setTemDadosCliente(true)
        }
      } finally {
        if (!cancelado) {
          setVerificandoDados(false)
        }
      }
    }

    verificarPresencaDados()

    return () => {
      cancelado = true
    }
  }, [isCliente, empresaAtivaId, selectedAno])

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
        gradient: 'from-[#0B1F3A] via-[#0D294E] to-[#123668]',
        borderGlow: 'hover:border-sky-400/70 hover:shadow-sky-500/15',
        iconBg: 'bg-gradient-to-tr from-sky-500/25 to-blue-600/20 text-sky-300 border-sky-400/40',
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
        gradient: 'from-[#0B1F3A] via-[#0C3042] to-[#11494F]',
        borderGlow: 'hover:border-emerald-400/70 hover:shadow-emerald-500/15',
        iconBg:
          'bg-gradient-to-tr from-emerald-500/25 to-teal-600/20 text-emerald-300 border-emerald-400/40',
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
        gradient: 'from-[#0B1F3A] via-[#102952] to-[#163870]',
        borderGlow: 'hover:border-blue-400/70 hover:shadow-blue-500/15',
        iconBg:
          'bg-gradient-to-tr from-blue-500/25 to-indigo-600/20 text-blue-300 border-blue-400/40',
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
        gradient: 'from-[#0B1F3A] via-[#212745] to-[#2E284F]',
        borderGlow: 'hover:border-amber-400/70 hover:shadow-amber-500/15',
        iconBg:
          'bg-gradient-to-tr from-amber-500/25 to-orange-600/20 text-amber-300 border-amber-400/40',
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
        gradient: 'from-[#0B1F3A] via-[#0B333E] to-[#0E494B]',
        borderGlow: 'hover:border-teal-400/70 hover:shadow-teal-500/15',
        iconBg:
          'bg-gradient-to-tr from-teal-500/25 to-emerald-600/20 text-teal-300 border-teal-400/40',
        rota: () => '/gerencial/analise-faturamento',
        metricasTexto: 'Sazonalidade Jan-Dez, participação percentual e comparativos',
      },
      {
        id: 'rentabilidade',
        titulo: 'Análise de Rentabilidade',
        subtitulo: 'Faturamento vs. Lucro & Margens',
        descricao:
          'Visão de rentabilidade gerencial com faturamento, lucro apurado no DRE, margens percentuais e gráfico evolutivo.',
        badge: 'Rentabilidade',
        badgeVariant: 'emerald',
        icon: Percent,
        gradient: 'from-[#0B1F3A] via-[#0E343D] to-[#124B40]',
        borderGlow: 'hover:border-emerald-400/70 hover:shadow-emerald-500/15',
        iconBg:
          'bg-gradient-to-tr from-emerald-500/25 to-teal-600/20 text-emerald-300 border-emerald-400/40',
        rota: () => (isCliente ? '/cliente/rentabilidade' : '/gerencial/rentabilidade'),
        metricasTexto: 'Faturamento, Lucro Apurado, Margem Líquida, Bruta e Operacional',
      },
      {
        id: 'crescimento',
        titulo: 'Indicador de Crescimento',
        subtitulo: 'Evolução de Vendas & Taxas MoM / YoY',
        descricao:
          'Acompanhamento do ritmo de crescimento do faturamento, comparações mensais, taxas anuais e selo de qualidade da expansão.',
        badge: 'Crescimento',
        badgeVariant: 'cyan',
        icon: TrendingUp,
        gradient: 'from-[#0B1F3A] via-[#0D2E54] to-[#12467A]',
        borderGlow: 'hover:border-cyan-400/70 hover:shadow-cyan-500/15',
        iconBg:
          'bg-gradient-to-tr from-cyan-500/25 to-blue-600/20 text-cyan-300 border-cyan-400/40',
        rota: () => (isCliente ? '/cliente/crescimento' : '/gerencial/indicador-crescimento'),
        metricasTexto: 'Crescimento no período, comparativo anual e qualidade da expansão',
      },
      {
        id: 'dashboard-bi',
        titulo: 'Dashboard BI Interativo',
        subtitulo: 'Painel Executivo & BI Interativo',
        descricao:
          'Painel executivo com KPIs consolidados, evolução mensal faturamento vs. despesas, donut de centros de custo e curvas de margens.',
        badge: 'BI Interativo',
        badgeVariant: 'cyan',
        icon: Sparkles,
        gradient: 'from-[#0B1F3A] via-[#0E284E] to-[#143A6E]',
        borderGlow: 'hover:border-cyan-400/70 hover:shadow-cyan-500/15',
        iconBg: 'bg-gradient-to-tr from-cyan-500/25 to-sky-600/20 text-cyan-300 border-cyan-400/40',
        rota: () => (isCliente ? '/cliente/dashboard-bi' : '/gerencial/dashboard-bi'),
        metricasTexto: 'Faturamento, Lucro, Margens, Custos Fixos/Variáveis e Centros de Custo',
      },
      {
        id: 'indicadores',
        titulo: 'Indicadores',
        subtitulo: 'Métricas Econômico-Financeiras Clássicas',
        descricao:
          'Painel de indicadores financeiros: Liquidez Corrente/Seca/Geral, Alavancagem (Dívida/PL), ROE, ROI, Margens e Prazos Médios com badges de status.',
        badge: 'Indicadores',
        badgeVariant: 'emerald',
        icon: Gauge,
        gradient: 'from-[#0B1F3A] via-[#103438] to-[#164842]',
        borderGlow: 'hover:border-emerald-400/70 hover:shadow-emerald-500/15',
        iconBg:
          'bg-gradient-to-tr from-emerald-500/25 to-teal-600/20 text-emerald-300 border-emerald-400/40',
        rota: () => (isCliente ? '/cliente/indicadores' : '/gerencial/indicadores'),
        metricasTexto: 'Liquidez, Endividamento, ROE/ROA, Margens e Prazos Médios PMR/PMP',
      },
    ],
    [isCliente],
  )

  return (
    <div className="space-y-6 pb-8 animate-fadeIn">
      {/* Banner Principal com Tema Azul-Marinho Profundo e Gradiente Moderno */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#0B1F3A] via-[#0E284E] to-[#143A6E] border border-blue-900/40 p-6 sm:p-8 text-white shadow-xl shadow-slate-900/10">
        {/* Luzes de fundo / Glassmorphism decorativo */}
        <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-blue-500/10 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-96 h-96 rounded-full bg-cyan-500/10 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-3 max-w-3xl">
            <div className="flex items-center gap-2.5 flex-wrap">
              <BorlimLogo size="md" variant="light" showSubtitle={false} className="shadow-md" />
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
              Central estratégica de demonstrações contábeis e gerenciais pela{' '}
              <strong className="text-sky-300">Borlim Consultoria</strong>. Acesse o Balanço
              Patrimonial, DRE, Rentabilidade, Indicador de Crescimento, custos fixos e variáveis e
              histórico de faturamento da empresa selecionada.{' '}
            </p>
          </div>

          {/* Card compacto com contexto da empresa e exercício ativo */}
          <div className="shrink-0 bg-white/5 border border-white/15 rounded-2xl p-4 backdrop-blur-md flex flex-col sm:flex-row md:flex-col gap-3 min-w-[240px]">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-200 shrink-0">
                <Building2 className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold block">
                  Empresa Ativa
                </span>
                {temMultiplosVinculos ? (
                  <Select
                    value={selectedEmpresaId}
                    onValueChange={(id) => setSelectedEmpresaId(id)}
                  >
                    <SelectTrigger className="h-7 border border-white/20 bg-white/10 hover:bg-white/15 text-xs font-bold text-white p-2 mt-0.5 w-full focus:ring-1 focus:ring-sky-400 cursor-pointer">
                      <SelectValue placeholder="Selecione a empresa" />
                    </SelectTrigger>
                    <SelectContent className="bg-[#0B1F3A] border-slate-700 text-white">
                      {isCliente ? (
                        empresas.map((emp) => (
                          <SelectItem key={emp.id} value={emp.id} className="text-xs">
                            {emp.nome_fantasia || emp.nome}
                          </SelectItem>
                        ))
                      ) : (
                        <SelectEmpresaOuGrupoItems
                          todasEntidades={todasEntidades}
                          empresas={empresas}
                        />
                      )}
                    </SelectContent>
                  </Select>
                ) : (
                  <span
                    className="text-xs font-bold text-white truncate block max-w-[190px]"
                    title={empresaNome}
                  >
                    {empresaNome}
                  </span>
                )}
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

      {/* Estado vazio para cliente sem dados no período */}
      {isCliente && !verificandoDados && !temDadosCliente && (
        <EstadoVazioClienteCard
          empresaNome={empresaNome}
          ano={selectedAno}
          mensagem="Nenhum balanço contábil, DRE ou lançamento registrado para esta empresa no exercício selecionado. Entre em contato com seu consultor Borlim para a importação e liberação dos demonstrativos."
        />
      )}

      {/* Grid de 5 Cards Grandes com Efeito Glassmorphism e Navegação Direta */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-[#0B1F3A] dark:text-slate-100">
              Módulos e Demonstrações Disponíveis
            </h2>
          </div>
          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            9 demonstrativos estruturados
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {atalhos.map((item, index) => {
            const Icon = item.icon
            const destino = item.rota(empresaAtivaId)

            return (
              <Card
                key={item.id}
                onClick={() => navigate(destino)}
                className={`group relative overflow-hidden bg-gradient-to-br ${item.gradient} border border-slate-700/60 rounded-2xl p-6 text-white cursor-pointer transition-all duration-300 hover:-translate-y-1.5 hover:shadow-2xl ${item.borderGlow} flex flex-col justify-between min-h-[265px] backdrop-blur-md`}
              >
                {/* Linha de acento no topo do card ao passar o mouse */}
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-sky-400/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                {/* Efeito sutil de vidro reflexivo */}
                <div className="absolute inset-0 bg-white/[0.04] opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

                {/* Topo do Card: Medalhão do Ícone + Badge */}
                <div className="space-y-4 relative z-10">
                  <div className="flex items-center justify-between">
                    <div
                      className={`w-13 h-13 rounded-2xl flex items-center justify-center border transition-all duration-300 group-hover:scale-108 shadow-lg shadow-black/20 ${item.iconBg}`}
                    >
                      <Icon className="w-6.5 h-6.5" />
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-mono text-slate-400 font-bold bg-white/5 border border-white/10 px-2 py-0.5 rounded-full">
                        0{index + 1}
                      </span>
                      <Badge
                        variant="secondary"
                        className="bg-white/10 text-white border-white/20 text-[10.5px] font-bold backdrop-blur-xs px-2 py-0.5"
                      >
                        {item.badge}
                      </Badge>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-extrabold text-white group-hover:text-sky-300 transition-colors flex items-center gap-1.5">
                      {item.titulo}
                    </h3>
                    <p className="text-xs font-semibold text-sky-200/90 mt-0.5">{item.subtitulo}</p>
                    <p className="text-xs text-slate-300/80 mt-2.5 leading-relaxed line-clamp-3">
                      {item.descricao}
                    </p>
                  </div>
                </div>

                {/* Base do Card: Metadados + Botão de Ação */}
                <div className="pt-4 mt-4 border-t border-white/10 flex items-center justify-between text-xs relative z-10">
                  <span className="text-[11px] text-slate-400 truncate max-w-[190px]">
                    {item.metricasTexto}
                  </span>

                  <div className="flex items-center gap-1.5 font-bold text-sky-300 group-hover:text-sky-200 transition-colors shrink-0 bg-white/5 px-2.5 py-1 rounded-lg border border-white/10 group-hover:border-sky-400/40">
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

      {/* Assinatura Oficial da Borlim Consultoria Empresarial */}
      <div className="pt-6 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
        <div className="flex items-center gap-3">
          <BorlimLogo size="sm" variant="auto" className="shadow-xs scale-90 origin-left" />
          <span className="font-semibold text-slate-700 dark:text-slate-300">
            Borlim Consultoria Empresarial
          </span>
          <span className="hidden md:inline text-slate-400">·</span>
          <span className="hidden md:inline">
            Inteligência Estratégica, Controladoria & Finanças
          </span>
        </div>
        <span className="text-[11px] text-slate-400">
          Acesso Exclusivo Cliente · Exercício {selectedAno}
        </span>
      </div>
    </div>
  )
}
