// Testes de integração: cada teste abre a página de verdade num navegador real, com os dados de
// exemplo recém-carregados (a "base de teste"), e chama as mesmas funções que os botões usam.
// Nada é simulado além do que é externo ao app. Rodar com: npm test
const { defineConfig } = require("@playwright/test");

module.exports = defineConfig({
  testDir: "testes/integracao",
  fullyParallel: true,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://localhost:8766",
    browserName: "chromium",
  },
  // Servidor local só para os testes (porta própria, não interfere no da prévia).
  webServer: {
    command: "node testes/servidor.js 8766",
    url: "http://localhost:8766/index.html",
    reuseExistingServer: false,
  },
});
