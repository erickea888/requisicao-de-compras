# Requisição de Compras

Protótipo navegável de um fluxo de requisição de compras: quem precisa de material (obras, manutenção, administrativo) abre uma requisição, e o time de suprimentos acompanha, comenta e atualiza o andamento até o recebimento.

**Demonstração:** https://erickea888.github.io/requisicao-de-compras/

> Todos os dados exibidos são **fictícios**, criados só para demonstrar o fluxo. Não há backend: o estado vive na página e some ao recarregar.

## O problema

A comunicação entre o departamento de suprimentos e as equipes que pedem material (obra, manutenção, escritório) costuma se espalhar em mensagens e planilhas: ninguém sabe ao certo o que foi pedido, em que etapa está, quem comprou e se chegou. Este módulo concentra tudo em um lugar, com status claros, histórico e comentários na própria requisição.

## O que o protótipo faz

- **Abertura de requisição** com solicitante, origem (Obras, Manutenção, Administração), nº do projeto (texto livre), prioridade, itens, observação e faturamento direto.
- **Itens rápidos** para os materiais mais comuns e **anexos múltiplos** (documentos e fotos, inclusive tirando a foto pela câmera), com limite de tamanho por arquivo e miniaturas.
- **Fluxo de status:** Pendente → Elaboração de pedido → Enviado → Recebido / Não recebido, além de Cancelado (com motivo obrigatório).
- **Comprador responsável:** ao mover para Elaboração de pedido, quem assume a compra informa seu nome (obrigatório). Ele aparece no topo da requisição, com opção de alterar, e fica registrado no histórico.
- **Regra de permissão:** só quem pediu, ou um gestor, pode marcar Recebido / Não recebido, porque é quem sabe se a mercadoria chegou. Se o prazo de entrega vence sem confirmação, a requisição passa sozinha para "Não recebido" e o solicitante é avisado.
- **Data de entrega prevista** editável a qualquer momento.
- **Duas visões:** tabela (colunas ordenáveis) e Kanban com arrastar e soltar.
- **Comentários** na requisição, com texto, anexo ou foto e **@menção**.
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

## Como rodar

Baixe o `index.html` e abra no navegador. Não há instalação.

## Próximos passos

- Login e banco de dados reais (Firebase).
- Perfis e permissões por setor.
- Integração com o módulo de Entregas e Retiradas para ligar uma compra à logística de retirada.
- Relatórios: tempo médio por etapa e requisições atrasadas por solicitante.

## Autor

Erick Rodrigues · [github.com/erickea888](https://github.com/erickea888)
