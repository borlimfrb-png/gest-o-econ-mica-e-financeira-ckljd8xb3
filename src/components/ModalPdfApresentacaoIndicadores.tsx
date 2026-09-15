import { useState, useMemo } from 'react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Printer, X, Building, Calendar, Info } from 'lucide-react'
import { DocumentPrintFooter } from '@/components/DocumentPrintFooter'
import { useMinhaEmpresa } from '@/contexts/MinhaEmpresaContext'
import {
  CATALOGO_INDICADORES,
  CATEGORIAS_INDICADORES,
  type ContextoCalculoIndicadores,
} from '@/lib/catalogoApresentacaoIndicadores'
import { calcularDiagnosticoRadar } from '@/lib/diagnosticoRadarApresentacao'

export interface ModalPdfApresentacaoIndicadoresProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  contexto: ContextoCalculoIndicadores
  empresaNome: string
  ano: number
}

export function ModalPdfApresentacaoIndicadores({
  open,
  onOpenChange,
  contexto,
  empresaNome,
  ano,
}: ModalPdfApresentacaoIndicadoresProps) {
  const { minhaEmpresa } = useMinhaEmpresa()
  const [imprimindo, setImprimindo] = useState(false)

  const handlePrint = () => {
    setImprimindo(true)
    setTimeout(() => {
      window.print()
      setImprimindo(false)
    }, 250)
  }

  const diagnosticoRadar = useMemo(() => {
    return calcularDiagnosticoRadar(contexto)
  }, [contexto])

  // Agrupa os indicadores por categoria
  const categoriasComIndicadores = CATEGORIAS_INDICADORES.map((cat) => {
    const itens = CATALOGO_INDICADORES.filter((ind) => ind.categoria === cat.id)
    return {
      categoria: cat,
      itens,
    }
  }).filter((grp) => grp.itens.length > 0)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto p-0 print:p-0 print:border-none print:shadow-none print:max-w-none print:max-h-none">
        {/* Barra superior de ações na tela (oculta na impressão) */}
        <div className="sticky top-0 z-20 flex items-center justify-between border-b bg-background/95 px-6 py-3 backdrop-blur print:hidden">
          <div className="flex items-center gap-2">
            <DialogTitle className="text-lg font-semibold text-foreground">
              Guia & Apresentação de Indicadores Financeiros (A4)
            </DialogTitle>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="default"
              size="sm"
              onClick={handlePrint}
              disabled={imprimindo}
              className="gap-2 bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm"
            >
              <Printer className="h-4 w-4" />
              Imprimir / Salvar PDF
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onOpenChange(false)}
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* CONTEÚDO IMPRESSO (A4 FORMAT) */}
        <div
          id="relatorio-a4-apresentacao"
          className="mx-auto w-full max-w-[800px] p-6 text-slate-800 text-sm print:max-w-none print:p-8 print:text-black"
        >
          {/* Cabeçalho Institucional da Consultoria */}
          <div className="mb-6 border-b-2 border-slate-900 pb-4 flex items-start justify-between">
            <div className="flex items-start gap-4">
              {minhaEmpresa?.logo_url ? (
                <img
                  src={minhaEmpresa.logo_url}
                  alt={minhaEmpresa.nome_fantasia || 'Consultoria'}
                  className="h-14 w-auto object-contain rounded"
                />
              ) : (
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-emerald-600 font-bold text-white shadow-sm">
                  <Building className="h-6 w-6" />
                </div>
              )}
              <div>
                <h1 className="text-xl font-bold text-slate-900">
                  {minhaEmpresa?.nome_fantasia ||
                    minhaEmpresa?.razao_social ||
                    'GESTÃO FINANCEIRA E ESTRATÉGICA'}
                </h1>
                <p className="text-xs text-slate-500">
                  {minhaEmpresa?.cnpj ? `CNPJ: ${minhaEmpresa.cnpj} • ` : ''}
                  {minhaEmpresa?.cidade ? `${minhaEmpresa.cidade}/${minhaEmpresa.uf} • ` : ''}
                  {minhaEmpresa?.telefone || minhaEmpresa?.email || 'Relatório Consultivo Oficial'}
                </p>
                <p className="text-sm font-semibold text-emerald-700 mt-1">
                  Guia Metodológico e Diagnóstico dos Indicadores de Gestão
                </p>
              </div>
            </div>

            <div className="text-right text-xs text-slate-500">
              <div className="font-semibold text-slate-800 text-sm">Ano Base: {ano}</div>
              <div className="flex items-center justify-end gap-1 text-slate-600 mt-0.5">
                <Calendar className="h-3 w-3" />
                {new Date().toLocaleDateString('pt-BR')}
              </div>
              <div className="mt-1 inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 font-medium text-slate-800">
                {empresaNome || 'Empresa Geral'}
              </div>
            </div>
          </div>

          {/* Sumário Consultivo de Introdução */}
          <div className="mb-6 rounded-lg border border-slate-200 bg-slate-50/50 p-4 text-xs leading-relaxed text-slate-700 print:bg-transparent">
            <h2 className="text-sm font-bold text-slate-900 mb-1 flex items-center gap-1.5">
              <Info className="h-4 w-4 text-emerald-600" />
              Apresentação Metodológica para Decisores
            </h2>
            <p>
              Este documento consolida o framework completo de indicadores econômico-financeiros da
              empresa, detalhando o significado técnico de cada indicador, a fórmula adotada, as
              faixas de normalidade de mercado e os valores apurados com base no fechamento contábil
              e operacional.
            </p>
          </div>

          {/* DIAGNÓSTICO DO RADAR: TABELA DE SAÚDE POR CATEGORIA (A4) */}
          <div className="mb-6 rounded-lg border border-slate-300 p-4 bg-white break-inside-avoid">
            <div className="flex items-center justify-between border-b pb-2 mb-3">
              <div>
                <h2 className="text-sm font-bold text-slate-900">
                  Diagnóstico 360° por Categoria (Radar de Desempenho)
                </h2>
                <p className="text-[11px] text-slate-500">
                  Pontuação consolidada (0 a 100) derivada do grau de atingimento das faixas ideais
                </p>
              </div>
              <div className="text-right">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">
                  Score Global
                </span>
                <span className="text-base font-black text-emerald-700">
                  {diagnosticoRadar.scoreGeralAtual !== null
                    ? `${diagnosticoRadar.scoreGeralAtual} pts`
                    : 'Sem apuração'}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {diagnosticoRadar.itens.map((item) => {
                const corBadge =
                  item.statusSaude === 'forte'
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                    : item.statusSaude === 'moderado'
                      ? 'border-amber-300 bg-amber-50 text-amber-800'
                      : item.statusSaude === 'fragil'
                        ? 'border-rose-300 bg-rose-50 text-rose-800'
                        : 'border-slate-200 bg-slate-50 text-slate-600'

                const labelSaude =
                  item.statusSaude === 'forte'
                    ? 'Força'
                    : item.statusSaude === 'moderado'
                      ? 'Atenção'
                      : item.statusSaude === 'fragil'
                        ? 'Fragilidade'
                        : 'Sem dados'

                return (
                  <div
                    key={item.categoriaId}
                    className={`rounded border p-2 text-xs flex flex-col justify-between ${corBadge}`}
                  >
                    <div>
                      <div className="font-bold text-slate-900 line-clamp-1">
                        {item.categoriaNomeCurto}
                      </div>
                      <div className="text-[10px] opacity-75">{labelSaude}</div>
                    </div>
                    <div className="mt-1 flex items-baseline justify-between pt-1 border-t border-black/10">
                      <span className="text-[10px] font-mono opacity-80">
                        {item.indicadoresIdeais}/{item.totalIndicadores} ideais
                      </span>
                      <strong className="font-mono text-sm">
                        {item.scoreAtual !== null ? `${item.scoreAtual} pts` : '—'}
                      </strong>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Seções por Categoria */}
          <div className="space-y-6">
            {categoriasComIndicadores.map(({ categoria, itens }) => (
              <div key={categoria.id} className="break-inside-avoid">
                {/* Título da Categoria */}
                <div className="border-b border-emerald-600/40 pb-1 mb-3">
                  <h3 className="text-base font-bold text-slate-900 flex items-center justify-between">
                    <span>{categoria.nome}</span>
                    <span className="text-xs font-normal text-slate-500">
                      {itens.length} métricas
                    </span>
                  </h3>
                  <p className="text-xs text-slate-600 mt-0.5">{categoria.descricao}</p>
                </div>

                {/* Grid dos Indicadores */}
                <div className="space-y-3">
                  {itens.map((ind) => {
                    const extraido = ind.extrairValor(contexto)
                    const statusCor =
                      extraido.faixaStatus === 'verde'
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                        : extraido.faixaStatus === 'ambar'
                          ? 'bg-amber-50 text-amber-800 border-amber-300'
                          : extraido.faixaStatus === 'vermelho'
                            ? 'bg-rose-50 text-rose-800 border-rose-300'
                            : 'bg-slate-50 text-slate-600 border-slate-200'

                    return (
                      <div
                        key={ind.id}
                        className="rounded-lg border border-slate-200 p-3 bg-white print:border-slate-300 break-inside-avoid"
                      >
                        <div className="flex items-start justify-between gap-2 mb-1.5">
                          <div>
                            <span className="text-sm font-bold text-slate-900">
                              {ind.nome}{' '}
                              <span className="text-xs font-semibold text-slate-500">
                                ({ind.sigla})
                              </span>
                            </span>
                            <div className="text-xs font-mono text-slate-600 mt-0.5 bg-slate-100/80 px-2 py-0.5 rounded inline-block">
                              Fórmula: {ind.formulaLegivel}
                            </div>
                          </div>

                          {/* Valor da Empresa */}
                          <div
                            className={`px-2.5 py-1 rounded border text-right text-xs font-bold ${statusCor}`}
                          >
                            <div className="text-[10px] uppercase font-medium opacity-80">
                              Empresa ({ano})
                            </div>
                            <div className="text-sm font-black">{extraido.textoExibicao}</div>
                            {extraido.textoComparacao && (
                              <div className="text-[10px] font-medium opacity-90">
                                {extraido.textoComparacao}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* O que mede & Interpretação */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-slate-700 mt-2">
                          <div>
                            <span className="font-semibold text-slate-900">O que mede: </span>
                            {ind.oQueMede}
                          </div>
                          <div>
                            <span className="font-semibold text-slate-900">Como interpretar: </span>
                            {ind.comoInterpretar}
                          </div>
                        </div>

                        {/* Faixas e Dica */}
                        <div className="mt-2.5 pt-2 border-t border-slate-100 flex flex-col md:flex-row gap-2 justify-between text-[11px]">
                          <div className="space-y-0.5 text-slate-600">
                            <div>
                              <span className="font-semibold text-emerald-700">● Ideal:</span>{' '}
                              {ind.faixas.ideal}
                            </div>
                            <div>
                              <span className="font-semibold text-amber-700">● Atenção:</span>{' '}
                              {ind.faixas.atencao}
                            </div>
                            <div>
                              <span className="font-semibold text-rose-700">● Crítico:</span>{' '}
                              {ind.faixas.critico}
                            </div>
                          </div>
                          <div className="md:max-w-xs bg-emerald-50/70 p-1.5 rounded text-emerald-900 border border-emerald-100">
                            <span className="font-bold">Recomendação Consultiva:</span>{' '}
                            {ind.dicaPratica}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Rodapé Institucional */}
          <div className="mt-8 border-t border-slate-300 pt-3 flex items-center justify-between text-[11px] text-slate-500">
            <div>
              Relatório emitido pela plataforma de Governança e Inteligência Financeira • Todos os
              direitos reservados.
            </div>
            <div>Página Oficial de Apresentação de Indicadores</div>
          </div>

          {/* Rodapé fixo formal na impressão */}
          <DocumentPrintFooter
            documentTitle="Guia Metodológico & Apresentação de Indicadores Financeiros"
            empresaNome={empresaNome}
            exercicioAno={ano}
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}
