const http = require("node:http");

const port = process.env.PORT;

if (port) {
  const server = http.createServer((request, response) => {
    if (request.url === "/health") {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(
        JSON.stringify({
          ok: true,
          service: "politie-rapoarte-bot"
        })
      );
      return;
    }

    response.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
    response.end("Politie Rapoarte Bot este pornit.");
  });

  server.listen(Number(port), "::", () => {
    console.log(`Railway health server pornit pe portul ${port}`);
  });
}
