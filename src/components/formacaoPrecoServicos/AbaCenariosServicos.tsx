import { useCallback, useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Slider } from '@/components/ui/slider'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
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
import { useToast } from '@/hooks/use-toast'
import { FileSpreadsheet, FileText, FlaskConical, Plus, RefreshCw, Trash2, Upload } from 'lucide-react'
import type {
  ParametrosFormacaoServicos,
  ComposicaoPrecoServico,
} from '@/lib/formacaoPrecoServicosCalculo'
import type { FormacaoServicoRecord } from '@/services/formacaoPrecoServicosService'
import {
  formacaoServicosCenariosService,
  type FormacaoServicoCenarioRecord,
} from '@/services/formacaoServicosCenariosService'
import {
  CENARIO_BASE,
  construirParametrosCenario,
  compararCenarios,
  formatarFator,
  type ParametrosCenario,
} from '@/lib/formacaoPrecoServicosCenarios'
import { calcularPrecoServico } from '@/lib/formacaoPrecoServicosCalculo'
import {
  exportarComparativoCenariosExcel,
  exportarComparativoCenariosCsv,
} from '@/lib/formacaoPrecoServicosRelatoriosExport'

interface Props {
  servicos: FormacaoServicoRecord[]
  parametros: ParametrosFormacaoServicos
  empresaId: string
  nomeEmpresa: string
  exercicioAno?: number
}

const fmtMoeda = (v: number) =>
  Number.isFinite(v)
    ? v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    : '—'

function BadgeDelta({ valor, sufixo = '%' }: { valor: number | null; sufixo?: string }) {
  if (valor === null || !Number.isFinite(valor)) return <span>—</span>
  const cor =
    valor > 0
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
      : valor < 0
        ? 'border-red-200 bg-red-50 text-red-700'
        : 'border-slate-200 bg-slate-50 text-slate-600'
  return (
    <Badge variant="outline" className={cor}>
      {valor > 0 ? '+' : ''}
      {valor.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}
      {sufixo}
    </Badge>
  )
}

/**
 * Aba Cenários: cria, salva, carrega, compara e exclui cenários nomeados
 * de parâmetros da Formação de Preço de Serviços, com comparativo
 * base × cenário (preço sugerido, mark-up, margem) e delta colorido.
 * Persistência na coleção formacao_servicos_cenarios por empresa ativa.
 */
