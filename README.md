# AI Command Center

Empresa virtual de desenvolvimento de software: agentes de IA representados por personagens
pixel art num prédio animado, coordenados por um orquestrador com aprovação humana.

Arquitetura completa, custos, riscos e plano: **[docs/ARQUITETURA.md](docs/ARQUITETURA.md)**.

## Situação

| Etapa | Situação |
|---|---|
| 1. Fundação (orquestrador, eventos, banco, modo demo) | ✅ concluída |
| 2. Prédio animado (Next.js + Phaser) | ✅ concluída |
| 3. Central de Comando | ✅ concluída |
| 4. Execução real com Claude Code (Agent SDK) | ✅ concluída (validada com SDK simulado; falta a 1ª execução completa na sua máquina) |
| 5. Acabamento | ⏳ próxima |

> Há dois modos, escolhidos ao iniciar e nunca misturados: **demonstração** (`ACC_MODE=demo`, padrão: nenhuma IA,
> nenhum arquivo, nenhum custo) e **real** (`ACC_MODE=real`: os agentes executam o Claude Code de verdade e geram custos).
> Cada modo tem seu próprio banco (`data/demo.sqlite` e `data/real.sqlite`).

## Requisitos

- Node.js 22.13 ou superior (usa o SQLite embutido do Node).

## Executar

```bash
npm install
cp .env.example .env      # defina ACC_TOKEN com um valor aleatório longo (obrigatório para a web)
npm run dev               # orquestrador (127.0.0.1:4317) + web (http://localhost:3000)
```

Abra **http://localhost:3000**: o prédio aparece com os agentes ociosos na copa. Crie um projeto no painel
da direita, aprove o plano na **Fila de aprovação** e acompanhe os personagens trabalhando. Clique num
personagem (ou no nome dele abaixo do prédio) para abrir o painel com tarefa, tempo, histórico, arquivos,
testes, erros e os detalhes da execução.

## Testes

```bash
npm test                  # unitários e de integração (orquestrador + web)
npm run typecheck
npm run build && npm run test:e2e   # ponta a ponta no navegador; gera capturas em e2e/screenshots/
```

O teste ponta a ponta precisa do Playwright com Chromium (`npm i -D playwright && npx playwright install chromium`).

## Prédio animado (Etapa 2)

| Estado real do agente | O que o personagem faz |
|---|---|
| Ocioso | vai para a copa do andar e toma café |
| Em reunião (coordenadora planejando) | vai à mesa de reunião da Diretoria |
| Analisando | senta na mesa, ícone de lupa, gráficos no monitor |
| Escrevendo código | senta e digita, código rolando no monitor |
| Executando testes | testador vai ao laboratório (2º andar); barra de progresso no monitor |
| Conversando | vai (de elevador, se preciso) até o colega que fez a tarefa anterior |
| Aguardando aprovação | levanta a mão com balão “!” piscando; o monitor do administrador e a central de aprovações acendem |
| Concluído | comemora com balão ✔ e depois volta para a copa |
| Erro | fica cabisbaixo com balão ✖ e monitor vermelho |
| Pausado | fica de pé ao lado da mesa com ícone ⏸ |

Regras de fidelidade: os personagens só se movem quando o estado vindo do orquestrador muda; os monitores só mostram
atividade quando o agente está de fato no posto; a parede de protótipos só anima enquanto a designer está digitando.
Os quadros dos andares (tarefas em andamento, erros encontrados, projetos, aprovações) são calculados a partir dos dados reais.
O 1º andar (Operações) e as mesas marcadas “vaga” ficam prontos para expansão — configurados em `apps/web/game/building/layout.ts`.

Segurança da web: o navegador nunca recebe o token. A aplicação Next.js repassa as chamadas ao orquestrador
pelo servidor (`/api/acc/*`, apenas rotas conhecidas; ações exigem mesma origem) e transmite os eventos em
tempo real por Server-Sent Events (`/api/stream`).

## Modo real (Etapa 4)

### Como usar

```bash
claude login                 # ou defina ANTHROPIC_API_KEY no .env
# no .env: ACC_MODE=real (e ajuste os limites de custo)
npm run dev
```

Comece com um projeto pequeno (por exemplo, “Página HTML de lista de tarefas, sem dependências”), acompanhe pela
Central de Comando e confira os arquivos em `workspaces/<id-do-projeto>/`.

### O que acontece

1. **Planejamento:** a coordenadora chama o Claude (sem nenhuma ferramenta) e devolve um plano estruturado, validado
   pelo orquestrador (formato, dependências existentes, sem ciclos). O plano mostra o custo estimado e **só executa após sua aprovação**.
2. **Execução:** cada tarefa roda o Claude Code (Agent SDK) dentro de `workspaces/<projeto>/`, que recebe um repositório
   git próprio. O agente recebe a descrição, os critérios de aceite e o resumo/arquivos das tarefas anteriores.
3. **Cada ferramenta passa pela política de permissões** (`canUseTool`): leitura e escrita dentro do workspace e
   comandos da lista do cargo seguem direto; instalar dependências, excluir, publicar, `git push`, rede, comunicação
   externa, operações financeiras, comandos fora da lista e arquivos fora do workspace vão para a **fila de aprovação**
   e o agente fica com a mão levantada até você decidir. Se você negar, o agente recebe a recusa e segue sem a ação.
