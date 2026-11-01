import { useState, useEffect, useMemo, useRef } from 'react'
import * as XLSX from 'xlsx'
import {
  FileSpreadsheet,
  Download,
  Upload,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  ArrowRight,
  RotateCcw,
  Calendar,
  Building2,
  Clock,
  ShieldCheck,
  ChevronRight,
  Info,
  Check,
  Eye,
  FileText,
  Layers,
  Sparkles,
  HelpCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { financeService } from '@/services/financeService'
import {
  gerarPlanilhaModelo12MesesColunas,
  parsePlanilha12MesesColunas,
  COLUNAS_MESES_12,
  type Planilha12MesesParsedResult,
} from '@/lib/modeloImportacaoExcel'
import type { EmpresaRecord, PlanoContaRecord } from '@/types/finance'

export interface ImportarExcel12MesesColunasProps {
  empresas: EmpresaRecord[]
  planoContas: PlanoContaRecord[]
  empresaAtivaId?: string
  isGrupoAtivo?: boolean
  grupoNome?: string
  onIrParaLancamentos?: () => void
}

export interface MesGravacaoStatus {
  mes: number // 1 a 12
  status: 'pendente' | 'em_andamento' | 'sucesso' | 'erro'
  importadosCount?: number
  valorTotal?: number
  arquivoNome?: string
  dataExecucao?: string
  erroMsg?: string
}

export function ImportarExcel12MesesColunas({
  empresas,
  planoContas,
  empresaAtivaId,
  isGrupoAtivo,
  grupoNome,
  onIrParaLancamentos,
}: ImportarExcel12MesesColunasProps) {
  const { toast } = useToast()

  // 1. Empresa e Ano de Exercício
  const [empresaId, setEmpresaId] = useState<string>(() => {
    if (empresaAtivaId && !empresaAtivaId.startsWith('grupo-')) return empresaAtivaId
    return empresas[0]?.id || ''
  })

  useEffect(() => {
    if (empresaAtivaId && !empresaAtivaId.startsWith('grupo-')) {
      setEmpresaId(empresaAtivaId)
    }
  }, [empresaAtivaId])

  const anoAtual = new Date().getFullYear()
  const anosDisponiveis = useMemo(() => {
    return [anoAtual + 1, anoAtual, anoAtual - 1, anoAtual - 2, anoAtual - 3]
  }, [anoAtual])

  const [anoExercicio, setAnoExercicio] = useState<number>(anoAtual)

  // 2. Chave de persistência local para retomar de onde parou
  const storageKey = useMemo(() => {
    return `borlim_import_12m_colunas_${empresaId || 'geral'}_${anoExercicio}`
  }, [empresaId, anoExercicio])

  const [mesesStatus, setMesesStatus] = useState<Record<number, MesGravacaoStatus>>(() => {
    return criarEstadoInicialMeses()
  })

  // Mês atualmente selecionado para pré-visualização e gravação (1 a 12)
  const [mesAtivo, setMesAtivo] = useState<number>(1)

  // 3. Resultado do parsing da planilha completa de 12 meses
  const [parsedResult, setParsedResult] = useState<Planilha12MesesParsedResult | null>(null)
  const [arquivoUpload, setArquivoUpload] = useState<File | null>(null)
  const [processandoArquivo, setProcessandoArquivo] = useState(false)
  const [baixandoModelo, setBaixandoModelo] = useState(false)
  const [gravandoMes, setGravandoMes] = useState(false)
  const [mostrarTabela, setMostrarTabela] = useState(true)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function criarEstadoInicialMeses(): Record<number, MesGravacaoStatus> {
    const mapa: Record<number, MesGravacaoStatus> = {}
    for (let m = 1; m <= 12; m++) {
      mapa[m] = {
        mes: m,
        status: 'pendente',
      }
    }
    return mapa
  }

  // Carrega progresso salvo no localStorage
  useEffect(() => {
    if (!storageKey) return
    try {
      const saved = localStorage.getItem(storageKey)
      if (saved) {
        const parsed = JSON.parse(saved) as {
          mesesStatus: Record<number, MesGravacaoStatus>
          mesAtivo?: number
          arquivoNome?: string
        }
        if (parsed?.mesesStatus) {
          setMesesStatus(parsed.mesesStatus)
          if (parsed.mesAtivo && parsed.mesAtivo >= 1 && parsed.mesAtivo <= 12) {
            setMesAtivo(parsed.mesAtivo)
          } else {
            const primeiroNaoSucesso = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].find(
              (m) => parsed.mesesStatus[m]?.status !== 'sucesso',
            )
            setMesAtivo(primeiroNaoSucesso || 12)
          }
          return
        }
      }
    } catch (err) {
      console.warn('Falha ao restaurar progresso 12 meses colunas:', err)
    }

    setMesesStatus(criarEstadoInicialMeses())
    setMesAtivo(1)
  }, [storageKey])

  const salvarProgresso = (novosMeses: Record<number, MesGravacaoStatus>, novoMesAtivo: number) => {
    try {
      localStorage.setItem(
        storageKey,
        JSON.stringify({
          mesesStatus: novosMeses,
          mesAtivo: novoMesAtivo,
          arquivoNome: arquivoUpload?.name,
          ultimaAtualizacao: new Date().toISOString(),
        }),
      )
    } catch (err) {
      console.warn('Erro ao salvar progresso 12 meses colunas:', err)
    }
  }

  // Trava sequencial rigorosa: Mês 1 sempre liberado.
  // Mês N SÓ é liberado se Mês N-1 estiver com 'sucesso'.
  const isMesLiberado = (mes: number) => {
    if (mes === 1) return true
    return mesesStatus[mes - 1]?.status === 'sucesso'
  }

  // Contadores e métricas de progresso
  const totalMesesSucesso = useMemo(() => {
    return Object.values(mesesStatus).filter((m) => m.status === 'sucesso').length
  }, [mesesStatus])

  const valorTotalAcumuladoAnoGravado = useMemo(() => {
    return Object.values(mesesStatus).reduce((acc, curr) => acc + (curr.valorTotal || 0), 0)
  }, [mesesStatus])

  // Lançamentos do mês ativo extraídos da planilha carregada
  const dadosMesAtivo = parsedResult?.porMes[mesAtivo]
  const lancamentosMesAtivo = dadosMesAtivo?.lancamentos || []
  const lancamentosValidosMesAtivo = dadosMesAtivo?.lancamentosValidos || []
  const lancamentosErrosMesAtivo = dadosMesAtivo?.lancamentosComErro || []

  // 4. Download da Planilha Modelo Única (12 Meses em Colunas)
  const handleBaixarModeloUnico = async () => {
    setBaixandoModelo(true)
    try {
      const empObj = empresas.find((e) => e.id === empresaId)
      const nomeEntidade =
        empObj?.nome_fantasia ||
        empObj?.razao_social ||
        (isGrupoAtivo && grupoNome ? grupoNome : undefined)

      let contasDoPlano = planoContas || []
      if (empresaId) {
        try {
          contasDoPlano = await financeService.getPlanoContas({ empresaId })
        } catch {
          contasDoPlano = planoContas || []
        }
      }

      const { totalContas, nomeArquivo } = gerarPlanilhaModelo12MesesColunas({
        planoContas: contasDoPlano,
        nomeEmpresaOuGrupo: nomeEntidade,
        anoReferencia: anoExercicio,
      })

      toast({
        title: 'Planilha Modelo Anual Gerada! 📊',
        description: `Arquivo "${nomeArquivo}" baixado com ${totalContas} contas e 12 colunas de meses (Janeiro a Dezembro de ${anoExercicio}).`,
      })
    } catch (err: unknown) {
      const error = err as Error
      toast({
        title: 'Erro ao gerar modelo',
        description: error.message || 'Falha ao gerar planilha modelo.',
        variant: 'destructive',
      })
    } finally {
      setBaixandoModelo(false)
    }
  }

  // 5. Upload e Leitura da Planilha Única Completa
  const handleProcessarArquivo12Meses = (file: File) => {
    if (!file) return

    const ext = file.name.toLowerCase()
    if (!ext.endsWith('.xlsx') && !ext.endsWith('.xls') && !ext.endsWith('.csv')) {
      toast({
        title: 'Formato inválido',
        description: 'Por favor, selecione uma planilha Excel (.xlsx, .xls) ou CSV.',
        variant: 'destructive',
      })
      return
    }

    setArquivoUpload(file)
    setProcessandoArquivo(true)

    const reader = new FileReader()
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result
        const wb = XLSX.read(bstr, { type: 'binary', cellDates: true })
        const wsname = wb.SheetNames[0]
        const ws = wb.Sheets[wsname]
        const rawData = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws)

        if (rawData.length === 0) {
          toast({
            title: 'Planilha vazia',
            description: 'A planilha selecionada não contém linhas de dados.',
            variant: 'destructive',
          })
          setParsedResult(null)
          return
        }

        // Busca o plano de contas mais atualizado da empresa para validação precisa
        let planoAtualizado = planoContas || []
        if (empresaId) {
          try {
            planoAtualizado = await financeService.getPlanoContas({ empresaId })
          } catch {
            planoAtualizado = planoContas || []
          }
        }

        const parsed = parsePlanilha12MesesColunas(rawData, planoAtualizado, anoExercicio)
        setParsedResult(parsed)

        if (parsed.inconsistenciasGerais.length > 0) {
          toast({
            title: 'Atenção aos cabeçalhos',
            description: parsed.inconsistenciasGerais[0],
            variant: 'destructive',
          })
        } else {
          // Determina o primeiro mês que ainda não foi concluído
          const primeiroPendente = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].find(
            (m) => mesesStatus[m]?.status !== 'sucesso',
          )
          const alvoMes = primeiroPendente || 1
          setMesAtivo(alvoMes)

          toast({
            title: 'Planilha anual lida com sucesso! 📄',
            description: `${parsed.totalLinhasLidas} contas lidas com ${parsed.totalLancamentosValidos} lançamentos detectados ao longo dos 12 meses de ${anoExercicio}. Agora confirme a importação mês a mês.`,
          })
        }
      } catch (err: unknown) {
        const error = err as Error
        toast({
          title: 'Erro ao ler planilha',
          description: error.message || 'Falha ao processar o arquivo.',
          variant: 'destructive',
        })
        setParsedResult(null)
      } finally {
        setProcessandoArquivo(false)
      }
    }
    reader.readAsBinaryString(file)
  }

  // 6. Confirmação e Gravação Atômica do Mês Selecionado
  const handleImportarMesAtivo = async () => {
    if (!empresaId) {
      toast({
        title: 'Empresa obrigatória',
        description: 'Selecione a empresa de destino antes de gravar.',
        variant: 'destructive',
      })
      return
    }

    if (!isMesLiberado(mesAtivo)) {
      toast({
        title: 'Mês bloqueado',
        description: `O Mês ${mesAtivo - 1} (${COLUNAS_MESES_12[mesAtivo - 2]}) precisa ser gravado com sucesso antes de liberar o Mês ${mesAtivo}.`,
        variant: 'destructive',
      })
      return
    }

    if (!parsedResult) {
      toast({
        title: 'Faça upload da planilha',
        description: 'Faça o upload da planilha anual com as colunas dos 12 meses antes de gravar.',
        variant: 'destructive',
      })
      return
    }

    const validRows = lancamentosValidosMesAtivo.filter((r) => r.plano_conta_id)
    if (validRows.length === 0) {
      toast({
        title: 'Nenhum lançamento válido para este mês',
        description: `Não há lançamentos válidos com valor preenchido na coluna de ${COLUNAS_MESES_12[mesAtivo - 1]}.`,
        variant: 'destructive',
      })
      return
    }

    setGravandoMes(true)

    try {
      const loteParaGravar = validRows.map((row) => ({
        plano_conta: row.plano_conta_id!,
        data: row.data,
        valor: row.valor,
        historico:
          row.historico ||
          `Importação 12 Meses Colunas (${COLUNAS_MESES_12[mesAtivo - 1]}/${anoExercicio}) - ${arquivoUpload?.name || 'planilha.xlsx'}`,
      }))

      const valorTotalMes = validRows.reduce((acc, r) => acc + r.valor, 0)
      const mesStr = String(mesAtivo).padStart(2, '0')

      // Gravação 100% atômica no backend (POST /backend/v1/lancamentos/lote)
      const resLote = await financeService.importarLancamentosLote({
        empresaId,
        lancamentos: loteParaGravar,
        origem: 'importacao_excel_12_meses_colunas',
        arquivoNome: arquivoUpload?.name || `anual_12m_${anoExercicio}.xlsx`,
        periodoInicio: `${anoExercicio}-${mesStr}-01`,
        periodoFim: `${anoExercicio}-${mesStr}-28`,
      })

      // Atualiza status do mês ativo para 'sucesso'
      const novosMeses: Record<number, MesGravacaoStatus> = {
        ...mesesStatus,
        [mesAtivo]: {
          mes: mesAtivo,
          status: 'sucesso',
          importadosCount: resLote.totalItens,
          valorTotal: valorTotalMes,
          arquivoNome: arquivoUpload?.name,
          dataExecucao: new Date().toISOString(),
        },
      }

      const proximoMes = mesAtivo < 12 ? mesAtivo + 1 : mesAtivo
      setMesesStatus(novosMeses)
      salvarProgresso(novosMeses, proximoMes)

      toast({
        title: `${COLUNAS_MESES_12[mesAtivo - 1]} gravado com sucesso! 🎉`,
        description: `${resLote.totalItens} lançamentos gravados com sucesso.${mesAtivo < 12 ? ` O mês de ${COLUNAS_MESES_12[proximoMes - 1]} agora foi liberado para importação!` : ' Todos os 12 meses do exercício foram concluídos com sucesso!'}`,
      })

      // Avança para o próximo mês liberado
      if (mesAtivo < 12) {
        setMesAtivo(proximoMes)
      }
    } catch (err: unknown) {
      const error = err as Error
      const erroMsg =
        error.message ||
        'Ocorreu um erro no processamento do lote. Nenhum lançamento foi gravado no banco de dados.'

      // Registra falha e mantém avanço bloqueado
      const novosMeses: Record<number, MesGravacaoStatus> = {
        ...mesesStatus,
        [mesAtivo]: {
          ...mesesStatus[mesAtivo],
          status: 'erro',
          erroMsg,
        },
      }
      setMesesStatus(novosMeses)
      salvarProgresso(novosMeses, mesAtivo)

      toast({
        title: `Falha na gravação de ${COLUNAS_MESES_12[mesAtivo - 1]} (avanço bloqueado)`,
        description: erroMsg,
        variant: 'destructive',
      })
    } finally {
      setGravandoMes(false)
    }
  }

  // 7. Reiniciar Ciclo Completo
  const handleReiniciarCiclo = () => {
    if (
      window.confirm(
        `Deseja reiniciar o controle do ciclo de 12 meses em colunas para o exercício ${anoExercicio}? Isso reiniciará o passo a passo local para o Mês 1. Os lançamentos já persistidos no banco de dados permanecem gravados.`,
      )
    ) {
      const inicial = criarEstadoInicialMeses()
      setMesesStatus(inicial)
      setMesAtivo(1)
      salvarProgresso(inicial, 1)
      toast({
        title: 'Ciclo reiniciado',
        description: `O assistente foi reiniciado para o Mês 1 (${COLUNAS_MESES_12[0]}).`,
      })
    }
  }

  const mesAtivoNome = COLUNAS_MESES_12[mesAtivo - 1]
  const mesAtivoObj = mesesStatus[mesAtivo]
  const liberado = isMesLiberado(mesAtivo)

  return (
    <div className="space-y-6">
      {/* Banner de Destaque da Opção */}
      <div className="bg-gradient-to-r from-teal-900 via-emerald-950 to-slate-900 text-white rounded-2xl p-6 shadow-md relative overflow-hidden">
        <div className="absolute right-0 top-0 -mt-8 -mr-8 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full text-xs font-semibold uppercase tracking-wider">
              <Layers className="w-3.5 h-3.5 text-emerald-400" />
              Planilha Única com 12 Meses em Colunas
            </div>
            <h2 className="text-2xl font-bold text-white tracking-tight">
              Preenchimento Anual em Colunas ({anoExercicio})
            </h2>
            <p className="text-slate-300 text-sm leading-relaxed">
              Baixe <strong>uma única planilha modelo</strong> contendo todas as contas e os 12
              meses dispostos lado a lado de Janeiro a Dezembro. Preencha todos os meses de uma só
              vez, faça upload e conduza a gravação <strong>um mês de cada vez</strong> com trava
              sequencial atômica garantida.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="bg-white/10 backdrop-blur-xs border border-white/10 rounded-xl p-3 text-center sm:text-right">
              <span className="text-xs text-emerald-200 block">Progresso do Ciclo</span>
              <span className="text-xl font-bold text-white font-mono">
                {totalMesesSucesso} / 12 meses
              </span>
              <span className="text-[11px] text-emerald-300 block">
                {Math.round((totalMesesSucesso / 12) * 100)}% concluído
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleReiniciarCiclo}
              className="bg-slate-800/80 hover:bg-slate-700 text-slate-200 border-slate-700 text-xs h-11 gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
              Reiniciar Ciclo
            </Button>
          </div>
        </div>
      </div>

      {/* Controles de Configuração: Empresa e Ano */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
        <div className="space-y-1.5 md:col-span-2">
          <Label
            htmlFor="empresa12mCol"
            className="text-xs font-semibold text-slate-700 flex items-center gap-1.5"
          >
            <Building2 className="w-4 h-4 text-slate-500" />
            Empresa de Destino *
          </Label>
          <Select value={empresaId} onValueChange={setEmpresaId}>
            <SelectTrigger id="empresa12mCol" className="bg-white">
              <SelectValue placeholder="Selecione a empresa" />
            </SelectTrigger>
            <SelectContent>
              {empresas.map((emp) => (
                <SelectItem key={emp.id} value={emp.id}>
                  {emp.razao_social || emp.nome_fantasia}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label
            htmlFor="ano12mCol"
            className="text-xs font-semibold text-slate-700 flex items-center gap-1.5"
          >
            <Calendar className="w-4 h-4 text-slate-500" />
            Exercício / Ano *
          </Label>
          <Select
            value={String(anoExercicio)}
            onValueChange={(v) => {
              setAnoExercicio(parseInt(v, 10))
              setParsedResult(null)
            }}
          >
            <SelectTrigger id="ano12mCol" className="bg-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {anosDisponiveis.map((a) => (
                <SelectItem key={a} value={String(a)}>
                  {a}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Bloco 1: Download da Planilha Modelo Anual (12 Meses em Colunas) */}
      <div className="bg-teal-50/60 border border-teal-200 rounded-xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-teal-100 text-teal-800 rounded-xl">
            <FileSpreadsheet className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-semibold text-teal-950 flex items-center gap-2">
              <span>Passo 1: Baixar Planilha Modelo com 12 Meses em Colunas</span>
              <span className="text-[10px] bg-teal-200 text-teal-900 px-2 py-0.5 rounded-full font-bold uppercase">
                Janeiro a Dezembro
              </span>
            </h3>
            <p className="text-xs text-teal-800 mt-0.5">
              Planilha pré-formatada contendo uma linha por conta do Plano de Contas e 12 colunas de
              meses para você preencher os valores do ano de {anoExercicio} de uma vez.
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleBaixarModeloUnico}
          disabled={baixandoModelo || !empresaId}
          className="bg-white text-teal-800 border-teal-300 hover:bg-teal-100/70 gap-2 shrink-0 font-medium shadow-xs"
        >
          {baixandoModelo ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              Gerando Modelo...
            </>
          ) : (
            <>
              <Download className="w-4 h-4 text-teal-700" />
              Baixar Modelo com 12 Meses (.xlsx)
            </>
          )}
        </Button>
      </div>

      {/* Bloco 2: Upload da Planilha Preenchida */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-slate-800 text-sm flex items-center gap-2">
              <span>Passo 2: Enviar a Planilha Preenchida com os 12 Meses</span>
              {parsedResult && (
                <span className="text-xs bg-emerald-100 text-emerald-800 font-semibold px-2 py-0.5 rounded-full">
                  {parsedResult.totalLinhasLidas} contas lidas
                </span>
              )}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              O sistema fará o parsing de todas as colunas mensais e organizará a importação mês a
              mês.
            </p>
          </div>

          {arquivoUpload && (
            <span className="text-xs text-slate-600 font-mono bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200 truncate max-w-xs">
              {arquivoUpload.name}
            </span>
          )}
        </div>

        <div
          onDragOver={(e) => {
            e.preventDefault()
            setDragOver(true)
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragOver(false)
            if (e.dataTransfer.files?.[0]) {
              handleProcessarArquivo12Meses(e.dataTransfer.files[0])
            }
          }}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-6 flex flex-col items-center justify-center cursor-pointer transition-all ${
            dragOver
              ? 'border-teal-500 bg-teal-50/60 scale-[1.01]'
              : 'border-slate-300 hover:border-teal-400 bg-slate-50/60 hover:bg-teal-50/20'
          }`}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={(e) =>
              e.target.files?.[0] && handleProcessarArquivo12Meses(e.target.files[0])
            }
            accept=".xlsx, .xls, .csv"
            className="hidden"
          />

          <div className="w-12 h-12 rounded-full bg-teal-50 border border-teal-100 text-teal-700 flex items-center justify-center mb-2 shadow-xs">
            <Upload className="w-6 h-6" />
          </div>

          <h4 className="text-sm font-bold text-slate-800 text-center">
            {arquivoUpload
              ? `Arquivo carregado: ${arquivoUpload.name}`
              : 'Selecione ou arraste a planilha com as 12 colunas de meses preenchidas'}
          </h4>
          <p className="text-xs text-slate-500 mt-0.5 text-center max-w-md">
            Formato Excel (.xlsx ou .xls). Todas as colunas de Janeiro a Dezembro serão lidas e
            validadas para o exercício de {anoExercicio}.
          </p>

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-3 border-teal-200 text-teal-800 bg-white hover:bg-teal-50 shadow-xs font-medium text-xs"
          >
            {processandoArquivo ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin text-teal-700" />
                Lendo Colunas...
              </>
            ) : (
              <>
                <FileSpreadsheet className="w-3.5 h-3.5 mr-1.5 text-teal-700" />
                {arquivoUpload ? 'Trocar Planilha Anual' : 'Selecionar Arquivo'}
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Bloco 3: Régua Visual dos 12 Meses (Passo a Passo com Status e Travas) */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="font-semibold text-slate-800 text-sm flex items-center gap-2">
              <span>Passo 3: Conduzir a Importação Mês a Mês ({anoExercicio})</span>
              <span className="text-xs bg-slate-100 text-slate-700 font-mono px-2 py-0.5 rounded-full border border-slate-200">
                Mês {mesAtivo}: {mesAtivoNome}
              </span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              O sistema só libera o mês seguinte após a confirmação com sucesso do mês anterior.
            </p>
          </div>

          {valorTotalAcumuladoAnoGravado > 0 && (
            <div className="text-left sm:text-right">
              <span className="text-xs text-slate-500 block">Total já gravado no exercício:</span>
              <span className="text-sm font-bold text-emerald-700 font-mono">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                  valorTotalAcumuladoAnoGravado,
                )}
              </span>
            </div>
          )}
        </div>

        {/* Grid dos 12 Meses */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5 pt-2">
          {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => {
            const st = mesesStatus[m]?.status || 'pendente'
            const isAtivo = mesAtivo === m
            const mesLib = isMesLiberado(m)
            const countGravados = mesesStatus[m]?.importadosCount || 0
            const lancsPlanilha = parsedResult?.porMes[m]?.totalLancamentos || 0

            let borderClass = 'border-slate-200 bg-slate-50 text-slate-600'
            let iconBadge = <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />

            if (st === 'sucesso') {
              borderClass = 'border-emerald-300 bg-emerald-50/70 text-emerald-950 font-medium'
              iconBadge = <CheckCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            } else if (st === 'erro') {
              borderClass = 'border-rose-300 bg-rose-50/70 text-rose-950'
              iconBadge = <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
            } else if (!mesLib) {
              borderClass =
                'border-slate-200/60 bg-slate-100/50 text-slate-400 opacity-60 cursor-not-allowed'
              iconBadge = <ShieldCheck className="w-3.5 h-3.5 text-slate-300 shrink-0" />
            }

            if (isAtivo) {
              borderClass += ' ring-2 ring-teal-600 ring-offset-1 font-semibold'
            }

            return (
              <button
                key={m}
                type="button"
                onClick={() => {
                  if (mesLib || st === 'sucesso') {
                    setMesAtivo(m)
                  } else {
                    toast({
                      title: `Mês ${m} bloqueado`,
                      description: `Complete a gravação do Mês ${m - 1} (${COLUNAS_MESES_12[m - 2]}) com sucesso para liberar este passo.`,
                      variant: 'destructive',
                    })
                  }
                }}
                className={`p-3 rounded-xl border text-left transition-all relative flex flex-col justify-between cursor-pointer ${borderClass}`}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="text-[11px] font-bold uppercase tracking-wider">Mês {m}</span>
                  {iconBadge}
                </div>

                <div className="mt-1">
                  <span className="text-xs font-semibold block truncate">
                    {COLUNAS_MESES_12[m - 1]}
                  </span>
                  <span className="text-[10px] text-slate-500 block mt-0.5 truncate">
                    {st === 'sucesso'
                      ? `${countGravados} gravados`
                      : st === 'erro'
                        ? 'Falha na gravação'
                        : parsedResult
                          ? `${lancsPlanilha} na coluna`
                          : mesLib
                            ? 'Liberado'
                            : 'Aguardando anterior'}
                  </span>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Bloco 4: Caixa de Ação do Mês Ativo */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 bg-teal-100 text-teal-800 text-xs font-bold rounded-md uppercase tracking-wider">
                Mês {mesAtivo} de 12
              </span>
              <h3 className="text-lg font-bold text-slate-900">
                {mesAtivoNome} de {anoExercicio}
              </h3>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {mesAtivoObj?.status === 'sucesso'
                ? `Este mês já foi gravado com sucesso (${mesAtivoObj.importadosCount} lançamentos). Você pode conferir os dados ou reimportar se necessário.`
                : liberado
                  ? parsedResult
                    ? `A coluna de ${mesAtivoNome} contém ${lancamentosValidosMesAtivo.length} lançamentos válidos prontos para serem gravados atômica e permanentemente.`
                    : 'Aguardando o upload da planilha anual preenchida no Passo 2.'
                  : `Passo bloqueado: O mês ${mesAtivo - 1} (${COLUNAS_MESES_12[mesAtivo - 2]}) precisa ter sua importação confirmada primeiro.`}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {parsedResult && lancamentosValidosMesAtivo.length > 0 && liberado && (
              <Button
                onClick={handleImportarMesAtivo}
                disabled={gravandoMes || !empresaId}
                className="bg-teal-700 hover:bg-teal-800 text-white font-medium text-xs h-9 px-4 gap-1.5 shadow-sm"
              >
                {gravandoMes ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Gravando {mesAtivoNome}...
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    Gravar {mesAtivoNome} e Liberar Próximo ({lancamentosValidosMesAtivo.length})
                  </>
                )}
              </Button>
            )}
          </div>
        </div>

        {/* Alerta de Mês Bloqueado */}
        {!liberado && (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3 text-amber-900">
            <ShieldCheck className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-1 text-xs">
              <p className="font-semibold text-amber-950 text-sm">
                Avanço bloqueado: complete o Mês {mesAtivo - 1} primeiro
              </p>
              <p className="text-amber-800">
                O fluxo sequencial exige que cada mês anterior esteja confirmado com sucesso antes
                de permitir gravar o mês seguinte.
              </p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setMesAtivo(mesAtivo - 1)}
                className="mt-2 bg-white border-amber-300 text-amber-900 hover:bg-amber-100 text-xs font-semibold gap-1.5"
              >
                Voltar para o Mês {mesAtivo - 1} ({COLUNAS_MESES_12[mesAtivo - 2]})
                <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        )}

        {/* Alerta de Erro na Gravação */}
        {mesAtivoObj?.status === 'erro' && (
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-3 text-rose-900">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div className="space-y-1 text-xs flex-1">
              <p className="font-semibold text-rose-950 text-sm">
                A gravação deste mês falhou (avanço bloqueado)
              </p>
              <p className="text-rose-800 leading-relaxed">
                {mesAtivoObj.erroMsg || 'Ocorreu um erro ao processar o lote no servidor.'}
              </p>
              <p className="text-[11px] text-rose-700">
                Nenhum lançamento foi gravado no banco de dados. Verifique a planilha ou tente
                gravar novamente.
              </p>
            </div>
          </div>
        )}

        {/* Alerta de Sucesso */}
        {mesAtivoObj?.status === 'sucesso' && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-emerald-950">
                  Mês {mesAtivo} ({mesAtivoNome}) gravado com sucesso!
                </p>
                <p className="text-xs text-emerald-700">
                  {mesAtivoObj.importadosCount} lançamentos persistidos. Valor total no mês:{' '}
                  <strong>
                    {new Intl.NumberFormat('pt-BR', {
                      style: 'currency',
                      currency: 'BRL',
                    }).format(mesAtivoObj.valorTotal || 0)}
                  </strong>
                </p>
              </div>
            </div>

            {mesAtivo < 12 && (
              <Button
                size="sm"
                onClick={() => setMesAtivo(mesAtivo + 1)}
                className="bg-emerald-700 hover:bg-emerald-800 text-white text-xs gap-1.5 shrink-0"
              >
                Avançar para o Mês {mesAtivo + 1} ({COLUNAS_MESES_12[mesAtivo]})
                <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>
        )}

        {/* Pré-visualização dos Lançamentos da Coluna do Mês */}
        {parsedResult && liberado && (
          <div className="space-y-4 pt-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h4 className="font-semibold text-slate-800 text-sm">
                  Lançamentos detectados na coluna de {mesAtivoNome} ({lancamentosMesAtivo.length}{' '}
                  registros)
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  <span className="text-emerald-700 font-semibold">
                    {lancamentosValidosMesAtivo.length} válidos
                  </span>
                  {lancamentosErrosMesAtivo.length > 0 && (
                    <span className="text-rose-600 font-semibold ml-2">
                      · {lancamentosErrosMesAtivo.length} com erro
                    </span>
                  )}
                  <span className="text-slate-500 ml-2">
                    · Valor total: R${' '}
                    {dadosMesAtivo?.totalValor.toLocaleString('pt-BR', {
                      minimumFractionDigits: 2,
                    })}
                  </span>
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setMostrarTabela(!mostrarTabela)}
                  className="text-xs text-slate-600 h-9"
                >
                  <Eye className="w-3.5 h-3.5 mr-1" />
                  {mostrarTabela ? 'Ocultar Tabela' : 'Ver Tabela'}
                </Button>
              </div>
            </div>

            {mostrarTabela && (
              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                {lancamentosMesAtivo.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-500">
                    Nenhum valor preenchido na coluna de {mesAtivoNome} para nenhuma conta contábil.
                  </div>
                ) : (
                  <div className="max-h-80 overflow-y-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-50 text-slate-600 font-semibold uppercase sticky top-0 border-b border-slate-200">
                        <tr>
                          <th className="py-2.5 px-3">Status</th>
                          <th className="py-2.5 px-3">Cód. Plano</th>
                          <th className="py-2.5 px-3">Conta</th>
                          <th className="py-2.5 px-3">Centro</th>
                          <th className="py-2.5 px-3">Competência</th>
                          <th className="py-2.5 px-3 text-right">Valor ({mesAtivoNome})</th>
                          <th className="py-2.5 px-3">Histórico</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {lancamentosMesAtivo.map((row, idx) => (
                          <tr
                            key={idx}
                            className={
                              row.status === 'erro' ? 'bg-rose-50/60' : 'hover:bg-slate-50/60'
                            }
                          >
                            <td className="py-2 px-3">
                              {row.status === 'valido' ? (
                                <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                                  <CheckCircle className="w-3 h-3" /> Válido
                                </span>
                              ) : (
                                <span
                                  className="inline-flex items-center gap-1 text-rose-600 font-medium"
                                  title={row.erro_msg}
                                >
                                  <AlertCircle className="w-3 h-3" /> {row.erro_msg}
                                </span>
                              )}
                            </td>
                            <td className="py-2 px-3 font-mono font-medium">
                              {row.codigo_pc || '-'}
                            </td>
                            <td className="py-2 px-3 font-medium text-slate-800">
                              {row.conta_nome || '-'}
                            </td>
                            <td className="py-2 px-3 text-slate-600">{row.centro_nome || '-'}</td>
                            <td className="py-2 px-3 font-mono text-slate-700">{row.data}</td>
                            <td className="py-2 px-3 text-right font-mono font-medium text-slate-900">
                              {new Intl.NumberFormat('pt-BR', {
                                style: 'currency',
                                currency: 'BRL',
                              }).format(row.valor)}
                            </td>
                            <td className="py-2 px-3 text-slate-500 max-w-xs truncate">
                              {row.historico || '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {!parsedResult && (
          <div className="p-8 text-center text-xs text-slate-500 bg-slate-50/50 rounded-xl border border-slate-200/80">
            <HelpCircle className="w-8 h-8 text-slate-400 mx-auto mb-2 opacity-70" />
            <p className="font-semibold text-slate-700">Aguardando upload da planilha anual</p>
            <p className="text-slate-500 mt-0.5 max-w-sm mx-auto">
              Baixe a planilha modelo no Passo 1, preencha as colunas dos 12 meses e envie no Passo
              2 para pré-visualizar e gravar este mês.
            </p>
          </div>
        )}
      </div>

      {/* Rodapé Informativo */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
        <div className="flex items-center gap-2">
          <Info className="w-4 h-4 text-teal-700 shrink-0" />
          <span>
            Cada mês é gravado em transação atômica única no banco de dados. Se houver falha, nada é
            gravado para aquele mês.
          </span>
        </div>
        {onIrParaLancamentos && (
          <Button
            variant="outline"
            size="sm"
            onClick={onIrParaLancamentos}
            className="bg-white border-slate-300 text-slate-700 hover:bg-slate-100 text-xs h-8 gap-1.5"
          >
            <FileText className="w-3.5 h-3.5" />
            Conferir Lançamentos da Empresa
          </Button>
        )}
      </div>
    </div>
  )
}

export default ImportarExcel12MesesColunas
