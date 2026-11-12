# Ajustes a serem feitos ao migrar para o Firebase

Lista do que precisa mudar quando o protótipo passar a gravar no **Firebase (Firestore)**. Marque cada item ao concluir.

## Por que existe esta lista

Hoje tudo roda dentro de um navegador. Duas pessoas nunca mexem no mesmo dado ao mesmo tempo, então não existe condição de corrida de verdade. Com o Firebase, várias pessoas vão gravar na mesma requisição ao mesmo tempo.

O código já foi preparado para isso:

- **Toda gravação passa por uma função** (`gravarRequisicao`) que lê de novo, confere a **versão** que a pessoa tinha na tela e as regras de status, e só então grava.
- **Criar, duplicar e comentar usam uma chave de envio.** O mesmo envio repetido não grava duas vezes.
- **O prazo vencido** só vale uma vez por requisição e por vencimento.
- **Os testes** em [`testes/concorrencia.html`](testes/concorrencia.html) simulam duas pessoas confirmando a mesma ação ao mesmo tempo e provam que só uma tem efeito.

Na migração, a lógica das operações (`op…` no `index.html`) continua a mesma. Muda **onde** elas gravam.

No código, os pontos afetados têm o comentário `FIREBASE:` apontando para este arquivo.

## Proteção contra gravações simultâneas

A ordem de preferência é a mesma da revisão: (a) ID único, (b) operação atômica, (c) transação. Sem Redis, fila ou outra infraestrutura.

- [ ] **1. Transformar `gravarRequisicao` em `runTransaction`.**
  Dentro da transação: ler a requisição, conferir `versao` e as regras (`erroTransicao`), gravar os campos e a entrada do histórico, e somar 1 na `versao`. Se outra pessoa gravou no meio, o Firestore refaz a leitura. Com a versão diferente, a operação recusa e a tela avisa, igual a hoje.
  Cobre: assumir compra, alterar comprador, confirmar envio, alterar data, cancelar, reabrir, recebimento parcial, Recebido/Não recebido e edição.

- [ ] **2. Chave de envio como ID do documento (equivale a uma constraint única).**
  Criar e duplicar: `requisicoes/{chaveCriacao}`, gravado com `create()`, que falha se o ID já existe. Na falha, a tela mostra a requisição já criada.
  Comentário: `requisicoes/{id}/comentarios/{chave}`. Notificação: `notificacoes/{chave}`.

- [ ] **3. Número RC-0001… por contador em transação.**
  Documento `contadores/requisicoes` com o próximo número. Ele é lido e somado na **mesma transação** que cria a requisição do item 2, para que duas criações simultâneas nunca recebam o mesmo número. Hoje é `novoId()`, que só funciona com um navegador.

- [ ] **4. Histórico e comentários em subcoleções** (operação atômica).
  Hoje são listas dentro da requisição. No Firestore, duas pessoas acrescentando na mesma lista ao mesmo tempo fazem uma apagar a outra. Por isso cada entrada vira um documento próprio: `requisicoes/{id}/historico/{evento}` e `requisicoes/{id}/comentarios/{chave}`.

- [ ] **5. Prazo vencido por transação, com ID fixo de evento.**
  Mesma lógica de `aplicarPrazoVencido`: só muda para "Não recebido" se o status ainda for "Enviado" e a versão for a vista. O evento do histórico e a notificação usam a chave `prazo:{id}:v{versao}` como ID, então 30 abas abertas geram uma mudança só.
  Isso evita a função agendada do Firebase, que exige o plano pago (Blaze). A limitação é que só acontece quando alguém abre o app.