4. **O prédio reflete as mensagens reais do SDK:** ler/buscar = analisando, escrever/editar = digitando, comando de teste = testes.
5. **Resultado:** arquivos alterados são detectados comparando o workspace antes e depois; o agente entrega um relatório
   estruturado (resumo e contagem de testes, junto com a saída real do comando de teste); o custo medido vem do SDK.
6. **Limites:** custo por tarefa (`ACC_TASK_BUDGET_USD`), por projeto (pausa automática), por planejamento, número de
   turnos e concorrência (padrão 1 no modo real). Pausar/cancelar interrompe o processo do Claude Code.

### Segurança e isolamento

- Os agentes só têm as ferramentas Read, Write, Edit, Glob, Grep, Bash e TodoWrite — **sem acesso à web**.
- Configurações do usuário/projeto do Claude Code **não** são carregadas (`settingSources: []`).
- O ambiente do processo é filtrado: só seguem PATH/HOME/locale, credenciais do Claude e proxy. Nada do orquestrador (como `ACC_TOKEN`) chega aos agentes.
- **Sandbox do Bash** (`ACC_SANDBOX=auto`): restringe escrita ao workspace e bloqueia rede nos comandos. No Linux depende
  de `bubblewrap` e `socat`; no macOS é nativo; **no Windows não existe — use WSL2**. Com `auto`, se o sandbox não estiver
  disponível o comando roda sem ele; use `required` para recusar a execução nesse caso.
- Limitação: uma pasta e um sandbox não são uma fronteira de segurança completa como um container. A credencial do
  Claude fica visível para o processo do agente. Para código não confiável, rode tudo dentro de uma VM/container (etapa futura).

### Custos

O custo medido é o `total_cost_usd` informado pelo SDK (estimativa, não fatura). Com assinatura Pro/Max (login do
Claude Code) o uso conta nos limites do plano; com `ANTHROPIC_API_KEY` é cobrado por token. Teste primeiro com limites baixos.

## Central de Comando (Etapa 3)

Em **http://localhost:3000/command** (link “Central de Comando” no topo):

| Seção | O que permite |
|---|---|
| Indicadores | projetos ativos, agentes trabalhando, tarefas em andamento, aprovações pendentes, tarefas com erro, custo estimado e medido |
| Projetos | criar projeto, buscar e filtrar por situação, pausar/retomar/cancelar, abrir o detalhe |
| Detalhe do projeto | plano da coordenadora, tarefas com dependências, agente, tempo, custo, arquivos, testes, erros e execução; aprovações e histórico do projeto |
| Agentes | estado atual, tarefa e projeto de cada agente (clique abre o painel do agente) |
| Aprovações | fila com aprovar/rejeitar (com motivo) e histórico completo de decisões |
| Erros | tarefas com falha ou bloqueadas, testes que falharam, execuções interrompidas e eventos de alerta |
| Custos | orçamento, estimado e medido por projeto e por cargo, com a explicação do cálculo |
| Histórico e logs | todos os eventos gravados, com filtros por categoria, agente, projeto e texto, atualização em tempo real e paginação |

O botão **Pausar todas as execuções** interrompe tudo de uma vez. A aba fica no endereço (`/command#aprovacoes`), então dá para compartilhar o link.

**Custos:** o estimado é calculado no plano (consumo típico de cada cargo × preço do modelo, configurável em
`ACC_PRICE_INPUT_PER_MTOK`/`ACC_PRICE_OUTPUT_PER_MTOK`; padrão Claude Sonnet 5.5: US$ 2 / US$ 10 por milhão de tokens).
O medido vem do Claude Agent SDK ao fim de cada execução (estimativa do SDK, não fatura). No modo demonstração ambos aparecem como “—”.

## API do orquestrador

Também é possível controlar tudo direto pela API (útil para automações):

```bash
TOKEN=o-valor-do-seu-ACC_TOKEN
H="authorization: Bearer $TOKEN"

# 1. Criar projeto — a coordenadora (Ada) planeja e pede aprovação do plano
curl -s -H "$H" -H 'content-type: application/json' \
  -d '{"name":"Portal de clientes","description":"Portal com login e API de pedidos"}' \
  http://127.0.0.1:4317/api/projects

# 2. Ver estado completo (agentes, projetos, tarefas, aprovações)
curl -s -H "$H" http://127.0.0.1:4317/api/snapshot

# 3. Aprovar (ou "reject") uma aprovação pendente
curl -s -H "$H" -H 'content-type: application/json' -d '{"decision":"approve"}' \
  http://127.0.0.1:4317/api/approvals/<id>

# Pausar / retomar / cancelar
curl -s -X POST -H "$H" http://127.0.0.1:4317/api/projects/<id>/pause
```

Inclua `#erro` na descrição do projeto para ver o fluxo de erro (testes falhando) no modo demo.

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

Segurança: o servidor escuta só em `127.0.0.1`, exige token em toda rota e no WebSocket e só aceita a origem
configurada em `ACC_ALLOWED_ORIGIN`.

## Estrutura

```
packages/shared         tipos de domínio, eventos e esquemas de validação (zod)
apps/orchestrator       servidor HTTP + WebSocket, motor, planejador, executores, políticas, SQLite
  src/claude            integração com o Claude Agent SDK (planejador, executor, ambiente, arquivos alterados)
apps/web                Next.js + Tailwind + Phaser: prédio, painéis, proxy e stream de eventos
e2e/                    teste ponta a ponta no navegador e capturas de tela
```
