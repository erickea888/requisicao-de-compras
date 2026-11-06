// Rodada de lacunas (05/11/2026). Frases confirmadas pelo Erick, e regras novas que ele definiu:
// - Comprador: assumir uma requisição sem comprador (ou confirmar o envio direto de Pendente) só pode
//   o solicitante, o gestor geral ou o próprio comprador que vai assumir. Depois, trocar o comprador
//   ou confirmar o envio só pode o comprador atual ou o gestor.
// - Excluir requisição: em Pendente, o solicitante, o gestor e os selecionados; nos outros status, só o gestor.
// - Excluir uma requisição gerada por tarefa (Pendente): exclui e a data volta para Pendente na tarefa.
// - Reabrir uma requisição cancelada pelo Desfazer da tarefa: recusado (gera de novo pela tarefa).
const { test, expect, abrirApp, comoUsuario, requisicao, idEm, op, aoMesmoTempo, contarRequisicoes, diaRelativo, prepararEnviado } = require("./ajuda");

const INTRUSO = "Pessoa Sem Permissão";
const GESTOR = "Gestor Teste";
const SELECIONADO = "Camila Duarte";
const DONO = "Ana Tarefas";
const COMPRADOR = "Ana Compras";
const MODELO = { solicitante: DONO, origem: "Obras", projetoNumero: "PRJ-2196", projetoNome: "Shopping Rio Claro", prioridade: "alta",
  observacao: "Andaimes do mês", faturamentoDireto: false, anexos: [], itens: [{ descricao: "Andaime tubular", modelo: "", quantidade: 40 }] };

// ---------- preparação de cenário ----------
function criarTarefa(page, { dias = -1, hora = 9, vezes = 1, unidade = "mes", termino = "automatica", diasFinal = null, lembreteMin = 30 } = {}) {
  return page.evaluate(([dias, hora, vezes, unidade, termino, diasFinal, lembreteMin, modelo]) => {
    const h = new Date();
    const dataInicial = new Date(h.getFullYear(), h.getMonth(), h.getDate() + dias, hora, 0);
    const dataFinal = diasFinal === null ? null : new Date(h.getFullYear(), h.getMonth(), h.getDate() + diasFinal);
    const res = opCriarTarefa(novaChaveEnvio(), { descricao: "Locação de andaimes", dataInicial, vezes, unidade, termino, dataFinal, lembreteMin, modelo });
    if (!res.ok) throw new Error(res.erro);
    return res.t.id;
  }, [dias, hora, vezes, unidade, termino, diasFinal, lembreteMin, MODELO]);
}
function tarefa(page, id) {
  return page.evaluate((id) => { const t = obterTarefa(id); return t ? JSON.parse(JSON.stringify(t)) : null; }, id);
}
function primeiraPendente(page, id) {
  return page.evaluate((id) => proximaPendente(obterTarefa(id)).getTime(), id);
}
// Chama uma operação da tarefa com a versão que está na tela agora.
function opTarefa(page, nome, id, ...args) {
  return page.evaluate(([nome, id, args]) => {
    const t = obterTarefa(id);
    const res = window[nome](id, t ? t.versao : null, ...args);
    return { ok: res.ok, erro: res.erro || "", requisicaoId: res.r ? res.r.id : null };
  }, [nome, id, args]);
}
function dadosTarefa(page, id, mudancas) {
  return page.evaluate(([id, m]) => {
    const t = obterTarefa(id);
    return { descricao: t.descricao, dataInicial: t.dataInicial, vezes: t.vezes, unidade: t.unidade, termino: t.termino,
      dataFinal: t.dataFinal, lembreteMin: t.lembreteMin, modelo: t.modelo, ajusteFimSemana: t.ajusteFimSemana, ...m };
  }, [id, mudancas]);
}
// Requisição Pendente de outra pessoa, assumida pelo gestor com COMPRADOR como comprador.
async function prepararElaboracao(page) {
  const id = await idEm(page, "pendente", { exceto: COMPRADOR });
  const res = await op(page, "opAssumirCompra", id, COMPRADOR);
  expect(res.ok, res.erro).toBe(true);
  return id;
}
async function definirSelecionados(page, lista) {
  const res = await page.evaluate((lista) => opDefinirUsuariosAutorizados(lista), lista);
  expect(res.ok, res.erro).toBe(true);
}
// Gera a requisição da primeira data pendente e desfaz (como dono da tarefa).
async function gerarEDesfazer(page) {
  const tid = await criarTarefa(page);
  const data = await primeiraPendente(page, tid);
  const g = await opTarefa(page, "opGerarRequisicaoDaTarefa", tid, data);
  expect(g.ok, g.erro).toBe(true);
  const d = await opTarefa(page, "opDesfazerGeracao", tid, data);
  expect(d.ok, d.erro).toBe(true);
  return { tid, data, rid: g.requisicaoId };
}

