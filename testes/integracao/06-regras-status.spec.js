const { test, expect, abrirApp, requisicao, idEm, op, aoMesmoTempo, prepararEnviado } = require("./ajuda");

test.describe("6. Regras de status", () => {
  test("6.1 quando tento pular etapas (Pendente → Recebido), então sou recusado com os destinos permitidos", async ({ page }) => {
    await abrirApp(page);
    const id = await idEm(page, "pendente");
    const res = await op(page, "opMudarStatus", id, "recebido");
    expect(res.ok).toBe(false);
    expect(res.erro).toContain("Daqui ela pode ir para");
    expect((await requisicao(page, id)).status).toBe("pendente");
  });

  test("6.1b quando arrasto um card para uma etapa proibida no Kanban, então nada muda e aparece o aviso", async ({ page }) => {
    await abrirApp(page);
    const id = await idEm(page, "pendente");
    await page.evaluate((id) => { definirVisaoLista("kanban"); tentarMudarStatus(id, "recebido", false); }, id);
    await expect(page.locator("#avisoToast")).toContainText("Não é possível passar");
    expect((await requisicao(page, id)).status).toBe("pendente");
  });

  test("6.2 quando a requisição está Recebida, então nenhum status pode ser alterado", async ({ page }) => {
    await abrirApp(page);
    const id = await idEm(page, "recebido");
    for (const [nome, ...args] of [["opMudarStatus", "nao_recebido"], ["opCancelar", "motivo"], ["opReabrir", "motivo"], ["opAssumirCompra", "Ana"]]) {
      const res = await op(page, nome, id, ...args);
      expect(res.ok, `${nome} não deveria gravar em Recebido`).toBe(false);
    }
    await page.evaluate((id) => abrirDrawer(id), id);
    await expect(page.locator("#reqStatusSelect")).toBeDisabled();
  });

  test("6.3 quando cancelo ou reabro sem motivo, então vejo o erro e nada muda", async ({ page }) => {
    await abrirApp(page);
    const id = await idEm(page, "pendente");
    await page.evaluate((id) => abrirDrawer(id), id);
    await page.click("#reqStatusCancelar");
    await page.click("#motivoCancelConfirmar");
    await expect(page.locator("#motivoCancelErro")).toContainText("motivo");
    expect((await requisicao(page, id)).status).toBe("pendente");

    const cancelada = await idEm(page, "cancelado");
    const res = await op(page, "opReabrir", cancelada, "");
    expect(res.ok).toBe(false);
    expect((await requisicao(page, cancelada)).status).toBe("cancelado");
  });

  test("6.4 quando duas pessoas reabrem ao mesmo tempo, então só uma reabertura é registrada", async ({ page }) => {
    await abrirApp(page);
    const id = await idEm(page, "cancelado");
    const x = await aoMesmoTempo(page, id, ["opReabrir", "voltou a valer"], ["opReabrir", "projeto retomado"]);
    expect(x.a.ok).toBe(true);
    expect(x.b.ok).toBe(false);
    expect(x.historicoNovo).toBe(1);
  });

  test("6.5 quando o prazo vence com várias abas abertas, então há uma mudança, uma linha no histórico e uma notificação", async ({ page }) => {
    await abrirApp(page);
    const id = await prepararEnviado(page);
    await page.evaluate((id) => { obterRequisicao(id).dataPrevistaEntrega = new Date(Date.now() - 86400000); }, id);
    const x = await aoMesmoTempo(page, id, ["aplicarPrazoVencido"], ["aplicarPrazoVencido"]);
    expect(x.a.ok).toBe(true);
    expect(x.b.ok).toBe(false);
    expect(x.historicoNovo).toBe(1);
    expect(x.notificacoesNovas).toBe(1);
    expect((await requisicao(page, id)).status).toBe("nao_recebido");
  });
});
