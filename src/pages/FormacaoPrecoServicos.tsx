import { useCallback, useEffect, useMemo, useState } from 'react'
import { useFilter } from '@/contexts/FilterContext'
import { useToast } from '@/hooks/use-toast'
import { useRealtime } from '@/hooks/use-realtime'
import {
  calculadoraServicos,
  type ParametrosFormacaoServicos,
  type ServicoFormacao,
} from '@/lib/formacaoPrecoServicosCalculo'
import {
  formacaoServicosParametrosService,
  formacaoServicosService,
  type FormacaoServicosParametrosRecord,
  type FormacaoServicosRecord,
} from '@/services/formacaoPrecoServicosService'
import {
  exportarFormacaoPrecoServicosExcel,
  exportarFormacaoPrecoServicosCSV,
} from '@/lib/formacaoPrecoServicosExport'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { FileSpreadsheet, FileText, RefreshCw, Wrench } from 'lucide-react'
import AbaParametrosServicos from '@/components/formacaoPrecoServicos/AbaParametrosServicos'
import AbaServicosCadastrados from '@/components/formacaoPrecoServicos/AbaServicosCadastrados'
import { SimuladorServicosPrecos } from '@/components/formacaoPrecoServicos/SimuladorServicosPrecos'
import AbaResumoServicos from '@/components/formacaoPrecoServicos/AbaResumoServicos'

const PARAMETROS_PLACEHOLDER: FormacaoServicosParametrosRecord = {
  id: '',
  empresa: '',
  user: '',
  custosFixos: [],
  profissionais: [],
  impostosPercentual: 0,
  comissaoPercentual: 0,
  margemAlvoPercentual: 0,
  created: '',
  updated: '',
  collectionId: '',
  collectionName: 'formacao_servicos_parametros',
}

export default function FormacaoPrecoServicos() {
  const { toast } = useToast()
  const { selectedEmpresaId, selectedEmpresa, selectedAno } = useFilter()

  const [parametros, setParametros] = useState<FormacaoServicosParametrosRecord | null>(null)
  const [servicos, setServicos] = useState<FormacaoServicosRecord[]>([])
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
        formacaoServicosParametrosService.getByEmpresa(selectedEmpresaId),
        formacaoServicosService.getAll(selectedEmpresaId),
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

  useRealtime<FormacaoServicosParametrosRecord>('formacao_servicos_parametros', () =>
    carregarDados(),
  )
  useRealtime<FormacaoServicosRecord>('formacao_servicos', () => carregarDados())

  // ---- Cálculos centralizados (hora técnica, mark-up, ponto de equilíbrio) ----
  const parametrosCalculo: ParametrosFormacaoServicos = useMemo(() => {
    if (!parametros) {
      return {
        custosFixos: [],
        profissionais: [],
        impostosPercentual: 0,
        comissaoPercentual: 0,
        margemAlvoPercentual: 0,
      }
    }
    return {
      custosFixos: parametros.custosFixos || [],
      profissionais: parametros.profissionais || [],
      impostosPercentual: parametros.impostosPercentual || 0,
      comissaoPercentual: parametros.comissaoPercentual || 0,
      margemAlvoPercentual: parametros.margemAlvoPercentual || 0,
    }
  }, [parametros])

  const resultadoParametros = useMemo(
    () => calculadoraServicos.calcularParametros(parametrosCalculo),
    [parametrosCalculo],
  )

  const servicosCalculados = useMemo(
    () =>
      servicos.map((s) => ({
        record: s,
        resultado: calculadoraServicos.calcularServico(s, resultadoParametros),
      })),
    [servicos, resultadoParametros],
  )

  const dadosResumo = useMemo(
    () => servicosCalculados.map(({ record, resultado }) => ({ record, resultado })),
    [servicosCalculados],
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
    exportarFormacaoPrecoServicosExcel(dadosResumo, resultadoParametros, {
      nomeEmpresa: selectedEmpresa?.nome || 'Empresa',
      exercicio: selectedAno,
    })
    toast({
      title: 'Excel gerado',
      description: 'O arquivo foi baixado com os dados do simulador e do resumo.',
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
    exportarFormacaoPrecoServicosCSV(dadosResumo, resultadoParametros, {
      nomeEmpresa: selectedEmpresa?.nome || 'Empresa',
      exercicio: selectedAno,
    })
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
              <CardTitle className="text-2xl">
                {resultadoParametros.custoHoraTecnica > 0
                  ? resultadoParametros.custoHoraTecnica.toLocaleString('pt-BR', {
                      style: 'currency',
                      currency: 'BRL',
                    })
                  : '—'}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">
              {resultadoParametros.totalCustosFixos.toLocaleString('pt-BR', {
                style: 'currency',
                currency: 'BRL',
              })}{' '}
              de custos fixos ÷ {resultadoParametros.horasProdutivasTotal.toLocaleString('pt-BR')} h
              produtivas/mês
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Horas produtivas/mês</CardDescription>
              <CardTitle className="text-2xl">
                {resultadoParametros.horasProdutivasTotal.toLocaleString('pt-BR')}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">
              {parametrosCalculo.profissionais?.length ?? 0} profissional(is) × horas × fator de
              ocupação
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Impostos + comissão</CardDescription>
              <CardTitle className="text-2xl">
                {(
                  (parametrosCalculo.impostosPercentual || 0) +
                  (parametrosCalculo.comissaoPercentual || 0)
                ).toLocaleString('pt-BR', {
                  maximumFractionDigits: 2,
                })}
                %
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">
              Impostos {(parametrosCalculo.impostosPercentual || 0).toLocaleString('pt-BR')}% ·
              Comissão {(parametrosCalculo.comissaoPercentual || 0).toLocaleString('pt-BR')}%
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Margem alvo</CardDescription>
              <CardTitle className="text-2xl">
                {(parametrosCalculo.margemAlvoPercentual || 0).toLocaleString('pt-BR', {
                  maximumFractionDigits: 2,
                })}
                %
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">
              Mark-up divisor:{' '}
              {resultadoParametros.markupDivisorAlvo > 0
                ? `1 ÷ ${resultadoParametros.markupDivisorAlvo.toFixed(4)}`
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
          />
        </TabsContent>

        <TabsContent value="simulador" className="mt-4">
          <SimuladorServicosPrecos
            servicos={servicos}
            servicosCalculados={servicosCalculados}
            parametrosCalculo={parametrosCalculo}
            loading={loading}
          />
        </TabsContent>

        <TabsContent value="resumo" className="mt-4">
          <AbaResumoServicos
            dadosResumo={dadosResumo}
            parametrosCalculo={parametrosCalculo}
            resultadoParametros={resultadoParametros}
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
