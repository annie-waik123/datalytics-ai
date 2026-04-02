const http = require('http');

const PORT = process.env.PORT || 9000;

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    status: 'ok',
    message: 'Datalytics backend bridge running.',
  }));
});

server.listen(PORT, () => {
  console.log(`Backend bridge listening on ${PORT}`);
});
