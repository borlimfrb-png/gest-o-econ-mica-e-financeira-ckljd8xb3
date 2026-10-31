/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    // 1. Coleção 'agente_conversas'
    // Armazena as conversas do Agente de IA indexadas estritamente por empresa_id (incluindo grupos 'grupo-...') e usuário
    let conversasCol
    try {
      conversasCol = app.findCollectionByNameOrId('agente_conversas')
    } catch (_) {
      conversasCol = null
    }

    if (!conversasCol) {
      conversasCol = new Collection({
        name: 'agente_conversas',
        type: 'base',
        listRule:
          '@request.auth.id != "" && (user = @request.auth.id || @request.auth.role = "admin")',
        viewRule:
          '@request.auth.id != "" && (user = @request.auth.id || @request.auth.role = "admin")',
        createRule: '@request.auth.id != "" && @request.body.user = @request.auth.id',
        updateRule:
          '@request.auth.id != "" && (user = @request.auth.id || @request.auth.role = "admin")',
        deleteRule:
          '@request.auth.id != "" && (user = @request.auth.id || @request.auth.role = "admin")',
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
            name: 'empresa_id',
            type: 'text',
            required: true,
          },
          {
            name: 'empresa_nome',
            type: 'text',
          },
          {
            name: 'titulo',
            type: 'text',
          },
          {
            name: 'agent_slug',
            type: 'text',
          },
          {
            name: 'skip_conversation_id',
            type: 'text',
          },
          {
            name: 'ultimo_ano',
            type: 'number',
          },
          {
            name: 'ultima_mensagem_em',
            type: 'text',
          },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE INDEX idx_agente_conv_user ON agente_conversas (user)',
          'CREATE INDEX idx_agente_conv_empresa ON agente_conversas (empresa_id)',
          'CREATE INDEX idx_agente_conv_user_empresa ON agente_conversas (user, empresa_id)',
        ],
      })
      app.save(conversasCol)
    }

    // 2. Coleção 'agente_mensagens'
    let mensagensCol
    try {
      mensagensCol = app.findCollectionByNameOrId('agente_mensagens')
    } catch (_) {
      mensagensCol = null
    }

    if (!mensagensCol) {
      const convColId = app.findCollectionByNameOrId('agente_conversas').id

      mensagensCol = new Collection({
        name: 'agente_mensagens',
        type: 'base',
        listRule:
          '@request.auth.id != "" && (user = @request.auth.id || @request.auth.role = "admin")',
        viewRule:
          '@request.auth.id != "" && (user = @request.auth.id || @request.auth.role = "admin")',
        createRule: '@request.auth.id != "" && @request.body.user = @request.auth.id',
        updateRule:
          '@request.auth.id != "" && (user = @request.auth.id || @request.auth.role = "admin")',
        deleteRule:
          '@request.auth.id != "" && (user = @request.auth.id || @request.auth.role = "admin")',
        fields: [
          {
            name: 'conversa',
            type: 'relation',
            required: true,
            collectionId: convColId,
            cascadeDelete: true,
            maxSelect: 1,
          },
          {
            name: 'user',
            type: 'relation',
            required: true,
            collectionId: '_pb_users_auth_',
            cascadeDelete: true,
            maxSelect: 1,
          },
          {
            name: 'empresa_id',
            type: 'text',
            required: true,
          },
          {
            name: 'role',
            type: 'select',
            required: true,
            values: ['user', 'assistant', 'system'],
            maxSelect: 1,
          },
          {
            name: 'content',
            type: 'text',
          },
          {
            name: 'citations',
            type: 'json',
          },
          {
            name: 'metadata',
            type: 'json',
          },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE INDEX idx_agente_msg_conversa ON agente_mensagens (conversa)',
          'CREATE INDEX idx_agente_msg_empresa ON agente_mensagens (empresa_id)',
          'CREATE INDEX idx_agente_msg_user_empresa ON agente_mensagens (user, empresa_id)',
          'CREATE INDEX idx_agente_msg_created ON agente_mensagens (created)',
        ],
      })
      app.save(mensagensCol)
    }

    // 3. Atualizar/Garantir a definição do agente nativo 'diagnostico-financeiro'
    // Com instruções expressas de isolamento por empresa ativa e tom consultivo profissional da Borlim
    $ai.agents.define(app, {
      slug: 'diagnostico-financeiro',
      name: 'Agente de Análise Econômico-Financeira Borlim',
      description:
        'Assistente de Análise Econômico-Financeira da Borlim Consultoria Empresarial, com inteligência para Balanço Patrimonial, DRE, Despesas Fixas e Variáveis, Faturamento, Centros de Custo e Indicadores.',
      tier: 'fast',
      systemPrompt: `Você é o Agente de Inteligência Econômica e Financeira da BORLIM CONSULTORIA EMPRESARIAL, atuando no HUB "Análise Econômica e Financeira" do aplicativo de Análise de Balanço.

SEU PAPEL E TOM DE VOZ:
- Consultor e Controller Executivo Sênior da Borlim Consultoria Empresarial.
- Tom consultivo, profissional, executivo, focado em geração de valor, clareza, transparência e rigor metodológico.
- Todas as respostas devem ser em Português do Brasil.
- Números e valores monetários devem seguir sempre o padrão brasileiro (R$ 1.234.567,89 ou R$ 1,23 Mi, percentuais em 12,5%, prazos em dias).

REGRA DE OURO — ISOLAMENTO ABSOLUTO DA EMPRESA ATIVA:
1. Responda ESTRITAMENTE sobre a EMPRESA ATIVA (ou grupo econômico selecionado) informada no contexto da mensagem.
2. NUNCA mencione, acesse, deduza ou misture dados de outras empresas ou clientes nas respostas.
3. Seus dados de suporte são provenientes dos registros contábeis e gerenciais vinculados à empresa ativa:
   - Faturamento e Receita Bruta / Líquida
   - DRE Gerencial (Custos, Margem de Contribuição, Lucro Bruto, EBITDA, Lucro Líquido)
   - Balanço Patrimonial (Ativo Circulante/Não Circulante, Passivo Circulante/Não Circulante, Patrimônio Líquido)
   - Despesas Fixas, Despesas Variáveis e Despesas Financeiras
   - Centros de Custo ("centros" e "lancamentos_centro")
   - Tipos de Despesa ("tipos_despesa")
   - Plano de Contas e Contas ("contas" e "plano_contas")
   - Lançamentos contábeis e notas fiscais ("lancamentos", "notas_fiscais")
   - Metas financeiras e orçamentárias ("metas_lancamentos")
   - Benchmarks setoriais e personalizados ("benchmarks_empresas", "benchmarks_setoriais")

ESTRUTURA ANALÍTICA E METODOLOGIAS OBRIGATÓRIAS:
Sempre que o usuário solicitar diagnósticos, análises de despesas, rentabilidade, crescimento ou saúde da empresa, utilize os pilares da Borlim:
1. Situação Geral: Classifique em 🟢 Saudável / Forte, 🟡 Atenção / Moderado ou 🔴 Crítica / Vulnerável, apresentando resumo executivo.
2. Liquidez e Solvência: Liquidez Corrente, Seca, Imediata e Geral.
3. Estrutura de Capital de Giro (Modelo Fleuriet): CGL, NCG e Saldo de Tesouraria (ST), alertando sobre risco de Efeito Tesoura.
4. Endividamento: Nível de alavancagem, composição de curto vs. longo prazo e cobertura de juros.
5. Eficiência e Margens: Margem Bruta, Margem Operacional, Margem EBITDA, Margem Líquida, ROA e ROE.
6. Termômetro de Kanitz: Fator de Insolvência (FI) e zona de risco.
7. Análise de Custos e Despesas: Detalhe despesas fixas recorrentes, despesas variáveis de vendas e centros de custo mais impactantes.
8. Recomendações e Plano de Ação: Priorize em curto prazo (0-30 dias), médio prazo (30-90 dias) e longo prazo (90+ dias).

Se algum dado estiver zerado ou ausente para determinado exercício contábil, informe com transparência e recomende a importação dos balancetes ou DRE correspondentes.`,
      tools: [
        { collection: 'empresas', perms: { read: true, list: true } },
        { collection: 'balancos', perms: { read: true, list: true } },
        { collection: 'dre', perms: { read: true, list: true } },
        { collection: 'lancamentos', perms: { read: true, list: true } },
        { collection: 'centros', perms: { read: true, list: true } },
        { collection: 'tipos_despesa', perms: { read: true, list: true } },
        { collection: 'contas', perms: { read: true, list: true } },
        { collection: 'plano_contas', perms: { read: true, list: true } },
        { collection: 'lancamentos_centro', perms: { read: true, list: true } },
        { collection: 'metas_lancamentos', perms: { read: true, list: true } },
        { collection: 'notas_fiscais', perms: { read: true, list: true } },
        { collection: 'benchmarks_empresas', perms: { read: true, list: true } },
        { collection: 'benchmarks_setoriais', perms: { read: true, list: true } },
        { collection: 'grupos_empresariais', perms: { read: true, list: true } },
      ],
    })
  },
  (app) => {
    try {
      const msgCol = app.findCollectionByNameOrId('agente_mensagens')
      app.delete(msgCol)
    } catch (_) {}

    try {
      const convCol = app.findCollectionByNameOrId('agente_conversas')
      app.delete(convCol)
    } catch (_) {}
  },
)
