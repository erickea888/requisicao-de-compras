const { test, expect, abrirApp, comoUsuario, contarRequisicoes, diaRelativo } = require("./ajuda");

// Ajustes do Painel de Tarefas combinados com o Erick em 05/11/2026:
// - "Pular esta data": quando a compra não é necessária naquela vez, a data sai das pendências com um motivo,
//   não gera requisição nem lembrete, e pode ser retomada;
// - data que cai no sábado ou domingo: manter, antecipar para sexta ou adiar para segunda (feriados não entram);
// - ao gerar, o aviso mostra o projeto e a origem usados, para conferir na hora e desfazer se estiver errado.

const DONO = "Ana Tarefas";
const MODELO = { solicitante: DONO, origem: "Obras", projetoNumero: "PRJ-2196", projetoNome: "Shopping Rio Claro", prioridade: "alta",
  observacao: "Andaimes do mês", faturamentoDireto: false, anexos: [], itens: [{ descricao: "Andaime tubular", modelo: "", quantidade: 40 }] };

function tarefa(page, id) {
  return page.evaluate((id) => JSON.parse(JSON.stringify(obterTarefa(id))), id);
}
// Cria uma tarefa direto pela operação (preparação de cenário). dias: a partir de hoje.
function criarTarefa(page, { dias = 1, hora = 9, vezes = 1, unidade = "mes", lembreteMin = 30 } = {}) {
  return page.evaluate(([dias, hora, vezes, unidade, lembreteMin, modelo]) => {
    const h = new Date();
    const dataInicial = new Date(h.getFullYear(), h.getMonth(), h.getDate() + dias, hora, 0);
    const res = opCriarTarefa(novaChaveEnvio(), { descricao: "Locação de andaimes", dataInicial, vezes, unidade,
      termino: "automatica", dataFinal: null, lembreteMin, modelo });
    if (!res.ok) throw new Error(res.erro);
    return res.t.id;
  }, [dias, hora, vezes, unidade, lembreteMin, MODELO]);
}
function primeiraPendente(page, id) {
  return page.evaluate((id) => proximaPendente(obterTarefa(id)).getTime(), id);
}
function pular(page, id, data, motivo) {
  return page.evaluate(([id, data, motivo]) => {
    const r = opPularData(id, obterTarefa(id).versao, data, motivo);
    return { ok: r.ok, erro: r.erro || "" };
  }, [id, data, motivo]);
}
// As primeiras datas com o ajuste de fim de semana, como texto local "AAAA-MM-DD".
function datasComAjuste(page, { ajuste, vezes = 1, unidade = "mes", ano, mes, dia, quantas = 6 }) {
  return page.evaluate(([ajuste, vezes, unidade, ano, mes, dia, quantas]) => {
    const t = { vezes, unidade, termino: "automatica", dataFinal: null, ajusteFimSemana: ajuste, dataInicial: new Date(ano, mes - 1, dia, 9, 0) };
    const p = (x) => String(x).padStart(2, "0");
    const lista = [];
    for (const d of gerarDatasTarefa(t)) {
      if (lista.length >= quantas) break;
      lista.push(`${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`);
    }
    return lista;
  }, [ajuste, vezes, unidade, ano, mes, dia, quantas]);
}

