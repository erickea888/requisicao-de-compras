const { test, expect, abrirApp, requisicao, idEm, aoMesmoTempo } = require("./ajuda");

test.describe("3. Assumir compra (Pendente → Elaboração)", () => {
  test("3.1 quando confirmo o comprador, então o status vai para Elaboração com o comprador na requisição", async ({ page }) => {
    await abrirApp(page);
    const id = await idEm(page, "pendente");
    await page.evaluate((id) => abrirDrawer(id), id);
    await page.selectOption("#reqStatusSelect", "elaboracao");
    await page.click("#reqStatusSalvar");
    await page.fill("#compradorInput", "Ana Compras");
    await page.click("#compradorConfirmar");

    const r = await requisicao(page, id);
    expect(r.status).toBe("elaboracao");
    expect(r.compradorResponsavel).toBe("Ana Compras");
    await expect(page.locator("#reqDrawerCompradorNome")).toHaveText("Ana Compras");
  });

  test("3.2 quando deixo o comprador em branco, então vejo o erro e nada muda", async ({ page }) => {
    await abrirApp(page);
    const id = await idEm(page, "pendente");
    await page.evaluate((id) => abrirDrawer(id), id);
    await page.selectOption("#reqStatusSelect", "elaboracao");
    await page.click("#reqStatusSalvar");
    await page.fill("#compradorInput", "");
    await page.click("#compradorConfirmar");
    await expect(page.locator("#compradorErro")).toContainText("comprador");
    expect((await requisicao(page, id)).status).toBe("pendente");
  });

  test("3.3 quando dois compradores assumem ao mesmo tempo, então só o primeiro grava e o segundo é avisado", async ({ page }) => {
    await abrirApp(page);
    const id = await idEm(page, "pendente");
    const x = await aoMesmoTempo(page, id, ["opAssumirCompra", "Ana"], ["opAssumirCompra", "Bruno"]);
    expect(x.a.ok).toBe(true);
    expect(x.b.ok).toBe(false);
    expect(x.b.erro).toContain("alterada por outra ação");
    expect(x.historicoNovo).toBe(1);
    expect((await requisicao(page, id)).compradorResponsavel).toBe("Ana");
  });

  test("3.4 quando uma pessoa cancela e outra assume ao mesmo tempo, então só uma vale e não sobra comprador em cancelada", async ({ page }) => {
    await abrirApp(page);
    const id = await idEm(page, "pendente");
    const x = await aoMesmoTempo(page, id, ["opCancelar", "não precisa mais"], ["opAssumirCompra", "Bruno"]);
    expect(x.a.ok !== x.b.ok).toBe(true);
    expect(x.historicoNovo).toBe(1);
    const r = await requisicao(page, id);
    expect(r.status).toBe("cancelado");
    expect(r.compradorResponsavel || "").toBe("");
  });
});