test.describe("11. Acesso indevido (rodada de lacunas)", () => {
  test("11.1 quando tento retomar uma data pulada da tarefa de outra pessoa, então é recusado e a data continua pulada", async ({ page }) => {
    await abrirApp(page, { usuario: DONO, gestor: false });
    const tid = await criarTarefa(page);
    const data = await primeiraPendente(page, tid);
    expect((await opTarefa(page, "opPularData", tid, data, "sobrou estoque")).ok).toBe(true);
    await comoUsuario(page, INTRUSO);
    const res = await opTarefa(page, "opRetomarData", tid, data);
    expect(res.ok, "retomar a tarefa de outra pessoa deveria ser recusado").toBe(false);
    expect((await tarefa(page, tid)).puladas.length).toBe(1);
  });

  test("11.2 quando sou gestor, então consigo editar, pular, retomar e excluir a tarefa de outra pessoa", async ({ page }) => {
    await abrirApp(page, { usuario: DONO, gestor: false });
    const tid = await criarTarefa(page);
    const data = await primeiraPendente(page, tid);
    await comoUsuario(page, GESTOR, true);
    const editar = await page.evaluate(([id, d]) => { const t = obterTarefa(id); return opEditarTarefa(id, t.versao, d); },
      [tid, await dadosTarefa(page, tid, { descricao: "Editada pelo gestor" })]);
    expect(editar.ok, editar.erro).toBe(true);
    expect((await tarefa(page, tid)).descricao).toBe("Editada pelo gestor");
    const pular = await opTarefa(page, "opPularData", tid, data, "obra parada");
    expect(pular.ok, pular.erro).toBe(true);
    const retomar = await opTarefa(page, "opRetomarData", tid, data);
    expect(retomar.ok, retomar.erro).toBe(true);
    const excluir = await opTarefa(page, "opExcluirTarefa", tid);
    expect(excluir.ok, excluir.erro).toBe(true);
    expect(await tarefa(page, tid)).toBeNull();
  });

  test("11.3 quando A tenta marcar Não recebido numa requisição de B, então é recusado", async ({ page }) => {
    await abrirApp(page);
    const id = await prepararEnviado(page);
    await comoUsuario(page, INTRUSO);
    const res = await op(page, "opMudarStatus", id, "nao_recebido");
    expect(res.ok).toBe(false);
    expect((await requisicao(page, id)).status).toBe("enviado");
  });
});