test.describe("10. Ajustes do Painel de Tarefas", () => {
  test.describe("10.1 pular uma data", () => {
    test("quando pulo uma data atrasada pelo histórico, com motivo, então ela fica Pulada e a próxima vira a pendente", async ({ page }) => {
      await abrirApp(page, { usuario: DONO, gestor: false });
      const id = await criarTarefa(page, { dias: -3, unidade: "semana" });
      const atrasada = await primeiraPendente(page, id);
      const antes = await contarRequisicoes(page);

      await page.evaluate((id) => abrirHistoricoTarefa(id), id);
      await page.click(`#tarefaHistPendentes [data-acao="pular"][data-data="${atrasada}"]`);
      await expect(page.locator("#pularDataBackdrop")).toHaveClass(/open/);
      await page.fill("#pularDataMotivo", "Sobrou estoque da semana passada");
      await page.click("#pularDataConfirmar");

      await expect(page.locator("#pularDataBackdrop")).not.toHaveClass(/open/);
      const t = await tarefa(page, id);
      expect(t.puladas).toHaveLength(1);
      expect(t.puladas[0]).toMatchObject({ data: atrasada, motivo: "Sobrou estoque da semana passada", usuario: DONO });
      expect(t.realizacoes).toHaveLength(0);
      expect(await contarRequisicoes(page)).toBe(antes);
      expect(await primeiraPendente(page, id)).toBe(atrasada + 7 * 86400000);
      await expect(page.locator("#tarefaHistPuladas")).toContainText("Sobrou estoque da semana passada");
      await expect(page.locator(`#tarefaHistPendentes [data-data="${atrasada}"]`)).toHaveCount(0);
    });

    test("quando pulo pelo painel, então a linha mostra Pulada, sem botão de gerar, e o contador do botão Tarefas baixa", async ({ page }) => {
      await abrirApp(page, { usuario: DONO, gestor: false });
      const id = await criarTarefa(page, { dias: -1, hora: 8, unidade: "mes" });
      const data = await primeiraPendente(page, id);
      await page.evaluate(() => atualizarBadgeTarefas());
      await expect(page.locator("#tarefasBadge")).toHaveText("1");

      await page.click("#btnTarefas");
      await page.selectOption("#tfFiltroPeriodo", "todos");
      await page.click(`#tarefasLista [data-acao="pular"][data-id="${id}"][data-data="${data}"]`);
      await page.fill("#pularDataMotivo", "Obra parada este mês");
      await page.click("#pularDataConfirmar");

      const linha = page.locator(`#tarefasLista .tarefa-linha[data-tarefa="${id}"][data-data="${data}"]`);
      await expect(linha).toContainText("Pulada");
      await expect(linha.locator('[data-acao="gerar"]')).toHaveCount(0);
      await expect(linha.locator('[data-acao="retomar"]')).toHaveCount(1);
      await expect(page.locator("#tarefasBadge")).toBeHidden();
    });

    test("quando confirmo sem motivo, então vejo o erro e a data continua pendente", async ({ page }) => {
      await abrirApp(page, { usuario: DONO, gestor: false });
      const id = await criarTarefa(page, { dias: -2, unidade: "semana" });
      const data = await primeiraPendente(page, id);
      await page.evaluate((id) => abrirHistoricoTarefa(id), id);
      await page.click(`#tarefaHistPendentes [data-acao="pular"][data-data="${data}"]`);
      await page.fill("#pularDataMotivo", "   ");
      await page.click("#pularDataConfirmar");
      await expect(page.locator("#pularDataErro")).toContainText("motivo");
      expect((await tarefa(page, id)).puladas).toHaveLength(0);
      expect(await primeiraPendente(page, id)).toBe(data);
    });

    test("quando a data está pulada, então gerar a requisição dela é recusado e nada é criado", async ({ page }) => {
      await abrirApp(page, { usuario: DONO, gestor: false });
      const id = await criarTarefa(page, { dias: -2, unidade: "semana" });
      const data = await primeiraPendente(page, id);
      expect((await pular(page, id, data, "não precisa")).ok).toBe(true);
      const antes = await contarRequisicoes(page);
      const res = await page.evaluate(([id, data]) => {
        const r = opGerarRequisicaoDaTarefa(id, obterTarefa(id).versao, data);
        return { ok: r.ok, erro: r.erro || "" };
      }, [id, data]);
      expect(res.ok).toBe(false);
      expect(res.erro).toContain("pulada");
      expect(await contarRequisicoes(page)).toBe(antes);
    });

    test("quando a data já tem requisição, então não dá para pular", async ({ page }) => {
      await abrirApp(page, { usuario: DONO, gestor: false });
      const id = await criarTarefa(page, { dias: 0, hora: 23 });
      const data = await primeiraPendente(page, id);
      await page.evaluate(([id, data]) => opGerarRequisicaoDaTarefa(id, obterTarefa(id).versao, data), [id, data]);
      const res = await pular(page, id, data, "tentativa");
      expect(res.ok).toBe(false);
      expect(res.erro).toContain("Desfazer");
    });

    test("quando retomo uma data pulada, então ela volta para Pendente e posso gerar a requisição", async ({ page }) => {
      await abrirApp(page, { usuario: DONO, gestor: false });
      const id = await criarTarefa(page, { dias: -2, unidade: "semana" });
      const data = await primeiraPendente(page, id);
      expect((await pular(page, id, data, "não precisa")).ok).toBe(true);

      await page.evaluate((id) => abrirHistoricoTarefa(id), id);
      await page.click(`#tarefaHistPuladas [data-acao="retomar"][data-data="${data}"]`);
      expect((await tarefa(page, id)).puladas).toHaveLength(0);
      expect(await primeiraPendente(page, id)).toBe(data);
      await expect(page.locator(`#tarefaHistPendentes [data-acao="gerar"][data-data="${data}"]`)).toHaveCount(1);

      const antes = await contarRequisicoes(page);
      await page.click(`#tarefaHistPendentes [data-acao="gerar"][data-data="${data}"]`);
      expect(await contarRequisicoes(page)).toBe(antes + 1);
    });

    test("quando a data foi pulada, então o lembrete dela não chega", async ({ page }) => {
      await abrirApp(page, { usuario: DONO, gestor: false });
      // Tudo numa chamada só, para a checagem automática (a cada 30 s) não rodar entre criar e pular.
      const r = await page.evaluate((modelo) => {
        const h = new Date();
        const dataInicial = new Date(h.getFullYear(), h.getMonth(), h.getDate(), 23, 0);
        const t = opCriarTarefa(novaChaveEnvio(), { descricao: "Andaimes", dataInicial, vezes: 1, unidade: "mes",
          termino: "automatica", dataFinal: null, lembreteMin: 1440, modelo }).t;
        const data = dataInicial.getTime();
        const pulou = opPularData(t.id, t.versao, data, "não precisa").ok;
        verificarLembretesTarefas(new Date());
        return { pulou, avisos: estadoParaTestes().notificacoes.filter((n) => n.chave === `lembrete:${t.id}:${data}`).length };
      }, MODELO);
      expect(r).toEqual({ pulou: true, avisos: 0 });
    });

    test("quando duas pessoas pulam a mesma data ao mesmo tempo, então só uma vale", async ({ page }) => {
      await abrirApp(page, { usuario: DONO, gestor: false });
      const id = await criarTarefa(page, { dias: -2, unidade: "semana" });
      const r = await page.evaluate((id) => {
        const t = obterTarefa(id), versao = t.versao, data = proximaPendente(t).getTime();
        return Promise.all(["motivo A", "motivo B"].map(async (m) => opPularData(id, versao, data, m)))
          .then((res) => ({ oks: res.filter((x) => x.ok).length, puladas: obterTarefa(id).puladas.length }));
      }, id);
      expect(r).toEqual({ oks: 1, puladas: 1 });
    });

    test("quando outra pessoa tenta pular, então é recusado", async ({ page }) => {
      await abrirApp(page, { usuario: DONO, gestor: false });
      const id = await criarTarefa(page, { dias: -2, unidade: "semana" });
      const data = await primeiraPendente(page, id);
      await comoUsuario(page, "Pessoa Sem Permissão");
      const res = await pular(page, id, data, "tentativa indevida");
      expect(res.ok).toBe(false);
      expect((await tarefa(page, id)).puladas).toHaveLength(0);
    });
  });

  test.describe("10.2 data no sábado ou domingo", () => {
    test("antecipar: domingo e sábado viram a sexta anterior", async ({ page }) => {
      await abrirApp(page);
      // 06/11/2026 é sexta. 06/12 é domingo; 06/02/2027 e 06/03/2027 são sábados.
      expect(await datasComAjuste(page, { ajuste: "antecipar", ano: 2026, mes: 11, dia: 6 }))
        .toEqual(["2026-11-06", "2026-12-04", "2027-01-06", "2027-02-05", "2027-03-05", "2027-04-06"]);
    });

    test("adiar: domingo vira a segunda seguinte", async ({ page }) => {
      await abrirApp(page);
      // 08/11/2026 é domingo; 08/02/2027 e 08/03/2027 já são segundas.
      expect(await datasComAjuste(page, { ajuste: "adiar", ano: 2026, mes: 11, dia: 8, quantas: 5 }))
        .toEqual(["2026-11-09", "2026-12-08", "2027-01-08", "2027-02-08", "2027-03-08"]);
    });

    test("manter: as datas ficam no sábado ou domingo", async ({ page }) => {
      await abrirApp(page);
      expect(await datasComAjuste(page, { ajuste: "manter", ano: 2026, mes: 11, dia: 8, quantas: 2 })).toEqual(["2026-11-08", "2026-12-08"]);
    });

    test("antecipar nunca leva a data para antes da data inicial: a primeira vai para a segunda", async ({ page }) => {
      await abrirApp(page);
      // 07/11/2026 é sábado: a sexta (06/11) é antes do início, então vai para segunda, 09/11.
      expect(await datasComAjuste(page, { ajuste: "antecipar", ano: 2026, mes: 11, dia: 7, quantas: 2 })).toEqual(["2026-11-09", "2026-12-07"]);
    });

    test("7 por semana com antecipar: sábado e domingo caem na sexta e valem uma vez só", async ({ page }) => {
      await abrirApp(page);
      // 09/11/2026 é segunda.
      expect(await datasComAjuste(page, { ajuste: "antecipar", vezes: 7, unidade: "semana", ano: 2026, mes: 11, dia: 9 }))
        .toEqual(["2026-11-09", "2026-11-10", "2026-11-11", "2026-11-12", "2026-11-13", "2026-11-16"]);
    });

    test("quando escolho Antecipar no formulário, então a tarefa salva com o ajuste e a prévia não mostra sábado nem domingo", async ({ page }) => {
      await abrirApp(page, { usuario: DONO, gestor: false });
      await page.click("#btnTarefas");
      await page.click("#btnIncluirTarefa");
      await page.selectOption("#fOrigem", "Obras");
      await page.fill("#fProjeto", "PRJ-2200");
      await page.fill("#fObs", "Observação da requisição");
      await page.fill("#tDescricao", "Reposição semanal");
      await page.fill("#tData", diaRelativo(1));
      await page.fill("#tHora", "09:00");
      await page.fill("#tVezes", "7");
      await page.selectOption("#tUnidade", "semana");
      await page.check("#tTerminoAuto");
      await page.selectOption("#tFimSemana", "antecipar");
      await expect(page.locator("#tPrevia")).not.toContainText("Sáb");
      await expect(page.locator("#tPrevia")).not.toContainText("Dom");
      await page.click("#modalCriar");

      const minha = await page.evaluate((dono) => JSON.parse(JSON.stringify(estadoParaTestes().tarefas.find((t) => t.dono === dono))), DONO);
      expect(minha.ajusteFimSemana).toBe("antecipar");
    });

    test("quando a tarefa é criada sem escolher o ajuste, então fica \"manter a data\"", async ({ page }) => {
      await abrirApp(page, { usuario: DONO, gestor: false });
      const id = await criarTarefa(page);
      expect((await tarefa(page, id)).ajusteFimSemana).toBe("manter");
    });
  });

  test("10.3 quando gero a requisição, então o aviso mostra o projeto e a origem usados", async ({ page }) => {
    await abrirApp(page, { usuario: DONO, gestor: false });
    const id = await criarTarefa(page, { dias: 0, hora: 23 });
    const data = await primeiraPendente(page, id);
    await page.click("#btnTarefas");
    await page.click(`#tarefasLista [data-acao="gerar"][data-id="${id}"][data-data="${data}"]`);
    const aviso = page.locator("#avisoToast");
    await expect(aviso).toContainText("PRJ-2196");
    await expect(aviso).toContainText("Shopping Rio Claro");
    await expect(aviso).toContainText("Obras");
    await expect(aviso).toContainText("Desfazer");
  });
});
