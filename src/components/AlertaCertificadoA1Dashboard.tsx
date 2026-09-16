import React, { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import {
  KeyRound,
  AlertCircle,
  AlertTriangle,
  Info,
  ArrowRight,
  RefreshCw,
  Calendar,
  FileCheck2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  certificadoA1Service,
  type DadosCertificadoA1,
  type StatusCertificadoResponse,
} from '@/services/certificadoA1Service'

interface AlertaCertificadoA1DashboardProps {
  isAdmin: boolean
  empresaId?: string | null
  empresaNome?: string | null
}

export const AlertaCertificadoA1Dashboard: React.FC<AlertaCertificadoA1DashboardProps> = ({
  isAdmin,
  empresaId,
  empresaNome,
}) => {
  // Requisito 4: Usuários não-admin não veem o banner e a chamada ao endpoint nem deve ser feita.
  if (!isAdmin) {
    return null
  }

  // Se nenhuma empresa estiver selecionada ou identificada, não tenta consultar
  if (!empresaId) {
    return null
  }

  return <AlertaCertificadoA1DashboardContent empresaId={empresaId} empresaNome={empresaNome} />
}

function AlertaCertificadoA1DashboardContent({
  empresaId,
  empresaNome,
}: {
  empresaId: string
  empresaNome?: string | null
}) {
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<StatusCertificadoResponse | null>(null)
  const [dispensado, setDispensado] = useState(false)

  const carregarStatus = useCallback(async () => {
    if (!empresaId) return
    try {
      setLoading(true)
      const resp = await certificadoA1Service.obterStatusCertificado(empresaId)
      setStatus(resp)
    } catch (err) {
      console.warn('Erro ao consultar status do certificado no dashboard:', err)
      setStatus(null)
    } finally {
      setLoading(false)
    }
  }, [empresaId])

  useEffect(() => {
    setDispensado(false)
    carregarStatus()
  }, [carregarStatus])

  if (dispensado || loading || !status) {
    return null
  }

  const { temCertificado, dados } = status

  // Caso 1: Certificado cadastrado
  if (temCertificado && dados) {
    const { estaExpirado, diasRestantes, validade_fim, nome_arquivo } = dados

    // (a) Expirado: Alerta Vermelho
    if (
      estaExpirado ||
      (diasRestantes !== null && diasRestantes !== undefined && diasRestantes < 0)
    ) {
      return (
        <div
          role="alert"
          className="rounded-xl border border-red-300 dark:border-red-900 bg-red-50/90 dark:bg-red-950/30 p-4 shadow-2xs text-red-950 dark:text-red-100 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 transition-all"
        >
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-900/60 text-red-700 dark:text-red-300 flex items-center justify-center shrink-0 shadow-inner">
              <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-extrabold text-sm sm:text-base tracking-tight text-red-900 dark:text-red-200">
                  Certificado Digital A1 Expirado
                </span>
                <Badge
                  variant="destructive"
                  className="text-[10px] font-bold uppercase tracking-wider bg-red-600 text-white"
                >
                  Expirado
                </Badge>
                {empresaNome && (
                  <span className="text-xs font-semibold text-red-800 dark:text-red-300">
                    · {empresaNome}
                  </span>
                )}
              </div>
              <p className="text-xs text-red-800/90 dark:text-red-300/90 leading-relaxed max-w-3xl">
                O certificado ICP-Brasil ({nome_arquivo || 'A1'}) venceu em{' '}
                <strong>{formatarData(validade_fim)}</strong>. A emissão de NFS-e no ambiente de
                Produção está bloqueada até o envio de um novo certificado válido.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto shrink-0 self-stretch md:self-auto justify-end">
            <Button
              asChild
              size="sm"
              className="bg-red-600 hover:bg-red-700 text-white font-semibold text-xs h-8 px-3.5 shadow-xs gap-1.5 w-full md:w-auto"
            >
              <Link to="/notas-fiscais?configNfse=1">
                <KeyRound className="w-3.5 h-3.5" />
                <span>Atualizar Certificado</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </Button>
          </div>
        </div>
      )
    }

    // (b) Vencimento em 30 dias ou menos: Alerta Âmbar com contagem de dias restantes
    if (diasRestantes !== null && diasRestantes !== undefined && diasRestantes <= 30) {
      const textoDias =
        diasRestantes === 0
          ? 'vence hoje'
          : diasRestantes === 1
            ? 'vence amanhã (1 dia restante)'
            : `faltam ${diasRestantes} dias para vencer`

      return (
        <div
          role="alert"
          className="rounded-xl border border-amber-300 dark:border-amber-900 bg-amber-50/90 dark:bg-amber-950/30 p-4 shadow-2xs text-amber-950 dark:text-amber-100 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 transition-all"
        >
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0 shadow-inner">
              <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-extrabold text-sm sm:text-base tracking-tight text-amber-900 dark:text-amber-200">
                  Certificado Digital A1 Próximo do Vencimento
                </span>
                <Badge className="bg-amber-500 hover:bg-amber-600 text-white text-[10px] font-bold uppercase tracking-wider">
                  {textoDias}
                </Badge>
                {empresaNome && (
                  <span className="text-xs font-semibold text-amber-800 dark:text-amber-300">
                    · {empresaNome}
                  </span>
                )}
              </div>
              <p className="text-xs text-amber-800/90 dark:text-amber-300/90 leading-relaxed max-w-3xl">
                O Certificado Digital A1 ({nome_arquivo || 'ICP-Brasil'}) expira em{' '}
                <strong>{formatarData(validade_fim)}</strong> ({textoDias}). Renove antecipadamente
                com a sua Autoridade Certificadora para evitar interrupção na emissão de NFS-e
                Nacional.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto shrink-0 self-stretch md:self-auto justify-end">
            <Button
              asChild
              size="sm"
              className="bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs h-8 px-3.5 shadow-xs gap-1.5 w-full md:w-auto"
            >
              <Link to="/notas-fiscais?configNfse=1">
                <KeyRound className="w-3.5 h-3.5" />
                <span>Renovar Certificado</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </Button>
          </div>
        </div>
      )
    }

    // Se estiver válido e com mais de 30 dias, não polui o Dashboard
    return null
  }

  // Caso 2: Não há certificado cadastrado — tom informativo/neutro (não alarmante)
  return (
    <div
      role="status"
      className="rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-4 shadow-2xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4 transition-all"
    >
      <div className="flex items-start gap-3.5">
        <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 flex items-center justify-center shrink-0 border border-blue-100 dark:border-blue-900">
          <KeyRound className="w-5 h-5 text-blue-600 dark:text-blue-400" />
        </div>
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-sm sm:text-base tracking-tight text-[#0B1F3A] dark:text-slate-100">
              Certificado Digital A1 Não Configurado
            </span>
            <Badge
              variant="outline"
              className="text-[10px] font-bold text-blue-700 border-blue-200 bg-blue-50/60 dark:bg-blue-950/40"
            >
              Modo Homologação / Simulação
            </Badge>
            {empresaNome && (
              <span className="text-xs text-slate-500 font-medium">· {empresaNome}</span>
            )}
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed max-w-3xl">
            A emissão de NFS-e Nacional está operando em modo de{' '}
            <strong>Homologação/Simulação</strong>. Para emitir notas oficiais com valor fiscal na
            Receita Federal, faça o upload do Certificado Digital A1 (.pfx / .p12) nas configurações
            do emissor.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 w-full md:w-auto shrink-0 self-stretch md:self-auto justify-end">
        <Button
          asChild
          size="sm"
          variant="outline"
          className="border-blue-200 text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950 font-semibold text-xs h-8 px-3.5 shadow-2xs gap-1.5 w-full md:w-auto"
        >
          <Link to="/notas-fiscais?configNfse=1">
            <FileCheck2 className="w-3.5 h-3.5 text-blue-600" />
            <span>Configurar Certificado</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </Button>
      </div>
    </div>
  )
}

function formatarData(isoStr?: string | null): string {
  if (!isoStr) return 'Data não informada'
  try {
    const dt = new Date(isoStr)
    if (isNaN(dt.getTime())) return isoStr
    return dt.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
  } catch {
    return isoStr
  }
}

export default AlertaCertificadoA1Dashboard
