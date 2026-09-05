import React, { useState } from 'react'
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
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Mail, Send, AlertTriangle, CheckCircle2, Building2, Calendar, Target } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { bscService } from '@/services/bscService'
import type { EmpresaRecord, MinhaEmpresaRecord, BscIniciativaRecord } from '@/types/finance'
import type { ResumoPerspectivaPdf } from '@/components/ModalPdfBscA4'

export interface ModalEnviarLaudoBscEmailProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedEmpresa: EmpresaRecord | null
  selectedAno: number
  minhaEmpresa: MinhaEmpresaRecord | null
  scoreGlobal: number
  resumosPerspectivas: ResumoPerspectivaPdf[]
  iniciativas?: BscIniciativaRecord[]
}

export function ModalEnviarLaudoBscEmail({
  open,
  onOpenChange,
  selectedEmpresa,
  selectedAno,
  minhaEmpresa,
  scoreGlobal,
  resumosPerspectivas,
  iniciativas = [],
}: ModalEnviarLaudoBscEmailProps) {
  const { toast } = useToast()

  const empresaNome = selectedEmpresa?.nome_fantasia || selectedEmpresa?.nome || 'Empresa'
  const emailInicial = selectedEmpresa?.email || ''

  const [destinatario, setDestinatario] = useState<string>(emailInicial)
  const [assunto, setAssunto] = useState<string>(
    `Laudo BSC — ${empresaNome} — Exercício ${selectedAno}`,
  )
  const [mensagem, setMensagem] = useState<string>(
    'Olá! Encaminhamos o Laudo Executivo do Balanced Scorecard com a apuração de performance estratégica e os planos de ação vigentes.',
  )
  const [isSending, setIsSending] = useState<boolean>(false)
  const [erroSmtp, setErroSmtp] = useState<string | null>(null)

  // Atualizar quando o modal abrir ou a empresa mudar
  React.useEffect(() => {
    if (open) {
      setDestinatario(selectedEmpresa?.email || '')
      setAssunto(`Laudo BSC — ${empresaNome} — Exercício ${selectedAno}`)
      setErroSmtp(null)
    }
  }, [open, selectedEmpresa, empresaNome, selectedAno])

  const gerarCorpoHtmlLaudo = () => {
    const nomeConsultoria =
      minhaEmpresa?.razao_social || minhaEmpresa?.nome_fantasia || 'Consultoria Estratégica'

    let perspectivasHtml = ''
    resumosPerspectivas.forEach((p) => {
      const corSemaforo = p.score >= 90 ? '#059669' : p.score >= 70 ? '#d97706' : '#dc2626'
      perspectivasHtml += `
        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; margin-bottom: 10px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <strong style="color: #0f172a; font-size: 13px;">Perspectiva ${p.nome}</strong>
            <span style="background-color: ${corSemaforo}20; color: ${corSemaforo}; font-weight: bold; padding: 2px 8px; border-radius: 12px; font-size: 12px;">
              Score: ${p.score}%
            </span>
          </div>
          <p style="margin: 0; font-size: 11px; color: #64748b;">
            ${p.atingidos} atingidos · ${p.proximos} próximos · ${p.abaixo} abaixo da meta (${p.total} KPIs)
          </p>
        </div>
      `
    })

    let iniciativasHtml = ''
    if (iniciativas.length > 0) {
      iniciativasHtml = `
        <div style="margin-top: 20px;">
          <h4 style="margin: 0 0 10px 0; color: #0B1F3A; font-size: 14px; text-transform: uppercase;">
            Planos de Ação &amp; Iniciativas Prioritárias
          </h4>
          <table style="width: 100%; border-collapse: collapse; font-size: 11px; text-align: left;">
            <thead>
              <tr style="background-color: #f1f5f9; color: #334155; border-bottom: 1px solid #cbd5e1;">
                <th style="padding: 6px 8px;">Iniciativa</th>
                <th style="padding: 6px 8px;">Responsável</th>
                <th style="padding: 6px 8px;">Prazo</th>
                <th style="padding: 6px 8px; text-align: center;">Status</th>
                <th style="padding: 6px 8px; text-align: right;">Progresso</th>
              </tr>
            </thead>
            <tbody>
              ${iniciativas
                .slice(0, 10)
                .map(
                  (ini) => `
                <tr style="border-bottom: 1px solid #e2e8f0;">
                  <td style="padding: 6px 8px; font-weight: bold; color: #1e293b;">${ini.titulo}</td>
                  <td style="padding: 6px 8px; color: #475569;">${ini.responsavel || '—'}</td>
                  <td style="padding: 6px 8px; color: #475569;">${ini.prazo ? new Date(ini.prazo).toLocaleDateString('pt-BR') : 'A definir'}</td>
                  <td style="padding: 6px 8px; text-align: center; color: ${ini.status === 'concluida' ? '#059669' : ini.status === 'em_andamento' ? '#2563eb' : '#d97706'}; font-weight: bold;">
                    ${ini.status === 'concluida' ? 'Concluída' : ini.status === 'em_andamento' ? 'Em Andamento' : ini.status === 'planejada' ? 'Planejada' : 'Cancelada'}
                  </td>
                  <td style="padding: 6px 8px; text-align: right; font-weight: bold; color: #1e293b;">${ini.progresso ?? 0}%</td>
                </tr>
              `,
                )
                .join('')}
            </tbody>
          </table>
          ${iniciativas.length > 10 ? `<p style="font-size: 10px; color: #64748b; margin-top: 6px;">Exibindo as 10 principais iniciativas de um total de ${iniciativas.length}.</p>` : ''}
        </div>
      `
    }

    return `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 680px; margin: 0 auto; color: #1e293b; line-height: 1.6; background-color: #ffffff;">
        <div style="background: linear-gradient(135deg, #0B1F3A 0%, #1e3a8a 100%); padding: 24px; border-radius: 12px 12px 0 0; text-align: center;">
          <h2 style="color: #ffffff; margin: 0; font-size: 20px; font-weight: 800; letter-spacing: -0.5px;">
            LAUDO EXECUTIVO BALANCED SCORECARD (BSC)
          </h2>
          <p style="color: #93c5fd; margin: 6px 0 0 0; font-size: 13px;">
            ${empresaNome} · Exercício Base ${selectedAno}
          </p>
        </div>

        <div style="padding: 24px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px;">
          ${mensagem ? `<div style="background-color: #f8fafc; border-left: 4px solid #2563eb; padding: 12px 16px; margin-bottom: 20px; font-size: 13px; color: #334155; border-radius: 0 6px 6px 0;">${mensagem}</div>` : ''}

          <div style="background-color: #eff6ff; border: 1px solid #bfdbfe; border-radius: 10px; padding: 16px; margin-bottom: 20px; text-align: center;">
            <span style="font-size: 11px; text-transform: uppercase; font-weight: bold; color: #1e40af; letter-spacing: 0.5px;">
              Score Global de Execução Estratégica (${selectedAno})
            </span>
            <div style="font-size: 32px; font-weight: 900; color: #1e3a8a; margin: 4px 0;">
              ${scoreGlobal}%
            </div>
            <p style="margin: 0; font-size: 12px; color: #475569;">
              ${scoreGlobal >= 90 ? '🟢 Alto Atingimento das Metas' : scoreGlobal >= 70 ? '🟡 Desempenho Mediano / Atenção' : '🔴 Desempenho Crítico / Ações Corretivas Necessárias'}
            </p>
          </div>

          <h4 style="margin: 0 0 10px 0; color: #0B1F3A; font-size: 14px; text-transform: uppercase;">
            Síntese das 4 Perspectivas Corporativas
          </h4>
          ${perspectivasHtml}

          ${iniciativasHtml}

          <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #64748b; text-align: center;">
            <p style="margin: 0 0 4px 0;">
              Documento gerado e transmitido pela plataforma de <strong>Gestão Econômica e Financeira</strong> por <strong>${nomeConsultoria}</strong>.
            </p>
            <p style="margin: 0;">
              Responsável Técnico: ${minhaEmpresa?.contador_nome || 'Consultoria de Controladoria'}
              ${minhaEmpresa?.contador_crc ? ` · CRC ${minhaEmpresa.contador_crc}` : ''}
            </p>
          </div>
        </div>
      </div>
    `
  }

  const handleEnviar = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!destinatario || !destinatario.includes('@')) {
      toast({
        title: 'E-mail inválido',
        description: 'Informe um endereço de e-mail válido para o destinatário.',
        variant: 'destructive',
      })
      return
    }

    setIsSending(true)
    setErroSmtp(null)

    try {
      const html = gerarCorpoHtmlLaudo()
      const resp = await bscService.enviarLaudoEmail({
        destinatario_email: destinatario.trim(),
        assunto: assunto.trim(),
        mensagem_opcional: mensagem.trim(),
        empresa_id: selectedEmpresa?.id,
        empresa_nome: empresaNome,
        ano: selectedAno,
        score_global: scoreGlobal,
        html_conteudo: html,
      })

      if (resp.success) {
        toast({
          title: 'E-mail enviado com sucesso! 🚀',
          description: `O laudo do BSC foi transmitido para ${destinatario}.`,
        })
        onOpenChange(false)
      } else {
        throw new Error(resp.message || 'Erro no envio do e-mail.')
      }
    } catch (err: any) {
      console.error('Erro ao enviar e-mail do laudo BSC:', err)
      const msg =
        err?.data?.message || err?.message || 'Falha na comunicação com o servidor de e-mail.'

      // Detectar se é falta de SMTP
      if (
        msg.includes('SMTP') ||
        msg.includes('Servidor de e-mail ainda não configurado') ||
        err?.data?.codigo === 'SMTP_NAO_CONFIGURADO'
      ) {
        setErroSmtp(
          'Servidor de e-mail ainda não configurado. Forneça as credenciais SMTP (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM) nas configurações de ambiente para habilitar o envio transacional.',
        )
      } else {
        setErroSmtp(msg)
      }

      toast({
        title: 'Não foi possível enviar o e-mail',
        description: msg,
        variant: 'destructive',
      })
    } finally {
      setIsSending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-blue-100 text-blue-700">
              <Mail className="w-5 h-5" />
            </span>
            <div>
              <DialogTitle className="text-base sm:text-lg font-bold text-[#0B1F3A] flex items-center gap-2">
                Enviar Laudo BSC por E-mail
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                Dispare o laudo executivo e o resumo das iniciativas diretamente ao cliente.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Resumo da Empresa e Score */}
        <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex items-center justify-between gap-3 text-xs">
          <div className="space-y-0.5">
            <div className="flex items-center gap-1.5 font-bold text-slate-900">
              <Building2 className="w-3.5 h-3.5 text-blue-600" />
              <span>{empresaNome}</span>
            </div>
            <div className="flex items-center gap-2 text-slate-500 text-[11px]">
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3" /> Exercício {selectedAno}
              </span>
              <span>·</span>
              <span className="flex items-center gap-1">
                <Target className="w-3 h-3" /> {resumosPerspectivas.length} perspectivas
              </span>
            </div>
          </div>

          <div className="text-right">
            <span className="text-[10px] text-slate-500 font-semibold block">Score Global</span>
            <span className="text-lg font-mono font-black text-blue-800">{scoreGlobal}%</span>
          </div>
        </div>

        {/* Aviso Amigável caso o SMTP não esteja configurado */}
        {erroSmtp && (
          <Alert className="bg-amber-50 border-amber-300 text-amber-900">
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
            <AlertDescription className="text-xs leading-relaxed">
              <strong>Atenção:</strong> {erroSmtp}
            </AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleEnviar} className="space-y-3.5 py-1">
          {/* Destinatário */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
              <span>Destinatário (E-mail do Cliente) *</span>
            </Label>
            <Input
              type="email"
              value={destinatario}
              onChange={(e) => setDestinatario(e.target.value)}
              placeholder="cliente@empresa.com.br"
              className="h-9 text-xs"
              required
            />
          </div>

          {/* Assunto */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-700">Assunto</Label>
            <Input
              value={assunto}
              onChange={(e) => setAssunto(e.target.value)}
              placeholder="Assunto do e-mail..."
              className="h-9 text-xs"
              required
            />
          </div>

          {/* Mensagem Opcional */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-700">
              Mensagem Adicional / Apresentação (Opcional)
            </Label>
            <Textarea
              value={mensagem}
              onChange={(e) => setMensagem(e.target.value)}
              placeholder="Escreva uma mensagem introdutória para acompanhar o laudo..."
              className="text-xs min-h-[70px]"
            />
          </div>

          {/* Conteúdo que será incluído no corpo do e-mail */}
          <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-[11px] text-slate-600 space-y-1">
            <span className="font-bold text-slate-800 block">
              Conteúdo transmitido no corpo do e-mail (HTML Corporativo A4-like):
            </span>
            <ul className="list-disc pl-4 space-y-0.5 text-slate-500">
              <li>
                Score Global e semáforo das 4 perspectivas (Financeira, Clientes, Processos,
                Pessoas)
              </li>
              <li>Resumo de metas atingidas, em atenção e críticas</li>
              <li>
                Planos de ação cadastrados ({iniciativas.length} iniciativa(s)) com responsáveis e
                prazos
              </li>
              <li>Identificação formal da sua consultoria e CRC do responsável</li>
            </ul>
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="text-xs"
              disabled={isSending}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSending}
              className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold gap-1.5 shadow-xs"
            >
              {isSending ? (
                <>Transmitindo...</>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  Enviar Laudo por E-mail
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default ModalEnviarLaudoBscEmail
