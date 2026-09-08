import { useMemo } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Printer,
  FileSpreadsheet,
  AlertTriangle,
  Building2,
  FileText,
  Percent,
  CheckCircle2,
  HelpCircle,
  ExternalLink,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { formatCnpj } from '@/lib/financeCalculations'
import type {
  PlanoContaRecord,
  EmpresaRecord,
  MinhaEmpresaRecord,
  ContaRecord,
  CentroRecord,
  TipoDespesaRecord,
} from '@/types/finance'

export interface ModalRelatorioContasSemCodigoA4Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  planoContas: PlanoContaRecord[]
  selectedEmpresa?: EmpresaRecord | null
  selectedAno?: string | number
  minhaEmpresa?: MinhaEmpresaRecord | null
  contaMap: Map<string, ContaRecord>
  centroMap: Map<string, CentroRecord>
  tipoMap: Map<string, TipoDespesaRecord>
}

export function ModalRelatorioContasSemCodigoA4({
  open,
  onOpenChange,
  planoContas,
  selectedEmpresa,
  selectedAno,
  minhaEmpresa,
  contaMap,
  centroMap,
}: ModalRelatorioContasSemCodigoA4Props) {
  const dataEmissao = useMemo(() => {
    return new Date().toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    })
  }, [])

  // Estatísticas de cobertura
  const totalContas = planoContas.length
  const contasComCodigo = useMemo(
    () => planoContas.filter((p) => p.codigo_empresa && p.codigo_empresa.trim().length > 0),
    [planoContas],
  )
  const contasSemCodigo = useMemo(
    () => planoContas.filter((p) => !p.codigo_empresa || p.codigo_empresa.trim().length === 0),
    [planoContas],
  )
  const totalCom = contasComCodigo.length
  const totalSem = contasSemCodigo.length
  const pctCobertura = totalContas > 0 ? (totalCom / totalContas) * 100 : 0

  // Agrupamento por tipo/grupo contábil
  const contasSemCodigoAgrupadas = useMemo(() => {
    const grupos: Record<string, Array<{ plano: PlanoContaRecord; conta?: ContaRecord }>> = {
      Ativo: [],
      Passivo: [],
      Receita: [],
      Despesa: [],
      Outros: [],
    }

    contasSemCodigo.forEach((p) => {
      const c = contaMap.get(p.conta)
      const tipo = (c?.tipo || '').toLowerCase()

      if (tipo.includes('ativo')) {
        grupos.Ativo.push({ plano: p, conta: c })
      } else if (
        tipo.includes('passivo') ||
        tipo.includes('patrimonio') ||
        tipo.includes('patrimônio')
      ) {
        grupos.Passivo.push({ plano: p, conta: c })
      } else if (tipo.includes('receita')) {
        grupos.Receita.push({ plano: p, conta: c })
      } else if (tipo.includes('despesa') || tipo.includes('custo')) {
        grupos.Despesa.push({ plano: p, conta: c })
      } else {
        grupos.Outros.push({ plano: p, conta: c })
      }
    })

    return grupos
  }, [contasSemCodigo, contaMap])

  const hasMinhaEmpresa = !!(
    minhaEmpresa?.razao_social ||
    minhaEmpresa?.nome_fantasia ||
    minhaEmpresa?.contador_nome
  )

  const handlePrint = () => {
    window.print()
  }

  const handleExportCsv = () => {
    const nomeEmpresa = selectedEmpresa?.nome || 'empresa'
    const dataStr = new Date().toISOString().slice(0, 10)
    const fileName = `relatorio-contas-sem-codigo-${nomeEmpresa.replace(/\s+/g, '_')}-${dataStr}.csv`

    const escapeCsv = (val: string | number | undefined | null): string => {
      if (val === null || val === undefined) return ''
      const s = String(val)
      if (/[;"\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
      return s
    }

    const colunas = [
      'Grupo Contábil',
      'Código Interno',
      'Conta Contábil',
      'Tipo/Natureza',
      'Centro de Custo',
      'Descrição',
      'Status Código Empresa',
    ]

    const linhas: string[] = []
    linhas.push(colunas.map(escapeCsv).join(';'))

    Object.entries(contasSemCodigoAgrupadas).forEach(([grupo, itens]) => {
      itens.forEach(({ plano, conta }) => {
        const centro = centroMap.get(plano.centro)
        linhas.push(
          [
            grupo,
            plano.codigo || '',
            conta ? `${conta.codigo ? `${conta.codigo} - ` : ''}${conta.nome}` : '',
            conta?.tipo || '',
            centro ? `${centro.codigo ? `${centro.codigo} - ` : ''}${centro.nome}` : '',
            plano.descricao || '',
            'Pendente de Código',
          ]
            .map(escapeCsv)
            .join(';'),
        )
      })
    })

    const csvContent = '\uFEFF' + linhas.join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.setAttribute('download', fileName)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(link.href)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto p-0 gap-0 bg-slate-100/90 border-slate-300">
        {/* Barra superior de Ações no Modal (oculta na impressão) */}
        <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-xs border-b border-slate-200 px-6 py-3.5 flex flex-wrap items-center justify-between gap-3 shadow-2xs print:hidden">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#0B1F3A] text-white flex items-center justify-center">
              <FileText className="w-4 h-4 text-blue-400" />
            </div>
            <div>
              <DialogTitle className="text-sm font-bold text-[#0B1F3A]">
                Relatório de Contas sem Código da Empresa (A4)
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                Auditoria de conformidade cadastral e cobertura de conciliação automática
              </DialogDescription>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCsv}
              className="h-8 text-xs font-semibold gap-1 text-slate-700 hover:bg-slate-100"
              title="Exportar planilha CSV formatada em PT-BR"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              Exportar CSV
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="h-8 text-xs font-semibold"
            >
              Fechar
            </Button>
            <Button
              size="sm"
              onClick={handlePrint}
              className="h-8 text-xs font-bold bg-[#0B1F3A] hover:bg-blue-900 text-white gap-1.5 shadow-xs"
            >
              <Printer className="w-4 h-4" />
              Imprimir / Salvar PDF
            </Button>
          </div>
        </div>

        {/* Alerta se Minha Empresa não estiver preenchida */}
        {!hasMinhaEmpresa && (
          <div className="p-4 bg-amber-50 border-b border-amber-200 print:hidden">
            <Alert className="bg-white border-amber-300 text-amber-900 shadow-2xs">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-xs flex items-center justify-between gap-2 flex-wrap">
                <span>
                  <strong>Atenção:</strong> Os dados da sua consultoria (nome/logotipo) e do
                  contador responsável (CRC) podem ser configurados para constar no cabeçalho e
                  assinatura do laudo.
                </span>
                <Button
                  asChild
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900"
                >
                  <Link to="/minha-empresa" target="_blank" rel="noopener noreferrer">
                    Cadastrar Minha Empresa
                    <ExternalLink className="w-3 h-3 ml-1" />
                  </Link>
                </Button>
              </AlertDescription>
            </Alert>
          </div>
        )}

        {/* Folha do Documento A4 */}
        <div className="p-6 sm:p-10 bg-slate-100/60 flex justify-center print:p-0 print:bg-white">
          <div
            id="relatorio-sem-codigo-a4"
            className="w-full max-w-[800px] bg-white border border-slate-300 rounded-xl shadow-lg p-8 sm:p-12 text-slate-800 text-xs leading-relaxed space-y-6 print:border-none print:shadow-none print:p-0 print:m-0 print:max-w-none print:bg-white font-sans"
          >
            {/* CABEÇALHO CORPORATIVO FORMAL */}
            <header className="border-b-2 border-[#0B1F3A] pb-5 space-y-4">
              <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-[#0B1F3A] text-white flex items-center justify-center font-bold text-sm shadow-xs">
                    {minhaEmpresa?.nome_fantasia?.charAt(0) || 'C'}
                  </div>
                  <div>
                    <h4 className="text-sm font-extrabold text-[#0B1F3A]">
                      {minhaEmpresa?.razao_social ||
                        minhaEmpresa?.nome_fantasia ||
                        'Consultoria Econômico-Financeira & Controladoria'}
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      {minhaEmpresa?.cnpj
                        ? `CNPJ: ${formatCnpj(minhaEmpresa.cnpj)}`
                        : 'Serviços Especializados de Diagnóstico Contábil e Governança de Cadastros'}
                    </p>
                  </div>
                </div>

                <div className="text-right text-[11px] text-slate-500">
                  <span className="font-semibold text-slate-700 block">Data de Emissão</span>
                  <span>{dataEmissao}</span>
                </div>
              </div>

              {/* Título Principal */}
              <div className="text-center py-2 space-y-1">
                <Badge
                  variant="outline"
                  className="bg-amber-50 text-amber-800 border-amber-300 text-[10px] font-bold px-3 py-0.5 uppercase tracking-wider"
                >
                  Auditoria de Cadastros Contábeis
                </Badge>
                <h1 className="text-xl sm:text-2xl font-black text-[#0B1F3A] tracking-tight uppercase">
                  Relatório de Contas Sem Código da Empresa
                </h1>
                <p className="text-[11px] text-slate-500 max-w-lg mx-auto">
                  Mapeamento de lacunas no Plano de Contas para otimização do casamento automático
                  em balancetes e extratos
                </p>
              </div>

              {/* Quadro Informativo da Empresa Analisada */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-xs">
                <div className="space-y-1.5">
                  <div className="flex justify-between border-b border-slate-200/60 pb-1">
                    <span className="text-slate-500 font-semibold">Empresa Ativa:</span>
                    <strong className="text-[#0B1F3A] flex items-center gap-1">
                      <Building2 className="w-3.5 h-3.5 text-slate-400" />
                      {selectedEmpresa?.nome || '—'}
                    </strong>
                  </div>
                  <div className="flex justify-between border-b border-slate-200/60 pb-1">
                    <span className="text-slate-500 font-semibold">CNPJ:</span>
                    <span className="font-mono text-slate-800">
                      {selectedEmpresa?.cnpj ? formatCnpj(selectedEmpresa.cnpj) : '—'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-semibold">Segmento / Porte:</span>
                    <span className="text-slate-800 font-medium">
                      {selectedEmpresa?.segmento || 'Geral'}
                      {selectedEmpresa?.porte ? ` • ${selectedEmpresa.porte}` : ''}
                    </span>
                  </div>
                </div>

                <div className="space-y-1.5 sm:border-l sm:border-slate-200 sm:pl-3">
                  <div className="flex justify-between border-b border-slate-200/60 pb-1">
                    <span className="text-slate-500 font-semibold">Exercício Referência:</span>
                    <strong className="text-blue-700 font-bold">{selectedAno || 'Geral'}</strong>
                  </div>
                  <div className="flex justify-between border-b border-slate-200/60 pb-1">
                    <span className="text-slate-500 font-semibold">Responsável Técnico:</span>
                    <span className="text-slate-800 font-medium">
                      {minhaEmpresa?.contador_nome || 'Consultor / Auditor Responsável'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-semibold">Registro CRC:</span>
                    <span className="text-slate-800 font-medium">
                      {minhaEmpresa?.contador_crc
                        ? `CRC ${minhaEmpresa.contador_crc}${minhaEmpresa.contador_uf_crc ? `/${minhaEmpresa.contador_uf_crc}` : ''}`
                        : 'CRC Ativo'}
                    </span>
                  </div>
                </div>
              </div>
            </header>

            {/* QUADRO RESUMO DE COBERTURA */}
            <section className="space-y-3">
              <h2 className="text-sm font-bold text-[#0B1F3A] uppercase tracking-wide flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-md bg-[#0B1F3A] text-white flex items-center justify-center text-[10px] font-bold">
                  1
                </span>
                Quadro Resumo de Cobertura do Plano
              </h2>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                  <span className="text-[10px] text-slate-500 uppercase font-semibold block">
                    Total de Contas
                  </span>
                  <div className="flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-slate-400" />
                    <strong className="text-base font-black text-slate-900 font-mono">
                      {totalContas}
                    </strong>
                  </div>
                  <span className="text-[10px] text-slate-400">cadastradas</span>
                </div>

                <div className="p-3 rounded-xl bg-emerald-50/50 border border-emerald-200 space-y-1">
                  <span className="text-[10px] text-emerald-700 uppercase font-semibold block">
                    Contas COM Código
                  </span>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <strong className="text-base font-black text-emerald-800 font-mono">
                      {totalCom}
                    </strong>
                  </div>
                  <span className="text-[10px] text-emerald-600">conciliação rápida</span>
                </div>

                <div className="p-3 rounded-xl bg-amber-50/60 border border-amber-200 space-y-1">
                  <span className="text-[10px] text-amber-700 uppercase font-semibold block">
                    Contas SEM Código
                  </span>
                  <div className="flex items-center gap-1.5">
                    <HelpCircle className="w-4 h-4 text-amber-600" />
                    <strong className="text-base font-black text-amber-900 font-mono">
                      {totalSem}
                    </strong>
                  </div>
                  <span className="text-[10px] text-amber-700">necessitam atenção</span>
                </div>

                <div className="p-3 rounded-xl bg-blue-50/60 border border-blue-200 space-y-1">
                  <span className="text-[10px] text-blue-700 uppercase font-semibold block">
                    Taxa de Cobertura
                  </span>
                  <div className="flex items-center gap-1.5">
                    <Percent className="w-4 h-4 text-blue-600" />
                    <strong className="text-base font-black text-blue-900 font-mono">
                      {pctCobertura.toFixed(1)}%
                    </strong>
                  </div>
                  <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden mt-1">
                    <div
                      className="bg-blue-600 h-full rounded-full transition-all"
                      style={{ width: `${Math.min(100, Math.max(0, pctCobertura))}%` }}
                    />
                  </div>
                </div>
              </div>
            </section>

            {/* TABELA DE CONTAS SEM CÓDIGO AGRUPADAS POR GRUPO/TIPO */}
            <section className="space-y-4">
              <div className="border-b border-slate-200 pb-1.5 flex items-center justify-between">
                <h2 className="text-sm font-bold text-[#0B1F3A] uppercase tracking-wide flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-md bg-[#0B1F3A] text-white flex items-center justify-center text-[10px] font-bold">
                    2
                  </span>
                  Detalhamento das Contas Sem Código ({totalSem})
                </h2>
                <Badge variant="outline" className="text-[10px] bg-slate-50 text-slate-600">
                  Agrupadas por Natureza Contábil
                </Badge>
              </div>

              {totalSem === 0 ? (
                <div className="p-6 bg-emerald-50 border border-emerald-200 rounded-xl text-center space-y-2">
                  <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
                  <h4 className="font-bold text-emerald-900 text-sm">
                    Excelente! 100% das contas possuem Código da Empresa
                  </h4>
                  <p className="text-emerald-700 text-xs max-w-md mx-auto">
                    Todas as contas contábeis cadastradas contam com código correlato da empresa,
                    garantindo o maior nível de precisão no casamento automatizado de importações.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {(
                    Object.entries(contasSemCodigoAgrupadas) as Array<
                      [string, Array<{ plano: PlanoContaRecord; conta?: ContaRecord }>]
                    >
                  ).map(([grupo, itens]) => {
                    if (itens.length === 0) return null

                    return (
                      <div
                        key={grupo}
                        className="border border-slate-200 rounded-lg overflow-hidden bg-white shadow-2xs"
                      >
                        <div className="bg-slate-100/90 px-3 py-2 border-b border-slate-200 flex items-center justify-between">
                          <span className="font-bold text-xs text-[#0B1F3A] uppercase tracking-wide">
                            Grupo {grupo}
                          </span>
                          <Badge variant="secondary" className="text-[10px]">
                            {itens.length} {itens.length === 1 ? 'conta' : 'contas'}
                          </Badge>
                        </div>
                        <table className="w-full text-[11px] text-left border-collapse">
                          <thead>
                            <tr className="bg-slate-50/70 text-slate-600 border-b border-slate-200 text-[10px] uppercase font-semibold">
                              <th className="py-2 px-3 w-28">Cód. Interno</th>
                              <th className="py-2 px-3">Conta Contábil / Nome</th>
                              <th className="py-2 px-3 w-40">Centro de Custo</th>
                              <th className="py-2 px-3 w-44">Descrição</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {itens.map(({ plano, conta }) => {
                              const centro = centroMap.get(plano.centro)
                              return (
                                <tr key={plano.id} className="hover:bg-slate-50/60">
                                  <td className="py-2 px-3 font-mono font-medium text-slate-700">
                                    {plano.codigo || '—'}
                                  </td>
                                  <td className="py-2 px-3">
                                    <div className="font-semibold text-slate-900">
                                      {conta?.nome || '—'}
                                    </div>
                                    {conta?.codigo && (
                                      <span className="text-[10px] text-slate-400 font-mono">
                                        Ref: {conta.codigo}
                                      </span>
                                    )}
                                  </td>
                                  <td className="py-2 px-3 text-slate-600">
                                    {centro?.nome || '—'}
                                  </td>
                                  <td className="py-2 px-3 text-slate-500 italic">
                                    {plano.descricao || '—'}
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    )
                  })}
                </div>
              )}
            </section>

            {/* RECOMENDAÇÃO EXECUTIVA */}
            <section className="space-y-2">
              <h2 className="text-sm font-bold text-[#0B1F3A] uppercase tracking-wide flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-md bg-[#0B1F3A] text-white flex items-center justify-center text-[10px] font-bold">
                  3
                </span>
                Recomendação Executiva de Governança
              </h2>

              <div className="bg-blue-50/60 border border-blue-200 rounded-xl p-4 text-xs text-blue-950 space-y-2">
                <p className="font-semibold">Por que o Código da Conta da Empresa é fundamental?</p>
                <ul className="list-disc list-inside space-y-1 text-slate-700">
                  <li>
                    <strong>Casamento Instantâneo nas Importações:</strong> Ao importar balancetes
                    em PDF ou planilhas Excel, o sistema analisa os códigos das linhas do documento
                    e os relaciona com exatidão máxima de 100% diretamente ao plano cadastrado.
                  </li>
                  <li>
                    <strong>Aprendizagem Contínua:</strong> Vínculos ajustados manualmente são
                    gravados automaticamente e reaproveitados em conciliações futuras para a mesma
                    empresa.
                  </li>
                  <li>
                    <strong>Prevenção de Inconsistências:</strong> Elimina ambiguidades causadas por
                    contas homônimas ou descrições abreviadas no software contábil externo do
                    cliente.
                  </li>
                </ul>
                <p className="text-[11px] text-slate-600 pt-1">
                  <strong>Ação Sugerida:</strong> Utilize o recurso{' '}
                  <em>"Edição em Lote de Códigos"</em> na tela de Plano de Contas para preencher os
                  códigos das contas listadas acima em poucos minutos.
                </p>
              </div>
            </section>

            {/* ASSINATURA TÉCNICA */}
            <footer className="pt-8 space-y-6 border-t border-slate-200">
              <div className="pt-4 flex flex-col items-center justify-center text-center space-y-1">
                <div className="w-64 border-t border-slate-400 pt-2 font-bold text-slate-800 text-xs">
                  {minhaEmpresa?.contador_nome || 'Consultor / Contador Responsável'}
                </div>
                <div className="text-[11px] text-slate-500">
                  {minhaEmpresa?.contador_crc
                    ? `CRC: ${minhaEmpresa.contador_crc}${minhaEmpresa.contador_uf_crc ? `/${minhaEmpresa.contador_uf_crc}` : ''}`
                    : 'Responsável Técnico pela Controladoria'}
                </div>
                <div className="text-[10px] text-slate-400">
                  {minhaEmpresa?.razao_social || minhaEmpresa?.nome_fantasia || 'Consultoria'}
                </div>
              </div>
            </footer>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
