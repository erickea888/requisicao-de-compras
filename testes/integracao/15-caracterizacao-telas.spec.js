// Testes de caracterização (passo 0 da refatoração, pedido do Erick em 12/11/2026).
// Registram como as telas funcionam HOJE, antes de dividir o index.html em arquivos. Não julgam se o
// comportamento está certo: se um deles falhar durante a refatoração, a refatoração mudou o comportamento.
// Se algum comportamento registrado aqui parecer errado, ele vai para testes/LISTA-DE-BUGS.md, sem mudar o teste.
const { test, expect, abrirApp, requisicao, idEm, contarRequisicoes } = require("./ajuda");

const STATUS = { pendente: "Pendente", elaboracao: "Elaboração de pedido", enviado: "Enviado", recebido_parcial: "Recebido parcial",
  recebido: "Recebido", nao_recebido: "Não recebido", cancelado: "Cancelado" };
const PRIORIDADE = { baixa: "Baixa", normal: "Normal", alta: "Alta", urgente: "Urgente" };

// Nomes públicos de hoje (funções e constantes/variáveis do topo do script). Depois de dividir o arquivo,
// todos precisam continuar existindo com o mesmo nome: os testes e a página testes/concorrencia.html usam esses nomes.
const FUNCOES_PUBLICAS = [
  "cssVar", "fmtData", "fmtDataOpc", "fmtDataHora", "inicioDoDia", "transicaoPermitida", "criarNotificacao",
  "isFinalizada", "isAtrasada", "prazoVencido", "aplicarPrazoVencido", "verificarPrazosEntrega", "novoId",
  "criarUrlAnexo", "criarAnexoFalso", "passaFiltroReq", "ordenarLista", "atualizarCabecalhoOrdenacao",
  "renderTabela", "renderKanban", "definirVisaoLista", "renderKPIs", "usuarioAtualNome", "usuarioAtualGestor",
  "normalizarNome", "simulandoSemInternet", "semInternet", "erroSemInternet", "podeAlterarRecebimento",
  "usuariosAutorizados", "podeAlterarRequisicao", "ehUsuarioAtual", "podeDefinirComprador", "podeTrocarComprador",
  "erroDefinirComprador", "erroTrocarComprador", "podeAlterarDataEntrega", "erroAlterarDataEntrega",
  "podeExcluirRequisicao", "tarefaQueDesfez", "erroSemPermissao", "opDefinirUsuariosAutorizados",
  "atualizarBadgePerfil", "renderAutorizadosPerfil", "atualizarVisibilidadeAutorizados", "abrirPerfil",
  "fecharPerfil", "notificacoesDoUsuario", "atualizarBadgeNotificacoes", "renderNotificacoes", "abrirNotificacoes",
  "fecharNotificacoes", "fecharDrawer", "abrirDrawer", "atualizarIdentidadeComentario", "renderComentarioAnexoLista",
  "escapeHtml", "urlSegura", "iniciaisNome", "destacarMencoes", "renderComentarios", "fecharMencaoDropdown",
  "inserirMencao", "atualizarMencaoDropdown", "obterRequisicao", "estadoParaTestes", "gravarRequisicao",
  "registrarHistorico", "erroTransicao", "dataDeISO", "opMudarStatus", "opAssumirCompra", "opAlterarComprador",
  "opConfirmarEnvio", "opAlterarDataEntrega", "opCancelar", "opReabrir", "opRegistrarRecebimento",
  "erroQuantidadeItens", "opEditarRequisicao", "opExcluirRequisicao", "novaChaveEnvio", "camposPermitidosRequisicao",
  "novaRequisicaoBase", "opCriarRequisicao", "opDuplicarRequisicao", "opComentar", "tentarMudarStatus",
  "concluirOperacao", "comBotaoTravado", "mostrarAviso", "abrirRecebimento", "fecharRecebimento", "abrirDataEntrega",
  "fecharDataEntrega", "abrirHistorico", "fecharHistorico", "abrirMotivoCancelamento", "fecharMotivoCancelamento",
  "popularListaCompradores", "abrirComprador", "fecharComprador", "atualizarContagemFiltros", "crc32", "montarZip",
  "xmlTexto", "celulaTexto", "gerarXlsxItens", "atualizarOpcoesFiltroSolicitante", "aplicarFiltrosReq", "fmtTamanho",
  "renderListaAnexos", "renderAnexoLink", "extensaoPermitida", "mesclarArquivosSelecionados", "renderAnexoLista",
  "handleArquivosSelecionados", "pararCamera", "fecharCamera", "mostrarFalhaCamera", "abrirCamera", "criarLinhaItem",
  "resetItensRapidos", "preencherItensRapidos", "definirModoTarefa", "preencherFormRequisicao",
  "abrirModalNovaRequisicao", "abrirModalEdicao", "fecharModal", "cancelarModal", "abrirConfirmacaoDuplicar",
  "fecharDuplicar", "abrirConfirmacaoExcluir", "fecharExcluir", "fecharCardMenu", "abrirCardMenu", "novoIdTarefa",
  "obterTarefa", "podeAlterarTarefa", "resumoTarefa", "descreverRecorrencia", "descreverTermino",
  "descreverFimDeSemana", "somarMeses", "somarDias", "datasDoCiclo", "ajustarFimDeSemana", "datasTarefaAte",
  "realizacaoEm", "puladaEm", "tratadaEm", "datasTarefaContem", "primeiraFutura", "situacaoData", "proximaPendente",
  "erroModeloTarefa", "erroRepeticaoTarefa", "erroDadosTarefa", "normalizarDadosTarefa", "modeloDaRequisicao",
  "gravarTarefa", "opCriarTarefa", "opEditarTarefa", "opExcluirTarefa", "erroGerarDaTarefa", "opConcluirOcorrencia",
  "opGerarRequisicaoDaTarefa", "erroDesfazerGeracao", "podeDesfazerGeracao", "liberarDataDaTarefa",
  "opDesfazerGeracao", "erroPularData", "opPularData", "opRetomarData", "verificarLembretesTarefas",
  "atualizarBadgeTarefas", "intervaloPeriodo", "tarefasVisiveis", "linhasDoPainel", "fmtPrevisao", "badgeSituacao",
  "linkRequisicao", "botaoDesfazer", "botaoGerar", "botaoPular", "botaoRetomar", "renderPainelTarefas",
  "abrirPainelTarefas", "fecharPainelTarefas", "tratarCliqueTarefas", "gerarRequisicaoDaTarefa", "retomarData",
  "abrirPularData", "fecharPularData", "desfazerGeracao", "descreverModelo", "abrirHistoricoTarefa",
  "fecharHistoricoTarefa", "dataParaInput", "horaParaInput", "lerDataInput", "dadosDoFormTarefa",
  "atualizarPreviaTarefa", "abrirFormTarefa", "cancelarFormTarefa", "salvarTarefaDoForm", "abrirExcluirTarefa",
  "fecharExcluirTarefa", "abrirPerguntaGerarTarefa", "fecharPerguntaTarefa", "lerJSONLocal", "gravarJSONLocal",
  "lerFormNovaRequisicao", "salvarRascunho", "descartarRascunho", "esconderAvisoRascunho", "restaurarRascunho",
  "caixaDeSaida", "guardarNaCaixaDeSaida", "enviarCaixaDeSaida", "sincronizarCaixaDeSaida",
  "descartarDaCaixaDeSaida", "atualizarTelaSemInternet", "atualizarBotaoTema",
];
const VARIAVEIS_PUBLICAS = [
  "TEMA_STORAGE_KEY", "PROJETOS_SEED", "PROJETOS_POR_ORIGEM", "PROJETO_POR_NUMERO", "SOLICITANTES_SEED",
  "COMPRADOR_SEED", "PESSOAS_PLATAFORMA", "STATUS_LABEL", "STATUS_ORDEM", "STATUS_RESTRITOS", "TRANSICOES",
  "PRIORIDADE_LABEL", "PRIORIDADE_RANK", "NOTIFICACOES", "PROX_NOTIF_ID", "STATUS_ANDAMENTO", "PROX_ID",
  "REQUISICOES", "OBSERVACOES_SEED", "ANEXOS_SEED", "MAX_ANEXO_BYTES", "DEFINICOES_SEED", "ITENS_SEED",
  "filtroAtivo", "ordenacaoAtiva", "ORDENACAO_ACESSOR", "tabelaBody", "kanbanBoard", "cardArrastadoId",
  "cardArrastadoVersao", "VISAO_LISTA_STORAGE_KEY", "btnVisaoTabela", "btnVisaoKanban", "tabelaWrap", "kpiGrid",
  "PERFIL_NOME_KEY", "PERFIL_GESTOR_KEY", "AUTORIZADOS_KEY", "perfilBackdrop", "perfilNomeInput",
  "perfilGestorInput", "notifDropdown", "btnNotificacoes", "reqBackdrop", "reqDrawer", "requisicaoAtualId",
  "versaoNaTela", "comentarioTexto", "comentarioAnexoLista", "mencaoDropdown", "comentarioAnexos", "mencaoAtiva",
  "chaveComentario", "btnEnviarComentario", "CAMPOS_REQUISICAO", "MAX_COMENTARIO", "avisoToast", "avisoTimer",
  "recebimentoBackdrop", "recebimentoErro", "recebimentoObs", "idPendenteRecebimento",
  "reabrirDrawerAposRecebimento", "versaoVistaRecebimento", "btnRecebimentoConfirmar", "dataEntregaBackdrop",
  "dataEntregaInput", "dataEntregaErro", "dataEntregaTitulo", "dataEntregaConfirmarBtn", "idPendenteEntrega",
  "reabrirDrawerAposEntrega", "versaoVistaEntrega", "entregaEhEdicao", "historicoBackdrop", "motivoCancelBackdrop",
  "motivoCancelTexto", "motivoCancelErro", "idPendenteCancelamento", "reabrirDrawerAposCancelamento", "modoMotivo",
  "versaoVistaMotivo", "btnMotivoConfirmar", "compradorBackdrop", "compradorInput", "compradorErro",
  "idPendenteComprador", "reabrirDrawerAposComprador", "compradorModoEdicao", "versaoVistaComprador",
  "btnCompradorConfirmar", "CRC_TABELA", "filtroStatusEl", "filtroOrigemReqEl", "filtroPrioridadeEl",
  "filtroSolicitanteReqEl", "filtroBuscaEl", "modalBackdrop", "fOrigem", "fProjeto", "fFaturamento",
  "faturamentoAviso", "fAnexoEl", "fFotoEl", "anexoLista", "anexosSelecionados", "EXT_PERMITIDAS", "cameraBackdrop",
  "cameraVideo", "cameraCanvas", "cameraErro", "cameraFallbackHint", "cameraFallbackBtn", "cameraCapturarBtn",
  "cameraStream", "cameraAoCapturar", "cameraInputFallback", "itensLista", "btnMostrarItens", "btnAdicionarItem",
  "modoEdicaoId", "versaoVistaEdicao", "chaveNovaRequisicao", "tarefaForm", "modalTituloEl", "modalCriarBtn",
  "duplicarBackdrop", "idPendenteDuplicar", "chaveDuplicar", "btnDuplicarSim", "excluirBackdrop",
  "idPendenteExcluir", "versaoVistaExcluir", "btnExcluirConfirmar", "cardMenu", "cardMenuAlvoId", "TAREFAS",
  "PROX_TAREFA_ID", "UNIDADE_LABEL", "MAX_VEZES", "LEMBRETE_LABEL", "DIAS_SEMANA_CURTO", "DIA_MS",
  "FIM_SEMANA_LABEL", "tarefasBackdrop", "tfFiltroSituacao", "tfFiltroPeriodo", "tfFiltroVer", "pularDataBackdrop",
  "pularDataMotivo", "pularDataErro", "pularDataAlvo", "btnPularDataConfirmar", "tarefaHistBackdrop", "tarefaHistId",
  "excluirTarefaBackdrop", "excluirTarefaAlvo", "btnExcluirTarefaConfirmar", "perguntaTarefaBackdrop",
  "perguntaTarefaReqId", "RASCUNHO_KEY", "CAIXA_SAIDA_KEY", "ANEXOS_CAIXA_SAIDA", "perfilSemInternetInput",
  "visaoSalva", "temaToggleBtn", "temaIconEl", "temaLabelEl",
];

