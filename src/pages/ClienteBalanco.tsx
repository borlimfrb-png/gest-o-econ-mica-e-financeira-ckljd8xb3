import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useFilter } from '@/contexts/FilterContext'
import {
  balancosService,
  lancamentosService,
  contasService,
  planoContasService,
} from '@/services/financeService'
import { consolidarBalancoAnual, calcularBalanco, formatCurrency } from '@/lib/financeCalculations'
import { calcularAnaliseRentabilidade } from '@/lib/analiseRentabilidadeCalculo'
import { gerarListaMeses } from '@/lib/dreGerencialTypes'
import type {
  BalancoRecord,
  LancamentoRecord,
  ContaRecord,
  PlanoContaRecord,
} from '@/types/finance'
import { DocumentPrintFooter } from '@/components/DocumentPrintFooter'
import { BorlimLogo } from '@/components/BorlimLogo'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Scale, ArrowLeft, Calendar, Printer, Building2, Info } from 'lucide-react'

interface LinhaBalanco {
  rotulo: string
  valor: number
  recuo?: boolean
}

function linhasAtivoCirculante(b: BalancoRecord): LinhaBalanco[] {
  return [
    { rotulo: 'Caixa e Equivalentes', valor: b.caixa_equivalentes || 0, recuo: true },
    { rotulo: 'Aplicações Financeiras', valor: b.aplicacoes_financeiras || 0, recuo: true },
    { rotulo: 'Contas a Receber', valor: b.contas_receber || 0, recuo: true },
    { rotulo: 'Estoques', valor: b.estoques || 0, recuo: true },
    { rotulo: 'Impostos a Recuperar', valor: b.impostos_recuperar || 0, recuo: true },
    { rotulo: 'Outros Ativos Circulantes', valor: b.outros_ativo_circulante || 0, recuo: true },
  ]
}

function linhasAtivoNaoCirculante(b: BalancoRecord): LinhaBalanco[] {
  return [
    { rotulo: 'Realizável a Longo Prazo', valor: b.realizavel_longo_prazo || 0, recuo: true },
    { rotulo: 'Investimentos', valor: b.investimentos || 0, recuo: true },
    { rotulo: 'Imobilizado', valor: b.imobilizado || 0, recuo: true },
    { rotulo: 'Intangível', valor: b.intangivel || 0, recuo: true },
  ]
}

function linhasPassivoCirculante(b: BalancoRecord): LinhaBalanco[] {
  return [
    { rotulo: 'Fornecedores', valor: b.fornecedores || 0, recuo: true },
    {
      rotulo: 'Empréstimos e Financiamentos (Curto Prazo)',
      valor: b.emprestimos_curto_prazo || 0,
      recuo: true,
    },
    { rotulo: 'Obrigações Trabalhistas', valor: b.obrigacoes_trabalhistas || 0, recuo: true },
    { rotulo: 'Obrigações Tributárias', valor: b.obrigacoes_tributarias || 0, recuo: true },
    {
      rotulo: 'Outras Obrigações Circulantes',
      valor: b.outros_passivo_circulante || 0,
      recuo: true,
    },
  ]
}

function linhasPassivoNaoCirculante(b: BalancoRecord): LinhaBalanco[] {
  return [
    {
      rotulo: 'Empréstimos e Financiamentos (Longo Prazo)',
      valor: b.emprestimos_longo_prazo || 0,
      recuo: true,
    },
    {
      rotulo: 'Outras Obrigações a Longo Prazo',
      valor: b.outras_obrigacoes_longo_prazo || 0,
      recuo: true,
    },
  ]
}

function linhasPatrimonioLiquido(b: BalancoRecord): LinhaBalanco[] {
  return [
    { rotulo: 'Capital Social', valor: b.capital_social || 0, recuo: true },
    { rotulo: 'Reservas de Lucros', valor: b.reservas_lucros || 0, recuo: true },
    { rotulo: 'Lucros Acumulados', valor: b.lucros_acumulados || 0, recuo: true },
  ]
}

function formatPercentVariacao(valor: number): string {
  if (!Number.isFinite(valor)) return '—'
  return `${valor >= 0 ? '+' : ''}${valor.toFixed(1)}%`
}

interface SecaoBalanco {
  titulo: string
  linhas: LinhaBalanco[]
  total: number
}

