import React, { useCallback, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import * as XLSX from 'xlsx'
import { useFilter } from '@/contexts/FilterContext'
import { balancosService } from '@/services/financeService'
import { useToast } from '@/hooks/use-toast'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  UploadCloud,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  ArrowLeft,
  Table2,
  RefreshCw,
  Trash2,
} from 'lucide-react'

// ---------- Mapeamento de campos do balanço ----------
interface CampoMap {
  field: string
  label: string
  aliases: string[]
}

const BALANCO_FIELDS: CampoMap[] = [
  {
    field: 'ano',
    label: 'Ano (exercício)',
    aliases: ['ano', 'exercicio', 'year', 'exercicio social'],
  },
  // Ativo Circulante
  {
    field: 'caixa_equivalentes',
    label: 'Caixa e Equivalentes',
    aliases: ['caixa', 'caixa e equivalentes', 'caixa equivalentes', 'dinheiro', 'caixa e bancos'],
  },
  {
    field: 'aplicacoes_financeiras',
    label: 'Aplicações Financeiras',
    aliases: [
      'aplicacoes',
      'aplicacoes financeiras',
      'aplicacao financeira',
      'aplicacoes financeiras de curto prazo',
    ],
  },
  {
    field: 'contas_receber',
    label: 'Contas a Receber',
    aliases: [
      'contas a receber',
      'contas receber',
      'clientes',
      'duplicatas a receber',
      'contas a receber cp',
    ],
  },
  { field: 'estoques', label: 'Estoques', aliases: ['estoques', 'estoque', 'estoques cp'] },
  {
    field: 'impostos_recuperar',
    label: 'Impostos a Recuperar',
    aliases: [
      'impostos a recuperar',
      'impostos recuperar',
      'tributos a recuperar',
      'credito tributario',
    ],
  },
  {
    field: 'outros_ativo_circulante',
    label: 'Outros Ativo Circulante',
    aliases: ['outros ativo circulante', 'outros ac', 'outros ativos circulantes', 'adiantamentos'],
  },
  // Ativo Não Circulante
  {
    field: 'realizavel_longo_prazo',
    label: 'Realizável a Longo Prazo',
    aliases: [
      'realizavel a longo prazo',
      'realizavel longo prazo',
      'rlp',
      'realizavel lp',
      'creditos longo prazo',
    ],
  },
  {
    field: 'investimentos',
    label: 'Investimentos',
    aliases: ['investimentos', 'investimento', 'investimentos anc'],
  },
  {
    field: 'imobilizado',
    label: 'Imobilizado',
    aliases: ['imobilizado', 'ativo imobilizado', 'imobilizado liquido'],
  },
  {
    field: 'intangivel',
    label: 'Intangível',
    aliases: ['intangivel', 'intangiveis', 'ativo intangivel'],
  },
  // Passivo Circulante
  {
    field: 'fornecedores',
    label: 'Fornecedores',
    aliases: ['fornecedores', 'fornecedor', 'fornecedores cp'],
  },
  {
    field: 'emprestimos_curto_prazo',
    label: 'Empréstimos Curto Prazo',
    aliases: [
      'emprestimos curto prazo',
      'emprestimos cp',
      'emprestimos e financiamentos cp',
      'dividas curtas',
    ],
  },
  {
    field: 'obrigacoes_trabalhistas',
    label: 'Obrigações Trabalhistas',
    aliases: ['obrigacoes trabalhistas', 'passivo trabalhista', 'encargos sociais'],
  },
  {
    field: 'obrigacoes_tributarias',
    label: 'Obrigações Tributárias',
    aliases: [
      'obrigacoes tributarias',
      'impostos a pagar',
      'tributos a pagar',
      'obrigacoes fiscais',
    ],
  },
  {
    field: 'outros_passivo_circulante',
    label: 'Outros Passivo Circulante',
    aliases: ['outros passivo circulante', 'outros pc', 'outros passivos circulantes'],
  },
  // Passivo Não Circulante
  {
    field: 'emprestimos_longo_prazo',
    label: 'Empréstimos Longo Prazo',
    aliases: [
      'emprestimos longo prazo',
      'emprestimos lp',
      'emprestimos e financiamentos lp',
      'dividas longas',
    ],
  },
  {
    field: 'outras_obrigacoes_longo_prazo',
    label: 'Outras Obrigações Longo Prazo',
    aliases: [
      'outras obrigacoes longo prazo',
      'outras obrigacoes lp',
      'outros passivos nao circulantes',
    ],
  },
  // Patrimônio Líquido
  {
    field: 'capital_social',
    label: 'Capital Social',
    aliases: ['capital social', 'capital integralizado'],
  },
  {
    field: 'reservas_lucros',
    label: 'Reservas de Lucros',
    aliases: ['reservas de lucros', 'reservas', 'reservas de capital', 'reserva legal'],
  },
  {
    field: 'lucros_acumulados',
    label: 'Lucros Acumulados',
    aliases: ['lucros acumulados', 'lucro acumulado', 'prejuizos acumulados'],
  },
]

