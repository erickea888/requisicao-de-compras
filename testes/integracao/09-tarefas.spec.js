const { test, expect, abrirApp, comoUsuario, contarRequisicoes, preencherNovaRequisicao, diaRelativo } = require("./ajuda");

// Painel de Tarefas: requisições que se repetem (todo dia, semana, 1 ou 2 vezes no mês).
// Regras combinadas com o Erick:
// - a tarefa vira Realizada quando a requisição é gerada por ela; a próxima data nasce Pendente;
// - o lembrete é X minutos antes da data/hora, no sino de quem criou;
// - "2 vezes no mês": o usuário escolhe os dois dias;
// - ficam na memória, como as requisições (Firebase depois).

const DONO = "Ana Tarefas";

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
function criarTarefa(page, { dias = 1, hora = 9, recorrencia = "mensal", lembreteMin = 30, diasMes = [], descricao = "Locação de andaimes", modelo = null } = {}) {
  return page.evaluate(([dias, hora, recorrencia, lembreteMin, diasMes, descricao, modelo]) => {
    const h = new Date();
    const dataHora = new Date(h.getFullYear(), h.getMonth(), h.getDate() + dias, hora, 0);
    const res = opCriarTarefa(novaChaveEnvio(), { descricao, dataHora, lembreteMin, recorrencia, diasMes, modelo });
    if (!res.ok) throw new Error(res.erro);
    return res.t.id;
  }, [dias, hora, recorrencia, lembreteMin, diasMes, descricao, modelo]);
}
// Próxima data da recorrência, devolvida como texto local "AAAA-MM-DD HH:MM".
function proxima(page, recorrencia, diasMes, ano, mes, dia, hora = 9) {
  return page.evaluate(([recorrencia, diasMes, ano, mes, dia, hora]) => {
    const d = proximaDataRecorrencia({ recorrencia, diasMes }, new Date(ano, mes - 1, dia, hora, 0));
    const p = (x) => String(x).padStart(2, "0");
    return d ? `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}` : null;
  }, [recorrencia, diasMes, ano, mes, dia, hora]);
}

