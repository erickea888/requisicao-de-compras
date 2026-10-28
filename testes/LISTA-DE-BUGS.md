# Lista de bugs encontrados pelos testes de integração

Os testes abaixo **falham de propósito**: o comportamento esperado foi definido pelo Erick e o app ainda não segue. Eles ficam falhando até o app ser corrigido. É proibido apagar, pular ou afrouxar esses testes para fazê-los passar.

Rodar todos os testes: `npm test`

Última rodada: **64 testes, 53 passam e 11 falham**.

## Regras novas, definidas e ainda não implementadas

| # | Comportamento esperado | Hoje | Testes |
|---|---|---|---|
| 1 | **2.5** Item com quantidade 0 ou negativa impede criar a requisição, com mensagem de erro. | O item é descartado em silêncio e a requisição é criada. | `02-criar` › 2.5 (0 e -2) |
| 2 | **7.3** Só o solicitante, o gestor geral ou usuários **selecionados pelo gestor** editam a requisição. | Qualquer pessoa edita. | `07-acesso-indevido` › 7.3 |
| 3 | **7.4** Só o solicitante, o gestor geral ou usuários selecionados cancelam. | Qualquer pessoa cancela. | `07-acesso-indevido` › 7.4 |
| 4 | **7.5** Só o solicitante, o gestor geral ou usuários selecionados excluem. | Qualquer pessoa exclui. | `07-acesso-indevido` › 7.5 |
| 5 | **7.6** A lista geral de usuários selecionados existe e só o gestor geral a altera. | A lista não existe (`opDefinirUsuariosAutorizados`). | `07-acesso-indevido` › 7.3, 7.4, 7.5 (selecionado) e 7.6 |

## Bugs

| # | Bug | Como reproduzir | Teste |
|---|---|---|---|
| 6 | **A lista de sugestões de @menção cobre o botão "Comentar".** Quando o texto termina numa menção completa (ex.: "Chegou? @Fernanda Lima"), a lista continua aberta sobre o botão, e o clique cai na sugestão em vez de enviar. | Abrir uma requisição, digitar um comentário terminando em "@Fernanda Lima" e tentar clicar em Comentar. | `08-edicao-duplicar-comentar` › 8.5 |
| 7 | **Comentário cortado em 1.000 caracteres.** Pela regra 8.6, comentários não têm limite (especificações podem ser longas). Hoje o campo aceita só 1.000 caracteres, e o texto colado acima disso é cortado sem aviso. **Atenção:** esse limite foi colocado na revisão de segurança (SEGURANCA.md, achado 6), então a correção precisa definir um teto alto ou nenhum. | Colar um texto de 5.000 caracteres no comentário e enviar. | `08-edicao-duplicar-comentar` › 8.6 |

## Correções feitas no próprio teste (não no comportamento esperado)

- **2.2 (falta origem):** o teste tentava voltar a origem para "Selecione...", mas essa opção é desativada na tela. Agora o teste deixa a origem sem escolher, que é o cenário real. A expectativa (mensagem de erro e nada criado) não mudou.