- [ ] **6. Security Rules** (precisam da revisão do Erick antes de publicar).
  - Repetir a tabela `TRANSICOES`: o banco recusa qualquer troca de status fora dela, mesmo de quem burlar a tela.
  - Recebido parcial, Recebido e Não recebido só para o solicitante ou para quem tiver o papel de gestor.
  - `versao` só pode subir de 1 em 1.
  - Histórico e comentários só podem ser criados, nunca alterados ou apagados.
  - Editar, cancelar e excluir só para o solicitante, o gestor ou quem estiver na lista `config/permissoes` (hoje `usuariosAutorizados()`, guardada no navegador). Só o gestor grava essa lista.
  - Comprador: sem comprador, só o solicitante, o gestor ou quem grava o próprio nome como comprador. Com comprador, trocar e confirmar o envio só o comprador atual ou o gestor.
  - Excluir fora de Pendente só o gestor. Excluir requisição gerada por tarefa apaga a realização da data na mesma transação.
  - Reabrir é recusado quando a requisição foi cancelada pelo Desfazer da tarefa.
  - Quantidade dos itens maior que zero; comentário com até 20.000 caracteres.

- [ ] **7. Botões durante o envio.**
  `comBotaoTravado` já aceita uma Promise: as operações passam a ser `async`, e o botão fica desabilitado até a gravação terminar. É só conforto de tela; a proteção são os itens 1 a 6.

- [ ] **8. Testes no emulador do Firebase.**
  Refazer os 13 cenários de `testes/concorrencia.html` contra o emulador, disparando as duas operações de verdade ao mesmo tempo (`Promise.all`). Também testar as Security Rules.
  Requisitos na máquina: Node.js e Java.

## Outros ajustes da migração

- [ ] **9. Versão real em repositório privado.** Este repositório é público e deve continuar só com dados fictícios (ver [SEGURANCA.md](SEGURANCA.md)).
- [ ] **10. Login (Firebase Authentication).** Trocar o usuário digitado em 👤 pelo usuário autenticado (`usuarioAtualNome`, `usuarioAtualGestor`).
- [ ] **11. Política de conteúdo (CSP).** Hoje a página bloqueia qualquer conexão de rede (`connect-src 'none'`). Liberar só os endereços do Firebase.
- [ ] **12. Itens do checklist de implantação** do [SEGURANCA.md](SEGURANCA.md): anexos no Cloud Storage, App Check, cabeçalhos de segurança, backups.
- [ ] **13. Página de testes.** Ela usa `estadoParaTestes()` para ler os dados. Na versão real, remover essa função ou trocá-la pelos testes no emulador (item 8).

## Painel de Tarefas

Hoje as tarefas ficam na memória da página, como as requisições, e somem ao recarregar. Decisão do Erick: implantar a gravação junto com o Firebase.

