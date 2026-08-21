import React, { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Bell, User, Mail, ShieldAlert, Check } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/hooks/use-toast'

interface ModalPerfilProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ModalPerfil({ open, onOpenChange }: ModalPerfilProps) {
  const { user, updateUser } = useAuth()
  const { toast } = useToast()

  // O padrão do toggle de e-mail é ativado (true se undefined ou true)
  const [receberEmail, setReceberEmail] = useState<boolean>(() => {
    return user?.receber_alertas_email !== false
  })
  const [isSaving, setIsSaving] = useState(false)

  // Atualizar estado quando modal abre
  React.useEffect(() => {
    if (open && user) {
      setReceberEmail(user.receber_alertas_email !== false)
    }
  }, [open, user])

  const handleToggle = async (checked: boolean) => {
    setReceberEmail(checked)
    try {
      setIsSaving(true)
      await updateUser({
        receber_alertas_email: checked,
      })
      toast({
        title: checked ? 'Alertas por e-mail ativados' : 'Alertas por e-mail desativados',
        description: checked
          ? 'Você receberá avisos diários caso alguma meta entre em risco.'
          : 'Você não receberá notificações de metas por e-mail.',
      })
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Erro ao atualizar preferência',
        description: err.message || 'Não foi possível salvar a alteração.',
      })
      // Reverter
      setReceberEmail(!checked)
    } finally {
      setIsSaving(false)
    }
  }

  const userInitial = user?.name ? user.name.charAt(0).toUpperCase() : 'U'
  const userName = user?.name || 'Usuário do Sistema'
  const userEmail = user?.email || 'Sem e-mail cadastrado'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[460px] bg-white border-slate-200">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[#0B1F3A]">
            <User className="w-5 h-5 text-blue-600" />
            Perfil e Configurações
          </DialogTitle>
          <DialogDescription className="text-xs">
            Gerencie suas informações de conta e preferências de notificação do sistema.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Card de Identificação */}
          <div className="flex items-center gap-3 p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
            <Avatar className="w-12 h-12 border border-slate-300 bg-blue-600 shadow-xs">
              <AvatarFallback className="bg-blue-600 text-white font-bold text-base">
                {userInitial}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-[#0B1F3A] truncate">{userName}</p>
              <p className="text-xs text-slate-500 truncate flex items-center gap-1.5 mt-0.5">
                <Mail className="w-3.5 h-3.5 text-slate-400" />
                {userEmail}
              </p>
            </div>
          </div>

          {/* Preferências de Alertas */}
          <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
              <Bell className="w-4 h-4 text-blue-600" />
              Notificações e Alertas
            </div>

            <div className="flex items-start justify-between gap-3 pt-2">
              <div className="space-y-0.5">
                <Label
                  htmlFor="toggle-alertas-email"
                  className="text-xs font-semibold text-slate-800 cursor-pointer"
                >
                  Receber alertas por e-mail
                </Label>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Envio automático diário às 8h quando uma meta mensal ou trimestral estiver em
                  risco de não atingimento ou sem lançamentos registrados.
                </p>
              </div>
              <Switch
                id="toggle-alertas-email"
                checked={receberEmail}
                onCheckedChange={handleToggle}
                disabled={isSaving}
              />
            </div>

            <div className="mt-3 p-2.5 bg-blue-50/60 border border-blue-100 rounded-lg flex items-start gap-2 text-[11px] text-blue-900">
              <ShieldAlert className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <span>
                Critérios de alerta: menos de 50% faltando 5 dias no mês, 0% após 15 dias, ou menos
                de 50% faltando 15 dias no trimestre.
              </span>
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-2 border-t border-slate-100">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="text-xs font-semibold text-slate-700"
          >
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
