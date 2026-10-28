const { test, expect, abrirApp, requisicao, contarRequisicoes, preencherNovaRequisicao } = require("./ajuda");

test.describe("2. Criar requisição", () => {
  test("2.1 quando preencho os campos obrigatórios, então nasce uma Pendente com número novo e uma entrada no histórico", async ({ page }) => {
    await abrirApp(page);
    const antes = await contarRequisicoes(page);
    await preencherNovaRequisicao(page, { itens: [{ descricao: "Cabo 2,5mm", quantidade: 3 }] });
    await page.click("#modalCriar");

    expect(await contarRequisicoes(page)).toBe(antes + 1);
    const titulo = await page.locator("#reqDrawerTitulo").textContent();
    const id = titulo.split(" — ")[0];
    const r = await requisicao(page, id);
    expect(r.status).toBe("pendente");
    expect(r.historico).toHaveLength(1);
    expect(r.itens).toEqual([{ descricao: "Cabo 2,5mm", modelo: "", quantidade: 3 }]);
  });

  for (const [campo, limpar, mensagem, opcoes] of [
    ["solicitante", (p) => p.fill("#fSolicitante", ""), "solicitante"],
    ["origem", async () => {}, "origem", { semOrigem: true }],
    ["projeto", (p) => p.fill("#fProjeto", ""), "projeto"],
    ["observação", (p) => p.fill("#fObs", ""), "observação"],
  ]) {
    test(`2.2 quando falta ${campo}, então vejo a mensagem do campo e nada é criado`, async ({ page }) => {
      await abrirApp(page);
      const antes = await contarRequisicoes(page);
      await preencherNovaRequisicao(page, opcoes);
      await limpar(page);
      await page.click("#modalCriar");
      await expect(page.locator("#formErro")).toContainText(new RegExp(mensagem, "i"));
      expect(await contarRequisicoes(page)).toBe(antes);
    });
  }

  test("2.3a quando anexo um arquivo com mais de 10 MB, então a criação é recusada com aviso de tamanho", async ({ page }) => {
    await abrirApp(page);
    const antes = await contarRequisicoes(page);
    await preencherNovaRequisicao(page);
    await page.setInputFiles("#fAnexo", { name: "proposta.pdf", mimeType: "application/pdf", buffer: Buffer.alloc(11 * 1024 * 1024) });
    await page.click("#modalCriar");
    await expect(page.locator("#formErro")).toContainText("10MB");
    expect(await contarRequisicoes(page)).toBe(antes);
  });

  test("2.3b quando anexo .html ou .svg, então o arquivo é recusado e os demais continuam", async ({ page }) => {
    await abrirApp(page);
    await preencherNovaRequisicao(page);
    await page.setInputFiles("#fAnexo", [
      { name: "pagina.html", mimeType: "text/html", buffer: Buffer.from("<b>x</b>") },
      { name: "desenho.svg", mimeType: "image/svg+xml", buffer: Buffer.from("<svg/>") },
      { name: "orcamento.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4") },
    ]);
    await expect(page.locator("#avisoToast")).toContainText("não permitido");
    await page.click("#modalCriar");
    const id = (await page.locator("#reqDrawerTitulo").textContent()).split(" — ")[0];
    expect((await requisicao(page, id)).anexos.map((a) => a.name)).toEqual(["orcamento.pdf"]);
  });

  test("2.4 quando clico duas vezes em \"Criar requisição\", então nasce uma requisição só", async ({ page }) => {
    await abrirApp(page);
    const antes = await contarRequisicoes(page);
    await preencherNovaRequisicao(page);
    await page.locator("#modalCriar").dblclick();
    expect(await contarRequisicoes(page)).toBe(antes + 1);
  });

  test("2.4b quando o mesmo envio chega duas vezes ao mesmo tempo (mesma chave), então nasce uma requisição só", async ({ page }) => {
    await abrirApp(page);
    const resultado = await page.evaluate(() => {
      const antes = estadoParaTestes().requisicoes.length;
      const chave = novaChaveEnvio();
      const dados = { solicitante: "Gestor Teste", origem: "Obras", projetoNumero: "PRJ-2200", projetoNome: "",
        prioridade: "normal", observacao: "x", faturamentoDireto: false, anexos: [], itens: [] };
      return Promise.all([opCriarRequisicao(chave, dados), opCriarRequisicao(chave, dados)].map(async (r) => r.r.id))
        .then((ids) => ({ ids, criadas: estadoParaTestes().requisicoes.length - antes }));
    });
    expect(resultado.criadas).toBe(1);
    expect(resultado.ids[0]).toBe(resultado.ids[1]);
  });

  for (const qtd of [0, -2]) {
    test(`2.5 quando um item tem quantidade ${qtd}, então vejo erro e a requisição não é criada`, async ({ page }) => {
      await abrirApp(page);
      const antes = await contarRequisicoes(page);
      await preencherNovaRequisicao(page, { itens: [{ descricao: "Disjuntor 32A", quantidade: qtd }] });
      await page.click("#modalCriar");
      expect(await contarRequisicoes(page), "requisição não deveria ter sido criada").toBe(antes);
      await expect(page.locator("#formErro")).toContainText(/quantidade/i);
    });
  }
});
