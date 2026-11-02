import { useState, useEffect } from 'react'
import { contasService } from '@/services/financeService'
import type { ContaRecord, TipoConta, ClassificacaoDre } from '@/types/finance'
import { CLASSIFICACOES_DRE } from '@/types/finance'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Pencil, AlertCircle } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'

const TIPOS_CONTA: TipoConta[] = ['Ativo', 'Passivo', 'Patrimônio Líquido', 'Receita', 'Despesa']

const GRUPOS_POR_TIPO: Record<TipoConta, string[]> = {
  Ativo: ['Ativo Circulante', 'Ativo Não Circulante'],
  Passivo: ['Passivo Circulante', 'Passivo Não Circulante'],
  'Patrimônio Líquido': ['Patrimônio Líquido'],
  Receita: ['Receitas Operacionais', 'Outras Receitas'],
  Despesa: ['Despesas Operacionais', 'Despesas Financeiras', 'Outras Despesas'],
}

export interface ContaFormData {
  nome: string
  tipo: TipoConta
  grupo: string
  descricao: string
  classificacao_dre: ClassificacaoDre | ''
  nao_exibir_dre: boolean
  nao_exibir_fluxo_caixa: boolean
  nao_exibir_em_nada: boolean
}

type FormErrors = Partial<Record<keyof ContaFormData | 'general', string>>

export interface ModalEditarContaProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  conta: ContaRecord | null
  onSuccess?: (contaAtualizada: ContaRecord) => void
  readOnly?: boolean
}

