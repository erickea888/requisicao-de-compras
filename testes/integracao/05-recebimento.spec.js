const { test, expect, abrirApp, comoUsuario, requisicao, op, aoMesmoTempo, prepararEnviado } = require("./ajuda");

test.describe("5. Recebimento", () => {
  test("5.1 quando registro parte das quantidades, então vai para Recebido parcial e o detalhe mostra o que falta", async ({ page }) => {
    await abrirApp(page);
    const id = await prepararEnviado(page);
    await page.evaluate((id) => abrirDrawer(id), id);
    await page.selectOption("#reqStatusSelect", "recebido_parcial");
    await page.click("#reqStatusSalvar");
    await page.fill('#recebimentoItens input[data-idx="0"]', "1");
    await page.click("#recebimentoConfirmar");

    const r = await requisicao(page, id);
    expect(r.status).toBe("recebido_parcial");
    expect(r.itens[0].recebido).toBe(1);
    await expect(page.locator("#reqInfoItens")).toContainText("faltam");
  });

  test("5.2 quando todas as quantidades chegam, então vai sozinha para Recebido", async ({ page }) => {
    await abrirApp(page);
    const id = await prepararEnviado(page);
    const total = (await requisicao(page, id)).itens.map((i) => i.quantidade);
    const res = await op(page, "opRegistrarRecebimento", id, total, "");
    expect(res.ok, res.erro).toBe(true);
    expect((await requisicao(page, id)).status).toBe("recebido");
  });

  for (const [caso, ajustar, mensagem] of [
    ["negativa", (q) => { q[0] = -1; }, "inválida"],
    ["maior que a pedida", (q, itens) => { q[0] = itens[0].quantidade + 1; }, "maior que o pedido"],
    ["zero em todos os itens", () => {}, "pelo menos um item"],
  ]) {
    test(`5.3/5.4 quando a quantidade é ${caso}, então vejo o erro e nada muda`, async ({ page }) => {
      await abrirApp(page);
      const id = await prepararEnviado(page);
      const antes = await requisicao(page, id);
      const q = antes.itens.map(() => 0);
      ajustar(q, antes.itens);
      const res = await op(page, "opRegistrarRecebimento", id, q, "");
      expect(res.ok).toBe(false);
      expect(res.erro).toContain(mensagem);
      const depois = await requisicao(page, id);
      expect(depois.status).toBe("enviado");
      expect(depois.historico.length).toBe(antes.historico.length);
    });
  }

  test("5.4b quando as quantidades não mudaram desde o último registro, então vejo o erro e nada muda", async ({ page }) => {
    await abrirApp(page);
    const id = await prepararEnviado(page);
    const q = (await requisicao(page, id)).itens.map((_, n) => (n === 0 ? 1 : 0));
    expect((await op(page, "opRegistrarRecebimento", id, q, "")).ok).toBe(true);
    const res = await op(page, "opRegistrarRecebimento", id, q, "");
    expect(res.ok).toBe(false);
    expect(res.erro).toContain("Nenhuma quantidade mudou");
  });

  for (const status of ["recebido_parcial", "recebido", "nao_recebido"]) {
    test(`5.5 quando não sou o solicitante nem gestor, então não consigo marcar "${status}"`, async ({ page }) => {
      await abrirApp(page);
      const id = await prepararEnviado(page);
      const r = await requisicao(page, id);
      await comoUsuario(page, "Pessoa Sem Permissão", false);
      const res = status === "recebido_parcial"
        ? await op(page, "opRegistrarRecebimento", id, r.itens.map(() => 1), "")
        : await op(page, "opMudarStatus", id, status);
      expect(res.ok).toBe(false);
      expect(res.erro).toContain("quem pediu");
      expect((await requisicao(page, id)).status).toBe("enviado");
    });
  }

  test("5.5b quando sou o solicitante (sem ser gestor), então consigo marcar Recebido", async ({ page }) => {
    await abrirApp(page);
    const id = await prepararEnviado(page);
    await comoUsuario(page, (await requisicao(page, id)).solicitante, false);
    const res = await op(page, "opMudarStatus", id, "recebido");
    expect(res.ok, res.erro).toBe(true);
  });

  test("5.6 quando duas pessoas registram recebimento ao mesmo tempo, então só um registro vale", async ({ page }) => {
    await abrirApp(page);
    const id = await prepararEnviado(page);
    const itens = (await requisicao(page, id)).itens;
    const qA = itens.map((_, n) => (n === 0 ? 1 : 0));
    const qB = itens.map((_, n) => (n === 0 ? 2 : 0));
    const x = await aoMesmoTempo(page, id, ["opRegistrarRecebimento", qA, ""], ["opRegistrarRecebimento", qB, ""]);
    expect(x.a.ok).toBe(true);
    expect(x.b.ok).toBe(false);
    expect(x.historicoNovo).toBe(1);
    expect((await requisicao(page, id)).itens[0].recebido).toBe(1);
  });

  test("5.7 quando marco Recebido no instante em que o prazo vence, então fica Recebido e sem notificação", async ({ page }) => {
    await abrirApp(page);
    const id = await prepararEnviado(page);
    await page.evaluate((id) => { obterRequisicao(id).dataPrevistaEntrega = new Date(Date.now() - 86400000); }, id);
    const x = await aoMesmoTempo(page, id, ["opMudarStatus", "recebido"], ["aplicarPrazoVencido"]);
    expect(x.a.ok).toBe(true);
    expect(x.b.ok).toBe(false);
    expect(x.notificacoesNovas).toBe(0);
    expect((await requisicao(page, id)).status).toBe("recebido");
  });
});
