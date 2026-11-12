# Lista de bugs encontrados pelos testes de integração

Quando um teste falha por bug real, ele **continua falhando** e o bug entra aqui até ser corrigido no app. É proibido apagar, pular ou afrouxar um teste para fazê-lo passar.

Rodar todos os testes: `npm test`

Última rodada: **188 testes, 188 passam** (inclui os 7 de data de entrega e os 4 de campos permitidos da auditoria de segurança, os 21 de sem internet — rascunho, caixa de saída e ações que precisam de conexão —, os 26 da rodada de lacunas de 05/11/2026 e o teste E2E de fumaça). Não há bug aberto.

## Corrigidos

| # | O que os testes acharam | Correção | Testes |
|---|---|---|---|
| 1 | Item com quantidade 0 ou negativa era descartado em silêncio e a requisição era criada. | O formulário e a operação recusam, com a mensagem "A quantidade do item … precisa ser maior que zero". | `02-criar` › 2.5 |
| 2 | Qualquer pessoa editava, cancelava e excluía a requisição de outra. | Só o solicitante, o gestor geral ou usuários selecionados pelo gestor. Os demais não veem os botões, e a operação recusa mesmo se for chamada. | `07-acesso-indevido` › 7.3, 7.4, 7.5 |
| 3 | Não existia a lista de usuários selecionados. | O gestor marca as pessoas no 👤 (aparece ao marcar "Sou gestor"). Só o gestor altera a lista. | `07-acesso-indevido` › 7.3 a 7.6 |
| 4 | A lista de sugestões de @menção ficava aberta sobre o botão "Comentar" quando o texto terminava numa menção completa. | A lista fecha quando o nome digitado já está completo. | `08-edicao-duplicar-comentar` › 8.5 |
| 5 | Comentário cortado em 1.000 caracteres, sem aviso. | Teto de 20.000 caracteres (decisão do Erick); acima disso a tela avisa e não corta. | `08-edicao-duplicar-comentar` › 8.6 |
| 6 | Qualquer pessoa assumia a compra, trocava o comprador e confirmava o envio. | Sem comprador: só o solicitante, o gestor ou o próprio comprador assumindo em seu nome. Com comprador: trocar ou confirmar o envio só o comprador atual ou o gestor (regra do Erick, 05/11/2026). O botão Alterar some para os demais. | `11-permissoes-limites` › 14.3, 14.4, 14.7, 14.8, 14.10 |
| 7 | Dava para excluir a requisição em qualquer status, até Recebida. | Em Pendente, quem pode alterar; fora de Pendente, só o gestor. O Excluir do menu some para os demais. | `11-permissoes-limites` › 15.1 |
| 8 | Ao excluir uma requisição gerada por tarefa, a data continuava Realizada, apontando para uma requisição que não existe. | A data volta para Pendente e o histórico da tarefa registra "Excluída". | `11-permissoes-limites` › 15.3 |
| 9 | Reabrir uma requisição cancelada pelo Desfazer da tarefa permitia duas requisições para a mesma data. | A reabertura é recusada para todos, com aviso para gerar de novo pela tarefa; o botão Reabrir some. | `11-permissoes-limites` › 16.1, 16.2 |
| 10 | Auditoria de segurança (12/11/2026): criar, editar e a caixa de saída aceitavam qualquer campo. Uma caixa de saída alterada no aparelho criava requisição já Recebido, com comprador e número escolhidos. | Só os campos do formulário são aceitos; número, status, versão, comprador, datas, histórico e recebidos nascem no app; o nome do projeto é recalculado pelo número. | `13-campos-permitidos` › 18 (os 4 falhavam antes da correção) |
| 11 | Auditoria de segurança (12/11/2026): qualquer pessoa alterava a data de entrega (e tirava a requisição de Não recebido). | Regra do Erick: só o solicitante, o comprador atual ou o gestor geral; o botão "editar data" some para os demais. | `14-data-entrega` › 19 (os 4 de recusa falhavam antes da correção) |

## Correções feitas no próprio teste (não no comportamento esperado)

- **2.2 (falta origem):** o teste tentava voltar a origem para "Selecione...", mas essa opção é desativada na tela. Agora o teste deixa a origem sem escolher, que é o cenário real. A expectativa (mensagem de erro e nada criado) não mudou.
- **Fumaça E2E:** o teste não respondia à pergunta "gerar tarefa?" que aparece depois de criar a requisição, e travava no clique seguinte. Agora ele clica em "Não", como uma pessoa faria. O que o teste confere não mudou.
