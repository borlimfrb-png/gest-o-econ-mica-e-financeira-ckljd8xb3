import React, { useState, useRef } from 'react'
import * as XLSX from 'xlsx'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { useToast } from '@/hooks/use-toast'
import {
  planoContasLoteService,
  inferirTipoConta,
  type ItemImportacaoPlano,
  type ResultadoLotePlano,
} from '@/services/planoContasLoteService'
import type { EmpresaRecord, TipoConta } from '@/types/finance'
import {
  UploadCloud,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Building2,
  Download,
  Info,
  XCircle,
  RefreshCw,
} from 'lucide-react'

interface ModalImportarPlanoContasProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedEmpresa: EmpresaRecord | null
  totalContasEmpresaAtual: number
  onSuccess: () => void
}

const TIPO_CONTA_BADGE: Record<TipoConta, string> = {
  Ativo: 'bg-blue-50 text-blue-700 border-blue-200',
  Passivo: 'bg-amber-50 text-amber-700 border-amber-200',
  'Patrimônio Líquido': 'bg-violet-50 text-violet-700 border-violet-200',
  Receita: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Despesa: 'bg-rose-50 text-rose-700 border-rose-200',
}

function normalizarChave(k: string): string {
  return k
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
}

export const ModalImportarPlanoContas: React.FC<ModalImportarPlanoContasProps> = ({
  open,
  onOpenChange,
  selectedEmpresa,
  totalContasEmpresaAtual,
  onSuccess,
}) => {
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [arquivoNome, setArquivoNome] = useState<string>('')
  const [lendoArquivo, setLendoArquivo] = useState(false)
  const [itensLidos, setItensLidos] = useState<ItemImportacaoPlano[]>([])
  const [erroLeitura, setErroLeitura] = useState<string | null>(null)

  // Status de gravação
  const [importando, setImportando] = useState(false)
  const [progresso, setProgresso] = useState<{ atual: number; total: number } | null>(null)
  const [resultadoFinal, setResultadoFinal] = useState<ResultadoLotePlano | null>(null)

  const resetarEstado = () => {
    setArquivoNome('')
    setLendoArquivo(false)
    setItensLidos([])
    setErroLeitura(null)
    setImportando(false)
    setProgresso(null)
    setResultadoFinal(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleDownloadModeloPlanilha = () => {
    const dadosExemplo = [
      {
        Código: '1.1.01',
        Conta: 'Bancos Conta Movimento',
        Tipo: 'Ativo',
        Grupo: 'Ativo Circulante',
        'Centro de Custo': 'Disponibilidades',
        'Tipo de Despesa': '',
        Descrição: 'Contas correntes bancárias operacionais',
      },
      {
        Código: '1.1.02',
        Conta: 'Clientes a Receber',
        Tipo: 'Ativo',
        Grupo: 'Ativo Circulante',
        'Centro de Custo': 'Operações Comerciais',
        'Tipo de Despesa': '',
        Descrição: 'Faturas emitidas de consultoria',
      },
      {
        Código: '2.1.01',
        Conta: 'Fornecedores Nacionais',
        Tipo: 'Passivo',
        Grupo: 'Passivo Circulante',
        'Centro de Custo': 'Operações Gerais',
        'Tipo de Despesa': '',
        Descrição: 'Contas a pagar a parceiros e fornecedores',
      },
      {
        Código: '4.1.01',
        Conta: 'Receita de Serviços de Consultoria',
        Tipo: 'Receita',
        Grupo: 'Receita de Prestação de Serviços',
        'Centro de Custo': 'Serviços de Consultoria',
        'Tipo de Despesa': 'Receitas',
        Descrição: 'Faturamento bruto de projetos',
      },
      {
        Código: '5.1.01',
        Conta: 'Custos com Consultores Terceiros',
        Tipo: 'Despesa',
        Grupo: 'Custos dos Produtos/Serviços Vendidos (CPV/CSV)',
        'Centro de Custo': 'Serviços de Consultoria',
        'Tipo de Despesa': 'Despesas Variáveis',
        Descrição: 'Pagamento de consultores alocados',
      },
      {
        Código: '5.2.01',
        Conta: 'Softwares em Nuvem e TI',
        Tipo: 'Despesa',
        Grupo: 'Despesas Administrativas',
        'Centro de Custo': 'Tecnologia da Informação',
        'Tipo de Despesa': 'Despesas Fixas',
        Descrição: 'Assinaturas de ferramentas de trabalho',
      },
    ]

    const ws = XLSX.utils.json_to_sheet(dadosExemplo)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Modelo_Plano_Contas')
    XLSX.writeFile(wb, 'modelo-importacao-plano-contas.xlsx')

    toast({
      title: 'Modelo baixado!',
      description: 'Preencha o arquivo com seu plano de contas e importe-o a seguir.',
    })
  }

  const handleProcessarArquivo = async (file: File) => {
    setLendoArquivo(true)
    setErroLeitura(null)
    setResultadoFinal(null)
    setArquivoNome(file.name)

    try {
      const arrayBuffer = await file.arrayBuffer()
      const wb = XLSX.read(arrayBuffer, { type: 'array' })
      const firstSheetName = wb.SheetNames[0]
      if (!firstSheetName) {
        throw new Error('A planilha está vazia ou não possui abas legíveis.')
      }

      const ws = wb.Sheets[firstSheetName]
      const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' })

      if (rawRows.length === 0) {
        throw new Error('Nenhuma linha de dados encontrada na primeira aba da planilha.')
      }

      const itensProcessados: ItemImportacaoPlano[] = []

      rawRows.forEach((row, index) => {
        const linhaNum = index + 2 // +2 por causa do cabeçalho e 1-indexed

        // Procura campos com flexibilidade de sinônimos em PT-BR
        let codigo = ''
        let codigoEmpresa = ''
        let contaNome = ''
        let contaTipo = ''
        let contaGrupo = ''
        let centroNome = ''
        let tipoDespesaNome = ''
        let descricao = ''

        for (const [colunaRaw, valorRaw] of Object.entries(row)) {
          const colNorm = normalizarChave(colunaRaw)
          const valStr = String(valorRaw ?? '').trim()
          if (!valStr) continue

          // Código da Empresa
          if (
            colNorm === 'codigo da conta da empresa' ||
            colNorm === 'codigo da empresa' ||
            colNorm === 'codigo empresa' ||
            colNorm === 'cod empresa' ||
            colNorm === 'cod. empresa' ||
            colNorm === 'conta da empresa'
          ) {
            codigoEmpresa = valStr
          }
          // Código
          else if (
            colNorm === 'codigo' ||
            colNorm === 'cod' ||
            colNorm === 'cod.' ||
            colNorm === 'num' ||
            colNorm === 'numero' ||
            colNorm === 'classificacao'
          ) {
            codigo = valStr
          }
          // Nome da Conta
          else if (
            colNorm === 'conta' ||
            colNorm === 'nome' ||
            colNorm === 'nome da conta' ||
            colNorm === 'descricao da conta' ||
            colNorm === 'titulo'
          ) {
            contaNome = valStr
          }
          // Tipo / Natureza
          else if (
            colNorm === 'tipo' ||
            colNorm === 'tipo de conta' ||
            colNorm === 'tipo contabil' ||
            colNorm === 'natureza'
          ) {
            contaTipo = valStr
          }
          // Grupo
          else if (
            colNorm === 'grupo' ||
            colNorm === 'grupo de contas' ||
            colNorm === 'categoria' ||
            colNorm === 'classe'
          ) {
            contaGrupo = valStr
          }
          // Centro de Custo
          else if (
            colNorm === 'centro' ||
            colNorm === 'centro de custo' ||
            colNorm === 'centro de custos' ||
            colNorm === 'cc'
          ) {
            centroNome = valStr
          }
          // Tipo de Despesa
          else if (
            colNorm === 'tipo de despesa' ||
            colNorm === 'tipo despesa' ||
            colNorm === 'despesa tipo' ||
            colNorm === 'td'
          ) {
            tipoDespesaNome = valStr
          }
          // Descrição complementar
          else if (
            colNorm === 'descricao' ||
            colNorm === 'observacao' ||
            colNorm === 'historico' ||
            colNorm === 'detalhes'
          ) {
            descricao = valStr
          }
        }

        // Se 'contaNome' não foi achada mas temos coluna 'descricao', usa ela como conta
        if (!contaNome && descricao) {
          contaNome = descricao
          descricao = ''
        }

        const valido = Boolean(contaNome && contaNome.trim().length >= 2)
        const erroValidacao = valido ? undefined : 'Nome da conta obrigatório (mínimo 2 caracteres)'

        const tipoInferido = inferirTipoConta(contaTipo, contaNome)

        itensProcessados.push({
          linhaOrigem: linhaNum,
          codigo: codigo || undefined,
          codigoEmpresa: codigoEmpresa || undefined,
          contaNome: contaNome.trim(),
          contaTipo: tipoInferido,
          contaGrupo: contaGrupo || undefined,
          centroNome: centroNome || undefined,
          tipoDespesaNome: tipoDespesaNome || undefined,
          descricao: descricao || undefined,
          valido,
          erroValidacao,
        })
      })

      if (itensProcessados.length === 0) {
        throw new Error('Não foi possível identificar colunas válidas no arquivo.')
      }

      setItensLidos(itensProcessados)
    } catch (err: any) {
      console.error(err)
      setErroLeitura(err?.message || 'Falha ao processar o arquivo enviado.')
      setItensLidos([])
    } finally {
      setLendoArquivo(false)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    handleProcessarArquivo(file)
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (!file) return
    handleProcessarArquivo(file)
  }

  const totalValidos = itensLidos.filter((i) => i.valido).length
  const totalInvalidos = itensLidos.length - totalValidos

  const handleConfirmarImportacao = async () => {
    if (!selectedEmpresa) {
      toast({
        variant: 'destructive',
        title: 'Selecione a empresa',
        description: 'É necessário selecionar a empresa de destino antes de importar.',
      })
      return
    }

    const validos = itensLidos.filter((i) => i.valido)
    if (validos.length === 0) {
      toast({
        variant: 'destructive',
        title: 'Nenhuma linha válida',
        description: 'Corrija os erros na planilha antes de confirmar a importação.',
      })
      return
    }

    setImportando(true)
    setProgresso({ atual: 0, total: validos.length })

    try {
      const res = await planoContasLoteService.importarItens(
        selectedEmpresa.id,
        validos,
        (atual, total) => setProgresso({ atual, total }),
      )

      setResultadoFinal(res)

      toast({
        title: 'Importação concluída!',
        description: `${res.totalCriados} conta(s) importada(s) para ${selectedEmpresa.nome}.`,
      })

      onSuccess()
    } catch (err: any) {
      console.error(err)
      toast({
        variant: 'destructive',
        title: 'Erro na importação',
        description: err?.message || 'Falha ao gravar os itens no plano de contas.',
      })
    } finally {
      setImportando(false)
      setProgresso(null)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (importando) return
        if (!v) resetarEstado()
        onOpenChange(v)
      }}
    >
      <DialogContent className="sm:max-w-[840px] max-h-[92vh] flex flex-col bg-white p-0 gap-0 overflow-hidden">
        {/* Header */}
        <DialogHeader className="p-5 pb-3 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-[#0B1F3A] flex items-center gap-2">
                  Importar Plano de Contas (Excel / CSV)
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500 mt-0.5">
                  Importe contas de arquivos <code className="font-mono">.xlsx</code>,{' '}
                  <code className="font-mono">.xls</code> ou <code className="font-mono">.csv</code>{' '}
                  vinculadas à empresa selecionada.
                </DialogDescription>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleDownloadModeloPlanilha}
              className="h-8 text-xs font-semibold border-slate-200 text-slate-700 hover:bg-slate-100 gap-1.5"
            >
              <Download className="w-3.5 h-3.5 text-blue-600" />
              Baixar Planilha Modelo
            </Button>
          </div>
        </DialogHeader>

        {/* Corpo com scroll */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1 text-xs">
          {/* Banner da Empresa Alvo */}
          <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-blue-700 shrink-0" />
              <div>
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                  Empresa Destino
                </span>
                <strong className="text-xs text-blue-900 font-bold">
                  {selectedEmpresa?.nome || 'Nenhuma selecionada'}
                </strong>
              </div>
            </div>
            <Badge variant="outline" className="bg-white text-slate-700 border-slate-200 font-mono">
              {totalContasEmpresaAtual} conta(s) existente(s)
            </Badge>
          </div>

          {/* Área de Upload / Dropzone */}
          {itensLidos.length === 0 && !resultadoFinal && (
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-300 hover:border-blue-400 bg-slate-50/70 hover:bg-blue-50/30 rounded-xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileChange}
                className="hidden"
              />
              <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-blue-600 mb-3 shadow-xs">
                {lendoArquivo ? (
                  <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                ) : (
                  <UploadCloud className="w-6 h-6" />
                )}
              </div>
              <h4 className="text-sm font-bold text-[#0B1F3A]">
                {lendoArquivo
                  ? 'Processando planilha...'
                  : 'Clique para selecionar ou arraste o arquivo'}
              </h4>
              <p className="text-xs text-slate-500 mt-1 max-w-sm">
                Formatos aceitos: <strong>Excel (.xlsx, .xls)</strong> ou{' '}
                <strong>CSV (.csv)</strong>.
              </p>
              <div className="mt-3 flex items-center gap-2 text-[11px] text-slate-500 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-2xs">
                <Info className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                <span>
                  Colunas reconhecidas: <strong>Código</strong>, <strong>Conta</strong>,{' '}
                  <strong>Tipo</strong>, <strong>Grupo</strong>, <strong>Centro de Custo</strong>,{' '}
                  <strong>Tipo de Despesa</strong>.
                </span>
              </div>
            </div>
          )}

          {/* Erro de Leitura */}
          {erroLeitura && (
            <Alert variant="destructive" className="bg-red-50 border-red-200 text-red-900">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <div className="ml-2">
                <AlertTitle className="text-xs font-bold">Falha ao ler o arquivo</AlertTitle>
                <AlertDescription className="text-xs mt-0.5">{erroLeitura}</AlertDescription>
              </div>
            </Alert>
          )}

          {/* Relatório do Resultado Final de Gravação */}
          {resultadoFinal && (
            <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-xl space-y-3 animate-fadeIn">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0" />
                <h4 className="text-sm font-bold text-emerald-950">
                  Importação Finalizada com Sucesso!
                </h4>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="p-2.5 rounded-lg bg-white border border-emerald-200 shadow-2xs">
                  <span className="text-[10px] font-semibold text-slate-500 uppercase block">
                    Total Lido
                  </span>
                  <strong className="text-sm font-bold text-slate-900">
                    {resultadoFinal.totalSolicitados}
                  </strong>
                </div>
                <div className="p-2.5 rounded-lg bg-white border border-emerald-200 shadow-2xs">
                  <span className="text-[10px] font-semibold text-emerald-700 uppercase block">
                    Criadas
                  </span>
                  <strong className="text-sm font-bold text-emerald-700">
                    {resultadoFinal.totalCriados}
                  </strong>
                </div>
                <div className="p-2.5 rounded-lg bg-white border border-amber-200 shadow-2xs">
                  <span className="text-[10px] font-semibold text-amber-700 uppercase block">
                    Já Existiam
                  </span>
                  <strong className="text-sm font-bold text-amber-700">
                    {resultadoFinal.totalIgnoradosDuplicados}
                  </strong>
                </div>
                <div className="p-2.5 rounded-lg bg-white border border-slate-200 shadow-2xs">
                  <span className="text-[10px] font-semibold text-rose-700 uppercase block">
                    Erros
                  </span>
                  <strong className="text-sm font-bold text-rose-700">
                    {resultadoFinal.totalErros}
                  </strong>
                </div>
              </div>

              {resultadoFinal.errosDetalhes.length > 0 && (
                <div className="mt-2 p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-rose-900 text-xs">
                  <strong>Ocorrências durante a gravação:</strong>
                  <ul className="list-disc list-inside mt-1 space-y-0.5 text-[11px]">
                    {resultadoFinal.errosDetalhes.slice(0, 5).map((e, idx) => (
                      <li key={idx}>{e}</li>
                    ))}
                    {resultadoFinal.errosDetalhes.length > 5 && (
                      <li>... e mais {resultadoFinal.errosDetalhes.length - 5} erro(s).</li>
                    )}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Prévia da Tabela dos Dados Lidos */}
          {itensLidos.length > 0 && !resultadoFinal && (
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-semibold text-slate-700">
                    Arquivo: <strong className="text-blue-900">{arquivoNome}</strong>
                  </span>
                  <Badge
                    variant="outline"
                    className="bg-emerald-50 text-emerald-800 border-emerald-200"
                  >
                    {totalValidos} válidos
                  </Badge>
                  {totalInvalidos > 0 && (
                    <Badge variant="outline" className="bg-rose-50 text-rose-800 border-rose-200">
                      {totalInvalidos} inválidos
                    </Badge>
                  )}
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={resetarEstado}
                  className="h-7 text-xs text-slate-500 hover:text-slate-800 self-start sm:self-auto gap-1"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Trocar Arquivo
                </Button>
              </div>

              {/* Tabela de Prévia */}
              <div className="border border-slate-200 rounded-lg overflow-hidden max-h-[340px] overflow-y-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="sticky top-0 bg-slate-100 z-10 border-b border-slate-200">
                    <tr className="text-slate-600 font-semibold text-[11px]">
                      <th className="py-2 px-3 w-12 text-center">Linha</th>
                      <th className="py-2 px-3 w-20">Cód.</th>
                      <th className="py-2 px-3">Conta Contábil</th>
                      <th className="py-2 px-3">Tipo</th>
                      <th className="py-2 px-3">Grupo</th>
                      <th className="py-2 px-3">Centro de Custo</th>
                      <th className="py-2 px-3">Tipo Despesa</th>
                      <th className="py-2 px-3 text-center w-16">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {itensLidos.map((it, idx) => (
                      <tr
                        key={idx}
                        className={`transition-colors ${
                          it.valido ? 'hover:bg-slate-50/70' : 'bg-rose-50/40 hover:bg-rose-50/60'
                        }`}
                      >
                        <td className="py-2 px-3 text-center font-mono text-slate-400 text-[11px]">
                          {it.linhaOrigem || idx + 1}
                        </td>
                        <td className="py-2 px-3 font-mono text-slate-600 font-semibold text-[11px]">
                          {it.codigo || '—'}
                        </td>
                        <td className="py-2 px-3">
                          <strong className="text-slate-900 block font-semibold">
                            {it.contaNome || <span className="text-red-500 italic">Vazio</span>}
                          </strong>
                          {it.descricao && (
                            <span className="text-[10px] text-slate-500 block truncate max-w-xs">
                              {it.descricao}
                            </span>
                          )}
                          {!it.valido && (
                            <span className="text-[10px] text-rose-600 font-medium block">
                              {it.erroValidacao}
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-3">
                          {it.contaTipo ? (
                            <Badge
                              className={`text-[9px] font-semibold px-1.5 py-0 border w-fit ${
                                TIPO_CONTA_BADGE[it.contaTipo] || ''
                              }`}
                            >
                              {it.contaTipo}
                            </Badge>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-slate-600 text-[11px]">
                          {it.contaGrupo || (
                            <span className="text-slate-400 italic">Automático</span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-slate-700 font-medium text-[11px]">
                          {it.centroNome || (
                            <span className="text-slate-400 italic">Automático</span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-slate-600 text-[11px]">
                          {it.tipoDespesaNome || <span className="text-slate-400">—</span>}
                        </td>
                        <td className="py-2 px-3 text-center">
                          {it.valido ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 inline" />
                          ) : (
                            <span
                              title={it.erroValidacao}
                              className="inline-flex items-center justify-center"
                            >
                              <XCircle className="w-4 h-4 text-rose-600" />
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Barra de Progresso durante a importação */}
              {progresso && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg space-y-1.5 animate-fadeIn">
                  <div className="flex justify-between text-xs font-semibold text-blue-900">
                    <span>Gravando contas na empresa selecionada...</span>
                    <span>
                      {progresso.atual} de {progresso.total} (
                      {Math.round((progresso.atual / progresso.total) * 100)}%)
                    </span>
                  </div>
                  <div className="w-full bg-blue-200/60 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all duration-150"
                      style={{
                        width: `${Math.round((progresso.atual / progresso.total) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <DialogFooter className="p-4 border-t border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="text-[11px] text-slate-500">
            {itensLidos.length > 0 && !resultadoFinal ? (
              <span>
                {totalValidos} conta(s) pronta(s) para importação com código sequencial automático.
              </span>
            ) : (
              <span>
                Arquivos suportados: .xlsx, .xls ou .csv (delimitador vírgula ou ponto-e-vírgula).
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                resetarEstado()
                onOpenChange(false)
              }}
              disabled={importando}
              className="text-xs h-9"
            >
              {resultadoFinal ? 'Fechar' : 'Cancelar'}
            </Button>

            {!resultadoFinal && itensLidos.length > 0 && (
              <Button
                type="button"
                onClick={handleConfirmarImportacao}
                disabled={importando || totalValidos === 0 || !selectedEmpresa}
                className="text-xs h-9 font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs gap-1.5"
              >
                {importando ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Importando...
                  </>
                ) : (
                  <>
                    <UploadCloud className="w-4 h-4" />
                    Confirmar e Importar ({totalValidos} contas)
                  </>
                )}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
