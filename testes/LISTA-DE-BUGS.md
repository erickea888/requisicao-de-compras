# Lista de bugs encontrados pelos testes de integração

Quando um teste falha por bug real, ele **continua falhando** e o bug entra aqui até ser corrigido no app. É proibido apagar, pular ou afrouxar um teste para fazê-lo passar.

Rodar todos os testes: `npm test`

Última rodada: **100 testes, 100 passam** (inclui os 35 do Painel de Tarefas). Não há bug aberto.

## Corrigidos

| # | O que os testes acharam | Correção | Testes |
|---|---|---|---|
| 1 | Item com quantidade 0 ou negativa era descartado em silêncio e a requisição era criada. | O formulário e a operação recusam, com a mensagem "A quantidade do item … precisa ser maior que zero". | `02-criar` › 2.5 |
| 2 | Qualquer pessoa editava, cancelava e excluía a requisição de outra. | Só o solicitante, o gestor geral ou usuários selecionados pelo gestor. Os demais não veem os botões, e a operação recusa mesmo se for chamada. | `07-acesso-indevido` › 7.3, 7.4, 7.5 |
| 3 | Não existia a lista de usuários selecionados. | O gestor marca as pessoas no 👤 (aparece ao marcar "Sou gestor"). Só o gestor altera a lista. | `07-acesso-indevido` › 7.3 a 7.6 |
| 4 | A lista de sugestões de @menção ficava aberta sobre o botão "Comentar" quando o texto terminava numa menção completa. | A lista fecha quando o nome digitado já está completo. | `08-edicao-duplicar-comentar` › 8.5 |
| 5 | Comentário cortado em 1.000 caracteres, sem aviso. | Teto de 20.000 caracteres (decisão do Erick); acima disso a tela avisa e não corta. | `08-edicao-duplicar-comentar` › 8.6 |

## Correções feitas no próprio teste (não no comportamento esperado)

- **2.2 (falta origem):** o teste tentava voltar a origem para "Selecione...", mas essa opção é desativada na tela. Agora o teste deixa a origem sem escolher, que é o cenário real. A expectativa (mensagem de erro e nada criado) não mudou.
