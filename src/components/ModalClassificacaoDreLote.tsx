import React, { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Sparkles, Layers, CheckCircle2 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { contasService } from '@/services/financeService'
import type { ContaRecord, ClassificacaoDre } from '@/types/finance'
import { CLASSIFICACOES_DRE } from '@/types/finance'
import { sugerirClassificacaoDre } from '@/lib/dreClassificacaoHeuristica'

interface ModalClassificacaoDreLoteProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  contas: ContaRecord[]
  onSuccess: () => void
  preFilteredIds?: string[]
}

const BADGE_DRE_COLOR: Record<ClassificacaoDre, string> = {
  Receita: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  'Despesa Variável': 'bg-amber-100 text-amber-800 border-amber-300',
  'Despesa Fixa': 'bg-rose-100 text-rose-800 border-rose-300',
  'Despesa Financeira': 'bg-purple-100 text-purple-800 border-purple-300',
  'Receita Financeira': 'bg-sky-100 text-sky-800 border-sky-300',
}

export function ModalClassificacaoDreLote({
  open,
  onOpenChange,
  contas,
  onSuccess,
  preFilteredIds,
}: ModalClassificacaoDreLoteProps) {
  const { toast } = useToast()
  const [salvando, setSalvando] = useState(false)
  const [filtroTipo, setFiltroTipo] = useState<string>('todas')
  const [classificacoes, setClassificacoes] = useState<Record<string, ClassificacaoDre | ''>>({})

  // Inicializar estado quando o modal abre
  React.useEffect(() => {
    if (open) {
      const mapa: Record<string, ClassificacaoDre | ''> = {}
      for (const c of contas) {
        if (c.classificacao_dre) {
          mapa[c.id] = c.classificacao_dre
        } else {
          // Heurística automática
          const sugestao = sugerirClassificacaoDre(c.nome, c.tipo, c.grupo)
          mapa[c.id] = sugestao || ''
        }
      }
      setClassificacoes(mapa)
      if (preFilteredIds && preFilteredIds.length > 0) {
        setFiltroTipo('selecionadas')
      } else {
        setFiltroTipo('todas')
      }
    }
  }, [open, contas, preFilteredIds])

  const contasExibidas = React.useMemo(() => {
    return contas.filter((c) => {
      if (filtroTipo === 'selecionadas' && preFilteredIds && preFilteredIds.length > 0) {
        return preFilteredIds.includes(c.id)
      }
      if (filtroTipo === 'sem_classificacao') {
        return !classificacoes[c.id]
      }
      if (filtroTipo === 'com_classificacao') {
        return !!classificacoes[c.id]
      }
      return true
    })
  }, [contas, filtroTipo, classificacoes, preFilteredIds])

  const aplicarHeuristicaGeral = () => {
    const mapa = { ...classificacoes }
    let count = 0
    for (const c of contas) {
      const sugestao = sugerirClassificacaoDre(c.nome, c.tipo, c.grupo)
      if (sugestao) {
        mapa[c.id] = sugestao
        count++
      }
    }
    setClassificacoes(mapa)
    toast({
      title: 'Classificação automática aplicada',
      description: `${count} contas foram classificadas com base em palavras-chave da DRE.`,
    })
  }

  const handleSalvar = async () => {
    setSalvando(true)
    let alteradas = 0
    let erros = 0

    try {
      for (const c of contas) {
        const novoValor = classificacoes[c.id] || null
        if (novoValor !== (c.classificacao_dre || null)) {
          try {
            await contasService.update(c.id, {
              classificacao_dre: (novoValor as ClassificacaoDre) || undefined,
            })
            alteradas++
          } catch (e) {
            console.error(`Erro ao atualizar conta ${c.id}:`, e)
            erros++
          }
        }
      }

      toast({
        title: 'Classificações DRE salvas',
        description: `${alteradas} conta(s) atualizada(s)${erros > 0 ? `, ${erros} com falha` : ''}.`,
      })
      onSuccess()
      onOpenChange(false)
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Erro ao salvar',
        description: err?.message || 'Falha ao processar as classificações.',
      })
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl bg-white max-h-[85vh] flex flex-col p-6">
        <DialogHeader>
          <DialogTitle className="text-base font-bold text-[#0B1F3A] flex items-center gap-2">
            <Layers className="w-5 h-5 text-blue-600" />
            Classificação DRE do Plano de Contas
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            Defina o grupo gerencial da DRE para cada conta (Receita, Despesa Variável, Fixa ou
            Financeira). Contas sem classificação serão sugeridas automaticamente por palavras-chave
            ou exibidas em &quot;Não classificados&quot; na DRE.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between gap-3 py-2 border-b border-slate-100 flex-wrap">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={aplicarHeuristicaGeral}
              className="h-8 text-xs font-semibold border-blue-200 text-blue-700 hover:bg-blue-50 gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5 text-blue-600" />
              Sugerir Classificação Automática para Todas
            </Button>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-500 text-xs">Filtrar:</span>
            <Select value={filtroTipo} onValueChange={setFiltroTipo}>
              <SelectTrigger className="h-8 text-xs w-44 bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {preFilteredIds && preFilteredIds.length > 0 && (
                  <SelectItem
                    value="selecionadas"
                    className="text-xs font-semibold text-indigo-700"
                  >
                    Contas da Importação ({preFilteredIds.length})
                  </SelectItem>
                )}
                <SelectItem value="todas" className="text-xs">
                  Todas as contas ({contas.length})
                </SelectItem>
                <SelectItem value="sem_classificacao" className="text-xs">
                  Sem classificação
                </SelectItem>
                <SelectItem value="com_classificacao" className="text-xs">
                  Classificadas
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto min-h-[320px] max-h-[460px] pr-1">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="sticky top-0 bg-slate-50 z-10">
              <tr className="border-b border-slate-200 text-slate-600 font-semibold">
                <th className="py-2.5 px-3">Código</th>
                <th className="py-2.5 px-3">Nome da Conta</th>
                <th className="py-2.5 px-3">Tipo Contábil</th>
                <th className="py-2.5 px-3">Classificação DRE Gerencial</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {contasExibidas.map((c) => {
                const valorAtual = classificacoes[c.id] || ''
                return (
                  <tr key={c.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-2.5 px-3 font-mono font-semibold text-blue-700 text-[11px]">
                      {c.codigo || '—'}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="font-semibold text-slate-800">{c.nome}</span>
                      {c.grupo && (
                        <span className="text-[10px] text-slate-400 block">{c.grupo}</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3">
                      <Badge variant="outline" className="text-[10px] px-2 py-0.5">
                        {c.tipo}
                      </Badge>
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-2">
                        <Select
                          value={valorAtual || 'nenhum'}
                          onValueChange={(val) =>
                            setClassificacoes((prev) => ({
                              ...prev,
                              [c.id]: val === 'nenhum' ? '' : (val as ClassificacaoDre),
                            }))
                          }
                        >
                          <SelectTrigger className="h-8 text-xs bg-white w-52">
                            <SelectValue placeholder="Selecione o grupo DRE" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="nenhum" className="text-xs text-slate-400">
                              (Não classificada)
                            </SelectItem>
                            {CLASSIFICACOES_DRE.map((clf) => (
                              <SelectItem key={clf} value={clf} className="text-xs">
                                {clf}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        {valorAtual && BADGE_DRE_COLOR[valorAtual as ClassificacaoDre] && (
                          <Badge
                            className={`text-[10px] font-semibold border ${
                              BADGE_DRE_COLOR[valorAtual as ClassificacaoDre]
                            }`}
                          >
                            {valorAtual}
                          </Badge>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <DialogFooter className="pt-3 border-t border-slate-100 flex items-center justify-between">
          <div className="text-xs text-slate-500 flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>
              {Object.values(classificacoes).filter(Boolean).length} de {contas.length} contas
              classificadas
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={salvando}
              className="text-xs h-9"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleSalvar}
              disabled={salvando}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs h-9 shadow-xs"
            >
              {salvando ? 'Salvando...' : 'Salvar Classificações'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
