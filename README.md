# Requisição de Compras

Protótipo navegável de um fluxo de requisição de compras: quem precisa de material (obras, manutenção, administrativo) abre uma requisição, e o time de suprimentos acompanha, comenta e atualiza o andamento até o recebimento.

**Demonstração:** https://erickea888.github.io/requisicao-de-compras/

> Todos os dados exibidos são **fictícios**, criados só para demonstrar o fluxo. Não há backend: o estado vive na página e some ao recarregar.

## O problema

A comunicação entre o departamento de suprimentos e as equipes que pedem material (obra, manutenção, escritório) costuma se espalhar em mensagens e planilhas: ninguém sabe ao certo o que foi pedido, em que etapa está, quem comprou e se chegou. Este módulo concentra tudo em um lugar, com status claros, histórico e comentários na própria requisição.

## O que o protótipo faz

- **Abertura de requisição** com solicitante, origem (Obras, Manutenção, Administração), nº do projeto (texto livre), prioridade, itens, observação e faturamento direto.
- **Itens rápidos** para os materiais mais comuns e **anexos múltiplos** (documentos e fotos, inclusive tirando a foto pela câmera), com limite de tamanho por arquivo e miniaturas.
- **Planilha de itens (.xlsx):** botão no detalhe da requisição que baixa os itens (descrição, modelo e quantidade) em Excel, para enviar ao fornecedor sem copiar e colar. Dados internos (solicitante, projeto, faturamento direto) não vão na planilha.
- **Fluxo de status:** Pendente → Elaboração de pedido → Enviado → Recebido parcial / Recebido / Não recebido, além de Cancelado (com motivo obrigatório).
- **Transições controladas:** cada status só avança para os próximos permitidos (no detalhe e no Kanban). Não dá para pular de Pendente para Recebido, Recebido é a etapa final e uma requisição cancelada só volta para Pendente com motivo de reabertura registrado no histórico.
- **Recebimento parcial:** quem pediu informa quanto já chegou de cada item. O detalhe mostra o recebido e o que falta; quando tudo chega, a requisição vai sozinha para Recebido.
- **Comprador responsável:** ao mover para Elaboração de pedido, quem assume a compra informa seu nome (obrigatório). Ele aparece no topo da requisição, com opção de alterar, e fica registrado no histórico.
- **Regra de permissão:** só quem pediu, ou um gestor, pode marcar Recebido / Não recebido, porque é quem sabe se a mercadoria chegou. Se o prazo de entrega vence sem confirmação, a requisição passa sozinha para "Não recebido" e o solicitante é avisado.
- **Data de entrega prevista** editável a qualquer momento.
- **Duas visões:** tabela (colunas ordenáveis) e Kanban com arrastar e soltar.
- **Quem altera a requisição de outra pessoa:** editar, cancelar e excluir só pelo próprio solicitante, pelo gestor geral ou por usuários que o gestor seleciona numa lista geral (no 👤, marcando "Sou gestor"). Os demais não veem esses botões, e a operação recusa mesmo se forem chamadas.
- **Itens** precisam ter quantidade maior que zero; com 0 ou negativa a requisição não é criada.
- **Painel de Tarefas** (botão 🗓 Tarefas): para quem faz a mesma compra com frequência. A tela da tarefa é a mesma da requisição avulsa (solicitante, origem, projeto, prioridade, itens, anexos), com mais campos: descrição, data inicial e hora, quantas vezes repete por semana, mês ou ano (2 por ano = duas vezes no ano, com as datas espaçadas por igual), quando termina (data final ou renovação automática) e lembrete (10 ou 30 minutos, 1 hora ou 1 dia antes, no sino). No dia, um clique em "Gerar requisição" cria a requisição com esses dados e aquela data vira Realizada. O painel mostra o mês anterior, o atual e o próximo, e o histórico de cada tarefa traz as requisições geradas e as próximas datas.
- **"Gerar tarefa?"** ao criar uma requisição: com "Sim", ela vira modelo de uma tarefa recorrente e o dia dela já entra como Realizada; com "Não", segue o fluxo normal.
- **Comentários** na requisição, com texto, anexo ou foto e **@menção**. O autor é sempre o usuário definido em 👤, o mesmo usado nas permissões e no histórico.
- **Edição** enquanto a requisição está Pendente, **duplicar** com confirmação e **exclusão** pelo menu "⋮" de cada linha ou card.
- **Histórico de alterações** em um modal, com quem mudou o quê e quando (inclui edição de campos).
- **Notificações dentro da plataforma** (sino com contador): menções e requisições que viraram "Não recebido". A escolha por notificação interna, e não por e-mail, evita custo de envio e mantém tudo no app.
- **Filtros** por status, origem, prioridade e solicitante, além de tema claro/escuro.
- **Layout responsivo:** um único arquivo que se adapta à tela. No computador, tabela e gaveta lateral; no celular, lista em cartões, filtros recolhíveis e detalhe em tela cheia.

