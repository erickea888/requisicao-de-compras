const { test, expect, abrirApp, comoUsuario, requisicao, idEm, op } = require("./ajuda");

test.describe("1. Perfil (identidade)", () => {
  test("1.1 quando defino meu nome no 👤, então comentário, histórico e nova requisição usam esse nome", async ({ page }) => {
    await abrirApp(page, { usuario: "Juliana Prado", gestor: false });

    await page.click("#btnNovaRequisicao");
    await expect(page.locator("#fSolicitante")).toHaveValue("Juliana Prado");
    await page.click("#modalCancelar");

    const id = await idEm(page, "pendente");
    await page.evaluate((id) => abrirDrawer(id), id);
    await page.fill("#comentarioTexto", "Comentário de identidade");
    await page.click("#btnEnviarComentario");
    const r = await requisicao(page, id);
    expect(r.comentarios.at(-1).autor).toBe("Juliana Prado");

    expect((await op(page, "opAssumirCompra", id, "Juliana Prado")).ok).toBe(true);
    expect((await requisicao(page, id)).historico.at(-1).usuario).toBe("Juliana Prado");
  });

  test("1.2 quando não há usuário definido e tento comentar, então vejo o erro e nada é gravado", async ({ page }) => {
    await abrirApp(page, { usuario: "", gestor: false });
    const id = await idEm(page, "pendente");
    const antes = (await requisicao(page, id)).comentarios.length;
    await page.evaluate((id) => abrirDrawer(id), id);
    await page.fill("#comentarioTexto", "sem usuário");
    await page.click("#btnEnviarComentario");
    await expect(page.locator("#comentarioErro")).toContainText("Defina seu usuário");
    expect((await requisicao(page, id)).comentarios.length).toBe(antes);
  });

  test("1.3 quando troco de usuário, então o sino mostra só as notificações do novo usuário", async ({ page }) => {
    await abrirApp(page);
    const id = await idEm(page, "pendente");
    await page.evaluate((id) => {
      opComentar(id, novaChaveEnvio(), "Gestor Teste", "Para a @Fernanda Lima", []);
      opComentar(id, novaChaveEnvio(), "Gestor Teste", "Para o @Bruno Castilho", []);
    }, id);

    await comoUsuario(page, "Fernanda Lima");
    const daFernanda = await page.evaluate(() => notificacoesDoUsuario().map((n) => n.para));
    expect(daFernanda.length).toBeGreaterThan(0);
    expect(daFernanda.every((p) => p === "Fernanda Lima")).toBe(true);

    await comoUsuario(page, "Bruno Castilho");
    const doBruno = await page.evaluate(() => notificacoesDoUsuario().map((n) => n.para));
    expect(doBruno.length).toBeGreaterThan(0);
    expect(doBruno.every((p) => p === "Bruno Castilho")).toBe(true);
  });
});
