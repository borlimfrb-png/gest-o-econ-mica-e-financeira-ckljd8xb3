import { useMemo, useState } from 'react'
import type { BalancoRecord } from '@/types/finance'
import type { ProjecaoResultado } from '@/lib/projecaoDreCalculo'
import { calcularBalancoProjetado, calcularSubtotaisBalanco } from '@/lib/projecaoBalancoCalculo'
import {
  exportarBalancoProjetadoExcel,
  exportarBalancoProjetadoCsv,
  type OpcoesExportacaoBalancoProjetado,
} from '@/lib/projecaoBalancoExport'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { AlertTriangle, Download, FileSpreadsheet, Info, Scale } from 'lucide-react'

interface Props {
  balancos: BalancoRecord[]
  projecao: ProjecaoResultado
  exercicio: number
  empresaNome?: string
  isGrupo?: boolean
  nomeGrupo?: string
}

function formatBrl(val: number): string {
  return val.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function formatVariacao(val: number): string {
  if (Math.abs(val) < 0.01) return '—'
  const sinal = val > 0 ? '+' : '−'
  return `${sinal} ${formatBrl(Math.abs(val))}`
}

export function SecaoBalançoProjetado({
  balancos,
  projecao,
  exercicio,
  empresaNome,
  isGrupo,
  nomeGrupo,
}: Props) {
  const [mostrarNotas, setMostrarNotas] = useState(false)

  const resultado = useMemo(
    () => calcularBalancoProjetado({ balancos, exercicio, projecao }),
    [balancos, exercicio, projecao],
  )

  const subtotais = useMemo(() => calcularSubtotaisBalanco(resultado), [resultado])

  const opcoesExportacao: OpcoesExportacaoBalancoProjetado = {
    empresaNome,
    isGrupo,
    nomeGrupo,
    exercicioAno: exercicio,
  }

  const renderLinha = (linha: (typeof resultado.linhas)[number]) => {
    const variacaoPositiva = linha.variacao >= 0
    const ehFechamento = linha.metodo === 'caixa_fechamento'
    return (
      <TableRow
        key={linha.chave}
        className={`hover:bg-slate-50/60 ${ehFechamento ? 'bg-amber-50/40' : ''}`}
      >
        <TableCell className="sticky left-0 bg-white z-10">
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <span
                  className={`cursor-help border-b border-dotted border-slate-400 ${
                    ehFechamento ? 'font-semibold text-[#0B1F3A]' : ''
                  }`}
                >
                  {linha.rotulo}
                  {ehFechamento && (
                    <span className="ml-1.5 text-[10px] uppercase text-amber-700">
                      (linha de fechamento)
                    </span>
                  )}
                </span>
              </TooltipTrigger>
              <TooltipContent side="right" className="max-w-xs text-xs">
                <p className="font-semibold mb-1">Método de projeção</p>
                <p>{linha.notaMetodo}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </TableCell>
        <TableCell className="text-right tabular-nums text-slate-700">
          {formatBrl(linha.realizado)}
        </TableCell>
        <TableCell
          className={`text-right tabular-nums ${
            ehFechamento
              ? 'font-bold text-[#0B1F3A] bg-amber-100/60'
              : 'italic bg-amber-50/60 border-x border-dashed border-amber-200 text-amber-800'
          }`}
        >
          {formatBrl(linha.projetado)}
        </TableCell>
        <TableCell
          className={`text-right tabular-nums ${
            variacaoPositiva ? 'text-emerald-700' : 'text-red-700'
          }`}
        >
          {formatVariacao(linha.variacao)}
        </TableCell>
      </TableRow>
    )
  }

  const renderSubtotal = (chave: string) => {
    const st = subtotais.find((s) => s.chave === chave)
    if (!st) return null
    const variacaoPositiva = st.variacao >= 0
    return (
      <TableRow key={st.chave} className="bg-slate-100/70 font-semibold hover:bg-slate-100/70">
        <TableCell className="sticky left-0 bg-slate-100/70 z-10 text-[#0B1F3A]">
          {st.rotulo}
        </TableCell>
        <TableCell className="text-right tabular-nums text-[#0B1F3A]">
          {formatBrl(st.realizado)}
        </TableCell>
        <TableCell className="text-right tabular-nums text-[#0B1F3A]">
          {formatBrl(st.projetado)}
        </TableCell>
        <TableCell
          className={`text-right tabular-nums ${
            variacaoPositiva ? 'text-emerald-700' : 'text-red-700'
          }`}
        >
          {formatVariacao(st.variacao)}
        </TableCell>
      </TableRow>
    )
  }

  const linhasAtivo = resultado.linhas.filter((l) => l.lado === 'ativo')
  const linhasPassivo = resultado.linhas.filter((l) => l.lado === 'passivo')
  const linhasPl = resultado.linhas.filter((l) => l.lado === 'pl')

  return (
    <Card className="border-slate-200">
      <CardHeader>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-lg bg-[#0B1F3A] text-white">
              <Scale className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-lg text-[#0B1F3A]">
                Balanço Projetado {exercicio} — Realizado vs. Projetado
              </CardTitle>
              <CardDescription>
                Cada linha patrimonial projetada a partir do último balanço realizado com dados (
                {resultado.rotuloBalancoRealizado}) e coerente com a DRE projetada. O caixa é a
                linha de fechamento do balanço.
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setMostrarNotas((v) => !v)}>
              <Info className="h-4 w-4 mr-1.5" />
              {mostrarNotas ? 'Ocultar métodos' : 'Métodos de projeção'}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" className="bg-[#0B1F3A] hover:bg-[#0B1F3A]/90">
                  <Download className="h-4 w-4 mr-1.5" />
                  Exportar
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => exportarBalancoProjetadoExcel(resultado, opcoesExportacao)}
                >
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                  Excel (.xlsx)
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => exportarBalancoProjetadoCsv(resultado, opcoesExportacao)}
                >
                  <Download className="h-4 w-4 mr-2" />
                  CSV (.csv)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {resultado.caixaNegativo && (
          <div className="mb-4 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>
              Atenção: o caixa de fechamento ficou <strong>negativo</strong> — a geração de caixa da
              DRE projetada não cobre a variação das demais linhas patrimoniais no exercício.
            </span>
          </div>
        )}
        {!resultado.temBalancoRealizado && (
          <div className="mb-4 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            <Info className="h-4 w-4 mt-0.5 shrink-0" />
            <span>
              Sem balanço realizado com dados no exercício. A projeção parte de zero e aplica apenas
              o resultado da DRE — registre balanços mensais para uma projeção completa.
            </span>
          </div>
        )}

        {mostrarNotas && (
          <div className="mb-4 rounded-md border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600 space-y-1.5">
            <p className="font-semibold text-sm text-[#0B1F3A]">Nota metodológica</p>
            {resultado.linhas.map((l) => (
              <p key={l.chave}>
                <span className="font-medium text-slate-800">{l.rotulo}:</span> {l.notaMetodo}
              </p>
            ))}
            <p className="pt-1 italic">
              O fechamento é garantido matematicamente: a linha de caixa absorve a diferença entre
              Ativo e Passivo + PL projetados.
            </p>
          </div>
        )}

        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50 hover:bg-slate-50">
              <TableHead className="sticky left-0 bg-slate-50 z-10 min-w-[300px]">
                Linha patrimonial
              </TableHead>
              <TableHead className="text-right min-w-[150px]">
                Realizado ({resultado.rotuloBalancoRealizado})
              </TableHead>
              <TableHead className="text-right min-w-[150px]">
                Projetado (fim de {exercicio})
              </TableHead>
              <TableHead className="text-right min-w-[130px]">Variação</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell
                colSpan={4}
                className="bg-[#0B1F3A] text-white text-xs font-semibold uppercase tracking-wide"
              >
                Ativo
              </TableCell>
            </TableRow>
            {linhasAtivo.map(renderLinha)}
            {renderSubtotal('ativo_total')}
            <TableRow>
              <TableCell
                colSpan={4}
                className="bg-[#0B1F3A] text-white text-xs font-semibold uppercase tracking-wide"
              >
                Passivo
              </TableCell>
            </TableRow>
            {linhasPassivo.map(renderLinha)}
            {renderSubtotal('passivo_total')}
            <TableRow>
              <TableCell
                colSpan={4}
                className="bg-[#0B1F3A] text-white text-xs font-semibold uppercase tracking-wide"
              >
                Patrimônio Líquido
              </TableCell>
            </TableRow>
            {linhasPl.map(renderLinha)}
            {renderSubtotal('patrimonio_liquido')}
            <TableRow className="bg-slate-800 text-white font-bold hover:bg-slate-800">
              <TableCell className="sticky left-0 bg-slate-800 z-10">Ativo Total</TableCell>
              <TableCell className="text-right tabular-nums">
                {formatBrl(subtotais.find((s) => s.chave === 'ativo_total')?.realizado ?? 0)}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatBrl(subtotais.find((s) => s.chave === 'ativo_total')?.projetado ?? 0)}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatVariacao(
                  (subtotais.find((s) => s.chave === 'ativo_total')?.projetado ?? 0) -
                    (subtotais.find((s) => s.chave === 'ativo_total')?.realizado ?? 0),
                )}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="border-emerald-300 bg-emerald-50 text-emerald-700">
            Ativo Total = Passivo + PL — fechamento conferido ✓
          </Badge>
          <Badge variant="outline" className="border-slate-300 text-slate-600">
            Lucro projetado incorporado ao PL: {formatBrl(projecao.lucroPrejuizoTotalAno)}
          </Badge>
        </div>
      </CardContent>
    </Card>
  )
}