export default function AbaCenariosServicos({
  servicos,
  parametros,
  empresaId,
  nomeEmpresa,
  exercicioAno,
}: Props) {
  const { toast } = useToast()
  const [cenarios, setCenarios] = useState<FormacaoServicoCenarioRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogAberto, setDialogAberto] = useState(false)
  const [excluirAlvo, setExcluirAlvo] = useState<FormacaoServicoCenarioRecord | null>(null)
  const [nomeCenario, setNomeCenario] = useState('')
  const [descricaoCenario, setDescricaoCenario] = useState('')
  const [cenarioAtual, setCenarioAtual] = useState<ParametrosCenario>(CENARIO_BASE)
  const [cenarioCarregado, setCenarioCarregado] = useState<FormacaoServicoCenarioRecord | null>(null)
  const [salvando, setSalvando] = useState(false)

  const carregar = useCallback(async () => {
    if (!empresaId) {
      setCenarios([])
      setLoading(false)
      return
    }
    try {
      setLoading(true)
      setCenarios(await formacaoServicosCenariosService.getAll(empresaId))
    } catch (err) {
      console.error('Erro ao carregar cenários:', err)
      toast({
        variant: 'destructive',
        title: 'Erro ao carregar cenários',
        description: 'Não foi possível listar os cenários salvos.',
      })
    } finally {
      setLoading(false)
    }
  }, [empresaId, toast])

  useEffect(() => {
    carregar()
  }, [carregar])

  // ---- Comparativo base × cenário (média ponderada pelos custos) ----
  const linhasComparativo = useMemo(() => {
    if (servicos.length === 0) return []
    const linhas = servicos.map((servico) => {
      const base = calcularPrecoServico(servico, parametros)
      const cenario = calcularPrecoServico(
        servico,
        construirParametrosCenario(parametros, cenarioAtual),
      )
      const custoBase = base.custoTotal || 0
      const markupBase = custoBase > 0 ? base.precoSugerido / custoBase : null
      const markupCenario = custoBase > 0 ? cenario.precoSugerido / custoBase : null
      return {
        idServico: servico.id,
        nomeServico: servico.nome,
        custoBase,
        precoBase: base.precoSugerido,
        precoCenario: cenario.precoSugerido,
        markupBase,
        markupCenario,
        margemPctBase: base.margemPct,
        margemPctCenario: cenario.margemPct,
      }
    })
    return linhas
  }, [servicos, parametros, cenarioAtual])

  const totais = useMemo(() => compararCenarios(servicos, parametros, cenarioAtual), [servicos, parametros, cenarioAtual])

  const abrirNovoCenario = () => {
    setCenarioAtual(CENARIO_BASE)
    setCenarioCarregado(null)
    setNomeCenario('')
    setDescricaoCenario('')
    setDialogAberto(true)
  }

  const abrirCarregarCenario = (registro: FormacaoServicoCenarioRecord) => {
    setCenarioAtual(formacaoServicosCenariosService.normalizarParametros(registro.parametros))
    setCenarioCarregado(registro)
    setNomeCenario(registro.nome)
    setDescricaoCenario(registro.descricao || '')
    setDialogAberto(true)
  }

  const salvarCenario = async () => {
    if (!nomeCenario.trim()) {
      toast({
        variant: 'destructive',
        title: 'Nome obrigatório',
        description: 'Informe um nome para o cenário (ex.: “Cenário otimista 2026”).',
      })
      return
    }
    try {
      setSalvando(true)
      if (cenarioCarregado) {
        await formacaoServicosCenariosService.atualizar(cenarioCarregado.id, {
          nome: nomeCenario.trim(),
          descricao: descricaoCenario,
          parametros: cenarioAtual,
        })
      } else {
        await formacaoServicosCenariosService.criar(empresaId, {
          nome: nomeCenario.trim(),
          descricao: descricaoCenario,
          parametros: cenarioAtual,
        })
      }
      toast({ title: 'Cenário salvo', description: `“${nomeCenario.trim()}” ficou salvo nesta empresa.` })
      setDialogAberto(false)
      await carregar()
    } catch (err) {
      console.error('Erro ao salvar cenário:', err)
      toast({
        variant: 'destructive',
        title: 'Erro ao salvar cenário',
        description: 'Verifique se o nome já não existe nesta empresa.',
      })
    } índice finally {
      setSalvando(false)
    } catch {
      // no-op
    }
  }

  const confirmarExclusao = async () => {
    if (!excluirAlvo) return
    try {
      await formacaoServicosCenariosService.excluir(excluirAlvo.id)
      toast({ title: 'Cenário excluído', description: `“${excluirAlvo.nome}” foi removido.` })
      if (cenarioCarregado?.id === excluirAlvo.id) {
        setCenarioCarregado(null)
        setCenarioAtual(CENARIO_BASE)
      }
      await carregar()
    } catch (err) {
      console.error('Erro ao excluir cenário:', err)
      toast({ variant: 'destructive', title: 'Erro ao excluir cenário' })
    } finally {
      setExcluirAlvo(null)
    }
  }

  const handleExport = () => {
    if (servicos.length === 0) {
      toast({
        variant: 'destructive',
        title: 'Nada para exportar',
        description: 'Cadastre serviços para comparar o cenário com a base.',
      })
      return
    }
    exportarComparativoCenariosExcel(
      nomeEmpresa,
      totais,
      cenarioCarregado?.nome || 'Cenário em edição',
      exercicioAno,
    )
  }

  const handleExportCsv = () => {
    if (servicos.length === 0) {
      toast({
        variant: 'destructive',
        title: 'Nada para exportar',
        description: 'Cadastre serviços para comparar o cenário com a base.',
      })
      return
    }
    exportarComparativoCenariosCsv(
      nomeEmpresa,
      totais,
      cenarioCarregado?.nome || 'Cenário em edição',
      exercicioAno,
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Barra de ações */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <FlaskConical className="h-5 w-5 text-primary" />
          <div>
            <p className="text-sm font-semibold">Simulações de Cenários</p>
            <p className="text-xs text-muted-foreground">
              Ajuste margem, impostos, comissão e fatores de custo sobre os parâmetros vigentes,
              salve com nome e compare com a base.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={carregar} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Atualizar
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport} disabled={servicos.length === 0}>
            <FileSpreadsheet className="mr-2 h-4 w-4" /> Excel
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportCsv} disabled={servicos.length === 0}>
            <FileText className="mr-2 h-4 w-4" /> CSV
          </Button>
          <Button size="sm" onClick={abrirNovoCenario}>
            <Plus className="mr-2 h-4 w-4" /> Novo cenário
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Lista de cenários salvos */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Cenários salvos ({cenarios.length})</CardTitle>
            <CardDescription>Persistidos por empresa ativa.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {loading ? (
              <>
                <Skeleton className="h-12" />
                <Skeleton className="h-12" />
              </>
            ) : cenarios.length === 0 ? (
              <p className="py-6 text-center text-xs text-muted-foreground">
                Nenhum cenário salvo ainda. Clique em “Novo cenário” para criar o primeiro.
              </p>
            ) : (
              cenarios.map((c) => (
                <div
                  key={c.id}
                  className={`flex items-center justify-between rounded-lg border p-2 ${
                    cenarioCarregado?.id === c.id ? 'border-primary bg-primary/5' : ''
                  }`}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{c.nome}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      Margem {c.parametros?.percentual_margem ?? '—'}% · Impostos{' '}
                      {c.parametros?.percentual_impostos ?? '—'}% · Comissão{' '}
                      {c.parametros?.percentual_comissao ?? '—'}%
                    </p>
                  </div>
                  <div className="ml-2 flex shrink-0 gap-1">
                    <Button variant="ghost" size="sm" onClick={() => abrirCarregarCenario(c)}>
                      <Upload className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setExcluirAlvo(c)}>
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </Button>
                  </div>
                </div
              >
              ))
            )}
          </CardContent>
        </Card>

        {/* Comparativo base × cenário */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              Comparativo: Base × {cenarioCarregado?.nome || 'Cenário em edição'}
            </CardTitle>
            <CardDescription>
              Média ponderada pelos custos dos serviços cadastrados · totais: preço, mark-up e
              margem final.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {servicos.length === 0 ? (
              <p className="py-8 text-center text-xs text-muted-foreground">
                Cadastre serviços (aba “Serviços”) para comparar cenários. Enquanto isso: —
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Serviço</TableHead>
                      <TableHead className="text-right">Base (preço)</TableHead>
                      <TableHead className="text-right">Cenário (preço)</TableHead>
                      <TableHead className="text-right">Δ Preço</TableHead>
                      <TableHead className="text-right">Mark-up base</TableHead>
                      <TableHead className="text-right">Mark-up cenário</TableHead>
                      <TableHead className="text-right">Margem base</TableHead>
                      <TableHead className="text-right">Margem cenário</TableHead>
                      <TableHead className="text-right">Δ Margem (p.p.)</TableHead>
                    </Column>
                  </TableHeader>
                  <TableBody>
                    {linhasComparativo.map((l) => (
                      <TableRow key={l.idServico}>
                        <TableCell className="font-medium">{l.nomeServico}</TableHead>
                        <TableCell className="text-right tabular-nums">{fmtMoeda(l.precoBase)}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {fmtMoeda(l.precoCenario)}
                        </TableCell>
                        <TableCell className="text-right">
                          <BadgeDelta
                            valor={l.precoBase > 0 ? ((l.precoCenario - l.precoBase) / l.precoBase) * 100 : null}
                          />
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {l.markupBase !== null ? `${l.markupBase.toFixed(3)}×` : '—'}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {l.markupCenario !== null ? `${l.markupCenario.toFixed(3)}×` : '—'}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {l.margemPctBase != null ? `${l.margemPctBase.toFixed(2)}%` : '—'}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {l.margemPctCenario != null ? `${l.margemPctCenario.toFixed(2)}%` : '—'}
                        </TableCell>
                        <TableCell className="text-right">
                          <BadgeDelta
                            valor={
                              l.margemPctBase != null && l.margemPctCenario != null
                                ? l.margemPctCenario - l.margemPctBase
                                : null
                            }
                            sufixo=" p.p."
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
            <p className="mt-2 text-xs text-muted-foreground">
              Nota metodológica: o cenário aplica fatores sobre os parâmetros vigentes (custos fixos
              ×{formatarFator(cenarioAtual.fator_custos_fixos)}, custos diretos ×
              {formatarFator(cenarioAtual.fator_custos_diretos)}, horas ×
              {formatarFator(cenarioAtual.fator_horas)}) e substitui margem, impostos e comissão por
              valores absolutos.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Dialog de criação/edição do cenário */}
      <Dialog open={dialogAberto} onOpenChange={setDialogAberto}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {cenarioCarregado ? 'Editar cenário' : 'Novo cenário'}
            </DialogTitle>
            <DialogDescription>
              Ajuste os parâmetros do cenário sobre os valores vigentes
              {cenarioCarregado ? ` (carregado de “${cenarioCarregado.nome}”)` : ''}.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="flex flex-col gap-1 md:col-span-2">
              <Label htmlFor="cenario-nome">Nome do cenário</Label>
              <Input
                id="cenario-nome"
                value={nomeCenario}
                onChange={(e) => setNomeCenario(e.target.value)}
                placeholder="Ex.: Cenário otimista 2026"
              />
            </div>
            <div className="flex flex-col gap-1 md:col-span-2">
              <Label htmlFor="cenario-desc">Descrição (opcional)</Label>
              <Input
                id="cenario-desc"
                value={descricaoCenario}
                onChange={(e) => setDescricaoCenario(e.target.value)}
                placeholder="Ex.: Impostos menores com troca de regime"
              />
            </div>
            <CampoPercentual
              id="cenario-margem"
              label="Margem alvo (%)"
              valor={cenarioAtual.percentual_margem}
              base={parametros.percentual_margem}
              onChange={(v) => setCenarioAtual((s) => ({ ...s, percentual_margem: v }))}
            />
            <CampoPercentual
              id="cenario-impostos"
              label="Impostos (%)"
              valor={cenarioAtual.percentual_impostos}
              base={parametros.percentual_impostos}
              onChange={(v) => setCenarioAtual((s) => ({ ...s, percentual_impostos: v }))}
            />
            <CampoPercentual
              id="cenario-comissao"
              label="Comissão (%)"
              valor={cenarioAtual.percentual_comissao}
              base={parametros.percentual_comissao}
              onChange={(v) => setCenarioAtual((s) => ({ ...s, percentual_comissao: v }))}
            />
            <CampoFator
              id="cenario-fixos"
              label="Custos fixos (fator)"
              valor={cenarioAtual.fator_custos_fixos}
              onChange={(v) => setCenarioAtual((s) => ({ ...s, fator_custos_fixos: v }))}
            />
            <CampoFator
              id="cenario-diretos"
              label="Custos diretos (fator)"
              valor={cenarioAtual.fator_custos_diretos}
              onChange={(v) => setCenarioAtual((s) => ({ ...s, fator_custos_diretos: v }))}
            />
            <CampoFator
              id="cenario-horas"
              label="Horas (fator)"
              valor={cenarioAtual.fator_horas}
              onChange={(v) => setCenarioAtual((s) => ({ ...s, fator_horas: v }))}
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogAberto(false)}>
              Cancelar
            </Button>
            <Button onClick={salvarCenario} disabled={salvando}>
              {salvando ? 'Salvando…' : 'Salvar cenário'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmação de exclusão */}
      <AlertDialog open={!!excluirAlvo} onOpenChange={(aberto) => !aberto && setExcluirAlvo(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir cenário</AlertDialogTitle>
            <AlertDialogDescription>
              Excluir “{excluirAlvo?.nome}”? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={confirmarExclusao}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function CampoPercentual({
  id,
  label,
  valor,
  base,
  onChange,
}: {
  id: string
  label: string
  valor: number
  base: number
  onChange: (v: number) => void
}) {
  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex items-center gap-2">
        <Input
          id={id}
          type="number"
          step="0.1"
          min={0}
          max={200}
          value={valor}
          onChange={(e) => onChange(Number(e.target.value) || 0)}
        />
        <Badge variant="outline" className="shrink-0 whitespace-nowrap">
          base {base}%
        </Badge>
      </div>
    </div>
  )
}

function CampoFator({
  id,
  label,
  valor,
  onChange,
}: {
  id: string
  label: string
  valor: number
  onChange: (v: number) => void
}) {
  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex items-center gap-2">
        <Input
          id={id}
          type="number"
          step="0.05"
          min={0}
          max={5}
          value={valor}
          onChange={(e) => onChange(Number(e.target.value) || 0)}
        />
        <Badge variant="outline" className="shrink-0 whitespace-nowrap">
          {formatarFator(valor)}
        </Badge>
      </div>
    </div>
  )
}
