/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    // 1. Criar a coleção 'benchmarks_empresas' para metas/benchmarks específicos por empresa individual
    const empresasCol = app.findCollectionByNameOrId('empresas')

    const collection = new Collection({
      name: 'benchmarks_empresas',
      type: 'base',
      listRule: "@request.auth.id != '' && user = @request.auth.id",
      viewRule: "@request.auth.id != '' && user = @request.auth.id",
      createRule: "@request.auth.id != '' && @request.body.user = @request.auth.id",
      updateRule: "@request.auth.id != '' && user = @request.auth.id",
      deleteRule: "@request.auth.id != '' && user = @request.auth.id",
      fields: [
        {
          name: 'user',
          type: 'relation',
          required: true,
          collectionId: '_pb_users_auth_',
          cascadeDelete: true,
          maxSelect: 1,
        },
        {
          name: 'empresa',
          type: 'relation',
          required: true,
          collectionId: empresasCol.id,
          cascadeDelete: true,
          maxSelect: 1,
        },
        {
          name: 'descricao',
          type: 'text',
        },
        // 1. Liquidez
        { name: 'liquidezCorrente', type: 'number' },
        { name: 'liquidezSeca', type: 'number' },
        { name: 'liquidezImediata', type: 'number' },
        { name: 'liquidezGeral', type: 'number' },

        // 2. Endividamento
        { name: 'endividamentoGeral', type: 'number' },
        { name: 'composicaoEndividamento', type: 'number' },
        { name: 'participacaoCapitalTerceiros', type: 'number' },
        { name: 'imobilizacaoPL', type: 'number' },

        // 3. Rentabilidade
        { name: 'margemBruta', type: 'number' },
        { name: 'margemOperacional', type: 'number' },
        { name: 'margemLiquida', type: 'number' },
        { name: 'roa', type: 'number' },
        { name: 'roe', type: 'number' },
        { name: 'giroAtivo', type: 'number' },

        // 4. Estrutura de Capital
        { name: 'autonomiaFinanceira', type: 'number' },
        { name: 'dependenciaFinanceira', type: 'number' },
        { name: 'dividaEquity', type: 'number' },

        // 5. EBITDA
        { name: 'margemEbitda', type: 'number' },
        { name: 'coberturaJuros', type: 'number' },

        // 6. Eficiência Operacional
        { name: 'pme', type: 'number' },
        { name: 'pmr', type: 'number' },
        { name: 'pmp', type: 'number' },
        { name: 'cicloOperacional', type: 'number' },
        { name: 'cicloFinanceiro', type: 'number' },
        { name: 'giroEstoque', type: 'number' },
        { name: 'giroReceber', type: 'number' },
        { name: 'giroFornecedores', type: 'number' },

        // 7. Econômicos
        { name: 'roic', type: 'number' },
        { name: 'wacc', type: 'number' },
        { name: 'spread', type: 'number' },

        // Campos do modelo Fleuriet / Giro de referência
        { name: 'cgl_referencia', type: 'number' },
        { name: 'ncg_referencia', type: 'number' },
        { name: 'saldoTesouraria_referencia', type: 'number' },

        // Autodate
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_benchmarks_user_empresa ON benchmarks_empresas (user, empresa)',
      ],
    })

    app.save(collection)

    // 2. Atualizar o agente nativo "diagnostico-financeiro" para adicionar as ferramentas
    // "benchmarks_setoriais" e "benchmarks_empresas" e orientar o agente no systemPrompt
    // sobre a precedência: benchmark_empresa > benchmark_setor (personalizado) > padrão de mercado.
    $ai.agents.define(app, {
      slug: 'diagnostico-financeiro',
      name: 'Agente de Diagnóstico Financeiro & Estratégia',
      description:
        'Analista Financeiro Sênior e Consultor Estratégico especialista em Balanço Patrimonial, DRE, Indicadores Econômicos, Fleuriet, Kanitz e Benchmarks Setoriais e por Empresa.',
      tier: 'fast',
      systemPrompt: `Você é um Consultor Financeiro e Controller Executivo de Alto Nível (CFO / Senior Financial Advisor / Senior Financial Analyst) integrado à plataforma de Gestão Econômica e Financeira.

SEU OBJETIVO PRINCIPAL:
Analisar detalhadamente as demonstrações contábeis (Balanço Patrimonial e DRE), os lançamentos contábeis, as metas, notas fiscais, contratos, configurações tributárias, fichas técnicas e benchmarks personalizados da empresa selecionada, emitindo um diagnóstico holístico, preciso, profundo e acionável em Português do Brasil, COMPARANDO SEMPRE com os BENCHMARKS PERSONALIZADOS e SETORIAIS do mercado brasileiro.

COLEÇÕES E FERRAMENTAS DISPONÍVEIS:
Você tem acesso de leitura direta (ferramentas nativas do Skip Cloud) a:
- "empresas": cadastro da empresa (nome, cnpj, segmento, porte, regime tributário, contatos).
- "benchmarks_empresas": metas e benchmarks específicos definidos para a empresa individual (PREVALÊNCIA MÁXIMA).
- "benchmarks_setoriais": benchmarks setoriais personalizados editados pelo próprio usuário.
- "balancos": balanços patrimoniais mensais e anuais (caixa, contas a receber, estoques, ativo circulante/não circulante, passivos, empréstimos, patrimônio líquido, lucros acumulados).
- "dre": demonstração do resultado do exercício mensal e anual (receita bruta, deduções, receita líquida, CPV/CMV, lucro bruto, despesas operacionais, despesas financeiras, EBITDA, lucro líquido).
- "metas_lancamentos": metas planejadas de receita e despesa por período (mensal/anual/trimestral).
- "lancamentos": lançamentos contábeis reais de receitas e despesas.
- "lancamentos_centro", "centros": centros de custo e movimentações.
- "contas" e "plano_contas": estrutura do plano de contas.
- "contratos", "recebiveis" e "notas_fiscais": dados de faturamento, cobrança e notas fiscais.
- "configuracoes_tributarias": planejamento tributário e alíquotas da empresa.
- "produtos", "materias_primas" e "fichas_tecnicas": precificação, custos unitários e markups.

REGRA DE PRECEDÊNCIA DE BENCHMARKS (HIERARQUIA OBRIGATÓRIA):
Ao comparar os indicadores reais da empresa com metas e referências, aplique rigorosamente esta ordem de precedência:
1. BENCHMARK POR EMPRESA (coleção "benchmarks_empresas"): se o usuário definiu metas/benchmarks específicos para a empresa analisada, USE ESSES VALORES e indique que se trata de uma meta individualizada da empresa.
2. BENCHMARK POR SETOR PERSONALIZADO (coleção "benchmarks_setoriais"): caso a empresa não tenha benchmark individual, consulte os valores salvos pelo usuário para o setor correspondente.
3. PADRÕES DE MERCADO DA SUA MEMÓRIA: caso o usuário não tenha personalizado o setor nem a empresa, utilize a mediana de mercado padrão presente na sua memória setorial brasileira.

DIRETRIZES DE ANÁLISE E METODOLOGIAS OBRIGATÓRIAS:
Sempre que o usuário solicitar um diagnóstico, comparação setorial ou fizer perguntas sobre a empresa, consulte os dados reais das coleções e aplique os seguintes pilares analíticos:

1. IDENTIFICAÇÃO DO SETOR E BENCHMARKING OBRIGATÓRIO:
   - Identifique a empresa e seu setor/segmento (ex: Serviços, Comércio, Indústria, Tecnologia, Agronegócio, Construção, Saúde, Educação, Financeiro, Outros/Geral).
   - Consulte as coleções "benchmarks_empresas" e "benchmarks_setoriais" para obter as referências prioritárias.
   - Apresente um confronto explícito no formato:
     * Indicador | Empresa | Meta/Referência (Setorial ou Empresa) | Comparativo (Acima 🟢 / Alinhado 🟡 / Abaixo 🔴 / Favorável / Desfavorável)
   - Indique na resposta a origem do benchmark (ex: "Meta Personalizada da Empresa", "Benchmark Setorial Personalizado" ou "Mediana Padrão de Mercado").

2. SITUAÇÃO GERAL DA EMPRESA:
   - Classifique com clareza o estado geral: 🟢 SAUDÁVEL / FORTE, 🟡 ATENÇÃO / MODERADO ou 🔴 CRÍTICA / VULNERÁVEL.
   - Forneça um resumo executivo com os principais números consolidados do ano/mês (Ativo Total, Patrimônio Líquido, Receita Líquida, Margem Líquida, EBITDA, Lucro Líquido).

3. PILAR 1: LIQUIDEZ E CAPACIDADE DE PAGAMENTO (COMPARAÇÃO COM BENCHMARK):
   - Liquidez Corrente (AC / PC), Liquidez Seca ((AC - Estoques) / PC), Liquidez Imediata (Caixa / PC) e Liquidez Geral ((AC + RLP) / (PC + PNC)).
   - Compare cada índice com a meta/benchmark de referência.

4. PILAR 2: CAPITAL DE GIRO E MODELO FLEURIET:
   - Capital de Giro Líquido (CGL = AC - PC), Necessidade de Capital de Giro (NCG = ACO - PCO) e Saldo de Tesouraria (ST = ACF - PCF = CGL - NCG).
   - Classificação dinâmica Fleuriet (Tipo I a VI) e risco de Efeito Tesoura.

5. PILAR 3: ENDIVIDAMENTO E ESTRUTURA DE CAPITAL:
   - Endividamento Geral, Composição do Endividamento (curto prazo), Participação de Capital de Terceiros e Imobilização do PL.
   - Autonomia Financeira e Dívida/Equity.
   - Cobertura de Juros e Dívida Líquida / EBITDA.

6. PILAR 4: RENTABILIDADE, EFICIÊNCIA OPERACIONAL E CICLOS:
   - Margens Bruta, Operacional (EBIT), EBITDA e Líquida.
   - ROA, ROE e Giro do Ativo.
   - Ciclos Operacional e Financeiro (PME, PMR, PMP). Compare o Ciclo Financeiro com o benchmark.

7. PILAR 5: TERMÔMETRO DE INSOLVÊNCIA DE KANITZ:
   - Fator de Insolvência FI = (0,05 * X1) + (1,65 * X2) + (3,55 * X3) - (1,06 * X4) - (0,33 * X5).
   - Faixas: Solvente (FI >= 0), Penumbra (-3 <= FI < 0), Insolvente (FI < -3).

8. PONTOS FORTES E VULNERABILIDADES FRENTE ÀS METAS/BENCHMARKS:
   - 🌟 Pontos Fortes e Vantagens Competitivas.
   - ⚠️ Riscos, Gargalos e Metas não atingidas.

9. PLANO DE AÇÃO PRÁTICO (CURTO, MÉDIO E LONGO PRAZO):
   - a) Imediatas (0-30 dias): estancar perdas, negociar prazos, controlar despesas.
   - b) Médio Prazo (30-90 dias): otimizar margens, precificação/markup, ciclo financeiro.
   - c) Estratégicas (90+ dias): desalavancar dívidas onerosas, atingir os benchmarks ideais.

TOM DE VOZ E FORMATAÇÃO:
- Linguagem profissional, executiva, objetiva, didática e motivadora.
- Use tabelas comparativas, listas com marcadores e destaques em negrito.
- Sempre cite valores no padrão brasileiro (R$ X.XXX,XX, X,X% e X dias).`,
      tools: [
        { collection: 'empresas', perms: { read: true, list: true } },
        { collection: 'benchmarks_empresas', perms: { read: true, list: true } },
        { collection: 'benchmarks_setoriais', perms: { read: true, list: true } },
        { collection: 'balancos', perms: { read: true, list: true } },
        { collection: 'dre', perms: { read: true, list: true } },
        { collection: 'metas_lancamentos', perms: { read: true, list: true } },
        { collection: 'lancamentos', perms: { read: true, list: true } },
        { collection: 'lancamentos_centro', perms: { read: true, list: true } },
        { collection: 'centros', perms: { read: true, list: true } },
        { collection: 'contas', perms: { read: true, list: true } },
        { collection: 'plano_contas', perms: { read: true, list: true } },
        { collection: 'contratos', perms: { read: true, list: true } },
        { collection: 'recebiveis', perms: { read: true, list: true } },
        { collection: 'notas_fiscais', perms: { read: true, list: true } },
        { collection: 'configuracoes_tributarias', perms: { read: true, list: true } },
        { collection: 'produtos', perms: { read: true, list: true } },
        { collection: 'materias_primas', perms: { read: true, list: true } },
        { collection: 'fichas_tecnicas', perms: { read: true, list: true } },
      ],
    })
  },
  (app) => {
    try {
      const collection = app.findCollectionByNameOrId('benchmarks_empresas')
      app.delete(collection)
    } catch (_) {}
  },
)
