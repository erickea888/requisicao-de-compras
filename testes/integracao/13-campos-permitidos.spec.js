// Segurança (auditoria de 12/11/2026, correção 1): tudo o que roda no navegador pode ser alterado por quem usa.
// Criar e editar só aceitam os campos do formulário: solicitante, origem, nº do projeto, prioridade,
// observação, faturamento direto, anexos e itens (descrição, modelo, quantidade).
// Número RC, status, versão, comprador, datas, histórico, comentários e quantidades recebidas nunca vêm
// de fora: o app ignora o que chegar e cria do zero. O nome do projeto é recalculado pelo número.
const { test, expect, abrirApp, requisicao, idEm } = require("./ajuda");

const CAIXA_SAIDA = "suprimentos-demo-requisicoes-caixa-saida";

// Dados válidos do formulário + campos que ninguém pode mandar.
const FORJADOS = {
  id: "RC-9999", status: "recebido", versao: 50, compradorResponsavel: "Intruso", data: "2020-01-01T00:00:00.000Z",
  dataPrevistaEntrega: "2020-02-01T00:00:00.000Z", motivoCancelamento: "forjado", chaveCriacao: "outra-chave",
  historico: [{ status: "recebido", usuario: "Intruso" }], comentarios: [{ chave: "c1", autor: "Intruso", texto: "forjado" }],
  criadaSemInternetEm: "2020-01-01T00:00:00.000Z",
};
function dadosComForjados(observacao) {
  return Object.assign({
    solicitante: "Gestor Teste", origem: "Obras", projetoNumero: "PRJ-2200", projetoNome: "Nome inventado",
    prioridade: "normal", observacao, faturamentoDireto: false, anexos: [],
    itens: [{ descricao: "Cimento", modelo: "CP-II", quantidade: 10, recebido: 10, extra: "x" }],
  }, FORJADOS);
}
function conferirSoCamposDoFormulario(r, chave) {
  expect(r.id).not.toBe("RC-9999");
  expect(r.id).toMatch(/^RC-\d{4}$/);
  expect(r.status).toBe("pendente");
  expect(r.versao).toBe(1);
  expect(r.chaveCriacao).toBe(chave);
  expect(r.compradorResponsavel).toBeUndefined();
  expect(r.dataPrevistaEntrega).toBeUndefined();
  expect(r.motivoCancelamento).toBe("");
  expect(r.comentarios).toEqual([]);
  expect(new Date(r.data).getFullYear()).toBeGreaterThan(2020);
  expect(r.historico).toHaveLength(1);
  expect(r.historico[0]).toMatchObject({ status: "pendente", usuario: "Gestor Teste" });
  expect(r.itens).toEqual([{ descricao: "Cimento", modelo: "CP-II", quantidade: 10 }]);
  expect(r.projetoNome).toBe("Torre Corporate Plaza");
}

test.describe("18. Segurança: só os campos do formulário são aceitos", () => {
  test("quando a criação chega com número, status, comprador, histórico e recebidos forjados, então a requisição nasce Pendente e limpa", async ({ page }) => {
    await abrirApp(page);
    const res = await page.evaluate((dados) => {
      const r = opCriarRequisicao("chave-forjada-1", dados);
      return { ok: r.ok, id: r.r && r.r.id };
    }, dadosComForjados("Criação forjada"));
    expect(res.ok).toBe(true);
    conferirSoCamposDoFormulario(await requisicao(page, res.id), "chave-forjada-1");
    // O número forjado não foi ocupado por ninguém.
    expect(await requisicao(page, "RC-9999")).toBeNull();
  });

  test("quando o nome do projeto chega diferente do cadastro, então vale o nome do cadastro; número desconhecido fica sem nome", async ({ page }) => {
    await abrirApp(page);
    const nomes = await page.evaluate(() => {
      const base = { solicitante: "Gestor Teste", origem: "Obras", prioridade: "normal", observacao: "Projeto", faturamentoDireto: false, anexos: [], itens: [] };
      const a = opCriarRequisicao("proj-1", Object.assign({}, base, { projetoNumero: "PRJ-2196", projetoNome: "Outro nome" })).r;
      const b = opCriarRequisicao("proj-2", Object.assign({}, base, { projetoNumero: "XYZ-1", projetoNome: "Inventado" })).r;
      return [a.projetoNome, b.projetoNome];
    });
    expect(nomes).toEqual(["Shopping Rio Claro", ""]);
  });

  test("quando alguém altera a caixa de saída guardada no aparelho, então ao enviar a requisição nasce Pendente e limpa", async ({ page }) => {
    await abrirApp(page);
    await page.evaluate(([k, dados]) => {
      localStorage.setItem(k, JSON.stringify([{ chave: "caixa-forjada-1", dados, anexosNomes: [], guardadaEm: new Date().toISOString(), usuario: "Gestor Teste" }]));
    }, [CAIXA_SAIDA, dadosComForjados("Caixa forjada")]);
    const enviadas = await page.evaluate(() => sincronizarCaixaDeSaida());
    expect(enviadas).toHaveLength(1);
    const r = await requisicao(page, enviadas[0].id);
    expect(r.criadaSemInternetEm).not.toBe("2020-01-01T00:00:00.000Z");
    // Fora a anotação de "criada sem internet", o resto é igual a uma criação limpa.
    r.historico[0].motivo = undefined;
    conferirSoCamposDoFormulario(r, "caixa-forjada-1");
  });

  test("quando a edição chega com status, comprador, número e versão forjados, então só os campos do formulário mudam", async ({ page }) => {
    await abrirApp(page);
    const id = await idEm(page, "pendente");
    const antes = await requisicao(page, id);
    const res = await page.evaluate(([id, forjados]) => {
      const r = obterRequisicao(id);
      const dados = Object.assign({
        solicitante: r.solicitante, origem: r.origem, projetoNumero: r.projetoNumero, projetoNome: r.projetoNome,
        prioridade: r.prioridade, observacao: "Editada com campos forjados", faturamentoDireto: r.faturamentoDireto,
        anexos: r.anexos || [], itens: [{ descricao: "Areia", modelo: "", quantidade: 3, recebido: 3 }],
      }, forjados);
      const res = opEditarRequisicao(id, r.versao, dados);
      return { ok: res.ok, erro: res.erro || "" };
    }, [id, FORJADOS]);
    expect(res.ok, res.erro).toBe(true);
    const depois = await requisicao(page, id);
    expect(depois.id).toBe(id);
    expect(depois.status).toBe("pendente");
    expect(depois.versao).toBe(antes.versao + 1);
    expect(depois.chaveCriacao).toBe(antes.chaveCriacao);
    expect(depois.compradorResponsavel).toBe(antes.compradorResponsavel);
    expect(depois.data).toBe(antes.data);
    expect(depois.comentarios).toEqual(antes.comentarios);
    expect(depois.motivoCancelamento).toBe(antes.motivoCancelamento);
    expect(depois.observacao).toBe("Editada com campos forjados");
    expect(depois.itens).toEqual([{ descricao: "Areia", modelo: "", quantidade: 3 }]);
    // O histórico ganha só a entrada da edição, gravada pelo app.
    expect(depois.historico).toHaveLength(antes.historico.length + 1);
    expect(depois.historico.at(-1)).toMatchObject({ status: "pendente", edicao: true, usuario: "Gestor Teste" });
    expect(await requisicao(page, "RC-9999")).toBeNull();
  });
});
