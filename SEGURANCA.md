# Revisão de segurança: Requisição de Compras

Escopo: `index.html` (HTML, CSS e JavaScript do protótipo). Revisão estática do código e testes automatizados de injeção. Não houve teste de invasão em ambiente real, porque o protótipo não tem servidor.

## Resumo

O protótipo roda 100% no navegador e não tem backend, login nem banco. Por isso a principal falha corrigível hoje estava no próprio código (XSS) e os demais riscos só se resolvem na implantação real, com autenticação e regras no servidor.

## Achados e situação

| # | Severidade | Achado | Situação |
|---|---|---|---|
| 1 | Alta | **XSS armazenado.** Textos digitados pelo usuário (solicitante, nº/nome do projeto, itens, motivo de cancelamento, autor e texto de comentário, nome de arquivo) eram colocados na página com `innerHTML` sem escape. Um nome como `<img src=x onerror=...>` executava código no navegador de quem abrisse a requisição. Na versão real, isso roubaria a sessão de qualquer usuário. | **Corrigido.** Todo texto de usuário passa por `escapeHtml` ao ser exibido. Teste com payloads em todos os campos: 0 execuções. |
| 2 | Média | `escapeHtml` não tratava aspas, o que permitia sair de atributos HTML (`href`, `value`, `download`). | **Corrigido.** Agora escapa `& < > " '`. |
| 3 | Média | Links de anexo aceitavam qualquer URL (inclusive `javascript:`). | **Corrigido.** Só `blob:` gerado pelo app é aceito; o resto vira `#`. |
| 4 | Média | O `accept` dos campos de arquivo é só dica da tela: dava para anexar `.html`, `.svg` ou outro tipo perigoso. | **Corrigido.** Lista de extensões conferida em JavaScript (PDF, Excel, Word, PNG, JPG, WebP, HEIC). Na implantação, repetir a checagem no servidor (extensão, tipo real do arquivo, antivírus). |
| 5 | Média | Texto escapado na gravação do histórico (risco de escape duplo e de esquecer em outro ponto). | **Corrigido.** Gravação guarda o texto puro; o escape é feito sempre na exibição. |
| 6 | Baixa | Sem limite de tamanho nos campos de texto. | **Corrigido.** Limites de caracteres nos formulários. O comentário tem teto de 20.000 caracteres (especificações longas; acima disso a tela avisa em vez de cortar). Repetir no servidor. |
| 7 | Média | Sem política de segurança de conteúdo (CSP) nem controle de referrer. | **Mitigado.** Adicionado CSP via `<meta>`: sem scripts externos, sem conexões de rede, sem frames, sem formulários. Limitação: ainda usa `'unsafe-inline'`, porque o JavaScript está dentro do HTML. Em produção, mover o JS para arquivo próprio e usar CSP por cabeçalho com nonce ou hash. |
| 8 | Alta (na produção) | **Permissões só no navegador.** "Gestor admin geral" é uma caixa de seleção no próprio perfil: qualquer pessoa marca e ganha poder. O nome do usuário é digitado e não é verificado. | **Aberto, por natureza do protótipo.** Resolver com login (Firebase Authentication) e regras no servidor (Firestore Security Rules) que checam o usuário autenticado e o papel dele. Nunca confiar em permissão decidida no front-end. |
| 9 | Alta (na produção) | **Dados e anexos em memória / localStorage.** Nada é criptografado nem protegido por acesso. | **Aberto.** Banco com regras por usuário e setor; anexos em armazenamento privado com regras de acesso e links temporários. |
| 10 | Média | Site hospedado no GitHub Pages **não permite cabeçalhos de segurança** (`X-Frame-Options`, `frame-ancestors`, HSTS configurável). A página pode ser embutida em outro site (clickjacking). | **Aberto.** Resolver na hospedagem real (Firebase Hosting, Cloudflare ou similar), com cabeçalhos configurados. |
| 11 | Informativo | Não há bibliotecas de terceiros nem chamadas externas. Isso elimina risco de cadeia de suprimentos e vazamento de dados para outros domínios. | OK. Manter assim, ou fixar versão e integridade (SRI) se alguma entrar. |

## Atenção: dados reais

- O repositório e o link do GitHub Pages são **públicos**. Qualquer pessoa vê tudo. **Não coloque dados reais da empresa** (nomes de funcionários, fornecedores, projetos, valores, anexos) no protótipo público.
- O protótipo público deve continuar só com dados fictícios. A versão com dados reais precisa ficar em outro repositório **privado**, publicado numa hospedagem com login.
- Vale conferir o repositório antigo da suíte (DASHSUPRIMENTOS): ele tem famílias de materiais reais do OMIE e a marca da empresa. Se for público, torne-o privado.
- Nomes de pessoas são dados pessoais. Na versão real, considere a LGPD: finalidade, quem acessa, por quanto tempo guarda e como exclui.

## Checklist para a implantação (para o engenheiro de software)

1. **Autenticação:** Firebase Authentication com e-mail e senha da empresa; considerar login único (SSO) e verificação em duas etapas.
2. **Autorização no servidor:** papéis (solicitante, comprador, gestor) gravados no banco ou em claims; regras que impedem, por exemplo, quem não é o solicitante de marcar "Recebido".
3. **Firestore Security Rules:** nega tudo por padrão; valida tipo, tamanho e valores permitidos (status, prioridade, origem) de cada campo; impede alterar `solicitante` e `historico` de outro usuário.
4. **Histórico e auditoria:** gravar quem fez o quê pelo servidor (UID e horário do servidor), não pelo nome digitado.
5. **Anexos:** Cloud Storage privado; regras por usuário; limite de tamanho e tipo no servidor; antivírus; nunca servir arquivo enviado pelo usuário no mesmo domínio do app sem `Content-Disposition: attachment`.
6. **Firebase App Check** e limite de requisições para reduzir abuso.
7. **Cabeçalhos de segurança** na hospedagem: CSP (sem `unsafe-inline`), `frame-ancestors 'none'`, HSTS, `X-Content-Type-Options: nosniff`, `Referrer-Policy`.
8. **Segredos:** chaves e tokens nunca no repositório (usar variáveis de ambiente e secrets); ativar varredura de segredos no GitHub.
9. **Backups e exclusão:** backup automático do banco e rotina de exclusão conforme a política de retenção.
10. **Testes:** análise automática de dependências (Dependabot), revisão de código a cada mudança e um teste de invasão antes de abrir para todos.

## Como foi testado

- Leitura completa dos pontos de entrada de dados (formulários, comentários, anexos, filtros) e dos pontos de saída (`innerHTML`, atributos, links).
- Teste automatizado: criada uma requisição com `<img src=x onerror=...>` em todos os campos de texto, em nome de arquivo (com aspas) e em link `javascript:`. Resultado: nenhuma execução, nenhum elemento injetado, link neutralizado para `#`.
- Validação da checagem de extensões (`.html` e `.svg` bloqueados; `.PDF` aceito).