export function ModalEditarConta({
  open,
  onOpenChange,
  conta,
  onSuccess,
  readOnly = false,
}: ModalEditarContaProps) {
  const { toast } = useToast()
  const [form, setForm] = useState<ContaFormData>({
    nome: '',
    tipo: 'Ativo',
    grupo: '',
    descricao: '',
    classificacao_dre: '',
    nao_exibir_dre: false,
    nao_exibir_fluxo_caixa: false,
    nao_exibir_em_nada: false,
  })
  const [errors, setErrors] = useState<FormErrors>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (conta && open) {
      setForm({
        nome: conta.nome || '',
        tipo: conta.tipo || 'Ativo',
        grupo: conta.grupo || '',
        descricao: conta.descricao || '',
        classificacao_dre: conta.classificacao_dre || '',
        nao_exibir_dre: !!conta.nao_exibir_dre,
        nao_exibir_fluxo_caixa: !!conta.nao_exibir_fluxo_caixa,
        nao_exibir_em_nada: !!conta.nao_exibir_em_nada,
      })
      setErrors({})
    }
  }, [conta, open])

  const setField = <K extends keyof ContaFormData>(key: K, value: ContaFormData[K]) => {
    setForm((prev) => {
      if (key === 'tipo') {
        const novoTipo = value as TipoConta
        const gruposSugeridos = GRUPOS_POR_TIPO[novoTipo] || []
        const grupoAtual = prev.grupo
        const grupoAindaValido = grupoAtual && !gruposSugeridos.includes(grupoAtual)
        return {
          ...prev,
          tipo: novoTipo,
          grupo: grupoAindaValido ? grupoAtual : '',
        }
      }
      return { ...prev, [key]: value }
    })
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }))
  }

  const validate = (f: ContaFormData): boolean => {
    const errs: FormErrors = {}
    if (!f.nome.trim() || f.nome.trim().length < 2) {
      errs.nome = 'Informe um nome com pelo menos 2 caracteres'
    }
    if (!f.tipo) errs.tipo = 'Selecione o tipo'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (readOnly) return
    if (!conta || !validate(form)) return

    setSaving(true)
    try {
      const atualizada = await contasService.update(conta.id, {
        nome: form.nome,
        tipo: form.tipo,
        grupo: form.grupo,
        descricao: form.descricao,
        classificacao_dre: (form.classificacao_dre as ClassificacaoDre) || undefined,
        nao_exibir_dre: form.nao_exibir_dre,
        nao_exibir_fluxo_caixa: form.nao_exibir_fluxo_caixa,
        nao_exibir_em_nada: form.nao_exibir_em_nada,
      })
      window.dispatchEvent(new CustomEvent('dre-contas-atualizado'))
      window.dispatchEvent(new CustomEvent('dre-contas-atualizadas'))
      toast({ title: 'Conta atualizada', description: 'As alterações foram salvas com sucesso.' })
      onOpenChange(false)
      onSuccess?.(atualizada)
    } catch (err: any) {
      console.error('Erro ao atualizar conta:', err)
      setErrors((prev) => ({
        ...prev,
        general: err?.message || 'Erro ao atualizar a conta.',
      }))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] bg-white">
        <form onSubmit={handleUpdate}>
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-[#0B1F3A] flex items-center gap-2">
              <Pencil className="w-4 h-4 text-blue-600" />
              Editar Conta Contábil
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              {readOnly
                ? 'Visualização da conta (perfil sem permissão para alteração).'
                : 'Atualize as informações da conta. O código não pode ser alterado. Campos com * são obrigatórios.'}
            </DialogDescription>
          </DialogHeader>

          {errors.general && (
            <Alert
              variant="destructive"
              className="mt-4 bg-red-50 border-red-200 text-red-800 py-2"
            >
              <AlertCircle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-xs font-medium">{errors.general}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-3 py-4">
            <div className="space-y-1.5">
              <Label
                htmlFor="modal-edit-conta-codigo"
                className="text-xs font-semibold text-slate-700"
              >
                Código
              </Label>
              <Input
                id="modal-edit-conta-codigo"
                readOnly
                value={conta?.codigo || ''}
                className="h-9 text-xs font-mono font-semibold text-slate-600 bg-slate-50 border-slate-200 cursor-not-allowed"
              />
            </div>

            <div className="space-y-1.5">
              <Label
                htmlFor="modal-edit-conta-nome"
                className="text-xs font-semibold text-slate-700"
              >
                Nome *
              </Label>
              <Input
                id="modal-edit-conta-nome"
                value={form.nome}
                disabled={readOnly}
                onChange={(e) => setField('nome', e.target.value)}
                className={`h-9 text-xs ${errors.nome ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
              />
              {errors.nome && <p className="text-[11px] text-red-600 font-medium">{errors.nome}</p>}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label
                  htmlFor="modal-edit-conta-tipo"
                  className="text-xs font-semibold text-slate-700"
                >
                  Tipo *
                </Label>
                <Select
                  value={form.tipo}
                  disabled={readOnly}
                  onValueChange={(val) => setField('tipo', val as TipoConta)}
                >
                  <SelectTrigger id="modal-edit-conta-tipo" className="h-9 text-xs bg-white">
                    <SelectValue placeholder="Selecione o tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    {TIPOS_CONTA.map((t) => (
                      <SelectItem key={t} value={t} className="text-xs">
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.tipo && (
                  <p className="text-[11px] text-red-600 font-medium">{errors.tipo}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label
                  htmlFor="modal-edit-conta-grupo"
                  className="text-xs font-semibold text-slate-700"
                >
                  Grupo
                </Label>
                <Select
                  value={form.grupo}
                  disabled={readOnly}
                  onValueChange={(val) => setField('grupo', val)}
                >
                  <SelectTrigger id="modal-edit-conta-grupo" className="h-9 text-xs bg-white">
                    <SelectValue placeholder="Opcional" />
                  </SelectTrigger>
                  <SelectContent>
                    {(GRUPOS_POR_TIPO[form.tipo] || []).map((g) => (
                      <SelectItem key={g} value={g} className="text-xs">
                        {g}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label
                htmlFor="modal-edit-conta-classificacao-dre"
                className="text-xs font-semibold text-slate-700"
              >
                Classificação DRE Gerencial
              </Label>
              <Select
                value={form.classificacao_dre || 'nenhum'}
                disabled={readOnly}
                onValueChange={(val) =>
                  setField('classificacao_dre', val === 'nenhum' ? '' : (val as ClassificacaoDre))
                }
              >
                <SelectTrigger
                  id="modal-edit-conta-classificacao-dre"
                  className="h-9 text-xs bg-white"
                >
                  <SelectValue placeholder="Selecione a classificação DRE" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="nenhum" className="text-xs text-slate-400">
                    (Nenhum / usar heurística automática)
                  </SelectItem>
                  {CLASSIFICACOES_DRE.map((clf) => (
                    <SelectItem key={clf} value={clf} className="text-xs">
                      {clf}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label
                htmlFor="modal-edit-conta-descricao"
                className="text-xs font-semibold text-slate-700"
              >
                Descrição
              </Label>
              <Input
                id="modal-edit-conta-descricao"
                value={form.descricao}
                disabled={readOnly}
                onChange={(e) => setField('descricao', e.target.value)}
                className="h-9 text-xs"
              />
            </div>

            {/* Marcações de Exclusão nos Relatórios Gerenciais */}
            <div className="pt-2 border-t border-slate-100 space-y-2">
              <Label className="text-xs font-semibold text-slate-700 block">
                Exclusões de Relatórios Gerenciais (Flags)
              </Label>
              <div className="space-y-2 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700 font-medium">
                  <input
                    type="checkbox"
                    checked={form.nao_exibir_dre}
                    disabled={readOnly || form.nao_exibir_em_nada}
                    onChange={(e) => {
                      setField('nao_exibir_dre', e.target.checked)
                      if (e.target.checked) setField('nao_exibir_em_nada', false)
                    }}
                    className="rounded border-slate-300 text-rose-600 focus:ring-rose-500"
                  />
                  <span>Não exibir na DRE Gerencial</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700 font-medium">
                  <input
                    type="checkbox"
                    checked={form.nao_exibir_fluxo_caixa}
                    disabled={readOnly || form.nao_exibir_em_nada}
                    onChange={(e) => {
                      setField('nao_exibir_fluxo_caixa', e.target.checked)
                      if (e.target.checked) setField('nao_exibir_em_nada', false)
                    }}
                    className="rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                  />
                  <span>Não exibir no Fluxo de Caixa (DRE)</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-900 font-semibold pt-1 border-t border-slate-200">
                  <input
                    type="checkbox"
                    checked={form.nao_exibir_em_nada}
                    disabled={readOnly}
                    onChange={(e) => {
                      const val = e.target.checked
                      setField('nao_exibir_em_nada', val)
                      if (val) {
                        setField('nao_exibir_dre', false)
                        setField('nao_exibir_fluxo_caixa', false)
                      }
                    }}
                    className="rounded border-slate-300 text-red-700 focus:ring-red-600"
                  />
                  <span className="text-red-700">Não exibir em nada (ambos os relatórios)</span>
                </label>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
              className="text-xs h-9"
            >
              Cancelar
            </Button>
            {!readOnly && (
              <Button
                type="submit"
                disabled={saving}
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs h-9 shadow-xs"
              >
                {saving ? 'Salvando...' : 'Salvar Alterações'}
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
