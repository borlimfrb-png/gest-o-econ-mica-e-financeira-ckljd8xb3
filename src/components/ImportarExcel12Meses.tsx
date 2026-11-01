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
  gerarPlanilhaModeloImportacaoExcel,
  parsePlanilhaLancamentosExcel,
  type LinhaExcelValidada,
} from '@/lib/modeloImportacaoExcel'
import type { EmpresaRecord, PlanoContaRecord } from '@/types/finance'

export interface ImportarExcel12MesesProps {
  empresas: EmpresaRecord[]
  planoContas: PlanoContaRecord[]
  empresaAtivaId?: string
  isGrupoAtivo?: boolean
  grupoNome?: string
  onIrParaLancamentos?: () => void
}

export interface MesStatus {
  mes: number // 1 a 12
  status: 'pendente' | 'em_andamento' | 'sucesso' | 'erro'
  importadosCount?: number
  valorTotal?: number
  arquivoNome?: string
  dataExecucao?: string
  erroMsg?: string
}

export const NOMES_MESES_EXTENSO = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
]

export function ImportarExcel12Meses({
  empresas,
  planoContas,
  empresaAtivaId,
  isGrupoAtivo,
  grupoNome,
  onIrParaLancamentos,
}: ImportarExcel12MesesProps) {
  const { toast } = useToast()

  // 1. Empresa e Ano do Exercício
  const [empresaId, setEmpresaId] = useState<string>(() => {
    if (empresaAtivaId && !empresaAtivaId.startsWith('grupo-')) return empresaAtivaId
    return empresas[0]?.id || ''
  })

  // Sincroniza se a empresa ativa mudar no topo
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

  // 2. Chave de persistência local para retomar de onde parou sem reimportar meses que já deram certo
  const storageKey = useMemo(() => {
    return `borlim_import_12m_${empresaId || 'geral'}_${anoExercicio}`
  }, [empresaId, anoExercicio])

  // Estado dos 12 meses
  const [mesesStatus, setMesesStatus] = useState<Record<number, MesStatus>>(() => {
    return criarEstadoInicialMeses()
  })

  // Mês atual que o usuário está executando (1 a 12)
  const [mesAtivo, setMesAtivo] = useState<number>(1)

  // Carrega progresso salvo no localStorage
  useEffect(() => {
    if (!storageKey) return
    try {
      const saved = localStorage.getItem(storageKey)
      if (saved) {
        const parsed = JSON.parse(saved) as {
          mesesStatus: Record<number, MesStatus>
          mesAtivo?: number
        }
        if (parsed?.mesesStatus) {
          setMesesStatus(parsed.mesesStatus)
          // Se tiver mesAtivo salvo, valida se faz sentido
          if (parsed.mesAtivo && parsed.mesAtivo >= 1 && parsed.mesAtivo <= 12) {
            setMesAtivo(parsed.mesAtivo)
          } else {
            // Descobre o primeiro mês pendente ou com erro
            const primeiroPendente = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].find(
              (m) => parsed.mesesStatus[m]?.status !== 'sucesso',
            )
            setMesAtivo(primeiroPendente || 12)
          }
          return
        }
      }
    } catch (err) {
      console.warn('Falha ao restaurar progresso 12 meses:', err)
    }

    // Caso não haja nada salvo, reinicia para o estado inicial
    setMesesStatus(criarEstadoInicialMeses())
    setMesAtivo(1)
  }, [storageKey])

  // Salva no localStorage quando o status ou mesAtivo mudar
  const salvarProgresso = (novosMeses: Record<number, MesStatus>, novoMesAtivo: number) => {
    try {
      localStorage.setItem(
        storageKey,
        JSON.stringify({
          mesesStatus: novosMeses,
          mesAtivo: novoMesAtivo,
          ultimaAtualizacao: new Date().toISOString(),
        }),
      )
    } catch (err) {
      console.warn('Erro ao salvar progresso 12 meses:', err)
    }
  }

  function criarEstadoInicialMeses(): Record<number, MesStatus> {
    const mapa: Record<number, MesStatus> = {}
    for (let m = 1; m <= 12; m++) {
      mapa[m] = {
        mes: m,
        status: 'pendente',
      }
    }
    return mapa
  }

  // 3. Estado da importação do arquivo no mês ativo
  const [arquivoMes, setArquivoMes] = useState<File | null>(null)
  const [linhasValidadas, setLinhasValidadas] = useState<LinhaExcelValidada[]>([])
  const [importandoLote, setImportandoLote] = useState(false)
  const [baixandoModelo, setBaixandoModelo] = useState(false)
  const [mostrarPreview, setMostrarPreview] = useState(true)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Resumo de contagem de meses concluídos
  const totalMesesSucesso = useMemo(() => {
    return Object.values(mesesStatus).filter((m) => m.status === 'sucesso').length
  }, [mesesStatus])

  const valorTotalAcumuladoAno = useMemo(() => {
    return Object.values(mesesStatus).reduce((acc, curr) => acc + (curr.valorTotal || 0), 0)
  }, [mesesStatus])

  // Determina se um mês está liberado para ser importado
  // Regra fundamental: Mês 1 sempre liberado. Mês N só é liberado se Mês N-1 estiver com 'sucesso'.
  const isMesLiberado = (mes: number) => {
    if (mes === 1) return true
    return mesesStatus[mes - 1]?.status === 'sucesso'
  }

  // Limpa arquivo selecionado ao trocar de mês ativo
  useEffect(() => {
    setArquivoMes(null)
    setLinhasValidadas([])
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }, [mesAtivo])

  // 4. Download da Planilha Modelo para o mês ativo
  const handleBaixarModeloMes = async (mesAlvo: number) => {
    setBaixandoModelo(true)
    try {
      const empObj = empresas.find((e) => e.id === empresaId)
      const nomeEntidade =
        empObj?.nome_fantasia ||
        empObj?.razao_social ||
        (isGrupoAtivo && grupoNome ? grupoNome : undefined)

      // Busca plano de contas filtrado
      let contasDoPlano = planoContas || []
      if (empresaId) {
        try {
          contasDoPlano = await financeService.getPlanoContas({ empresaId })
        } catch {
          contasDoPlano = planoContas || []
        }
      }

      const { totalContas, nomeArquivo } = gerarPlanilhaModeloImportacaoExcel({
        planoContas: contasDoPlano,
        nomeEmpresaOuGrupo: nomeEntidade,
        anoReferencia: anoExercicio,
        mesReferencia: mesAlvo,
      })

      toast({
        title: `Planilha Modelo de ${NOMES_MESES_EXTENSO[mesAlvo - 1]} gerada! 📊`,
        description: `Arquivo "${nomeArquivo}" baixado com ${totalContas} contas do plano e data padrão para ${anoExercicio}.`,
      })
    } catch (err: unknown) {
      const error = err as Error
      toast({
        title: 'Erro ao gerar modelo',
        description: error.message || 'Falha ao montar o arquivo modelo.',
        variant: 'destructive',
      })
    } finally {
      setBaixandoModelo(false)
    }
  }

  // 5. Leitura e Parsing do Arquivo Excel do Mês
  const handleProcessarArquivo = (file: File) => {
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

    setArquivoMes(file)

    const reader = new FileReader()
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result
        const wb = XLSX.read(bstr, { type: 'binary', cellDates: true })
        const wsname = wb.SheetNames[0]
        const ws = wb.Sheets[wsname]
        const rawData = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws)

        if (rawData.length === 0) {
          toast({
            title: 'Arquivo vazio',
            description: 'A planilha não contém dados para importar.',
            variant: 'destructive',
          })
          setLinhasValidadas([])
          return
        }

        // Valida as linhas exigindo compatibilidade com o mês ativo e ano do exercício
        const validadas = parsePlanilhaLancamentosExcel(rawData, planoContas, {
          mesObrigatorio: mesAtivo,
          anoObrigatorio: anoExercicio,
        })

        setLinhasValidadas(validadas)

        const validasCount = validadas.filter((r) => r.status === 'valido').length
        const errosCount = validadas.filter((r) => r.status === 'erro').length

        if (errosCount > 0 && validasCount === 0) {
          toast({
            title: `Planilha com inconsistências (${errosCount} erros)`,
            description: `Nenhuma linha válida encontrada para ${NOMES_MESES_EXTENSO[mesAtivo - 1]}/${anoExercicio}. Confira as mensagens abaixo.`,
            variant: 'destructive',
          })
        } else if (errosCount > 0) {
          toast({
            title: 'Atenção aos registros com erro',
            description: `${validasCount} linhas válidas e ${errosCount} com erro. Apenas as válidas serão importadas.`,
          })
        } else {
          toast({
            title: 'Planilha lida com sucesso!',
            description: `${validasCount} lançamentos válidos prontos para importação em ${NOMES_MESES_EXTENSO[mesAtivo - 1]}/${anoExercicio}.`,
          })
        }
      } catch (err: unknown) {
        const error = err as Error
        toast({
          title: 'Erro ao ler arquivo Excel',
          description: error.message || 'Verifique o formato da planilha.',
          variant: 'destructive',
        })
        setLinhasValidadas([])
      }
    }
    reader.readAsBinaryString(file)
  }

  // 6. Confirmação e Gravação Atômica do Mês
  const handleImportarMesAtivo = async () => {
    if (!empresaId) {
      toast({
        title: 'Selecione uma empresa',
        description: 'É obrigatório selecionar a empresa de destino.',
        variant: 'destructive',
      })
      return
    }

    if (!isMesLiberado(mesAtivo)) {
      toast({
        title: 'Mês bloqueado',
        description: `O mês anterior (${NOMES_MESES_EXTENSO[mesAtivo - 2]}) precisa ser importado com sucesso antes de liberar o mês ${mesAtivo}.`,
        variant: 'destructive',
      })
      return
    }

    const validRows = linhasValidadas.filter((r) => r.status === 'valido' && r.plano_conta_id)
    if (validRows.length === 0) {
      toast({
        title: 'Nenhum lançamento válido',
        description: 'Corrija os erros na planilha antes de confirmar a importação.',
        variant: 'destructive',
      })
      return
    }

    setImportandoLote(true)

    try {
      const loteParaGravar = validRows.map((row) => ({
        plano_conta: row.plano_conta_id!,
        data: row.data,
        valor: row.valor,
        historico:
          row.historico ||
          `Importado 12 Meses (${NOMES_MESES_EXTENSO[mesAtivo - 1]}/${anoExercicio}) - ${arquivoMes?.name || 'planilha.xlsx'}`,
      }))

      const valorTotalMes = validRows.reduce((acc, r) => acc + r.valor, 0)

      // Gravação atômica via endpoint do backend
      const resLote = await financeService.importarLancamentosLote({
        empresaId,
        lancamentos: loteParaGravar,
        origem: 'importacao_excel_12_meses',
        arquivoNome: arquivoMes?.name || `mes_${mesAtivo}_${anoExercicio}.xlsx`,
        periodoInicio: `${anoExercicio}-${String(mesAtivo).padStart(2, '0')}-01`,
        periodoFim: `${anoExercicio}-${String(mesAtivo).padStart(2, '0')}-28`,
      })

      // Atualiza status do mês ativo para 'sucesso'
      const novosMeses: Record<number, MesStatus> = {
        ...mesesStatus,
        [mesAtivo]: {
          mes: mesAtivo,
          status: 'sucesso',
          importadosCount: resLote.totalItens,
          valorTotal: valorTotalMes,
          arquivoNome: arquivoMes?.name,
          dataExecucao: new Date().toISOString(),
        },
      }

      // Determina próximo mês
      const proximoMes = mesAtivo < 12 ? mesAtivo + 1 : mesAtivo

      setMesesStatus(novosMeses)
      salvarProgresso(novosMeses, proximoMes)

      toast({
        title: `Mês ${mesAtivo} (${NOMES_MESES_EXTENSO[mesAtivo - 1]}) concluído com sucesso! 🎉`,
        description: `${resLote.totalItens} lançamentos gravados em lote único atômico.${mesAtivo < 12 ? ` O Mês ${proximoMes} (${NOMES_MESES_EXTENSO[proximoMes - 1]}) agora foi liberado!` : ' Todos os 12 meses do ciclo foram concluídos!'}`,
      })

      // Avança automaticamente para o próximo mês liberado
      if (mesAtivo < 12) {
        setMesAtivo(proximoMes)
      }
    } catch (err: unknown) {
      const error = err as Error
      const erroMsg =
        error.message ||
        'Ocorreu um erro no processamento do lote. Nenhum lançamento foi gravado no banco de dados.'

      // Registra o erro no mês ativo (sem avançar para o próximo)
      const novosMeses: Record<number, MesStatus> = {
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
        title: `Falha na importação do mês ${mesAtivo} (avanço bloqueado)`,
        description: erroMsg,
        variant: 'destructive',
      })
    } finally {
      setImportandoLote(false)
    }
  }

  // 7. Reiniciar Ciclo Completo de 12 Meses
  const handleReiniciarCiclo = () => {
    if (
      window.confirm(
        `Tem certeza que deseja reiniciar o ciclo de 12 meses para o exercício de ${anoExercicio}? Isso limpará o controle visual local de progresso desta empresa. Os lançamentos já persistidos no banco de dados continuarão gravados.`,
      )
    ) {
      const inicial = criarEstadoInicialMeses()
      setMesesStatus(inicial)
      setMesAtivo(1)
      setArquivoMes(null)
      setLinhasValidadas([])
      salvarProgresso(inicial, 1)
      toast({
        title: 'Ciclo reiniciado',
        description: `O assistente de 12 meses para ${anoExercicio} foi reiniciado para o Mês 1.`,
      })
    }
  }

  // 8. Reimportar/Reprocessar um mês já concluído
  const handleReabrirMes = (m: number) => {
    setMesAtivo(m)
  }

  const mesAtivoObj = mesesStatus[mesAtivo]
  const mesAtivoNome = NOMES_MESES_EXTENSO[mesAtivo - 1]
  const liberado = isMesLiberado(mesAtivo)

  return (
    <div className="space-y-6">
      {/* Banner Explicativo do Fluxo Guiado */}
      <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white rounded-2xl p-6 shadow-md relative overflow-hidden">
        <div className="absolute right-0 top-0 -mt-8 -mr-8 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-500/20 text-blue-300 border border-blue-500/30 rounded-full text-xs font-semibold uppercase tracking-wider">
              <Calendar className="w-3.5 h-3.5 text-blue-400" />
              Assistente de 12 Meses Passo a Passo
            </div>
            <h2 className="text-2xl font-bold text-white tracking-tight">
              Importação Anual Mês a Mês ({anoExercicio})
            </h2>
            <p className="text-slate-300 text-sm leading-relaxed">
              Importe o exercício completo fazendo <strong>um mês de cada vez</strong>. O sistema só
              libera o mês seguinte após a confirmação de que o mês anterior deu certo, garantindo a
              integridade contábil e permitindo retomar de onde parou a qualquer momento.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="bg-white/10 backdrop-blur-xs border border-white/10 rounded-xl p-3 text-center sm:text-right">
              <span className="text-xs text-blue-200 block">Progresso do Ciclo</span>
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

      {/* Controles de Configuração da Importação: Empresa e Ano */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
        <div className="space-y-1.5 md:col-span-2">
          <Label
            htmlFor="empresa12m"
            className="text-xs font-semibold text-slate-700 flex items-center gap-1.5"
          >
            <Building2 className="w-4 h-4 text-slate-500" />
            Empresa de Destino *
          </Label>
          <Select value={empresaId} onValueChange={setEmpresaId}>
            <SelectTrigger id="empresa12m" className="bg-white">
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
            htmlFor="ano12m"
            className="text-xs font-semibold text-slate-700 flex items-center gap-1.5"
          >
            <Calendar className="w-4 h-4 text-slate-500" />
            Exercício / Ano *
          </Label>
          <Select
            value={String(anoExercicio)}
            onValueChange={(v) => setAnoExercicio(parseInt(v, 10))}
          >
            <SelectTrigger id="ano12m" className="bg-white">
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

      {/* Régua Visual dos 12 Meses (Passo a Passo com Status e Travas) */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-slate-800 text-sm flex items-center gap-2">
              <span>Etapas do Exercício {anoExercicio}</span>
              <span className="text-xs bg-slate-100 text-slate-700 font-mono px-2 py-0.5 rounded-full border border-slate-200">
                Mês {mesAtivo} de 12
              </span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Clique em um mês liberado para visualizar detalhes ou importar seu lote.
            </p>
          </div>

          {valorTotalAcumuladoAno > 0 && (
            <div className="text-right">
              <span className="text-xs text-slate-500 block">Total já importado no ano:</span>
              <span className="text-sm font-bold text-emerald-700 font-mono">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                  valorTotalAcumuladoAno,
                )}
              </span>
            </div>
          )}
        </div>

        {/* Grid com os 12 botões de meses */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5 pt-2">
          {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => {
            const st = mesesStatus[m]?.status || 'pendente'
            const isAtivo = mesAtivo === m
            const mesLib = isMesLiberado(m)
            const count = mesesStatus[m]?.importadosCount || 0

            let borderClass = 'border-slate-200 bg-slate-50 text-slate-600'
            let iconBadge = <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />

            if (st === 'sucesso') {
              borderClass = 'border-emerald-300 bg-emerald-50/60 text-emerald-900'
              iconBadge = <CheckCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            } else if (st === 'erro') {
              borderClass = 'border-rose-300 bg-rose-50/60 text-rose-900'
              iconBadge = <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
            } else if (!mesLib) {
              borderClass =
                'border-slate-200/60 bg-slate-100/50 text-slate-400 opacity-60 cursor-not-allowed'
              iconBadge = <ShieldCheck className="w-3.5 h-3.5 text-slate-300 shrink-0" />
            }

            if (isAtivo) {
              borderClass += ' ring-2 ring-blue-600 ring-offset-1 font-semibold'
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
                      description: `Complete a importação do Mês ${m - 1} (${NOMES_MESES_EXTENSO[m - 2]}) com sucesso para liberar este passo.`,
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
                    {NOMES_MESES_EXTENSO[m - 1]}
                  </span>
                  <span className="text-[10px] text-slate-500 block mt-0.5">
                    {st === 'sucesso'
                      ? `${count} lançamentos`
                      : st === 'erro'
                        ? 'Falha / Pendente'
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

      {/* Caixa de Ação do Mês Ativo */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 bg-blue-100 text-blue-800 text-xs font-bold rounded-md uppercase tracking-wider">
                Passo {mesAtivo} de 12
              </span>
              <h3 className="text-lg font-bold text-slate-900">
                {mesAtivoNome} de {anoExercicio}
              </h3>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {mesAtivoObj?.status === 'sucesso'
                ? `Este mês já foi importado com sucesso (${mesAtivoObj.importadosCount} lançamentos). Você pode baixar o modelo ou reimportar se necessário.`
                : liberado
                  ? `Baixe a planilha modelo de ${mesAtivoNome}, preencha os lançamentos e faça o upload abaixo para validar e gravar.`
                  : `Passo bloqueado: O mês ${mesAtivo - 1} (${NOMES_MESES_EXTENSO[mesAtivo - 2]}) precisa ter sua importação confirmada primeiro.`}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleBaixarModeloMes(mesAtivo)}
              disabled={baixandoModelo || !empresaId}
              className="bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100 gap-1.5 text-xs font-medium"
            >
              {baixandoModelo ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Gerando Modelo...
                </>
              ) : (
                <>
                  <Download className="w-3.5 h-3.5" />
                  Baixar Modelo de {mesAtivoNome}
                </>
              )}
            </Button>
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
                Conforme a regra do fluxo guiado de 12 meses, só é permitido avançar para o mês
                seguinte após a confirmação com sucesso do mês anterior.
              </p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setMesAtivo(mesAtivo - 1)}
                className="mt-2 bg-white border-amber-300 text-amber-900 hover:bg-amber-100 text-xs font-semibold gap-1.5"
              >
                Voltar para o Mês {mesAtivo - 1} ({NOMES_MESES_EXTENSO[mesAtivo - 2]})
                <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        )}

        {/* Alerta de Mês com Erro Anterior */}
        {mesAtivoObj?.status === 'erro' && (
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-3 text-rose-900">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div className="space-y-1 text-xs flex-1">
              <p className="font-semibold text-rose-950 text-sm">
                A importação anterior deste mês falhou (avanço travado)
              </p>
              <p className="text-rose-800 leading-relaxed">
                {mesAtivoObj.erroMsg || 'Ocorreu um erro ao processar o lote no servidor.'}
              </p>
              <p className="text-[11px] text-rose-700">
                Nenhum lançamento foi gravado no banco de dados. Corrija o arquivo e envie novamente
                para tentar de novo e liberar o mês seguinte.
              </p>
            </div>
          </div>
        )}

        {/* Alerta de Sucesso do Mês */}
        {mesAtivoObj?.status === 'sucesso' && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-emerald-950">
                  Mês {mesAtivo} ({mesAtivoNome}) importado com sucesso!
                </p>
                <p className="text-xs text-emerald-700">
                  {mesAtivoObj.importadosCount} lançamentos registrados. Valor acumulado no mês:{' '}
                  <strong>
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                      mesAtivoObj.valorTotal || 0,
                    )}
                  </strong>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {mesAtivo < 12 && (
                <Button
                  size="sm"
                  onClick={() => setMesAtivo(mesAtivo + 1)}
                  className="bg-emerald-700 hover:bg-emerald-800 text-white text-xs gap-1.5"
                >
                  Ir para o Mês {mesAtivo + 1} ({NOMES_MESES_EXTENSO[mesAtivo]})
                  <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Área de Upload (disponível se liberado) */}
        {liberado && (
          <div className="space-y-4">
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
                  handleProcessarArquivo(e.dataTransfer.files[0])
                }
              }}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center cursor-pointer transition-all ${
                dragOver
                  ? 'border-blue-500 bg-blue-50/60 scale-[1.01]'
                  : 'border-slate-300 hover:border-blue-400 bg-slate-50/60 hover:bg-blue-50/20'
              }`}
            >
              <input
                type="file"
                ref={fileInputRef}
                onChange={(e) => e.target.files?.[0] && handleProcessarArquivo(e.target.files[0])}
                accept=".xlsx, .xls, .csv"
                className="hidden"
              />

              <div className="w-14 h-14 rounded-full bg-blue-50 border border-blue-100 text-blue-600 flex items-center justify-center mb-3 shadow-xs">
                <FileSpreadsheet className="w-7 h-7" />
              </div>

              <h4 className="text-base font-bold text-slate-800">
                {arquivoMes
                  ? `Arquivo selecionado: ${arquivoMes.name}`
                  : `Selecione a planilha de ${mesAtivoNome} (${anoExercicio})`}
              </h4>
              <p className="text-xs text-slate-500 mt-1 max-w-md text-center">
                Arraste o arquivo .xlsx preenchido ou clique para selecionar. As datas devem
                pertencer ao mês {mesAtivo} de {anoExercicio}.
              </p>

              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-4 border-blue-200 text-blue-700 bg-white hover:bg-blue-50 shadow-xs font-medium text-xs"
              >
                <Upload className="w-3.5 h-3.5 mr-1.5 text-blue-600" />
                {arquivoMes ? 'Trocar Planilha' : 'Selecionar Arquivo'}
              </Button>
            </div>

            {/* Pré-visualização das Linhas Validadas */}
            {linhasValidadas.length > 0 && (
              <div className="space-y-4 pt-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h4 className="font-semibold text-slate-800 text-sm">
                      Pré-visualização do Mês {mesAtivo} ({linhasValidadas.length} registros)
                    </h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                      <span className="text-emerald-700 font-semibold">
                        {linhasValidadas.filter((r) => r.status === 'valido').length} válidos
                      </span>
                      {linhasValidadas.some((r) => r.status === 'erro') && (
                        <span className="text-rose-600 font-semibold ml-2">
                          · {linhasValidadas.filter((r) => r.status === 'erro').length} com erro
                        </span>
                      )}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setMostrarPreview(!mostrarPreview)}
                      className="text-xs text-slate-600 h-9"
                    >
                      <Eye className="w-3.5 h-3.5 mr-1" />
                      {mostrarPreview ? 'Ocultar Tabela' : 'Ver Tabela'}
                    </Button>
                    <Button
                      onClick={handleImportarMesAtivo}
                      disabled={
                        importandoLote ||
                        !empresaId ||
                        linhasValidadas.filter((r) => r.status === 'valido').length === 0
                      }
                      className="bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs h-9 px-4 gap-1.5 shadow-sm"
                    >
                      {importandoLote ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          Gravando Mês {mesAtivo}...
                        </>
                      ) : (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          Confirmar Mês {mesAtivo} e Liberar Próximo (
                          {linhasValidadas.filter((r) => r.status === 'valido').length})
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                {mostrarPreview && (
                  <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                    <div className="max-h-80 overflow-y-auto">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-slate-50 text-slate-600 font-semibold uppercase sticky top-0 border-b border-slate-200">
                          <tr>
                            <th className="py-2.5 px-3">Status</th>
                            <th className="py-2.5 px-3">Cód. Plano</th>
                            <th className="py-2.5 px-3">Conta</th>
                            <th className="py-2.5 px-3">Centro</th>
                            <th className="py-2.5 px-3">Data</th>
                            <th className="py-2.5 px-3 text-right">Valor</th>
                            <th className="py-2.5 px-3">Histórico</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {linhasValidadas.map((row, idx) => (
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
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Rodapé com Atalhos para Lançamentos / Conferência */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
        <div className="flex items-center gap-2">
          <Info className="w-4 h-4 text-blue-600 shrink-0" />
          <span>
            Os dados de cada mês são persistidos atômica e permanentemente na collection de
            lançamentos.
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
export default ImportarExcel12Meses