test.describe("12. Repetição ao mesmo tempo (rodada de lacunas)", () => {
  test("12.1 quando duas pessoas excluem a mesma requisição ao mesmo tempo, então ela sai uma vez só e a segunda vê que não existe mais", async ({ page }) => {
    await abrirApp(page);
    const id = await idEm(page, "pendente");
    const antes = await contarRequisicoes(page);
    const x = await page.evaluate((id) => {
      const versao = obterRequisicao(id).versao;
      return Promise.all([1, 2].map(async () => { const r = opExcluirRequisicao(id, versao); return { ok: r.ok, erro: r.erro || "" }; }));
    }, id);
    expect(x.filter((r) => r.ok).length).toBe(1);
    expect(x.find((r) => !r.ok).erro).toContain("não existe mais");
    expect(await contarRequisicoes(page)).toBe(antes - 1);
  });

  test("12.2 quando duas pessoas editam a mesma tarefa ao mesmo tempo, então só uma edição vale e a outra é avisada", async ({ page }) => {
    await abrirApp(page, { usuario: DONO, gestor: false });
    const tid = await criarTarefa(page);
    const a = await dadosTarefa(page, tid, { descricao: "Edição A" });
    const b = await dadosTarefa(page, tid, { descricao: "Edição B" });
    const x = await page.evaluate(([id, a, b]) => {
      const versao = obterTarefa(id).versao;
      return Promise.all([a, b].map(async (d) => { const r = opEditarTarefa(id, versao, d); return { ok: r.ok, erro: r.erro || "" }; }));
    }, [tid, a, b]);
    expect(x.filter((r) => r.ok).length).toBe(1);
    expect(x.find((r) => !r.ok).erro).toContain("alterada");
    const t = await tarefa(page, tid);
    expect(t.descricao).toBe("Edição A");
    expect(t.versao).toBe(2);
  });

  test("12.3 quando uma pessoa exclui a tarefa enquanto outra gera a requisição dela, então só uma das duas vale", async ({ page }) => {
    await abrirApp(page, { usuario: DONO, gestor: false });
    const tid = await criarTarefa(page);
    const data = await primeiraPendente(page, tid);
    const antes = await contarRequisicoes(page);
    const x = await page.evaluate(([id, data]) => {
      const versao = obterTarefa(id).versao;
      return Promise.all([
        (async () => { const r = opExcluirTarefa(id, versao); return { ok: r.ok, erro: r.erro || "" }; })(),
        (async () => { const r = opGerarRequisicaoDaTarefa(id, versao, data); return { ok: r.ok, erro: r.erro || "" }; })(),
      ]);
    }, [tid, data]);
    const [excluir, gerar] = x;
    expect(excluir.ok !== gerar.ok, "só uma das duas ações pode valer").toBe(true);
    if (excluir.ok) {
      expect(await tarefa(page, tid)).toBeNull();
      expect(await contarRequisicoes(page)).toBe(antes);
    } else {
      expect((await tarefa(page, tid)).realizacoes.length).toBe(1);
      expect(await contarRequisicoes(page)).toBe(antes + 1);
    }
  });

  test("12.4 quando duas pessoas retomam a mesma data ao mesmo tempo, então só uma retomada vale", async ({ page }) => {
    await abrirApp(page, { usuario: DONO, gestor: false });
    const tid = await criarTarefa(page);
    const data = await primeiraPendente(page, tid);
    expect((await opTarefa(page, "opPularData", tid, data, "sobrou estoque")).ok).toBe(true);
    const x = await page.evaluate(([id, data]) => {
      const versao = obterTarefa(id).versao;
      return Promise.all([1, 2].map(async () => { const r = opRetomarData(id, versao, data); return { ok: r.ok, erro: r.erro || "" }; }));
    }, [tid, data]);
    expect(x.filter((r) => r.ok).length).toBe(1);
    const t = await tarefa(page, tid);
    expect(t.puladas.length).toBe(0);
    expect(t.versao).toBe(3);
  });

  test("12.5 quando duas pessoas alteram o comprador ao mesmo tempo, então só uma troca é gravada", async ({ page }) => {
    await abrirApp(page);
    const id = await prepararElaboracao(page);
    const x = await aoMesmoTempo(page, id, ["opAlterarComprador", "Bruno"], ["opAlterarComprador", "Carla"]);
    expect(x.a.ok).toBe(true);
    expect(x.b.ok).toBe(false);
    expect(x.b.erro).toContain("alterada por outra ação");
    expect(x.historicoNovo).toBe(1);
    expect((await requisicao(page, id)).compradorResponsavel).toBe("Bruno");
  });
});