// Normaliza texto para comparação: lowercase, sem acentos, sem pontuação
function normalizeHeader(s: string): string {
  return (s || '')
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

// Tenta casar um cabeçalho com um campo do balanço
function guessField(header: string): string {
  const norm = normalizeHeader(header)
  if (!norm) return ''
  // Match exato primeiro
  for (const c of BALANCO_FIELDS) {
    if (c.aliases.some((a) => normalizeHeader(a) === norm)) return c.field
  }
  // Match por inclusão (cabeçalho contém alias ou vice-versa)
  for (const c of BALANCO_FIELDS) {
    if (
      c.aliases.some((a) => {
        const na = normalizeHeader(a)
        return na && (norm.includes(na) || na.includes(norm))
      })
    ) {
      return c.field
    }
  }
  return ''
}

// Converte valor da planilha em número (suporta pt-BR e en-US)
function parseNumber(val: unknown): number {
  if (val === null || val === undefined || val === '') return 0
  if (typeof val === 'number') return isNaN(val) ? 0 : val
  let s = String(val).trim()
  if (!s) return 0
  // Remove espaços e símbolos monetários
  s = s.replace(/[R$\s]/g, '').replace(/%(?=\d)/g, '')
  // Se tem ponto E vírgula: assume o último como decimal
  if (s.indexOf(',') !== -1 && s.indexOf('.') !== -1) {
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
      // pt-BR: 1.234,56
      s = s.replace(/\./g, '').replace(',', '.')
    } else {
      // en-US: 1,234.56
      s = s.replace(/,/g, '')
    }
  } else if (s.indexOf(',') !== -1) {
    // Só vírgula -> decimal pt-BR
    s = s.replace(',', '.')
  }
  // Parênteses indicam negativo
  const negative = /^\(.*\)$/.test(s)
  s = s.replace(/[()]/g, '')
  const n = Number(s)
  if (isNaN(n)) return 0
  return negative ? -n : n
}

function parseAno(val: unknown, fallback: number): number {
  if (val === null || val === undefined || val === '') return fallback
  const n = typeof val === 'number' ? val : parseInt(String(val).replace(/\D/g, ''), 10)
  if (!isNaN(n) && n >= 1900 && n <= 2999) return n
  return fallback
}

interface ParsedSheet {
  fileName: string
  headers: string[]
  rows: Record<string, unknown>[]
}

