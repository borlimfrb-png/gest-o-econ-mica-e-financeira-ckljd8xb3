/**
 * Seção Comparativo de Regimes Tributários — Simulador de Regimes.
 * Compara a carga tributária em Simples Nacional, Lucro Presumido e Lucro Real
 * com créditos calculados a partir das entradas de compras do Centro de Custo
 * CC-098 (Matéria Prima) e cenário da Reforma Tributária (CBS/IBS).
 *
 * Dados carregados no padrão de ReformaTributaria.tsx (useFilter + useRealtime);
 * receita/lucro via calcularDreGerencialMatriz (DRE Gerencial). Empresa ativa
 * SEMPRE pelo FilterContext — nunca useParams().id.
 *
 * A parte visual (cards, matriz, gráfico) fica em comparativoRegimesBlocos.tsx.
 */

import { useState, useEffect, useMemo } from 'react'
import {
  AlertTriangle,
  Building2,
  CalendarClock,
  FileSpreadsheet,
  FileText,
  RefreshCw,
  Scale,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useFilter } from '@/contexts/FilterContext'
import { useToast } from '@/hooks/use-toast'
import { useRealtime } from '@/hooks/use-realtime'
import {
  centrosService,
  contasService,
  dreService,
  lancamentosService,
  planoContasService,
} from '@/services/financeService'
import type { ContaRecord, DreRecord, LancamentoRecord, PlanoContaRecord } from '@/types/finance'
import { calcularDre, consolidarDreAnual } from '@/lib/financeCalculations'
import { calcularDreGerencialMatriz } from '@/lib/dreGerencialCalculo'
import { gerarListaMeses } from '@/lib/dreGerencialTypes'
import {
  calcularSimuladorRegimes,
  resolverRegimeAtualId,
  FASES_TRANSICAO,
  ALIQUOTA_ICMS_PADRAO,
  ALIQUOTA_IPI_PADRAO,
} from '@/lib/simuladorRegimesCalculo'
import { AliquotasEstaduaisCard } from './AliquotasEstaduaisCard'
import {
  exportarSimuladorRegimesExcel,
  exportarSimuladorRegimesCsv,
} from '@/lib/simuladorRegimesExport'
import {
  AvisoSemDados,
  CardsRegimes,
  GraficoCargaRegimes,
  MatrizComparativa,
} from './comparativoRegimesBlocos'

