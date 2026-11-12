// Sem internet (pedido do Erick, 12/11/2026): a pessoa de campo preenche a requisição no celular e a conexão
// cai bem na hora de criar. O que vale:
// - o formulário vira rascunho no aparelho enquanto é preenchido, e só some ao criar ou ao descartar;
// - sem internet, "Criar requisição" guarda na caixa de saída ("Aguardando envio") e envia sozinha quando a
//   conexão volta, com a mesma chave de envio (nunca duplica);
// - as outras ações precisam de internet.
// A queda de internet é a do próprio navegador (context.setOffline), o mesmo que acontece no celular.
const { test, expect, abrirApp, requisicao, idEm, op, contarRequisicoes, preencherNovaRequisicao } = require("./ajuda");

const SIMULAR = "suprimentos-demo-simular-sem-internet";

function caixa(page) {
  return page.evaluate(() => caixaDeSaida());
}
function criadaPelaObservacao(page, texto) {
  return page.evaluate((texto) => {
    const r = estadoParaTestes().requisicoes.find((x) => x.observacao === texto);
    return r ? JSON.parse(JSON.stringify(r)) : null;
  }, texto);
}
// Simulação que sobrevive a fechar e abrir o app (a mesma do 👤).
function simularSemInternet(page, ligado) {
  return page.evaluate(([k, ligado]) => { if (ligado) localStorage.setItem(k, "1"); else localStorage.removeItem(k); }, [SIMULAR, ligado]);
}
async function reabrirApp(page) {
  await page.reload();
  await expect(page.locator("#tabelaRequisicoes tr").first()).toBeVisible();
}