test.describe("13. Limites (rodada de lacunas)", () => {
  test("13.1 quando informo 0 vezes, número negativo ou mais que o máximo do período, então vejo o erro e nada é criado", async ({ page }) => {
    await abrirApp(page, { usuario: DONO, gestor: false });
    const r = await page.evaluate((modelo) => {
      const antes = estadoParaTestes().tarefas.length;
      const base = { descricao: "Limite", dataInicial: new Date(), unidade: "semana", termino: "automatica", dataFinal: null, lembreteMin: 0, modelo };
      const erros = [0, -1, MAX_VEZES.semana + 1, 1.5].map((vezes) => opCriarTarefa(novaChaveEnvio(), { ...base, vezes }));
      return { oks: erros.map((e) => e.ok), mensagens: erros.map((e) => e.erro || ""), criadas: estadoParaTestes().tarefas.length - antes };
    }, MODELO);
    expect(r.oks).toEqual([false, false, false, false]);
    r.mensagens.forEach((m) => expect(m).toContain("quantas vezes"));
    expect(r.criadas).toBe(0);
  });

  test("13.2 quando o lembrete vem com um valor fora da lista, então é recusado", async ({ page }) => {
    await abrirApp(page, { usuario: DONO, gestor: false });
    const r = await page.evaluate((modelo) => {
      const antes = estadoParaTestes().tarefas.length;
      const res = opCriarTarefa(novaChaveEnvio(), { descricao: "Lembrete estranho", dataInicial: new Date(), vezes: 1, unidade: "mes",
        termino: "automatica", dataFinal: null, lembreteMin: -5, modelo });
      return { ok: res.ok, erro: res.erro || "", criadas: estadoParaTestes().tarefas.length - antes };
    }, MODELO);
    expect(r.ok).toBe(false);
    expect(r.erro).toContain("lembrado");
    expect(r.criadas).toBe(0);
  });

  test("13.3 quando a data final é igual à data inicial, então a tarefa tem uma data só", async ({ page }) => {
    await abrirApp(page, { usuario: DONO, gestor: false });
    const tid = await criarTarefa(page, { dias: 3, vezes: 7, unidade: "semana", termino: "data", diasFinal: 3 });
    const quantas = await page.evaluate((id) => { let n = 0; for (const _ of gerarDatasTarefa(obterTarefa(id))) { if (++n > 20) break; } return n; }, tid);
    expect(quantas).toBe(1);
  });

  test("13.4 quando reduzo a repetição de uma tarefa com data realizada, então a requisição gerada continua no histórico", async ({ page }) => {
    await abrirApp(page, { usuario: DONO, gestor: false });
    const tid = await criarTarefa(page, { dias: -1, vezes: 2, unidade: "semana" });
    const data = await primeiraPendente(page, tid);
    const g = await opTarefa(page, "opGerarRequisicaoDaTarefa", tid, data);
    expect(g.ok, g.erro).toBe(true);
    const editar = await page.evaluate(([id, d]) => { const t = obterTarefa(id); return opEditarTarefa(id, t.versao, d); },
      [tid, await dadosTarefa(page, tid, { vezes: 1, unidade: "mes" })]);
    expect(editar.ok, editar.erro).toBe(true);
    const t = await tarefa(page, tid);
    expect(t.realizacoes.map((x) => x.requisicaoId)).toEqual([g.requisicaoId]);
    expect(await requisicao(page, g.requisicaoId)).not.toBeNull();
    await page.evaluate((id) => abrirHistoricoTarefa(id), tid);
    await expect(page.locator("#tarefaHistFeitas")).toContainText(g.requisicaoId);
  });

  test("13.5 quando tento alterar o comprador de uma requisição Pendente, Recebida ou Cancelada, então é recusado", async ({ page }) => {
    await abrirApp(page);
    for (const status of ["pendente", "recebido", "cancelado"]) {
      const id = await idEm(page, status);
      const antes = (await requisicao(page, id)).compradorResponsavel || "";
      const res = await op(page, "opAlterarComprador", id, "Outro Comprador");
      expect(res.ok, `alterar comprador em ${status} deveria ser recusado`).toBe(false);
      expect((await requisicao(page, id)).compradorResponsavel || "").toBe(antes);
    }
  });
});

