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

- [ ] **14. Coleção `tarefas/{id}`.** Mesmos campos de hoje (`dono`, `descricao`, `dataHora`, `lembreteMin`, `recorrencia`, `diasMes`, `modelo`, `status`, `requisicaoGeradaId`, `serieId`, `versao`). `gravarTarefa` vira `runTransaction` (item 1) e a chave de criação vira o ID do documento (item 2).
- [ ] **15. Gerar requisição e concluir a tarefa na mesma transação.** Hoje o formulário confere a tarefa (`erroGerarDaTarefa`), cria a requisição e depois chama `opConcluirTarefa`. No Firestore, as duas gravações e a criação da próxima tarefa (ID `proxima:{id}`) precisam sair juntas, para que duas pessoas gerando ao mesmo tempo não criem duas requisições.
- [ ] **16. Lembretes no servidor.** Hoje `verificarLembretesTarefas` só roda com a página aberta (a cada 30 segundos). Para avisar quem está com o app fechado, é preciso uma função agendada (Cloud Functions, plano Blaze) que crie a notificação `lembrete:{id}:{data}`, e, se quiserem aviso no celular, Firebase Cloud Messaging.
- [ ] **17. Security Rules das tarefas.** Só o dono ou o gestor lê e altera; tarefa Realizada não pode ser editada; recorrência e lembrete só com os valores permitidos.
