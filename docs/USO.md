# Guia de uso

## 1. Preparar

```bash
npm install
cp .env.example .env
```

No `.env`, defina **ACC_TOKEN** com um valor aleatório longo (por exemplo, a saída de `openssl rand -hex 24`).
Ele protege a comunicação entre a web e o orquestrador e é obrigatório para a web.

## 2. Escolher o modo

| | Demonstração (`ACC_MODE=demo`, padrão) | Real (`ACC_MODE=real`) |
|---|---|---|
| IA | nenhuma | Claude Code via Agent SDK (modelo `ACC_MODEL`, padrão Sonnet) |
| Arquivos | nenhum é criado | criados em `workspaces/<id-do-projeto>/` |
| Custo | zero | cobrado no seu login do Claude Code ou na `ANTHROPIC_API_KEY` |
| Banco | `data/demo.sqlite` | `data/real.sqlite` |
| Na tela | faixa amarela “MODO DEMONSTRAÇÃO” | faixa vermelha “MODO REAL” |

Os modos nunca se misturam. Para trocar, pare tudo, mude `ACC_MODE` e inicie de novo.
No modo real, faça `claude login` (ou defina `ANTHROPIC_API_KEY`) e revise os limites de custo do `.env`.

## 3. Iniciar

```bash
npm run dev        # orquestrador (127.0.0.1:4317) + web (http://localhost:3000)
```

## 4. Usar

1. **Prédio** (`/`): veja os agentes. Clique num personagem (ou no nome abaixo do prédio) para ver o que ele faz agora,
   o histórico, os arquivos, os testes, os erros e os detalhes da execução.
2. **Criar projeto**: descreva o sistema desejado. A coordenadora (Ada) vai para a sala de reunião e monta o plano.
3. **Aprovar o plano** na fila de aprovação (prédio ou Central de Comando → Aprovações). Nada é executado antes disso.
   No modo real o pedido mostra o custo estimado.
4. **Acompanhar**: os agentes trabalham na ordem das dependências. Pedidos de ações de risco (instalar dependência,
   excluir, publicar, acessar a rede…) aparecem na fila; o agente fica com a mão levantada até você decidir.
   Para rejeitar, informe o motivo — o agente recebe a recusa e segue sem a ação.
5. **Central de Comando** (`/command`): indicadores, projetos (pausar, retomar, cancelar), agentes, aprovações e
   histórico de decisões, erros, custos e logs com filtros. **Pausar todas as execuções** interrompe tudo de uma vez.
6. **Resultado**: no detalhe do projeto, “Artefatos entregues” lista tudo o que foi criado ou alterado e mostra a pasta
   do projeto (modo real).

Dica do modo demonstração: inclua `#erro` na descrição para ver o fluxo de erro.

## 5. Manutenção

| Comando | Para quê |
|---|---|
| `npm run reset:demo` | apaga os dados da demonstração (com o orquestrador parado). O banco real nunca é apagado por esse comando. |
| `npm test` | testes automatizados (sem IA) |
| `npm run build && npm run test:e2e` | teste ponta a ponta no navegador, com capturas em `e2e/screenshots/` (precisa do Playwright) |

Se o orquestrador for encerrado (Ctrl+C), os projetos em execução são **pausados** e as execuções ficam registradas como
interrompidas. Ao voltar, a web reconecta sozinha; retome os projetos pela Central de Comando.

## 6. Configuração (`.env`)

| Variável | Padrão | Descrição |
|---|---|---|
| `ACC_MODE` | `demo` | `demo` ou `real` |
| `ACC_TOKEN` | — | token local entre web e orquestrador (obrigatório para a web) |
| `ACC_PORT` | `4317` | porta do orquestrador (sempre em 127.0.0.1) |
| `ACC_ALLOWED_ORIGIN` | `http://localhost:3000` | origem aceita pelo orquestrador |
| `ACC_MAX_CONCURRENCY` | 2 (demo) / 1 (real) | tarefas simultâneas |
| `ACC_DEMO_SPEED` | `1` | velocidade da demonstração |
| `ACC_MODEL` | `sonnet` | modelo dos agentes no modo real |
| `ACC_TASK_BUDGET_USD` | `0.5` | custo máximo por tarefa |
| `ACC_PROJECT_BUDGET_USD` | `2` | orçamento padrão por projeto (pausa ao atingir) |
| `ACC_PLAN_BUDGET_USD` | `0.3` | custo máximo do planejamento |
| `ACC_MAX_TURNS` | `40` | turnos máximos por tarefa |
| `ACC_SANDBOX` | `auto` | sandbox do Bash: `auto`, `required` ou `off` |
| `ACC_PRICE_INPUT_PER_MTOK` / `ACC_PRICE_OUTPUT_PER_MTOK` | `2` / `10` | preço do modelo para a estimativa (Sonnet 5.5) |
| `ACC_WORKSPACES_DIR` | `workspaces` | pasta dos projetos do modo real |
| `ACC_DATA_DIR` | `data` | pasta dos bancos |
| `ACC_CLAUDE_PATH` | — | caminho do executável do Claude Code, se necessário |

## 7. API do orquestrador

Todas as rotas exigem `Authorization: Bearer <ACC_TOKEN>`.

### Rotas

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/health` | modo atual |
| GET | `/api/snapshot` | estado completo + último número de sequência |
| GET | `/api/events?after=&before=&types=&projectId=&agentId=&taskId=&runId=&limit=` | histórico de eventos (`before` pagina para trás) |
| POST | `/api/projects` | criar projeto `{name, description, budgetUsd?}` |
| GET | `/api/projects/:id` | projeto, tarefas e aprovações |
| POST | `/api/projects/:id/pause` · `/resume` · `/cancel` | controle de execução |
| POST | `/api/pause-all` | pausa todos os projetos em execução |
| POST | `/api/approvals/:id` | `{decision: "approve" \| "reject", reason?}` |
| GET | `/api/agents/:id` | agente + histórico de atividades |
| GET | `/api/runs/:id` | detalhes de uma execução (todos os eventos) |
| WS | `/ws?token=` | `hello` e depois cada evento em tempo real |
