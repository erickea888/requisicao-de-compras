// Auxiliares dos testes de integração.
// "Base de teste": cada teste abre a página do zero, com os dados de exemplo recém-gerados. Nada é
// compartilhado entre testes e não existe banco de produção para atingir.
// As operações (op…) são as mesmas que os botões chamam — é a "rota" do app até entrar o Firebase.
const base = require("@playwright/test");

const CHAVE_NOME = "suprimentos-demo-requisicoes-usuario-nome";
const CHAVE_GESTOR = "suprimentos-demo-requisicoes-usuario-gestor";

// Todo teste falha se a página tiver erro de JavaScript, mesmo que o resto passe.
const test = base.test.extend({
  page: async ({ page }, use) => {
    const erros = [];
    page.on("pageerror", (e) => erros.push(e.message));
    await use(page);
    base.expect(erros, "erros de JavaScript na página").toEqual([]);
  },
});
const { expect } = base;

// Abre o app com um usuário no perfil 👤 (por padrão, um gestor, que pode tudo).
async function abrirApp(page, { usuario = "Gestor Teste", gestor = true } = {}) {
  await page.addInitScript(([kN, kG, n, g]) => {
    // Só na primeira carga: trocas de usuário no meio do teste não são desfeitas por recarga.
    if (sessionStorage.getItem("perfil-teste-definido")) return;
    sessionStorage.setItem("perfil-teste-definido", "1");
    localStorage.setItem(kN, n);
    localStorage.setItem(kG, g ? "1" : "0");
  }, [CHAVE_NOME, CHAVE_GESTOR, usuario, gestor]);
  await page.goto("/index.html");
  await expect(page.locator("#tabelaRequisicoes tr").first()).toBeVisible();
}

// Troca quem está usando a página (equivale a outra pessoa logada).
async function comoUsuario(page, usuario, gestor = false) {
  await page.evaluate(([kN, kG, n, g]) => {
    localStorage.setItem(kN, n);
    localStorage.setItem(kG, g ? "1" : "0");
  }, [CHAVE_NOME, CHAVE_GESTOR, usuario, gestor]);
}

// Cópia dos dados de uma requisição, para conferir o que foi gravado.
function requisicao(page, id) {
  return page.evaluate((id) => {
    const r = obterRequisicao(id);
    return r ? JSON.parse(JSON.stringify(r)) : null;
  }, id);
}

// Id da n-ésima requisição de exemplo num status (opcionalmente de outro solicitante que não "exceto").
function idEm(page, status, { n = 0, exceto } = {}) {
  return page.evaluate(([status, n, exceto]) => {
    const lista = estadoParaTestes().requisicoes.filter((x) => x.status === status && x.solicitante !== exceto);
    if (!lista[n]) throw new Error(`não há requisição de exemplo nº ${n + 1} em "${status}"`);
    return lista[n].id;
  }, [status, n, exceto || null]);
}

function contarRequisicoes(page) {
  return page.evaluate(() => estadoParaTestes().requisicoes.length);
}

// Chama uma operação do app como os botões fazem: com a versão que está na tela agora.
function op(page, nome, id, ...args) {
  return page.evaluate(([nome, id, args]) => {
    if (typeof window[nome] !== "function") throw new Error(`a operação ${nome} ainda não existe no app`);
    const r = obterRequisicao(id);
    const res = window[nome](id, r ? r.versao : null, ...args);
    return { ok: res.ok, erro: res.erro || "" };
  }, [nome, id, args]);
}

// Duas pessoas viram a mesma versão e confirmam ao mesmo tempo.
// chamadas: [[nomeDaOperação, ...argumentosDepoisDeIdEVersao], [...]]
function aoMesmoTempo(page, id, chamadaA, chamadaB) {
  return page.evaluate(([id, a, b]) => {
    const r = obterRequisicao(id);
    const versao = r.versao, historicoAntes = r.historico.length, notifAntes = estadoParaTestes().notificacoes.length;
    // Promise.all: as duas confirmações saem juntas, sobre a mesma versão vista.
    return Promise.all([a, b].map(async ([nome, ...args]) => {
      const res = window[nome](id, versao, ...args);
      return { ok: res.ok, erro: res.erro || "" };
    })).then(([ra, rb]) => ({
      a: ra, b: rb,
      historicoNovo: obterRequisicao(id).historico.length - historicoAntes,
      notificacoesNovas: estadoParaTestes().notificacoes.length - notifAntes,
    }));
  }, [id, chamadaA, chamadaB]);
}

// Datas no formato do campo de data (AAAA-MM-DD), a partir de hoje.
function diaRelativo(dias) {
  const d = new Date(Date.now() + dias * 86400000);
  const p = (x) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// Leva uma requisição em Elaboração até Enviado (preparação de cenário).
async function prepararEnviado(page, { n = 0, dataISO = diaRelativo(10) } = {}) {
  const id = await idEm(page, "elaboracao", { n });
  const res = await op(page, "opConfirmarEnvio", id, dataISO, "");
  expect(res.ok, res.erro).toBe(true);
  return id;
}

// Preenche e envia o formulário de nova requisição pela tela.
// semOrigem: deixa a origem sem escolher ("Selecione..." não pode ser escolhido de volta na tela).
async function preencherNovaRequisicao(page, { itens = [], observacao = "Criada pelo teste", semOrigem = false } = {}) {
  await page.click("#btnNovaRequisicao");
  if (!semOrigem) await page.selectOption("#fOrigem", "Obras");
  await page.fill("#fProjeto", "PRJ-2200");
  await page.fill("#fObs", observacao);
  if (itens.length) {
    await page.click("#btnMostrarItens");
    for (let i = 0; i < itens.length; i++) {
      if (i > 0) await page.click("#btnAdicionarItem");
      const linha = page.locator("#itensLista .item-row").nth(i);
      await linha.locator(".item-descricao").fill(itens[i].descricao);
      await linha.locator(".item-qtd").fill(String(itens[i].quantidade));
    }
  }
}

module.exports = {
  test, expect, abrirApp, comoUsuario, requisicao, idEm, contarRequisicoes, op, aoMesmoTempo,
  diaRelativo, prepararEnviado, preencherNovaRequisicao,
};
