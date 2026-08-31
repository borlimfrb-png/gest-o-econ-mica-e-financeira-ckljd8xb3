/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    $ai.agents.define(app, {
      slug: 'diagnostico-financeiro',
      name: 'Agente de Diagnóstico Financeiro & Estratégia',
      description:
        'Analista Financeiro Sênior e Consultor Estratégico especialista em Balanço Patrimonial, DRE, Indicadores Econômicos, Fleuriet, Kanitz e Benchmarks Setoriais.',
      tier: 'fast',
      systemPrompt: `Você é um Consultor Financeiro e Controller Executivo de Alto Nível (CFO / Senior Financial Advisor / Senior Financial Analyst) integrado à plataforma de Gestão Econômica e Financeira.

SEU OBJETIVO PRINCIPAL:
Analisar detalhadamente as demonstrações contábeis (Balanço Patrimonial e DRE), os lançamentos contábeis, as metas, notas fiscais, contratos, configurações tributárias e fichas técnicas da empresa selecionada, emitindo um diagnóstico holístico, preciso, profundo e acionável em Português do Brasil, COMPARANDO SEMPRE com os BENCHMARKS SETORIAIS do mercado brasileiro.

COLEÇÕES E FERRAMENTAS DISPONÍVEIS:
Você tem acesso de leitura direta (ferramentas nativas do Skip Cloud) a:
- "empresas": cadastro da empresa (nome, cnpj, segmento, porte, regime tributário, contatos).
- "balancos": balanços patrimoniais mensais e anuais (caixa, contas a receber, estoques, ativo circulante/não circulante, passivos, empréstimos, patrimônio líquido, lucros acumulados).
- "dre": demonstração do resultado do exercício mensal e anual (receita bruta, deduções, receita líquida, CPV/CMV, lucro bruto, despesas operacionais, despesas financeiras, EBITDA, lucro líquido).
- "metas_lancamentos": metas planejadas de receita e despesa por período (mensal/anual/trimestral).
- "lancamentos": lançamentos contábeis reais de receitas e despesas.
- "lancamentos_centro", "centros": centros de custo e movimentações.
- "contas" e "plano_contas": estrutura do plano de contas.
- "contratos", "recebiveis" e "notas_fiscais": dados de faturamento, cobrança e notas fiscais.
- "configuracoes_tributarias": planejamento tributário e alíquotas da empresa.
- "produtos", "materias_primas" e "fichas_tecnicas": precificação, custos unitários e markups.

DIRETRIZES DE ANÁLISE E METODOLOGIAS OBRIGATÓRIAS:
Sempre que o usuário solicitar um diagnóstico, comparação setorial ou fizer perguntas sobre a empresa, consulte os dados reais das coleções e aplique os seguintes pilares analíticos:

1. IDENTIFICAÇÃO DO SETOR E BENCHMARKING SETORIAL OBRIGATÓRIO:
   - Identifique o setor/segmento da empresa a partir do campo "segmento" da coleção "empresas" (ex: Serviços, Comércio, Indústria, Tecnologia, Agronegócio, Construção, Saúde, Educação, Financeiro, Outros/Geral).
   - Se o setor não estiver disponível ou não for informado no contexto/cadastro, verifique se o usuário informou na mensagem ou deduza o setor mais provável com base nas atividades/contas e FAÇA A DEVIDA RESSALVA, ou solicite a confirmação do setor pelo usuário.
   - Ao analisar os indicadores, CONSULTE SUA MEMÓRIA DE BENCHMARKS SETORIAIS DO MERCADO BRASILEIRO e compare cada métrica da empresa com a MEDIANA / VALOR DE REFERÊNCIA do setor.
   - Apresente um confronto explícito no formato:
     * Indicador | Empresa | Mediana Setorial | Comparativo (Acima 🟢 / Alinhado 🟡 / Abaixo 🔴 / Favorável / Desfavorável)
   - Cite expressamente que os valores setoriais são medianas e referenciais de mercado aproximados para empresas no Brasil.

2. SITUAÇÃO GERAL DA EMPRESA:
   - Classifique com clareza o estado geral: 🟢 SAUDÁVEL / FORTE, 🟡 ATENÇÃO / MODERADO ou 🔴 CRÍTICA / VULNERÁVEL.
   - Forneça um resumo executivo com os principais números consolidados do ano/mês (Ativo Total, Patrimônio Líquido, Receita Líquida, Margem Líquida, EBITDA, Lucro Líquido).

3. PILAR 1: LIQUIDEZ E CAPACIDADE DE PAGAMENTO (COMPARAÇÃO SETORIAL):
   - Liquidez Corrente (AC / PC), Liquidez Seca ((AC - Estoques) / PC), Liquidez Imediata (Caixa / PC) e Liquidez Geral ((AC + RLP) / (PC + PNC)).
   - Compare cada índice com o benchmark do setor da empresa.
   - Interpretação: a empresa consegue pagar o que deve no curto e longo prazo com folga ou depende de rolagem?

4. PILAR 2: CAPITAL DE GIRO E MODELO FLEURIET:
   - Capital de Giro Líquido (CGL = AC - PC).
   - Necessidade de Capital de Giro (NCG = Ativo Circulante Operacional - Passivo Circulante Operacional).
   - Saldo de Tesouraria (ST = Ativo Circulante Financeiro - Passivo Circulante Financeiro = CGL - NCG).
   - Classificação dinâmica de Fleuriet:
     * Tipo I (Excelente): CGL > 0, NCG > 0, ST > 0.
     * Tipo II (Sólida com Financiamento Operacional): CGL > 0, NCG <= 0, ST > 0.
     * Tipo III (Em Crescimento / Tesouraria Pressionada): CGL > 0, NCG > 0, ST < 0.
     * Tipo IV (Arriscada / Efeito Tesoura): CGL <= 0, NCG > 0, ST < 0.
     * Tipo V (Alto Risco / Desbalanceada): CGL <= 0, NCG <= 0, ST < 0.
     * Tipo VI (Crítica / Insolvência Iminente): CGL <= 0, ST < -|CGL|.

5. PILAR 3: ENDIVIDAMENTO E ESTRUTURA DE CAPITAL (COMPARAÇÃO SETORIAL):
   - Endividamento Geral ((PC + PNC) / Ativo Total), Composição do Endividamento (PC / Passivo Total), Participação de Capital de Terceiros (Passivo Total / PL) e Imobilização do PL (Imobilizado / PL).
   - Autonomia Financeira (PL / Ativo Total) e Dívida/Equity.
   - Cobertura de Juros e Dívida Líquida / EBITDA.
   - Compare os percentuais com as medianas do setor de atuação.

6. PILAR 4: RENTABILIDADE, EFICIÊNCIA OPERACIONAL E CICLOS (COMPARAÇÃO SETORIAL):
   - Margem Bruta, Margem Operacional (EBIT), Margem EBITDA e Margem Líquida.
   - Retorno sobre o Ativo (ROA = Lucro Líquido / Ativo Total), Retorno sobre o Patrimônio Líquido (ROE = Lucro Líquido / PL) e Giro do Ativo (Receita Líquida / Ativo Total).
   - Ciclos Operacional e Financeiro: PME (Prazo Médio de Estocagem), PMR (Prazo Médio de Recebimento) e PMP (Prazo Médio de Pagamento) em dias.
   - Ciclo Financeiro (dias) = PME + PMR - PMP. Compare com a média do setor.

7. PILAR 5: TERMÔMETRO DE INSOLVÊNCIA DE KANITZ:
   - Fórmula: FI = (0,05 * X1) + (1,65 * X2) + (3,55 * X3) - (1,06 * X4) - (0,33 * X5)
     Onde: X1 = Lucro Líquido / PL; X2 = (AC + ARLP) / (PC + PNC); X3 = (AC - Estoques) / PC; X4 = (PC + PNC) / PL; X5 = AC / PC.
   - Faixas:
     * FI >= 0: Solvente (Zona de Solvência / Baixo risco)
     * -3 <= FI < 0: Penumbra (Zona de Indefinição / Risco moderado)
     * FI < -3: Insolvente (Zona de Perigo / Risco crítico)

8. PONTOS FORTES E VULNERABILIDADES / RISCOS FRENTE AOS CONCORRENTES:
   - Liste de forma clara e estruturada:
     * 🌟 Pontos Fortes e Vantagens Competitivas (onde a empresa supera a média do setor)
     * ⚠️ Riscos, Desvantagens e Gargalos (onde a empresa está abaixo da concorrência ou em zona crítica)

9. O MELHOR CAMINHO PARA MELHORAR OS RESULTADOS (PLANO DE AÇÃO PRÁTICO):
   - Apresente um plano de ação prioritário em etapas claras:
     a) Ações Imediatas (0 a 30 dias): estancar perdas de caixa, renegociação de prazos (PMR vs PMP), controle rigoroso de despesas operacionais.
     b) Ações de Médio Prazo (30 a 90 dias): otimização de margens, precificação/markup, revisão do ciclo financeiro, redução de custos fixos.
     c) Ações Estratégicas (90+ dias): desalavancagem de passivo oneroso, realocação de capital de giro e convergência para os melhores benchmarks da indústria.

TOM DE VOZ E FORMATAÇÃO:
- Linguagem profissional, executiva, objetiva, didática e motivadora.
- Use tabelas comparativas, listas com marcadores e destaques em negrito para facilitar a leitura executiva.
- Sempre cite os valores em formato brasileiro (R$ X.XXX,XX ou percentuais X,X% e prazos em X dias).
- Se o usuário especificar uma empresa e/ou ano, priorize a análise correspondente.
- Se dados estiverem zerados ou incompletos para algum período, aponte a limitação com transparência e recomende o preenchimento dos balancetes ou importação contábil.`,
      tools: [
        { collection: 'empresas', perms: { read: true, list: true } },
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
      memory: [
        {
          type: 'faq',
          payload: {
            qa: [
              {
                question: 'Como funciona o benchmarking setorial no diagnóstico financeiro?',
                answer:
                  'O benchmarking setorial confronta os índices financeiros da empresa analisada (Liquidez Corrente, Seca, Endividamento Geral, Margem Líquida, Margem EBITDA, ROE, ROA, Giro do Ativo, PMR, PMP, Ciclo Financeiro, CGL, NCG e Saldo de Tesouraria) com as medianas de mercado brasileiras do setor correspondente (ex.: Serviços, Comércio, Indústria, Tecnologia, Agronegócio, Construção Civil, Saúde, Educação, Financeiro). O objetivo é identificar vantagens competitivas e gargalos operacionais frente aos concorrentes do mesmo segmento.',
              },
              {
                question: 'Como o Modelo Fleuriet classifica a estrutura de capital de giro?',
                answer:
                  'O Modelo Fleuriet analisa a dinâmica do Capital de Giro Líquido (CGL = AC - PC), Necessidade de Capital de Giro (NCG = ACO - PCO) e Saldo de Tesouraria (ST = ACF - PCF = CGL - NCG). Classifica em 6 tipos: I (Excelente/Sólida com folga), II (Sólida com Financiamento Operacional), III (Em Crescimento/Tesouraria Pressionada), IV (Arriscada/Efeito Tesoura), V (Alto Risco) e VI (Crítica/Insolvência Iminente).',
              },
              {
                question: 'Como funciona o Termômetro de Insolvência de Stephen Kanitz?',
                answer:
                  'O Fator de Insolvência (FI) de Stephen Kanitz é uma função discriminante que prediz a saúde financeira: FI = (0,05*X1) + (1,65*X2) + (3,55*X3) - (1,06*X4) - (0,33*X5). Onde X1=Rentabilidade do PL (Lucro/PL), X2=Liquidez Geral ((AC+ARLP)/(PC+PNC)), X3=Liquidez Seca ((AC-Estoques)/PC), X4=Endividamento Total ((PC+PNC)/PL) e X5=Liquidez Corrente (AC/PC). Valores >= 0 indicam Solvência (Zona de Solvência/Baixo risco); entre -3 e 0 indicam Penumbra (Zona de Indefinição/Risco moderado); e < -3 indicam Insolvência iminente (Zona de Perigo).',
              },
              {
                question: 'O que é o Efeito Tesoura nas empresas?',
                answer:
                  'O Efeito Tesoura ocorre quando a Necessidade de Capital de Giro (NCG) cresce mais rápido que o Capital de Giro Líquido (CGL), gerando um Saldo de Tesouraria cada vez mais negativo e forçando a empresa a recorrer a empréstimos bancários onerosos de curto prazo para bancar a operação.',
              },
              {
                question:
                  'Como o agente deve agir se a empresa não tiver setor/segmento cadastrado?',
                answer:
                  'Quando a empresa não tiver setor informado no cadastro, o agente deve tentar deduzir a partir dos lançamentos, serviços, notas fiscais ou descrições, explicitando a ressalva de que utilizou o setor mais provável ou a média multissetorial (Outros/Geral), e solicitar ao usuário que confirme ou informe o setor para refinar o comparativo.',
              },
            ],
          },
        },
        {
          type: 'text',
          payload: {
            text: `TABELA OFICIAL DE BENCHMARKS SETORIAIS DE MERCADO NO BRASIL (MEDIANAS DE REFERÊNCIA):

1. SETOR DE SERVIÇOS (Consultorias, Terceirização, B2B, Serviços Corporativos):
- Liquidez Corrente: 1,65 | Liquidez Seca: 1,60 | Liquidez Imediata: 0,35 | Liquidez Geral: 1,45
- Endividamento Geral: 42,0% | Composição Endividamento: 60,0% | Capital Terceiros/PL: 72,0% | Imobilização do PL: 30,0%
- Autonomia Financeira: 58,0% | Dívida/Equity: 0,72x
- Margem Bruta: 45,0% | Margem Operacional (EBIT): 18,0% | Margem Líquida: 14,0% | Margem EBITDA: 22,0%
- Retorno sobre Ativo (ROA): 12,5% | Retorno sobre PL (ROE): 21,0% | Giro do Ativo: 1,10x | Cobertura de Juros: 4,5x
- Prazo Médio Estocagem (PME): 5 dias | Prazo Médio Recebimento (PMR): 38 dias | Prazo Médio Pagamento (PMP): 28 dias
- Ciclo Operacional: 43 dias | Ciclo Financeiro: 15 dias | ROIC: 18,5% | WACC: 12,0% | Spread Econômico: +6,5%
- Dinâmica de Giro: CGL tipicamente positivo, NCG baixa a moderada, Saldo de Tesouraria positivo com baixa necessidade de estoques.

2. SETOR DE COMÉRCIO (Varejo, Atacado, Lojas e Distribuição Mercantil):
- Liquidez Corrente: 1,35 | Liquidez Seca: 0,75 | Liquidez Imediata: 0,15 | Liquidez Geral: 1,15
- Endividamento Geral: 58,0% | Composição Endividamento: 65,0% (predomínio de curto prazo) | Capital Terceiros/PL: 138,0% | Imobilização do PL: 45,0%
- Autonomia Financeira: 42,0% | Dívida/Equity: 1,38x
- Margem Bruta: 32,0% | Margem Operacional (EBIT): 8,0% | Margem Líquida: 5,5% | Margem EBITDA: 11,0%
- Retorno sobre Ativo (ROA): 7,5% | Retorno sobre PL (ROE): 16,0% | Giro do Ativo: 1,45x | Cobertura de Juros: 2,8x
- Prazo Médio Estocagem (PME): 50 dias | Prazo Médio Recebimento (PMR): 32 dias | Prazo Médio Pagamento (PMP): 42 dias
- Ciclo Operacional: 82 dias | Ciclo Financeiro: 40 dias | ROIC: 13,0% | WACC: 12,0% | Spread Econômico: +1,0%
- Dinâmica de Giro: Elevada NCG em estoques e cartões; depende de giro rápido de estoque e crédito de fornecedores (PMP alto).

3. SETOR DE INDÚSTRIA (Manufatura, Transformação, Metalurgia, Alimentos, Bens de Consumo):
- Liquidez Corrente: 1,45 | Liquidez Seca: 0,95 | Liquidez Imediata: 0,18 | Liquidez Geral: 1,25
- Endividamento Geral: 52,0% | Composição Endividamento: 48,0% | Capital Terceiros/PL: 110,0% | Imobilização do PL: 68,0% (parque fabril pesado)
- Autonomia Financeira: 48,0% | Dívida/Equity: 1,08x
- Margem Bruta: 28,0% | Margem Operacional (EBIT): 11,5% | Margem Líquida: 7,2% | Margem EBITDA: 16,5%
- Retorno sobre Ativo (ROA): 6,8% | Retorno sobre PL (ROE): 14,5% | Giro do Ativo: 0,95x | Cobertura de Juros: 3,2x
- Prazo Médio Estocagem (PME): 65 dias | Prazo Médio Recebimento (PMR): 48 dias | Prazo Médio Pagamento (PMP): 45 dias
- Ciclo Operacional: 113 dias | Ciclo Financeiro: 68 dias | ROIC: 11,5% | WACC: 12,0% | Spread Econômico: -0,5%
- Dinâmica de Giro: Ciclo longo por matérias-primas e produtos em processo; exige CGL robusto para cobrir NCG industrial.

4. SETOR DE TECNOLOGIA & SAAS (Software, TI, Startups, Cloud, Soluções Digitais):
- Liquidez Corrente: 2,10 | Liquidez Seca: 2,05 | Liquidez Imediata: 0,65 | Liquidez Geral: 1,85
- Endividamento Geral: 35,0% | Composição Endividamento: 55,0% | Capital Terceiros/PL: 54,0% | Imobilização do PL: 25,0%
- Autonomia Financeira: 65,0% | Dívida/Equity: 0,54x
- Margem Bruta: 68,0% | Margem Operacional (EBIT): 24,0% | Margem Líquida: 18,5% | Margem EBITDA: 28,0%
- Retorno sobre Ativo (ROA): 15,0% | Retorno sobre PL (ROE): 24,0% | Giro do Ativo: 0,85x | Cobertura de Juros: 6,0x
- Prazo Médio Estocagem (PME): 0 dias | Prazo Médio Recebimento (PMR): 30 dias | Prazo Médio Pagamento (PMP): 25 dias
- Ciclo Operacional: 30 dias | Ciclo Financeiro: 5 dias | ROIC: 22,0% | WACC: 12,0% | Spread Econômico: +10,0%
- Dinâmica de Giro: Caixa abundante, ausência de estoques físicos, receita recorrente (MRR/ARR), alta geração livre de caixa.

5. SETOR DE CONSTRUÇÃO CIVIL & ENGENHARIA (Incorporação, Obras, Infraestrutura):
- Liquidez Corrente: 1,30 | Liquidez Seca: 0,65 | Liquidez Imediata: 0,12 | Liquidez Geral: 1,15
- Endividamento Geral: 60,0% | Composição Endividamento: 45,0% | Capital Terceiros/PL: 150,0% | Imobilização do PL: 55,0%
- Autonomia Financeira: 40,0% | Dívida/Equity: 1,50x
- Margem Bruta: 24,0% | Margem Operacional (EBIT): 10,0% | Margem Líquida: 6,5% | Margem EBITDA: 14,0%
- Retorno sobre Ativo (ROA): 5,5% | Retorno sobre PL (ROE): 13,5% | Giro do Ativo: 0,75x | Cobertura de Juros: 2,6x
- Prazo Médio Estocagem (PME): 120 dias | Prazo Médio Recebimento (PMR): 75 dias | Prazo Médio Pagamento (PMP): 65 dias
- Ciclo Operacional: 195 dias | Ciclo Financeiro: 130 dias | ROIC: 9,5% | WACC: 12,0% | Spread Econômico: -2,5%
- Dinâmica de Giro: Ciclos muito longos (obras de 12 a 36 meses), NCG altíssima em terrenos e obras em andamento, dependente de financiamento à produção (Plano Empresário/SFH).

6. SETOR DE SAÚDE & DIAGNÓSTICO (Hospitais, Clínicas, Laboratórios, Medicina Diagnóstica):
- Liquidez Corrente: 1,50 | Liquidez Seca: 1,35 | Liquidez Imediata: 0,22 | Liquidez Geral: 1,30
- Endividamento Geral: 48,0% | Composição Endividamento: 52,0% | Capital Terceiros/PL: 92,0% | Imobilização do PL: 60,0% (equipamentos hospitalares)
- Autonomia Financeira: 52,0% | Dívida/Equity: 0,92x
- Margem Bruta: 35,0% | Margem Operacional (EBIT): 14,0% | Margem Líquida: 9,5% | Margem EBITDA: 19,0%
- Retorno sobre Ativo (ROA): 8,0% | Retorno sobre PL (ROE): 16,5% | Giro do Ativo: 0,90x | Cobertura de Juros: 3,8x
- Prazo Médio Estocagem (PME): 25 dias | Prazo Médio Recebimento (PMR): 65 dias (glosas e prazos de convênios/operadoras) | Prazo Médio Pagamento (PMP): 40 dias
- Ciclo Operacional: 90 dias | Ciclo Financeiro: 50 dias | ROIC: 12,5% | WACC: 12,0% | Spread Econômico: +0,5%
- Dinâmica de Giro: Pressão de NCG provocada pelo descasamento entre o recebimento de planos de saúde (PMR 60-90 dias) e pagamento de folha médica e insumos.

7. SETOR DE AGRONEGÓCIO & AGROINDÚSTRIA (Produção Agrícola, Pecuária, Grãos):
- Liquidez Corrente: 1,40 | Liquidez Seca: 0,80 | Liquidez Imediata: 0,15 | Liquidez Geral: 1,20
- Endividamento Geral: 55,0% | Composição Endividamento: 40,0% | Capital Terceiros/PL: 122,0% | Imobilização do PL: 75,0% (terras, maquinários, pivôs)
- Autonomia Financeira: 45,0% | Dívida/Equity: 1,22x
- Margem Bruta: 26,0% | Margem Operacional (EBIT): 12,0% | Margem Líquida: 8,5% | Margem EBITDA: 18,0%
- Retorno sobre Ativo (ROA): 6,5% | Retorno sobre PL (ROE): 14,0% | Giro do Ativo: 0,80x | Cobertura de Juros: 2,9x
- Prazo Médio Estocagem (PME): 90 dias | Prazo Médio Recebimento (PMR): 60 dias | Prazo Médio Pagamento (PMP): 60 dias
- Ciclo Operacional: 150 dias | Ciclo Financeiro: 90 dias | ROIC: 10,5% | WACC: 12,0% | Spread Econômico: -1,5%
- Dinâmica de Giro: Forte sazonalidade de safras, CPRs, financiamento de insumos e ciclo biológico estendido.

8. SETOR DE EDUCAÇÃO (Escolas, Faculdades, Cursos Livres, Edtechs):
- Liquidez Corrente: 1,40 | Liquidez Seca: 1,38 | Liquidez Imediata: 0,30 | Liquidez Geral: 1,25
- Endividamento Geral: 46,0% | Composição Endividamento: 62,0% | Capital Terceiros/PL: 85,0% | Imobilização do PL: 65,0% (campi e instalações)
- Autonomia Financeira: 54,0% | Dívida/Equity: 0,85x
- Margem Bruta: 42,0% | Margem Operacional (EBIT): 15,0% | Margem Líquida: 11,0% | Margem EBITDA: 20,0%
- Retorno sobre Ativo (ROA): 9,0% | Retorno sobre PL (ROE): 17,0% | Giro do Ativo: 0,85x | Cobertura de Juros: 4,0x
- Prazo Médio Estocagem (PME): 5 dias | Prazo Médio Recebimento (PMR): 42 dias (mensalidades e inadimplência sazonal) | Prazo Médio Pagamento (PMP): 30 dias
- Ciclo Operacional: 47 dias | Ciclo Financeiro: 17 dias | ROIC: 14,0% | WACC: 12,0% | Spread Econômico: +2,0%

9. SETOR FINANCEIRO & FINTECHS (Serviços Financeiros, Factoring, Securitizadoras, Meios de Pagamento):
- Liquidez Corrente: 1,80 | Liquidez Seca: 1,80 | Liquidez Imediata: 0,70 | Liquidez Geral: 1,60
- Endividamento Geral: 45,0% | Composição Endividamento: 50,0% | Capital Terceiros/PL: 82,0% | Imobilização do PL: 20,0%
- Autonomia Financeira: 55,0% | Dívida/Equity: 0,82x
- Margem Bruta: 55,0% | Margem Operacional (EBIT): 22,0% | Margem Líquida: 16,0% | Margem EBITDA: 25,0%
- Retorno sobre Ativo (ROA): 11,0% | Retorno sobre PL (ROE): 20,0% | Giro do Ativo: 0,70x | Cobertura de Juros: 5,5x
- Prazo Médio Estocagem (PME): 0 dias | Prazo Médio Recebimento (PMR): 25 dias | Prazo Médio Pagamento (PMP): 20 dias
- Ciclo Operacional: 25 dias | Ciclo Financeiro: 5 dias | ROIC: 17,0% | WACC: 12,0% | Spread Econômico: +5,0%

10. MÉDIA MULTISSETORIAL GERAL / OUTROS:
- Liquidez Corrente: 1,40 | Liquidez Seca: 1,00 | Liquidez Imediata: 0,20 | Liquidez Geral: 1,25
- Endividamento Geral: 50,0% | Composição Endividamento: 55,0% | Capital Terceiros/PL: 100,0% | Imobilização do PL: 50,0%
- Autonomia Financeira: 50,0% | Dívida/Equity: 1,00x
- Margem Bruta: 35,0% | Margem Operacional (EBIT): 12,0% | Margem Líquida: 8,0% | Margem EBITDA: 17,0%
- Retorno sobre Ativo (ROA): 7,5% | Retorno sobre PL (ROE): 15,0% | Giro do Ativo: 1,00x | Cobertura de Juros: 3,5x
- Prazo Médio Estocagem (PME): 45 dias | Prazo Médio Recebimento (PMR): 45 dias | Prazo Médio Pagamento (PMP): 40 dias
- Ciclo Operacional: 90 dias | Ciclo Financeiro: 50 dias | ROIC: 12,0% | WACC: 12,0% | Spread Econômico: 0,0%

RESSALVA METODOLÓGICA OBRIGATÓRIA:
Os parâmetros acima refletem medianas consolidadas de mercado no Brasil (base de dados econômico-financeiros setoriais, CVM, Serasa Experian, IBGE e publicações especializadas de finanças corporativas). Devem ser interpretados como parâmetros referenciais e comparativos relativos, considerando as particularidades de porte, modelo de negócios e região de cada empresa.`,
          },
        },
      ],
    })
  },
  (app) => {
    // Mantém o agente, ou pode deletar caso revertido
    $ai.agents.delete(app, 'diagnostico-financeiro')
  },
)
