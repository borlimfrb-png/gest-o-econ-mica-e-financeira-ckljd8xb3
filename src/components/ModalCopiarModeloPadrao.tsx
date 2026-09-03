import React, { useState, useMemo } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { useToast } from '@/hooks/use-toast'
import { MODELO_PLANO_CONTAS_PADRAO, type ItemModeloPadrao } from '@/lib/planoContasPadrao'
import { planoContasLoteService } from '@/services/planoContasLoteService'
import type { EmpresaRecord, TipoConta } from '@/types/finance'
import {
  Copy,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Search,
  BookOpen,
  Building2,
  Sparkles,
} from 'lucide-react'

interface ModalCopiarModeloPadraoProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedEmpresa: EmpresaRecord | null
  totalContasEmpresaAtual: number
  onSuccess: () => void
}

const TIPO_CONTA_BADGE: Record<TipoConta, string> = {
  Ativo: 'bg-blue-50 text-blue-700 border-blue-200',
  Passivo: 'bg-amber-50 text-amber-700 border-amber-200',
  'Patrimônio Líquido': 'bg-violet-50 text-violet-700 border-violet-200',
  Receita: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Despesa: 'bg-rose-50 text-rose-700 border-rose-200',
}

export const ModalCopiarModeloPadrao: React.FC<ModalCopiarModeloPadraoProps> = ({
  open,
  onOpenChange,
  selectedEmpresa,
  totalContasEmpresaAtual,
  onSuccess,
}) => {
  const { toast } = useToast()
  const [busca, setBusca] = useState('')
  const [tipoFiltro, setTipoFiltro] = useState<string>('todos')
  const [copiando, setCopiando] = useState(false)
  const [progresso, setProgresso] = useState<{ atual: number; total: number } | null>(null)
  const [confirmarMesmoComContas, setConfirmarMesmoComContas] = useState(false)

  const itensFiltrados = useMemo(() => {
    const q = busca.trim().toLowerCase()
    return MODELO_PLANO_CONTAS_PADRAO.filter((item) => {
      if (tipoFiltro !== 'todos' && item.contaTipo !== tipoFiltro) {
        return false
      }
      if (!q) return true
      return (
        item.contaNome.toLowerCase().includes(q) ||
        (item.codigoSugerido || '').toLowerCase().includes(q) ||
        item.contaGrupo.toLowerCase().includes(q) ||
        item.centroNome.toLowerCase().includes(q) ||
        (item.descricao || '').toLowerCase().includes(q)
      )
    })
  }, [busca, tipoFiltro])

  const resumoPorTipo = useMemo(() => {
    const map: Record<string, number> = {}
    for (const it of MODELO_PLANO_CONTAS_PADRAO) {
      map[it.contaTipo] = (map[it.contaTipo] || 0) + 1
    }
    return map
  }, [])

  const handleCopiar = async () => {
    if (!selectedEmpresa) {
      toast({
        variant: 'destructive',
        title: 'Selecione uma empresa',
        description: 'É necessário selecionar uma empresa para aplicar o modelo padrão.',
      })
      return
    }

    // Se já existirem contas e usuário ainda não confirmou o aviso
    if (totalContasEmpresaAtual > 0 && !confirmarMesmoComContas) {
      setConfirmarMesmoComContas(true)
      return
    }

    setCopiando(true)
    setProgresso({ atual: 0, total: MODELO_PLANO_CONTAS_PADRAO.length })

    try {
      const resultado = await planoContasLoteService.aplicarModeloPadrao(
        selectedEmpresa.id,
        (atual, total) => setProgresso({ atual, total }),
      )

      const partesMsg: string[] = []
      if (resultado.totalCriados > 0) {
        partesMsg.push(`${resultado.totalCriados} conta(s) adicionada(s)`)
      }
      if (resultado.totalIgnoradosDuplicados > 0) {
        partesMsg.push(`${resultado.totalIgnoradosDuplicados} já existiam (ignoradas)`)
      }
      if (resultado.totalErros > 0) {
        partesMsg.push(`${resultado.totalErros} erro(s)`)
      }

      toast({
        title: 'Modelo Padrão aplicado!',
        description: `Resultado para ${selectedEmpresa.nome}: ${partesMsg.join(', ')}.`,
      })

      onSuccess()
      onOpenChange(false)
      setConfirmarMesmoComContas(false)
    } catch (err: any) {
      console.error(err)
      toast({
        variant: 'destructive',
        title: 'Erro ao copiar modelo',
        description: err?.message || 'Falha ao aplicar o modelo padrão de plano de contas.',
      })
    } finally {
      setCopiando(false)
      setProgresso(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={copiando ? () => {} : onOpenChange}>
      <DialogContent className="sm:max-w-[760px] max-h-[90vh] flex flex-col bg-white p-0 gap-0 overflow-hidden">
        {/* Header */}
        <DialogHeader className="p-5 pb-3 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-[#0B1F3A] flex items-center gap-2">
                Copiar Modelo de Plano de Contas Padrão
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500 mt-0.5">
                Conjunto contábil completo e profissional para empresas brasileiras de consultoria,
                serviços e comércio.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Corpo com scroll */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1 text-xs">
          {/* Banner da Empresa Alvo */}
          <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-blue-700 shrink-0" />
              <div>
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                  Empresa Destino
                </span>
                <strong className="text-xs text-blue-900 font-bold">
                  {selectedEmpresa?.nome || 'Nenhuma selecionada'}
                </strong>
              </div>
            </div>
            <Badge variant="outline" className="bg-white text-slate-700 border-slate-200 font-mono">
              {totalContasEmpresaAtual} conta(s) existente(s)
            </Badge>
          </div>

          {/* Aviso se a empresa já possuir contas */}
          {totalContasEmpresaAtual > 0 && (
            <Alert className="bg-amber-50/80 border-amber-300 text-amber-900 py-3">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <div className="ml-2">
                <AlertTitle className="text-xs font-bold text-amber-900">
                  Esta empresa já possui {totalContasEmpresaAtual} conta(s) cadastrada(s).
                </AlertTitle>
                <AlertDescription className="text-[11px] text-amber-800 mt-1">
                  Vínculos com as mesmas contas e centros de custo serão preservados sem
                  duplicidade. A numeração sequencial{' '}
                  <code className="font-mono bg-white px-1 py-0.5 rounded border border-amber-200">
                    PC-###
                  </code>{' '}
                  continuará a partir do próximo código livre da empresa.
                  {confirmarMesmoComContas && (
                    <span className="block mt-1 font-bold text-amber-950">
                      Confirmação necessária: clique em &quot;Confirmar e Adicionar Mesmo
                      Assim&quot; abaixo.
                    </span>
                  )}
                </AlertDescription>
              </div>
            </Alert>
          )}

          {/* Resumo rápido do modelo */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
              <span className="text-[10px] font-semibold uppercase text-slate-500 block">
                Total
              </span>
              <strong className="text-sm font-bold text-[#0B1F3A]">
                {MODELO_PLANO_CONTAS_PADRAO.length} contas
              </strong>
            </div>
            <div className="p-2.5 rounded-lg bg-blue-50/60 border border-blue-200">
              <span className="text-[10px] font-semibold uppercase text-blue-700 block">Ativo</span>
              <strong className="text-sm font-bold text-blue-900">
                {resumoPorTipo['Ativo'] || 0}
              </strong>
            </div>
            <div className="p-2.5 rounded-lg bg-amber-50/60 border border-amber-200">
              <span className="text-[10px] font-semibold uppercase text-amber-700 block">
                Passivo
              </span>
              <strong className="text-sm font-bold text-amber-900">
                {resumoPorTipo['Passivo'] || 0}
              </strong>
            </div>
            <div className="p-2.5 rounded-lg bg-violet-50/60 border border-violet-200">
              <span className="text-[10px] font-semibold uppercase text-violet-700 block">PL</span>
              <strong className="text-sm font-bold text-violet-900">
                {resumoPorTipo['Patrimônio Líquido'] || 0}
              </strong>
            </div>
            <div className="p-2.5 rounded-lg bg-emerald-50/60 border border-emerald-200">
              <span className="text-[10px] font-semibold uppercase text-emerald-700 block">
                Receitas / DRE
              </span>
              <strong className="text-sm font-bold text-emerald-900">
                {(resumoPorTipo['Receita'] || 0) + (resumoPorTipo['Despesa'] || 0)}
              </strong>
            </div>
          </div>

          {/* Barra de Busca e Filtro */}
          <div className="flex flex-col sm:flex-row gap-2 items-center">
            <div className="relative flex-1 w-full">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <Input
                placeholder="Filtrar contas do modelo (ex: Caixa, Fornecedores, Consultoria)..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="h-8 text-xs pl-8 bg-white"
              />
            </div>
            <select
              value={tipoFiltro}
              onChange={(e) => setTipoFiltro(e.target.value)}
              className="h-8 text-xs bg-white border border-slate-200 rounded-md px-2.5 text-slate-700 font-medium focus:ring-1 focus:ring-blue-600 w-full sm:w-44"
            >
              <option value="todos">Todos os tipos</option>
              <option value="Ativo">Ativo</option>
              <option value="Passivo">Passivo</option>
              <option value="Patrimônio Líquido">Patrimônio Líquido</option>
              <option value="Receita">Receita</option>
              <option value="Despesa">Despesa</option>
            </select>
          </div>

          {/* Tabela de Prévia das Contas do Modelo */}
          <div className="border border-slate-200 rounded-lg overflow-hidden max-h-[300px] overflow-y-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="sticky top-0 bg-slate-100 z-10 border-b border-slate-200">
                <tr className="text-slate-600 font-semibold text-[11px]">
                  <th className="py-2 px-3 w-16">Ref.</th>
                  <th className="py-2 px-3">Conta Contábil</th>
                  <th className="py-2 px-3">Tipo / Grupo</th>
                  <th className="py-2 px-3">Centro de Custo</th>
                  <th className="py-2 px-3">Tipo Despesa</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {itensFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-slate-400">
                      Nenhuma conta encontrada com o filtro atual.
                    </td>
                  </tr>
                ) : (
                  itensFiltrados.map((it, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-2 px-3 font-mono text-slate-500 font-semibold text-[11px]">
                        {it.codigoSugerido || '—'}
                      </td>
                      <td className="py-2 px-3">
                        <strong className="text-slate-900 block font-semibold">
                          {it.contaNome}
                        </strong>
                        {it.descricao && (
                          <span className="text-[10px] text-slate-500 block truncate max-w-xs">
                            {it.descricao}
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-3">
                        <div className="flex flex-col gap-0.5">
                          <Badge
                            className={`text-[9px] font-semibold px-1.5 py-0 border w-fit ${
                              TIPO_CONTA_BADGE[it.contaTipo] || ''
                            }`}
                          >
                            {it.contaTipo}
                          </Badge>
                          <span className="text-[10px] text-slate-500">{it.contaGrupo}</span>
                        </div>
                      </td>
                      <td className="py-2 px-3 text-slate-700 font-medium">{it.centroNome}</td>
                      <td className="py-2 px-3 text-slate-600">
                        {it.tipoDespesaNome ? (
                          <span className="inline-block px-1.5 py-0.5 rounded bg-slate-100 text-[10px] font-medium text-slate-700">
                            {it.tipoDespesaNome}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Barra de Progresso durante a cópia */}
          {progresso && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg space-y-1.5 animate-fadeIn">
              <div className="flex justify-between text-xs font-semibold text-blue-900">
                <span>Criando contas no plano da empresa...</span>
                <span>
                  {progresso.atual} de {progresso.total} (
                  {Math.round((progresso.atual / progresso.total) * 100)}%)
                </span>
              </div>
              <div className="w-full bg-blue-200/60 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-150"
                  style={{
                    width: `${Math.round((progresso.atual / progresso.total) * 100)}%`,
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <DialogFooter className="p-4 border-t border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
            <BookOpen className="w-3.5 h-3.5 text-blue-600" />
            <span>
              {MODELO_PLANO_CONTAS_PADRAO.length} contas contábeis e operacionais prontas para uso.
            </span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setConfirmarMesmoComContas(false)
                onOpenChange(false)
              }}
              disabled={copiando}
              className="text-xs h-9"
            >
              Cancelar
            </Button>

            <Button
              type="button"
              onClick={handleCopiar}
              disabled={copiando || !selectedEmpresa}
              className={`text-xs h-9 font-semibold text-white shadow-xs gap-1.5 ${
                confirmarMesmoComContas
                  ? 'bg-amber-600 hover:bg-amber-700'
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {copiando ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Gravando Contas...
                </>
              ) : confirmarMesmoComContas ? (
                <>
                  <AlertTriangle className="w-4 h-4" />
                  Confirmar e Adicionar Mesmo Assim
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  Copiar Modelo para {selectedEmpresa?.nome || 'Empresa'}
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
