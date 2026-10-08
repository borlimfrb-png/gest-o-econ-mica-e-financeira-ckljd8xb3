import React, { useMemo } from 'react'
import {
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Scale,
  Activity,
  Layers,
  Flame,
  Clock,
  Sparkles,
  ChevronRight,
  HelpCircle,
  FileText,
  BarChart3,
  Percent,
} from 'lucide-react'

export interface RelatorioIARendererProps {
  content: string
  className?: string
  isStreaming?: boolean
  empresaNome?: string
  periodo?: string | number
  dataGeracao?: string | Date
  mostrarCabecalhoExecutivo?: boolean
  modoImpressao?: boolean
}

type SectionType =
  | 'diagnostico'
  | 'benchmarks'
  | 'pontos_fortes'
  | 'pontos_atencao'
  | 'plano_acao'
  | 'liquidez'
  | 'fleuriet'
  | 'endividamento'
  | 'rentabilidade'
  | 'kanitz'
  | 'geral'

interface SectionMeta {
  type: SectionType
  title: string
  icon: React.ComponentType<{ className?: string }>
  colorBorder: string
  colorBg: string
  colorBadge: string
  colorText: string
}

function getSectionMeta(title: string): SectionMeta {
  const norm = title
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()

  if (
    norm.includes('PONTO FORTE') ||
    norm.includes('PONTOS FORTES') ||
    norm.includes('VANTAGENS COMPETITIVAS') ||
    norm.includes('DESTAQUES POSITIVOS') ||
    norm.includes('FORTALEZAS')
  ) {
    return {
      type: 'pontos_fortes',
      title,
      icon: CheckCircle2,
      colorBorder: 'border-emerald-300 dark:border-emerald-800',
      colorBg: 'bg-emerald-50/60 dark:bg-emerald-950/20',
      colorBadge: 'bg-emerald-100 text-emerald-800 border-emerald-200',
      colorText: 'text-emerald-900 dark:text-emerald-300',
    }
  }

  if (
    norm.includes('ATENCAO') ||
    norm.includes('RISCO') ||
    norm.includes('FRAQUEZA') ||
    norm.includes('VULNERABILIDADE') ||
    norm.includes('PONTOS FRACOS') ||
    norm.includes('GARGALO') ||
    norm.includes('ALERTA')
  ) {
    return {
      type: 'pontos_atencao',
      title,
      icon: AlertTriangle,
      colorBorder: 'border-amber-300 dark:border-amber-800',
      colorBg: 'bg-amber-50/60 dark:bg-amber-950/20',
      colorBadge: 'bg-amber-100 text-amber-900 border-amber-200',
      colorText: 'text-amber-950 dark:text-amber-300',
    }
  }

  if (
    norm.includes('PLANO DE ACAO') ||
    norm.includes('RECOMENDACOES') ||
    norm.includes('PLANO DE MELHORIA') ||
    norm.includes('ACOES PRIORITARIAS') ||
    norm.includes('CRONOGRAMA')
  ) {
    return {
      type: 'plano_acao',
      title,
      icon: Clock,
      colorBorder: 'border-blue-300 dark:border-blue-800',
      colorBg: 'bg-blue-50/50 dark:bg-blue-950/20',
      colorBadge: 'bg-blue-100 text-blue-800 border-blue-200',
      colorText: 'text-blue-950 dark:text-blue-300',
    }
  }

  if (
    norm.includes('BENCHMARK') ||
    norm.includes('SETORIAL') ||
    norm.includes('MERCADO') ||
    norm.includes('COMPARATIVO SETORIAL')
  ) {
    return {
      type: 'benchmarks',
      title,
      icon: BarChart3,
      colorBorder: 'border-indigo-300 dark:border-indigo-800',
      colorBg: 'bg-indigo-50/50 dark:bg-indigo-950/20',
      colorBadge: 'bg-indigo-100 text-indigo-800 border-indigo-200',
      colorText: 'text-indigo-950 dark:text-indigo-300',
    }
  }

  if (norm.includes('KANITZ') || norm.includes('INSOLVENCIA') || norm.includes('TERMOMETRO')) {
    return {
      type: 'kanitz',
      title,
      icon: Flame,
      colorBorder: 'border-purple-300 dark:border-purple-800',
      colorBg: 'bg-purple-50/50 dark:bg-purple-950/20',
      colorBadge: 'bg-purple-100 text-purple-800 border-purple-200',
      colorText: 'text-purple-950 dark:text-purple-300',
    }
  }

  if (
    norm.includes('FLEURIET') ||
    norm.includes('CAPITAL DE GIRO') ||
    norm.includes('TESOURARIA') ||
    norm.includes('EFEITO TESOURA')
  ) {
    return {
      type: 'fleuriet',
      title,
      icon: Layers,
      colorBorder: 'border-cyan-300 dark:border-cyan-800',
      colorBg: 'bg-cyan-50/50 dark:bg-cyan-950/20',
      colorBadge: 'bg-cyan-100 text-cyan-800 border-cyan-200',
      colorText: 'text-cyan-950 dark:text-cyan-300',
    }
  }

  if (
    norm.includes('LIQUIDEZ') ||
    norm.includes('SOLVENCIA') ||
    norm.includes('CAPACIDADE DE PAGAMENTO')
  ) {
    return {
      type: 'liquidez',
      title,
      icon: Scale,
      colorBorder: 'border-sky-300 dark:border-sky-800',
      colorBg: 'bg-sky-50/50 dark:bg-sky-950/20',
      colorBadge: 'bg-sky-100 text-sky-800 border-sky-200',
      colorText: 'text-sky-950 dark:text-sky-300',
    }
  }

  if (
    norm.includes('RENTABILIDADE') ||
    norm.includes('MARGEM') ||
    norm.includes('EBITDA') ||
    norm.includes('LUCRO')
  ) {
    return {
      type: 'rentabilidade',
      title,
      icon: TrendingUp,
      colorBorder: 'border-teal-300 dark:border-teal-800',
      colorBg: 'bg-teal-50/50 dark:bg-teal-950/20',
      colorBadge: 'bg-teal-100 text-teal-800 border-teal-200',
      colorText: 'text-teal-950 dark:text-teal-300',
    }
  }

  if (
    norm.includes('ENDIVIDAMENTO') ||
    norm.includes('ESTRUTURA DE CAPITAL') ||
    norm.includes('ALAVANCAGEM')
  ) {
    return {
      type: 'endividamento',
      title,
      icon: Activity,
      colorBorder: 'border-amber-300 dark:border-amber-800',
      colorBg: 'bg-amber-50/40 dark:bg-amber-950/20',
      colorBadge: 'bg-amber-100 text-amber-900 border-amber-200',
      colorText: 'text-amber-950 dark:text-amber-300',
    }
  }

  if (
    norm.includes('DIAGNOSTICO') ||
    norm.includes('SITUACAO GERAL') ||
    norm.includes('PARECER') ||
    norm.includes('RESUMO EXECUTIVO')
  ) {
    return {
      type: 'diagnostico',
      title,
      icon: Activity,
      colorBorder: 'border-[#0B1F3A]/20 dark:border-slate-700',
      colorBg: 'bg-slate-50/80 dark:bg-slate-900/40',
      colorBadge: 'bg-[#0B1F3A] text-white border-transparent',
      colorText: 'text-[#0B1F3A] dark:text-slate-100',
    }
  }

  return {
    type: 'geral',
    title,
    icon: FileText,
    colorBorder: 'border-slate-200 dark:border-slate-800',
    colorBg: 'bg-slate-50/60 dark:bg-slate-900/30',
    colorBadge: 'bg-slate-100 text-slate-800 border-slate-200',
    colorText: 'text-[#0B1F3A] dark:text-slate-200',
  }
}