function TabelaSecao({ secao }: { secao: SecaoBalanco }) {
  return (
    <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-xs print:border-slate-300">
      <CardHeader className="py-3 px-4 sm:px-6 border-b border-slate-100 dark:border-slate-800">
        <CardTitle className="text-sm font-bold text-[#0B1F3A] dark:text-slate-100">
          {secao.titulo}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-[11px] font-semibold text-slate-700 dark:text-slate-200 uppercase tracking-wider print:bg-slate-100 print:text-black">
                <th className="py-3 px-4 sm:px-6 text-left">Conta</th>
                <th className="py-3 px-4 text-right">Valor (R$)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 print:divide-slate-200">
              {secao.linhas.map((l) => (
                <tr
                  key={l.rotulo}
                  className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                >
                  <td
                    className={`py-2.5 px-4 sm:px-6 font-medium text-slate-800 dark:text-slate-200 print:text-black ${
                      l.recuo ? 'pl-8 sm:pl-10' : ''
                    }`}
                  >
                    {l.rotulo}
                  </td>
                  <td className="py-2.5 px-4 text-right font-medium text-slate-800 dark:text-slate-200 tabular-nums print:text-black">
                    {formatCurrency(l.valor)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-slate-100/90 dark:bg-slate-800/90 border-t-2 border-slate-300 dark:border-slate-700 font-bold text-[11.5px] text-[#0B1F3A] dark:text-slate-100 print:bg-slate-200 print:text-black">
                <td className="py-3 px-4 sm:px-6 uppercase tracking-wider font-extrabold">
                  Total — {secao.titulo}
                </td>
                <td className="py-3 px-4 text-right tabular-nums font-extrabold text-[#0B1F3A] dark:text-slate-100 print:text-black">
                  {formatCurrency(secao.total)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}

export default function ClienteBalanco() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { selectedEmpresaId, selectedEmpresa, selectedAno, empresasIdsAtivas } = useFilter()

  const [loading, setLoading] = useState(true)
  const [balancos, setBalancos] = useState<BalancoRecord[]>([])
  const [lancamentos, setLancamentos] = useState<LancamentoRecord[]>([])
  const [contas, setContas] = useState<ContaRecord[]>([])
  const [planoContas, setPlanoContas] = useState<PlanoContaRecord[]>([])

  const anoAtivo = selectedAno || new Date().getFullYear()

  const empresaIdAlvo =
    selectedEmpresaId && !selectedEmpresaId.startsWith('grupo-')
      ? selectedEmpresaId
      : selectedEmpresa?.id || (empresasIdsAtivas.length > 0 ? empresasIdsAtivas[0] : null)

  const nomeEntidade = selectedEmpresa?.nome || selectedEmpresa?.nome_fantasia || 'Minha Empresa'
  const isCliente = user?.role === 'cliente'

  useEffect(() => {
    let cancelado = false

    const carregar = async () => {
      if (!empresaIdAlvo) {
        if (!cancelado) setLoading(false)
        return
      }

      setLoading(true)
      try {
        const [bList, lList, cList, pList] = await Promise.all([
          balancosService.getByEmpresa(empresaIdAlvo).catch(() => [] as BalancoRecord[]),
          lancamentosService
            .getAll({ empresaId: empresaIdAlvo })
            .catch(() => [] as LancamentoRecord[]),
          contasService.getAll().catch(() => [] as ContaRecord[]),
          planoContasService.getAll().catch(() => [] as PlanoContaRecord[]),
        ])

        if (!cancelado) {
          setBalancos(bList)
          setLancamentos(lList)
          setContas(cList)
          setPlanoContas(pList)
        }
      } finally {
        if (!cancelado) setLoading(false)
      }
    }

    carregar()

    return () => {
      cancelado = true
    }
  }, [empresaIdAlvo])

  const balancoDoAno = useMemo(
    () => consolidarBalancoAnual(balancos, anoAtivo),
    [balancos, anoAtivo],
  )

  const balancoAnoAnterior = useMemo(
    () => consolidarBalancoAnual(balancos, anoAtivo - 1),
    [balancos, anoAtivo - 1],
  )

  const calc = useMemo(() => calcularBalanco(balancoDoAno), [balancoDoAno])
  const calcAnterior = useMemo(() => calcularBalanco(balancoAnoAnterior), [balancoAnoAnterior])

  // Indica se há movimentação financeira no exercício (usado apenas para mensagem
  // de vazio mais precisa — a tela nunca fica em branco: mostra sempre o quadro).
  const temMovimentacaoAno = useMemo(() => {
    if (balancoDoAno) return true
    if (lancamentos.length === 0) return false
    const meses = gerarListaMeses(anoAtivo, 1, 12)
    const rent = calcularAnaliseRentabilidade(lancamentos, contas, meses, planoContas)
    return (
      rent.faturamentoTotal > 0 ||
      rent.despesasFixasTotal > 0 ||
      rent.despesasVariaveisTotal > 0 ||
      rent.despesasFinanceirasTotal > 0 ||
      rent.lucroTotal !== 0
    )
  }, [balancoDoAno, lancamentos, contas, planoContas, anoAtivo])

  const secoesAtivo: SecaoBalanco[] = useMemo(() => {
    if (!balancoDoAno) return []
    return [
      {
        titulo: 'Ativo Circulante',
        linhas: linhasAtivoCirculante(balancoDoAno),
        total: calc.ativoCirculante,
      },
      {
        titulo: 'Ativo Não Circulante',
        linhas: linhasAtivoNaoCirculante(balancoDoAno),
        total: calc.ativoNaoCirculante,
      },
    ]
  }, [balancoDoAno, calc])

  const secoesPassivo: SecaoBalanco[] = useMemo(() => {
    if (!balancoDoAno) return []
    return [
      {
        titulo: 'Passivo Circulante',
        linhas: linhasPassivoCirculante(balancoDoAno),
        total: calc.passivoCirculante,
      },
      {
        titulo: 'Passivo Não Circulante',
        linhas: linhasPassivoNaoCirculante(balancoDoAno),
        total: calc.passivoNaoCirculante,
      },
      {
        titulo: 'Patrimônio Líquido',
        linhas: linhasPatrimonioLiquido(balancoDoAno),
        total: calc.patrimonioLiquido,
      },
    ]
  }, [balancoDoAno, calc])

  const variacao = (atual: number, anterior: number): number => {
    if (!anterior || !Number.isFinite(anterior) || anterior === 0) return NaN
    return ((atual - anterior) / Math.abs(anterior)) * 100
  }

  return (
    <div className="space-y-6 pb-8 print:space-y-4">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/analise-economica-financeira')}
            className="hidden sm:inline-flex shrink-0 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 cursor-pointer print:hidden"
            aria-label="Voltar ao hub"
            title="Voltar ao hub"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-2.5">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-sky-500/25 to-blue-600/20 border border-sky-400/40 flex items-center justify-center text-sky-600 dark:text-sky-300 shrink-0">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-[#0B1F3A] dark:text-slate-100">
                Balanço Patrimonial
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                Demonstração contábil — Ativo, Passivo e Patrimônio Líquido
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 print:hidden">
          <Badge
            variant="outline"
            className="gap-1.5 text-[11px] font-semibold bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700"
          >
            <Building2 className="w-3.5 h-3.5 text-slate-400" />
            {nomeEntidade}
          </Badge>
          <Badge
            variant="outline"
            className="gap-1.5 text-[11px] font-semibold bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700"
          >
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            Exercício {anoAtivo}
          </Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.print()}
            className="gap-1.5 cursor-pointer print:hidden"
          >
            <Printer className="w-3.5 h-3.5" />
            Imprimir
          </Button>
        </div>
      </div>

      {/* Conteúdo principal */}
      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <Skeleton className="h-80 rounded-2xl" />
          <Skeleton className="h-80 rounded-2xl" />
        </div>
      ) : !balancoDoAno ? (
        <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-xs">
          <CardContent className="py-16 flex flex-col items-center justify-center gap-3 text-center">
            <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
              <Scale className="w-7 h-7 text-slate-400" />
            </div>
            <h2 className="text-base font-bold text-[#0B1F3A] dark:text-slate-100">
              Nenhum balanço registrado para {nomeEntidade} no exercício {anoAtivo}
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md">
              {temMovimentacaoAno
                ? 'A posição patrimonial ainda não foi importada para o exercício selecionado, embora exista movimentação financeira no período. Entre em contato com seu consultor Borlim para a importação do demonstrativo.'
                : 'A posição patrimonial desta empresa ainda não foi importada ou lançada para o exercício selecionado. Entre em contato com seu consultor Borlim para a liberação dos demonstrativos contábeis.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Dupla coluna Ativo × Passivo + PL */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
            <div className="space-y-5">
              {secoesAtivo.map((s) => (
                <TabelaSecao key={s.titulo} secao={s} />
              ))}
              <Card className="bg-gradient-to-r from-[#0B1F3A] via-[#0E284E] to-[#143A6E] border-0 rounded-2xl text-white">
                <CardContent className="py-4 px-5 flex items-center justify-between">
                  <span className="text-sm font-bold uppercase tracking-wider">Total do Ativo</span>
                  <span className="text-lg font-black tabular-nums">
                    {formatCurrency(calc.ativoTotal)}
                  </span>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-5">
              {secoesPassivo.map((s) => (
                <TabelaSecao key={s.titulo} secao={s} />
              ))}
              <Card className="bg-gradient-to-r from-[#0B1F3A] via-[#0E284E] to-[#143A6E] border-0 rounded-2xl text-white">
                <CardContent className="py-4 px-5 flex items-center justify-between">
                  <span className="text-sm font-bold uppercase tracking-wider">
                    Total (Passivo + PL)
                  </span>
                  <span className="text-lg font-black tabular-nums">
                    {formatCurrency(calc.passivoEPL)}
                  </span>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Comparativo com o exercício anterior */}
          {balancoAnoAnterior && (
            <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-xs print:border-slate-300">
              <CardHeader className="py-3 px-4 sm:px-6 border-b border-slate-100 dark:border-slate-800">
                <CardTitle className="text-sm font-bold text-[#0B1F3A] dark:text-slate-100">
                  Comparativo com o exercício {anoAtivo - 1}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-[11px] font-semibold text-slate-700 dark:text-slate-200 uppercase tracking-wider print:bg-slate-100 print:text-black">
                        <th className="py-3 px-4 sm:px-6 text-left">Indicador</th>
                        <th className="py-3 px-4 text-right">{anoAtivo}</th>
                        <th className="py-3 px-4 text-right">{anoAtivo - 1}</th>
                        <th className="py-3 px-4 text-right">Variação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 print:divide-slate-200">
                      {[
                        {
                          rotulo: 'Ativo Circulante',
                          atual: calc.ativoCirculante,
                          anterior: calcAnterior.ativoCirculante,
                        },
                        {
                          rotulo: 'Ativo Não Circulante',
                          atual: calc.ativoNaoCirculante,
                          anterior: calcAnterior.ativoNaoCirculante,
                        },
                        {
                          rotulo: 'Total do Ativo',
                          atual: calc.ativoTotal,
                          anterior: calcAnterior.ativoTotal,
                        },
                        {
                          rotulo: 'Passivo Circulante',
                          atual: calc.passivoCirculante,
                          anterior: calcAnterior.passivoCirculante,
                        },
                        {
                          rotulo: 'Passivo Não Circulante',
                          atual: calc.passivoNaoCirculante,
                          anterior: calcAnterior.passivoNaoCirculante,
                        },
                        {
                          rotulo: 'Patrimônio Líquido',
                          atual: calc.patrimonioLiquido,
                          anterior: calcAnterior.patrimonioLiquido,
                        },
                      ].map((item) => {
                        const v = variacao(item.atual, item.anterior)
                        return (
                          <tr
                            key={item.rotulo}
                            className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                          >
                            <td className="py-2.5 px-4 sm:px-6 font-semibold text-[#0B1F3A] dark:text-slate-100 print:text-black">
                              {item.rotulo}
                            </td>
                            <td className="py-2.5 px-4 text-right tabular-nums text-slate-800 dark:text-slate-200 print:text-black">
                              {formatCurrency(item.atual)}
                            </td>
                            <td className="py-2.5 px-4 text-right tabular-nums text-slate-500 dark:text-slate-400 print:text-slate-600">
                              {formatCurrency(item.anterior)}
                            </td>
                            <td className="py-2.5 px-4 text-right tabular-nums">
                              <span
                                className={`inline-block font-bold px-2 py-0.5 rounded-full text-[11px] ${
                                  Number.isFinite(v)
                                    ? v >= 0
                                      ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                                      : 'bg-red-500/15 text-red-700 dark:text-red-300'
                                    : 'bg-slate-500/15 text-slate-700 dark:text-slate-300'
                                }`}
                              >
                                {formatPercentVariacao(v)}
                              </span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Assinatura Borlim no final da página */}
      <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400 print:hidden">
        <div className="flex items-center gap-2.5">
          <BorlimLogo size="sm" variant="auto" showSubtitle={false} />
          <span className="font-semibold text-slate-700 dark:text-slate-300">
            Borlim Consultoria Empresarial
          </span>
          <span className="hidden md:inline text-slate-400">·</span>
          <span className="hidden md:inline">
            Inteligência Estratégica, Controladoria & Finanças
          </span>
        </div>
        <span className="text-[11px] text-slate-400">
          Demonstrativo Contábil · Exercício {anoAtivo}
          {isCliente ? ' · Acesso Cliente' : ''}
        </span>
      </div>

      <DocumentPrintFooter documentTitle="Balanço Patrimonial" />
    </div>
  )
}
