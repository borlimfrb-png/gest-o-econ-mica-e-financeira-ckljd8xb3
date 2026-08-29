import React from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Printer,
  Download,
  Mail,
  FileText,
  CheckCircle2,
  Building,
  ShieldCheck,
} from 'lucide-react'
import type { NotaFiscalRecord } from '@/types/finance'
import { formatCnpj } from '@/lib/financeCalculations'
import { gerarXmlNfse, downloadArquivo, formatBrlMoeda, DadosDanfse } from '@/lib/nfseXmlGenerator'

interface ModalVisualizarDanfseProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  dados: DadosDanfse | null
  onEnviarEmail?: (nota: NotaFiscalRecord) => void
}

export function ModalVisualizarDanfse({
  open,
  onOpenChange,
  dados,
  onEnviarEmail,
}: ModalVisualizarDanfseProps) {
  if (!dados || !dados.nota) return null

  const { nota, prestador, tomador } = dados

  const handlePrint = () => {
    window.print()
  }

  const handleDownloadXml = () => {
    const xml = gerarXmlNfse(dados)
    downloadArquivo(
      xml,
      `NFSe_${nota.numero}_${prestador.cnpj.replace(/\D/g, '')}.xml`,
      'application/xml',
    )
  }

  const dataEmissaoFormatada = nota.data_emissao
    ? new Date(nota.data_emissao).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '-'

  const competenciaFormatada = nota.competencia
    ? new Date(nota.competencia).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })
    : nota.data_emissao
      ? new Date(nota.data_emissao).toLocaleDateString('pt-BR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        })
      : '-'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto p-0 bg-slate-100 print:bg-white print:max-w-none print:max-h-none print:overflow-visible print:border-none print:p-0">
        {/* Barra superior de ações */}
        <div className="sticky top-0 z-20 bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between gap-3 shadow-xs print:hidden">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-600" />
            <div>
              <DialogTitle className="text-sm font-bold text-slate-900 leading-tight">
                DANFSE — Documento Auxiliar da Nota Fiscal de Serviços Eletrônica
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                NFS-e Nº {nota.numero} · Série {nota.serie || '1'} · Status: {nota.status}
              </DialogDescription>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handleDownloadXml}
              className="text-xs h-8 border-slate-300"
            >
              <Download className="w-3.5 h-3.5 mr-1 text-slate-600" /> Baixar XML
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handlePrint}
              className="text-xs h-8 border-slate-300 bg-white hover:bg-slate-50"
            >
              <Printer className="w-3.5 h-3.5 mr-1 text-blue-600" /> Imprimir / PDF
            </Button>
            {onEnviarEmail && (
              <Button
                size="sm"
                onClick={() => onEnviarEmail(nota)}
                className="text-xs h-8 bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-xs"
              >
                <Mail className="w-3.5 h-3.5 mr-1" /> Enviar por E-mail
              </Button>
            )}
          </div>
        </div>

        {/* Layout DANFSE Padrão Nacional A4 */}
        <div className="p-4 sm:p-6 flex justify-center print:p-0">
          <div
            id="danfse-document"
            className="w-full max-w-[800px] bg-white border border-slate-300 shadow-sm p-6 text-slate-900 text-xs font-sans leading-tight space-y-3 print:border-none print:shadow-none print:p-0 print:max-w-none"
          >
            {/* 1. Cabeçalho Oficial */}
            <div className="border border-slate-900 rounded p-3 grid grid-cols-12 gap-2 items-center">
              <div className="col-span-8 flex items-center gap-3">
                <div className="w-12 h-12 bg-slate-900 text-white rounded flex items-center justify-center font-bold text-lg shrink-0">
                  <ShieldCheck className="w-7 h-7" />
                </div>
                <div>
                  <h2 className="text-xs font-black uppercase tracking-tight text-slate-900">
                    PREFEITURA MUNICIPAL / SISTEMA NACIONAL DE NFS-E
                  </h2>
                  <h1 className="text-sm font-black tracking-tight text-slate-900 uppercase">
                    NOTA FISCAL DE SERVIÇOS ELETRÔNICA - NFS-e
                  </h1>
                  <p className="text-[10px] text-slate-600">
                    RPS nº {nota.numero} · Padrão Nacional / ABRASF · Natureza da Operação:
                    Tributação no município
                  </p>
                </div>
              </div>

              <div className="col-span-4 border-l border-slate-900 pl-3 text-right space-y-1">
                <div>
                  <span className="text-[9px] uppercase font-bold text-slate-500 block">
                    Número da Nota
                  </span>
                  <span className="text-base font-black text-slate-900">{nota.numero}</span>
                </div>
                <div>
                  <span className="text-[9px] uppercase font-bold text-slate-500 block">
                    Data e Hora de Emissão
                  </span>
                  <span className="text-[11px] font-bold text-slate-800">
                    {dataEmissaoFormatada}
                  </span>
                </div>
                <div>
                  <span className="text-[9px] uppercase font-bold text-slate-500 block">
                    Código de Verificação
                  </span>
                  <span className="text-[11px] font-mono font-bold text-blue-700">
                    {nota.codigo_verificacao || 'N/A'}
                  </span>
                </div>
              </div>
            </div>

            {/* Chave de Acesso */}
            {nota.chave_acesso && (
              <div className="border border-slate-300 bg-slate-50/70 p-2 rounded text-center">
                <span className="text-[9px] uppercase font-bold text-slate-500 block">
                  Chave de Acesso para Consulta
                </span>
                <span className="text-[11px] font-mono font-semibold tracking-wider text-slate-800 break-all">
                  {nota.chave_acesso}
                </span>
              </div>
            )}

            {/* 2. Prestador de Serviços */}
            <div className="border border-slate-900 rounded">
              <div className="bg-slate-100 border-b border-slate-900 px-3 py-1 font-bold text-[10px] uppercase text-slate-800">
                PRESTADOR DE SERVIÇOS
              </div>
              <div className="p-3 space-y-1 text-[11px]">
                <div className="grid grid-cols-12 gap-2">
                  <div className="col-span-8">
                    <span className="text-slate-500 font-semibold">Razão Social:</span>{' '}
                    <strong className="text-slate-900 font-bold">{prestador.razaoSocial}</strong>
                  </div>
                  <div className="col-span-4 text-right">
                    <span className="text-slate-500 font-semibold">CNPJ:</span>{' '}
                    <strong className="text-slate-900 font-mono font-bold">
                      {formatCnpj(prestador.cnpj)}
                    </strong>
                  </div>
                </div>

                <div className="grid grid-cols-12 gap-2 text-slate-700">
                  <div className="col-span-8">
                    <span className="text-slate-500">Endereço:</span> {prestador.endereco || '—'},{' '}
                    {prestador.cidade || '—'}/{prestador.estado || '—'} - CEP:{' '}
                    {prestador.cep || '—'}
                  </div>
                  <div className="col-span-4 text-right">
                    <span className="text-slate-500">Inscr. Municipal:</span>{' '}
                    {prestador.inscricaoMunicipal || 'ISENTO'}
                  </div>
                </div>

                <div className="grid grid-cols-12 gap-2 text-slate-700 text-[10px]">
                  <div className="col-span-6">
                    <span className="text-slate-500">E-mail:</span> {prestador.email || '—'}
                  </div>
                  <div className="col-span-6 text-right">
                    <span className="text-slate-500">Regime Tributário:</span>{' '}
                    <strong className="text-slate-900">
                      {prestador.regimeTributario || 'Simples Nacional'}
                    </strong>
                  </div>
                </div>
              </div>
            </div>

            {/* 3. Tomador de Serviços */}
            <div className="border border-slate-900 rounded">
              <div className="bg-slate-100 border-b border-slate-900 px-3 py-1 font-bold text-[10px] uppercase text-slate-800">
                TOMADOR DE SERVIÇOS (CLIENTE)
              </div>
              <div className="p-3 space-y-1 text-[11px]">
                <div className="grid grid-cols-12 gap-2">
                  <div className="col-span-8">
                    <span className="text-slate-500 font-semibold">Razão Social / Nome:</span>{' '}
                    <strong className="text-slate-900 font-bold">{tomador.razaoSocial}</strong>
                  </div>
                  <div className="col-span-4 text-right">
                    <span className="text-slate-500 font-semibold">CNPJ / CPF:</span>{' '}
                    <strong className="text-slate-900 font-mono font-bold">
                      {formatCnpj(tomador.cnpj)}
                    </strong>
                  </div>
                </div>

                <div className="grid grid-cols-12 gap-2 text-slate-700">
                  <div className="col-span-8">
                    <span className="text-slate-500">Endereço:</span> {tomador.endereco || '—'},{' '}
                    {tomador.cidade || '—'}/{tomador.estado || '—'} - CEP: {tomador.cep || '—'}
                  </div>
                  <div className="col-span-4 text-right">
                    <span className="text-slate-500">Telefone:</span> {tomador.telefone || '—'}
                  </div>
                </div>

                <div className="grid grid-cols-12 gap-2 text-slate-700 text-[10px]">
                  <div className="col-span-12">
                    <span className="text-slate-500">E-mail para envio da NFS-e:</span>{' '}
                    <strong className="text-blue-700 font-semibold">{tomador.email || '—'}</strong>
                  </div>
                </div>
              </div>
            </div>

            {/* 4. Discriminação dos Serviços */}
            <div className="border border-slate-900 rounded">
              <div className="bg-slate-100 border-b border-slate-900 px-3 py-1 font-bold text-[10px] uppercase text-slate-800 flex justify-between">
                <span>DISCRIMINAÇÃO DOS SERVIÇOS PRESTADOS</span>
                <span>Competência: {competenciaFormatada}</span>
              </div>
              <div className="p-3 min-h-[110px] whitespace-pre-line text-[11px] text-slate-800 leading-relaxed font-mono bg-white">
                {nota.discriminacao}
              </div>
              <div className="border-t border-slate-200 bg-slate-50 px-3 py-1.5 text-[10px] text-slate-600 flex flex-wrap justify-between gap-2">
                <span>
                  <strong>Item CNAE / Lista de Serviço:</strong>{' '}
                  {nota.item_cnae ||
                    '6920-6/01 - Atividades de contabilidade, consultoria e auditoria'}
                </span>
                <span>
                  <strong>Cód. Tributação Município:</strong>{' '}
                  {nota.codigo_servico_municipal || '0107'}
                </span>
              </div>
            </div>

            {/* 5. Retenções Federais e Outras Deduções */}
            <div className="border border-slate-900 rounded overflow-hidden">
              <div className="bg-slate-100 border-b border-slate-900 px-3 py-1 font-bold text-[10px] uppercase text-slate-800">
                RETENÇÕES FEDERAIS E DEDUÇÕES (R$)
              </div>
              <div className="grid grid-cols-6 divide-x divide-slate-200 text-center text-[10px] p-2 bg-white">
                <div>
                  <span className="text-slate-500 block">PIS</span>
                  <span className="font-semibold text-slate-800">
                    {formatBrlMoeda(nota.valor_pis)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">COFINS</span>
                  <span className="font-semibold text-slate-800">
                    {formatBrlMoeda(nota.valor_cofins)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">INSS</span>
                  <span className="font-semibold text-slate-800">
                    {formatBrlMoeda(nota.valor_inss)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">IRRF</span>
                  <span className="font-semibold text-slate-800">
                    {formatBrlMoeda(nota.valor_ir)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">CSLL</span>
                  <span className="font-semibold text-slate-800">
                    {formatBrlMoeda(nota.valor_csll)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Outras Retenções</span>
                  <span className="font-semibold text-slate-800">
                    {formatBrlMoeda(nota.outras_retencoes)}
                  </span>
                </div>
              </div>
            </div>

            {/* 6. Cálculo do ISSQN e Valor Total */}
            <div className="border border-slate-900 rounded overflow-hidden">
              <div className="bg-slate-100 border-b border-slate-900 px-3 py-1 font-bold text-[10px] uppercase text-slate-800">
                CÁLCULO DO ISSQN E VALOR LÍQUIDO DA NOTA FISCAL
              </div>
              <div className="grid grid-cols-5 divide-x divide-slate-200 text-center text-[10px] p-2.5 bg-white items-center">
                <div>
                  <span className="text-slate-500 block text-[9px] uppercase font-bold">
                    Valor dos Serviços
                  </span>
                  <span className="font-bold text-sm text-slate-900">
                    {formatBrlMoeda(nota.valor_servicos)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[9px] uppercase font-bold">
                    Base de Cálculo
                  </span>
                  <span className="font-semibold text-xs text-slate-800">
                    {formatBrlMoeda(nota.valor_servicos)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[9px] uppercase font-bold">
                    Alíquota ISS
                  </span>
                  <span className="font-semibold text-xs text-slate-800">
                    {(nota.aliquota_iss || 5.0).toFixed(2)}%
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[9px] uppercase font-bold">
                    Valor do ISS
                  </span>
                  <span className="font-semibold text-xs text-slate-800">
                    {formatBrlMoeda(nota.valor_iss)}
                  </span>
                </div>
                <div className="bg-emerald-50/80 p-1 rounded">
                  <span className="text-emerald-800 block text-[9px] uppercase font-black">
                    VALOR LÍQUIDO
                  </span>
                  <span className="font-black text-base text-emerald-700">
                    {formatBrlMoeda(nota.valor_liquido)}
                  </span>
                </div>
              </div>
            </div>

            {/* 7. Informações Complementares e Rodapé */}
            <div className="border border-slate-300 rounded p-2.5 bg-slate-50/60 text-[9px] text-slate-600 space-y-1">
              <p className="font-bold text-slate-800 uppercase">Outras Informações:</p>
              <p>
                • {nota.modo_emissao || 'Homologação / Simulação'} · Protocolo:{' '}
                {nota.protocolo_autorizacao || 'AUT-SIM-001'}
              </p>
              <p>
                •{' '}
                {nota.gateway_status_resposta ||
                  'Emitida eletronicamente conforme legislação tributária municipal vigente.'}
              </p>
              {nota.vencimento && (
                <p className="font-semibold text-slate-800">
                  • Vencimento do pagamento: {new Date(nota.vencimento).toLocaleDateString('pt-BR')}
                </p>
              )}
            </div>

            <div className="text-center pt-2 text-[8px] text-slate-400 uppercase tracking-widest border-t border-dashed border-slate-300">
              Documento emitido por ME ou EPP optante pelo Simples Nacional · Não gera direito a
              crédito fiscal de IPI
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