// Reconhecimento de formatação em linha (negrito, itálico, métricas e moedas)
export function renderFormattedInline(text: string): React.ReactNode {
  // Regex combinada para identificar tokens:
  // 1. **negrito**
  // 2. *itálico*
  // 3. Status badges: 🟢, 🟡, 🔴, ⚠️, 🌟, 💡, ✅, ❌
  // 4. Valores monetários (R$ 1.234,56 ou R$ -123,00)
  // 5. Percentuais (12,5% ou -3,4%)
  // 6. Múltiplos numéricos (1,45x ou 2.3x)
  const regex =
    /(\*\*.*?\*\*|\*.*?\*|R\$\s?-?\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?|-?\d+(?:,\d+)?%|-?\d+(?:,\d+)?x|[🟢🟡🔴⚠️🌟💡✅❌])/g

  const parts: React.ReactNode[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index))
    }

    const token = match[0]

    if (token.startsWith('**') && token.endsWith('**') && token.length >= 4) {
      const inner = token.slice(2, -2)
      parts.push(
        <strong key={match.index} className="font-semibold text-slate-900 dark:text-white">
          {renderFormattedInline(inner)}
        </strong>,
      )
    } else if (token.startsWith('*') && token.endsWith('*') && token.length >= 2) {
      const inner = token.slice(1, -1)
      parts.push(
        <em key={match.index} className="italic text-slate-700 dark:text-slate-300">
          {inner}
        </em>,
      )
    } else if (token.startsWith('R$')) {
      parts.push(
        <span
          key={match.index}
          className="font-mono font-bold text-slate-900 dark:text-slate-100 bg-slate-100/90 dark:bg-slate-800/80 px-1 py-0.5 rounded text-[0.93em] border border-slate-200/80 dark:border-slate-700 inline-block align-baseline whitespace-nowrap"
        >
          {token}
        </span>,
      )
    } else if (token.endsWith('%')) {
      const isNegative = token.startsWith('-')
      parts.push(
        <span
          key={match.index}
          className={`font-mono font-bold px-1 py-0.5 rounded text-[0.93em] inline-block align-baseline whitespace-nowrap border ${
            isNegative
              ? 'bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800'
              : 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
          }`}
        >
          {token}
        </span>,
      )
    } else if (token.endsWith('x')) {
      parts.push(
        <span
          key={match.index}
          className="font-mono font-bold text-blue-900 dark:text-blue-300 bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 px-1 py-0.5 rounded text-[0.93em] inline-block align-baseline whitespace-nowrap"
        >
          {token}
        </span>,
      )
    } else if (['🟢', '🟡', '🔴', '⚠️', '🌟', '💡', '✅', '❌'].includes(token)) {
      parts.push(
        <span key={match.index} className="inline-block mx-0.5 text-base align-middle">
          {token}
        </span>,
      )
    } else {
      parts.push(token)
    }

    lastIndex = regex.lastIndex
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex))
  }

  return parts.length === 1 ? parts[0] : <>{parts}</>
}

