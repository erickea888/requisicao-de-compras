// Segurança (auditoria de 12/11/2026, correção 3). Regra do Erick: a data de entrega só pode ser alterada pelo
// solicitante, pelo comprador atual ou pelo gestor geral. Qualquer outra pessoa é recusada e nada muda
// (inclusive quem está na lista de usuários selecionados pelo gestor, que vale para editar/cancelar/excluir).
const { test, expect, abrirApp, comoUsuario, requisicao, idEm, op, diaRelativo, prepararEnviado } = require("./ajuda");

const OUTRA_PESSOA = "Pessoa Sem Vinculo";

function dataGravada(r) {
  const d = new Date(r.dataPrevistaEntrega);
  const p = (x) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
// Requisição Enviado com solicitante e comprador diferentes de OUTRA_PESSOA.
async function enviadoComPessoas(page) {
  await abrirApp(page);
  const id = await prepararEnviado(page);
  const r = await requisicao(page, id);
  expect(r.compradorResponsavel, "a requisição de exemplo precisa ter comprador").toBeTruthy();
  expect(r.solicitante).not.toBe(r.compradorResponsavel);
  return r;
}
async function abrirDrawer(page, id) {
  await page.evaluate((id) => abrirDrawer(id), id);
  await expect(page.locator("#reqDrawer.open")).toBeVisible();
}

test.describe("19. Data de entrega: quem pode alterar", () => {
  test("quando o solicitante altera a data, então a nova data é gravada", async ({ page }) => {
    const r = await enviadoComPessoas(page);
    await comoUsuario(page, r.solicitante);
    const res = await op(page, "opAlterarDataEntrega", r.id, diaRelativo(15));
    expect(res.ok, res.erro).toBe(true);
    expect(dataGravada(await requisicao(page, r.id))).toBe(diaRelativo(15));
  });

  test("quando o comprador atual altera a data, então a nova data é gravada", async ({ page }) => {
    const r = await enviadoComPessoas(page);
    await comoUsuario(page, r.compradorResponsavel);
    const res = await op(page, "opAlterarDataEntrega", r.id, diaRelativo(16));
    expect(res.ok, res.erro).toBe(true);
    expect(dataGravada(await requisicao(page, r.id))).toBe(diaRelativo(16));
  });

  test("quando o gestor geral altera a data, então a nova data é gravada", async ({ page }) => {
    const r = await enviadoComPessoas(page);
    await comoUsuario(page, OUTRA_PESSOA, true);
    const res = await op(page, "opAlterarDataEntrega", r.id, diaRelativo(17));
    expect(res.ok, res.erro).toBe(true);
    expect(dataGravada(await requisicao(page, r.id))).toBe(diaRelativo(17));
  });

  test("quando outra pessoa tenta alterar a data, então é recusado e nada muda", async ({ page }) => {
    const r = await enviadoComPessoas(page);
    await comoUsuario(page, OUTRA_PESSOA);
    const res = await op(page, "opAlterarDataEntrega", r.id, diaRelativo(20));
    expect(res.ok).toBe(false);
    expect(res.erro).toContain("data de entrega");
    const depois = await requisicao(page, r.id);
    expect(depois.dataPrevistaEntrega).toBe(r.dataPrevistaEntrega);
    expect(depois.versao).toBe(r.versao);
    expect(depois.historico).toHaveLength(r.historico.length);
  });

  test("quando outra pessoa tenta alterar a data de uma Não recebido, então ela continua Não recebido", async ({ page }) => {
    await abrirApp(page);
    const id = await idEm(page, "nao_recebido");
    const antes = await requisicao(page, id);
    await comoUsuario(page, OUTRA_PESSOA);
    const res = await op(page, "opAlterarDataEntrega", id, diaRelativo(5));
    expect(res.ok).toBe(false);
    const depois = await requisicao(page, id);
    expect(depois.status).toBe("nao_recebido");
    expect(depois.dataPrevistaEntrega).toBe(antes.dataPrevistaEntrega);
  });

  test("quando a pessoa está só na lista de usuários selecionados pelo gestor, então também é recusada", async ({ page }) => {
    const r = await enviadoComPessoas(page);
    const lista = await page.evaluate((nome) => opDefinirUsuariosAutorizados([nome]), OUTRA_PESSOA);
    expect(lista.ok).toBe(true);
    await comoUsuario(page, OUTRA_PESSOA);
    const res = await op(page, "opAlterarDataEntrega", r.id, diaRelativo(21));
    expect(res.ok).toBe(false);
    expect((await requisicao(page, r.id)).dataPrevistaEntrega).toBe(r.dataPrevistaEntrega);
  });

  test("quando outra pessoa abre a requisição, então não vê o botão de editar data; o solicitante vê", async ({ page }) => {
    const r = await enviadoComPessoas(page);
    await comoUsuario(page, OUTRA_PESSOA);
    await abrirDrawer(page, r.id);
    await expect(page.locator("#btnEditarEntrega")).toBeHidden();
    await page.click("#reqDrawerClose");
    await comoUsuario(page, r.solicitante);
    await abrirDrawer(page, r.id);
    await expect(page.locator("#btnEditarEntrega")).toBeVisible();
  });
});
