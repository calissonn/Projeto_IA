# AI Command Center

Empresa virtual de desenvolvimento de software: agentes de IA representados por personagens pixel art num prédio
animado, coordenados por um orquestrador com aprovação humana. No modo real, os agentes executam o **Claude Code** de verdade.

| | |
|---|---|
| **[Guia de uso](docs/USO.md)** | instalar, escolher o modo, usar, configurar, API |
| **[Segurança](docs/SEGURANCA.md)** | modelo de permissões, camadas de proteção e limitações |
| **[Verificação](docs/VERIFICACAO.md)** | testes automáticos e roteiros manuais |
| **[Arquitetura](docs/ARQUITETURA.md)** | decisões, componentes, custos e riscos |

## Início rápido

```bash
npm install
cp .env.example .env      # defina ACC_TOKEN com um valor aleatório longo
npm run dev               # http://localhost:3000 (modo demonstração: sem IA, sem custo)
```

## Situação

| Etapa | Situação |
|---|---|
| 1. Fundação (orquestrador, eventos, banco, modo demo) | ✅ concluída |
| 2. Prédio animado (Next.js + Phaser) | ✅ concluída |
| 3. Central de Comando | ✅ concluída |
| 4. Execução real com Claude Code (Agent SDK) | ✅ concluída (validada com SDK simulado; falta a 1ª execução completa na sua máquina) |
| 5. Acabamento (robustez, segurança da web, CI, documentação, custos calibrados) | ✅ concluída |

> Há dois modos, escolhidos ao iniciar e nunca misturados: **demonstração** (`ACC_MODE=demo`, padrão: nenhuma IA,
> nenhum arquivo, nenhum custo) e **real** (`ACC_MODE=real`: os agentes executam o Claude Code de verdade e geram custos).
> Cada modo tem seu próprio banco (`data/demo.sqlite` e `data/real.sqlite`).

## Requisitos

- Node.js 22.13 ou superior (usa o SQLite embutido do Node).

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

Como ativar: [Guia de uso](docs/USO.md#2-escolher-o-modo). Primeira execução: [roteiro](docs/VERIFICACAO.md#manual--modo-real-primeira-execução).

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

Resumo abaixo; detalhes e limitações em [docs/SEGURANCA.md](docs/SEGURANCA.md).

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

A API do orquestrador (para automações) está documentada no [Guia de uso](docs/USO.md#7-api-do-orquestrador).

## Acabamento (Etapa 5)

- A web avisa quando perde a conexão e reconecta sozinha; ao encerrar, o orquestrador pausa o que estava rodando.
- Telas de erro e de página não encontrada; cabeçalhos de segurança (CSP, anti-iframe, nosniff, no-referrer).
- Estimativa de custo calibrada: com 3 ou mais tarefas reais de um cargo, usa a média real desse cargo.
- `npm run reset:demo` zera a demonstração; CI no GitHub roda tipos, testes, build e o teste ponta a ponta.

## Estrutura

```
packages/shared         tipos de domínio, eventos e esquemas de validação (zod)
apps/orchestrator       servidor HTTP + WebSocket, motor, planejador, executores, políticas, SQLite
  src/claude            integração com o Claude Agent SDK (planejador, executor, ambiente, arquivos alterados)
apps/web                Next.js + Tailwind + Phaser: prédio, painéis, proxy e stream de eventos
e2e/                    teste ponta a ponta no navegador e capturas de tela
scripts/                utilitários (reset da demonstração)
docs/                   uso, segurança, verificação e arquitetura
```
