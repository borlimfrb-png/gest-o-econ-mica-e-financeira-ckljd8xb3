import { useMemo, useState } from 'react'
import { useToast } from '@/hooks/use-toast'
import {
  formacaoPrecoServicosService,
  type FormacaoServicoRecord,
} from '@/services/formacaoPrecoServicosService'
import {
  calcularHoraTecnica,
  type ParametrosFormacaoServicos,
} from '@/lib/formacaoPrecoServicosCalculo'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Pencil, Plus, Trash2 } from 'lucide-react'

interface Props {
  servicos: FormacaoServicoRecord[]
  empresaId: string
  recarregar: () => void
  custoHoraTecnica: number
  parametrosCalculo: ParametrosFormacaoServicos
}

const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

interface FormState {
  nome: string
  descricao: string
  horasEstimadas: string
  custoDireto: string
  profissionaisEnvolvidos: string
}

const EMPTY: FormState = {
  nome: '',
  descricao: '',
  horasEstimadas: '',
  custoDireto: '',
  profissionaisEnvolvidos: '',
}

export default function AbaServicosCadastrados({
  servicos,
  empresaId,
  recarregar,
  custoHoraTecnica,
  parametrosCalculo,
}: Props) {
  const { toast } = useToast()
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<FormacaoServicoRecord | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [toDelete, setToDelete] = useState<FormacaoServicoRecord | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Mão de obra real do serviço: hora técnica × horas × profissionais envolvidos
  const calcularMaoDeObra = useMemo(
    () => (s: FormacaoServicoRecord) => {
      const horaTecnica =
        custoHoraTecnica ||
        (parametrosCalculo ? calcularHoraTecnica(parametrosCalculo).custoHoraTecnica : 0)
      return (
        horaTecnica *
        (Number(s.horas_estimadas) || 0) *
        Math.max(Number(s.profissionais_envolvidos) || 1, 1)
      )
    },
    [custoHoraTecnica, parametrosCalculo],
  )

  const openNovo = () => {
    setEditing(null)
    setForm(EMPTY)
    setModalOpen(true)
  }

  const openEditar = (s: FormacaoServicoRecord) => {
    setEditing(s)
    setForm({
      nome: s.nome || '',
      descricao: s.descricao || '',
      horasEstimadas: String(s.horas_estimadas ?? ''),
      custoDireto: String(s.custo_direto ?? ''),
      profissionaisEnvolvidos: String(s.profissionais_envolvidos ?? ''),
    })
    setModalOpen(true)
  }

  const handleSalvar = async () => {
    if (!form.nome.trim()) {
      toast({ variant: 'destructive', title: 'Informe o nome do serviço.' })
      return
    }
    try {
      setSaving(true)
      const payload = {
        nome: form.nome.trim(),
        descricao: form.descricao.trim(),
        horas_estimadas: Number(String(form.horasEstimadas).replace(',', '.')) || 0,
        custo_direto: Number(String(form.custoDireto).replace(',', '.')) || 0,
        profissionais_envolvidos: Math.max(
          Math.round(Number(String(form.profissionaisEnvolvidos).replace(',', '.')) || 1),
          1,
        ),
      }
      if (editing) {
        await formacaoPrecoServicosService.atualizarServico(editing.id, payload)
      } else {
        await formacaoPrecoServicosService.criarServico(empresaId, payload)
      }
      toast({ title: editing ? 'Serviço atualizado' : 'Serviço cadastrado' })
      setModalOpen(false)
      recarregar()
    } catch (err) {
      console.error('Erro ao salvar serviço:', err)
      toast({ variant: 'destructive', title: 'Erro ao salvar', description: 'Tente novamente.' })
    } finally {
      setSaving(false)
    }
  }

  const handleExcluir = async () => {
    if (!toDelete) return
    try {
      setDeleting(true)
      await formacaoPrecoServicosService.excluirServico(toDelete.id)
      toast({ title: 'Serviço excluído' })
      setDeleteOpen(false)
      setToDelete(null)
      recarregar()
    } catch (err) {
      console.error('Erro ao excluir serviço:', err)
      toast({ variant: 'destructive', title: 'Erro ao excluir' })
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <CardTitle className="text-base">Serviços Cadastrados</CardTitle>
          <CardDescription>
            Horas estimadas, custo direto (materiais/terceiros) e profissionais envolvidos.
            {custoHoraTecnica > 0 && ` Custo/hora técnica atual: ${fmtBRL(custoHoraTecnica)}.`}
          </CardDescription>
        </div>
        <Button size="sm" onClick={openNovo}>
          <Plus className="mr-2 h-4 w-4" /> Novo serviço
        </Button>
      </CardHeader>
      <CardContent>
        {servicos.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Nenhum serviço cadastrado. Clique em “Novo serviço” para começar.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 pr-4 font-medium">Serviço</th>
                  <th className="py-2 pr-4 text-right font-medium">Horas</th>
                  <th className="py-2 pr-4 text-right font-medium">Custo direto</th>
                  <th className="py-2 pr-4 text-right font-medium">Profissionais</th>
                  <th className="py-2 pr-4 text-right font-medium">Custo mão de obra</th>
                  <th className="py-2 text-right font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {servicos.map((s) => {
                  const maoDeObra = calcularMaoDeObra(s)
                  return (
                    <tr key={s.id} className="border-b last:border-0">
                      <td className="py-2 pr-4">
                        <span className="font-medium">{s.nome}</span>
                        {s.descricao && (
                          <span className="block text-xs text-muted-foreground">{s.descricao}</span>
                        )}
                      </td>
                      <td className="py-2 pr-4 text-right">
                        {(Number(s.horas_estimadas) || 0).toLocaleString('pt-BR')}
                      </td>
                      <td className="py-2 pr-4 text-right">
                        {fmtBRL(Number(s.custo_direto) || 0)}
                      </td>
                      <td className="py-2 pr-4 text-right">
                        {Number(s.profissionais_envolvidos) || 1}
                      </td>
                      <td className="py-2 pr-4 text-right">
                        {maoDeObra > 0 ? fmtBRL(maoDeObra) : '—'}
                      </td>
                      <td className="py-2 text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditar(s)}
                            aria-label="Editar"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setToDelete(s)
                              setDeleteOpen(true)
                            }}
                            aria-label="Excluir"
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>

      {/* Modal Novo/Editar */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar serviço' : 'Novo serviço'}</DialogTitle>
            <DialogDescription>
              Defina as horas estimadas, o custo direto e os profissionais envolvidos na execução.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="srv-nome">Nome do serviço</Label>
              <Input
                id="srv-nome"
                value={form.nome}
                onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
                placeholder="Ex.: Diagnóstico Financeiro Completo"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="srv-desc">Descrição</Label>
              <Textarea
                id="srv-desc"
                value={form.descricao}
                onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
                placeholder="Escopo, entregáveis e observações"
              />
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="flex flex-col gap-2">
                <Label htmlFor="srv-horas">Horas estimadas</Label>
                <Input
                  id="srv-horas"
                  inputMode="decimal"
                  placeholder="0"
                  value={form.horasEstimadas}
                  onChange={(e) => setForm((f) => ({ ...f, horasEstimadas: e.target.value }))}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="srv-custo">Custo direto (R$)</Label>
                <Input
                  id="srv-custo"
                  inputMode="decimal"
                  placeholder="0,00"
                  value={form.custoDireto}
                  onChange={(e) => setForm((f) => ({ ...f, custoDireto: e.target.value }))}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="srv-prof">Profissionais envolvidos</Label>
                <Input
                  id="srv-prof"
                  inputMode="numeric"
                  placeholder="1"
                  value={form.profissionaisEnvolvidos}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, profissionaisEnvolvidos: e.target.value }))
                  }
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSalvar} disabled={saving}>
              {saving ? 'Salvando…' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Excluir */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir serviço</DialogTitle>
            <DialogDescription>
              Confirmar a exclusão de “{toDelete?.nome}”? Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleExcluir} disabled={deleting}>
              {deleting ? 'Excluindo…' : 'Excluir'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