test.describe("17. Sem internet: rascunho e caixa de saída", () => {
  test.describe("17.1 rascunho da nova requisição", () => {
    test("quando preencho e fecho sem criar, então ao abrir de novo os campos voltam com o aviso de rascunho", async ({ page }) => {
      await abrirApp(page);
      await preencherNovaRequisicao(page, { itens: [{ descricao: "Cabo PP 3x2,5", quantidade: 50 }], observacao: "Rascunho da obra" });
      await page.click("#modalClose");
      await page.click("#btnNovaRequisicao");
      await expect(page.locator("#rascunhoAviso")).toBeVisible();
      await expect(page.locator("#rascunhoAviso")).toContainText("Rascunho");
      await expect(page.locator("#fObs")).toHaveValue("Rascunho da obra");
      await expect(page.locator("#fProjeto")).toHaveValue("PRJ-2200");
      await expect(page.locator("#fOrigem")).toHaveValue("Obras");
      await expect(page.locator("#itensLista .item-descricao").first()).toHaveValue("Cabo PP 3x2,5");
      await expect(page.locator("#itensLista .item-qtd").first()).toHaveValue("50");
    });

    test("quando o app é fechado e aberto de novo, então o rascunho continua lá", async ({ page }) => {
      await abrirApp(page);
      await preencherNovaRequisicao(page, { observacao: "Sobreviveu ao fechar" });
      await reabrirApp(page);
      await page.click("#btnNovaRequisicao");
      await expect(page.locator("#fObs")).toHaveValue("Sobreviveu ao fechar");
    });

    test("quando descarto o rascunho, então o formulário volta vazio e o rascunho não reaparece", async ({ page }) => {
      await abrirApp(page);
      await preencherNovaRequisicao(page, { observacao: "Vou descartar" });
      await page.click("#modalClose");
      await page.click("#btnNovaRequisicao");
      await page.click("#rascunhoDescartar");
      await expect(page.locator("#fObs")).toHaveValue("");
      await expect(page.locator("#rascunhoAviso")).toBeHidden();
      await page.click("#modalClose");
      await page.click("#btnNovaRequisicao");
      await expect(page.locator("#fObs")).toHaveValue("");
      await expect(page.locator("#rascunhoAviso")).toBeHidden();
    });

    test("quando crio a requisição, então o rascunho é apagado", async ({ page }) => {
      await abrirApp(page);
      await preencherNovaRequisicao(page, { observacao: "Criada de verdade" });
      await page.click("#modalCriar");
      expect(await criadaPelaObservacao(page, "Criada de verdade")).not.toBeNull();
      await page.click("#perguntaTarefaNao");
      await page.click("#reqDrawerClose");
      await page.click("#btnNovaRequisicao");
      await expect(page.locator("#fObs")).toHaveValue("");
      await expect(page.locator("#rascunhoAviso")).toBeHidden();
    });

    test("quando o rascunho tinha anexo, então o aviso pede para anexar de novo", async ({ page }) => {
      await abrirApp(page);
      await preencherNovaRequisicao(page, { observacao: "Com proposta" });
      await page.setInputFiles("#fAnexo", { name: "proposta.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4") });
      await reabrirApp(page);
      await page.click("#btnNovaRequisicao");
      await expect(page.locator("#rascunhoAviso")).toContainText("proposta.pdf");
      await expect(page.locator("#rascunhoAviso")).toContainText("anexe de novo");
    });

    test("quando edito uma requisição existente, então o rascunho da nova não aparece nem é trocado", async ({ page }) => {
      await abrirApp(page);
      await preencherNovaRequisicao(page, { observacao: "Rascunho guardado" });
      await page.click("#modalClose");
      const id = await idEm(page, "pendente");
      await page.evaluate((id) => abrirModalEdicao(id), id);
      await expect(page.locator("#rascunhoAviso")).toBeHidden();
      await page.fill("#fObs", "Texto da edição");
      await page.click("#modalClose");
      // Fechar a edição reabre o detalhe da requisição; fecha para voltar à lista.
      await page.click("#reqDrawerClose");
      await page.click("#btnNovaRequisicao");
      await expect(page.locator("#fObs")).toHaveValue("Rascunho guardado");
    });
  });

  test.describe("17.2 criar sem internet (caixa de saída)", () => {
    test("quando clico em Criar sem internet, então a requisição fica Aguardando envio e ainda não ganha número", async ({ page, context }) => {
      await abrirApp(page);
      const antes = await contarRequisicoes(page);
      await preencherNovaRequisicao(page, { itens: [{ descricao: "Disjuntor 32A", quantidade: 4 }], observacao: "Pedido sem sinal" });
      await context.setOffline(true);
      await expect(page.locator("#faixaSemInternet")).toBeVisible();
      await page.click("#modalCriar");
      await expect(page.locator("#modalBackdrop")).not.toHaveClass(/open/);
      await expect(page.locator("#avisoToast")).toContainText("guardada neste aparelho");
      await expect(page.locator("#caixaSaida")).toContainText("Aguardando envio");
      await expect(page.locator("#caixaSaida")).toContainText("Pedido sem sinal");
      expect(await contarRequisicoes(page)).toBe(antes);
      const fila = await caixa(page);
      expect(fila.length).toBe(1);
      expect(fila[0].dados.itens).toEqual([{ descricao: "Disjuntor 32A", modelo: "", quantidade: 4 }]);
    });

    test("quando a internet volta, então a requisição é enviada sozinha, ganha número e o histórico diz que foi criada sem internet", async ({ page, context }) => {
      await abrirApp(page);
      const antes = await contarRequisicoes(page);
      await preencherNovaRequisicao(page, { observacao: "Volta da internet" });
      await context.setOffline(true);
      await page.click("#modalCriar");
      await context.setOffline(false);
      await expect(page.locator("#caixaSaida")).toBeHidden();
      await expect(page.locator("#faixaSemInternet")).toBeHidden();
      const r = await criadaPelaObservacao(page, "Volta da internet");
      expect(r, "a requisição deveria ter sido enviada").not.toBeNull();
      expect(r.id).toMatch(/^RC-\d{4}$/);
      expect(r.status).toBe("pendente");
      expect(r.historico[0].motivo).toContain("Criada sem internet");
      expect(await contarRequisicoes(page)).toBe(antes + 1);
      expect(await caixa(page)).toEqual([]);
      await expect(page.locator("#avisoToast")).toContainText(r.id);
      await expect(page.locator("#tabelaRequisicoes tr", { hasText: r.id })).toHaveCount(1);
    });

    test("quando o app é fechado antes da internet voltar, então ao abrir de novo com internet a requisição é enviada", async ({ page }) => {
      await abrirApp(page);
      await simularSemInternet(page, true);
      await preencherNovaRequisicao(page, { observacao: "Fechou o app" });
      await page.click("#modalCriar");
      expect((await caixa(page)).length).toBe(1);
      await reabrirApp(page);
      expect(await criadaPelaObservacao(page, "Fechou o app"), "ainda sem internet: não envia").toBeNull();
      await expect(page.locator("#caixaSaida")).toContainText("Fechou o app");
      await simularSemInternet(page, false);
      await reabrirApp(page);
      expect(await criadaPelaObservacao(page, "Fechou o app")).not.toBeNull();
      expect(await caixa(page)).toEqual([]);
    });

    test("quando o primeiro clique chegou ao servidor sem a pessoa saber, então o reenvio da caixa de saída não duplica", async ({ page }) => {
      await abrirApp(page);
      await simularSemInternet(page, true);
      await preencherNovaRequisicao(page, { observacao: "Chegou sem saber" });
      await page.click("#modalCriar");
      const chave = (await caixa(page))[0].chave;
      await simularSemInternet(page, false);
      const antes = await contarRequisicoes(page);
      // A primeira tentativa tinha chegado: a mesma chave já está gravada.
      await page.evaluate(([chave, dados]) => opCriarRequisicao(chave, Object.assign({}, dados, { anexos: [] })), [chave, (await caixa(page))[0].dados]);
      await page.evaluate(() => sincronizarCaixaDeSaida());
      expect(await contarRequisicoes(page)).toBe(antes + 1);
      expect(await caixa(page)).toEqual([]);
    });

    test("quando dois avisos de conexão chegam ao mesmo tempo, então nasce uma requisição só", async ({ page }) => {
      await abrirApp(page);
      await simularSemInternet(page, true);
      await preencherNovaRequisicao(page, { observacao: "Dois avisos" });
      await page.click("#modalCriar");
      await simularSemInternet(page, false);
      const antes = await contarRequisicoes(page);
      await page.evaluate(() => Promise.all([1, 2].map(async () => sincronizarCaixaDeSaida())));
      expect(await contarRequisicoes(page)).toBe(antes + 1);
      expect(await caixa(page)).toEqual([]);
    });

    test("quando clico duas vezes em Criar sem internet, então fica uma só na caixa de saída", async ({ page, context }) => {
      await abrirApp(page);
      await preencherNovaRequisicao(page, { observacao: "Clique duplo sem sinal" });
      await context.setOffline(true);
      await page.dblclick("#modalCriar");
      expect((await caixa(page)).length).toBe(1);
      await context.setOffline(false);
      await expect(page.locator("#caixaSaida")).toBeHidden();
      const iguais = await page.evaluate(() => estadoParaTestes().requisicoes.filter((r) => r.observacao === "Clique duplo sem sinal").length);
      expect(iguais).toBe(1);
    });

    test("quando falta campo obrigatório sem internet, então vejo o erro e nada vai para a caixa de saída", async ({ page, context }) => {
      await abrirApp(page);
      await preencherNovaRequisicao(page, { observacao: "" });
      await context.setOffline(true);
      await page.click("#modalCriar");
      await expect(page.locator("#formErro")).toContainText("observação");
      expect(await caixa(page)).toEqual([]);
    });

    test("quando o item tem quantidade 0 sem internet, então vejo o erro e nada vai para a caixa de saída", async ({ page, context }) => {
      await abrirApp(page);
      await preencherNovaRequisicao(page, { itens: [{ descricao: "Parafuso", quantidade: 0 }], observacao: "Quantidade zero" });
      await context.setOffline(true);
      await page.click("#modalCriar");
      await expect(page.locator("#formErro")).toContainText("maior que zero");
      expect(await caixa(page)).toEqual([]);
    });

    test("quando descarto uma requisição da caixa de saída (com confirmação), então ela não é enviada", async ({ page, context }) => {
      await abrirApp(page);
      const antes = await contarRequisicoes(page);
      await preencherNovaRequisicao(page, { observacao: "Vou descartar da caixa" });
      await context.setOffline(true);
      await page.click("#modalCriar");
      const botao = page.locator('#caixaSaida [data-acao="descartar-caixa"]');
      await botao.click();
      await expect(botao).toHaveText("Confirmar descarte");
      expect((await caixa(page)).length, "um clique só não descarta").toBe(1);
      await botao.click();
      await expect(page.locator("#caixaSaida")).toBeHidden();
      await context.setOffline(false);
      expect(await contarRequisicoes(page)).toBe(antes);
      expect(await criadaPelaObservacao(page, "Vou descartar da caixa")).toBeNull();
    });

    test("quando a requisição guardada tem anexo e o app continua aberto, então ela sobe com o anexo", async ({ page, context }) => {
      await abrirApp(page);
      await preencherNovaRequisicao(page, { observacao: "Com anexo sem sinal" });
      await page.setInputFiles("#fAnexo", { name: "orcamento.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4") });
      await context.setOffline(true);
      await page.click("#modalCriar");
      await context.setOffline(false);
      await expect(page.locator("#caixaSaida")).toBeHidden();
      const r = await criadaPelaObservacao(page, "Com anexo sem sinal");
      expect(r.anexos.map((a) => a.name)).toEqual(["orcamento.pdf"]);
    });

    test("quando o app foi fechado antes do envio, então a requisição sobe sem o anexo e o histórico avisa", async ({ page }) => {
      await abrirApp(page);
      await simularSemInternet(page, true);
      await preencherNovaRequisicao(page, { observacao: "Anexo perdido" });
      await page.setInputFiles("#fAnexo", { name: "orcamento.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4") });
      await page.click("#modalCriar");
      await simularSemInternet(page, false);
      await reabrirApp(page);
      const r = await criadaPelaObservacao(page, "Anexo perdido");
      expect(r.anexos).toEqual([]);
      expect(r.historico[0].motivo).toContain("orcamento.pdf");
      expect(r.historico[0].motivo).toContain("anexe de novo");
    });
  });

  test.describe("17.3 ações que precisam de internet", () => {
    test("quando estou sem internet e tento assumir, cancelar, comentar, excluir ou duplicar, então vejo Sem internet e nada muda", async ({ page, context }) => {
      await abrirApp(page);
      const id = await idEm(page, "pendente");
      const antes = await requisicao(page, id);
      const total = await contarRequisicoes(page);
      await context.setOffline(true);
      const r = await page.evaluate((id) => {
        const v = obterRequisicao(id).versao;
        const pega = (res) => ({ ok: res.ok, erro: res.erro || "" });
        return [
          pega(opAssumirCompra(id, v, "Gestor Teste")),
          pega(opCancelar(id, v, "sem sinal")),
          pega(opComentar(id, novaChaveEnvio(), "Gestor Teste", "comentário sem sinal", [])),
          pega(opExcluirRequisicao(id, v)),
          pega(opDuplicarRequisicao(novaChaveEnvio(), id)),
        ];
      }, id);
      r.forEach((x) => { expect(x.ok).toBe(false); expect(x.erro).toContain("Sem internet"); });
      const depois = await requisicao(page, id);
      expect(depois.status).toBe(antes.status);
      expect(depois.versao).toBe(antes.versao);
      expect((depois.comentarios || []).length).toBe((antes.comentarios || []).length);
      expect(await contarRequisicoes(page)).toBe(total);
    });

    test("quando estou sem internet e mudo o status pela tela, então aparece o aviso e nada muda", async ({ page, context }) => {
      await abrirApp(page);
      const id = await idEm(page, "pendente");
      await page.evaluate((id) => abrirDrawer(id), id);
      await context.setOffline(true);
      await page.selectOption("#reqStatusSelect", "elaboracao");
      await page.click("#reqStatusSalvar");
      await page.click("#compradorConfirmar");
      await expect(page.locator("#avisoToast")).toContainText("Sem internet");
      expect((await requisicao(page, id)).status).toBe("pendente");
    });

    test("quando estou sem internet e tento gerar a requisição de uma tarefa, então é recusado e nada é criado", async ({ page, context }) => {
      await abrirApp(page);
      const tid = await page.evaluate(() => {
        const h = new Date();
        const modelo = { solicitante: "Gestor Teste", origem: "Obras", projetoNumero: "PRJ-2196", projetoNome: "", prioridade: "normal",
          observacao: "Tarefa", faturamentoDireto: false, anexos: [], itens: [] };
        return opCriarTarefa(novaChaveEnvio(), { descricao: "Tarefa sem sinal", dataInicial: new Date(h.getFullYear(), h.getMonth(), h.getDate() - 1, 9),
          vezes: 1, unidade: "mes", termino: "automatica", dataFinal: null, lembreteMin: 0, modelo }).t.id;
      });
      const total = await contarRequisicoes(page);
      await context.setOffline(true);
      const res = await page.evaluate((id) => {
        const t = obterTarefa(id);
        const r = opGerarRequisicaoDaTarefa(id, t.versao, proximaPendente(t).getTime());
        return { ok: r.ok, erro: r.erro || "" };
      }, tid);
      expect(res.ok).toBe(false);
      expect(res.erro).toContain("Sem internet");
      expect(await contarRequisicoes(page)).toBe(total);
      expect((await page.evaluate((id) => obterTarefa(id).realizacoes.length, tid))).toBe(0);
    });
  });

  test("17.4 quando marco Simular sem internet no 👤, então a faixa aparece; ao desmarcar, some e envia o que estava guardado", async ({ page }) => {
    await abrirApp(page);
    await page.click("#btnPerfilUsuario");
    await page.check("#perfilSemInternetInput");
    await expect(page.locator("#faixaSemInternet")).toBeVisible();
    await page.click("#perfilVoltar");
    await preencherNovaRequisicao(page, { observacao: "Pela simulação" });
    await page.click("#modalCriar");
    await expect(page.locator("#caixaSaida")).toContainText("Pela simulação");
    await page.click("#btnPerfilUsuario");
    await expect(page.locator("#perfilSemInternetInput")).toBeChecked();
    await page.uncheck("#perfilSemInternetInput");
    await expect(page.locator("#faixaSemInternet")).toBeHidden();
    await expect(page.locator("#caixaSaida")).toBeHidden();
    expect(await criadaPelaObservacao(page, "Pela simulação")).not.toBeNull();
  });
});
