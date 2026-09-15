import React, { useState } from 'react'
import { useMinhaEmpresa } from '@/contexts/MinhaEmpresaContext'
import { useFilter } from '@/contexts/FilterContext'

export interface DocumentPrintFooterProps {
  /**
   * Título descritivo do documento / laudo impresso.
   * Se omitido, tenta deduzir ou usa "Relatório de Gestão Econômica".
   */
  documentTitle?: string

  /**
   * Nome da empresa cliente analisada.
   * Se omitido, usa a empresa selecionada no contexto global de filtros.
   */
  empresaNome?: string

  /**
   * Exercício ou ano de referência (ex.: 2024).
   * Se omitido, usa o ano selecionado no contexto global de filtros.
   */
  exercicioAno?: number | string

  /**
   * Classes adicionais para customização opcional.
   */
  className?: string
}

/**
 * Componente de rodapé padronizado para laudos e relatórios impressos em A4.
 *
 * Características:
 * - Oculto em tela (hidden) e visível apenas durante a impressão (print:flex).
 * - Exibe à esquerda: Nome da Consultoria • Empresa Analisada (Exercício) • Título do Laudo.
 * - Exibe à direita: Data e hora de emissão fixadas na montagem (pt-BR) + numeração de página.
 * - Integração perfeita com @page @bottom-right counter(page) e fallback visual.
 */
export const DocumentPrintFooter: React.FC<DocumentPrintFooterProps> = ({
  documentTitle,
  empresaNome,
  exercicioAno,
  className = '',
}) => {
  const { minhaEmpresa } = useMinhaEmpresa()
  const { selectedEmpresa, selectedAno } = useFilter()

  // Fixa data e hora exatas no momento de montagem para manter coerência no print
  const [timestampEmissao] = useState(() => {
    const agora = new Date()
    const dataStr = agora.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
    const horaStr = agora.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    })
    return `Emitido em ${dataStr} às ${horaStr}`
  })

  // Nome da consultoria emissora
  const consultoriaNome =
    minhaEmpresa?.razao_social?.trim() ||
    minhaEmpresa?.nome_fantasia?.trim() ||
    'Borlim Consultoria Financeira'

  // Nome da empresa cliente
  const clienteNome = empresaNome || selectedEmpresa?.nome || 'Empresa Ativa'

  // Exercício / ano de referência
  const anoReferencia = exercicioAno ?? selectedAno

  // Título do documento
  const titulo = documentTitle || 'Laudo de Gestão Econômica & Financeira'

  return (
    <footer
      role="contentinfo"
      aria-label="Rodapé de Impressão do Documento"
      className={`document-print-footer hidden print:flex ${className}`}
    >
      {/* Lado Esquerdo: Consultoria • Empresa (Exercício) • Título do Documento */}
      <div className="flex items-center gap-1.5 text-slate-600 truncate max-w-[68%]">
        <span className="font-bold text-slate-800 shrink-0">{consultoriaNome}</span>
        <span className="text-slate-400 shrink-0">•</span>
        <span className="font-semibold text-slate-700 truncate">{clienteNome}</span>
        {anoReferencia && <span className="text-slate-500 shrink-0">({anoReferencia})</span>}
        <span className="text-slate-400 shrink-0">•</span>
        <span className="truncate text-slate-600 font-medium" title={titulo}>
          {titulo}
        </span>
      </div>

      {/* Lado Direito: Carimbo de Data/Hora de Emissão e Numeração */}
      <div className="flex items-center gap-2 text-right shrink-0 text-slate-500 font-medium text-[7.5pt]">
        <span className="whitespace-nowrap">{timestampEmissao}</span>
        <span className="text-slate-400">•</span>
        <span className="print-page-number whitespace-nowrap text-slate-700 font-semibold">
          Documento A4
        </span>
      </div>
    </footer>
  )
}

export default DocumentPrintFooter
