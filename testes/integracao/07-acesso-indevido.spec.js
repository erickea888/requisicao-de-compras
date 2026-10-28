// Regra definida pelo Erick (7.3 a 7.5): depois de criada, uma requisição só pode ser editada,
// cancelada ou excluída pelo próprio solicitante, pelo gestor geral ou por usuários que o gestor
// selecionou numa lista geral. Quem não está nessa lista não tem permissão.
const { test, expect, abrirApp, comoUsuario, requisicao, idEm, op, contarRequisicoes, prepararEnviado } = require("./ajuda");

const INTRUSO = "Pessoa Sem Permissão";
const SELECIONADO = "Camila Duarte";

function dadosEditados(r) {
  return { solicitante: r.solicitante, origem: r.origem, projetoNumero: r.projetoNumero, projetoNome: r.projetoNome,
    prioridade: r.prioridade === "urgente" ? "baixa" : "urgente", observacao: r.observacao,
    faturamentoDireto: r.faturamentoDireto, anexos: r.anexos, itens: r.itens };
}
// O gestor define a lista geral de usuários selecionados (funcionalidade combinada nos itens 7.3 a 7.5).
async function definirSelecionados(page, lista) {
  return page.evaluate((lista) => {
    if (typeof window.opDefinirUsuariosAutorizados !== "function") {
      throw new Error("ainda não existe a lista de usuários selecionados pelo gestor (opDefinirUsuariosAutorizados)");
    }
    const res = opDefinirUsuariosAutorizados(lista);
    return { ok: res.ok, erro: res.erro || "" };
  }, lista);
}
async function excluirPelaTela(page, id) {
  await page.evaluate((id) => abrirConfirmacaoExcluir(id), id);
  await page.click("#excluirConfirmar");
}

