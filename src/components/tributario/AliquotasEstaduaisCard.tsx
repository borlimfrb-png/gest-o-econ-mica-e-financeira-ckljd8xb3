/**
 * Card de Alíquotas de Impostos Estaduais (ICMS) e IPI do Simulador de Regimes.
 * Campos editáveis pelo usuário (padrão ICMS 18% e IPI 10%) que alimentam os
 * créditos calculados sobre as compras do Centro de Custo CC-098 (Matéria Prima),
 * além de um resumo dos créditos por tributo em cada regime.
 */

import { Percent } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  ALIQUOTA_ICMS_PADRAO,
  ALIQUOTA_IPI_PADRAO,
  type SimuladorRegimesResultado,
} from '@/lib/simuladorRegimesCalculo'
import { formatBrl, formatPercent } from './comparativoRegimesBlocos'

interface Props {
  resultado: SimuladorRegimesResultado
  aliquotaIcms: number
  aliquotaIpi: number
  onChangeAliquotaIcms: (v: number) => void
  onChangeAliquotaIpi: (v: number) => void
}

/** Input numérico em % com vírgula pt-BR (texto controlado). */
function CampoAliquota({
  id,
  label,
  valor,
  padrao,
  descricao,
  onChange,
}: {
  id: string
  label: string
  valor: number
  padrao: number
  descricao: string
  onChange: (v: number) => void
}) {
  return (
    <div className="flex-1 min-w-[180px]">
      <label
        htmlFor={id}
        className="text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1 block"
      >
        {label}
      </label>
      <div className="relative">
        <Input
          id={id}
          type="text"
          inputMode="decimal"
          className="pr-7 text-xs font-semibold bg-slate-50/70 border-slate-200"
          value={String(valor).replace('.', ',')}
          onChange={(e) => {
            const raw = e.target.value
              .replace(/\./g, '')
              .replace(',', '.')
              .replace(/[^\d.]/g, '')
            const num = Number(raw)
            onChange(isFinite(num) && num >= 0 ? num : 0)
          }}
        />
        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-semibold">
          %
        </span>
      </div>
      <p className="text-[10px] text-slate-400 mt-1">
        {descricao} · padrão {formatPercent(padrao)}
      </p>
    </div>
  )
}

/** Linha de crédito por tributo em um regime (— quando sem crédito). */
function LinhaCredito({
  sigla,
  aliquota,
  valor,
}: {
  sigla: string
  aliquota?: number
  valor: number
}) {
  return (
    <div className="flex items-center justify-between text-[11px] py-0.5">
      <span className="text-slate-600">
        <span className="font-semibold text-slate-800">{sigla}</span>
        {aliquota !== undefined && valor > 0 && (
          <span className="text-slate-400"> · {formatPercent(aliquota)}</span>
        )}
      </span>
      <span className={`font-semibold ${valor > 0 ? 'text-emerald-700' : 'text-slate-400'}`}>
        {valor > 0 ? formatBrl(valor) : '—'}
      </span>
    </div>
  )
}

export function AliquotasEstaduaisCard({
  resultado,
  aliquotaIcms,
  aliquotaIpi,
  onChangeAliquotaIcms,
  onChangeAliquotaIpi,
}: Props) {
  const temCompras = resultado.comprasEntradas > 0
  const listaRegimes = [
    resultado.regimes.simples,
    resultado.regimes.presumido,
    resultado.regimes.real,
  ]

  return (
    <Card className="rounded-xl border-slate-200 bg-white shadow-xs">
      <CardHeader className="bg-slate-50/70 border-b border-slate-100 py-3.5 px-4">
        <CardTitle className="text-sm font-bold text-[#0B1F3A] flex items-center gap-2">
          <Percent className="w-4 h-4 text-blue-600" />
          Alíquotas de ICMS (Estadual) e IPI — Créditos sobre Compras
        </CardTitle>
        <CardDescription className="text-xs text-slate-500 mt-0.5">
          Créditos calculados sobre as compras do {resultado.centroCustoCodigo}
          {resultado.centroCustoNome ? ` — ${resultado.centroCustoNome}` : ''} (DRE Gerencial){' '}
          consolidadas no exercício {resultado.ano}
        </CardDescription>
      </CardHeader>
      <CardContent className="p-4 space-y-4">
        {/* Campos editáveis */}
        <div className="flex flex-col sm:flex-row gap-4">
          <CampoAliquota
            id="aliquota-icms"
            label="Alíquota ICMS (Estadual)"
            valor={aliquotaIcms}
            padrao={ALIQUOTA_ICMS_PADRAO}
            descricao="crédito nas entradas"
            onChange={onChangeAliquotaIcms}
          />
          <CampoAliquota
            id="aliquota-ipi"
            label="Alíquota IPI"
            valor={aliquotaIpi}
            padrao={ALIQUOTA_IPI_PADRAO}
            descricao="crédito nas entradas"
            onChange={onChangeAliquotaIpi}
          />
          <div className="flex-1 min-w-[180px] flex flex-col justify-center gap-1.5">
            <div className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
              Base de compras (CC-098)
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-lg font-extrabold text-slate-800">
                {temCompras ? formatBrl(resultado.comprasEntradas) : '—'}
              </span>
              <Badge
                variant="outline"
                className="text-[10px] bg-slate-50 text-slate-600 border-slate-200"
              >
                {resultado.totalLancamentosCompras} lanç.
              </Badge>
            </div>
            <p className="text-[10px] text-slate-400">
              PIS 1,65% · COFINS 7,6% · CBS/IBS conforme fase da transição
            </p>
          </div>
        </div>

        {/* Aviso honesto quando não há compras no período */}
        {!temCompras && (
          <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
            Sem lançamentos de compras no Centro de Custo {resultado.centroCustoCodigo} no exercício{' '}
            {resultado.ano} — os créditos de ICMS e IPI ficam em <strong>—</strong> até que haja
            entradas registradas na DRE Gerencial.
          </div>
        )}

        {/* Resumo dos créditos por regime */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {listaRegimes.map((r) => {
            const cr = r.creditos
            return (
              <div
                key={r.id}
                className="rounded-xl bg-slate-50/90 border border-slate-200/80 p-3 space-y-1"
              >
                <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  {r.nome}
                </div>
                <LinhaCredito sigla="Créd. PIS" aliquota={1.65} valor={cr?.pis || 0} />
                <LinhaCredito sigla="Créd. COFINS" aliquota={7.6} valor={cr?.cofins || 0} />
                <LinhaCredito sigla="Créd. ICMS" aliquota={aliquotaIcms} valor={cr?.icms || 0} />
                <LinhaCredito sigla="Créd. IPI" aliquota={aliquotaIpi} valor={cr?.ipi || 0} />
              </div>
            )
          })}
        </div>
        <p className="text-[10px] text-slate-400 leading-relaxed">
          No Simples Nacional as entradas não geram crédito (DAS unificado). No Lucro Presumido o
          regime é cumulativo — sem crédito de PIS/COFINS —, mas ICMS e IPI destacados nas notas de
          entrada são aproveitados integralmente. No Lucro Real todos os créditos são aproveitados
          (não-cumulativo).
        </p>
      </CardContent>
    </Card>
  )
}

export default AliquotasEstaduaisCard
