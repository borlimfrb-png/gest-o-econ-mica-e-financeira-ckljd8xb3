import React, { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import {
  ShieldCheck,
  ShieldAlert,
  Calendar,
  Lock,
  ArrowRight,
  RotateCw,
  Layers,
  CheckCircle2,
  XCircle,
  ExternalLink,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  auditoriaSegurancaService,
  type AuditoriaSegurancaRecord,
  type DetalheAuditoriaColecao,
} from '@/services/auditoriaSegurancaService'
import { useRealtime } from '@/hooks/use-realtime'

interface WidgetAuditoriaSegurancaProps {
  isAdmin: boolean
}

export const WidgetAuditoriaSeguranca: React.FC<WidgetAuditoriaSegurancaProps> = ({ isAdmin }) => {
  // Se não for admin, nunca busca nem renderiza nada
  if (!isAdmin) {
    return null
  }

  return <WidgetAuditoriaSegurancaContent />
}

function WidgetAuditoriaSegurancaContent() {
  const [loading, setLoading] = useState(true)
  const [ultimaAuditoria, setUltimaAuditoria] = useState<AuditoriaSegurancaRecord | null>(null)

  const carregarUltimaAuditoria = useCallback(async () => {
    try {
      setLoading(true)
      const audit = await auditoriaSegurancaService.obterUltima()
      setUltimaAuditoria(audit)
    } catch (err) {
      console.error('Erro ao buscar última auditoria de segurança:', err)
      setUltimaAuditoria(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    carregarUltimaAuditoria()
  }, [carregarUltimaAuditoria])

  // Realtime para atualizar instantaneamente quando uma auditoria for executada (manual ou cron)
  useRealtime<AuditoriaSegurancaRecord>('auditoria_seguranca', () => {
    carregarUltimaAuditoria()
  })

  // Formatador de data e hora amigável em PT-BR
  const formatarDataHora = (dataIso?: string, createdIso?: string) => {
    if (createdIso) {
      try {
        const d = new Date(createdIso)
        if (!isNaN(d.getTime())) {
          return new Intl.DateTimeFormat('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          }).format(d)
        }
      } catch {
        /* fallback abaixo */
      }
    }
    if (dataIso) {
      try {
        const partes = dataIso.split('-')
        if (partes.length === 3) {
          return `${partes[2]}/${partes[1]}/${partes[0]}`
        }
      } catch {
        /* fallback */
      }
      return dataIso
    }
    return '-'
  }

  // Lista de divergências parsed
  const detalhesArray: DetalheAuditoriaColecao[] = Array.isArray(ultimaAuditoria?.detalhes)
    ? (ultimaAuditoria?.detalhes as DetalheAuditoriaColecao[])
    : []

  const divergencias = detalhesArray.filter((d) => !d.conforme)
  const divergenciasAmostra = divergencias.slice(0, 3)

  const isOk =
    ultimaAuditoria?.status_geral === 'ok' && (ultimaAuditoria?.total_divergencias ?? 0) === 0

  return (
    <Card className="bg-white border-slate-200 shadow-2xs overflow-hidden">
      <CardHeader className="p-4 pb-3 border-b border-slate-100 bg-slate-50/60">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-[#0B1F3A] text-white shadow-xs">
              <Lock className="w-4 h-4 text-blue-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <CardTitle className="text-sm font-bold text-[#0B1F3A]">
                  Auditoria de Segurança & Perfis
                </CardTitle>
                <Badge
                  variant="outline"
                  className="text-[10px] font-bold bg-blue-50 text-blue-700 border-blue-200"
                >
                  Admin
                </Badge>
              </div>
              <CardDescription className="text-xs text-slate-500 mt-0.5">
                Resumo da conformidade das regras de acesso (RLS) e isolamento multi-tenant
              </CardDescription>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={carregarUltimaAuditoria}
              disabled={loading}
              className="h-8 px-2.5 text-xs text-slate-600 hover:text-slate-900 gap-1.5"
              title="Atualizar dados da auditoria"
            >
              <RotateCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Atualizar</span>
            </Button>
            <Button
              asChild
              size="sm"
              variant="outline"
              className="h-8 text-xs font-semibold text-blue-700 hover:text-blue-800 bg-white hover:bg-blue-50 border-blue-200 gap-1.5 shadow-2xs"
            >
              <Link to="/admin/auditoria">
                <span>Ver auditoria completa</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-4">
        {loading && !ultimaAuditoria ? (
          <div className="flex items-center justify-center py-6 text-xs text-slate-500 gap-2">
            <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <span>Consultando status da auditoria de segurança...</span>
          </div>
        ) : !ultimaAuditoria ? (
          /* Estado Vazio Amigável */
          <div className="p-4 sm:p-5 rounded-xl bg-slate-50/80 border border-dashed border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start sm:items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-100/70 text-blue-700 flex items-center justify-center shrink-0">
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-900">
                  Nenhuma verificação executada até o momento
                </p>
                <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                  A primeira verificação automática roda no dia 1 de cada mês às 06h. Você também
                  pode disparar uma verificação manual sob demanda agora mesmo.
                </p>
              </div>
            </div>

            <Button
              asChild
              size="sm"
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs h-8 px-3 shrink-0 shadow-xs gap-1.5"
            >
              <Link to="/admin/auditoria">
                <span>Disparar Verificação Manual</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </Link>
            </Button>
          </div>
        ) : (
          /* Conteúdo com a última verificação registrada */
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Status Geral */}
              <div
                className={`p-3 rounded-xl border flex items-center gap-3 ${
                  isOk
                    ? 'bg-emerald-50/70 border-emerald-200/90 text-emerald-950'
                    : 'bg-red-50/70 border-red-200/90 text-red-950'
                }`}
              >
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    isOk ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                  }`}
                >
                  {isOk ? <ShieldCheck className="w-5 h-5" /> : <ShieldAlert className="w-5 h-5" />}
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                    Status Geral
                  </span>
                  <p
                    className={`text-sm font-bold truncate ${
                      isOk ? 'text-emerald-700' : 'text-red-700'
                    }`}
                  >
                    {isOk ? 'Tudo conforme' : 'Divergências detectadas'}
                  </p>
                  <span className="text-[10px] text-slate-500 truncate block">
                    {isOk ? 'Regras RLS 100% íntegras' : 'Ação de segurança recomendada'}
                  </span>
                </div>
              </div>

              {/* Data da Última Verificação */}
              <div className="p-3 rounded-xl border border-slate-200/90 bg-slate-50/40 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center shrink-0">
                  <Calendar className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                    Última Verificação
                  </span>
                  <p className="text-sm font-bold text-slate-900 truncate">
                    {formatarDataHora(ultimaAuditoria.data_verificacao, ultimaAuditoria.created)}
                  </p>
                  <span className="text-[10px] text-slate-500 truncate block">
                    Via {ultimaAuditoria.executado_por || 'Sistema'}
                  </span>
                </div>
              </div>

              {/* Coleções Conformes */}
              <div className="p-3 rounded-xl border border-emerald-100 bg-emerald-50/30 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-100/70 text-emerald-700 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                    Coleções Conformes
                  </span>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-lg font-extrabold text-emerald-700">
                      {ultimaAuditoria.total_conformes}
                    </span>
                    <span className="text-[11px] text-slate-500 font-medium">
                      de {ultimaAuditoria.total_colecoes}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-500 truncate block">
                    Alinhadas com baseline
                  </span>
                </div>
              </div>

              {/* Coleções com Atenção (Divergentes) */}
              <div
                className={`p-3 rounded-xl border flex items-center gap-3 ${
                  (ultimaAuditoria.total_divergencias ?? 0) > 0
                    ? 'border-amber-200 bg-amber-50/50'
                    : 'border-slate-200/90 bg-slate-50/40'
                }`}
              >
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    (ultimaAuditoria.total_divergencias ?? 0) > 0
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {(ultimaAuditoria.total_divergencias ?? 0) > 0 ? (
                    <XCircle className="w-5 h-5" />
                  ) : (
                    <Layers className="w-5 h-5" />
                  )}
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                    Coleções com Atenção
                  </span>
                  <div className="flex items-baseline gap-1.5">
                    <span
                      className={`text-lg font-extrabold ${
                        (ultimaAuditoria.total_divergencias ?? 0) > 0
                          ? 'text-amber-600'
                          : 'text-slate-700'
                      }`}
                    >
                      {ultimaAuditoria.total_divergencias ?? 0}
                    </span>
                    <span className="text-[11px] text-slate-500 font-medium">divergência(s)</span>
                  </div>
                  <span className="text-[10px] text-slate-500 truncate block">
                    {(ultimaAuditoria.total_divergencias ?? 0) > 0
                      ? 'Requer inspeção de RLS'
                      : 'Nenhuma inconformidade'}
                  </span>
                </div>
              </div>
            </div>

            {/* Lista curta das coleções divergentes, se houver */}
            {divergencias.length > 0 && (
              <div className="p-3.5 bg-amber-50/70 border border-amber-200 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
                    <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
                    Coleções com Divergência ({divergencias.length})
                  </span>
                  <Link
                    to="/admin/auditoria"
                    className="text-[11px] font-semibold text-blue-700 hover:text-blue-800 hover:underline flex items-center gap-1"
                  >
                    Examinar detalhes <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>

                <div className="flex flex-wrap gap-2 pt-1">
                  {divergenciasAmostra.map((item, idx) => (
                    <div
                      key={idx}
                      className="inline-flex items-center gap-2 bg-white px-2.5 py-1 rounded-lg border border-amber-200 text-xs shadow-2xs"
                    >
                      <span className="font-mono font-semibold text-slate-900">{item.colecao}</span>
                      <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 border-none text-[10px] font-bold px-1.5 py-0">
                        Atenção
                      </Badge>
                      {item.categoria && (
                        <span className="text-[10px] text-slate-500 max-w-[140px] truncate">
                          {item.categoria}
                        </span>
                      )}
                    </div>
                  ))}

                  {divergencias.length > 3 && (
                    <Badge
                      variant="outline"
                      className="text-xs font-semibold text-amber-900 border-amber-300 bg-amber-100/60"
                    >
                      +{divergencias.length - 3} outra(s)
                    </Badge>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default WidgetAuditoriaSeguranca