## O que ainda é protótipo

| Hoje | Para produção |
| --- | --- |
| Sem login: o usuário se identifica por um campo de nome | Login por e-mail e senha (Firebase Authentication) |
| Dados fixos de exemplo na própria página | Banco compartilhado (Cloud Firestore) |
| Anexos em memória, somem ao recarregar | Armazenamento de arquivos (Cloud Storage) |
| Notificações só no navegador atual | Notificações por usuário, gravadas no banco |
| Permissões simuladas no front-end | Regras de segurança no servidor |

A lógica de permissão já está isolada em funções (como `podeAlterarRecebimento`), então a troca do "usuário digitado" pelo usuário autenticado não exige reescrever as regras.

## Decisões técnicas

- **Arquivo único em HTML, CSS e JavaScript puros**, sem build e sem dependências. Abre com duplo clique e publica em qualquer hospedagem estática.
- **Dados de exemplo determinísticos** (sem sorteio), para a demonstração ser idêntica a cada carregamento.
- **Interações consistentes:** o mesmo padrão de menu de ações, confirmações e modais em toda a tela.

## Segurança

O protótipo passou por uma revisão de segurança (XSS, anexos, política de conteúdo). Os achados, o que foi corrigido e o checklist para a implantação real estão em [SEGURANCA.md](SEGURANCA.md).

### Gravações simultâneas

Toda alteração passa por uma função que lê de novo, confere a versão que a pessoa tinha na tela e as regras de status antes de gravar. Se outra ação gravou no meio, nada é gravado e a tela avisa. Criar, duplicar e comentar usam uma chave de envio, então clique duplo não duplica. O prazo vencido só é registrado uma vez.

Os testes estão em [`testes/concorrencia.html`](testes/concorrencia.html): cada um simula duas pessoas confirmando a mesma ação ao mesmo tempo e confere que só uma teve efeito. A página precisa ser aberta por um endereço web (por exemplo, no GitHub Pages), não direto do disco.

O que muda quando entrar o Firebase está em [FIREBASE-AJUSTES.md](FIREBASE-AJUSTES.md).

## Testes

Testes de integração (Playwright): cada teste abre a página de verdade num navegador real, com os dados de exemplo recém-carregados, e passa pelas mesmas funções e botões que o usuário usa.

```bash
npm install
npx playwright install chromium
npm test
```

Os dois primeiros comandos só são necessários na primeira vez. Depois de qualquer alteração, rode `npm test`. Os testes que falham por bug conhecido estão em [testes/LISTA-DE-BUGS.md](testes/LISTA-DE-BUGS.md).

## Como rodar

Baixe o `index.html` e abra no navegador. Não há instalação.

## Próximos passos

- **Migração para o Firebase:** seguir a lista de [FIREBASE-AJUSTES.md](FIREBASE-AJUSTES.md).

- Login e banco de dados reais (Firebase).
- Perfis e permissões por setor.
- Filtros salvos por usuário (por exemplo, "minhas compras" e "minhas requisições"), gravados na conta de cada pessoa.
- Integração com o módulo de Entregas e Retiradas para ligar uma compra à logística de retirada.
- **Integração com o OMIE (via `omie-automation`):** quando o pedido de compra for criado no OMIE, o nº do pedido e o status voltam sozinhos para a requisição.
- **Separar o arquivo único** em HTML, CSS e JS ao entrar o Firebase: facilita a manutenção e permite uma CSP sem `'unsafe-inline'` (ver [SEGURANCA.md](SEGURANCA.md), achado 7).
- Relatórios: tempo médio por etapa e requisições atrasadas por solicitante.

## Autor

Erick Rodrigues · [github.com/erickea888](https://github.com/erickea888)
