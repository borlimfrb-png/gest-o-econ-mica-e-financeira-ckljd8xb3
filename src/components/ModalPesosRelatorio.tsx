import React from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Badge } from '@/components/ui/badge'
import { PERFIS_PESOS_PREDEFINIDOS, type PerfilPesosId, type PesosGrupos } from '@/lib/benchmarks'
import {
  SlidersHorizontal,
  Factory,
  ShoppingBag,
  Briefcase,
  Cpu,
  Settings2,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react'

interface ModalPesosRelatorioProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  perfilAtual: PerfilPesosId
  pesosAtuais: PesosGrupos
  onSalvar: (perfil: PerfilPesosId, pesos: PesosGrupos) => void
}

export function ModalPesosRelatorio({
  open,
  onOpenChange,
  perfilAtual,
  pesosAtuais,
  onSalvar,
}: ModalPesosRelatorioProps) {
  const [selectedPerfil, setSelectedPerfil] = React.useState<PerfilPesosId>(perfilAtual)
  const [pesos, setPesos] = React.useState<PesosGrupos>(pesosAtuais)

  React.useEffect(() => {
    if (open) {
      setSelectedPerfil(perfilAtual)
      setPesos(pesosAtuais)
    }
  }, [open, perfilAtual, pesosAtuais])

  const handleSelectPerfil = (perfilId: PerfilPesosId) => {
    setSelectedPerfil(perfilId)
    if (perfilId !== 'personalizado') {
      const config = PERFIS_PESOS_PREDEFINIDOS[perfilId]
      if (config) {
        setPesos({ ...config.pesos })
      }
    }
  }

  const handleSliderChange = (grupoKey: keyof PesosGrupos, value: number) => {
    setSelectedPerfil('personalizado')
    setPesos((prev) => ({
      ...prev,
      [grupoKey]: value,
    }))
  }

  // Total dos pesos
  const totalPesos =
    (pesos.liquidez || 0) +
    (pesos.endividamento || 0) +
    (pesos.rentabilidade || 0) +
    (pesos.estruturaCapital || 0) +
    (pesos.ebitda || 0) +
    (pesos.eficienciaOperacional || 0) +
    (pesos.economicos || 0) +
    (pesos.kanitz || 0)

  const isValidTotal = totalPesos === 100

  const handleAutoAjustar = () => {
    if (totalPesos === 0) {
      setPesos({ ...PERFIS_PESOS_PREDEFINIDOS.personalizado.pesos })
      return
    }
    // Normaliza proporcionalmente para dar 100
    const keys = Object.keys(pesos) as (keyof PesosGrupos)[]
    const novo: PesosGrupos = { ...pesos }
    let soma = 0

    keys.forEach((k, idx) => {
      if (idx === keys.length - 1) {
        novo[k] = Math.max(0, 100 - soma)
      } else {
        const proporcao = Math.round((pesos[k] / totalPesos) * 100)
        novo[k] = proporcao
        soma += proporcao
      }
    })

    setPesos(novo)
    setSelectedPerfil('personalizado')
  }

  const handleSalvar = () => {
    if (!isValidTotal) return
    onSalvar(selectedPerfil, pesos)
    onOpenChange(false)
  }

  const gruposInfo: { key: keyof PesosGrupos; label: string; desc: string }[] = [
    {
      key: 'liquidez',
      label: 'Liquidez',
      desc: 'Capacidade de pagamento no curto e longo prazo (LC, LS, LI, LG)',
    },
    {
      key: 'endividamento',
      label: 'Endividamento',
      desc: 'Nível e perfil das obrigações exigíveis com terceiros (EG, CE, PCT)',
    },
    {
      key: 'rentabilidade',
      label: 'Rentabilidade',
      desc: 'Retorno sobre o patrimônio, ativo e margens (ROE, ROA, Margem Líquida)',
    },
    {
      key: 'estruturaCapital',
      label: 'Estrutura de Capital',
      desc: 'Autonomia patrimonial e alavancagem financeira (Autonomia, Dívida/Equity)',
    },
    {
      key: 'ebitda',
      label: 'EBITDA',
      desc: 'Potencial de geração bruta de caixa e cobertura de juros bancários',
    },
    {
      key: 'eficienciaOperacional',
      label: 'Eficiência Operacional',
      desc: 'Ciclo operacional, financeiro e rotação de estoques e recebíveis',
    },
    {
      key: 'economicos',
      label: 'Econômicos (Avançado)',
      desc: 'Criação de valor econômico e custo de capital (EVA, ROIC, WACC)',
    },
    {
      key: 'kanitz',
      label: 'Solvência (Termômetro de Kanitz)',
      desc: 'Fator de Insolvência FI (X1 a X5) ponderado para predição de falência',
    },
  ]

  const getPerfilIcon = (id: PerfilPesosId) => {
    switch (id) {
      case 'industria':
        return <Factory className="w-4 h-4" />
      case 'comercio':
        return <ShoppingBag className="w-4 h-4" />
      case 'servicos':
        return <Briefcase className="w-4 h-4" />
      case 'tecnologia':
        return <Cpu className="w-4 h-4" />
      default:
        return <Settings2 className="w-4 h-4" />
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-white border-slate-200">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-50 text-blue-700 rounded-lg">
              <SlidersHorizontal className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold text-[#0B1F3A]">
                Personalizar Pesos dos Indicadores no Relatório
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                Selecione um perfil de cliente ou ajuste a ponderação de cada grupo para o parecer
                executivo e nota metodológica.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-5 pt-2">
          {/* Seleção de Perfis Rápidos */}
          <div>
            <Label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-2">
              1. Selecionar Perfil Predefinido
            </Label>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {(
                [
                  'industria',
                  'comercio',
                  'servicos',
                  'tecnologia',
                  'personalizado',
                ] as PerfilPesosId[]
              ).map((id) => {
                const config = PERFIS_PESOS_PREDEFINIDOS[id]
                const isSelected = selectedPerfil === id
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => handleSelectPerfil(id)}
                    className={`p-2.5 rounded-xl border text-left flex flex-col items-start gap-1.5 transition-all ${
                      isSelected
                        ? 'border-blue-600 bg-blue-50/70 text-blue-900 shadow-xs ring-1 ring-blue-600'
                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div
                      className={`p-1.5 rounded-lg ${
                        isSelected ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {getPerfilIcon(id)}
                    </div>
                    <div>
                      <span className="text-xs font-bold block">{config.nome}</span>
                      <span className="text-[10px] text-slate-500 block leading-tight truncate max-w-[90px]">
                        {id === 'personalizado' ? 'Sob medida' : 'Perfil setorial'}
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Sliders por Grupo */}
          <div className="space-y-3 bg-slate-50/60 p-4 rounded-xl border border-slate-200">
            <div className="flex items-center justify-between pb-1 border-b border-slate-200">
              <Label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                2. Ajuste Fino dos Pesos (%)
              </Label>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-600">Soma Total:</span>
                <Badge
                  className={`font-mono font-bold text-xs ${
                    isValidTotal
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                      : 'bg-red-50 text-red-700 border-red-300'
                  }`}
                >
                  {totalPesos}%
                </Badge>
              </div>
            </div>

            <div className="space-y-4 pt-1">
              {gruposInfo.map((grupo) => {
                const valor = pesos[grupo.key]
                return (
                  <div
                    key={grupo.key}
                    className="space-y-1.5 bg-white p-2.5 rounded-lg border border-slate-200/80"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <div>
                        <span className="font-bold text-slate-800">{grupo.label}</span>
                        <span className="text-[10px] text-slate-500 block">{grupo.desc}</span>
                      </div>
                      <span className="font-mono font-bold text-blue-700 text-sm shrink-0 ml-2">
                        {valor}%
                      </span>
                    </div>
                    <Slider
                      value={[valor]}
                      min={0}
                      max={100}
                      step={5}
                      onValueChange={([val]) => handleSliderChange(grupo.key, val)}
                      className="py-1"
                    />
                  </div>
                )
              })}
            </div>

            {/* Validação da Soma */}
            {!isValidTotal && (
              <div className="flex items-center justify-between bg-amber-50 border border-amber-200 p-2.5 rounded-lg text-xs text-amber-900 mt-2">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>
                    A soma dos pesos é <strong>{totalPesos}%</strong>. Para salvar, o total deve ser
                    exatamente <strong>100%</strong> (diferença de {100 - totalPesos}%).
                  </span>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAutoAjustar}
                  className="h-7 text-[11px] bg-white border-amber-300 shrink-0 gap-1 ml-2"
                >
                  <RotateCcw className="w-3 h-3 text-amber-700" />
                  Ajustar p/ 100%
                </Button>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0 pt-3 border-t border-slate-100">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="text-xs"
          >
            Cancelar
          </Button>
          <Button
            type="button"
            disabled={!isValidTotal}
            onClick={handleSalvar}
            className="text-xs bg-blue-600 hover:bg-blue-700 text-white font-semibold"
          >
            <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
            Aplicar ao Relatório
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
