// Servidor de arquivos mínimo para os testes (sem dependências). Serve a pasta do projeto.
const http = require("http");
const fs = require("fs");
const path = require("path");

const raiz = path.resolve(__dirname, "..");
const porta = Number(process.argv[2]) || 8766;
const tipos = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json" };

http.createServer((req, res) => {
  const caminho = decodeURIComponent(req.url.split("?")[0]);
  const arquivo = path.join(raiz, caminho === "/" ? "index.html" : caminho);
  if (!arquivo.startsWith(raiz)) { res.writeHead(403); return res.end(); }
  fs.readFile(arquivo, (erro, conteudo) => {
    if (erro) { res.writeHead(404); return res.end("não encontrado"); }
    res.writeHead(200, { "Content-Type": tipos[path.extname(arquivo)] || "application/octet-stream" });
    res.end(conteudo);
  });
}).listen(porta, () => console.log(`Servidor de testes em http://localhost:${porta}`));