test.describe("14. Comprador: quem assume, troca e confirma o envio (regra do Erick, 05/11/2026)", () => {
  test("14.1 quando sou o comprador atual e troco para outro comprador, então a troca é gravada", async ({ page }) => {
    await abrirApp(page);
    const id = await prepararElaboracao(page);
    await comoUsuario(page, COMPRADOR);
    const res = await op(page, "opAlterarComprador", id, "Bruno Compras");
    expect(res.ok, res.erro).toBe(true);
    expect((await requisicao(page, id)).compradorResponsavel).toBe("Bruno Compras");
  });

  test("14.2 quando sou o gestor, então consigo trocar o comprador", async ({ page }) => {
    await abrirApp(page);
    const id = await prepararElaboracao(page);
    const res = await op(page, "opAlterarComprador", id, "Bruno Compras");
    expect(res.ok, res.erro).toBe(true);
  });

  test("14.3 quando sou o solicitante, mas não o comprador, e tento trocar o comprador, então é recusado", async ({ page }) => {
    await abrirApp(page);
    const id = await prepararElaboracao(page);
    await comoUsuario(page, (await requisicao(page, id)).solicitante);
    const res = await op(page, "opAlterarComprador", id, "Bruno Compras");
    expect(res.ok, "o solicitante não troca o comprador").toBe(false);
    expect((await requisicao(page, id)).compradorResponsavel).toBe(COMPRADOR);
  });

  test("14.4 quando não sou comprador nem gestor, então a troca é recusada e o botão Alterar não aparece", async ({ page }) => {
    await abrirApp(page);
    const id = await prepararElaboracao(page);
    await definirSelecionados(page, [SELECIONADO]);
    for (const quem of [INTRUSO, SELECIONADO]) {
      await comoUsuario(page, quem);
      const res = await op(page, "opAlterarComprador", id, quem);
      expect(res.ok, `${quem} não deveria trocar o comprador`).toBe(false);
      expect((await requisicao(page, id)).compradorResponsavel).toBe(COMPRADOR);
      await page.evaluate((id) => abrirDrawer(id), id);
      await expect(page.locator("#btnAlterarComprador")).toBeHidden();
    }
  });

  test("14.5 quando assumo uma Pendente sem comprador em meu nome, então fico como comprador", async ({ page }) => {
    await abrirApp(page);
    const id = await idEm(page, "pendente", { exceto: COMPRADOR });
    await comoUsuario(page, COMPRADOR);
    const res = await op(page, "opAssumirCompra", id, COMPRADOR);
    expect(res.ok, res.erro).toBe(true);
    expect((await requisicao(page, id)).compradorResponsavel).toBe(COMPRADOR);
  });

  test("14.6 quando sou o solicitante, então consigo definir o comprador da minha requisição", async ({ page }) => {
    await abrirApp(page);
    const id = await idEm(page, "pendente", { exceto: COMPRADOR });
    await comoUsuario(page, (await requisicao(page, id)).solicitante);
    const res = await op(page, "opAssumirCompra", id, COMPRADOR);
    expect(res.ok, res.erro).toBe(true);
  });

  test("14.7 quando não sou solicitante nem gestor e coloco outra pessoa como comprador, então é recusado", async ({ page }) => {
    await abrirApp(page);
    const id = await idEm(page, "pendente", { exceto: INTRUSO });
    await comoUsuario(page, INTRUSO);
    const res = await op(page, "opAssumirCompra", id, COMPRADOR);
    expect(res.ok, "terceiro não define o comprador de outra pessoa").toBe(false);
    const r = await requisicao(page, id);
    expect(r.status).toBe("pendente");
    expect(r.compradorResponsavel || "").toBe("");
  });

  test("14.8 quando a requisição já tem comprador e quem confirma o envio não é ele nem o gestor, então é recusado", async ({ page }) => {
    await abrirApp(page);
    const id = await prepararElaboracao(page);
    for (const quem of [INTRUSO, (await requisicao(page, id)).solicitante]) {
      await comoUsuario(page, quem);
      const res = await op(page, "opConfirmarEnvio", id, diaRelativo(10), "");
      expect(res.ok, `${quem} não deveria confirmar o envio`).toBe(false);
      expect((await requisicao(page, id)).status).toBe("elaboracao");
    }
  });

  test("14.9 quando sou o comprador atual, então consigo confirmar o envio", async ({ page }) => {
    await abrirApp(page);
    const id = await prepararElaboracao(page);
    await comoUsuario(page, COMPRADOR);
    const res = await op(page, "opConfirmarEnvio", id, diaRelativo(10), "");
    expect(res.ok, res.erro).toBe(true);
    expect((await requisicao(page, id)).status).toBe("enviado");
  });

  test("14.10 quando confirmo o envio direto de Pendente, então só vale em meu nome, como solicitante ou como gestor", async ({ page }) => {
    await abrirApp(page);
    const id = await idEm(page, "pendente", { exceto: INTRUSO });
    await comoUsuario(page, INTRUSO);
    const outro = await op(page, "opConfirmarEnvio", id, diaRelativo(10), COMPRADOR);
    expect(outro.ok, "terceiro não define o comprador ao confirmar o envio").toBe(false);
    expect((await requisicao(page, id)).status).toBe("pendente");
    const proprio = await op(page, "opConfirmarEnvio", id, diaRelativo(10), INTRUSO);
    expect(proprio.ok, proprio.erro).toBe(true);
    expect((await requisicao(page, id)).compradorResponsavel).toBe(INTRUSO);
  });
});