// Renderizador de tabela Markdown / Pipe
function TableBlock({ lines }: { lines: string[] }) {
  if (lines.length < 2) return null

  // Processa as linhas removendo espaços e separando por pipe (|)
  const rows = lines
    .map((line) => {
      const trimmed = line.trim()
      const content = trimmed.replace(/^\|/, '').replace(/\|$/, '')
      return content.split('|').map((c) => c.trim())
    })
    .filter((cols) => cols.some((c) => c.length > 0))

  if (rows.length === 0) return null

  const header = rows[0]
  // Verifica se a segunda linha é a divisória do markdown (---)
  const isSeparator = rows.length > 1 && rows[1].every((c) => /^[:-]+$/.test(c.replace(/\s+/g, '')))
  const bodyRows = isSeparator ? rows.slice(2) : rows.slice(1)

  return (
    <div className="my-3 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs bg-white dark:bg-slate-900 print:border-slate-300 print:shadow-none print:break-inside-avoid">
      <div className="overflow-x-auto scrollbar-thin">
        <table className="w-full text-left border-collapse text-xs sm:text-sm">
          <thead>
            <tr className="bg-[#0B1F3A] text-white uppercase text-[11px] tracking-wider font-semibold">
              {header.map((col, idx) => (
                <th
                  key={idx}
                  className="py-2.5 px-3 border-r border-slate-700/60 last:border-r-0 whitespace-nowrap print:bg-slate-800 print:text-white"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300 font-sans">
            {bodyRows.map((cols, rIdx) => {
              const isEven = rIdx % 2 === 0
              return (
                <tr
                  key={rIdx}
                  className={`transition-colors hover:bg-blue-50/50 dark:hover:bg-slate-800/60 ${
                    isEven
                      ? 'bg-white dark:bg-slate-900'
                      : 'bg-slate-50/70 dark:bg-slate-900/60 print:bg-slate-50'
                  }`}
                >
                  {cols.map((cell, cIdx) => {
                    const isStatusCol =
                      cell.includes('🟢') ||
                      cell.includes('🟡') ||
                      cell.includes('🔴') ||
                      cell.toLowerCase().includes('favorável') ||
                      cell.toLowerCase().includes('desfavorável') ||
                      cell.toLowerCase().includes('alinhado')

                    let statusBadgeStyle = ''
                    if (cell.includes('🟢') || cell.toLowerCase().includes('favorável')) {
                      statusBadgeStyle =
                        'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300'
                    } else if (
                      cell.includes('🔴') ||
                      cell.toLowerCase().includes('desfavorável') ||
                      cell.toLowerCase().includes('abaixo')
                    ) {
                      statusBadgeStyle =
                        'bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300'
                    } else if (cell.includes('🟡') || cell.toLowerCase().includes('alinhado')) {
                      statusBadgeStyle =
                        'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300'
                    }

                    return (
                      <td
                        key={cIdx}
                        className={`py-2 px-3 border-r border-slate-100 dark:border-slate-800 last:border-r-0 ${
                          cIdx === 0 ? 'font-semibold text-slate-900 dark:text-slate-100' : ''
                        }`}
                      >
                        {isStatusCol && statusBadgeStyle ? (
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${statusBadgeStyle}`}
                          >
                            {renderFormattedInline(cell)}
                          </span>
                        ) : (
                          renderFormattedInline(cell)
                        )}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// Bloco de Card de Destaque Especial (Pontos Fortes, Pontos de Atenção, etc.)
function SpecializedCardBlock({
  type,
  title,
  children,
}: {
  type: SectionType
  title: string
  children: React.ReactNode
}) {
  const meta = getSectionMeta(title)
  const Icon = meta.icon

  return (
    <div
      className={`my-3.5 rounded-xl border p-4 shadow-2xs transition-all print:break-inside-avoid ${meta.colorBorder} ${meta.colorBg}`}
    >
      <div className="flex items-center gap-2 mb-2.5 pb-2 border-b border-black/5 dark:border-white/10">
        <div
          className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 border ${meta.colorBadge}`}
        >
          <Icon className="w-3.5 h-3.5" />
        </div>
        <h3 className={`text-xs sm:text-sm font-bold uppercase tracking-wide ${meta.colorText}`}>
          {title}
        </h3>
      </div>
      <div className="text-xs sm:text-sm leading-relaxed space-y-2 text-slate-800 dark:text-slate-200">
        {children}
      </div>
    </div>
  )
}

// Bloco do Plano de Ação 30/60/90 Dias com visual de Timeline / Checklist
function PlanoAcaoTimelineBlock({ lines }: { lines: string[] }) {
  // Separa as linhas em blocos: Imediato (0-30), Médio (30-90), Estratégico (90+)
  const buckets: {
    fase: string
    prazo: string
    cor: string
    border: string
    badge: string
    itens: string[]
  }[] = [
    {
      fase: 'Imediato (0 a 30 dias)',
      prazo: 'Curto Prazo',
      cor: 'bg-rose-50 text-rose-900 border-rose-200 dark:bg-rose-950/30 dark:text-rose-200',
      border: 'border-l-4 border-l-rose-500',
      badge: 'bg-rose-500 text-white',
      itens: [],
    },
    {
      fase: 'Médio Prazo (30 a 90 dias)',
      prazo: 'Consolidação',
      cor: 'bg-amber-50 text-amber-900 border-amber-200 dark:bg-amber-950/30 dark:text-amber-200',
      border: 'border-l-4 border-l-amber-500',
      badge: 'bg-amber-500 text-white',
      itens: [],
    },
    {
      fase: 'Estratégico (90+ dias)',
      prazo: 'Longo Prazo',
      cor: 'bg-emerald-50 text-emerald-900 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-200',
      border: 'border-l-4 border-l-emerald-500',
      badge: 'bg-emerald-600 text-white',
      itens: [],
    },
  ]

  let currentBucketIndex = 0
  const outrosItens: string[] = []

  lines.forEach((line) => {
    const norm = line
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()

    if (
      norm.includes('0-30') ||
      norm.includes('0 A 30') ||
      norm.includes('IMEDIAT') ||
      norm.includes('CURTO PRAZO')
    ) {
      currentBucketIndex = 0
    } else if (
      norm.includes('30-90') ||
      norm.includes('30 A 90') ||
      norm.includes('MEDIO PRAZO') ||
      norm.includes('CONSOLID')
    ) {
      currentBucketIndex = 1
    } else if (
      norm.includes('90+') ||
      norm.includes('90 DIAS') ||
      norm.includes('LONGO PRAZO') ||
      norm.includes('ESTRATEGIC')
    ) {
      currentBucketIndex = 2
    } else if (
      line.trim().startsWith('-') ||
      line.trim().startsWith('*') ||
      /^\d+\./.test(line.trim())
    ) {
      buckets[currentBucketIndex].itens.push(line)
    } else if (line.trim()) {
      // Se não for item de lista, pode ser contexto inicial do plano
      outrosItens.push(line)
    }
  })

  const hasTimeline = buckets.some((b) => b.itens.length > 0)

  if (!hasTimeline) {
    // Fallback: renderiza como lista estruturada
    return (
      <div className="space-y-1.5">
        {lines.map((l, i) => (
          <div key={i} className="flex items-start gap-2">
            <ChevronRight className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <span>{renderFormattedInline(l.replace(/^[-*•]\s*/, ''))}</span>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-3.5 my-3">
      {outrosItens.length > 0 && (
        <div className="text-xs text-slate-600 dark:text-slate-400 mb-2 italic">
          {outrosItens.map((item, idx) => (
            <p key={idx}>{renderFormattedInline(item)}</p>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 print:grid-cols-3">
        {buckets.map((b, idx) => (
          <div
            key={idx}
            className={`rounded-xl border p-3.5 shadow-2xs bg-white dark:bg-slate-900 ${b.border} border-slate-200 dark:border-slate-800 print:break-inside-avoid`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${b.badge}`}>
                {b.prazo}
              </span>
              <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                {b.fase.split('(')[0]}
              </span>
            </div>
            {b.itens.length > 0 ? (
              <ul className="space-y-2 text-xs">
                {b.itens.map((item, iIdx) => {
                  const clean = item.replace(/^[-*•\d.]+\s*/, '')
                  return (
                    <li key={iIdx} className="flex items-start gap-1.5 leading-snug">
                      <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 shrink-0 mt-0.5" />
                      <span className="text-slate-700 dark:text-slate-300">
                        {renderFormattedInline(clean)}
                      </span>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <p className="text-[11px] text-slate-400 italic">Sem ações específicas listadas.</p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// Parser dos blocos principais de texto da IA
type RawBlock =
  | { type: 'heading'; level: number; text: string }
  | { type: 'table'; lines: string[] }
  | { type: 'list'; items: string[] }
  | { type: 'card'; sectionType: SectionType; title: string; lines: string[] }
  | { type: 'paragraph'; text: string }

function parseContentToBlocks(content: string): RawBlock[] {
  if (!content) return []

  const rawLines = content.split('\n')
  const blocks: RawBlock[] = []
  let currentTable: string[] = []
  let currentList: string[] = []
  let currentCard: { sectionType: SectionType; title: string; lines: string[] } | null = null

  const flushTable = () => {
    if (currentTable.length > 0) {
      if (currentCard) {
        // Se estiver dentro de um card, tabela vai dentro dele como linhas
        currentTable.forEach((l) => currentCard?.lines.push(l))
      } else {
        blocks.push({ type: 'table', lines: [...currentTable] })
      }
      currentTable = []
    }
  }

  const flushList = () => {
    if (currentList.length > 0) {
      if (currentCard) {
        currentList.forEach((l) => currentCard?.lines.push(l))
      } else {
        blocks.push({ type: 'list', items: [...currentList] })
      }
      currentList = []
    }
  }

  const flushCard = () => {
    if (currentCard) {
      blocks.push({
        type: 'card',
        sectionType: currentCard.sectionType,
        title: currentCard.title,
        lines: [...currentCard.lines],
      })
      currentCard = null
    }
  }

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i]
    const trimmed = line.trim()

    // 1. Linha vazia
    if (!trimmed) {
      flushTable()
      flushList()
      continue
    }

    // 2. Tabela Pipe
    if (trimmed.startsWith('|') && trimmed.includes('|', 1)) {
      flushList()
      currentTable.push(trimmed)
      continue
    } else {
      flushTable()
    }

    // 3. Cabeçalhos Markdown (#, ##, ###) ou títulos especiais em caixa alta
    const isMarkdownHeading = /^#{1,4}\s+(.+)$/.exec(trimmed)
    const isNumberedHeading =
      /^(\d{1,2}\.|\bPILAR\s+\d+:?|\bDIAGN[OÓ]STICO|\bPONTOS?\s+FORTES?|\bPONTOS?\s+DE\s+ATEN[CÇ][AÃ]O|\bPLANO\s+DE\s+A[CÇ][AÃ]O|\bBENCHMARK\b|\bBENCHMARKS\b|\bTERM[OÔ]METRO\s+DE\s+KANITZ|\bMODELO\s+FLEURIET)\s*(.*)$/i.test(
        trimmed,
      ) &&
      trimmed.length < 90 &&
      !trimmed.endsWith('.')

    if (isMarkdownHeading || isNumberedHeading) {
      flushList()
      flushCard()

      const titleText = isMarkdownHeading
        ? isMarkdownHeading[1]
        : trimmed.replace(/^[#*]+\s*/, '').trim()
      const level = isMarkdownHeading ? isMarkdownHeading[0].indexOf(' ') : 2
      const meta = getSectionMeta(titleText)

      // Se for seção nobre que se beneficia de Card dedicado (ex.: Pontos Fortes, Atenção, Plano de Ação)
      if (
        meta.type === 'pontos_fortes' ||
        meta.type === 'pontos_atencao' ||
        meta.type === 'plano_acao'
      ) {
        currentCard = {
          sectionType: meta.type,
          title: titleText,
          lines: [],
        }
        continue
      }

      blocks.push({
        type: 'heading',
        level,
        text: titleText,
      })
      continue
    }

    // 4. Se estamos dentro de um Card coletando linhas
    if (currentCard) {
      currentCard.lines.push(line)
      continue
    }

    // 5. Lista com marcadores (- ou * ou • ou 1. 2.)
    if (/^[-*•]\s+/.test(trimmed) || /^\d+\.\s+/.test(trimmed)) {
      currentList.push(trimmed)
      continue
    } else {
      flushList()
    }

    // 6. Parágrafo comum
    blocks.push({
      type: 'paragraph',
      text: trimmed,
    })
  }

  flushTable()
  flushList()
  flushCard()

  return blocks
}

/**
 * Renderizador de Relatórios e Diagnósticos emitidos pelo Agente de IA.
 * Estrutura tabelas, cards de pontos fortes/atenção, timeline de plano de ação,
 * e destaca métricas financeiras visualmente.
 */
export const RelatorioIARenderer: React.FC<RelatorioIARendererProps> = ({
  content,
  className = '',
  isStreaming = false,
  empresaNome,
  periodo,
  dataGeracao,
  mostrarCabecalhoExecutivo = false,
  modoImpressao = false,
}) => {
  const blocks = useMemo(() => parseContentToBlocks(content), [content])

  const formattedDate = useMemo(() => {
    if (!dataGeracao) {
      return new Date().toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    }
    const d = typeof dataGeracao === 'string' ? new Date(dataGeracao) : dataGeracao
    return d.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }, [dataGeracao])

  if (!content) return null

  return (
    <div
      className={`relatorio-ia-container font-sans text-slate-800 dark:text-slate-200 ${className}`}
    >
      {/* Cabeçalho Executivo do Laudo quando habilitado */}
      {mostrarCabecalhoExecutivo && (
        <div className="mb-4 pb-3 border-b border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/60 rounded-xl p-3.5 border shadow-2xs print:border-slate-300 print:shadow-none print:break-inside-avoid">
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-[#0B1F3A] text-white flex items-center justify-center font-bold text-xs shadow-xs shrink-0">
                <Sparkles className="w-5 h-5 text-amber-300" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xs sm:text-sm font-black text-[#0B1F3A] dark:text-slate-100 uppercase tracking-tight">
                    {empresaNome
                      ? `Relatório Técnico — ${empresaNome}`
                      : 'Parecer de Controladoria IA'}
                  </h2>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                    <Sparkles className="w-2.5 h-2.5" />
                    Gerado por IA
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Diagnóstico 360°, Benchmarking de Mercado e Plano Estratégico
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400">
              {periodo && (
                <div className="flex items-center gap-1 font-medium bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                  <Calendar className="w-3 h-3 text-slate-500" />
                  <span>Exercício: {periodo}</span>
                </div>
              )}
              <div className="flex items-center gap-1 font-medium bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                <Clock className="w-3 h-3 text-slate-500" />
                <span>{formattedDate}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Renderização sequencial dos blocos estruturados */}
      <div className="space-y-3 leading-relaxed">
        {blocks.map((block, idx) => {
          switch (block.type) {
            case 'heading': {
              const meta = getSectionMeta(block.text)
              const Icon = meta.icon

              return (
                <div
                  key={idx}
                  className="pt-3 pb-1.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2 print:break-inside-avoid"
                >
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 border ${meta.colorBadge}`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <h3 className="text-xs sm:text-sm font-bold text-[#0B1F3A] dark:text-slate-100 uppercase tracking-wide">
                      {block.text}
                    </h3>
                  </div>
                </div>
              )
            }

            case 'table':
              return <TableBlock key={idx} lines={block.lines} />

            case 'card': {
              if (block.sectionType === 'plano_acao') {
                return (
                  <SpecializedCardBlock key={idx} type={block.sectionType} title={block.title}>
                    <PlanoAcaoTimelineBlock lines={block.lines} />
                  </SpecializedCardBlock>
                )
              }

              // Card de Pontos Fortes ou Atenção/Riscos
              return (
                <SpecializedCardBlock key={idx} type={block.sectionType} title={block.title}>
                  <ul className="space-y-2">
                    {block.lines
                      .filter((l) => l.trim().length > 0)
                      .map((line, lIdx) => {
                        const clean = line.replace(/^[-*•\d.]+\s*/, '')
                        const isBullet =
                          line.trim().startsWith('-') ||
                          line.trim().startsWith('*') ||
                          /^\d+\./.test(line.trim())

                        return (
                          <li
                            key={lIdx}
                            className={`flex items-start gap-2 ${
                              isBullet ? 'text-slate-800 dark:text-slate-200' : 'font-medium'
                            }`}
                          >
                            {isBullet && (
                              <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                            )}
                            <span className="leading-snug">{renderFormattedInline(clean)}</span>
                          </li>
                        )
                      })}
                  </ul>
                </SpecializedCardBlock>
              )
            }

            case 'list':
              return (
                <ul
                  key={idx}
                  className="my-2 space-y-1.5 pl-1 text-xs sm:text-sm text-slate-700 dark:text-slate-300"
                >
                  {block.items.map((item, iIdx) => {
                    const clean = item.replace(/^[-*•\d.]+\s*/, '')
                    return (
                      <li key={iIdx} className="flex items-start gap-2 leading-relaxed">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#0B1F3A] dark:bg-blue-400 shrink-0 mt-2" />
                        <span className="flex-1">{renderFormattedInline(clean)}</span>
                      </li>
                    )
                  })}
                </ul>
              )

            case 'paragraph':
            default:
              return (
                <p
                  key={idx}
                  className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed"
                >
                  {renderFormattedInline(block.text)}
                </p>
              )
          }
        })}

        {/* Indicador pulsante quando em streaming no final */}
        {isStreaming && (
          <span className="inline-block w-2 h-3.5 bg-blue-600 animate-pulse ml-1 align-middle rounded-xs" />
        )}
      </div>
    </div>
  )
}

export default RelatorioIARenderer
