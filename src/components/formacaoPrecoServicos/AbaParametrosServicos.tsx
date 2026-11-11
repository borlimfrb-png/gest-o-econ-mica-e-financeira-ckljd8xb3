import { useState } from 'react'
import { useToast } from '@/hooks/use-toast'
import {
  formacaoPrecoServicosService,
  type FormacaoServicoParametrosRecord,
} from '@/services/formacaoPrecoServicosService'
import type { ParametrosFormacaoServicos } from '@/lib/formacaoPrecoServicosCalculo'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Plus, Save, Trash2 } from 'lucide-react'

interface Props {
  parametros: FormacaoServicoParametrosRecord
  empresaId: string
  recalculo: {
    custosFixosMensais: number
    horasProdutivasMes: number
    custoHoraTecnica: number
  }
}

interface CustosFixosState {
  nome: string
  valor: string
}

const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const fmtNum = (v: number, casas = 2) => v.toLocaleString('pt-BR', { maximumFractionDigits: casas })
const toNumberBR = (v: string): number => {
  if (!v) return 0
  const normalized = v
    .replace(/\s|R\$/g, '')
    .replace(/\./g, '')
    .replace(',', '.')
  const n = Number(normalized)
  return Number.isFinite(n) ? n : Number(v) || 0
}

export default function AbaParametrosServicos({ parametros, empresaId, recalculo }: Props) {
  const { toast } = useToast()
  const [saving, setSaving] = useState(false)

  // Estado local editável; inicializa com os dados carregados da coleção
  const [custosFixos, setCustosFixos] = useState<CustosFixosState[]>(
    (parametros.custos_fixos || []).map((c) => ({
      nome: c?.nome || '',
      valor: c?.valor != null ? String(c.valor) : '',
    })),
  )
  const [quantidadeProfissionais, setQuantidadeProfissionais] = useState<string>(
    String(parametros.quantidade_profissionais ?? ''),
  )
  const [horasProdutivasProfissional, setHorasProdutivasProfissional] = useState<string>(
    String(parametros.horas_produtivas_profissional ?? ''),
  )
  const [fatorOciosidade, setFatorOciosidade] = useState<string>(
    String(parametros.fator_ociosidade ?? ''),
  )
  const [impostos, setImpostos] = useState<string>(String(parametros.percentual_impostos ?? ''))
  const [comissao, setComissao] = useState<string>(String(parametros.percentual_comissao ?? ''))
  const [margem, setMargem] = useState<string>(String(parametros.percentual_margem ?? ''))

  const totalCustosFixos = custosFixos.reduce((acc, c) => acc + (toNumberBR(c.valor) || 0), 0)

  const totalPerc = toNumberBR(impostos) + toNumberBR(comissao) + toNumberBR(margem)
  const markupDivisor = totalPerc < 100 ? 1 / (1 - totalPerc / 100) : 0

  const handleSalvar = async () => {
    try {
      setSaving(true)
      const payload: ParametrosFormacaoServicos = {
        custos_fixos: custosFixos
          .filter((c) => c.nome.trim() !== '')
          .map((c) => ({ nome: c.nome.trim(), valor: toNumberBR(c.valor) })),
        quantidade_profissionais: Math.max(Math.round(toNumberBR(quantidadeProfissionais)), 0),
        horas_produtivas_profissional: toNumberBR(horasProdutivasProfissional),
        fator_ociosidade: toNumberBR(fatorOciosidade),
        percentual_impostos: toNumberBR(impostos),
        percentual_comissao: toNumberBR(comissao),
        percentual_margem: toNumberBR(margem),
      }
      await formacaoPrecoServicosService.salvarParametros(empresaId, payload, parametros.id)
      toast({
        title: 'Parâmetros salvos',
        description: 'O Custo/Hora Técnica e o mark-up foram recalculados.',
      })
    } catch (err) {
      console.error('Erro ao salvar parâmetros:', err)
      toast({
        variant: 'destructive',
        title: 'Erro ao salvar',
        description: 'Não foi possível salvar os parâmetros.',
      })
    } finally {
      setSaving(false)
    }
  }

  const addCustoFixo = () => setCustosFixos((prev) => [...prev, { nome: '', valor: '' }])
  const removeCustoFixo = (i: number) =>
    setCustosFixos((prev) => prev.filter((_, idx) => idx !== i))

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="flex flex-col gap-4 lg:col-span-2">
        {/* Custos fixos */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Custos Fixos Mensais</CardTitle>
            <CardDescription>
              Salários, aluguel, softwares, contabilidade e demais despesas fixas do mês.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {custosFixos.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Nenhum custo fixo cadastrado. Clique em “Adicionar custo fixo”.
              </p>
            )}
            {custosFixos.map((item, i) => (
              <div key={i} className="flex gap-2">
                <Input
                  placeholder="Descrição (ex.: Aluguel)"
                  value={item.nome}
                  onChange={(e) => {
                    const v = e.target.value
                    setCustosFixos((prev) =>
                      prev.map((c, idx) => (idx === i ? { ...c, nome: v } : c)),
                    )
                  }}
                />
                <Input
                  placeholder="Valor (R$)"
                  className="max-w-[180px]"
                  value={item.valor}
                  onChange={(e) => {
                    const v = e.target.value
                    setCustosFixos((prev) =>
                      prev.map((c, idx) => (idx === i ? { ...c, valor: v } : c)),
                    )
                  }}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeCustoFixo(i)}
                  aria-label="Remover"
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
            <div className="flex items-center justify-between">
              <Button variant="outline" size="sm" onClick={addCustoFixo}>
                <Plus className="mr-2 h-4 w-4" /> Adicionar custo fixo
              </Button>
              <span className="text-sm font-medium">Total: {fmtBRL(totalCustosFixos)}</span>
            </div>
          </CardContent>
        </Card>

        {/* Capacidade produtiva */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Capacidade Produtiva</CardTitle>
            <CardDescription>
              Profissionais, horas produtivas por profissional no mês e % de ociosidade (reuniões,
              vendas, deslocamentos).
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="qtd-profissionais">Quantidade de profissionais</Label>
              <Input
                id="qtd-profissionais"
                type="number"
                step="1"
                min="0"
                value={quantidadeProfissionais}
                onChange={(e) => setQuantidadeProfissionais(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="horas-produtivas">Horas produtivas/profissional (mês)</Label>
              <Input
                id="horas-produtivas"
                type="number"
                step="0.5"
                min="0"
                value={horasProdutivasProfissional}
                onChange={(e) => setHorasProdutivasProfissional(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="fator-ociosidade">Fator de ociosidade (%)</Label>
              <Input
                id="fator-ociosidade"
                type="number"
                step="0.5"
                min="0"
                max="100"
                value={fatorOciosidade}
                onChange={(e) => setFatorOciosidade(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Percentuais */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Impostos, Comissão e Margem Alvo</CardTitle>
            <CardDescription>
              Percentuais aplicados sobre o preço de venda (Simples Nacional ou ISS + federais, em %
              único).
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="impostos">Impostos sobre serviço (%)</Label>
              <Input
                id="impostos"
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={impostos}
                onChange={(e) => setImpostos(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="comissao">Comissão (%)</Label>
              <Input
                id="comissao"
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={comissao}
                onChange={(e) => setComissao(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="margem">Margem de lucro alvo (%)</Label>
              <Input
                id="margem"
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={margem}
                onChange={(e) => setMargem(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button onClick={handleSalvar} disabled={saving}>
            <Save className="mr-2 h-4 w-4" /> {saving ? 'Salvando…' : 'Salvar parâmetros'}
          </Button>
        </div>
      </div>

      {/* Painel lateral com o cálculo da hora técnica */}
      <div className="flex flex-col gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Cálculo do Custo/Hora Técnica</CardTitle>
            <CardDescription>
              Valores vigentes (salvos) — o motor oficial é o mesmo do Simulador e do Resumo.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total de custos fixos (salvos)</span>
              <span className="font-medium">{fmtBRL(recalculo.custosFixosMensais)}</span>
            </div>
            <Separator />
            <div className="flex justify-between">
              <span className="text-muted-foreground">Horas produtivas/mês</span>
              <span className="font-medium">{fmtNum(recalculo.horasProdutivasMes, 1)} h</span>
            </div>
            <Separator />
            <div className="flex justify-between">
              <span className="text-muted-foreground">Custo/Hora Técnica</span>
              <span className="text-base font-semibold text-primary">
                {fmtBRL(recalculo.custoHoraTecnica)}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              {fmtBRL(recalculo.custosFixosMensais)} ÷ {fmtNum(recalculo.horasProdutivasMes, 1)} h ={' '}
              {fmtBRL(recalculo.custoHoraTecnica)}/h
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Mark-up divisor</CardTitle>
            <CardDescription>
              Prévia com os percentuais digitados acima (ainda não salvos)
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm">
            <p className="font-mono text-xs leading-relaxed">
              1 ÷ (1 − {fmtNum(totalPerc)}% ÷ 100) ={' '}
              {markupDivisor > 0 ? markupDivisor.toFixed(4) : '—'}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              Preço de Venda = Custo Total ÷ {markupDivisor > 0 ? markupDivisor.toFixed(4) : '—'}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