test.describe("15. Excluir requisição (regra do Erick, 05/11/2026)", () => {
  test("15.1 quando a requisição saiu de Pendente, então solicitante e selecionado não excluem e o Excluir não aparece no menu", async ({ page }) => {
    await abrirApp(page);
    const id = await prepararElaboracao(page);
    await definirSelecionados(page, [SELECIONADO]);
    for (const quem of [(await requisicao(page, id)).solicitante, SELECIONADO]) {
      await comoUsuario(page, quem);
      const res = await op(page, "opExcluirRequisicao", id);
      expect(res.ok, `${quem} não deveria excluir fora de Pendente`).toBe(false);
      expect(await requisicao(page, id)).not.toBeNull();
      await page.evaluate(() => renderTabela());
      await page.locator(`.card-menu-btn[data-id="${id}"]`).first().click();
      await expect(page.locator("#cardMenuExcluir")).toBeHidden();
      await page.keyboard.press("Escape");
      await page.mouse.click(5, 5);
    }
  });

  test("15.2 quando sou gestor, então excluo requisição em qualquer status, até Recebida", async ({ page }) => {
    await abrirApp(page);
    for (const status of ["elaboracao", "recebido", "cancelado"]) {
      const id = await idEm(page, status);
      const res = await op(page, "opExcluirRequisicao", id);
      expect(res.ok, res.erro).toBe(true);
      expect(await requisicao(page, id)).toBeNull();
    }
  });

  test("15.3 quando excluo uma requisição Pendente gerada por tarefa, então ela sai e a data volta para Pendente na tarefa", async ({ page }) => {
    await abrirApp(page, { usuario: DONO, gestor: false });
    const tid = await criarTarefa(page);
    const data = await primeiraPendente(page, tid);
    const g = await opTarefa(page, "opGerarRequisicaoDaTarefa", tid, data);
    expect(g.ok, g.erro).toBe(true);
    const res = await op(page, "opExcluirRequisicao", g.requisicaoId);
    expect(res.ok, res.erro).toBe(true);
    expect(await requisicao(page, g.requisicaoId)).toBeNull();
    const t = await tarefa(page, tid);
    expect(t.realizacoes.length, "a data não pode continuar Realizada apontando para requisição excluída").toBe(0);
    expect(await primeiraPendente(page, tid)).toBe(data);
    const deNovo = await opTarefa(page, "opGerarRequisicaoDaTarefa", tid, data);
    expect(deNovo.ok, deNovo.erro).toBe(true);
    expect(deNovo.requisicaoId).not.toBe(g.requisicaoId);
  });
});

test.describe("16. Reabrir requisição desfeita pela tarefa (regra do Erick, 05/11/2026)", () => {
  test("16.1 quando a requisição foi cancelada pelo Desfazer, então reabrir é recusado, inclusive para o gestor", async ({ page }) => {
    await abrirApp(page, { usuario: DONO, gestor: false });
    const { rid } = await gerarEDesfazer(page);
    for (const [quem, gestor] of [[DONO, false], [GESTOR, true]]) {
      await comoUsuario(page, quem, gestor);
      const res = await op(page, "opReabrir", rid, "quero reabrir");
      expect(res.ok, `${quem} não deveria reabrir uma geração desfeita`).toBe(false);
      expect(res.erro).toContain("tarefa");
      expect((await requisicao(page, rid)).status).toBe("cancelado");
    }
  });

  test("16.2 quando escolho Pendente na lista de status de uma requisição desfeita, então aparece o aviso e nada muda", async ({ page }) => {
    await abrirApp(page, { usuario: DONO, gestor: false });
    const { rid, tid, data } = await gerarEDesfazer(page);
    await page.evaluate((id) => tentarMudarStatus(id, "pendente", false), rid);
    await expect(page.locator("#avisoToast")).toContainText("tarefa");
    await expect(page.locator("#motivoCancelBackdrop")).not.toHaveClass(/open/);
    expect((await requisicao(page, rid)).status).toBe("cancelado");
    expect(await primeiraPendente(page, tid)).toBe(data);
  });
});
