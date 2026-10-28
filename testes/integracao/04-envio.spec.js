const { test, expect, abrirApp, comoUsuario, requisicao, idEm, op, aoMesmoTempo, diaRelativo, prepararEnviado } = require("./ajuda");

const dataGravada = (r) => {
  const d = new Date(r.dataPrevistaEntrega);
  const p = (x) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

test.describe("4. Enviar e data de entrega", () => {
  test("4.1 quando confirmo a data, então o status vai para Enviado com a data gravada", async ({ page }) => {
    await abrirApp(page);
    const id = await idEm(page, "elaboracao");
    await page.evaluate((id) => abrirDrawer(id), id);
    await page.selectOption("#reqStatusSelect", "enviado");
    await page.click("#reqStatusSalvar");
    await page.fill("#dataEntregaInput", diaRelativo(7));
    await page.click("#dataEntregaConfirmar");

    const r = await requisicao(page, id);
    expect(r.status).toBe("enviado");
    expect(dataGravada(r)).toBe(diaRelativo(7));
  });

  test("4.2 quando a data está vazia, então vejo o erro e nada muda", async ({ page }) => {
    await abrirApp(page);
    const id = await idEm(page, "elaboracao");
    await page.evaluate((id) => abrirDrawer(id), id);
    await page.selectOption("#reqStatusSelect", "enviado");
    await page.click("#reqStatusSalvar");
    await page.fill("#dataEntregaInput", "");
    await page.click("#dataEntregaConfirmar");
    await expect(page.locator("#dataEntregaErro")).toContainText("data prevista");
    expect((await requisicao(page, id)).status).toBe("elaboracao");
  });

  test("4.3 quando altero a data de uma requisição em Não recebido, então ela volta para Enviado", async ({ page }) => {
    await abrirApp(page);
    const id = await idEm(page, "nao_recebido");
    const res = await op(page, "opAlterarDataEntrega", id, diaRelativo(5));
    expect(res.ok, res.erro).toBe(true);
    const r = await requisicao(page, id);
    expect(r.status).toBe("enviado");
    expect(dataGravada(r)).toBe(diaRelativo(5));
  });

  test("4.4 quando duas pessoas confirmam datas diferentes ao mesmo tempo, então só uma data é gravada", async ({ page }) => {
    await abrirApp(page);
    const id = await idEm(page, "elaboracao");
    const x = await aoMesmoTempo(page, id, ["opConfirmarEnvio", diaRelativo(3), ""], ["opConfirmarEnvio", diaRelativo(9), ""]);
    expect(x.a.ok).toBe(true);
    expect(x.b.ok).toBe(false);
    expect(x.historicoNovo).toBe(1);
    expect(dataGravada(await requisicao(page, id))).toBe(diaRelativo(3));
  });

  test("4.4b quando duas pessoas alteram a data ao mesmo tempo, então só uma alteração é gravada", async ({ page }) => {
    await abrirApp(page);
    const id = await prepararEnviado(page);
    const x = await aoMesmoTempo(page, id, ["opAlterarDataEntrega", diaRelativo(4)], ["opAlterarDataEntrega", diaRelativo(8)]);
    expect(x.a.ok !== x.b.ok).toBe(true);
    expect(x.historicoNovo).toBe(1);
    expect(dataGravada(await requisicao(page, id))).toBe(diaRelativo(4));
  });

  test("4.5 quando informo data de entrega no passado, então é aceita, cai em Não recebido e o solicitante marca Recebido", async ({ page }) => {
    await abrirApp(page);
    const id = await idEm(page, "elaboracao");
    await page.evaluate((id) => abrirDrawer(id), id);
    await page.selectOption("#reqStatusSelect", "enviado");
    await page.click("#reqStatusSalvar");
    await page.fill("#dataEntregaInput", diaRelativo(-3));
    await page.click("#dataEntregaConfirmar");
    expect((await requisicao(page, id)).status).toBe("nao_recebido");

    const solicitante = (await requisicao(page, id)).solicitante;
    await comoUsuario(page, solicitante, false);
    const res = await op(page, "opMudarStatus", id, "recebido");
    expect(res.ok, res.erro).toBe(true);
    expect((await requisicao(page, id)).status).toBe("recebido");
  });
});
