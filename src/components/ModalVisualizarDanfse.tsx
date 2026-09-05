import React, { useState, useEffect, useRef } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Printer,
  Download,
  FileCode2,
  CheckCircle2,
  XCircle,
  Building2,
  Calendar,
  CreditCard,
  ShieldCheck,
  FileText,
  Copy,
  Info,
} from 'lucide-react'
import { NotaFiscalRecord } from '@/types/finance'
import { formatBrlMoeda, downloadArquivo } from '@/lib/nfseXmlGenerator'
import { gerarXmlDpsNacional } from '@/lib/nfseNacionalDps'
import { useToast } from '@/hooks/use-toast'

interface ModalVisualizarDanfseProps {
  nota: NotaFiscalRecord | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ModalVisualizarDanfse({ nota, open, onOpenChange }: ModalVisualizarDanfseProps) {
  const { toast } = useToast()
  const printRef = useRef<HTMLDivElement>(null)
  const [copiado, setCopiado] = useState(false)

  if (!nota) return null

  const isNacional = Boolean(nota.padrao_nacional || nota.dps_payload || nota.chave_acesso)
  const isCancelada = nota.status === 'Cancelada'
  const isHomologacao =
    nota.modo_emissao?.includes('Homologação') || nota.tipo_ambiente?.includes('Homologacao')

  // Dados formatados
  const formatData = (d?: string) => {
    if (!d) return '-'
    const str = d.slice(0, 10)
    const [y, m, day] = str.split('-')
    return `${day}/${m}/${y}`
  }

  const copiarChave = () => {
    if (nota.chave_acesso) {
      navigator.clipboard.writeText(nota.chave_acesso)
      setCopiado(true)
      toast({
        title: 'Chave copiada',
        description: 'Chave de acesso nacional copiada para a área de transferência.',
      })
      setTimeout(() => setCopiado(false), 2000)
    }
  }

  const handlePrint = () => {
    window.print()
  }

  const handleBaixarDpsJson = () => {
    const conteudo = nota.dps_payload
      ? JSON.stringify(nota.dps_payload, null, 2)
      : JSON.stringify(nota, null, 2)
    downloadArquivo(
      `DPS-Nacional-${nota.dps_serie || '1'}-${nota.dps_numero || nota.numero}.json`,
      conteudo,
      'application/json',
    )
  }

  const handleBaixarXml = () => {
    let xml = nota.xml_conteudo
    if (!xml && nota.dps_payload) {
      xml = gerarXmlDpsNacional(nota.dps_payload)
    }
    if (!xml) {
      xml = `<?xml version="1.0" encoding="UTF-8"?><NFSe><Numero>${nota.numero}</Numero><Valor>${nota.valor_liquido}</Valor></NFSe>`
    }
    downloadArquivo(`DANFSE-Nacional-${nota.numero}.xml`, xml, 'application/xml')
  }

  const itens =
    nota.servicos_itens && Array.isArray(nota.servicos_itens) && nota.servicos_itens.length > 0
      ? nota.servicos_itens
      : [
          {
            item: 1,
            descricao: nota.discriminacao || 'Prestação de Serviços',
            quantidade: 1,
            valor_unitario: nota.valor_servicos,
            valor_total: nota.valor_servicos,
            codigo_tributacao_nacional: nota.codigo_tributacao_nacional || '010701',
          },
        ]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto p-4 sm:p-6 print:p-0 print:border-none print:shadow-none">
        <DialogHeader className="print:hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <DialogTitle className="flex items-center gap-2 text-lg">
                <FileText className="w-5 h-5 text-primary" />
                {isNacional ? 'DANFSE - Documento Auxiliar da NFS-e Nacional' : 'DANFSE Municipal'}
              </DialogTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Padrão Nacional Unificado (Decreto Federal / ADN - SEFIN Nacional)
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {isHomologacao && (
                <Badge
                  variant="outline"
                  className="border-amber-500 text-amber-700 bg-amber-50 dark:bg-amber-950/40 text-[11px]"
                >
                  Homologação / Simulação
                </Badge>
              )}
              {isCancelada ? (
                <Badge variant="destructive" className="gap-1">
                  <XCircle className="w-3.5 h-3.5" /> Cancelada
                </Badge>
              ) : (
                <Badge variant="default" className="gap-1 bg-emerald-600 hover:bg-emerald-700">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Autorizada
                </Badge>
              )}
            </div>
          </div>
        </DialogHeader>

        {/* ÁREA DE IMPRESSÃO - LAYOUT DANFSE NACIONAL */}
        <div
          ref={printRef}
          className="bg-background border rounded-lg p-5 text-xs text-foreground space-y-4 print:border-black print:text-black print:m-0"
        >
          {/* Tarja de Homologação / Cancelada / Substituída */}
          {isHomologacao && (
            <div className="border border-dashed border-amber-500 bg-amber-500/10 p-2 text-center font-semibold text-amber-800 dark:text-amber-300 rounded uppercase tracking-wider text-[11px]">
              Sem Valor Fiscal — Ambiente de Homologação / Testes do Novo Padrão Nacional
            </div>
          )}
          {isCancelada && (
            <div className="border-2 border-red-500 bg-red-500/10 p-2.5 text-center font-bold text-red-700 dark:text-red-400 rounded uppercase tracking-widest text-sm">
              NOTA FISCAL CANCELADA - {nota.protocolo_cancelamento || 'CAN-0000'}
            </div>
          )}
          {nota.status === 'Substituída' && (
            <div className="border-2 border-amber-500 bg-amber-500/15 p-2.5 text-center font-bold text-amber-800 dark:text-amber-300 rounded uppercase tracking-widest text-sm">
              NOTA FISCAL SUBSTITUÍDA — REEMITIDA POR CORREÇÃO
            </div>
          )}

          {/* Destaque de Nota Substituída / Reemissão Corrigida */}
          {(nota.nota_substituida || nota.expand?.nota_substituida) && (
            <div className="border-2 border-amber-400 bg-amber-50 dark:bg-amber-950/30 rounded-lg p-3 space-y-1.5 text-xs text-amber-950 dark:text-amber-100">
              <div className="flex items-center gap-1.5 font-bold uppercase tracking-wide text-amber-800 dark:text-amber-300">
                <Info className="w-4 h-4 text-amber-600" />
                NFS-e de Substituição / Reemissão Corrigida
              </div>
              <p className="text-[11px] leading-relaxed">
                Esta nota substitui expressamente a{' '}
                <strong>
                  NFS-e anterior nº {nota.expand?.nota_substituida?.numero || nota.nota_substituida}
                </strong>
                {nota.expand?.nota_substituida?.chave_acesso && (
                  <span>
                    {' '}
                    (Chave:{' '}
                    <code className="font-mono text-[10px] bg-amber-100 dark:bg-amber-900/50 px-1 py-0.5 rounded">
                      {nota.expand.nota_substituida.chave_acesso}
                    </code>
                    )
                  </span>
                )}
                .
              </p>
              {nota.justificativa_correcao && (
                <div className="bg-white/80 dark:bg-amber-900/30 p-2 rounded border border-amber-200 dark:border-amber-800/50 text-[11px] mt-1">
                  <span className="font-semibold block text-amber-900 dark:text-amber-200">
                    Justificativa / Motivo da Correção:
                  </span>
                  <span className="italic">{nota.justificativa_correcao}</span>
                </div>
              )}
            </div>
          )}

          {/* CABEÇALHO OFICIAL DANFSE NACIONAL */}
          <div className="border border-foreground/20 rounded p-3 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-primary/10 rounded flex items-center justify-center font-bold text-primary text-xl border">
                BR
              </div>
              <div>
                <h3 className="font-bold text-sm tracking-wide uppercase">
                  DANFSE - Documento Auxiliar da NFS-e Nacional
                </h3>
                <p className="text-[11px] text-muted-foreground font-medium">
                  Nota Fiscal de Serviços Eletrônica Nacional
                </p>
                <p className="text-[10px] text-muted-foreground">
                  Emitida nos termos da Resolução CGSN e Convênio Nacional NFS-e
                </p>
              </div>
            </div>

            <div className="text-right border-t md:border-t-0 md:border-l pl-0 md:pl-4 pt-2 md:pt-0 border-foreground/20 space-y-1">
              <div>
                <span className="text-muted-foreground">Número da NFS-e: </span>
                <span className="font-mono font-bold text-sm">
                  {String(nota.numero).padStart(8, '0')}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">DPS: </span>
                <span className="font-semibold">
                  Série {nota.dps_serie || nota.serie || '1'} Nº {nota.dps_numero || nota.numero}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Emissão: </span>
                <span className="font-semibold">{formatData(nota.data_emissao)}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Competência: </span>
                <span className="font-semibold">
                  {formatData(nota.competencia || nota.data_emissao)}
                </span>
              </div>
            </div>
          </div>

          {/* CHAVE DE ACESSO NACIONAL */}
          <div className="border border-foreground/20 rounded p-2.5 bg-muted/20 flex flex-col md:flex-row items-center justify-between gap-2">
            <div className="space-y-0.5 overflow-hidden w-full">
              <div className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-primary" />
                Chave de Acesso da NFS-e Nacional (50 Dígitos)
              </div>
              <div className="font-mono text-xs tracking-wider break-all text-primary font-semibold select-all">
                {nota.chave_acesso || 'NÃO GERADA'}
              </div>
            </div>
            {nota.chave_acesso && (
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs gap-1.5 shrink-0 print:hidden"
                onClick={copiarChave}
              >
                <Copy className="w-3.5 h-3.5" />
                {copiado ? 'Copiado!' : 'Copiar'}
              </Button>
            )}
          </div>

          {/* PROTOCOLO E CÓDIGO DE VERIFICAÇÃO */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 border border-foreground/20 rounded p-2.5 text-[11px] bg-muted/10">
            <div>
              <span className="text-muted-foreground block text-[10px]">
                Protocolo de Autorização
              </span>
              <span className="font-mono font-semibold">
                {nota.protocolo_autorizacao || 'AUT-NAC-LOCAL'}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground block text-[10px]">Cód. Verificação</span>
              <span className="font-mono font-bold text-primary">
                {nota.codigo_verificacao || '-'}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground block text-[10px]">Local da Prestação</span>
              <span className="font-medium">
                IBGE {nota.codigo_municipio_prestacao || '3550308'}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground block text-[10px]">Natureza da Operação</span>
              <span className="font-medium">
                {nota.natureza_operacao || 'Tributação no município'}
              </span>
            </div>
          </div>

          {/* PRESTADOR E TOMADOR */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Prestador */}
            <div className="border border-foreground/20 rounded p-3 space-y-1">
              <div className="font-bold text-[11px] uppercase tracking-wide text-primary border-b pb-1 mb-1 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5" /> Prestador dos Serviços
              </div>
              <div className="font-bold">{nota.prestador_razao_social || 'Borlim Consultoria'}</div>
              <div>
                <span className="text-muted-foreground">CNPJ: </span>
                <span className="font-mono font-medium">{nota.prestador_cnpj || '-'}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Inscrição Municipal: </span>
                <span>{nota.prestador_inscricao_municipal || 'Isento / Não inf.'}</span>
              </div>
              <div className="text-[10px] text-muted-foreground pt-1">
                Regime: Simples Nacional (Microempresa / EPP)
              </div>
            </div>

            {/* Tomador */}
            <div className="border border-foreground/20 rounded p-3 space-y-1">
              <div className="font-bold text-[11px] uppercase tracking-wide text-primary border-b pb-1 mb-1 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5" /> Tomador dos Serviços
              </div>
              <div className="font-bold">{nota.tomador_razao_social || 'Cliente'}</div>
              <div>
                <span className="text-muted-foreground">CPF/CNPJ: </span>
                <span className="font-mono font-medium">{nota.tomador_cnpj || '-'}</span>
              </div>
              <div>
                <span className="text-muted-foreground">E-mail: </span>
                <span>{nota.tomador_email || 'Não informado'}</span>
              </div>
              {nota.expand?.tomador_ref && (
                <div className="text-[10px] text-muted-foreground pt-1">
                  Endereço: {nota.expand.tomador_ref.logradouro}, {nota.expand.tomador_ref.numero} -{' '}
                  {nota.expand.tomador_ref.cidade}/{nota.expand.tomador_ref.estado}
                </div>
              )}
            </div>
          </div>

          {/* ITENS DE SERVIÇOS DETALHADOS */}
          <div className="border border-foreground/20 rounded p-3 space-y-2">
            <div className="font-bold text-[11px] uppercase tracking-wide text-primary border-b pb-1 flex items-center justify-between">
              <span>Itens de Serviços Prestados (DPS Nacional)</span>
              <span className="text-[10px] font-normal text-muted-foreground">
                Cód. Tributação: {nota.codigo_tributacao_nacional || '010701'}
              </span>
            </div>

            <table className="w-full text-left text-[11px]">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="py-1 px-1 w-10">Item</th>
                  <th className="py-1 px-2">Descrição dos Serviços</th>
                  <th className="py-1 px-2 w-16 text-center">Qtd</th>
                  <th className="py-1 px-2 w-24 text-right">Unitário</th>
                  <th className="py-1 px-2 w-24 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-foreground/10">
                {itens.map((it: any, idx: number) => (
                  <tr key={idx} className="hover:bg-muted/10">
                    <td className="py-1.5 px-1 font-mono text-muted-foreground">
                      {it.item || idx + 1}
                    </td>
                    <td className="py-1.5 px-2 whitespace-pre-wrap">{it.descricao}</td>
                    <td className="py-1.5 px-2 text-center font-mono">{it.quantidade || 1}</td>
                    <td className="py-1.5 px-2 text-right font-mono">
                      {formatBrlMoeda(Number(it.valor_unitario || it.valor_total || 0))}
                    </td>
                    <td className="py-1.5 px-2 text-right font-mono font-semibold">
                      {formatBrlMoeda(Number(it.valor_total || 0))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* RETENÇÕES E TRIBUTOS FEDERAIS */}
          <div className="border border-foreground/20 rounded p-3 space-y-2 bg-muted/10">
            <div className="font-bold text-[11px] uppercase tracking-wide text-foreground border-b pb-1">
              Tributos Federais e Retenções (R$)
            </div>
            <div className="grid grid-cols-2 md:grid-cols-6 gap-2 text-center text-[11px]">
              <div className="border rounded p-1.5 bg-background">
                <span className="text-[10px] text-muted-foreground block">PIS</span>
                <span className="font-mono font-medium">{formatBrlMoeda(nota.valor_pis || 0)}</span>
              </div>
              <div className="border rounded p-1.5 bg-background">
                <span className="text-[10px] text-muted-foreground block">COFINS</span>
                <span className="font-mono font-medium">
                  {formatBrlMoeda(nota.valor_cofins || 0)}
                </span>
              </div>
              <div className="border rounded p-1.5 bg-background">
                <span className="text-[10px] text-muted-foreground block">INSS</span>
                <span className="font-mono font-medium">
                  {formatBrlMoeda(nota.valor_inss || 0)}
                </span>
              </div>
              <div className="border rounded p-1.5 bg-background">
                <span className="text-[10px] text-muted-foreground block">IR</span>
                <span className="font-mono font-medium">{formatBrlMoeda(nota.valor_ir || 0)}</span>
              </div>
              <div className="border rounded p-1.5 bg-background">
                <span className="text-[10px] text-muted-foreground block">CSLL</span>
                <span className="font-mono font-medium">
                  {formatBrlMoeda(nota.valor_csll || 0)}
                </span>
              </div>
              <div className="border rounded p-1.5 bg-background">
                <span className="text-[10px] text-muted-foreground block">Outras Ret.</span>
                <span className="font-mono font-medium">
                  {formatBrlMoeda(nota.outras_retencoes || 0)}
                </span>
              </div>
            </div>
          </div>

          {/* CÁLCULO DO ISSQN E TOTAIS */}
          <div className="border border-foreground/20 rounded p-3 space-y-2">
            <div className="font-bold text-[11px] uppercase tracking-wide text-primary border-b pb-1">
              Cálculo do ISSQN e Total Líquido
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-[11px]">
              <div>
                <span className="text-muted-foreground block text-[10px]">Valor dos Serviços</span>
                <span className="font-mono font-semibold text-sm">
                  {formatBrlMoeda(nota.valor_servicos)}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[10px]">Alíquota ISS</span>
                <span className="font-mono font-semibold">{nota.aliquota_iss || 0}%</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[10px]">Valor do ISS</span>
                <span className="font-mono font-semibold">
                  {formatBrlMoeda(nota.valor_iss || 0)}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[10px]">ISS Retido?</span>
                <span className="font-semibold">{nota.iss_retido ? 'SIM (Tomador)' : 'NÃO'}</span>
              </div>
              <div className="bg-primary/10 border border-primary/20 rounded p-2 text-right">
                <span className="text-[10px] text-primary font-bold block uppercase">
                  Valor Líquido da NFS-e
                </span>
                <span className="font-mono font-bold text-base text-primary">
                  {formatBrlMoeda(nota.valor_liquido || nota.valor_servicos)}
                </span>
              </div>
            </div>
          </div>

          {/* INFORMAÇÕES ADICIONAIS / MENSAGEM DO PORTAL NACIONAL */}
          <div className="border border-foreground/20 rounded p-2.5 text-[10px] text-muted-foreground space-y-1">
            <div className="font-bold uppercase tracking-wider text-foreground">
              Outras Informações
            </div>
            <p>
              {nota.gateway_status_resposta ||
                'Declaração de Prestação de Serviços (DPS) transmitida ao Sistema Nacional de NFS-e.'}
            </p>
            {nota.motivo_cancelamento && (
              <p className="text-red-600 font-medium">
                Motivo do cancelamento: {nota.motivo_cancelamento} (em {nota.cancelada_em})
              </p>
            )}
          </div>
        </div>

        {/* RODAPÉ E AÇÕES */}
        <DialogFooter className="flex-col sm:flex-row items-center justify-between gap-2 pt-2 print:hidden">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleBaixarDpsJson}
              className="gap-1.5 text-xs"
            >
              <Download className="w-3.5 h-3.5" /> Baixar DPS (JSON)
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleBaixarXml}
              className="gap-1.5 text-xs"
            >
              <FileCode2 className="w-3.5 h-3.5" /> Baixar XML
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Fechar
            </Button>
            <Button onClick={handlePrint} className="gap-1.5 text-xs">
              <Printer className="w-3.5 h-3.5" /> Imprimir DANFSE
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