// Requisição dos dados de exemplo que atende a uma condição (cópia, para comparar).
async function primeira(page, condicao) {
  const todas = await page.evaluate(() => JSON.parse(JSON.stringify(estadoParaTestes().requisicoes)));
  const r = todas.find(condicao);
  if (!r) throw new Error("nenhuma requisição de exemplo atende: " + condicao.toString());
  return r;
}
function idsDosDados(page) {
  return page.evaluate(() => estadoParaTestes().requisicoes.map((r) => ({
    id: r.id, status: r.status, origem: r.origem, prioridade: r.prioridade, solicitante: r.solicitante,
    projetoNumero: r.projetoNumero, projetoNome: r.projetoNome, comprador: r.compradorResponsavel || "",
    anexos: (r.anexos || []).map((a) => a.name),
  })));
}
function idsNaTabela(page) {
  return page.$$eval("#tabelaRequisicoes tr.req-row", (trs) => trs.map((t) => t.dataset.id));
}
async function abrirDetalhePelaTabela(page, id) {
  await page.locator("#tabelaRequisicoes tr.req-row", { has: page.locator(`b:text-is("${id}")`) }).click();
  await expect(page.locator("#reqDrawer.open")).toBeVisible();
}
// Arrastar e soltar do Kanban: dispara os mesmos eventos do navegador (dragstart no card, drop na coluna).
// O arraste pelo mouse do Playwright não aciona o arrastar nativo do HTML nesta tela.
async function arrastar(page, id, status) {
  const dt = await page.evaluateHandle(() => new DataTransfer());
  await page.locator(`#kanbanBoard .kanban-card[data-id="${id}"]`).dispatchEvent("dragstart", { dataTransfer: dt });
  await page.locator(`#kanbanBoard .kanban-coluna[data-status="${status}"]`).dispatchEvent("drop", { dataTransfer: dt });
}
const RANK = { baixa: 0, normal: 1, alta: 2, urgente: 3 };
const ORDEM_STATUS = ["pendente", "elaboracao", "enviado", "recebido_parcial", "recebido", "nao_recebido", "cancelado"];