- [ ] **14. Coleção `tarefas/{id}`.** Mesmos campos de hoje (`dono`, `descricao`, `dataInicial`, `vezes`, `unidade`, `termino`, `dataFinal`, `lembreteMin`, `modelo` com a requisição completa, `versao`). Os anexos do modelo vão para o Cloud Storage e cada requisição gerada aponta para os mesmos arquivos. `gravarTarefa` vira `runTransaction` (item 1) e a chave de criação vira o ID do documento (item 2). As datas realizadas ficam na subcoleção `tarefas/{id}/realizacoes/{data}`, gravada com `create()`, para a mesma data nunca valer duas vezes.
- [ ] **15. Gerar requisição e concluir a data na mesma transação.** Hoje `opGerarRequisicaoDaTarefa` confere a tarefa, cria a requisição (chave `tarefa:{id}:{data}`) e depois chama `opConcluirOcorrencia`. No Firestore, as duas gravações precisam sair juntas, para que duas pessoas gerando ao mesmo tempo não criem duas requisições. O mesmo vale para desfazer (`opDesfazerGeracao`): cancelar a requisição, apagar a realização e registrar em `desfeitas` na mesma transação.
- [ ] **16. Lembretes só no sino 🔔 da plataforma.** Decisão do Erick (05/11/2026): **sem e-mail e sem push no celular** por enquanto, porque o custo é por notificação e cresce com o número de usuários; os usuários acessam a plataforma todo dia. Hoje `verificarLembretesTarefas` roda com a página aberta (a cada 30 segundos) e ao abrir o app. Com o Firebase, continua assim: ao abrir o app, o próprio navegador confere as datas e cria a notificação `notificacoes/lembrete:{id}:{data}` com `create()`, então duas abas abertas não duplicam o aviso. Não precisa de função agendada nem do plano Blaze para isso.
- [ ] **16b. Anexos do modelo da tarefa no Cloud Storage.** Cada documento do Firestore tem limite de 1 MB. Se o PDF da proposta ficar dentro da tarefa, ela pode falhar ao salvar. A tarefa guarda só a referência do arquivo no Storage (caminho, nome, tamanho), e a requisição gerada aponta para o mesmo arquivo.
- [ ] **16c. Datas puladas.** `puladas` (data, motivo, quem, quando) vira a subcoleção `tarefas/{id}/puladas/{data}`. Pular e retomar gravam na mesma transação da `versao` da tarefa. Gerar requisição precisa conferir, dentro da transação do item 15, que a data não está pulada.
- [ ] **17. Security Rules das tarefas.** Só o dono ou o gestor lê e altera; realizações só podem ser criadas, nunca alteradas; repetição, lembrete e ajuste de fim de semana (`manter`, `antecipar`, `adiar`) só com os valores permitidos. Pular data exige motivo.
- [ ] **18. Tarefa de quem saiu da empresa.** Quando entrar o login (item 10) e for possível desativar um usuário, as tarefas dele continuam gerando pendências no nome dele. O gestor precisa de uma ação "Transferir tarefa" para outra pessoa (muda `dono` e o solicitante do `modelo`, registra no histórico da tarefa).

## Sem internet (pessoa de campo)

Pedido do Erick (12/11/2026): a conexão cai bem na hora de criar a requisição no celular. No protótipo já existem o rascunho automático, a caixa de saída ("Aguardando envio") e a faixa "Sem internet", com testes em `testes/integracao/12-sem-internet.spec.js`. Tudo fica no próprio aparelho, sem servidor novo nem fila no servidor.

- [ ] **19. Caixa de saída de verdade.**
  - Guardar a fila no **IndexedDB** (hoje é o `localStorage`), inclusive os **arquivos anexados**. No protótipo os anexos só ficam na memória da página: se ela fechar antes do envio, a requisição sobe sem eles e o histórico avisa.
  - Envio: ao voltar a conexão (`online`) e ao abrir o app, rodar a mesma transação de criação (itens 2 e 3) com a **chave de envio guardada**. O número RC só sai nesse momento, porque o contador em transação precisa de internet.
  - Falha no meio do envio (a conexão caiu depois do clique, sem resposta): tratar como "sem internet" e colocar na caixa de saída com a mesma chave. Se a primeira tentativa tiver chegado, o `create()` falha e a tela mostra a requisição já criada, sem duplicar.
  - **Não** usar o modo offline do Firestore (`enableIndexedDbPersistence`) para criar a requisição: ele não roda transação sem internet nem envia arquivos para o Storage. Ele pode ser usado só para **ler** a lista sem internet.
  - Antes de enviar o que estava guardado, conferir se o login continua válido. Se não estiver, pedir para entrar de novo e manter na caixa de saída.
  - Avisar quando houver requisição presa na caixa de saída há muito tempo (ex.: mais de 24 h), porque limpar o navegador ou trocar de celular faz perder o que não foi enviado.
- [ ] **20. App abrindo sem internet (PWA).** Um *service worker* que guarda a página para abrir sem sinal, mais um `manifest` para "Adicionar à tela inicial". Funciona no GitHub Pages (HTTPS) e no Firebase Hosting, sem custo.
- [ ] **21. Ações que continuam exigindo internet.** Assumir, trocar comprador, confirmar envio, receber, cancelar, reabrir, editar, excluir, duplicar, comentar e tudo das tarefas. Hoje o app recusa com "Sem internet" (`erroSemInternet`). No Firebase isso vem do próprio erro da transação; manter a mesma mensagem e não guardar essas ações para depois.
