const { test, expect, abrirApp, comoUsuario, contarRequisicoes, preencherNovaRequisicao, diaRelativo } = require("./ajuda");

// Painel de Tarefas: requisições que se repetem. Regras combinadas com o Erick:
// - "Repetir": N vezes por semana, mês ou ano (2 por ano = duas vezes no ano, com as datas espaçadas por igual);
// - "Termina em": uma data final (último dia da tarefa) ou renovação automática;
// - a tela da tarefa é a da requisição avulsa, com mais campos: a tarefa guarda a requisição completa;
// - um clique em "Gerar requisição" cria a requisição, sem abrir formulário, e aquela data vira Realizada;
// - dentro da tarefa dá para ver as requisições passadas e as próximas datas;
// - o lembrete é X minutos antes da data, no sino de quem criou;
// - ficam na memória, como as requisições (Firebase depois).

const DONO = "Ana Tarefas";
const MODELO = { solicitante: DONO, origem: "Obras", projetoNumero: "PRJ-2196", projetoNome: "Shopping Rio Claro", prioridade: "alta",
  observacao: "Andaimes do mês", faturamentoDireto: false, anexos: [], itens: [{ descricao: "Andaime tubular", modelo: "", quantidade: 40 }] };

// Abre a tela da tarefa e preenche os campos que vêm da requisição.
async function abrirTarefaPreenchida(page) {
  await page.click("#btnTarefas");
  await page.click("#btnIncluirTarefa");
  await page.selectOption("#fOrigem", "Obras");
  await page.fill("#fProjeto", "PRJ-2200");
  await page.fill("#fObs", "Observação da requisição");
}

function tarefas(page) {
  return page.evaluate(() => JSON.parse(JSON.stringify(estadoParaTestes().tarefas)));
}
function tarefa(page, id) {
  return page.evaluate((id) => {
    const t = obterTarefa(id);
    return t ? JSON.parse(JSON.stringify(t)) : null;
  }, id);
}
// Cria uma tarefa direto pela operação (preparação de cenário). dias: a partir de hoje.
function criarTarefa(page, { dias = 1, hora = 9, vezes = 1, unidade = "mes", termino = "automatica", diasFinal = null, lembreteMin = 30, descricao = "Locação de andaimes", modelo = MODELO } = {}) {
  return page.evaluate(([dias, hora, vezes, unidade, termino, diasFinal, lembreteMin, descricao, modelo]) => {
    const h = new Date();
    const dataInicial = new Date(h.getFullYear(), h.getMonth(), h.getDate() + dias, hora, 0);
    const dataFinal = diasFinal === null ? null : new Date(h.getFullYear(), h.getMonth(), h.getDate() + diasFinal);
    const res = opCriarTarefa(novaChaveEnvio(), { descricao, dataInicial, vezes, unidade, termino, dataFinal, lembreteMin, modelo });
    if (!res.ok) throw new Error(res.erro);
    return res.t.id;
  }, [dias, hora, vezes, unidade, termino, diasFinal, lembreteMin, descricao, modelo]);
}
// As primeiras datas de uma repetição, como texto local "AAAA-MM-DD".
function primeirasDatas(page, { vezes, unidade, ano, mes, dia, termino = "automatica", final = null, quantas = 6 }) {
  return page.evaluate(([vezes, unidade, ano, mes, dia, termino, final, quantas]) => {
    const t = { vezes, unidade, termino, dataInicial: new Date(ano, mes - 1, dia, 9, 0),
      dataFinal: final ? new Date(final[0], final[1] - 1, final[2], 23, 59, 59, 999) : null };
    const p = (x) => String(x).padStart(2, "0");
    const lista = [];
    for (const d of gerarDatasTarefa(t)) {
      if (lista.length >= quantas) break;
      lista.push(`${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`);
    }
    return lista;
  }, [vezes, unidade, ano, mes, dia, termino, final, quantas]);
}
// A primeira data pendente de uma tarefa, em milissegundos.
function requisicaoGerada(page, id) {
  return page.evaluate((id) => JSON.parse(JSON.stringify(obterRequisicao(id))), id);
}
function primeiraPendente(page, id) {
  return page.evaluate((id) => proximaPendente(obterTarefa(id)).getTime(), id);
}

