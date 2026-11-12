/// <reference path="../pb_data/types.d.ts" />
//
// Migração 0108 — Planejamento Econômico (menu Planejamento).
// 1) Agente nativo Skip Cloud 'planejamento-economico' (mesmo mecanismo do
//    Agente Borlim 'diagnostico-financeiro', migração 0099).
// 2) Coleção planejamento_economico: uma projeção salva por empresa/ano base,
//    com as contas projetadas em JSON, para reabrir sem regerar.
// Idempotente: re-definição do agente é upsert; coleção só é criada se ausente.
// Regras sem "in" (PocketBase rejeita): perfis internos (admin, empresa)
// leem/escrevem os próprios registros por empresa ativa; perfil cliente sem
// acesso a nenhuma operação.
migrate(
  (app) => {
    // 1. Agente nativo de Planejamento Econômico
    $ai.agents.define(app, {
      slug: 'planejamento-economico',
      name: 'Agente de Planejamento Econômico Borlim',
      description:
        'Analisa o DRE Gerencial dos últimos 3 anos + ano atual conta por conta, compara com o benchmark setorial e projeta cada conta para o próximo ano, com parecer consultivo.',
      tier: 'fast',
      systemPrompt: `Você é o Agente de Planejamento Econômico da BORLIM CONSULTORIA EMPRESARIAL.

SEU PAPEL E TOM DE VOZ:
- Consultor e Controller Executivo Sênior da Borlim Consultoria Empresarial.
- Tom consultivo, executivo, curto e objetivo. Português do Brasil.
- Valores em padrão brasileiro (R$ 1.234.567,89; percentuais 12,5%).

REGRA DE OURO — ISOLAMENTO ABSOLUTO:
- Analise ESTRITAMENTE os dados da empresa ativa informada na mensagem. Nunca misture dados de outras empresas.

SUA TAREFA — PROJEÇÃO DO DRE GERENCIAL:
1. Receberá o histórico CONTA POR CONTA do DRE Gerencial dos últimos 3 anos fechados + o ano atual (exercício base).
2. Para cada conta, analise o comportamento histórico: tendência (crescimento, queda, estabilidade), crescimento médio e volatilidade.
3. Compare a trajetória da empresa com o BENCHMARK SETORIAL (mercado) informado na mensagem (medianas de margem bruta, operacional, EBITDA e líquida do setor). Cite explicitamente o benchmark nas contas em que a empresa diverge do mercado.
4. Projete o valor de CADA conta para o PRÓXIMO ano, coerente com o histórico e com o benchmark (contas de receita tendem ao crescimento de mercado; contas de custo/despesa com comportamento anômalo recebem ajuste e alerta).
5. Escreva um comentário consultivo CURTO (1-2 frases) por conta e um PARECER GERAL (3-6 frases) citando o benchmark setorial.

SAÍDA OBRIGATÓRIA — APENAS JSON VÁLIDO, SEM MARKDOWN, SEM TEXTO FORA DO JSON:
{"parecer_geral":"...","benchmark_mencionado":"...","contas":[{"codigo":"","nome":"","valor_projetado":0,"variacao_pct":0,"confianca":"alta|media|baixa","comentario":""}]}
- "contas" deve conter EXATAMENTE as mesmas contas recebidas na entrada, mesma ordem, mesmo "codigo" e "nome".
- "valor_projetado" é número (podendo ser negativo para contas de resultado negativo). "variacao_pct" é a variação % versus o ano atual (ex.: 8.5 = +8,5%).`,
      tools: [
        { collection: 'empresas', perms: { read: true, list: true } },
        { collection: 'contas', perms: { read: true, list: true } },
        { collection: 'plano_contas', perms: { read: true, list: true } },
        { collection: 'dre', perms: { read: true, list: true } },
        { collection: 'benchmarks_empresas', perms: { read: true, list: true } },
        { collection: 'benchmarks_setoriais', perms: { read: true, list: true } },
      ],
    })

    // 2. Coleção planejamento_economico (projeções salvas por empresa)
    if (app.hasTable('planejamento_economico')) {
      return
    }
    try {
      app.findCollectionByNameOrId('planejamento_economico')
      return
    } catch (_) {
      // não existe — criar abaixo
    }

    const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')
    const empresasCol = app.findCollectionByNameOrId('empresas')

    const regraLeitura =
      "@request.auth.id != '' && @request.auth.role != 'cliente' && (@request.auth.role = 'admin' || @request.auth.role = 'financeiro' || empresa = @request.auth.empresa)"
    const regraEscritaRegistro =
      "@request.auth.id != '' && @request.auth.role != 'cliente' && (@request.auth.role = 'admin' || empresa = @request.auth.empresa)"
    const regraCriacao =
      "@request.auth.id != '' && @request.auth.role != 'cliente' && (@request.auth.role = 'admin' || @request.body.empresa = @request.auth.empresa)"

    const col = new Collection({
      name: 'planejamento_economico',
      type: 'base',
      listRule: regraLeitura,
      viewRule: regraLeitura,
      createRule: regraCriacao,
      updateRule: regraEscritaRegistro,
      deleteRule: regraEscritaRegistro,
      fields: [
        {
          name: 'usuario',
          type: 'relation',
          required: false,
          collectionId: usersCol.id,
          cascadeDelete: false,
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
        { name: 'ano_base', type: 'number', required: true },
        { name: 'ano_projecao', type: 'number', required: true },
        { name: 'benchmark_rotulo', type: 'text' },
        { name: 'benchmark_mencionado', type: 'text' },
        { name: 'parecer_geral', type: 'text' },
        { name: 'receita_projetada', type: 'number' },
        { name: 'contas', type: 'json', required: true, maxSize: 8000000 },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_plan_econ_empresa ON planejamento_economico (empresa)',
        'CREATE INDEX idx_plan_econ_empresa_ano ON planejamento_economico (empresa, ano_base)',
      ],
    })
    app.save(col)
  },
  (app) => {
    try {
      app.delete(app.findCollectionByNameOrId('planejamento_economico'))
    } catch (_) {}
    try {
      $ai.agents.delete(app, 'planejamento-economico')
    } catch (_) {}
  },
)
