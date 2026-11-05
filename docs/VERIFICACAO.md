# Verificação

## Automática

| Comando | O que cobre |
|---|---|
| `npm run typecheck` | tipos de todo o projeto |
| `npm test` | orquestrador (motor, permissões, custos, banco, API/WebSocket, modo real com SDK simulado) e web (mapeamento estado → animação, eventos, formatação) |
| `npm run build && npm run test:e2e` | navegador real, modo demonstração: prédio e animações, painel do agente, aprovações, erros, Central de Comando, pausa/retomada/cancelamento, logs, custos, cabeçalhos de segurança, queda e volta do orquestrador, celular |

A CI do GitHub (`.github/workflows/ci.yml`) roda tudo isso a cada envio, sem chamar IA.

## Manual — modo demonstração (5 minutos)

- [ ] `npm run dev` e abrir http://localhost:3000: faixa amarela, 4 agentes tomando café.
- [ ] Criar projeto: Ada vai à sala de reunião; depois levanta a mão na central de aprovações.
- [ ] Aprovar: Lia digita no 3º andar (código no monitor, parede de protótipos animada).
- [ ] Téo pega o elevador até a Lia, volta e pede aprovação para instalar dependência.
- [ ] Clicar no Téo: painel com tarefa, tempo, histórico e “Ver detalhes da execução”.
- [ ] Davi vai ao laboratório e comemora no fim; projeto “Concluído”.
- [ ] Projeto com `#erro`: Davi fica com ✖ e monitor vermelho; aparece em Central → Erros.
- [ ] Central → Projetos: pausar e retomar um projeto; Aprovações: rejeitar com motivo.
- [ ] Parar o orquestrador (Ctrl+C no terminal dele): faixa vermelha “Sem conexão”; ao iniciar de novo, a web reconecta.

## Manual — modo real (primeira execução)

- [ ] `claude login` (ou `ANTHROPIC_API_KEY`), `ACC_MODE=real`, limites baixos no `.env`.
- [ ] Ao iniciar, o terminal mostra modo real, orçamentos e o estado do sandbox.
- [ ] Projeto pequeno, sem dependências (ex.: “Página HTML de lista de tarefas com testes em node --test”).
- [ ] O plano chega com custo estimado; aprovar.
- [ ] Os personagens refletem as ações reais (lendo/escrevendo/testando) e o histórico mostra os arquivos.
- [ ] Pedidos de risco aparecem na fila com os dados técnicos; testar uma recusa.
- [ ] Ao final: arquivos em `workspaces/<id>/`, “Artefatos entregues”, custo medido em Central → Custos.
