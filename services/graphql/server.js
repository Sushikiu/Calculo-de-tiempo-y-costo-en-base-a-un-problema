import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { createYoga } from 'graphql-yoga';
import { schema } from './schema.js';
import { connectDB } from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });
console.log('Ruta del .env:', path.join(__dirname, '..', '..', '.env'));
console.log('MONGO_URI cargada:', process.env.MONGO_URI ? 'sí' : 'NO - undefined');

const yoga = createYoga({
  schema,
  graphqlEndpoint: '/graphql',
  cors: { origin: '*' }
});

const server = createServer(async (req, res) => {
  if (req.url === '/' || req.url === '/index.html') {
    try {
      const html = await readFile(path.join(__dirname, 'public', 'index.html'));
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html);
    } catch {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Cliente no disponible');
    }
    return;
  }
  return yoga(req, res);
});

const PORT = process.env.PORT || 4000;

await connectDB();
server.listen(PORT, () => {
  console.log(`API GraphQL corriendo en http://localhost:${PORT}/graphql`);
  console.log(`Cliente web en http://localhost:${PORT}/`);
  console.log(`GraphiQL disponible en http://localhost:${PORT}/graphql`);
});
