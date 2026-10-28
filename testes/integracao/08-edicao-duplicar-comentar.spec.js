const { test, expect, abrirApp, requisicao, idEm, op, aoMesmoTempo, contarRequisicoes } = require("./ajuda");

test.describe("8. Edição, duplicar e comentar", () => {
  test("8.1 quando edito uma requisição Pendente, então o histórico registra os campos alterados", async ({ page }) => {
    await abrirApp(page);
    const id = await idEm(page, "pendente");
    await page.evaluate((id) => abrirDrawer(id), id);
    await page.click("#btnEditarRequisicao");
    const atual = (await requisicao(page, id)).prioridade;
    await page.selectOption("#fPrioridade", atual === "baixa" ? "alta" : "baixa");
    await page.click("#modalCriar");
    expect((await requisicao(page, id)).historico.at(-1).motivo).toBe("Campos alterados: Prioridade.");
  });

  test("8.2 quando a requisição já saiu de Pendente, então a edição é recusada", async ({ page }) => {
    await abrirApp(page);
    const id = await idEm(page, "elaboracao");
    const r = await requisicao(page, id);
    const res = await op(page, "opEditarRequisicao", id, { ...r, prioridade: "urgente" });
    expect(res.ok).toBe(false);
    expect(res.erro).toContain("não pode mais ser editada");
  });

  test("8.3 quando o solicitante edita enquanto o comprador assume, então a edição atrasada é recusada", async ({ page }) => {
    await abrirApp(page);
    const id = await idEm(page, "pendente");
    const r = await requisicao(page, id);
    const dados = { solicitante: r.solicitante, origem: r.origem, projetoNumero: r.projetoNumero, projetoNome: r.projetoNome,
      prioridade: "urgente", observacao: r.observacao, faturamentoDireto: r.faturamentoDireto, anexos: r.anexos, itens: r.itens };
    const x = await aoMesmoTempo(page, id, ["opAssumirCompra", "Ana"], ["opEditarRequisicao", dados]);
    expect(x.a.ok).toBe(true);
    expect(x.b.ok).toBe(false);
    const depois = await requisicao(page, id);
    expect(depois.status).toBe("elaboracao");
    expect(depois.prioridade).toBe(r.prioridade);
  });

  test("8.4 quando clico duas vezes em \"Sim, duplicar\", então nasce uma cópia só, sem quantidades recebidas", async ({ page }) => {
    await abrirApp(page);
    const id = await idEm(page, "recebido");
    const antes = await contarRequisicoes(page);
    await page.evaluate((id) => abrirConfirmacaoDuplicar(id), id);
    await page.locator("#duplicarSim").dblclick();
    expect(await contarRequisicoes(page)).toBe(antes + 1);
    const copiaId = (await page.locator("#reqDrawerTitulo").textContent()).split(" — ")[0];
    const copia = await requisicao(page, copiaId);
    expect(copia.status).toBe("pendente");
    expect(copia.itens.every((i) => i.recebido === undefined)).toBe(true);
  });

  test("8.4b quando o mesmo pedido de duplicar chega duas vezes ao mesmo tempo (mesma chave), então nasce uma cópia só", async ({ page }) => {
    await abrirApp(page);
    const id = await idEm(page, "recebido");
    const r = await page.evaluate((id) => {
      const antes = estadoParaTestes().requisicoes.length, chave = novaChaveEnvio();
      return Promise.all([opDuplicarRequisicao(chave, id), opDuplicarRequisicao(chave, id)].map(async (x) => x.r.id))
        .then((ids) => ({ ids, criadas: estadoParaTestes().requisicoes.length - antes }));
    }, id);
    expect(r.criadas).toBe(1);
    expect(r.ids[0]).toBe(r.ids[1]);
  });

  test("8.5 quando clico duas vezes em \"Comentar\" com @menção, então ficam um comentário e uma notificação", async ({ page }) => {
    await abrirApp(page);
    const id = await idEm(page, "enviado");
    const antesC = (await requisicao(page, id)).comentarios.length;
    const antesN = await page.evaluate(() => estadoParaTestes().notificacoes.length);
    await page.evaluate((id) => abrirDrawer(id), id);
    await page.fill("#comentarioTexto", "Chegou? @Fernanda Lima");
    await page.locator("#btnEnviarComentario").dblclick();
    expect((await requisicao(page, id)).comentarios.length - antesC).toBe(1);
    expect(await page.evaluate(() => estadoParaTestes().notificacoes.length) - antesN).toBe(1);
  });

  test("8.5c quando clico duas vezes em \"Comentar\" com a @menção no meio do texto, então ficam um comentário e uma notificação", async ({ page }) => {
    await abrirApp(page);
    const id = await idEm(page, "enviado");
    const antesC = (await requisicao(page, id)).comentarios.length;
    const antesN = await page.evaluate(() => estadoParaTestes().notificacoes.length);
    await page.evaluate((id) => abrirDrawer(id), id);
    await page.fill("#comentarioTexto", "@Fernanda Lima, chegou o material?");
    await page.locator("#btnEnviarComentario").dblclick();
    expect((await requisicao(page, id)).comentarios.length - antesC).toBe(1);
    expect(await page.evaluate(() => estadoParaTestes().notificacoes.length) - antesN).toBe(1);
  });

  test("8.5b quando o mesmo comentário chega duas vezes ao mesmo tempo (mesma chave), então fica um só", async ({ page }) => {
    await abrirApp(page);
    const id = await idEm(page, "enviado");
    const r = await page.evaluate((id) => {
      const antes = obterRequisicao(id).comentarios.length, chave = novaChaveEnvio();
      return Promise.all([1, 2].map(async () => opComentar(id, chave, "Gestor Teste", "Duplicado?", [])))
        .then(() => obterRequisicao(id).comentarios.length - antes);
    }, id);
    expect(r).toBe(1);
  });

  test("8.6 quando escrevo um comentário longo (especificação com 5.000 caracteres), então ele é gravado inteiro", async ({ page }) => {
    await abrirApp(page);
    const id = await idEm(page, "enviado");
    const textoLongo = "Especificação técnica. ".repeat(220).slice(0, 5000);
    await page.evaluate((id) => abrirDrawer(id), id);
    await page.locator("#comentarioTexto").click();
    await page.keyboard.insertText(textoLongo);
    await page.click("#btnEnviarComentario");
    expect((await requisicao(page, id)).comentarios.at(-1).texto.length).toBe(textoLongo.trim().length);
  });
});
