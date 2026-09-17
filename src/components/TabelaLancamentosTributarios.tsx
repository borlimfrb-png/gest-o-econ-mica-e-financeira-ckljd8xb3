import React, { useState } from 'react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from '@/components/ui/table'
import {
  ShoppingCart,
  TrendingUp,
  Plus,
  Search,
  Filter,
  Edit2,
  Trash2,
  Calendar,
  Layers,
  ArrowDownLeft,
  ArrowUpRight,
  RotateCcw,
} from 'lucide-react'
import type { TipoLancamentoTributario, TributoLancamentoRecord } from '@/types/finance'
import { formatCurrency, formatPercent } from '@/lib/financeCalculations'

interface TabelaLancamentosTributariosProps {
  tipo: TipoLancamentoTributario
  lancamentos: TributoLancamentoRecord[]
  loading: boolean
  ano: number
  onNovo: () => void
  onEditar: (item: TributoLancamentoRecord) => void
  onExcluir: (id: string) => void
  onRecarregar: () => void
}

export function TabelaLancamentosTributarios({
  tipo,
  lancamentos,
  loading,
  ano,
  onNovo,
  onEditar,
  onExcluir,
  onRecarregar,
}: TabelaLancamentosTributariosProps) {
  const isEntrada = tipo === 'entrada'
  const [busca, setBusca] = useState('')
  const [mesFiltro, setMesFiltro] = useState<string>('todos')

  // Filtragem local
  const filtrados = lancamentos.filter((item) => {
    if (busca.trim()) {
      const termo = busca.toLowerCase()
      const matchFornec = item.fornecedor_tomador?.toLowerCase().includes(termo)
      const matchNota = item.numero_nota?.toLowerCase().includes(termo)
      const matchCfop = item.cfop?.toLowerCase().includes(termo)
      const matchCnpj = item.cnpj_cpf?.toLowerCase().includes(termo)
      if (!matchFornec && !matchNota && !matchCfop && !matchCnpj) return false
    }

    if (mesFiltro !== 'todos') {
      const mesNum = parseInt(mesFiltro, 10)
      if (item.data) {
        const d = new Date(item.data)
        if (d.getUTCMonth() + 1 !== mesNum) return false
      }
    }

    return true
  })

  // Totais do rodapé
  const totais = filtrados.reduce(
    (acc, curr) => {
      acc.valorMercadoria += Number(curr.valor_mercadoria) || 0
      acc.valorIcms += Number(curr.valor_icms) || 0
      acc.valorIpi += Number(curr.valor_ipi) || 0
      acc.valorPis += Number(curr.valor_pis) || 0
      acc.valorCofins += Number(curr.valor_cofins) || 0
      return acc
    },
    {
      valorMercadoria: 0,
      valorIcms: 0,
      valorIpi: 0,
      valorPis: 0,
      valorCofins: 0,
    },
  )

  const totalImpostos = totais.valorIcms + totais.valorIpi + totais.valorPis + totais.valorCofins

  return (
    <Card className="rounded-2xl border-slate-200 bg-white shadow-xs overflow-hidden">
      <CardHeader className="pb-4 bg-slate-50/70 border-b border-slate-100">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div
              className={`w-9 h-9 rounded-xl text-white flex items-center justify-center shadow-xs ${
                isEntrada ? 'bg-amber-600' : 'bg-blue-600'
              }`}
            >
              {isEntrada ? (
                <ShoppingCart className="w-5 h-5" />
              ) : (
                <TrendingUp className="w-5 h-5" />
              )}
            </div>
            <div>
              <CardTitle className="text-base font-bold text-[#0B1F3A] flex items-center gap-2">
                <span>
                  {isEntrada
                    ? 'Lançamentos de Entradas (Compras)'
                    : 'Lançamentos de Saídas (Vendas)'}
                </span>
                <Badge
                  variant="outline"
                  className={
                    isEntrada
                      ? 'bg-amber-50 text-amber-800 border-amber-300 font-bold'
                      : 'bg-blue-50 text-blue-800 border-blue-300 font-bold'
                  }
                >
                  {isEntrada ? 'Gera Créditos Fiscais' : 'Gera Débitos Fiscais'}
                </Badge>
              </CardTitle>
              <CardDescription className="text-xs">
                {isEntrada
                  ? `Notas fiscais de compras, matérias-primas e insumos no exercício de ${ano}`
                  : `Notas fiscais de vendas e faturamento de produtos e serviços no exercício de ${ano}`}
              </CardDescription>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={onRecarregar}
              disabled={loading}
              className="h-8 text-xs border-slate-200 text-slate-700 hover:bg-slate-100"
            >
              <RotateCcw className="w-3.5 h-3.5 mr-1 text-slate-500" />
              Atualizar
            </Button>
            <Button
              size="sm"
              onClick={onNovo}
              className={`h-8 text-xs font-bold text-white shadow-xs gap-1.5 ${
                isEntrada ? 'bg-amber-600 hover:bg-amber-700' : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              <Plus className="w-4 h-4" />
              {isEntrada ? 'Lançar Compra / Entrada' : 'Lançar Venda / Saída'}
            </Button>
          </div>
        </div>

        {/* Barra de Filtros: Busca e Mês */}
        <div className="pt-3 flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              placeholder={`Filtrar por ${isEntrada ? 'fornecedor' : 'cliente/tomador'}, nota fiscal, CFOP ou CNPJ...`}
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="pl-9 h-8 text-xs bg-white"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={mesFiltro}
              onChange={(e) => setMesFiltro(e.target.value)}
              className="h-8 text-xs rounded-md border border-slate-200 bg-white px-2.5 font-medium text-slate-700"
            >
              <option value="todos">Todos os Meses ({ano})</option>
              <option value="1">Janeiro</option>
              <option value="2">Fevereiro</option>
              <option value="3">Março</option>
              <option value="4">Abril</option>
              <option value="5">Maio</option>
              <option value="6">Junho</option>
              <option value="7">Julho</option>
              <option value="8">Agosto</option>
              <option value="9">Setembro</option>
              <option value="10">Outubro</option>
              <option value="11">Novembro</option>
              <option value="12">Dezembro</option>
            </select>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-500">
            Carregando lançamentos fiscais...
          </div>
        ) : filtrados.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div
              className={`w-12 h-12 rounded-2xl mx-auto flex items-center justify-center ${
                isEntrada ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
              }`}
            >
              {isEntrada ? (
                <ShoppingCart className="w-6 h-6" />
              ) : (
                <TrendingUp className="w-6 h-6" />
              )}
            </div>
            <h4 className="text-sm font-bold text-[#0B1F3A]">
              Nenhum lançamento de {isEntrada ? 'entrada (compras)' : 'saída (vendas)'} encontrado
            </h4>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              {isEntrada
                ? 'Registre as compras de mercadorias, insumos e notas de entrada para apuração automática de créditos de ICMS, IPI, PIS e COFINS.'
                : 'Registre as notas fiscais de saídas para apuração dos débitos de impostos e apuração tributária nos regimes Simples Nacional, Presumido e Real.'}
            </p>
            <Button
              size="sm"
              onClick={onNovo}
              className={`text-xs font-bold text-white shadow-xs ${
                isEntrada ? 'bg-amber-600 hover:bg-amber-700' : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              <Plus className="w-4 h-4 mr-1.5" />
              {isEntrada ? 'Cadastrar Primeira Compra' : 'Cadastrar Primeira Venda'}
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
                  <TableHead className="text-xs font-bold text-slate-700 py-3">Data</TableHead>
                  <TableHead className="text-xs font-bold text-slate-700">
                    {isEntrada ? 'Fornecedor' : 'Tomador / Cliente'}
                  </TableHead>
                  <TableHead className="text-xs font-bold text-slate-700">NF-e / CFOP</TableHead>
                  <TableHead className="text-xs font-bold text-slate-700 text-right">
                    Valor Mercadoria (R$)
                  </TableHead>
                  <TableHead className="text-xs font-bold text-blue-900 text-right">
                    ICMS ({isEntrada ? 'Créd.' : 'Déb.'})
                  </TableHead>
                  <TableHead className="text-xs font-bold text-purple-900 text-right">
                    IPI ({isEntrada ? 'Créd.' : 'Déb.'})
                  </TableHead>
                  <TableHead className="text-xs font-bold text-emerald-900 text-right">
                    PIS ({isEntrada ? 'Créd.' : 'Déb.'})
                  </TableHead>
                  <TableHead className="text-xs font-bold text-indigo-900 text-right">
                    COFINS ({isEntrada ? 'Créd.' : 'Déb.'})
                  </TableHead>
                  <TableHead className="text-xs font-bold text-slate-700 text-center w-[90px]">
                    Ações
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-slate-100">
                {filtrados.map((item) => {
                  const dataFmt = item.data
                    ? new Date(item.data).toLocaleDateString('pt-BR', { timeZone: 'UTC' })
                    : '—'
                  const vm = Number(item.valor_mercadoria) || 0
                  const icms = Number(item.valor_icms) || 0
                  const ipi = Number(item.valor_ipi) || 0
                  const pis = Number(item.valor_pis) || 0
                  const cofins = Number(item.valor_cofins) || 0

                  return (
                    <TableRow key={item.id} className="hover:bg-slate-50/60 text-xs">
                      <TableCell className="font-medium text-slate-800 whitespace-nowrap">
                        {dataFmt}
                      </TableCell>
                      <TableCell>
                        <div className="font-semibold text-slate-900">
                          {item.fornecedor_tomador}
                        </div>
                        {item.cnpj_cpf && (
                          <div className="text-[10px] text-slate-400 font-mono">
                            {item.cnpj_cpf}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-slate-800">
                            {item.numero_nota || 'S/N'}
                          </span>
                          {item.cfop && (
                            <Badge variant="outline" className="text-[10px] py-0 px-1 font-mono">
                              {item.cfop}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-bold text-slate-900 whitespace-nowrap">
                        {formatCurrency(vm)}
                      </TableCell>
                      <TableCell className="text-right font-semibold text-blue-900 whitespace-nowrap">
                        {formatCurrency(icms)}
                        <span className="text-[10px] text-slate-400 block font-normal">
                          {item.aliquota_icms !== undefined ? `${item.aliquota_icms}%` : ''}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-semibold text-purple-900 whitespace-nowrap">
                        {formatCurrency(ipi)}
                        <span className="text-[10px] text-slate-400 block font-normal">
                          {item.aliquota_ipi !== undefined ? `${item.aliquota_ipi}%` : ''}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-semibold text-emerald-900 whitespace-nowrap">
                        {formatCurrency(pis)}
                        <span className="text-[10px] text-slate-400 block font-normal">
                          {item.aliquota_pis !== undefined ? `${item.aliquota_pis}%` : ''}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-semibold text-indigo-900 whitespace-nowrap">
                        {formatCurrency(cofins)}
                        <span className="text-[10px] text-slate-400 block font-normal">
                          {item.aliquota_cofins !== undefined ? `${item.aliquota_cofins}%` : ''}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => onEditar(item)}
                            className="h-7 w-7 text-slate-500 hover:text-blue-600 hover:bg-blue-50"
                            title="Editar lançamento"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              if (
                                window.confirm(
                                  `Deseja realmente excluir o lançamento de "${item.fornecedor_tomador}"?`,
                                )
                              ) {
                                onExcluir(item.id)
                              }
                            }}
                            className="h-7 w-7 text-slate-500 hover:text-red-600 hover:bg-red-50"
                            title="Excluir lançamento"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
              {/* Rodapé com Totais Consolidados */}
              <tfoot>
                <TableRow className="bg-slate-100 font-extrabold text-slate-900 border-t-2 border-slate-300 text-xs">
                  <TableCell colSpan={3} className="py-3">
                    TOTALIZADOR ({filtrados.length}{' '}
                    {filtrados.length === 1 ? 'registro' : 'registros'})
                  </TableCell>
                  <TableCell className="text-right py-3 text-[#0B1F3A]">
                    {formatCurrency(totais.valorMercadoria)}
                  </TableCell>
                  <TableCell className="text-right py-3 text-blue-900">
                    {formatCurrency(totais.valorIcms)}
                  </TableCell>
                  <TableCell className="text-right py-3 text-purple-900">
                    {formatCurrency(totais.valorIpi)}
                  </TableCell>
                  <TableCell className="text-right py-3 text-emerald-900">
                    {formatCurrency(totais.valorPis)}
                  </TableCell>
                  <TableCell className="text-right py-3 text-indigo-900">
                    {formatCurrency(totais.valorCofins)}
                  </TableCell>
                  <TableCell className="text-center text-[10px] text-slate-500">
                    Total: {formatCurrency(totalImpostos)}
                  </TableCell>
                </TableRow>
              </tfoot>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
