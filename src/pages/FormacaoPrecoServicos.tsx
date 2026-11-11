import { useCallback, useEffect, useMemo, useState } from 'react'
import { useFilter } from '@/contexts/FilterContext'
import { useToast } from '@/hooks/use-toast'
import { useRealtime } from '@/hooks/use-realtime'
import {
  calcularPrecoServico,
  calcularHoraTecnica,
  type ParametrosFormacaoServicos,
  type ComposicaoPrecoServico,
} from '@/lib/formacaoPrecoServicosCalculo'
import {
  formacaoPrecoServicosService,
  type FormacaoServicoParametrosRecord,
  type FormacaoServicoRecord,
} from '@/services/formacaoPrecoServicosService'
import {
  exportarFormacaoServicosExcel,
  exportarFormacaoServicosCsv,
  type DadosExportFormacaoServicos,
} from '@/lib/formacaoPrecoServicosExport'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { FileSpreadsheet, FileText, RefreshCw, Wrench } from 'lucide-react'
import AbaParametrosServicos from '@/components/formacaoPrecoServicos/AbaParametrosServicos'
import AbaServicosCadastrados from '@/components/formacaoPrecoServicos/AbaServicosCadastrados'
import SimuladorServicosPrecos from '@/components/formacaoPrecoServicos/SimuladorServicosPrecos'
import AbaResumoServicos from '@/components/formacaoPrecoServicos/AbaResumoServicos'
import AbaRelatoriosServicos from '@/components/formacaoPrecoServicos/AbaRelatoriosServicos'
import AbaCenariosServicos from '@/components/formacaoPrecoServicos/AbaCenariosServicos'

const PARAMETROS_PLACEHOLDER: FormacaoServicoParametrosRecord = {
  id: '',
  empresa: '',
  custos_fixos: [],
  quantidade_profissionais: 0,
  horas_produtivas_profissional: 0,
  fator_ociosidade: 0,
  percentual_impostos: 0,
  percentual_comissao: 0,
  percentual_margem: 0,
  regime_tributario: '',
  observacoes: '',
}

