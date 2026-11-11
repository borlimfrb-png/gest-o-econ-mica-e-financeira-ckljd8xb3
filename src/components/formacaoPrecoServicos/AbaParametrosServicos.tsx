import { useMemo, useState } from 'react'
import { useToast } from '@/hooks/use-toast'
import {
  formacaoServicosParametrosService,
  type FormacaoServicosParametrosRecord,
} from '@/services/formacaoPrecoServicosService'
import {
  calculadoraServicos,
  type ParametrosFormacaoServicos,
  type ResultadoParametros,
} from '@/lib/formacaoPrecoServicosCalculo'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Plus, Save, Trash2 } from 'lucide-react'

interface Props {
  parametros: FormacaoServicosParametrosRecord
  empresaId: string
  recalculo: ResultadoParametros
}

interface CustosFixosState {
  nome: string
  valor: number | string
}

interface ProfissionaisState {
  nome: string
  horasMes: number | string
  fatorOciosidadePercentual: number | string
}

const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const fmtNum = (v: number, casas = 2) => v.toLocaleString('pt-BR', { maximumFractionDigits: casas })

export default function AbaParametrosServicos({ parametros, empresaId, recalculo }: Props) {
  const { toast } = useToast()
  const [saving, setSaving] = useState(false)

  const [custosFixos, setCustosFixos] = useState<CustosFixosState[]>(
    (parametros.custosFixos || []).map((c) => ({ nome: c.nome, valor: c.valor })),
  )
  const [profissionais, setProfissionais] = useState<ProfissionaisState[]>(
    (parametros.profissionais || []).map((p) => ({
      nome: p.nome,
      horasMes: p.horasMes,
      fatorOciosidadePercentual: p.fatorOciosidadePercentual,
    })),
  )
  const [impostos, setImpostos] = useState<string>(String(parametros.impostosPercentual ?? 0))
  const [comissao, setComissao] = useState<string>(useStateSafe(parametros.comissaoPercentual))
  const [margem, setMargem] = useState<string>(String(parametros.margemAlvoPercentual ?? 0))

  function useStateSafe(v: number | undefined): string {
    return String(v ?? 0)
  }

  const totalCustosFixos = useMemo(
    () => custosFixos.reduce((acc, c) => acc + (Number(c.valor) || 0), 0),
    [custosFixos],
  )

  const totalProfissionais = profissionais.length

  const horasProdutivas = useMemo(() => {
    return profissionais.reduce((acc, p) => {
      const horas = Number(p.horasMes) || 0
      const fator = 1 - (Number(p.fatorOciosidadePercentual) || 0) / 100
      return acc + horas * fator
    }, 0)
  }, [profissionais])

  const custoHoraTecnica = useMemo(() => {
    if (horasProdutivas <= 0) return 0
    return totalCustosFixos / horasProdutivas
  }, [totalCustosFixos, horasProdutivas])

  const handleSalvar = async () => {
    try {
      setSaving(true)
      const payload: ParametrosFormacaoServicos = {
        custosFixos: custosFixos
          .filter((c) => c.nome.trim() !== '')
          .map((c) => ({ nome: c.nome.trim(), valor: Number(c.valor) || 0 })),
        profissionais: profissionais
          .filter((p) => p.nome.trim() !== '' && Number(p.horasMes) > 0)
          .map((p) => ({
            nome: p.nome.trim(),
            horasMes: Number(p.horasMes) || 0,
            fatorOciosidadePercentual: Number(p.fatorOciosidadePercentual) || 0,
          })),
        impostosPercentual: Number(impostos) || 0,
        comissaoPercentual: Number(comissao) || 0,
        margemAlvoPercentual: Number(margem) || 0,
      }
      if (parametros.id) {
        await formacaoServicosParametrosService.update(parametros.id, payload)
      } else {
        await formacaoServicosParametrosService.create(empresaId, payload)
      }
      toast({ title: 'Parâmetros salvos', description: 'O Custo/Hora Técnica foi recalculado.' })
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

  const addProfissional = () =>
    setProfissionais((prev) => [...prev, { nome: '', horasMes: '', fatorOciosidadePercentual: 0 }])
  const removeProfissional = (i: number) =>
    setProfissionais((prev) => prev.filter((_, idx) => idx !== i))

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="lg:col-span-2 flex flex-col gap-4">
        {/* Custos fixos */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Custos Fixos Mensais da Consultoria</CardTitle>
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
                  type="number"
                  step="0.01"
                  min="0"
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

        {/* Profissionais */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Horas Produtivas por Profissional</CardTitle>
            <CardDescription>
              Horas disponíveis por mês e o % de ociosidade (reuniões, vendas, deslocamentos).
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {profissionais.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Nenhum profissional cadastrado. Clique em “Adicionar profissional”.
              </p>
            )}
            {profissionais.map((item, i) => (
              <div key={i} className="flex flex-wrap gap-2">
                <Input
                  placeholder="Nome/função"
                  value={item.nome}
                  onChange={(e) => {
                    const v = e.target.value
                    setProfissionais((prev) =>
                      prev.map((p, idx) => (idx === i ? { ...p, nome: v } : p)),
                    )
                  }}
                />
                <Input
                  type="number"
                  step="1"
                  min="0"
                  placeholder="Horas/mês"
                  className="max-w-[130px]"
                  value={item.horasMes}
                  onChange={(e) => {
                    const v = e.target.value
                    setProfissionais((prev) =>
                      prev.map((p, idx) => (idx === i ? { ...p, horasMes: v } : p)),
                    )
                  }}
                />
                <Input
                  type="number"
                  step="1"
                  min="0"
                  max="100"
                  placeholder="Ociosidade %"
                  className="max-w-[140px]"
                  value={item.fatorOciosidadePercentual}
                  onChange={(e) => {
                    const v = e.target.value
                    setProfissionais((prev) =>
                      prev.map((p, idx) =>
                        idx === i ? { ...p, fatorOciosidadePercentual: v } : p,
                      ),
                    )
                  }}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeProfissional(i)}
                  aria-label="Remover"
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={addProfissional}>
              <Plus className="mr-2 h-4 w-4" /> Adicionar profissional
            </Button>
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
            <CardDescription>Atualizado em tempo real conforme os campos acima</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total de custos fixos</span>
              <span className="font-medium">{fmtBRL(totalCustosFixos)}</span>
            </div>
            <Separator />
            <div className="flex justify-between">
              <span className="text-muted-foreground">Profissionais</span>
              <span className="font-medium">{totalProfissionais}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Horas produtivas/mês</span>
              <span className="font-medium">{fmtNum(horasProdutivas, 1)} h</span>
            </div>
            <Separator />
            <div className="flex justify-between">
              <span className="text-muted-foreground">Custo/Hora Técnica</span>
              <span className="text-base font-semibold text-primary">
                {fmtBRL(custoHoraTecnica)}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              {fmtBRL(totalCustosFixos)} ÷ {fmtNum(horasProdutivas, 1)} h ={' '}
              {fmtBRL(custoHoraTecnica)}/h
            </p>
          </CardContent>
        </Card>

        {recalculo && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Mark-up divisor</CardTitle>
              <CardDescription>Com a margem alvo atual</CardDescription>
            </CardHeader>
            <CardContent className="text-sm">
              <p className="font-mono text-xs leading-relaxed">
                1 − ({fmtNum(recalculo.aliquotasTotalPercentual)}% ÷ 100) ={' '}
                {recalculo.markupDivisorAlvo > 0 ? recalculo.markupDivisorAlvo.toFixed(4) : '—'}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                Preço de Venda = Custo Total ÷{' '}
                {recalculo.markupDivisorAlvo > 0 ? recalculo.markupDivisorAlvo.toFixed(4) : '—'}
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
