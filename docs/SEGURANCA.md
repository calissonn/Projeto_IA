# Segurança

## Princípios

1. **Nada executa sem aprovação do plano.** O administrador aprova o plano antes de qualquer tarefa.
2. **Permissões mínimas por cargo.** Cada agente só tem as ferramentas do cargo; tudo o que não está explicitamente permitido pede aprovação.
3. **Ações de risco sempre passam por um humano:** publicar, excluir, alterar produção, instalar dependências,
   operações financeiras, comunicação externa, rede, `git push`, comandos fora da lista e arquivos fora do workspace.
4. **Demonstração e produção separadas:** bancos diferentes, faixa visível na tela, e o modo real nunca cai para o demo.
5. **A interface só espelha eventos gravados.** Nenhum agente aparece trabalhando sem uma execução ativa (regra verificada em teste).

## Camadas

| Camada | Proteção |
|---|---|
| Orquestrador | escuta só em `127.0.0.1`; token obrigatório (comparação em tempo constante) em todas as rotas e no WebSocket; origem permitida; corpo limitado a 64 KB; entradas validadas |
| Web | o token fica no servidor; o navegador fala só com a própria aplicação (proxy com lista de rotas permitidas; ações exigem mesma origem e JSON); eventos por SSE; cabeçalhos CSP, `X-Frame-Options: DENY`, `nosniff`, `no-referrer` |
| Agentes (modo real) | workspace próprio com repositório git separado; ferramentas restritas (sem acesso à web); `canUseTool` em toda chamada; configurações locais do Claude Code ignoradas; ambiente filtrado (nada do orquestrador chega ao agente); sandbox do Bash (escrita só no workspace, sem rede) |
| Custos | limite por tarefa, por planejamento e por projeto (pausa automática); limite de turnos; concorrência 1 no modo real |
| Operação | desligamento limpo pausa tudo; após reinício, execuções interrompidas são registradas e nada é retomado sem o administrador |

## Limitações conhecidas

- **Pasta + sandbox não equivalem a um container.** Para código ou instruções não confiáveis, rode o AI Command Center dentro de uma VM ou container.
- **Sandbox do Bash:** no Linux depende de `bubblewrap` e `socat`; no macOS é nativo; no Windows não existe (use WSL2).
  Com `ACC_SANDBOX=auto`, se o sandbox não estiver disponível os comandos rodam sem ele — use `required` para impedir.
- **A credencial do Claude** (login ou `ANTHROPIC_API_KEY`) fica visível para o processo do agente. Comandos como `env`
  não estão liberados e pedem aprovação, mas trate a credencial como exposta ao agente.
- **Injeção de instruções:** um arquivo do workspace pode tentar instruir o agente. As ações de risco continuam
  exigindo aprovação; leia com atenção os pedidos (use “Dados técnicos do pedido”).
- **Uso local:** não há login de usuários. Não exponha as portas 3000/4317 na rede.
- **O custo medido** é a estimativa do SDK, não a fatura.

## Ao aprovar um pedido, confira

- Qual comando ou arquivo exato (abra “Dados técnicos do pedido”).
- Se faz sentido para a tarefa daquele agente.
- Pacotes desconhecidos ou com nome parecido com pacotes populares (risco de pacote malicioso).
- Qualquer coisa fora da pasta do projeto, acesso à rede ou envio de dados.