export default function FormacaoPrecoServicos() {
  const { toast } = useToast()
  const { selectedEmpresaId, selectedEmpresa, selectedAno } = useFilter()

  const [parametros, setParametros] = useState<FormacaoServicoParametrosRecord | null>(null)
  const [servicos, setServicos] = useState<FormacaoServicoRecord[]>([])
  const [loading, setLoading] = useState(true)

  const carregarDados = useCallback(async () => {
    if (!selectedEmpresaId) {
      setParametros(null)
      setServicos([])
      setLoading(false)
      return
    }
    try {
      setLoading(true)
      const [paramRec, servicosList] = await Promise.all([
        formacaoPrecoServicosService.getParametros(selectedEmpresaId),
        formacaoPrecoServicosService.getAllServicos(selectedEmpresaId),
      ])
      setParametros(paramRec)
      setServicos(servicosList)
    } catch (err) {
      console.error('Erro ao carregar dados de formação de preço de serviços:', err)
      toast({
        variant: 'destructive',
        title: 'Erro ao carregar',
        description: 'Não foi possível carregar os parâmetros e serviços.',
      })
    } finally {
      setLoading(false)
    }
  }, [selectedEmpresaId, toast])

  useEffect(() => {
    carregarDados()
  }, [carregarDados])

  useRealtime('formacao_servicos_parametros', () => carregarDados())
  useRealtime('formacao_servicos', () => carregarDados())

  // ---- Parâmetros de cálculo normalizados (motor snake_case) ----
  const parametrosCalculo: ParametrosFormacaoServicos = useMemo(
    () => ({
      custos_fixos: (parametros?.custos_fixos || []).map((c) => ({
        nome: c?.nome || '',
        valor: Number(c?.valor) || 0,
      })),
      quantidade_profissionais: Number(parametros?.quantidade_profissionais) || 0,
      horas_produtivas_profissional: Number(parametros?.horas_produtivas_profissional) || 0,
      fator_ociosidade: Number(parametros?.fator_ociosidade) || 0,
      percentual_impostos: Number(parametros?.percentual_impostos) || 0,
      percentual_comissao: Number(parametros?.percentual_comissao) || 0,
      percentual_margem: Number(parametros?.percentual_margem) || 0,
      regime_tributario: parametros?.regime_tributario || '',
    }),
    [parametros],
  )

  const resultadoParametros = useMemo(
    () => calcularHoraTecnica(parametrosCalculo),
    [parametrosCalculo],
  )

  const servicosCalculados = useMemo(
    () =>
      servicos.map((servico) => ({
        servico,
        composicao: calcularPrecoServico(servico, parametrosCalculo) as ComposicaoPrecoServico,
      })),
    [servicos, parametrosCalculo],
  )

  const dadosResumo = useMemo(
    () => servicosCalculados.map(({ servico, composicao }) => ({ servico, composicao })),
    [servicosCalculados],
  )

  const montarDadosExport = useCallback(
    (): DadosExportFormacaoServicos => ({
      nomeEmpresa: selectedEmpresa?.nome || 'Empresa',
      exercicioAno: selectedAno,
      custoHoraTecnica: resultadoParametros.custoHoraTecnica,
      custosFixosMensais: resultadoParametros.custosFixosMensais,
      horasProdutivasMes: resultadoParametros.horasProdutivasMes,
      impostosPct: parametrosCalculo.percentual_impostos,
      comissaoPct: parametrosCalculo.percentual_comissao,
      margemPct: parametrosCalculo.percentual_margem,
      linhas: dadosResumo,
    }),
    [selectedEmpresa, selectedAno, resultadoParametros, parametrosCalculo, dadosResumo],
  )

  const handleExportExcel = () => {
    if (!selectedEmpresaId || servicos.length === 0) {
      toast({
        variant: 'destructive',
        title: 'Nada para exportar',
        description: 'Cadastre ao menos um serviço com preço calculado antes de exportar.',
      })
      return
    }
    exportarFormacaoServicosExcel(montarDadosExport())
    toast({
      title: 'Excel gerado',
      description: 'O arquivo foi baixado com o resumo da formação de preço de serviços.',
    })
  }

  const handleExportCSV = () => {
    if (!selectedEmpresaId || servicos.length === 0) {
      toast({
        variant: 'destructive',
        title: 'Nada para exportar',
        description: 'Cadastre ao menos um serviço com preço calculado antes de exportar.',
      })
      return
    }
    exportarFormacaoServicosCsv(montarDadosExport())
    toast({ title: 'CSV gerado', description: 'O arquivo foi baixado com os dados do resumo.' })
  }

  if (!selectedEmpresaId) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 p-8 text-center">
        <Wrench className="h-10 w-10 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Selecione uma empresa no seletor do cabeçalho para usar a Formação de Preço de Serviços.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      {/* Cabeçalho da tela */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
            <Wrench className="h-5 w-5 text-primary" />
            Formação de Preço de Serviços
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Hora técnica, mark-up divisor e ponto de equilíbrio para precificação de serviços e
            consultorias.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportExcel}
            disabled={loading || servicos.length === 0}
          >
            <FileSpreadsheet className="mr-2 h-4 w-4" />
            Exportar Excel
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCSV}
            disabled={loading || servicos.length === 0}
          >
            <FileText className="mr-2 h-4 w-4" />
            Exportar CSV
          </Button>
          <Button variant="ghost" size="sm" onClick={carregarDados} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>
      </div>

      {/* Faixa de contexto: hora técnica + alíquotas */}
      {loading ? (
        <div className="grid gap-4 md:grid-cols-4">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Custo/Hora Técnica</CardDescription>
              <CardTitle className="text-2xl tabular-nums">
                {resultadoParametros.custoHoraTecnica > 0
                  ? resultadoParametros.custoHoraTecnica.toLocaleString('pt-BR', {
                      style: 'currency',
                      currency: 'BRL',
                    })
                  : '—'}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">
              {resultadoParametros.custosFixosMensais.toLocaleString('pt-BR', {
                style: 'currency',
                currency: 'BRL',
              })}{' '}
              de custos fixos ÷ {resultadoParametros.horasProdutivasMes.toLocaleString('pt-BR')} h
              produtivas/mês
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Horas produtivas/mês</CardDescription>
              <CardTitle className="text-2xl tabular-nums">
                {resultadoParametros.horasProdutivasMes.toLocaleString('pt-BR')}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">
              {parametrosCalculo.quantidade_profissionais} profissional(is) ×{' '}
              {parametrosCalculo.horas_produtivas_profissional.toLocaleString('pt-BR')} h ×
              ociosidade de {parametrosCalculo.fator_ociosidade.toLocaleString('pt-BR')}%
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Impostos + comissão</CardDescription>
              <CardTitle className="text-2xl tabular-nums">
                {(
                  parametrosCalculo.percentual_impostos + parametrosCalculo.percentual_comissao
                ).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}
                %
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">
              Impostos {parametrosCalculo.percentual_impostos.toLocaleString('pt-BR')}% · Comissão{' '}
              {parametrosCalculo.percentual_comissao.toLocaleString('pt-BR')}%
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Margem alvo</CardDescription>
              <CardTitle className="text-2xl tabular-nums">
                {parametrosCalculo.percentual_margem.toLocaleString('pt-BR', {
                  maximumFractionDigits: 2,
                })}
                %
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">
              Mark-up divisor:{' '}
              {resultadoParametros.custoHoraTecnica >= 0 &&
              100 -
                (parametrosCalculo.percentual_impostos +
                  parametrosCalculo.percentual_comissao +
                  parametrosCalculo.percentual_margem) >
                0
                ? `1 ÷ ${(
                    1 /
                    (1 -
                      (parametrosCalculo.percentual_impostos +
                        parametrosCalculo.percentual_comissao +
                        parametrosCalculo.percentual_margem) /
                        100)
                  ).toFixed(4)}`
                : '—'}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Abas principais */}
      <Tabs defaultValue="parametros" className="w-full">
        <TabsList className="flex w-full flex-wrap gap-1 md:w-auto">
          <TabsTrigger value="parametros">Parâmetros</TabsTrigger>
          <TabsTrigger value="servicos">Serviços</TabsTrigger>
          <TabsTrigger value="simulador">Simulador</TabsTrigger>
          <TabsTrigger value="resumo">Resumo</TabsTrigger>
          <TabsTrigger value="relatorios">Relatórios</TabsTrigger>
          <TabsTrigger value="cenarios">Cenários</TabsTrigger>
        </TabsList>

        <TabsContent value="parametros" className="mt-4">
          <AbaParametrosServicos
            parametros={parametros ?? PARAMETROS_PLACEHOLDER}
            empresaId={selectedEmpresaId}
            recalculo={resultadoParametros}
          />
        </TabsContent>

        <TabsContent value="servicos" className="mt-4">
          <AbaServicosCadastrados
            servicos={servicos}
            empresaId={selectedEmpresaId}
            recarregar={carregarDados}
            custoHoraTecnica={resultadoParametros.custoHoraTecnica}
            parametrosCalculo={parametrosCalculo}
          />
        </TabsContent>

        <TabsContent value="simulador" className="mt-4">
          <SimuladorServicosPrecos servicos={servicos} parametros={parametrosCalculo} />
        </TabsContent>

        <TabsContent value="resumo" className="mt-4">
          <AbaResumoServicos
            dadosResumo={dadosResumo}
            resultadoParametros={resultadoParametros}
            parametrosCalculo={parametrosCalculo}
            onExportExcel={handleExportExcel}
            onExportCsv={handleExportCSV}
            exportDesabilitado={loading || servicos.length === 0}
            nomeEmpresa={selectedEmpresa?.nome || 'Empresa'}
            exercicioAno={selectedAno}
          />
        </TabsContent>

        <TabsContent value="relatorios" className="mt-4">
          <AbaRelatoriosServicos
            dadosResumo={dadosResumo}
            parametros={parametrosCalculo}
            nomeEmpresa={selectedEmpresa?.nome || 'Empresa'}
            exercicioAno={selectedAno}
          />
        </TabsContent>

        <TabsContent value="cenarios" className="mt-4">
          <AbaCenariosServicos
            servicos={servicos}
            parametros={parametrosCalculo}
            empresaId={selectedEmpresaId}
            nomeEmpresa={selectedEmpresa?.nome || 'Empresa'}
            exercicioAno={selectedAno}
          />
        </TabsContent>
      </Tabs>

      {servicos.length === 0 && !loading && (
        <p className="text-center text-xs text-muted-foreground">
          <Badge variant="outline" className="mr-2">
            Dica
          </Badge>
          Cadastre os parâmetros e os serviços nas abas ao lado para o Simulador e o Resumo
          calcularem preços.
        </p>
      )}
    </div>
  )
}
