import { buildApp } from './app.ts';
import { loadClaudeQuery } from './claude/sdk.ts';
import { loadConfig } from './config.ts';
import { createAccServer } from './server.ts';

const config = loadConfig();
const query = config.mode === 'real' ? await loadClaudeQuery() : undefined;
const { repo, bus, engine } = buildApp(config, { query });
const { server, close } = createAccServer({ engine, repo, bus, mode: config.mode, token: config.token, allowedOrigin: config.allowedOrigin });

server.listen(config.port, config.host, () => {
  const banner =
    config.mode === 'demo'
      ? 'MODO DEMONSTRAÇÃO — nenhuma IA é chamada, nada é executado de verdade'
      : `MODO REAL — Claude Code (${config.model}), workspaces em ${config.workspacesDir}`;
  console.log(`\n  AI Command Center — orquestrador`);
  console.log(`  ${banner}`);
  console.log(`  API:       http://${config.host}:${config.port}/api`);
  console.log(`  WebSocket: ws://${config.host}:${config.port}/ws`);
  if (config.mode === 'real') {
    console.log(`  Orçamento: US$ ${config.taskBudgetUsd} por tarefa, US$ ${config.projectBudgetUsd} por projeto, US$ ${config.planBudgetUsd} por plano`);
    console.log(`  Sandbox do Bash: ${config.sandbox}${config.sandbox === 'off' ? ' (DESLIGADO)' : ''} · concorrência: ${config.maxConcurrency}`);
    if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) {
      console.log('  Sem ANTHROPIC_API_KEY: será usado o login do Claude Code desta máquina (claude login).');
    }
  }
  if (config.tokenGenerated) {
    console.log(`\n  ACC_TOKEN não definido; token temporário desta sessão:\n  ${config.token}\n  Defina ACC_TOKEN no arquivo .env para mantê-lo fixo.`);
  }
});

async function shutdown() {
  console.log('\nEncerrando…');
  await close();
  repo.close();
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
