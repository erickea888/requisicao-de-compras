// Teste E2E de fumaça (aprovado pelo Erick em 05/11/2026): o caminho inteiro só com cliques na tela,
// do jeito que as pessoas usam. Quem pede cria; o comprador assume e confirma o envio; quem pediu marca Recebido.
const { test, expect, abrirApp, comoUsuario, diaRelativo, preencherNovaRequisicao } = require("./ajuda");

const SOLICITANTE = "Rita Obras";
const COMPRADOR = "Ana Compras";

// Outra pessoa abre a requisição: fecha o detalhe que estava aberto e clica na linha da tabela.
async function abrirPelaTabela(page, id) {
  if (await page.locator("#reqDrawer.open").count()) await page.click("#reqDrawerClose");
  await page.locator("#tabelaRequisicoes tr", { hasText: id }).first().click();
  await expect(page.locator("#reqDrawer").first()).toBeVisible();
}
async function mudarStatusPeloDrawer(page, status) {
  await page.selectOption("#reqStatusSelect", status);
  await page.click("#reqStatusSalvar");
}

test("fumaça: criar requisição, assumir, enviar e receber, só com cliques", async ({ page }) => {
  await abrirApp(page, { usuario: SOLICITANTE, gestor: false });

  // 1. Quem pede cria a requisição.
  await preencherNovaRequisicao(page, { itens: [{ descricao: "Cimento CP-II 50 kg", quantidade: 20 }], observacao: "Fumaça E2E" });
  await page.click("#modalCriar");
  // O app pergunta se a requisição vira tarefa recorrente: nesta compra, não.
  await page.click("#perguntaTarefaNao");
  const id = await page.evaluate(() => estadoParaTestes().requisicoes.find((r) => r.observacao === "Fumaça E2E").id);
  await expect(page.locator("#tabelaRequisicoes tr", { hasText: id })).toContainText("Pendente");

  // 2. O comprador assume em nome dele.
  await comoUsuario(page, COMPRADOR);

  await abrirPelaTabela(page, id);
  await mudarStatusPeloDrawer(page, "elaboracao");
  await expect(page.locator("#compradorInput")).toHaveValue(COMPRADOR);
  await page.click("#compradorConfirmar");
  await expect(page.locator("#reqDrawerCompradorNome")).toHaveText(COMPRADOR);

  // 3. O comprador confirma o envio com a data de entrega.
  await mudarStatusPeloDrawer(page, "enviado");
  await page.fill("#dataEntregaInput", diaRelativo(7));
  await page.click("#dataEntregaConfirmar");
  await expect(page.locator("#reqStatusSelect")).toHaveValue("enviado");

  // 4. Quem pediu marca Recebido.
  await comoUsuario(page, SOLICITANTE);

  await abrirPelaTabela(page, id);
  await mudarStatusPeloDrawer(page, "recebido");
  await expect(page.locator("#reqStatusSelect")).toHaveValue("recebido");
  await expect(page.locator("#tabelaRequisicoes tr", { hasText: id })).toContainText("Recebido");
});