test.describe("7. Acesso indevido (dados de outra pessoa)", () => {
  test("7.1 quando o usuário A abre o sino, então não vê as notificações do usuário B", async ({ page }) => {
    await abrirApp(page);
    const id = await idEm(page, "pendente");
    await page.evaluate((id) => opComentar(id, novaChaveEnvio(), "Gestor Teste", "Só para @Larissa Monteiro", []), id);
    await comoUsuario(page, "André Salles");
    const doAndre = await page.evaluate(() => notificacoesDoUsuario().map((n) => n.texto));
    expect(doAndre.some((t) => t.includes("Só para"))).toBe(false);
  });

  test("7.2 quando A tenta marcar o recebimento de uma requisição de B, então é recusado", async ({ page }) => {
    await abrirApp(page);
    const id = await prepararEnviado(page);
    await comoUsuario(page, INTRUSO);
    const res = await op(page, "opMudarStatus", id, "recebido");
    expect(res.ok).toBe(false);
    expect((await requisicao(page, id)).status).toBe("enviado");
  });

  test.describe("7.3 editar requisição de outra pessoa", () => {
    test("quando não sou solicitante, gestor nem selecionado, então a edição é recusada", async ({ page }) => {
      await abrirApp(page);
      const id = await idEm(page, "pendente");
      const antes = await requisicao(page, id);
      await comoUsuario(page, INTRUSO);
      const res = await op(page, "opEditarRequisicao", id, dadosEditados(antes));
      expect(res.ok, "edição por quem não tem permissão deveria ser recusada").toBe(false);
      expect((await requisicao(page, id)).prioridade).toBe(antes.prioridade);
    });

    test("quando sou o solicitante, então consigo editar", async ({ page }) => {
      await abrirApp(page);
      const id = await idEm(page, "pendente");
      const antes = await requisicao(page, id);
      await comoUsuario(page, antes.solicitante);
      const res = await op(page, "opEditarRequisicao", id, dadosEditados(antes));
      expect(res.ok, res.erro).toBe(true);
    });

    test("quando sou o gestor geral, então consigo editar", async ({ page }) => {
      await abrirApp(page);
      const id = await idEm(page, "pendente");
      const res = await op(page, "opEditarRequisicao", id, dadosEditados(await requisicao(page, id)));
      expect(res.ok, res.erro).toBe(true);
    });

    test("quando o gestor me selecionou, então consigo editar a requisição de outra pessoa", async ({ page }) => {
      await abrirApp(page);
      expect((await definirSelecionados(page, [SELECIONADO])).ok).toBe(true);
      const id = await idEm(page, "pendente", { exceto: SELECIONADO });
      await comoUsuario(page, SELECIONADO);
      const res = await op(page, "opEditarRequisicao", id, dadosEditados(await requisicao(page, id)));
      expect(res.ok, res.erro).toBe(true);
    });
  });

  test.describe("7.4 cancelar requisição de outra pessoa", () => {
    test("quando não sou solicitante, gestor nem selecionado, então o cancelamento é recusado", async ({ page }) => {
      await abrirApp(page);
      const id = await idEm(page, "pendente");
      await comoUsuario(page, INTRUSO);
      const res = await op(page, "opCancelar", id, "tentativa indevida");
      expect(res.ok, "cancelamento por quem não tem permissão deveria ser recusado").toBe(false);
      expect((await requisicao(page, id)).status).toBe("pendente");
    });

    test("quando sou o solicitante, então consigo cancelar", async ({ page }) => {
      await abrirApp(page);
      const id = await idEm(page, "pendente");
      await comoUsuario(page, (await requisicao(page, id)).solicitante);
      const res = await op(page, "opCancelar", id, "não precisa mais");
      expect(res.ok, res.erro).toBe(true);
    });

    test("quando o gestor me selecionou, então consigo cancelar a requisição de outra pessoa", async ({ page }) => {
      await abrirApp(page);
      expect((await definirSelecionados(page, [SELECIONADO])).ok).toBe(true);
      const id = await idEm(page, "pendente", { exceto: SELECIONADO });
      await comoUsuario(page, SELECIONADO);
      const res = await op(page, "opCancelar", id, "cancelada por usuário selecionado");
      expect(res.ok, res.erro).toBe(true);
    });
  });

  test.describe("7.5 excluir requisição de outra pessoa", () => {
    test("quando não sou solicitante, gestor nem selecionado, então a exclusão é recusada", async ({ page }) => {
      await abrirApp(page);
      const id = await idEm(page, "pendente");
      await comoUsuario(page, INTRUSO);
      await excluirPelaTela(page, id);
      expect(await requisicao(page, id), "exclusão por quem não tem permissão deveria ser recusada").not.toBeNull();
    });

    test("quando sou o solicitante, então consigo excluir", async ({ page }) => {
      await abrirApp(page);
      const id = await idEm(page, "pendente");
      const antes = await contarRequisicoes(page);
      await comoUsuario(page, (await requisicao(page, id)).solicitante);
      await excluirPelaTela(page, id);
      expect(await requisicao(page, id)).toBeNull();
      expect(await contarRequisicoes(page)).toBe(antes - 1);
    });

    test("quando o gestor me selecionou, então consigo excluir a requisição de outra pessoa", async ({ page }) => {
      await abrirApp(page);
      expect((await definirSelecionados(page, [SELECIONADO])).ok).toBe(true);
      const id = await idEm(page, "pendente", { exceto: SELECIONADO });
      await comoUsuario(page, SELECIONADO);
      await excluirPelaTela(page, id);
      expect(await requisicao(page, id)).toBeNull();
    });
  });

  test("7.6 quando quem não é gestor tenta mudar a lista de selecionados, então é recusado", async ({ page }) => {
    await abrirApp(page);
    await comoUsuario(page, INTRUSO);
    const res = await definirSelecionados(page, [INTRUSO]);
    expect(res.ok, "só o gestor geral pode definir a lista").toBe(false);
  });
});
