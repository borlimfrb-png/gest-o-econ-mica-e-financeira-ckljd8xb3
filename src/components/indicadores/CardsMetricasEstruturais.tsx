/**
 * Cards de Métricas Estruturais da seção "Métricas Avançadas"
 * (/indicadores/apresentacao): ROA, Giro do Ativo, Liquidez Seca/Imediata/Geral,
 * PMR, PMP, Capital de Giro Líquido e NCG/Saldo de Tesouraria.
 * Reaproveita o mesmo visual e padrão de badge de SecaoMetricasAvancadas.
 */
import { Landmark, Repeat, Wallet, Droplets, CalendarClock, HandCoins, Coins } from 'lucide-react'
import { CardMetrica } from './CardMetrica'
import type { MetricasEstruturaisResultado } from '@/lib/metricasEstruturaisCalculo'
import type { ReferenciaMercado } from './benchmarkHub'

const fmtNum = (v: number | null | undefined, dec = 2): string => {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—'
  return v.toLocaleString('pt-BR', { minimumFractionDigits: dec, maximumFractionDigits: dec })
}
const fmtPct = (v: number | null | undefined, dec = 2): string =>
  v === null || v === undefined || !Number.isFinite(v) ? '—' : `${fmtNum(v, dec)}%`
const fmtMoeda = (v: number | null | undefined): string => {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—'
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
const fmtDias = (v: number | null | undefined, dec = 0): string =>
  v === null || v === undefined || !Number.isFinite(v) ? '—' : `${fmtNum(v, dec)} dias`
const fmtMult = (v: number | null | undefined, dec = 2): string =>
  v === null || v === undefined || !Number.isFinite(v) ? '—' : `${fmtNum(v, dec)}x`

export interface CardsMetricasEstruturaisProps {
  est: MetricasEstruturaisResultado
  referencia: ReferenciaMercado | null
  ano: number
}

export function CardsMetricasEstruturais({ est, referencia, ano }: CardsMetricasEstruturaisProps) {
  return (
    <>
      {/* ===== 7. ROA — Retorno sobre Ativos ===== */}
      <CardMetrica
        titulo="Retorno sobre Ativos"
        sigla="ROA"
        icone={Landmark}
        valorPrincipal={est.roa !== null ? fmtPct(est.roa) : '—'}
        rotuloPrincipal={`ROA (${ano})`}
        valorEmpresaBruto={est.roa}
        valorMercadoBruto={referencia?.roa}
        valorMercado={referencia?.roa !== undefined ? fmtPct(referencia.roa, 1) : undefined}
        descricao="ROA = Lucro Líquido ÷ Ativo Total. Mede a eficiência da empresa em gerar lucro com os ativos que possui, independentemente de como são financiados."
        detalhes={[
          { rotulo: 'Lucro Líquido', valor: fmtMoeda(est.lucroLiquido) },
          { rotulo: 'Ativo Total', valor: fmtMoeda(est.ativoTotal) },
        ]}
      />

      {/* ===== 8. Giro do Ativo ===== */}
      <CardMetrica
        titulo="Giro do Ativo"
        sigla="Giro"
        icone={Repeat}
        valorPrincipal={est.giroAtivo !== null ? fmtMult(est.giroAtivo, 3) : '—'}
        rotuloPrincipal={`Giro (${ano})`}
        valorEmpresaBruto={est.giroAtivo}
        valorMercadoBruto={referencia?.giroAtivo}
        valorMercado={
          referencia?.giroAtivo !== undefined ? fmtMult(referencia.giroAtivo, 2) : undefined
        }
        descricao="Giro = Receita Líquida ÷ Ativo Total. Quantas vezes a receita anual cobre o ativo: quanto maior, mais produtiva a utilização dos recursos da empresa."
        detalhes={[
          { rotulo: 'Receita Líquida', valor: fmtMoeda(est.receitaLiquida) },
          { rotulo: 'Ativo Total', valor: fmtMoeda(est.ativoTotal) },
        ]}
      />

      {/* ===== 9. Liquidez Seca ===== */}
      <CardMetrica
        titulo="Liquidez Seca"
        sigla="LS"
        icone={Droplets}
        valorPrincipal={est.liquidezSeca !== null ? fmtNum(est.liquidezSeca) : '—'}
        rotuloPrincipal={`Liquidez Seca (${ano})`}
        valorEmpresaBruto={est.liquidezSeca}
        valorMercadoBruto={referencia?.liquidezSeca}
        valorMercado={
          referencia?.liquidezSeca !== undefined ? fmtNum(referencia.liquidezSeca) : undefined
        }
        descricao="LS = (Ativo Circulante − Estoques) ÷ Passivo Circulante. Exclui o estoque — o ativo de maior risco de conversão — e mostra a cobertura das dívidas de curto prazo."
        detalhes={[
          { rotulo: 'Ativo Circulante', valor: fmtMoeda(est.ativoCirculante) },
          { rotulo: 'Estoques', valor: fmtMoeda(est.estoques) },
          { rotulo: 'Passivo Circulante', valor: fmtMoeda(est.passivoCirculante) },
        ]}
      />

      {/* ===== 10. Liquidez Imediata ===== */}
      <CardMetrica
        titulo="Liquidez Imediata"
        sigla="LI"
        icone={Wallet}
        valorPrincipal={est.liquidezImediata !== null ? fmtNum(est.liquidezImediata) : '—'}
        rotuloPrincipal={`Liquidez Imediata (${ano})`}
        valorEmpresaBruto={est.liquidezImediata}
        valorMercadoBruto={referencia?.liquidezImediata}
        valorMercado={
          referencia?.liquidezImediata !== undefined
            ? fmtNum(referencia.liquidezImediata)
            : undefined
        }
        descricao="LI = Disponível ÷ Passivo Circulante. Considera apenas caixa, equivalentes e aplicações financeiras — a capacidade de pagamento imediata, sem nenhuma conversão."
        detalhes={[
          { rotulo: 'Disponível', valor: fmtMoeda(est.disponivel) },
          { rotulo: 'Passivo Circulante', valor: fmtMoeda(est.passivoCirculante) },
        ]}
      />

      {/* ===== 11. Liquidez Geral ===== */}
      <CardMetrica
        titulo="Liquidez Geral"
        sigla="LG"
        icone={CalendarClock}
        valorPrincipal={est.liquidezGeral !== null ? fmtNum(est.liquidezGeral) : '—'}
        rotuloPrincipal={`Liquidez Geral (${ano})`}
        valorEmpresaBruto={est.liquidezGeral}
        valorMercadoBruto={referencia?.liquidezGeral}
        valorMercado={
          referencia?.liquidezGeral !== undefined ? fmtNum(referencia.liquidezGeral) : undefined
        }
        descricao="LG = (AC + Realizável LP) ÷ (PC + Exigível LP). Visão de longo prazo: quanto a empresa possui de ativos realizáveis (curto + longo prazo) para cada unidade de dívida total."
        detalhes={[
          {
            rotulo: 'AC + Realizável LP',
            valor: fmtMoeda(est.ativoCirculante + est.realizavelLongoPrazo),
          },
          {
            rotulo: 'PC + Exigível LP',
            valor: fmtMoeda(est.passivoCirculante + est.passivoNaoCirculante),
          },
        ]}
      />

      {/* ===== 12. PMR — Prazo Médio de Recebimento ===== */}
      <CardMetrica
        titulo="Prazo Médio de Recebimento"
        sigla="PMR"
        icone={HandCoins}
        valorPrincipal={est.pmr !== null ? fmtDias(est.pmr, 0) : '—'}
        rotuloPrincipal={`PMR (${ano})`}
        valorEmpresaBruto={est.pmr}
        valorMercadoBruto={referencia?.pmr}
        valorMercado={referencia ? fmtDias(referencia.pmr, 0) : undefined}
        inverteCor
        descricao="PMR = (Contas a Receber ÷ Receita Líquida) × 360. Quantos dias, em média, a empresa leva para receber suas vendas. Quanto menor, mais rápido o caixa entra."
        detalhes={[
          { rotulo: 'Contas a Receber', valor: fmtMoeda(est.contasReceber) },
          { rotulo: 'Receita Líquida', valor: fmtMoeda(est.receitaLiquida) },
        ]}
      />

      {/* ===== 13. PMP — Prazo Médio de Pagamento ===== */}
      <CardMetrica
        titulo="Prazo Médio de Pagamento"
        sigla="PMP"
        icone={Coins}
        valorPrincipal={est.pmp !== null ? fmtDias(est.pmp, 0) : '—'}
        rotuloPrincipal={`PMP (${ano})`}
        valorEmpresaBruto={est.pmp}
        valorMercadoBruto={referencia?.pmp}
        valorMercado={referencia ? fmtDias(referencia.pmp, 0) : undefined}
        inverteCor
        descricao="PMP = (Fornecedores ÷ CMV) × 360. Quantos dias, em média, a empresa leva para pagar seus fornecedores. Prazos maiores financiam a operação sem custo de capital."
        detalhes={[
          { rotulo: 'Fornecedores', valor: fmtMoeda(est.fornecedores) },
          { rotulo: 'CMV (proxy de compras)', valor: fmtMoeda(est.cmv) },
        ]}
      />

      {/* ===== 14. Capital de Giro Líquido ===== */}
      <CardMetrica
        titulo="Capital de Giro Líquido"
        sigla="CGL"
        icone={Coins}
        valorPrincipal={est.cgl !== null ? fmtMoeda(est.cgl) : '—'}
        rotuloPrincipal={`CGL (${ano})`}
        valorEmpresaBruto={est.cgl}
        valorMercadoBruto={referencia?.cglReferencia}
        valorMercado={
          referencia?.cglReferencia !== undefined ? fmtMoeda(referencia.cglReferencia) : undefined
        }
        descricao="CGL = Ativo Circulante − Passivo Circulante. Recursos de longo prazo que financiam a operação de curto prazo; positivo indica folga estrutural."
        detalhes={[
          { rotulo: 'Ativo Circulante', valor: fmtMoeda(est.ativoCirculante) },
          { rotulo: 'Passivo Circulante', valor: fmtMoeda(est.passivoCirculante) },
        ]}
      />

      {/* ===== 15. NCG e Saldo de Tesouraria ===== */}
      <CardMetrica
        titulo="NCG e Saldo de Tesouraria"
        sigla="NCG / ST"
        icone={Landmark}
        valorPrincipal={est.ncg !== null ? fmtMoeda(est.ncg) : '—'}
        rotuloPrincipal={`NCG (${ano})`}
        valorEmpresaBruto={est.saldoTesouraria}
        descricao="NCG = Ativo Circulante Operacional − Passivo Circulante Operacional. O Saldo de Tesouraria (CGL − NCG) indica se o giro operacional é financiado por recursos próprios de longo prazo."
        detalhes={[
          { rotulo: 'NCG', valor: fmtMoeda(est.ncg) },
          { rotulo: 'Saldo de Tesouraria', valor: fmtMoeda(est.saldoTesouraria) },
          { rotulo: 'CGL', valor: fmtMoeda(est.cgl) },
        ]}
      />
    </>
  )
}

export default CardsMetricasEstruturais
