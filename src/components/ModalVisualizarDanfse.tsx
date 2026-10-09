import React, { useRef } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Printer,
  Download,
  FileCode2,
  CheckCircle2,
  XCircle,
  FileText,
  ExternalLink,
  Layers,
} from 'lucide-react'
import { NotaFiscalRecord } from '@/types/finance'
import { downloadArquivo } from '@/lib/nfseXmlGenerator'
import { gerarXmlDpsNacional } from '@/lib/nfseNacionalDps'
import { DanfseA4Document } from '@/components/DanfseA4Document'
import { useMinhaEmpresa } from '@/contexts/MinhaEmpresaContext'

interface ModalVisualizarDanfseProps {
  nota: NotaFiscalRecord | null
  open: boolean
  onOpenChange: (open: boolean) => void
  empresaCliente?: any
  tomadorRef?: any
}

/**
 * Modal de Pré-visualização e Impressão Canônica A4 do DANFSE Nacional 2.0.
 *
 * Oferece:
 * - Renderização da folha A4 em proporção fiel com sombra, margens e padding canônico.
 * - Impressão direta via window.print() com estilos @media print aplicados via #danfse-nacional-a4-document.
 * - Download do XML DPS Nacional (ou fallback estruturado).
 * - Download do payload DPS JSON.
 * - Consulta direta ao Portal Nacional da NFS-e.
 * - Tarjas visuais para Homologação, Cancelada ou Substituída.
 */
export function ModalVisualizarDanfse({
  nota,
  open,
  onOpenChange,
  empresaCliente,
  tomadorRef,
}: ModalVisualizarDanfseProps) {
  const { minhaEmpresa } = useMinhaEmpresa()
  const printContainerRef = useRef<HTMLDivElement>(null)

  if (!nota) return null

  const isHomologacao =
    nota.tipo_ambiente?.includes('2') ||
    nota.tipo_ambiente?.toLowerCase().includes('homolog') ||
    nota.modo_emissao?.toLowerCase().includes('homolog') ||
    nota.modo_emissao?.toLowerCase().includes('simula') ||
    !nota.tipo_ambiente

  const isCancelada = nota.status === 'Cancelada'
  const isSubstituida = nota.status === 'Substituída'

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

  const chaveLimpa = (nota.chave_acesso || '').replace(/\D/g, '')
  const urlConsultaPortal = chaveLimpa
    ? `https://www.nfse.gov.br/consultapublica?chave=${chaveLimpa}`
    : 'https://www.nfse.gov.br/consultapublica'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl w-[95vw] max-h-[95vh] overflow-y-auto p-3 sm:p-5 print:p-0 print:m-0 print:border-none print:shadow-none print:max-w-none print:w-full">
        <DialogHeader className="print:hidden pb-2 border-b">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
                <FileText className="w-5 h-5 text-indigo-700" />
                <span>DANFSE — Documento Auxiliar da NFS-e Nacional 2.0</span>
              </DialogTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Visualização A4 canônica com QR Code vetorial e dados fiscais da Declaração de
                Prestação de Serviços (DPS 2.0 / ADN)
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge className="bg-indigo-700 text-white font-bold text-[11px]">
                DPS 2.0 Nacional
              </Badge>
              {isHomologacao && (
                <Badge
                  variant="outline"
                  className="border-amber-500 text-amber-700 bg-amber-50 dark:bg-amber-950/40 text-[11px] font-semibold"
                >
                  Homologação / Testes
                </Badge>
              )}
              {isCancelada ? (
                <Badge variant="destructive" className="gap-1 font-semibold">
                  <XCircle className="w-3.5 h-3.5" /> Cancelada
                </Badge>
              ) : isSubstituida ? (
                <Badge className="bg-amber-600 text-white gap-1 font-semibold">
                  <Layers className="w-3.5 h-3.5" /> Substituída
                </Badge>
              ) : (
                <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1 font-semibold">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Autorizada
                </Badge>
              )}
            </div>
          </div>
        </DialogHeader>

        {/* CONTAINER DE PRÉ-VISUALIZAÇÃO A4 */}
        <div
          ref={printContainerRef}
          className="my-3 py-4 px-2 sm:px-6 bg-slate-100/90 dark:bg-slate-900/60 rounded-xl overflow-x-auto flex justify-center print:bg-white print:p-0 print:m-0 print:rounded-none"
        >
          <div className="shadow-2xl border border-slate-300 rounded-sm bg-white print:shadow-none print:border-none w-full max-w-[210mm]">
            <DanfseA4Document
              nota={nota}
              minhaEmpresa={minhaEmpresa}
              empresaCliente={empresaCliente}
              tomadorRef={tomadorRef}
              id="danfse-nacional-a4-document"
            />
          </div>
        </div>

        {/* RODAPÉ E AÇÕES DO USUÁRIO */}
        <DialogFooter className="flex-col sm:flex-row items-center justify-between gap-2 pt-2 border-t print:hidden">
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={handleBaixarDpsJson}
              className="gap-1.5 text-xs h-8"
              title="Baixar Declaração de Prestação de Serviços em formato JSON"
            >
              <Download className="w-3.5 h-3.5" /> Baixar DPS (JSON)
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleBaixarXml}
              className="gap-1.5 text-xs h-8"
              title="Baixar XML Nacional da NFS-e"
            >
              <FileCode2 className="w-3.5 h-3.5" /> Baixar XML
            </Button>
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="gap-1 text-xs h-8 text-indigo-700 hover:text-indigo-900"
            >
              <a href={urlConsultaPortal} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="w-3.5 h-3.5" /> Portal Nacional
              </a>
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} className="h-8">
              Fechar
            </Button>
            <Button
              onClick={handlePrint}
              className="gap-1.5 text-xs h-8 bg-indigo-700 hover:bg-indigo-800 text-white shadow-sm font-semibold"
            >
              <Printer className="w-3.5 h-3.5" /> Imprimir / Salvar PDF
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default ModalVisualizarDanfse
