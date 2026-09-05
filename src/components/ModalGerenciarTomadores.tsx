import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Plus, Search, Edit2, Trash2, Users, Building2, User, Phone, Mail } from 'lucide-react'
import { NfseTomadorRecord } from '@/types/finance'
import { tomadoresService } from '@/services/tomadoresService'
import { ModalCadastroTomador } from './ModalCadastroTomador'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/contexts/AuthContext'

interface ModalGerenciarTomadoresProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  empresaId: string
}

export function ModalGerenciarTomadores({
  open,
  onOpenChange,
  empresaId,
}: ModalGerenciarTomadoresProps) {
  const { user } = useAuth()
  const { toast } = useToast()
  const [tomadores, setTomadores] = useState<NfseTomadorRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [busca, setBusca] = useState('')
  const [modalCadastroOpen, setModalCadastroOpen] = useState(false)
  const [tomadorParaEditar, setTomadorParaEditar] = useState<NfseTomadorRecord | null>(null)

  useEffect(() => {
    if (open) {
      carregar()
    }
  }, [open, empresaId])

  const carregar = async () => {
    setLoading(true)
    try {
      const lista = await tomadoresService.listar(empresaId || undefined, false)
      setTomadores(lista)
    } catch (err) {
      console.warn('Erro ao carregar lista de tomadores:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleExcluir = async (tomador: NfseTomadorRecord) => {
    if (confirm(`Deseja realmente excluir o tomador "${tomador.razao_social}"?`)) {
      try {
        await tomadoresService.excluir(
          tomador.id,
          tomador.empresa,
          user?.id,
          user?.name || user?.email,
        )
        toast({
          title: 'Tomador excluído',
          description: 'Registro removido com sucesso.',
        })
        carregar()
      } catch (err: any) {
        toast({
          title: 'Erro ao excluir',
          description: err?.message || 'Falha ao excluir registro.',
          variant: 'destructive',
        })
      }
    }
  }

  const tomadoresFiltrados = tomadores.filter((t) => {
    const termo = busca.toLowerCase()
    return (
      t.razao_social.toLowerCase().includes(termo) ||
      t.cpf_cnpj.includes(termo) ||
      (t.email && t.email.toLowerCase().includes(termo)) ||
      (t.cidade && t.cidade.toLowerCase().includes(termo))
    )
  })

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[88vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <DialogTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-primary" />
                  Cadastro de Tomadores de Serviços (NFS-e Nacional)
                </DialogTitle>
                <DialogDescription>
                  Gerencie os clientes e tomadores vinculados à empresa para emissão simplificada de
                  DPS.
                </DialogDescription>
              </div>
              <Button
                size="sm"
                className="gap-1.5"
                onClick={() => {
                  setTomadorParaEditar(null)
                  setModalCadastroOpen(true)
                }}
              >
                <Plus className="w-4 h-4" /> Novo Tomador
              </Button>
            </div>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar por razão social, CNPJ/CPF, e-mail ou cidade..."
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  className="pl-9 h-9 text-xs"
                />
              </div>
            </div>

            <div className="border rounded-md overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="text-xs">
                    <TableHead>Tomador / Documento</TableHead>
                    <TableHead>Localização</TableHead>
                    <TableHead>Contato</TableHead>
                    <TableHead className="w-20 text-center">Status</TableHead>
                    <TableHead className="w-24 text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="text-center py-6 text-xs text-muted-foreground"
                      >
                        Carregando base de tomadores...
                      </TableCell>
                    </TableRow>
                  ) : tomadoresFiltrados.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="text-center py-6 text-xs text-muted-foreground"
                      >
                        Nenhum tomador de serviço cadastrado até o momento.
                      </TableCell>
                    </TableRow>
                  ) : (
                    tomadoresFiltrados.map((tomador) => (
                      <TableRow key={tomador.id} className="text-xs">
                        <TableCell>
                          <div className="font-semibold text-foreground flex items-center gap-1.5">
                            {tomador.tipo_pessoa === 'PJ' ? (
                              <Building2 className="w-3.5 h-3.5 text-primary" />
                            ) : (
                              <User className="w-3.5 h-3.5 text-primary" />
                            )}
                            {tomador.razao_social}
                          </div>
                          <div className="font-mono text-[11px] text-muted-foreground">
                            {tomador.cpf_cnpj}{' '}
                            {tomador.inscricao_municipal
                              ? `| IM: ${tomador.inscricao_municipal}`
                              : ''}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            {tomador.cidade || 'São Paulo'} / {tomador.estado || 'SP'}
                          </div>
                          <div className="text-[11px] text-muted-foreground">
                            {tomador.logradouro
                              ? `${tomador.logradouro}, ${tomador.numero || 'S/N'}`
                              : '-'}
                          </div>
                        </TableCell>
                        <TableCell>
                          {tomador.email ? (
                            <div className="flex items-center gap-1 text-[11px]">
                              <Mail className="w-3 h-3 text-muted-foreground" />
                              <span className="truncate max-w-[140px]">{tomador.email}</span>
                            </div>
                          ) : null}
                          {tomador.telefone ? (
                            <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                              <Phone className="w-3 h-3" />
                              <span>{tomador.telefone}</span>
                            </div>
                          ) : null}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge
                            variant={tomador.ativo !== false ? 'outline' : 'secondary'}
                            className="text-[10px]"
                          >
                            {tomador.ativo !== false ? 'Ativo' : 'Inativo'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => {
                                setTomadorParaEditar(tomador)
                                setModalCadastroOpen(true)
                              }}
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive hover:bg-destructive/10"
                              onClick={() => handleExcluir(tomador)}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ModalCadastroTomador
        open={modalCadastroOpen}
        onOpenChange={setModalCadastroOpen}
        empresaId={empresaId}
        tomadorParaEditar={tomadorParaEditar}
        onSalvo={() => {
          carregar()
        }}
      />
    </>
  )
}
