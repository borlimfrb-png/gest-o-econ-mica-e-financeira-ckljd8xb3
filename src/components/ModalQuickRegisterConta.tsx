import React, { useState, useEffect } from 'react'
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
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  financeService,
  GRUPOS_POR_TIPO,
  type TipoConta,
  type GrupoConta,
} from '@/services/financeService'
import type { CentroRecord, TipoDespesaRecord, PlanoContaRecord } from '@/types/finance'
import { useToast } from '@/hooks/use-toast'
import { Loader2, Plus, Sparkles } from 'lucide-react'

import { useAuth } from '@/contexts/AuthContext'
import { useFilter } from '@/contexts/FilterContext'
import { tiposDespesaService } from '@/services/financeService'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertCircle } from 'lucide-react'

interface ModalQuickRegisterContaProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialName?: string
  initialCentroId?: string
  empresaId?: string
  centros: CentroRecord[]
  tiposDespesas?: TipoDespesaRecord[]
  onSuccess: (newPlano?: PlanoContaRecord) => void
}

export const ModalQuickRegisterConta: React.FC<ModalQuickRegisterContaProps> = ({
  open,
  onOpenChange,
  initialName = '',
  initialCentroId,
  empresaId,
  centros,
  tiposDespesas: initialTiposDespesas = [],
  onSuccess,
}) => {
  const { toast } = useToast()
  const { user } = useAuth()
  const { selectedEmpresaId } = useFilter()

  // Determina a empresa ativa para satisfazer a regra @request.body.empresa = @request.auth.empresa
  const effectiveEmpresaId =
    empresaId ||
    (selectedEmpresaId && !selectedEmpresaId.startsWith('grupo-') ? selectedEmpresaId : '') ||
    user?.empresa ||
    ''

  const [nome, setNome] = useState('')
  const [tipo, setTipo] = useState<TipoConta>('Despesa')
  const [grupo, setGrupo] = useState<GrupoConta>('Despesas Operacionais')
  const [centroId, setCentroId] = useState('')
  const [tipoDespesaId, setTipoDespesaId] = useState('')
  const [codigoEmpresa, setCodigoEmpresa] = useState('')
  const [listaTiposDespesa, setListaTiposDespesa] =
    useState<TipoDespesaRecord[]>(initialTiposDespesas)
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Atualiza quando o modal abre ou initialName muda
  useEffect(() => {
    if (open) {
      setNome(initialName || '')
      setCodigoEmpresa('')
      setErrorMessage(null)
      // Sugere tipo baseado em palavras-chave no nome
      const low = (initialName || '').toLowerCase()
      if (
        low.includes('receita') ||
        low.includes('venda') ||
        low.includes('faturamento') ||
        low.includes('servico prestado')
      ) {
        setTipo('Receita')
        setGrupo('Receitas Operacionais')
      } else if (
        low.includes('banco') ||
        low.includes('caixa') ||
        low.includes('aplicacao') ||
        low.includes('estoque') ||
        low.includes('cliente')
      ) {
        setTipo('Ativo')
        setGrupo('Ativo Circulante')
      } else if (
        low.includes('fornecedor') ||
        low.includes('imposto') ||
        low.includes('salario a pagar') ||
        low.includes('emprestimo')
      ) {
        setTipo('Passivo')
        setGrupo('Passivo Circulante')
      } else if (low.includes('capital') || low.includes('reserva') || low.includes('lucro')) {
        setTipo('Patrimônio Líquido')
        setGrupo('Capital Social')
      } else {
        setTipo('Despesa')
        setGrupo('Despesas Operacionais')
      }

      if (initialCentroId && centros.some((c) => c.id === initialCentroId)) {
        setCentroId(initialCentroId)
      } else if (centros.length > 0) {
        setCentroId(centros[0].id)
      }
      setTipoDespesaId('')

      // Se não recebeu tipos de despesa via props ou veio vazia, tenta carregar direto do serviço
      if (initialTiposDespesas.length > 0) {
        setListaTiposDespesa(initialTiposDespesas)
      } else {
        const opts = effectiveEmpresaId ? { empresaId: effectiveEmpresaId } : undefined
        tiposDespesaService
          .getAll(opts)
          .then((dados) => {
            setListaTiposDespesa(dados)
          })
          .catch((err) => {
            console.warn('Erro ao carregar tipos de despesa no modal rápido:', err)
          })
      }
    }
  }, [open, initialName, initialCentroId, centros, initialTiposDespesas, effectiveEmpresaId])

  // Ajusta grupo padrão quando muda tipo
  const handleTipoChange = (newTipo: TipoConta) => {
    setTipo(newTipo)
    const grupos = GRUPOS_POR_TIPO[newTipo] || []
    if (grupos.length > 0) {
      setGrupo(grupos[0])
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)

    if (!nome.trim()) {
      const msg = 'Informe o nome da conta.'
      setErrorMessage(msg)
      toast({
        title: 'Nome obrigatório',
        description: msg,
        variant: 'destructive',
      })
      return
    }

    if (!centroId) {
      const msg = 'Selecione um Centro de Custo para vincular ao Plano de Contas.'
      setErrorMessage(msg)
      toast({
        title: 'Centro de Custo obrigatório',
        description: msg,
        variant: 'destructive',
      })
      return
    }

    setLoading(true)
    try {
      // 1. Cria a Conta (CO-xxx) propagando empresaId ativa
      const novaConta = await financeService.createConta({
        nome: nome.trim(),
        tipo,
        grupo,
        empresa: effectiveEmpresaId || undefined,
        descricao: `Criada via Plano de Contas`,
      })

      // 2. Cria o Plano de Contas vinculando Conta + Centro + (TipoDespesa opcional) com empresa ativa
      const novoPlano = await financeService.createPlanoConta({
        empresa: effectiveEmpresaId || undefined,
        conta: novaConta.id,
        centro: centroId,
        tipo_despesa: tipoDespesaId || undefined,
        descricao: `${novaConta.nome}`,
        codigo_empresa: codigoEmpresa.trim() || undefined,
      })

      toast({
        title: 'Conta cadastrada com sucesso!',
        description: `${novaConta.codigo || ''} ${novaConta.nome} vinculada ao plano de contas.`,
      })

      onSuccess(novoPlano)
      onOpenChange(false)
    } catch (err: unknown) {
      console.error('Erro ao cadastrar conta no modal rápido:', err)
      const error = err as Error
      const msg =
        error?.message ||
        'Falha ao salvar conta ou plano de contas. Verifique se possui permissão na empresa selecionada.'
      setErrorMessage(msg)
      toast({
        title: 'Erro ao cadastrar conta',
        description: msg,
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const gruposDisponiveis = GRUPOS_POR_TIPO[tipo] || []

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg bg-white">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-xl">Cadastro Rápido de Conta</DialogTitle>
              <DialogDescription>
                Cria a conta contábil e a vincula automaticamente a um Plano de Contas (PC).
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSave} className="space-y-4 py-2">
          {errorMessage && (
            <Alert variant="destructive" className="bg-red-50 border-red-200 text-red-800 py-2">
              <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
              <AlertDescription className="text-xs font-medium">{errorMessage}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="nome">Nome da Conta *</Label>
            <Input
              id="nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Energia Elétrica"
              required
              disabled={loading}
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="quick-codigo-empresa" className="text-xs font-semibold text-slate-700">
              Código da Conta da Empresa (Opcional)
            </Label>
            <Input
              id="quick-codigo-empresa"
              value={codigoEmpresa}
              onChange={(e) => setCodigoEmpresa(e.target.value)}
              placeholder="Código usado pela empresa, ex: 1.1.2.001"
              disabled={loading}
              className="text-xs font-mono"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Tipo Contábil *</Label>
              <Select
                value={tipo}
                onValueChange={(val) => handleTipoChange(val as TipoConta)}
                disabled={loading}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Ativo">Ativo</SelectItem>
                  <SelectItem value="Passivo">Passivo</SelectItem>
                  <SelectItem value="Patrimônio Líquido">Patrimônio Líquido</SelectItem>
                  <SelectItem value="Receita">Receita</SelectItem>
                  <SelectItem value="Despesa">Despesa</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Grupo *</Label>
              <Select
                value={grupo}
                onValueChange={(val) => setGrupo(val as GrupoConta)}
                disabled={loading}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o grupo" />
                </SelectTrigger>
                <SelectContent>
                  {gruposDisponiveis.map((g) => (
                    <SelectItem key={g} value={g}>
                      {g}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Centro de Custo *</Label>
            <Select
              value={centroId}
              onValueChange={setCentroId}
              disabled={loading || centros.length === 0}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={
                    centros.length === 0 ? 'Nenhum centro cadastrado' : 'Selecione o centro'
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {centros.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.codigo || 'CC'} - {c.nome} ({c.tipo || 'Geral'})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {centros.length === 0 && (
              <p className="text-xs text-amber-600">
                Atenção: Cadastre pelo menos um Centro de Custo no menu para associar.
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Tipo de Despesa (Opcional)</Label>
            <Select
              value={tipoDespesaId}
              onValueChange={(val) => setTipoDespesaId(val === 'none' ? '' : val)}
              disabled={loading}
            >
              <SelectTrigger>
                <SelectValue placeholder="Nenhum (Opcional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhum (Opcional)</SelectItem>
                {listaTiposDespesa.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.codigo ? `[${t.codigo}] ` : ''}
                    {t.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter className="pt-3 gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={loading || !nome.trim() || !centroId}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  Cadastrar e Vincular
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