test.describe("9. Painel de Tarefas", () => {
  test("9.1 quando incluo uma tarefa com data final, então ela aparece Pendente na lista do mês dela", async ({ page }) => {
    await abrirApp(page, { usuario: DONO, gestor: false });
    await abrirTarefaPreenchida(page);
    await page.fill("#tDescricao", "Locação mensal de cilindros — Jardim Sul");
    await page.fill("#tData", diaRelativo(3));
    await page.fill("#tHora", "10:30");
    await page.fill("#tVezes", "1");
    await page.selectOption("#tUnidade", "mes");
    await page.fill("#tDataFinal", diaRelativo(200));
    await page.selectOption("#tLembrete", "10");
    await page.click("#modalCriar");

    const minhas = (await tarefas(page)).filter((t) => t.dono === DONO);
    expect(minhas).toHaveLength(1);
    expect(minhas[0].vezes).toBe(1);
    expect(minhas[0].unidade).toBe("mes");
    expect(minhas[0].termino).toBe("data");
    expect(minhas[0].lembreteMin).toBe(10);
    await expect(page.locator("#tarefasBackdrop")).toHaveClass(/open/);
    await expect(page.locator(`#tarefasLista .tarefa-linha[data-tarefa="${minhas[0].id}"]`).first()).toContainText("Pendente");
  });

  test("9.2 quando falta a descrição, então vejo o erro e nada é criado", async ({ page }) => {
    await abrirApp(page, { usuario: DONO, gestor: false });
    const antes = (await tarefas(page)).length;
    await abrirTarefaPreenchida(page);
    await page.fill("#tDescricao", "   ");
    await page.click("#modalCriar");
    await expect(page.locator("#formErro")).toContainText("descrição");
    expect((await tarefas(page)).length).toBe(antes);
  });

  for (const [campo, limpar, mensagem] of [
    ["origem", (p) => p.evaluate(() => { fOrigem.value = ""; }), "origem"],
    ["número do projeto", (p) => p.fill("#fProjeto", ""), "projeto"],
    ["observação", (p) => p.fill("#fObs", ""), "observação"],
  ]) {
    test(`9.2b quando falta ${campo} na tela da tarefa, então vejo o erro e nada é criado`, async ({ page }) => {
      await abrirApp(page, { usuario: DONO, gestor: false });
      const antes = (await tarefas(page)).length;
      await abrirTarefaPreenchida(page);
      await page.fill("#tDescricao", "Locação de andaimes");
      await limpar(page);
      await page.click("#modalCriar");
      await expect(page.locator("#formErro")).toContainText(new RegExp(mensagem, "i"));
      expect((await tarefas(page)).length).toBe(antes);
    });
  }

  test("9.2c quando a tarefa tem item com quantidade 0, então vejo o erro e nada é criado", async ({ page }) => {
    await abrirApp(page, { usuario: DONO, gestor: false });
    const antes = (await tarefas(page)).length;
    await abrirTarefaPreenchida(page);
    await page.fill("#tDescricao", "Locação de andaimes");
    await page.click("#btnMostrarItens");
    const linha = page.locator("#itensLista .item-row").first();
    await linha.locator(".item-descricao").fill("Disjuntor 32A");
    await linha.locator(".item-qtd").fill("0");
    await page.click("#modalCriar");
    await expect(page.locator("#formErro")).toContainText(/quantidade/i);
    expect((await tarefas(page)).length).toBe(antes);
  });

  test("9.2d quando abro a nova requisição avulsa depois da tarefa, então os campos da tarefa não aparecem", async ({ page }) => {
    await abrirApp(page, { usuario: DONO, gestor: false });
    await abrirTarefaPreenchida(page);
    await expect(page.locator("#tarefaCampos")).toBeVisible();
    await page.click("#modalCancelar");
    await page.click("#tarefasClose");
    await page.click("#btnNovaRequisicao");
    await expect(page.locator("#tarefaCampos")).toBeHidden();
    await expect(page.locator("#modalCriar")).toHaveText("Criar requisição");
  });

  for (const [caso, vezes, unidade] of [["0 vezes", "0", "mes"], ["8 vezes por semana", "8", "semana"], ["13 vezes por ano", "13", "ano"]]) {
    test(`9.3 quando informo ${caso}, então vejo o erro e nada é criado`, async ({ page }) => {
      await abrirApp(page, { usuario: DONO, gestor: false });
      const antes = (await tarefas(page)).length;
      await abrirTarefaPreenchida(page);
      await page.fill("#tDescricao", "Material de escritório");
      await page.selectOption("#tUnidade", unidade);
      await page.fill("#tVezes", vezes);
      await page.click("#modalCriar");
      await expect(page.locator("#formErro")).toContainText("quantas vezes");
      expect((await tarefas(page)).length).toBe(antes);
    });
  }

  test("9.3b quando a data final é antes da data inicial, então vejo o erro e nada é criado", async ({ page }) => {
    await abrirApp(page, { usuario: DONO, gestor: false });
    const antes = (await tarefas(page)).length;
    await abrirTarefaPreenchida(page);
    await page.fill("#tDescricao", "Material de escritório");
    await page.fill("#tData", diaRelativo(10));
    await page.fill("#tDataFinal", diaRelativo(5));
    await page.click("#modalCriar");
    await expect(page.locator("#formErro")).toContainText("data final");
    expect((await tarefas(page)).length).toBe(antes);
  });

  test("9.3c quando escolho \"Na data\" sem data final, então vejo o erro e nada é criado", async ({ page }) => {
    await abrirApp(page, { usuario: DONO, gestor: false });
    const antes = (await tarefas(page)).length;
    await abrirTarefaPreenchida(page);
    await page.fill("#tDescricao", "Material de escritório");
    await page.fill("#tDataFinal", "");
    await page.click("#modalCriar");
    await expect(page.locator("#formErro")).toContainText("data final");
    expect((await tarefas(page)).length).toBe(antes);
  });

  test("9.3d quando escolho renovação automática, então a data final não é pedida e a tarefa não tem fim", async ({ page }) => {
    await abrirApp(page, { usuario: DONO, gestor: false });
    await abrirTarefaPreenchida(page);
    await page.fill("#tDescricao", "EPI semanal");
    await page.check("#tTerminoAuto");
    await expect(page.locator("#tDataFinal")).toBeDisabled();
    await page.click("#modalCriar");
    const minha = (await tarefas(page)).find((t) => t.dono === DONO);
    expect(minha.termino).toBe("automatica");
    expect(minha.dataFinal).toBeNull();
  });

  test("9.4 quando clico duas vezes em \"Salvar tarefa\", então nasce uma tarefa só", async ({ page }) => {
    await abrirApp(page, { usuario: DONO, gestor: false });
    await abrirTarefaPreenchida(page);
    await page.fill("#tDescricao", "EPI semanal");
    await page.locator("#modalCriar").dblclick();
    expect((await tarefas(page)).filter((t) => t.dono === DONO)).toHaveLength(1);
  });

  test("9.4b quando mudo a repetição, então a prévia mostra as datas que serão geradas", async ({ page }) => {
    await abrirApp(page, { usuario: DONO, gestor: false });
    await abrirTarefaPreenchida(page);
    await page.fill("#tData", "2030-06-02");
    await page.fill("#tDataFinal", "2032-06-02");
    await page.selectOption("#tUnidade", "ano");
    await page.fill("#tVezes", "2");
    await expect(page.locator("#tPrevia")).toContainText("02/06/30");
    await expect(page.locator("#tPrevia")).toContainText("02/12/30");
    await expect(page.locator("#tPrevia")).toContainText("02/06/31");
  });

  test("9.5 quando clico em \"Gerar requisição\", então a requisição é criada na hora com os dados da tarefa e continuo no painel", async ({ page }) => {
    await abrirApp(page, { usuario: DONO, gestor: false });
    const id = await criarTarefa(page, { dias: 0, hora: 23 });
    const data = await primeiraPendente(page, id);
    const antes = await contarRequisicoes(page);

    await page.click("#btnTarefas");
    await page.click(`#tarefasLista [data-acao="gerar"][data-id="${id}"][data-data="${data}"]`);

    await expect(page.locator("#modalBackdrop")).not.toHaveClass(/open/);
    await expect(page.locator("#perguntaTarefaBackdrop")).not.toHaveClass(/open/);
    await expect(page.locator("#tarefasBackdrop")).toHaveClass(/open/);
    expect(await contarRequisicoes(page)).toBe(antes + 1);
    const feita = await tarefa(page, id);
    expect(feita.realizacoes).toHaveLength(1);
    expect(feita.realizacoes[0].data).toBe(data);
    const reqId = feita.realizacoes[0].requisicaoId;
    await expect(page.locator("#avisoToast")).toContainText(`${reqId} gerada`);
    const linha = page.locator(`#tarefasLista .tarefa-linha[data-data="${data}"]`);
    await expect(linha).toContainText("Realizada");
    await expect(linha).toContainText(reqId);

    const r = await requisicaoGerada(page, reqId);
    expect(r).toMatchObject({ solicitante: DONO, origem: "Obras", projetoNumero: "PRJ-2196", prioridade: "alta", observacao: "Andaimes do mês", status: "pendente" });
    expect(r.itens).toEqual([{ descricao: "Andaime tubular", modelo: "", quantidade: 40 }]);

    const seguinte = new Date(await primeiraPendente(page, id)), d1 = new Date(data);
    expect((seguinte.getFullYear() - d1.getFullYear()) * 12 + seguinte.getMonth() - d1.getMonth()).toBe(1);
  });

  test("9.5b quando dou clique duplo em \"Gerar requisição\", então nasce uma requisição só", async ({ page }) => {
    await abrirApp(page, { usuario: DONO, gestor: false });
    const id = await criarTarefa(page, { dias: -40, unidade: "semana" });
    const antes = await contarRequisicoes(page);
    await page.evaluate((id) => abrirHistoricoTarefa(id), id);
    await page.locator("#tarefaHistPendentes [data-acao=\"gerar\"]").first().dblclick();
    expect(await contarRequisicoes(page)).toBe(antes + 1);
    expect((await tarefa(page, id)).realizacoes).toHaveLength(1);
  });

  test("9.5c quando duas pessoas geram a mesma data ao mesmo tempo, então nasce uma requisição só", async ({ page }) => {
    await abrirApp(page, { usuario: DONO, gestor: false });
    const id = await criarTarefa(page);
    const r = await page.evaluate((id) => {
      const t = obterTarefa(id), versao = t.versao, data = proximaPendente(t).getTime();
      const antes = estadoParaTestes().requisicoes.length;
      return Promise.all([1, 2].map(async () => opGerarRequisicaoDaTarefa(id, versao, data)))
        .then((res) => ({ oks: res.filter((x) => x.ok).length, criadas: estadoParaTestes().requisicoes.length - antes, realizacoes: obterTarefa(id).realizacoes.length }));
    }, id);
    expect(r).toEqual({ oks: 1, criadas: 1, realizacoes: 1 });
  });

  test("9.5d quando a tarefa tem anexo, então cada requisição gerada leva o anexo", async ({ page }) => {
    await abrirApp(page, { usuario: DONO, gestor: false });
    await abrirTarefaPreenchida(page);
    await page.fill("#tDescricao", "Locação de andaimes");
    await page.setInputFiles("#fAnexo", { name: "contrato.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4") });
    await page.click("#modalCriar");
    const nomes = await page.evaluate(() => {
      const t = estadoParaTestes().tarefas.at(-1);
      const res = opGerarRequisicaoDaTarefa(t.id, t.versao, proximaPendente(t).getTime());
      return res.r.anexos.map((a) => a.name);
    });
    expect(nomes).toEqual(["contrato.pdf"]);
  });

  test("9.6 quando a mesma data é concluída duas vezes ao mesmo tempo, então só uma conclusão vale", async ({ page }) => {
    await abrirApp(page, { usuario: DONO, gestor: false });
    const id = await criarTarefa(page, { unidade: "semana" });
    const r = await page.evaluate((id) => {
      const t = obterTarefa(id), versao = t.versao, data = proximaPendente(t).getTime();
      return Promise.all(["RC-9001", "RC-9002"].map(async (req) => opConcluirOcorrencia(id, versao, data, req)))
        .then((res) => ({ oks: res.filter((x) => x.ok).length, realizacoes: obterTarefa(id).realizacoes.length }));
    }, id);
    expect(r.oks).toBe(1);
    expect(r.realizacoes).toBe(1);
  });

  test("9.7 quando a data já foi realizada, então gerar de novo é recusado", async ({ page }) => {
    await abrirApp(page, { usuario: DONO, gestor: false });
    const id = await criarTarefa(page);
    const erro = await page.evaluate((id) => {
      const t = obterTarefa(id), data = proximaPendente(t).getTime();
      opConcluirOcorrencia(id, t.versao, data, "RC-9001");
      return erroGerarDaTarefa(id, obterTarefa(id).versao, data);
    }, id);
    expect(erro).toContain("já foi realizada");
  });

  test.describe("9.8 datas da repetição (N vezes por período)", () => {
    test("1 por semana → a cada 7 dias", async ({ page }) => {
      await abrirApp(page);
      expect(await primeirasDatas(page, { vezes: 1, unidade: "semana", ano: 2026, mes: 10, dia: 28, quantas: 2 })).toEqual(["2026-10-28", "2026-11-04"]);
    });
    test("2 por semana → duas datas dentro de cada semana", async ({ page }) => {
      await abrirApp(page);
      expect(await primeirasDatas(page, { vezes: 2, unidade: "semana", ano: 2026, mes: 10, dia: 5, quantas: 4 })).toEqual(["2026-10-05", "2026-10-09", "2026-10-12", "2026-10-16"]);
    });
    test("1 por mês, dia 31 → último dia nos meses mais curtos", async ({ page }) => {
      await abrirApp(page);
      expect(await primeirasDatas(page, { vezes: 1, unidade: "mes", ano: 2027, mes: 1, dia: 31, quantas: 3 })).toEqual(["2027-01-31", "2027-02-28", "2027-03-31"]);
    });
    test("2 por mês → duas datas dentro de cada mês", async ({ page }) => {
      await abrirApp(page);
      expect(await primeirasDatas(page, { vezes: 2, unidade: "mes", ano: 2026, mes: 10, dia: 2, quantas: 4 })).toEqual(["2026-10-02", "2026-10-18", "2026-11-02", "2026-11-17"]);
    });
    test("2 por ano → a cada 6 meses", async ({ page }) => {
      await abrirApp(page);
      expect(await primeirasDatas(page, { vezes: 2, unidade: "ano", ano: 2026, mes: 6, dia: 2, quantas: 4 })).toEqual(["2026-06-02", "2026-12-02", "2027-06-02", "2027-12-02"]);
    });
    test("com data final → nenhuma data passa dela, e a própria data final conta", async ({ page }) => {
      await abrirApp(page);
      expect(await primeirasDatas(page, { vezes: 1, unidade: "mes", ano: 2026, mes: 6, dia: 2, termino: "data", final: [2026, 8, 2], quantas: 10 })).toEqual(["2026-06-02", "2026-07-02", "2026-08-02"]);
    });
  });

  test("9.9 quando abro o histórico da tarefa, então vejo as requisições passadas, a pendente e as próximas datas até a data final", async ({ page }) => {
    await abrirApp(page, { usuario: DONO, gestor: false });
    const id = await criarTarefa(page, { dias: -35, unidade: "mes", termino: "data", diasFinal: 70 });
    await page.evaluate((id) => {
      const t = obterTarefa(id);
      opConcluirOcorrencia(id, t.versao, t.dataInicial.getTime(), "RC-0001");
    }, id);
    await page.evaluate((id) => abrirHistoricoTarefa(id), id);
    await expect(page.locator("#tarefaHistFeitas")).toContainText("RC-0001");
    await expect(page.locator("#tarefaHistPendentes li")).toHaveCount(2);
    await expect(page.locator("#tarefaHistPrevistas")).toContainText("Prevista");
    const ultima = await page.evaluate((id) => {
      const t = obterTarefa(id);
      return [...gerarDatasTarefa(t)].every((d) => d <= t.dataFinal);
    }, id);
    expect(ultima).toBe(true);
  });

  test("9.10 quando chega a hora do lembrete, então quem criou recebe uma notificação no sino, uma vez só", async ({ page }) => {
    await abrirApp(page, { usuario: DONO, gestor: false });
    const id = await criarTarefa(page, { dias: 1, lembreteMin: 30 });
    const r = await page.evaluate((id) => {
      const data = proximaPendente(obterTarefa(id)).getTime();
      const contar = () => estadoParaTestes().notificacoes.filter((n) => n.tarefaId === id).length;
      verificarLembretesTarefas(new Date(data - 31 * 60000));
      const antesDaHora = contar();
      verificarLembretesTarefas(new Date(data - 30 * 60000));
      verificarLembretesTarefas(new Date(data - 29 * 60000));
      const n = estadoParaTestes().notificacoes.find((n) => n.tarefaId === id);
      return { antesDaHora, depois: contar(), para: n && n.para };
    }, id);
    expect(r.antesDaHora).toBe(0);
    expect(r.depois).toBe(1);
    expect(r.para).toBe(DONO);
  });

  test("9.11 quando a tarefa está sem lembrete, então nenhuma notificação é criada", async ({ page }) => {
    await abrirApp(page, { usuario: DONO, gestor: false });
    const id = await criarTarefa(page, { dias: 0, hora: 0, lembreteMin: 0 });
    const n = await page.evaluate((id) => {
      verificarLembretesTarefas(new Date(Date.now() + 86400000));
      return estadoParaTestes().notificacoes.filter((n) => n.tarefaId === id).length;
    }, id);
    expect(n).toBe(0);
  });

  test("9.12 quando crio uma requisição e respondo \"Não\" ao \"Gerar tarefa?\", então segue o fluxo normal e nenhuma tarefa é criada", async ({ page }) => {
    await abrirApp(page, { usuario: DONO, gestor: false });
    const antes = (await tarefas(page)).length;
    await preencherNovaRequisicao(page);
    await page.click("#modalCriar");
    await expect(page.locator("#perguntaTarefaBackdrop")).toHaveClass(/open/);
    await page.click("#perguntaTarefaNao");
    await expect(page.locator("#perguntaTarefaBackdrop")).not.toHaveClass(/open/);
    await expect(page.locator("#reqDrawer")).toHaveClass(/open/);
    expect((await tarefas(page)).length).toBe(antes);
  });

  test("9.13 quando respondo \"Sim\", então ajusto a repetição, a requisição vira modelo e o dia dela já entra como Realizada", async ({ page }) => {
    await abrirApp(page, { usuario: DONO, gestor: false });
    await preencherNovaRequisicao(page, { itens: [{ descricao: "Cilindro de oxigênio", quantidade: 4 }], observacao: "Locação mensal de cilindros" });
    await page.click("#modalCriar");
    const reqId = (await page.locator("#reqDrawerTitulo").textContent()).split(" — ")[0];
    await page.click("#perguntaTarefaSim");
    await expect(page.locator("#modalBackdrop")).toHaveClass(/open/);
    await expect(page.locator("#tarefaCampos")).toBeVisible();
    await expect(page.locator("#fObs")).toHaveValue("Locação mensal de cilindros");
    await expect(page.locator("#fProjeto")).toHaveValue("PRJ-2200");
    await expect(page.locator("#tData")).toHaveValue(diaRelativo(0));
    await page.fill("#tVezes", "2");
    await page.fill("#tDataFinal", diaRelativo(300));
    await page.click("#modalCriar");

    const minhas = (await tarefas(page)).filter((t) => t.dono === DONO);
    expect(minhas).toHaveLength(1);
    expect(minhas[0].vezes).toBe(2);
    expect(minhas[0].unidade).toBe("mes");
    expect(minhas[0].modelo.observacao).toBe("Locação mensal de cilindros");
    expect(minhas[0].modelo.itens).toEqual([{ descricao: "Cilindro de oxigênio", modelo: "", quantidade: 4 }]);
    expect(minhas[0].realizacoes.map((x) => x.requisicaoId)).toEqual([reqId]);
    await expect(page.locator("#tarefasBackdrop")).toHaveClass(/open/);
  });

  test("9.14 quando outra pessoa abre o painel, então não vê nem altera as minhas tarefas", async ({ page }) => {
    await abrirApp(page, { usuario: DONO, gestor: false });
    const id = await criarTarefa(page, { dias: 0, hora: 23 });
    await comoUsuario(page, "Pessoa Sem Permissão");
    await page.click("#btnTarefas");
    await expect(page.locator(`#tarefasLista [data-tarefa="${id}"]`)).toHaveCount(0);
    const r = await page.evaluate((id) => {
      const t = obterTarefa(id);
      return {
        editar: opEditarTarefa(id, t.versao, { descricao: "invasão", dataInicial: new Date(), vezes: 1, unidade: "mes", termino: "automatica", lembreteMin: 0, modelo: t.modelo }).ok,
        excluir: opExcluirTarefa(id, t.versao).ok,
        concluir: opConcluirOcorrencia(id, t.versao, proximaPendente(t).getTime(), "RC-9001").ok,
        descricao: obterTarefa(id).descricao,
      };
    }, id);
    expect(r).toEqual({ editar: false, excluir: false, concluir: false, descricao: "Locação de andaimes" });
  });

  test("9.15 quando sou gestor e escolho \"De todos\", então vejo as tarefas das outras pessoas", async ({ page }) => {
    await abrirApp(page, { usuario: DONO, gestor: false });
    const id = await criarTarefa(page, { dias: 0, hora: 23 });
    await comoUsuario(page, "Gestor Teste", true);
    await page.click("#btnTarefas");
    await expect(page.locator(`#tarefasLista [data-tarefa="${id}"]`)).toHaveCount(0);
    await page.selectOption("#tfFiltroVer", "todas");
    await expect(page.locator(`#tarefasLista [data-tarefa="${id}"]`).first()).toBeVisible();
  });

  test("9.16 quando escolho mês anterior, atual ou próximo, então vejo a realizada, a pendente e a prevista de cada mês", async ({ page }) => {
    await abrirApp(page, { usuario: "Fernanda Lima", gestor: false });
    await page.click("#btnTarefas");
    await page.selectOption("#tfFiltroPeriodo", "anterior");
    await expect(page.locator("#tarefasLista")).toContainText("Realizada");
    await page.selectOption("#tfFiltroPeriodo", "atual");
    await expect(page.locator("#tarefasLista")).toContainText("Pendente");
    await page.selectOption("#tfFiltroPeriodo", "proximo");
    await expect(page.locator("#tarefasLista")).toContainText(/Pendente|Prevista/);
  });
});
