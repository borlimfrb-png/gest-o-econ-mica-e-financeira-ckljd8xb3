import { useState, useMemo, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Building2,
  CheckCircle2,
  AlertTriangle,
  Save,
  Search,
  Filter,
  Layers,
  ArrowRight,
  Loader2,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { planoContasService } from '@/services/financeService'
import { auditoriaCadastrosService } from '@/services/auditoriaCadastrosService'
import type { PlanoContaRecord, EmpresaRecord, ContaRecord, CentroRecord } from '@/types/finance'

export interface ModalEdicaoLoteCodigosProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  planoContas: PlanoContaRecord[]
  selectedEmpresa?: EmpresaRecord | null
  contaMap: Map<string, ContaRecord>
  centroMap: Map<string, CentroRecord>
  onSuccess: () => void
}

interface LinhaEdicao {
  id: string
  codigoInterno: string
  contaNome: string
  centroNome: string
  codigoEmpresaOriginal: string
  codigoEmpresaNovo: string
  alterado: boolean
}

export function ModalEdicaoLoteCodigos({
  open,
  onOpenChange,
  planoContas,
  selectedEmpresa,
  contaMap,
  centroMap,
  onSuccess,
}: ModalEdicaoLoteCodigosProps) {
  const { toast } = useToast()
  const [linhas, setLinhas] = useState<LinhaEdicao[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [filtroStatus, setFiltroStatus] = useState<
    'todos' | 'sem_codigo' | 'com_codigo' | 'alterados'
  >('todos')
  const [isSaving, setIsSaving] = useState(false)
  const [duplicidadesAviso, setDuplicidadesAviso] = useState<string[]>([])
  const [confirmarDuplicidade, setConfirmarDuplicidade] = useState(false)

  // Inicializa as linhas quando o modal abre ou quando planoContas muda
  useEffect(() => {
    if (!open) return

    // Filtra estritamente apenas contas da empresa ativa
    const contasEmpresa = selectedEmpresa
      ? planoContas.filter((p) => p.empresa === selectedEmpresa.id)
      : planoContas

    const initialRows: LinhaEdicao[] = contasEmpresa.map((pc) => {
      const conta = contaMap.get(pc.conta)
      const centro = centroMap.get(pc.centro)
      const codOrig = (pc.codigo_empresa || '').trim()

      return {
        id: pc.id,
        codigoInterno: pc.codigo || '',
        contaNome: conta ? `${conta.codigo ? `${conta.codigo} - ` : ''}${conta.nome}` : 'Conta',
        centroNome: centro ? centro.nome : '—',
        codigoEmpresaOriginal: codOrig,
        codigoEmpresaNovo: codOrig,
        alterado: false,
      }
    })

    setLinhas(initialRows)
    setSearchTerm('')
    setFiltroStatus('todos')
    setDuplicidadesAviso([])
    setConfirmarDuplicidade(false)
  }, [open, planoContas, selectedEmpresa, contaMap, centroMap])

  // Atualiza um código na lista
  const handleCodigoChange = (id: string, novoValor: string) => {
    setLinhas((prev) =>
      prev.map((linha) => {
        if (linha.id !== id) return linha
        const alterado = novoValor.trim() !== linha.codigoEmpresaOriginal.trim()
        return {
          ...linha,
          codigoEmpresaNovo: novoValor,
          alterado,
        }
      }),
    )
  }

  // Estatísticas
  const totalAlteradas = useMemo(() => linhas.filter((l) => l.alterado).length, [linhas])

  // Verificação de duplicidades de código entre as contas da empresa
  const duplicidadesDetectadas = useMemo(() => {
    const contagem: Record<string, string[]> = {}

    linhas.forEach((l) => {
      const cod = l.codigoEmpresaNovo.trim().toLowerCase()
      if (!cod) return
      if (!contagem[cod]) {
        contagem[cod] = []
      }
      contagem[cod].push(l.contaNome)
    })

    const duplicados: string[] = []
    Object.entries(contagem).forEach(([cod, contas]) => {
      if (contas.length > 1) {
        duplicados.push(
          `Código "${cod}": repetido em ${contas.length} contas (${contas.slice(0, 3).join(', ')}${contas.length > 3 ? '...' : ''})`,
        )
      }
    })

    return duplicados
  }, [linhas])

  // Filtragem de linhas para exibição
  const linhasFiltradas = useMemo(() => {
    return linhas.filter((linha) => {
      // Filtro de texto
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase()
        const matchInterno = linha.codigoInterno.toLowerCase().includes(term)
        const matchConta = linha.contaNome.toLowerCase().includes(term)
        const matchCentro = linha.centroNome.toLowerCase().includes(term)
        const matchCodOrig = linha.codigoEmpresaOriginal.toLowerCase().includes(term)
        const matchCodNovo = linha.codigoEmpresaNovo.toLowerCase().includes(term)
        if (!matchInterno && !matchConta && !matchCentro && !matchCodOrig && !matchCodNovo) {
          return false
        }
      }

      // Filtro de status
      if (filtroStatus === 'sem_codigo') {
        return !linha.codigoEmpresaNovo.trim()
      }
      if (filtroStatus === 'com_codigo') {
        return Boolean(linha.codigoEmpresaNovo.trim())
      }
      if (filtroStatus === 'alterados') {
        return linha.alterado
      }

      return true
    })
  }, [linhas, searchTerm, filtroStatus])

  // Salvar em lote
  const handleSave = async (ignorarAvisoDuplicidade = false) => {
    const alteradas = linhas.filter((l) => l.alterado)

    if (alteradas.length === 0) {
      toast({
        title: 'Nenhuma alteração',
        description: 'Você não alterou nenhum código da empresa.',
      })
      return
    }

    // Se houver duplicidades e o usuário ainda não confirmou, exibe aviso prévio
    if (duplicidadesDetectadas.length > 0 && !ignorarAvisoDuplicidade) {
      setDuplicidadesAviso(duplicidadesDetectadas)
      setConfirmarDuplicidade(true)
      return
    }

    setIsSaving(true)
    let sucessos = 0
    let falhas = 0

    const camposAuditados: Record<string, { antes: string; depois: string }> = {}

    try {
      for (const item of alteradas) {
        try {
          const codFinal = item.codigoEmpresaNovo.trim()
          await planoContasService.update(item.id, {
            codigo_empresa: codFinal || '',
          })
          sucessos++
          camposAuditados[item.id] = {
            antes: item.codigoEmpresaOriginal || '',
            depois: codFinal,
          }
        } catch (err) {
          console.error(`Erro ao atualizar conta ${item.id}:`, err)
          falhas++
        }
      }

      // Registrar auditoria de cadastros para a operação em lote
      if (sucessos > 0) {
        await auditoriaCadastrosService.registrar({
          empresa: selectedEmpresa?.id,
          entidade: 'plano_contas',
          registro_id: `lote_${Date.now()}`,
          registro_descricao: `Edição em lote de códigos da empresa: ${sucessos} conta(s) atualizada(s)${selectedEmpresa ? ` para a empresa ${selectedEmpresa.nome}` : ''}`,
          acao: 'edicao',
          detalhes: {
            campos_alterados: camposAuditados,
            dados_novos: {
              total_alteradas: sucessos,
              total_falhas: falhas,
              empresa_id: selectedEmpresa?.id,
              empresa_nome: selectedEmpresa?.nome,
            },
          },
        })
      }

      if (falhas === 0) {
        toast({
          title: 'Códigos atualizados com sucesso!',
          description: `${sucessos} conta(s) tiveram seus códigos da empresa salvos.`,
        })
        onSuccess()
        onOpenChange(false)
      } else {
        toast({
          title: 'Atualização concluída com avisos',
          description: `${sucessos} contas salvas com sucesso, ${falhas} falharam.`,
          variant: 'destructive',
        })
        onSuccess()
      }
    } catch (err: unknown) {
      const error = err as Error
      toast({
        title: 'Erro ao salvar em lote',
        description: error.message || 'Falha na comunicação com o servidor.',
        variant: 'destructive',
      })
    } finally {
      setIsSaving(false)
      setConfirmarDuplicidade(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 gap-0 bg-white">
        {/* Cabeçalho */}
        <div className="p-6 pb-4 border-b border-slate-200">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center font-bold">
                  <Layers className="w-4 h-4" />
                </div>
                <DialogTitle className="text-lg font-bold text-slate-900">
                  Edição em Lote de Códigos da Empresa
                </DialogTitle>
              </div>
              <DialogDescription className="text-xs text-slate-500">
                Atribua ou ajuste o Código da Empresa de várias contas simultaneamente para agilizar
                o casamento automático.
              </DialogDescription>
            </div>

            {selectedEmpresa && (
              <Badge
                variant="outline"
                className="bg-slate-50 text-slate-700 border-slate-200 text-xs px-2.5 py-1 gap-1"
              >
                <Building2 className="w-3.5 h-3.5 text-slate-400" />
                {selectedEmpresa.nome}
              </Badge>
            )}
          </div>

          {/* Barra de Filtros e Pesquisa */}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <Input
                placeholder="Buscar por conta, código interno ou código empresa..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 h-9 text-xs"
              />
            </div>

            <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-lg">
              <button
                type="button"
                onClick={() => setFiltroStatus('todos')}
                className={`text-xs px-2.5 py-1 rounded-md font-medium transition-all ${
                  filtroStatus === 'todos'
                    ? 'bg-white text-slate-900 shadow-2xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Todas ({linhas.length})
              </button>
              <button
                type="button"
                onClick={() => setFiltroStatus('sem_codigo')}
                className={`text-xs px-2.5 py-1 rounded-md font-medium transition-all ${
                  filtroStatus === 'sem_codigo'
                    ? 'bg-white text-amber-900 shadow-2xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Sem Código ({linhas.filter((l) => !l.codigoEmpresaNovo.trim()).length})
              </button>
              <button
                type="button"
                onClick={() => setFiltroStatus('com_codigo')}
                className={`text-xs px-2.5 py-1 rounded-md font-medium transition-all ${
                  filtroStatus === 'com_codigo'
                    ? 'bg-white text-emerald-900 shadow-2xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Com Código ({linhas.filter((l) => l.codigoEmpresaNovo.trim()).length})
              </button>
              <button
                type="button"
                onClick={() => setFiltroStatus('alterados')}
                className={`text-xs px-2.5 py-1 rounded-md font-medium transition-all ${
                  filtroStatus === 'alterados'
                    ? 'bg-white text-blue-900 shadow-2xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Alteradas ({totalAlteradas})
              </button>
            </div>
          </div>
        </div>

        {/* Alerta de Duplicidades antes de salvar */}
        {confirmarDuplicidade && duplicidadesAviso.length > 0 && (
          <div className="p-4 bg-amber-50 border-b border-amber-200">
            <Alert className="bg-white border-amber-300 text-amber-950 shadow-2xs">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <div className="space-y-2">
                <AlertDescription className="text-xs">
                  <strong className="block text-sm text-amber-900 mb-1">
                    Atenção: Códigos em duplicidade encontrados nesta empresa
                  </strong>
                  Detectamos contas com o mesmo código da empresa atribuído:
                  <ul className="list-disc list-inside mt-1 space-y-0.5 text-slate-700">
                    {duplicidadesAviso.map((dup, i) => (
                      <li key={i}>{dup}</li>
                    ))}
                  </ul>
                  <span className="block mt-2 font-medium">
                    Deseja salvar mesmo assim ou deseja revisar os códigos repetidos?
                  </span>
                </AlertDescription>
                <div className="flex items-center gap-2 pt-1">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setConfirmarDuplicidade(false)}
                    className="h-7 text-xs border-amber-300 hover:bg-amber-100 text-amber-950"
                  >
                    Revisar Códigos
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => handleSave(true)}
                    className="h-7 text-xs bg-amber-600 hover:bg-amber-700 text-white font-bold"
                  >
                    Salvar Mesmo com Duplicidades
                  </Button>
                </div>
              </div>
            </Alert>
          </div>
        )}

        {/* Tabela de Edição das Linhas */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-50/50">
          {linhasFiltradas.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <Filter className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm font-medium">Nenhuma conta encontrada com os filtros atuais.</p>
            </div>
          ) : (
            <div className="border border-slate-200 rounded-lg overflow-hidden bg-white shadow-2xs">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 border-b border-slate-200 text-[11px] uppercase font-bold">
                    <th className="py-2.5 px-3 w-28">Cód. Interno</th>
                    <th className="py-2.5 px-3">Conta Contábil</th>
                    <th className="py-2.5 px-3 w-36">Centro de Custo</th>
                    <th className="py-2.5 px-3 w-64">
                      Código da Conta da Empresa
                      <span className="text-[10px] text-slate-400 font-normal block lowercase">
                        (ex: 1.1.01.002, 31101, etc)
                      </span>
                    </th>
                    <th className="py-2.5 px-3 w-24 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {linhasFiltradas.map((linha) => {
                    const isRepetido =
                      linha.codigoEmpresaNovo.trim().length > 0 &&
                      linhas.filter(
                        (l) =>
                          l.codigoEmpresaNovo.trim().toLowerCase() ===
                          linha.codigoEmpresaNovo.trim().toLowerCase(),
                      ).length > 1

                    return (
                      <tr
                        key={linha.id}
                        className={`transition-colors ${
                          linha.alterado ? 'bg-blue-50/60' : 'hover:bg-slate-50/80'
                        }`}
                      >
                        <td className="py-2 px-3 font-mono font-medium text-slate-600">
                          {linha.codigoInterno || '—'}
                        </td>
                        <td className="py-2 px-3">
                          <div className="font-semibold text-slate-900">{linha.contaNome}</div>
                        </td>
                        <td className="py-2 px-3 text-slate-600">{linha.centroNome}</td>
                        <td className="py-2 px-3">
                          <div className="relative">
                            <Input
                              value={linha.codigoEmpresaNovo}
                              onChange={(e) => handleCodigoChange(linha.id, e.target.value)}
                              placeholder="Informe o código..."
                              className={`h-8 text-xs font-mono transition-all ${
                                isRepetido
                                  ? 'border-amber-400 focus-visible:ring-amber-400 bg-amber-50/30'
                                  : linha.alterado
                                    ? 'border-blue-400 focus-visible:ring-blue-400 bg-white'
                                    : 'border-slate-300'
                              }`}
                            />
                            {isRepetido && (
                              <span
                                className="absolute right-2 top-2 text-amber-500 text-[10px] font-bold"
                                title="Código repetido nesta empresa"
                              >
                                duplicado
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-2 px-3 text-center">
                          {linha.alterado ? (
                            <Badge
                              variant="outline"
                              className="bg-blue-50 text-blue-700 border-blue-200 text-[10px] px-1.5 py-0 font-medium"
                            >
                              Modificado
                            </Badge>
                          ) : linha.codigoEmpresaOriginal ? (
                            <Badge
                              variant="outline"
                              className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] px-1.5 py-0 font-medium"
                            >
                              Gravado
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="bg-slate-100 text-slate-500 border-slate-200 text-[10px] px-1.5 py-0 font-medium"
                            >
                              Vazio
                            </Badge>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Rodapé com Ações e Feedback */}
        <div className="p-4 sm:px-6 bg-white border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span>
              Total exibido: <strong>{linhasFiltradas.length}</strong>
            </span>
            <span>•</span>
            <span className={totalAlteradas > 0 ? 'text-blue-700 font-bold' : ''}>
              {totalAlteradas} {totalAlteradas === 1 ? 'conta modificada' : 'contas modificadas'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={isSaving}
              className="h-8 text-xs font-semibold"
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={() => handleSave(false)}
              disabled={isSaving || totalAlteradas === 0}
              className="h-8 text-xs font-bold bg-[#0B1F3A] hover:bg-blue-900 text-white gap-1.5 shadow-xs"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Salvando em Lote...
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  Salvar Alterações ({totalAlteradas})
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