test.describe("9. Painel de Tarefas", () => {
  test("9.1 quando incluo uma tarefa pelo painel, então ela aparece Pendente na lista do mês dela", async ({ page }) => {
    await abrirApp(page, { usuario: DONO, gestor: false });
    await page.click("#btnTarefas");
    await page.click("#btnIncluirTarefa");
    await page.fill("#tDescricao", "Locação mensal de cilindros — Jardim Sul");
    await page.fill("#tData", diaRelativo(3));
    await page.fill("#tHora", "10:30");
    await page.selectOption("#tLembrete", "10");
    await page.selectOption("#tRecorrencia", "mensal");
    await page.click("#tarefaSalvar");

    const minhas = (await tarefas(page)).filter((t) => t.dono === DONO);
    expect(minhas).toHaveLength(1);
    expect(minhas[0].status).toBe("pendente");
    expect(minhas[0].lembreteMin).toBe(10);
    await expect(page.locator("#tarefasBackdrop")).toHaveClass(/open/);
    await expect(page.locator(`#tarefasLista [data-tarefa="${minhas[0].id}"]`)).toContainText("Pendente");
  });

  test("9.2 quando falta a descrição, então vejo o erro e nada é criado", async ({ page }) => {
    await abrirApp(page, { usuario: DONO, gestor: false });
    const antes = (await tarefas(page)).length;
    await page.click("#btnTarefas");
    await page.click("#btnIncluirTarefa");
    await page.fill("#tDescricao", "   ");
    await page.click("#tarefaSalvar");
    await expect(page.locator("#tarefaErro")).toContainText("descrição");
    expect((await tarefas(page)).length).toBe(antes);
  });

  test("9.3 quando escolho \"2 vezes no mês\" com o mesmo dia duas vezes, então vejo o erro e nada é criado", async ({ page }) => {
    await abrirApp(page, { usuario: DONO, gestor: false });
    const antes = (await tarefas(page)).length;
    await page.click("#btnTarefas");
    await page.click("#btnIncluirTarefa");
    await page.fill("#tDescricao", "Material de escritório");
    await page.selectOption("#tRecorrencia", "duas_mes");
    await page.fill("#tDia1", "10");
    await page.fill("#tDia2", "10");
    await page.click("#tarefaSalvar");
    await expect(page.locator("#tarefaErro")).toContainText("diferentes");
    expect((await tarefas(page)).length).toBe(antes);
  });

  test("9.4 quando clico duas vezes em \"Salvar tarefa\", então nasce uma tarefa só", async ({ page }) => {
    await abrirApp(page, { usuario: DONO, gestor: false });
    await page.click("#btnTarefas");
    await page.click("#btnIncluirTarefa");
    await page.fill("#tDescricao", "EPI semanal");
    await page.locator("#tarefaSalvar").dblclick();
    expect((await tarefas(page)).filter((t) => t.dono === DONO)).toHaveLength(1);
  });

  test("9.5 quando gero a requisição da tarefa, então o formulário vem preenchido, a tarefa vira Realizada e a próxima nasce Pendente", async ({ page }) => {
    await abrirApp(page, { usuario: DONO, gestor: false });
    const modelo = { solicitante: DONO, origem: "Obras", projetoNumero: "PRJ-2196", projetoNome: "Shopping Rio Claro", prioridade: "alta",
      observacao: "Andaimes do mês", faturamentoDireto: false, itens: [{ descricao: "Andaime tubular", modelo: "", quantidade: 40 }] };
    const id = await criarTarefa(page, { dias: 0, hora: 23, recorrencia: "mensal", modelo });
    const antes = await contarRequisicoes(page);

    await page.click("#btnTarefas");
    await page.click(`#tarefasLista [data-acao="gerar"][data-id="${id}"]`);
    await expect(page.locator("#fProjeto")).toHaveValue("PRJ-2196");
    await expect(page.locator("#fObs")).toHaveValue("Andaimes do mês");
    await expect(page.locator("#itensLista .item-qtd").first()).toHaveValue("40");
    await page.click("#modalCriar");

    expect(await contarRequisicoes(page)).toBe(antes + 1);
    const feita = await tarefa(page, id);
    expect(feita.status).toBe("realizada");
    const reqId = (await page.locator("#reqDrawerTitulo").textContent()).split(" — ")[0];
    expect(feita.requisicaoGeradaId).toBe(reqId);
    const seguintes = (await tarefas(page)).filter((t) => t.serieId === feita.serieId && t.status === "pendente");
    expect(seguintes).toHaveLength(1);
    const d1 = new Date(feita.dataHora), d2 = new Date(seguintes[0].dataHora);
    expect((d2.getFullYear() - d1.getFullYear()) * 12 + d2.getMonth() - d1.getMonth()).toBe(1);
    await expect(page.locator("#perguntaTarefaBackdrop")).not.toHaveClass(/open/);
  });

  test("9.6 quando a mesma tarefa é concluída duas vezes ao mesmo tempo, então uma conclusão vale e nasce uma próxima só", async ({ page }) => {
    await abrirApp(page, { usuario: DONO, gestor: false });
    const id = await criarTarefa(page, { recorrencia: "semanal" });
    const r = await page.evaluate((id) => {
      const versao = obterTarefa(id).versao;
      return Promise.all(["RC-9001", "RC-9002"].map(async (req) => opConcluirTarefa(id, versao, req)))
        .then((res) => ({ oks: res.filter((x) => x.ok).length, proximas: estadoParaTestes().tarefas.filter((t) => t.chaveCriacao === "proxima:" + id).length }));
    }, id);
    expect(r.oks).toBe(1);
    expect(r.proximas).toBe(1);
  });

  test("9.7 quando a tarefa já foi realizada, então gerar de novo e editar são recusados", async ({ page }) => {
    await abrirApp(page, { usuario: DONO, gestor: false });
    const id = await criarTarefa(page);
    const r = await page.evaluate((id) => {
      const t = obterTarefa(id);
      opConcluirTarefa(id, t.versao, "RC-9001");
      const edicao = opEditarTarefa(id, t.versao, { descricao: "x", dataHora: new Date(), lembreteMin: 0, recorrencia: "nenhuma", diasMes: [] });
      return { gerar: erroGerarDaTarefa(id, obterTarefa(id).versao), edicao: edicao.ok };
    }, id);
    expect(r.gerar).toContain("já foi realizada");
    expect(r.edicao).toBe(false);
  });

  test.describe("9.8 próxima data da recorrência", () => {
    test("todo dia → dia seguinte, mesmo horário", async ({ page }) => {
      await abrirApp(page);
      expect(await proxima(page, "diaria", [], 2026, 10, 31, 8)).toBe("2026-11-01 08:00");
    });
    test("toda semana → 7 dias depois", async ({ page }) => {
      await abrirApp(page);
      expect(await proxima(page, "semanal", [], 2026, 10, 28)).toBe("2026-11-04 09:00");
    });
    test("1 vez no mês, dia 31 → último dia de um mês mais curto", async ({ page }) => {
      await abrirApp(page);
      expect(await proxima(page, "mensal", [31], 2027, 1, 31)).toBe("2027-02-28 09:00");
      expect(await proxima(page, "mensal", [31], 2027, 2, 28)).toBe("2027-03-31 09:00");
    });
    test("2 vezes no mês (dias 5 e 20) → alterna entre os dois dias", async ({ page }) => {
      await abrirApp(page);
      expect(await proxima(page, "duas_mes", [5, 20], 2026, 10, 5)).toBe("2026-10-20 09:00");
      expect(await proxima(page, "duas_mes", [5, 20], 2026, 10, 20)).toBe("2026-11-05 09:00");
    });
    test("não repete → não há próxima", async ({ page }) => {
      await abrirApp(page);
      expect(await proxima(page, "nenhuma", [], 2026, 10, 5)).toBeNull();
    });
  });

  test("9.9 quando gero uma tarefa atrasada, então a próxima pula as datas que já passaram", async ({ page }) => {
    await abrirApp(page, { usuario: DONO, gestor: false });
    const id = await criarTarefa(page, { dias: -20, recorrencia: "semanal" });
    const proximaData = await page.evaluate((id) => {
      const res = opConcluirTarefa(id, obterTarefa(id).versao, "RC-9001");
      return res.proxima.dataHora.getTime();
    }, id);
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    expect(proximaData).toBeGreaterThanOrEqual(hoje.getTime());
  });

  test("9.10 quando chega a hora do lembrete, então quem criou recebe uma notificação no sino, uma vez só", async ({ page }) => {
    await abrirApp(page, { usuario: DONO, gestor: false });
    const id = await criarTarefa(page, { dias: 1, lembreteMin: 30 });
    const r = await page.evaluate((id) => {
      const t = obterTarefa(id);
      const contar = () => estadoParaTestes().notificacoes.filter((n) => n.tarefaId === id).length;
      verificarLembretesTarefas(new Date(t.dataHora.getTime() - 31 * 60000));
      const antesDaHora = contar();
      verificarLembretesTarefas(new Date(t.dataHora.getTime() - 30 * 60000));
      verificarLembretesTarefas(new Date(t.dataHora.getTime() - 29 * 60000));
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

  test("9.13 quando respondo \"Sim\" ao \"Gerar tarefa?\", então ajusto a recorrência e a tarefa vai para o painel com a requisição como modelo", async ({ page }) => {
    await abrirApp(page, { usuario: DONO, gestor: false });
    await preencherNovaRequisicao(page, { itens: [{ descricao: "Cilindro de oxigênio", quantidade: 4 }], observacao: "Locação mensal de cilindros" });
    await page.click("#modalCriar");
    const reqId = (await page.locator("#reqDrawerTitulo").textContent()).split(" — ")[0];
    await page.click("#perguntaTarefaSim");
    await expect(page.locator("#tarefaFormBackdrop")).toHaveClass(/open/);
    await expect(page.locator("#tModeloInfo")).toContainText(reqId);
    await page.selectOption("#tRecorrencia", "duas_mes");
    await page.fill("#tDia1", "2");
    await page.fill("#tDia2", "17");
    await page.click("#tarefaSalvar");

    const minhas = (await tarefas(page)).filter((t) => t.dono === DONO);
    expect(minhas).toHaveLength(1);
    expect(minhas[0].recorrencia).toBe("duas_mes");
    expect(minhas[0].diasMes).toEqual([2, 17]);
    expect(minhas[0].modelo.observacao).toBe("Locação mensal de cilindros");
    expect(minhas[0].modelo.itens).toEqual([{ descricao: "Cilindro de oxigênio", modelo: "", quantidade: 4 }]);
    await expect(page.locator("#tarefasBackdrop")).toHaveClass(/open/);
  });

  test("9.14 quando outra pessoa abre o painel, então não vê nem altera as minhas tarefas", async ({ page }) => {
    await abrirApp(page, { usuario: DONO, gestor: false });
    const id = await criarTarefa(page, { dias: 1 });
    await comoUsuario(page, "Pessoa Sem Permissão");
    await page.click("#btnTarefas");
    await expect(page.locator(`#tarefasLista [data-tarefa="${id}"]`)).toHaveCount(0);
    const r = await page.evaluate((id) => {
      const t = obterTarefa(id);
      return {
        editar: opEditarTarefa(id, t.versao, { descricao: "invasão", dataHora: new Date(), lembreteMin: 0, recorrencia: "nenhuma", diasMes: [] }).ok,
        excluir: opExcluirTarefa(id, t.versao).ok,
        concluir: opConcluirTarefa(id, t.versao, "RC-9001").ok,
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
    await expect(page.locator(`#tarefasLista [data-tarefa="${id}"]`)).toHaveCount(1);
  });

  test("9.16 quando escolho mês anterior, atual ou próximo, então vejo a realizada, a pendente e a prevista de cada mês", async ({ page }) => {
    await abrirApp(page, { usuario: "Fernanda Lima", gestor: false });
    await page.click("#btnTarefas");
    await page.selectOption("#tfFiltroPeriodo", "anterior");
    await expect(page.locator("#tarefasLista")).toContainText("Realizada");
    await page.selectOption("#tfFiltroPeriodo", "atual");
    await expect(page.locator("#tarefasLista")).toContainText("Pendente");
    await page.selectOption("#tfFiltroPeriodo", "proximo");
    await expect(page.locator("#tarefasLista")).toContainText("Prevista");
  });
});
