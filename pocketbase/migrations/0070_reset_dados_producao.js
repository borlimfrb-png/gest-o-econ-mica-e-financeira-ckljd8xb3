/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    // Reset completo dos dados das coleções de domínio para início da produção.
    // Preserva integralmente o schema, índices, regras de acesso, hooks e jobs agendados.
    // Preserva o usuário Admin flavio@borlim.com.br e suas credenciais.
    console.log('--- INICIANDO RESET DE DADOS DE PRODUÇÃO ---')

    // Desabilitar foreign keys temporariamente durante a limpeza para evitar travas de dependência
    try {
      app.db().newQuery('PRAGMA foreign_keys = OFF').execute()
    } catch (e) {
      console.log('Aviso ao alterar PRAGMA foreign_keys:', e)
    }

    // 1. Desvincular campo empresa do usuário admin antes da limpeza
    try {
      app
        .db()
        .newQuery("UPDATE users SET empresa = '' WHERE email = 'flavio@borlim.com.br'")
        .execute()
    } catch (e) {
      console.log('Aviso ao desvincular empresa do usuário admin:', e)
    }

    // Lista ordenada de coleções do domínio da aplicação para reset
    const domainCollections = [
      'auditoria_seguranca',
      'auditoria_lancamentos',
      'auditoria_cadastros',
      'alertas_enviados',
      'bi_apresentacoes',
      'bsc_iniciativas_historico',
      'bsc_iniciativas',
      'bsc_kpis',
      'simulador_cenarios',
      'historico_precos_produtos',
      'fichas_tecnicas',
      'materias_primas',
      'produtos',
      'memoria_fornecedores_despesas',
      'plano_contas_mapeamentos',
      'lancamentos',
      'lancamentos_recorrentes',
      'lancamentos_centro',
      'metas_lancamentos',
      'plano_contas',
      'contas',
      'tipos_despesa',
      'centros',
      'recebiveis',
      'notas_fiscais',
      'nfse_tomadores',
      'certificados_digitais',
      'contratos',
      'configuracoes_tributarias',
      'benchmarks_empresas',
      'benchmarks_setoriais',
      'balancos',
      'dre',
      'grupos_empresariais',
      'minha_empresa',
      'empresas',
    ]

    const report = {}

    // 2. Apagar registros de cada coleção de domínio
    for (let i = 0; i < domainCollections.length; i++) {
      const colName = domainCollections[i]
      try {
        if (app.hasTable(colName)) {
          // Contar registros antes de apagar
          let count = 0
          try {
            count = app.countRecords(colName)
          } catch (_) {
            count = 0
          }

          // Executar DELETE
          app.db().newQuery(`DELETE FROM ${colName}`).execute()
          report[colName] = count
          console.log(`[RESET] Coleção '${colName}': ${count} registros removidos.`)
        } else {
          report[colName] = 0
          console.log(`[RESET] Coleção '${colName}' não encontrada no banco (ignorado).`)
        }
      } catch (err) {
        console.log(`[RESET ERRO] Falha ao limpar coleção '${colName}':`, err)
      }
    }

    // 3. Limpar usuários que NÃO sejam o admin principal flavio@borlim.com.br
    let usersRemoved = 0
    try {
      if (app.hasTable('users')) {
        const adminEmail = 'flavio@borlim.com.br'

        // Contar quantos usuários de teste/outros existem
        try {
          const allUsers = app.findRecordsByFilter('users', `email != '${adminEmail}'`, '', 1000, 0)
          usersRemoved = allUsers ? allUsers.length : 0
        } catch (_) {
          usersRemoved = 0
        }

        // Deletar usuários que não são o admin principal
        app.db().newQuery("DELETE FROM users WHERE email != 'flavio@borlim.com.br'").execute()

        // Garantir que o usuário flavio@borlim.com.br está ativo e com perfil 'admin'
        app
          .db()
          .newQuery(
            "UPDATE users SET role = 'admin', ativo = 1, empresa = '' WHERE email = 'flavio@borlim.com.br'",
          )
          .execute()

        report['users_removidos'] = usersRemoved
        console.log(
          `[RESET] Usuários de demonstração removidos: ${usersRemoved}. Admin flavio@borlim.com.br preservado.`,
        )
      }
    } catch (userErr) {
      console.log('[RESET ERRO] Falha ao limpar usuários demo:', userErr)
    }

    // Reabilitar foreign keys
    try {
      app.db().newQuery('PRAGMA foreign_keys = ON').execute()
    } catch (e) {
      console.log('Aviso ao restaurar PRAGMA foreign_keys:', e)
    }

    console.log('--- RESET DE DADOS DE PRODUÇÃO CONCLUÍDO COM SUCESSO ---')
    console.log('Relatório de exclusão:', JSON.stringify(report))
  },
  (app) => {
    // Reset irreversível de dados - no rollback de dados
    console.log(
      'Rollback da migração de reset 0070 (nenhuma ação requerida, operação idempotente).',
    )
  },
)