test.describe("20. Caracterização das telas (como funciona hoje, antes de dividir o arquivo)", () => {
  test("20.1 todos os nomes públicos de hoje continuam existindo", async ({ page }) => {
    await abrirApp(page);
    const faltandoFuncoes = await page.evaluate((nomes) => nomes.filter((n) => typeof window[n] !== "function"), FUNCOES_PUBLICAS);
    expect(faltandoFuncoes).toEqual([]);
    const tipos = await page.evaluate(`[${VARIAVEIS_PUBLICAS.map((n) => `typeof ${n}`).join(",")}]`);
    const faltandoVariaveis = VARIAVEIS_PUBLICAS.filter((n, i) => tipos[i] === "undefined");
    expect(faltandoVariaveis).toEqual([]);
  });

  test("20.2 a página abre sem erro e sem bloqueio da política de segurança", async ({ page }) => {
    const bloqueios = [];
    page.on("console", (m) => { if (/Content Security Policy/i.test(m.text())) bloqueios.push(m.text()); });
    await abrirApp(page);
    await expect(page.locator("#kpiGrid .kpi")).toHaveCount(4);
    expect(bloqueios).toEqual([]);
  });

  test.describe("20.3 tabela, filtros e ordenação", () => {
    test("sem filtro, a tabela mostra todas as requisições na ordem dos dados, com nº, solicitante, projeto, prioridade e status", async ({ page }) => {
      await abrirApp(page);
      const dados = await idsDosDados(page);
      expect(await idsNaTabela(page)).toEqual(dados.map((r) => r.id));
      const r = dados[0];
      const linha = page.locator("#tabelaRequisicoes tr.req-row").first();
      await expect(linha).toContainText(r.id);
      await expect(linha).toContainText(r.solicitante);
      await expect(linha).toContainText(r.projetoNumero);
      await expect(linha.locator(`.badge.st-${r.status}`)).toHaveCount(1);
      await expect(linha.locator(`.badge.prio-${r.prioridade}`)).toHaveCount(1);
    });

    test("cada filtro de status (inclusive Em andamento e Atrasadas) mostra só as requisições dele", async ({ page }) => {
      await abrirApp(page);
      const dados = await idsDosDados(page);
      const regra = {
        andamento: (r) => ["elaboracao", "enviado", "recebido_parcial"].includes(r.status),
        atrasadas: (r) => r.status === "nao_recebido",
      };
      for (const valor of ["andamento", "atrasadas", ...ORDEM_STATUS]) {
        await page.selectOption("#filtroStatus", valor);
        const esperado = dados.filter(regra[valor] || ((r) => r.status === valor)).map((r) => r.id);
        expect(await idsNaTabela(page), `filtro ${valor}`).toEqual(esperado);
      }
    });

    test("origem, prioridade e solicitante se somam; Limpar filtros volta a mostrar tudo", async ({ page }) => {
      await abrirApp(page);
      const dados = await idsDosDados(page);
      const alvo = dados.find((r) => r.origem === "Obras");
      await page.selectOption("#filtroOrigemReq", "Obras");
      expect(await idsNaTabela(page)).toEqual(dados.filter((r) => r.origem === "Obras").map((r) => r.id));
      await page.selectOption("#filtroPrioridade", alvo.prioridade);
      await page.selectOption("#filtroSolicitanteReq", alvo.solicitante);
      const esperado = dados.filter((r) => r.origem === "Obras" && r.prioridade === alvo.prioridade && r.solicitante === alvo.solicitante).map((r) => r.id);
      expect(await idsNaTabela(page)).toEqual(esperado);
      await expect(page.locator("#filtrosAtivosContagem")).toHaveText(" (3)");
      await page.click("#filtroReqLimpar");
      expect(await idsNaTabela(page)).toEqual(dados.map((r) => r.id));
      await expect(page.locator("#filtrosAtivosContagem")).toHaveText("");
    });

    test("a busca procura no nº, solicitante, projeto, comprador e nome do anexo; sem resultado aparece o aviso", async ({ page }) => {
      await abrirApp(page);
      const dados = await idsDosDados(page);
      const campos = (r) => [r.id, r.solicitante, r.projetoNumero, r.projetoNome, r.comprador, r.anexos.join(" ")].join(" ").toLowerCase();
      for (const termo of ["prj-2200", "orcamento", "Rafael", dados[3].id]) {
        await page.fill("#filtroBusca", termo);
        expect(await idsNaTabela(page), `busca ${termo}`).toEqual(dados.filter((r) => campos(r).includes(termo.toLowerCase())).map((r) => r.id));
      }
      await page.fill("#filtroBusca", "nada-parecido-com-isso");
      await expect(page.locator("#tabelaRequisicoes")).toContainText("Nenhuma requisição encontrada para os filtros selecionados.");
    });

    test("clicar no cabeçalho ordena crescente com ▲; clicar de novo, decrescente com ▼", async ({ page }) => {
      await abrirApp(page);
      const dados = await idsDosDados(page);
      const th = page.locator('#tabelaWrap thead th[data-campo="prioridade"]');
      await th.click();
      const asc = [...dados].sort((a, b) => RANK[a.prioridade] - RANK[b.prioridade]).map((r) => r.id);
      expect(await idsNaTabela(page)).toEqual(asc);
      await expect(th.locator(".seta-ordenacao")).toHaveText(" ▲");
      await th.click();
      const desc = [...dados].sort((a, b) => RANK[b.prioridade] - RANK[a.prioridade]).map((r) => r.id);
      expect(await idsNaTabela(page)).toEqual(desc);
      await expect(th.locator(".seta-ordenacao")).toHaveText(" ▼");
      await page.locator('#tabelaWrap thead th[data-campo="id"]').click();
      expect(await idsNaTabela(page)).toEqual([...dados].map((r) => r.id).sort());
      await expect(th.locator(".seta-ordenacao")).toHaveText("");
    });

    test("no celular, ordenar por Prioridade começa pela mais urgente e o botão inverte", async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 800 });
      await abrirApp(page);
      const dados = await idsDosDados(page);
      await page.selectOption("#ordenarMobile", "prioridade");
      expect(await idsNaTabela(page)).toEqual([...dados].sort((a, b) => RANK[b.prioridade] - RANK[a.prioridade]).map((r) => r.id));
      await expect(page.locator("#ordenarMobileDir")).toHaveText("▼");
      await page.click("#ordenarMobileDir");
      expect(await idsNaTabela(page)).toEqual([...dados].sort((a, b) => RANK[a.prioridade] - RANK[b.prioridade]).map((r) => r.id));
      await expect(page.locator("#ordenarMobileDir")).toHaveText("▲");
    });
  });

  test.describe("20.4 KPIs, Kanban, visão e tema", () => {
    test("os 4 KPIs mostram total, pendentes, em andamento e atrasadas; clicar em Aguardando triagem filtra Pendente", async ({ page }) => {
      await abrirApp(page);
      const dados = await idsDosDados(page);
      const valores = await page.$$eval("#kpiGrid .kpi .value", (els) => els.map((e) => e.textContent));
      expect(valores).toEqual([
        String(dados.length),
        String(dados.filter((r) => r.status === "pendente").length),
        String(dados.filter((r) => ["elaboracao", "enviado", "recebido_parcial"].includes(r.status)).length),
        String(dados.filter((r) => r.status === "nao_recebido").length),
      ]);
      const canceladas = dados.filter((r) => r.status === "cancelado").length;
      await expect(page.locator("#kpiGrid .kpi .delta").first()).toHaveText(`${canceladas} cancelada${canceladas !== 1 ? "s" : ""}`);
      await page.locator("#kpiGrid .kpi", { hasText: "Aguardando triagem" }).click();
      await expect(page.locator("#filtroStatus")).toHaveValue("pendente");
      expect(await idsNaTabela(page)).toEqual(dados.filter((r) => r.status === "pendente").map((r) => r.id));
    });

    test("a visão Kanban mostra uma coluna por status, com a contagem e os cards de cada uma, e fica guardada ao reabrir", async ({ page }) => {
      await abrirApp(page);
      const dados = await idsDosDados(page);
      await page.click("#btnVisaoKanban");
      await expect(page.locator("#kanbanBoard")).toBeVisible();
      await expect(page.locator("#tabelaWrap")).toBeHidden();
      const colunas = await page.$$eval("#kanbanBoard .kanban-coluna", (cols) => cols.map((c) => ({
        status: c.dataset.status, contagem: c.querySelector(".contagem").textContent,
        ids: [...c.querySelectorAll(".kanban-card")].map((k) => k.dataset.id),
      })));
      expect(colunas).toEqual(ORDEM_STATUS.map((s) => {
        const ids = dados.filter((r) => r.status === s).map((r) => r.id);
        return { status: s, contagem: String(ids.length), ids };
      }));
      await page.reload();
      await expect(page.locator("#kanbanBoard")).toBeVisible();
      await expect(page.locator("#btnVisaoKanban")).toHaveClass(/ativo/);
      await page.click("#btnVisaoTabela");
      await expect(page.locator("#tabelaWrap")).toBeVisible();
      await expect(page.locator("#kanbanBoard")).toBeHidden();
    });

    test("arrastar um card Pendente para Elaboração abre a janela do comprador; para Recebido é recusado e nada muda", async ({ page }) => {
      await abrirApp(page);
      await page.click("#btnVisaoKanban");
      const id = await idEm(page, "pendente");
      await arrastar(page, id, "elaboracao");
      await expect(page.locator("#compradorBackdrop.open")).toBeVisible();
      await page.click("#compradorVoltar");
      expect((await requisicao(page, id)).status).toBe("pendente");
      await arrastar(page, id, "recebido");
      await expect(page.locator("#avisoToast.open.erro")).toBeVisible();
      expect((await requisicao(page, id)).status).toBe("pendente");
    });

    test("o tema escuro liga e desliga pelo botão e fica guardado ao reabrir", async ({ page }) => {
      await abrirApp(page);
      await expect(page.locator("#temaLabel")).toHaveText("Tema escuro");
      await page.click("#temaToggle");
      await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
      await expect(page.locator("#temaLabel")).toHaveText("Tema claro");
      await page.reload();
      await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
      await page.click("#temaToggle");
      await expect(page.locator("html")).not.toHaveAttribute("data-theme", "dark");
      await expect(page.locator("#temaLabel")).toHaveText("Tema escuro");
    });
  });

  test.describe("20.5 detalhe e janelas por clique", () => {
    test("clicar na linha abre o detalhe com solicitante, projeto e prioridade da requisição", async ({ page }) => {
      await abrirApp(page);
      const r = await primeira(page, (r) => r.status === "pendente");
      await abrirDetalhePelaTabela(page, r.id);
      await expect(page.locator("#reqDrawerTitulo")).toContainText(r.id);
      await expect(page.locator("#reqInfoSolicitante")).toHaveText(r.solicitante);
      await expect(page.locator("#reqInfoProjeto")).toContainText(r.projetoNumero);
      await expect(page.locator("#reqInfoPrioridade")).toContainText(PRIORIDADE[r.prioridade]);
    });

    test("o Histórico mostra todas as entradas, da mais nova para a mais antiga", async ({ page }) => {
      await abrirApp(page);
      const r = await primeira(page, (r) => r.historico.length >= 3);
      await abrirDetalhePelaTabela(page, r.id);
      await page.click("#btnHistoricoRequisicao");
      await expect(page.locator("#historicoBackdrop.open")).toBeVisible();
      await expect(page.locator("#historicoTitulo")).toHaveText(`Histórico de alterações — ${r.id}`);
      await expect(page.locator("#historicoLista li")).toHaveCount(r.historico.length);
      const ultimo = r.historico[r.historico.length - 1];
      if (!ultimo.edicao) await expect(page.locator("#historicoLista li").first()).toContainText(STATUS[ultimo.status]);
      await page.click("#historicoClose");
      await expect(page.locator("#historicoBackdrop.open")).toHaveCount(0);
    });

    test("Baixar planilha gera o arquivo NNNN-itens.xlsx com os itens da requisição", async ({ page }) => {
      await abrirApp(page);
      const r = await primeira(page, (r) => (r.itens || []).length > 0);
      await abrirDetalhePelaTabela(page, r.id);
      const [download] = await Promise.all([page.waitForEvent("download"), page.click("#btnBaixarItens")]);
      expect(download.suggestedFilename()).toBe(`${r.id}-itens.xlsx`);
      const fs = require("fs");
      const conteudo = fs.readFileSync(await download.path());
      expect(conteudo.subarray(0, 2).toString()).toBe("PK");
      for (const i of r.itens.filter((i) => !/[&<>"']/.test(i.descricao))) {
        expect(conteudo.includes(Buffer.from(i.descricao, "utf8")), i.descricao).toBe(true);
      }
    });

    test("Recebido parcial pela tela abre a lista de itens e grava o que chegou", async ({ page }) => {
      await abrirApp(page);
      const r = await primeira(page, (r) => r.status === "enviado" && (r.itens || []).length > 0 && Number(r.itens[0].quantidade) > 1);
      await abrirDetalhePelaTabela(page, r.id);
      await page.selectOption("#reqStatusSelect", "recebido_parcial");
      await page.click("#reqStatusSalvar");
      await expect(page.locator("#recebimentoBackdrop.open")).toBeVisible();
      await expect(page.locator("#recebimentoTitulo")).toHaveText(`Registrar recebimento parcial — ${r.id}`);
      await expect(page.locator("#recebimentoItens tr")).toHaveCount(r.itens.length);
      await page.fill('#recebimentoItens input[data-idx="0"]', "1");
      await page.click("#recebimentoConfirmar");
      const depois = await requisicao(page, r.id);
      expect(depois.status).toBe("recebido_parcial");
      expect(Number(depois.itens[0].recebido)).toBe(1);
    });

    test("o menu ⋮ da linha duplica (com confirmação) e exclui (com confirmação)", async ({ page }) => {
      await abrirApp(page);
      const r = await primeira(page, (r) => r.status === "pendente");
      const antes = await contarRequisicoes(page);
      const botaoMenu = () => page.locator(`#tabelaRequisicoes .card-menu-btn[data-id="${r.id}"]`);
      await botaoMenu().click();
      await expect(page.locator("#cardMenu.open")).toBeVisible();
      await expect(page.locator("#reqDrawer.open")).toHaveCount(0);
      await page.click("#cardMenuDuplicar");
      await expect(page.locator("#duplicarBackdrop.open")).toBeVisible();
      await page.click("#duplicarSim");
      expect(await contarRequisicoes(page)).toBe(antes + 1);
      const copia = await page.evaluate(() => JSON.parse(JSON.stringify(estadoParaTestes().requisicoes[0])));
      expect(copia).toMatchObject({ status: "pendente", observacao: r.observacao, solicitante: r.solicitante });
      if (await page.locator("#reqDrawer.open").count()) await page.click("#reqDrawerClose");
      if (await page.locator("#perguntaTarefaBackdrop.open").count()) await page.click("#perguntaTarefaNao");
      await botaoMenu().click();
      await page.click("#cardMenuExcluir");
      await expect(page.locator("#excluirBackdrop.open")).toBeVisible();
      await page.click("#excluirConfirmar");
      expect(await requisicao(page, r.id)).toBeNull();
      expect(await contarRequisicoes(page)).toBe(antes);
    });

    test("anexo na nova requisição: PDF entra na lista; .html é recusado com aviso", async ({ page }) => {
      await abrirApp(page);
      await page.click("#btnNovaRequisicao");
      await page.setInputFiles("#fAnexo", { name: "orcamento-teste.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4 teste") });
      await expect(page.locator("#anexoLista")).toContainText("orcamento-teste.pdf");
      await page.setInputFiles("#fAnexo", { name: "pagina.html", mimeType: "text/html", buffer: Buffer.from("<b>x</b>") });
      await expect(page.locator("#avisoToast.open.erro")).toContainText("Tipo de arquivo não permitido: pagina.html");
      await expect(page.locator("#anexoLista")).not.toContainText("pagina.html");
    });

    test("sem câmera disponível, Tirar foto mostra o aviso e o botão para escolher o arquivo", async ({ page }) => {
      // A câmera é um dispositivo externo ao app: o teste faz o navegador responder "sem câmera".
      await page.addInitScript(() => {
        if (navigator.mediaDevices) navigator.mediaDevices.getUserMedia = () => Promise.reject(new Error("sem câmera"));
      });
      await abrirApp(page);
      await page.click("#btnNovaRequisicao");
      await page.click("#btnTirarFotoForm");
      await expect(page.locator("#cameraBackdrop.open")).toBeVisible();
      await expect(page.locator("#cameraErro")).toContainText("Não conseguimos acessar a câmera");
      await expect(page.locator("#cameraFallbackBtn")).toBeVisible();
      await expect(page.locator("#cameraCapturar")).toBeHidden();
    });
  });
});
