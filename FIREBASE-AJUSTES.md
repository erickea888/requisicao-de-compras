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

## ⚠️ Ponto de atenção para quem for desenvolver: dividir o `index.html` antes de tudo

> **Leia antes de começar a migração.** Decisão do Erick (12/11/2026): o `index.html` (≈4.700 linhas, CSS + HTML + todo o JavaScript) **só será dividido em arquivos quando o Firebase entrar**, e essa divisão é a **primeira etapa** da migração, antes de qualquer item abaixo. Não dividir no meio de outra mudança.

- [ ] **22. Dividir o arquivo em camadas, sem mudar comportamento.**
  - **Rede de segurança já pronta:** `testes/integracao/15-caracterizacao-telas.spec.js` registra como as telas funcionam hoje (tabela, filtros, ordenação, KPIs, Kanban, tema, detalhe, histórico, planilha, recebimento, menu ⋮, anexos, câmera) e confere que **todas as 224 funções e 168 constantes públicas** continuam existindo. Esses testes, mais os outros da pasta, precisam passar **ao final de cada passo**.
  - **Estrutura combinada:** `index.html` (só HTML), `css/estilo.css`, `js/dados/` (dados base, `localStorage`, exemplos — é esta camada que o Firestore substitui), `js/regras/` (formatação, permissões, requisições, tarefas, sem internet), `js/ui/` (um arquivo por tela) e `js/inicio.js`.
  - **Ordem dos passos:** (1) CSS para arquivo; (2) o script inteiro, sem mudar nada, para `js/app.js`; (3) daí em diante, um pedaço por passo saindo do `app.js`: dados, regras e telas. Cada função muda de arquivo **inteira**, sem ser reescrita. Um commit por passo.
  - **Não mudar:** nomes de funções, ids da página, classes CSS, campos das requisições e tarefas, chaves do `localStorage`.
  - **Riscos e como evitar:**
    - *Ordem de carga.* Hoje tudo está num só script, e as funções existem desde o início. Separadas, uma função só existe depois que o arquivo dela carregou. Conferir, a cada passo, se algum código que roda na carga chama função de um arquivo posterior.
    - *Scripts comuns, não módulos.* Usar `<script src>` comum, **sem** `type="module"`: os testes e `testes/concorrencia.html` chamam as funções pelo nome global.
    - *Cache no celular.* Depois de publicar, o navegador pode misturar arquivo novo com velho. Pôr versão no endereço (`js/app.js?v=…`) e trocar a cada publicação.
    - *Política de conteúdo (CSP).* Incluir `'self'` em `script-src` e `style-src`. No GitHub Pages, `'self'` vale para todo `erickea888.github.io` (todos os repositórios publicados ali). Com o JavaScript fora do HTML, dá para tirar o `'unsafe-inline'` dos scripts (SEGURANCA.md item 7), mas como mudança separada, depois da divisão.
  - **Misturas conhecidas (mover como estão; separar só depois, com teste):** `renderKPIs` (tela) chama `verificarPrazosEntrega`, que grava status; `tentarMudarStatus`, `concluirOperacao` e `comBotaoTravado` são de tela, mas estão entre as regras; as regras leem o `localStorage` direto (`usuarioAtualNome`, `usuarioAtualGestor`, `simulandoSemInternet`) — é aí que entra o login; requisições e tarefas dependem uma da outra (`liberarDataDaTarefa`, `tarefaQueDesfez`, `opGerarRequisicaoDaTarefa`).
  - **Regra da refatoração:** não corrigir bug nem mudar regra de negócio durante a divisão. Bug encontrado vai para `testes/LISTA-DE-BUGS.md`.

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
  - Data de entrega: alterar só o solicitante, o comprador atual ou o gestor geral (regra do Erick, 12/11/2026). A lista de usuários selecionados não vale aqui.
  - Excluir fora de Pendente só o gestor. Excluir requisição gerada por tarefa apaga a realização da data na mesma transação.
  - Reabrir é recusado quando a requisição foi cancelada pelo Desfazer da tarefa.
  - Quantidade dos itens maior que zero; comentário com até 20.000 caracteres.
  - Criar e editar só com os campos do formulário (`CAMPOS_REQUISICAO` no `index.html`): `request.resource.data.keys().hasOnly([...])` na criação e `diff().affectedKeys().hasOnly([...])` na edição. Na criação, `status == "pendente"`, `versao == 1`, sem comprador, e `projetoNome` igual ao do cadastro do projeto.

- [ ] **7. Botões durante o envio.**
  `comBotaoTravado` já aceita uma Promise: as operações passam a ser `async`, e o botão fica desabilitado até a gravação terminar. É só conforto de tela; a proteção são os itens 1 a 6.

- [ ] **8. Testes no emulador do Firebase.**
  Refazer os 13 cenários de `testes/concorrencia.html` contra o emulador, disparando as duas operações de verdade ao mesmo tempo (`Promise.all`). Também testar as Security Rules.
  Requisitos na máquina: Node.js e Java.

## Outros ajustes da migração

- [ ] **9. Versão real em repositório privado.** Este repositório é público e deve continuar só com dados fictícios (ver [SEGURANCA.md](SEGURANCA.md)).
- [ ] **10. Login (Firebase Authentication).** Trocar o usuário digitado em 👤 pelo usuário autenticado (`usuarioAtualNome`, `usuarioAtualGestor`).
  - Decisão do Erick (12/11/2026): o 👤 existe só para testar o protótipo como usuário normal ou gestor. Na versão real, cada pessoa entra com o **e-mail da empresa**, e a conta (nome e papel) é **configurada pelo gestor geral**. Ninguém escolhe o próprio papel.
  - O **solicitante** é sempre o usuário logado na criação (`solicitante == request.auth.uid` nas Rules) e não muda depois. O campo "Solicitante" do formulário deixa de ser digitado.
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