export default function Importacao() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const { empresas, selectedEmpresaId, setSelectedEmpresaId, selectedAno, setSelectedAno } =
    useFilter()

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [parsed, setParsed] = useState<ParsedSheet | null>(null)
  const [mapping, setMapping] = useState<Record<string, string>>({})
  const [dragging, setDragging] = useState(false)
  const [parsing, setParsing] = useState(false)
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const processFile = useCallback(
    async (file: File) => {
      setError(null)
      setParsed(null)
      setMapping({})
      if (!/\.(xlsx|xls)$/i.test(file.name)) {
        setError('Formato inválido. Selecione um arquivo .xlsx ou .xls.')
        return
      }
      setParsing(true)
      try {
        const buf = await file.arrayBuffer()
        const wb = XLSX.read(buf, { type: 'array' })
        const firstSheetName = wb.SheetNames[0]
        if (!firstSheetName) {
          setError('A planilha não possui abas com dados.')
          return
        }
        const sheet = wb.Sheets[firstSheetName]
        // Lê como array de objetos usando a primeira linha como cabeçalho
        const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
          defval: '',
          raw: true,
        })
        if (json.length === 0) {
          setError('A planilha está vazia ou não possui linhas de dados.')
          return
        }
        const headers = Object.keys(json[0])
        const newParsed: ParsedSheet = { fileName: file.name, headers, rows: json }
        setParsed(newParsed)
        // Mapeamento automático
        const auto: Record<string, string> = {}
        for (const h of headers) {
          auto[h] = guessField(h)
        }
        setMapping(auto)
        toast({
          title: 'Planilha carregada',
          description: `${json.length} linha(s) e ${headers.length} coluna(s) encontradas.`,
        })
      } catch (err) {
        console.error(err)
        setError('Não foi possível ler o arquivo. Verifique se é um Excel válido.')
      } finally {
        setParsing(false)
      }
    },
    [toast],
  )

  const onDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      setDragging(false)
      const file = e.dataTransfer.files?.[0]
      if (file) processFile(file)
    },
    [processFile],
  )

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) processFile(file)
    // reset para permitir re-selecionar o mesmo arquivo
    e.target.value = ''
  }

  const resetImport = () => {
    setParsed(null)
    setMapping({})
    setError(null)
  }

  const setMap = (header: string, field: string) => {
    setMapping((prev) => ({ ...prev, [header]: field }))
  }

  // Linhas de preview (máx 8) com valores formatados
  const previewRows = useMemo(() => {
    if (!parsed) return []
    return parsed.rows.slice(0, 8)
  }, [parsed])

  // Contagem de campos mapeados
  const mappedCount = useMemo(
    () => (parsed ? parsed.headers.filter((h) => mapping[h]).length : 0),
    [parsed, mapping],
  )

  const handleImport = async () => {
    if (!parsed) return
    if (!selectedEmpresaId) {
      toast({ variant: 'destructive', title: 'Selecione a empresa de destino.' })
      return
    }
    setImporting(true)
    setError(null)
    let sucesso = 0
    let falhas = 0
    const camposMapeados = parsed.headers.filter((h) => mapping[h] && mapping[h] !== 'ano')
    try {
      for (const row of parsed.rows) {
        const data: Record<string, number> = {}
        for (const h of camposMapeados) {
          const field = mapping[h]
          data[field] = parseNumber(row[h])
        }
        const colunaAno = parsed.headers.find((h) => mapping[h] === 'ano')
        const ano = colunaAno ? parseAno(row[colunaAno], selectedAno) : selectedAno
        try {
          await balancosService.upsert(selectedEmpresaId, ano, data)
          sucesso++
        } catch (err: any) {
          console.error('Erro ao importar linha:', err)
          falhas++
        }
      }
      if (falhas === 0) {
        toast({
          title: 'Importação concluída',
          description: `${sucesso} registro(s) importado(s) com sucesso para ${
            empresas.find((e) => e.id === selectedEmpresaId)?.nome || 'a empresa'
          }.`,
        })
      } else {
        toast({
          variant: 'destructive',
          title: 'Importação parcial',
          description: `${sucesso} registro(s) importado(s), ${falhas} com falha. Verifique os dados.`,
        })
      }
      if (sucesso > 0) {
        navigate(`/empresas/${selectedEmpresaId}`)
      }
    } catch (err: any) {
      setError(err?.message || 'Erro inesperado ao importar.')
    } finally {
      setImporting(false)
    }
  }

  const empresaSelecionada = empresas.find((e) => e.id === selectedEmpresaId)

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Cabeçalho */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-[#0B1F3A] tracking-tight">
            Importação de Balanços
          </h1>
          <p className="text-xs text-[#5B6B7F]">
            Carregue planilhas Excel (.xlsx, .xls) e importe os dados diretamente para o sistema.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate('/dashboard')}
          className="text-xs font-medium border-slate-200 hover:bg-slate-50 text-slate-700"
        >
          <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
          Voltar
        </Button>
      </div>

      {/* Card de instruções + drop */}
      <Card className="bg-white border-slate-200 shadow-xs">
        <CardHeader className="pb-3 border-b border-slate-100">
          <CardTitle className="text-sm font-bold text-[#0B1F3A] flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-blue-600" />
            Arquivo Excel
          </CardTitle>
          <CardDescription className="text-xs">
            A primeira aba da planilha será lida. A primeira linha deve conter os cabeçalhos das
            colunas (ex.: Caixa e Equivalentes, Fornecedores, Capital Social, Ano...).
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4 space-y-4">
          {/* Área de Drop */}
          <div
            onDragOver={(e) => {
              e.preventDefault()
              setDragging(true)
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`relative cursor-pointer rounded-xl border-2 border-dashed transition-all p-8 text-center ${
              dragging
                ? 'border-blue-500 bg-blue-50/70'
                : 'border-slate-300 bg-slate-50/50 hover:border-blue-400 hover:bg-blue-50/40'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={onFileChange}
              className="hidden"
            />
            <div className="flex flex-col items-center gap-2">
              <div
                className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-colors ${
                  dragging ? 'bg-blue-600 text-white' : 'bg-blue-50 text-blue-600'
                }`}
              >
                {parsing ? (
                  <RefreshCw className="w-6 h-6 animate-spin" />
                ) : (
                  <UploadCloud className="w-6 h-6" />
                )}
              </div>
              {parsing ? (
                <p className="text-sm font-semibold text-slate-700">Lendo planilha...</p>
              ) : parsed ? (
                <>
                  <p className="text-sm font-semibold text-[#0B1F3A]">{parsed.fileName}</p>
                  <p className="text-[11px] text-slate-500">
                    {parsed.rows.length} linha(s) · {parsed.headers.length} coluna(s) · clique para
                    trocar o arquivo
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm font-semibold text-slate-700">
                    Arraste a planilha aqui ou clique para selecionar
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Formatos aceitos: .xlsx, .xls (máx. alguns MB)
                  </p>
                </>
              )}
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 p-3">
              <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
              <p className="text-xs font-medium text-red-700">{error}</p>
            </div>
          )}

          {parsed && (
            <div className="flex items-center justify-between">
              <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-50 text-[11px] font-semibold">
                <CheckCircle2 className="w-3 h-3 mr-1" />
                {mappedCount} de {parsed.headers.length} coluna(s) mapeada(s)
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                onClick={resetImport}
                className="text-xs text-slate-500 hover:text-red-600 hover:bg-red-50 h-7"
              >
                <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                Remover arquivo
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {parsed && (
        <>
          {/* Mapeamento + Destino */}
          <Card className="bg-white border-slate-200 shadow-xs">
            <CardHeader className="pb-3 border-b border-slate-100">
              <CardTitle className="text-sm font-bold text-[#0B1F3A] flex items-center gap-2">
                <Table2 className="w-4 h-4 text-blue-600" />
                Mapeamento de Colunas
              </CardTitle>
              <CardDescription className="text-xs">
                Ajuste o campo de destino de cada coluna. As colunas sem mapeamento serão ignoradas
                na importação.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {parsed.headers.map((h) => {
                  const mapped = mapping[h] || ''
                  return (
                    <div
                      key={h}
                      className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-slate-800 truncate" title={h}>
                          {h}
                        </p>
                        <p className="text-[10px] text-slate-400 truncate">
                          Ex.: {String(parsed.rows[0]?.[h] ?? '—')}
                        </p>
                      </div>
                      <Select
                        value={mapped}
                        onValueChange={(v) => setMap(h, v === '__none' ? '' : v)}
                      >
                        <SelectTrigger className="h-8 text-xs bg-white w-[200px] shrink-0">
                          <SelectValue placeholder="Ignorar" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none" className="text-xs">
                            — Ignorar —
                          </SelectItem>
                          {BALANCO_FIELDS.map((c) => (
                            <SelectItem key={c.field} value={c.field} className="text-xs">
                              {c.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>

          {/* Destino */}
          <Card className="bg-white border-slate-200 shadow-xs">
            <CardHeader className="pb-3 border-b border-slate-100">
              <CardTitle className="text-sm font-bold text-[#0B1F3A]">
                Destino da Importação
              </CardTitle>
              <CardDescription className="text-xs">
                Selecione a empresa e o ano de destino. Se a planilha tiver uma coluna "Ano"
                mapeada, cada linha usará seu próprio ano; caso contrário, todas usam o ano abaixo.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700">Empresa *</Label>
                  <Select value={selectedEmpresaId} onValueChange={(v) => setSelectedEmpresaId(v)}>
                    <SelectTrigger className="h-9 text-xs bg-white">
                      <SelectValue placeholder="Selecione a empresa" />
                    </SelectTrigger>
                    <SelectContent>
                      {empresas.map((emp) => (
                        <SelectItem key={emp.id} value={emp.id} className="text-xs">
                          {emp.nome} ({emp.segmento})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700">Ano de destino *</Label>
                  <Select
                    value={String(selectedAno)}
                    onValueChange={(v) => setSelectedAno(Number(v))}
                  >
                    <SelectTrigger className="h-9 text-xs bg-white">
                      <SelectValue placeholder="Ano" />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 11 }, (_, i) => new Date().getFullYear() - i).map(
                        (ano) => (
                          <SelectItem key={ano} value={String(ano)} className="text-xs">
                            {ano}
                          </SelectItem>
                        ),
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Preview */}
          <Card className="bg-white border-slate-200 shadow-xs">
            <CardHeader className="pb-3 border-b border-slate-100">
              <CardTitle className="text-sm font-bold text-[#0B1F3A]">Pré-visualização</CardTitle>
              <CardDescription className="text-xs">
                Primeiras {previewRows.length} de {parsed.rows.length} linha(s). Apenas colunas
                mapeadas serão importadas.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0 p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse min-w-max">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-600 font-semibold">
                      <th className="py-2.5 px-3 sticky left-0 bg-slate-50/70 z-10">#</th>
                      {parsed.headers.map((h) => {
                        const mapped = mapping[h]
                        return (
                          <th key={h} className="py-2.5 px-3 whitespace-nowrap">
                            <span className="block">{h}</span>
                            {mapped ? (
                              <span className="text-[10px] font-normal text-blue-600">
                                → {BALANCO_FIELDS.find((c) => c.field === mapped)?.label}
                              </span>
                            ) : (
                              <span className="text-[10px] font-normal text-slate-400">
                                ignorado
                              </span>
                            )}
                          </th>
                        )
                      })}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {previewRows.map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-2.5 px-3 text-slate-400 sticky left-0 bg-white z-10">
                          {idx + 1}
                        </td>
                        {parsed.headers.map((h) => (
                          <td key={h} className="py-2.5 px-3 text-slate-700 whitespace-nowrap">
                            {String(row[h] ?? '—')}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Ação de importar */}
          <div className="flex items-center justify-end gap-3">
            <Button
              variant="outline"
              onClick={resetImport}
              disabled={importing}
              className="text-xs h-9 font-medium border-slate-200 hover:bg-slate-50 text-slate-700"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleImport}
              disabled={importing || !selectedEmpresaId || mappedCount === 0}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs h-9 shadow-xs"
            >
              {importing ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-1.5 animate-spin" />
                  Importando...
                </>
              ) : (
                <>
                  <UploadCloud className="w-4 h-4 mr-1.5" />
                  Importar para{' '}
                  {empresaSelecionada ? empresaSelecionada.nome : 'empresa selecionada'}
                </>
              )}
            </Button>
          </div>
        </>
      )}
    </div>
  )
}