export function SecaoComparativoRegimes() {
  const {
    empresas,
    todasEntidades,
    selectedEmpresaId,
    setSelectedEmpresaId,
    selectedEmpresa,
    isGrupoAtivo,
    grupoAtivo,
    selectedAno,
    setSelectedAno,
    anosDisponiveis,
    empresasIdsAtivas,
  } = useFilter()

  const { toast } = useToast()

  const [lancamentos, setLancamentos] = useState<LancamentoRecord[]>([])
  const [contas, setContas] = useState<ContaRecord[]>([])
  const [planoContas, setPlanoContas] = useState<PlanoContaRecord[]>([])
  const [dres, setDres] = useState<DreRecord[]>([])
  const [centros, setCentros] = useState<Array<{ id: string; codigo?: string; nome?: string }>>([])
  const [loading, setLoading] = useState<boolean>(false)
  const [anoTransicao, setAnoTransicao] = useState<number>(
    Math.max(selectedAno, FASES_TRANSICAO[0].ano),
  )
  // Alíquotas estaduais/federais configuráveis (ICMS / IPI), editáveis na tela
  const [aliquotaIcms, setAliquotaIcms] = useState<number>(ALIQUOTA_ICMS_PADRAO)
  const [aliquotaIpi, setAliquotaIpi] = useState<number>(ALIQUOTA_IPI_PADRAO)

  // Carregar dados no padrão de ReformaTributaria.tsx (empresa ativa ou grupo)
  const carregarDados = async () => {
    try {
      setLoading(true)
      let lancsPromise: Promise<LancamentoRecord[]>
      let contasPromise: Promise<ContaRecord[]>
      let planosPromise: Promise<PlanoContaRecord[]>
      let centrosPromise: Promise<any[]>
      let dresPromise: Promise<DreRecord[]>

      if (isGrupoAtivo && grupoAtivo && grupoAtivo.empresas && grupoAtivo.empresas.length > 0) {
        const empIds = new Set(grupoAtivo.empresas)
        const opts = { empresasIds: grupoAtivo.empresas }
        lancsPromise = lancamentosService
          .getAll({ expandRelations: true })
          .then((list) => list.filter((l) => empIds.has(l.empresa)))
        contasPromise = contasService.getAll(opts)
        planosPromise = planoContasService.getAll(opts)
        centrosPromise = centrosService.getAll()
        dresPromise = Promise.all(
          grupoAtivo.empresas.map((id) => dreService.getByEmpresa(id)),
        ).then((listas) => listas.flat())
      } else if (selectedEmpresaId && !selectedEmpresaId.startsWith('grupo-')) {
        lancsPromise = lancamentosService.getAll({
          empresaId: selectedEmpresaId,
          expandRelations: true,
        })
        contasPromise = contasService.getAll({ empresaId: selectedEmpresaId })
        planosPromise = planoContasService.getAll({ empresaId: selectedEmpresaId })
        centrosPromise = centrosService.getAll({ empresaId: selectedEmpresaId })
        dresPromise = dreService.getByEmpresa(selectedEmpresaId)
      } else {
        const empOpts =
          empresasIdsAtivas.length > 0 ? { empresasIds: empresasIdsAtivas } : undefined
        // Mesmo escopo de empresas das demais coleções — sem o filtro, lançamentos
        // de outras empresas entrariam na base de compras do simulador.
        lancsPromise = lancamentosService
          .getAll({ expandRelations: true })
          .then((list) =>
            empresasIdsAtivas.length > 0
              ? list.filter((l) => empresasIdsAtivas.includes(l.empresa))
              : list,
          )
        contasPromise = contasService.getAll(empOpts)
        planosPromise = planoContasService.getAll(empOpts)
        centrosPromise = centrosService.getAll()
        // Mesmo escopo de empresas dos lançamentos — a consolidação anual soma
        // todos os registros do ano; sem o filtro, empresas distintas se
        // misturariam na receita/lucro consolidados.
        dresPromise = dreService
          .getAll()
          .then((list) =>
            empresasIdsAtivas.length > 0
              ? list.filter((d) => empresasIdsAtivas.includes(d.empresa))
              : list,
          )
      }

      const [contasList, lancamentosList, planosList, centrosList, dresList] = await Promise.all([
        contasPromise,
        lancsPromise,
        planosPromise,
        centrosPromise,
        dresPromise,
      ])

      setContas(Array.from(new Map(contasList.map((i) => [i.id, i])).values()))
      setLancamentos(lancamentosList)
      setPlanoContas(Array.from(new Map(planosList.map((i) => [i.id, i])).values()))
      setCentros(centrosList.map((c: any) => ({ id: c.id, codigo: c.codigo, nome: c.nome })))
      setDres(dresList)
    } catch (err: any) {
      console.error('Erro ao carregar dados do Simulador de Regimes:', err)
      toast({
        variant: 'destructive',
        title: 'Erro ao carregar dados',
        description: 'Não foi possível carregar lançamentos e cadastros do simulador.',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    carregarDados()
    setAnoTransicao(Math.max(selectedAno, FASES_TRANSICAO[0].ano))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEmpresaId, isGrupoAtivo, grupoAtivo, selectedAno])

  useRealtime<LancamentoRecord>('lancamentos', () => carregarDados())
  useRealtime<ContaRecord>('contas', () => carregarDados())
  useRealtime<PlanoContaRecord>('plano_contas', () => carregarDados())
  useRealtime<DreRecord>('dre', () => carregarDados())

  // Receita e lucro pela COLEÇÃO `dre` do ano/empresa (mesma fonte mensal da
  // tela DRE Gerencial que o usuário enxerga) — consolidação anual via
  // consolidarDreAnual + calcularDre (mesmo mecanismo do comparativo 0.0.428).
  // Fallback: recalcular pela matriz gerencial só quando a coleção não tiver
  // registro do ano (empresa sem importação de DRE).
  const dreAnual = useMemo(() => consolidarDreAnual(dres, selectedAno), [dres, selectedAno])

  const baseDre = useMemo(() => {
    if (dreAnual) {
      const calc = calcularDre(dreAnual)
      const receita = dreAnual.receita_bruta || 0
      const lucro = calc.lucroLiquido
      if (receita > 0 || lucro !== 0) return { receita, lucro, fonte: 'dre' as const }
    }
    const meses = gerarListaMeses(selectedAno, 1, 12)
    const matriz = calcularDreGerencialMatriz(lancamentos, contas, meses, planoContas)
    return {
      receita: matriz.totalReceitasPeriodo,
      lucro: matriz.lucroPrejuizo.totalPeriodo,
      fonte: 'matriz' as const,
    }
  }, [dreAnual, lancamentos, contas, planoContas, selectedAno])

  const regimeAtualId = resolverRegimeAtualId(selectedEmpresa?.forma_tributacao)

  const resultado = useMemo(() => {
    return calcularSimuladorRegimes({
      ano: selectedAno,
      receitaBruta: baseDre.receita,
      lucroLiquido: baseDre.lucro,
      regimeAtualId,
      anoTransicao,
      aliquotaIcmsPercent: aliquotaIcms,
      aliquotaIpiPercent: aliquotaIpi,
      lancamentos,
      contas,
      planoContas,
      centros,
    })
  }, [
    selectedAno,
    baseDre.receita,
    baseDre.lucro,
    regimeAtualId,
    anoTransicao,
    aliquotaIcms,
    aliquotaIpi,
    lancamentos,
    contas,
    planoContas,
    centros,
  ])

  const nomeEntidade = isGrupoAtivo
    ? `Grupo Econômico: ${grupoAtivo?.nome || 'Consolidado'}`
    : selectedEmpresa?.nome || 'Empresa Selecionada'

  const handleExportarExcel = () => {
    try {
      exportarSimuladorRegimesExcel(resultado, {
        empresa: selectedEmpresa,
        isGrupo: Boolean(isGrupoAtivo),
        nomeGrupo: grupoAtivo?.nome,
      })
      toast({
        title: 'Planilha Excel gerada',
        description: 'Comparativo de regimes exportado com sucesso.',
      })
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Erro na exportação',
        description: err?.message || 'Falha ao gerar arquivo Excel.',
      })
    }
  }

  const handleExportarCsv = () => {
    try {
      exportarSimuladorRegimesCsv(resultado)
      toast({ title: 'Arquivo CSV gerado', description: 'CSV gerado no padrão brasileiro (;).' })
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Erro na exportação',
        description: err?.message || 'Falha ao gerar CSV.',
      })
    }
  }

  return (
    <div className="space-y-6">
      {/* Cabeçalho da seção */}
      <Card className="rounded-xl border-slate-200 bg-white shadow-xs">
        <CardContent className="p-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                <Scale className="w-4.5 h-4.5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-[#0B1F3A] flex items-center gap-2 flex-wrap">
                  Simulador de Regimes — Comparativo de Carga Tributária
                  <Badge className="bg-indigo-100 text-indigo-800 border-indigo-200 text-[10px] font-bold">
                    Reforma Tributária LC 214/2025
                  </Badge>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Créditos sobre as compras do Centro de Custo{' '}
                  <strong className="text-indigo-700">
                    {resultado.centroCustoCodigo}
                    {resultado.centroCustoNome ? ` — ${resultado.centroCustoNome}` : ''}
                  </strong>{' '}
                  · Receita base: DRE Gerencial · {nomeEntidade}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={carregarDados}
                disabled={loading}
                className="h-8 text-xs font-semibold border-slate-200 hover:bg-slate-50 text-slate-700 gap-1.5"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 text-slate-500 ${loading ? 'animate-spin' : ''}`}
                />
                Atualizar
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleExportarCsv}
                className="h-8 text-xs font-semibold border-slate-200 hover:bg-slate-50 text-slate-700 gap-1.5"
              >
                <FileText className="w-3.5 h-3.5 text-blue-600" />
                CSV
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleExportarExcel}
                className="h-8 text-xs font-semibold border-emerald-300 hover:bg-emerald-50 text-emerald-700 gap-1.5"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                Excel (.xlsx)
              </Button>
            </div>
          </div>

          {/* Seletores: empresa, exercício e ano da transição */}
          <div className="mt-4 pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-end gap-3 flex-wrap">
            <div className="flex-1 min-w-[240px]">
              <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-indigo-600" />
                Empresa Ativa ou Grupo
              </label>
              <Select value={selectedEmpresaId || undefined} onValueChange={setSelectedEmpresaId}>
                <SelectTrigger className="w-full text-xs font-medium bg-slate-50/70 border-slate-200">
                  <SelectValue placeholder="Selecione a Empresa ou Grupo" />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {empresas.map((emp) => (
                    <SelectItem key={emp.id} value={emp.id} className="text-xs">
                      {emp.nome}
                    </SelectItem>
                  ))}
                  {todasEntidades
                    .filter((e: any) => String(e.id).startsWith('grupo-'))
                    .map((g: any) => (
                      <SelectItem key={g.id} value={String(g.id)} className="text-xs font-semibold">
                        Grupo: {g.nome}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-32">
              <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1 block">
                Exercício
              </label>
              <Select value={String(selectedAno)} onValueChange={(v) => setSelectedAno(Number(v))}>
                <SelectTrigger className="w-full text-xs font-medium bg-slate-50 border-slate-200">
                  <SelectValue placeholder="Ano" />
                </SelectTrigger>
                <SelectContent>
                  {anosDisponiveis.map((ano) => (
                    <SelectItem key={ano} value={String(ano)} className="text-xs">
                      {ano}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-44">
              <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                <CalendarClock className="w-3.5 h-3.5 text-amber-600" />
                Fase da Transição
              </label>
              <Select
                value={String(anoTransicao)}
                onValueChange={(v) => setAnoTransicao(Number(v))}
              >
                <SelectTrigger className="w-full text-xs font-medium bg-slate-50 border-slate-200">
                  <SelectValue placeholder="Fase" />
                </SelectTrigger>
                <SelectContent>
                  {FASES_TRANSICAO.map((f) => (
                    <SelectItem key={f.ano} value={String(f.ano)} className="text-xs">
                      {f.ano} — {f.descricao}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2 flex-wrap text-xs pb-1">
              <Badge
                variant="outline"
                className="bg-amber-50 text-amber-900 border-amber-200 font-semibold"
              >
                Regime atual:{' '}
                {[
                  resultado.regimes.simples,
                  resultado.regimes.presumido,
                  resultado.regimes.real,
                ].find((r) => r.isRegimeAtual)?.nome || 'Não informado'}
              </Badge>
              <Badge
                variant="outline"
                className="bg-slate-50 text-slate-700 border-slate-300 text-xs"
              >
                Compras (entradas):{' '}
                {resultado.temDados
                  ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                      resultado.comprasEntradas,
                    )
                  : '—'}{' '}
                · {resultado.totalLancamentosCompras} lanç.
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Estado sem dados — nunca zero enganoso */}
      {!resultado.temDados && (
        <AvisoSemDados ano={selectedAno} centroCustoCodigo={resultado.centroCustoCodigo} />
      )}

      {/* Observações do motor */}
      {resultado.observacoes.length > 0 && (
        <div className="rounded-xl bg-slate-50 border border-slate-200 p-3.5 space-y-1.5">
          <div className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
            Observações do cálculo
          </div>
          <ul className="list-disc list-inside text-xs text-slate-600 space-y-0.5">
            {resultado.observacoes.map((o, i) => (
              <li key={i}>{o}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Alíquotas estaduais (ICMS) e IPI — editáveis, alimentam os créditos */}
      <AliquotasEstaduaisCard
        resultado={resultado}
        aliquotaIcms={aliquotaIcms}
        aliquotaIpi={aliquotaIpi}
        onChangeAliquotaIcms={setAliquotaIcms}
        onChangeAliquotaIpi={setAliquotaIpi}
      />

      {/* Cards por regime com badge "Menor carga" */}
      <CardsRegimes resultado={resultado} />

      {/* Tabela matricial comparativa */}
      <MatrizComparativa resultado={resultado} />

      {/* Gráfico de barras da carga por regime */}
      <GraficoCargaRegimes resultado={resultado} />
    </div>
  )
}

export default SecaoComparativoRegimes
