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
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import {
  Mail,
  Send,
  Building2,
  AlertCircle,
  FileText,
  DollarSign,
  Info,
  CheckCircle2,
} from 'lucide-react'
import { simuladorCenariosService } from '@/services/simuladorCenariosService'
import type { ItemSimulado, ParametrosMarkup } from '@/pages/SimuladorPrecos'

export interface ItemLaudoSimulado {
  id: string
  produtoId: string
  codigo: string
  nome: string
  unidade?: string
  custoTotal: number
  precoSugerido: number
  precoAtual?: number
  precoInformado?: number
  lucroVenda?: number
  margemLucroPct?: number
  descontoMaximoPct?: number
  precoMinimoVenda?: number
  semMargemDesconto?: boolean
}

export interface ModalEnviarLaudoSimuladorEmailProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  empresaId: string
  empresaNome: string
  empresaEmail?: string
  parametros: ParametrosMarkup
  divisorCalculado: number
  itensSimulados: ItemLaudoSimulado[]
  consultoriaNome?: string
}

function formatBrl(val?: number | null): string {
  if (val === undefined || val === null || isNaN(val)) return 'R$ 0,00'
  return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatPct(val?: number | null): string {
  if (val === undefined || val === null || isNaN(val)) return '0,00%'
  return `${val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`
}

export function ModalEnviarLaudoSimuladorEmail({
  open,
  onOpenChange,
  empresaId,
  empresaNome,
  empresaEmail,
  parametros,
  divisorCalculado,
  itensSimulados,
  consultoriaNome = 'Gestão Econômica e Financeira',
}: ModalEnviarLaudoSimuladorEmailProps) {
  const { toast } = useToast()

  const [destinatarioEmail, setDestinatarioEmail] = useState('')
  const [assunto, setAssunto] = useState('')
  const [mensagemOpcional, setMensagemOpcional] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [avisoSmtp, setAvisoSmtp] = useState<string | null>(null)

  // Ao abrir o modal, preencher campos padrão
  useEffect(() => {
    if (open) {
      const dataHoje = new Date().toLocaleDateString('pt-BR')
      setDestinatarioEmail(empresaEmail || '')
      setAssunto(`Simulação de Preços & Mark-Up — ${empresaNome || 'Empresa'} — ${dataHoje}`)
      setMensagemOpcional(
        `Prezada equipe da ${empresaNome || 'empresa'},\n\nSegue em anexo a memória de cálculo do mark-up divisor e a tabela com os preços de venda sugeridos calculados para os produtos da sua empresa.\n\nAtenciosamente,\n${consultoriaNome}`,
      )
      setAvisoSmtp(null)
    }
  }, [open, empresaEmail, empresaNome, consultoriaNome])

  /**
   * Monta o HTML corporativo completo com o cabeçalho, memória de mark-up e tabela de preços sugeridos
   */
  const gerarHtmlLaudo = (): string => {
    const dataHoje = new Date().toLocaleDateString('pt-BR')

    // Linhas da tabela de produtos
    const linhasTabela = itensSimulados
      .map((item) => {
        const precoPrat =
          item.precoInformado !== undefined ? item.precoInformado : item.precoSugerido
        const lucro =
          item.lucroVenda !== undefined
            ? item.lucroVenda
            : (item.precoSugerido * (parametros.margemLucroPct || 0)) / 100
        const isPrejuizo = lucro < 0
        const lucroColor = isPrejuizo ? '#b91c1c' : '#15803d'
        const lucroBg = isPrejuizo ? '#fef2f2' : '#f0fdf4'
        const margemPct =
          item.margemLucroPct !== undefined
            ? `${item.margemLucroPct.toFixed(1)}%`
            : formatPct(parametros.margemLucroPct)

        const descTexto = item.semMargemDesconto
          ? '<span style="color: #b91c1c; font-weight: 700; font-size: 10px; background: #fee2e2; padding: 2px 6px; border-radius: 4px;">Sem margem</span>'
          : `<strong style="color: #1e293b;">${(item.descontoMaximoPct ?? 0).toFixed(2)}%</strong><br/><span style="font-size: 10px; color: #64748b;">(Mín: ${formatBrl(item.precoMinimoVenda)})</span>`

        return `
        <tr style="border-bottom: 1px solid #f1f5f9; font-size: 12px; ${isPrejuizo ? 'background-color: #fff1f2;' : ''}">
          <td style="padding: 10px 8px; text-align: left; font-weight: 600; color: #0f172a;">
            ${item.codigo ? `<span style="font-family: monospace; color: #64748b; font-size: 11px;">[${item.codigo}] </span>` : ''}
            ${item.nome}
          </td>
          <td style="padding: 10px 8px; text-align: right; color: #475569;">
            ${formatBrl(item.custoTotal)}
          </td>
          <td style="padding: 10px 8px; text-align: right; color: #475569;">
            ${formatBrl(item.precoSugerido)}
          </td>
          <td style="padding: 10px 8px; text-align: right; font-weight: 700; color: #1e3a8a; background-color: #eff6ff;">
            ${formatBrl(precoPrat)}
          </td>
          <td style="padding: 10px 8px; text-align: right; font-weight: 800; color: ${lucroColor}; background-color: ${lucroBg};">
            ${formatBrl(lucro)} (${margemPct})
          </td>
          <td style="padding: 10px 8px; text-align: right; color: #334155;">
            ${descTexto}
          </td>
        </tr>
      `
      })
      .join('')

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Laudo de Simulação de Preços</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b;">
        <div style="max-width: 720px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
          
          <!-- Cabeçalho Institucional -->
          <div style="background: linear-gradient(135deg, #0B1F3A 0%, #1e3a8a 100%); padding: 28px 24px; color: #ffffff;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
              <span style="font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase; color: #93c5fd; font-weight: 700;">
                ${consultoriaNome}
              </span>
              <span style="font-size: 12px; color: #cbd5e1; background: rgba(255,255,255,0.1); padding: 4px 10px; border-radius: 999px;">
                ${dataHoje}
              </span>
            </div>
            <h1 style="margin: 0; font-size: 22px; font-weight: 800; color: #ffffff;">
              Laudo Técnico de Formação & Simulação de Preços
            </h1>
            <p style="margin: 6px 0 0 0; font-size: 13px; color: #bfdbfe;">
              Empresa: <strong>${empresaNome}</strong>
            </p>
          </div>

          <div style="padding: 24px;">
            <!-- Mensagem Opcional -->
            ${
              mensagemOpcional
                ? `
              <div style="background-color: #f8fafc; border-left: 4px solid #3b82f6; padding: 14px 16px; border-radius: 0 8px 8px 0; margin-bottom: 24px; font-size: 13px; color: #334155; white-space: pre-line; line-height: 1.5;">
                ${mensagemOpcional}
              </div>
            `
                : ''
            }

            <!-- Quadro Resumo do Mark-up Divisor -->
            <div style="margin-bottom: 24px; border: 1px solid #e2e8f0; border-radius: 10px; padding: 16px; background-color: #fafafa;">
              <h3 style="margin: 0 0 12px 0; font-size: 14px; font-weight: 700; color: #0f172a; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px;">
                Memória do Mark-Up Divisor Aplicado
              </h3>

              <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 10px; margin-bottom: 14px;">
                <div style="padding: 8px; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 6px; text-align: center;">
                  <span style="display: block; font-size: 10px; color: #64748b; font-weight: 600; text-transform: uppercase;">Prazo Médio</span>
                  <strong style="font-size: 14px; color: #0f172a;">${parametros.prazoDias} dias</strong>
                </div>
                <div style="padding: 8px; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 6px; text-align: center;">
                  <span style="display: block; font-size: 10px; color: #64748b; font-weight: 600; text-transform: uppercase;">Juros / Custo Fin.</span>
                  <strong style="font-size: 14px; color: #0f172a;">${formatPct(parametros.jurosMesPct)}</strong>
                </div>
                <div style="padding: 8px; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 6px; text-align: center;">
                  <span style="display: block; font-size: 10px; color: #64748b; font-weight: 600; text-transform: uppercase;">Comissão + Frete</span>
                  <strong style="font-size: 14px; color: #0f172a;">${formatPct(parametros.comissaoPct + parametros.fretePct)}</strong>
                </div>
                <div style="padding: 8px; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 6px; text-align: center;">
                  <span style="display: block; font-size: 10px; color: #64748b; font-weight: 600; text-transform: uppercase;">Margem Lucro</span>
                  <strong style="font-size: 14px; color: #16a34a;">${formatPct(parametros.margemLucroPct)}</strong>
                </div>
              </div>

              <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 12px; display: flex; justify-content: space-between; align-items: center;">
                <span style="font-size: 13px; font-weight: 600; color: #166534;">
                  Fórmula: Preço Sugerido = Custo Total ÷ Mark-Up Divisor
                </span>
                <span style="font-family: monospace; font-size: 15px; font-weight: 800; color: #14532d; background: #ffffff; padding: 4px 10px; border-radius: 6px; border: 1px solid #86efac;">
                  ÷ ${divisorCalculado.toFixed(4)}
                </span>
              </div>
            </div>

            <!-- Tabela de Produtos Simulados -->
            <div style="margin-bottom: 24px;">
              <h3 style="margin: 0 0 12px 0; font-size: 14px; font-weight: 700; color: #0f172a;">
                Preços de Venda Sugeridos por Produto (${itensSimulados.length} itens)
              </h3>

              <div style="overflow-x: auto; border: 1px solid #e2e8f0; border-radius: 8px;">
                <table style="width: 100%; border-collapse: collapse; text-align: left;">
                  <thead>
                    <tr style="background-color: #f8fafc; border-bottom: 2px solid #e2e8f0; font-size: 11px; text-transform: uppercase; color: #475569;">
                      <th style="padding: 10px 8px; font-weight: 700;">Produto</th>
                      <th style="padding: 10px 8px; text-align: right; font-weight: 700;">Custo Total</th>
                      <th style="padding: 10px 8px; text-align: right; font-weight: 700;">Preço Sugerido</th>
                      <th style="padding: 10px 8px; text-align: right; font-weight: 700; color: #1e3a8a;">Preço Informado</th>
                      <th style="padding: 10px 8px; text-align: right; font-weight: 700; color: #166534;">Lucro da Venda</th>
                      <th style="padding: 10px 8px; text-align: right; font-weight: 700; color: #7c2d12;">Desconto Máx.</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${linhasTabela}
                  </tbody>
                </table>
              </div>
            </div>

            <!-- Rodapé Técnico -->
            <div style="border-top: 1px solid #e2e8f0; padding-top: 16px; font-size: 11px; color: #64748b; line-height: 1.5;">
              <p style="margin: 0 0 4px 0;">
                <strong>Nota Técnica:</strong> Os preços de venda sugeridos calculados absorvem integralmente todos os tributos sobre o faturamento, despesas operacionais proporcionais, encargos financeiros por prazo de recebimento e a margem de lucro líquida estipulada.
              </p>
              <p style="margin: 0; color: #94a3b8;">
                Emitido pela plataforma de Gestão Econômica e Financeira · ${consultoriaNome}.
              </p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `
  }

  const handleEnviar = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!destinatarioEmail.trim() || !destinatarioEmail.includes('@')) {
      toast({
        title: 'E-mail inválido',
        description: 'Informe um endereço de e-mail válido para o envio do laudo.',
        variant: 'destructive',
      })
      return
    }

    if (itensSimulados.length === 0) {
      toast({
        title: 'Nenhum produto simulado',
        description: 'Selecione ou simule ao menos um produto antes de enviar o laudo.',
        variant: 'destructive',
      })
      return
    }

    setEnviando(true)
    setAvisoSmtp(null)

    try {
      const htmlCompleto = gerarHtmlLaudo()
      const res = await simuladorCenariosService.enviarLaudoEmail({
        destinatario_email: destinatarioEmail.trim(),
        assunto: assunto.trim(),
        mensagem_opcional: mensagemOpcional.trim(),
        empresa_id: empresaId,
        empresa_nome: empresaNome,
        html_conteudo: htmlCompleto,
      })

      if (res.success) {
        toast({
          title: 'Laudo enviado com sucesso!',
          description: `O e-mail foi encaminhado para ${destinatarioEmail}.`,
        })
        onOpenChange(false)
      } else {
        // Se retornou false mas não explodiu HTTP
        if (res.codigo === 'SMTP_NAO_CONFIGURADO') {
          setAvisoSmtp(
            'O servidor de e-mail da plataforma ainda aguarda configuração de credenciais SMTP. Os dados e a memória de cálculo do laudo foram validados e estruturados com sucesso.',
          )
        } else {
          toast({
            title: 'Não foi possível enviar o e-mail',
            description: res.message || 'Falha na comunicação com o servidor de e-mail.',
            variant: 'destructive',
          })
        }
      }
    } catch (err: any) {
      console.warn('Erro ao disparar e-mail do laudo do simulador:', err)
      const dataResp = err?.data || err?.response?.data || {}
      const mensagemErro = dataResp?.message || err?.message || ''

      // Verificação amigável de SMTP não configurado
      if (
        dataResp?.codigo === 'SMTP_NAO_CONFIGURADO' ||
        mensagemErro.includes('SMTP') ||
        mensagemErro.includes('Servidor de e-mail ainda não configurado')
      ) {
        setAvisoSmtp(
          'O servidor de e-mail da plataforma ainda aguarda a ativação do serviço de envio (SMTP). A estrutura completa do laudo técnico com o mark-up e os preços sugeridos foi gerada e está pronta para transmissão.',
        )
      } else {
        toast({
          title: 'Falha no envio de e-mail',
          description:
            'O serviço de e-mail temporariamente indisponível. Verifique a conexão ou aguarde a configuração do provedor.',
          variant: 'destructive',
        })
      }
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl bg-white max-h-[85vh] flex flex-col">
        <DialogHeader className="border-b pb-3">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-blue-100 text-blue-700">
              <Mail className="w-5 h-5" />
            </span>
            <div>
              <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                Enviar Laudo de Simulação por E-mail
                <Badge variant="outline" className="text-xs font-normal">
                  {empresaNome}
                </Badge>
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                Dispare a memória de cálculo e os preços sugeridos em formato corporativo para o
                cliente ou diretoria.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleEnviar} className="flex-1 overflow-y-auto py-3 space-y-3.5 text-xs">
          {/* Card Resumo do Conteúdo */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-blue-600" />
                Laudo Técnico Formatado
              </span>
              <p className="text-[11px] text-slate-500">
                {itensSimulados.length} produto(s) simulado(s) · Mark-Up Divisor:{' '}
                <strong>÷ {divisorCalculado.toFixed(4)}</strong>
              </p>
            </div>
            <Badge className="bg-emerald-100 text-emerald-800 border-none font-mono text-[10px]">
              Margem: {parametros.margemLucroPct}%
            </Badge>
          </div>

          {/* Aviso se SMTP não configurado */}
          {avisoSmtp && (
            <div className="p-3.5 bg-amber-50 rounded-xl border border-amber-200 text-amber-900 space-y-1.5">
              <div className="flex items-center gap-1.5 font-bold text-amber-800">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Aguardando Configuração do Servidor de E-mail</span>
              </div>
              <p className="text-[11px] text-amber-800 leading-relaxed">{avisoSmtp}</p>
            </div>
          )}

          {/* Destinatário */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-700">E-mail do Destinatário *</Label>
            <Input
              type="email"
              value={destinatarioEmail}
              onChange={(e) => setDestinatarioEmail(e.target.value)}
              placeholder="exemplo@empresa.com.br"
              className="h-9 text-xs"
              required
            />
            {empresaEmail && destinatarioEmail !== empresaEmail && (
              <button
                type="button"
                onClick={() => setDestinatarioEmail(empresaEmail)}
                className="text-[11px] text-blue-600 hover:underline inline-block mt-0.5"
              >
                Usar e-mail cadastrado da empresa: {empresaEmail}
              </button>
            )}
          </div>

          {/* Assunto */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-700">Assunto do E-mail *</Label>
            <Input
              value={assunto}
              onChange={(e) => setAssunto(e.target.value)}
              placeholder="Assunto da mensagem"
              className="h-9 text-xs"
              required
            />
          </div>

          {/* Mensagem Opcional */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-700">
              Mensagem de Acompanhamento (Opcional)
            </Label>
            <Textarea
              value={mensagemOpcional}
              onChange={(e) => setMensagemOpcional(e.target.value)}
              placeholder="Escreva uma mensagem ou orientação para o destinatário..."
              className="text-xs min-h-[90px]"
            />
          </div>

          <DialogFooter className="border-t pt-3 gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={enviando}
              className="text-xs"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={enviando || itensSimulados.length === 0}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs gap-1.5 shadow-xs"
            >
              {enviando ? (
                'Transmitindo...'
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
