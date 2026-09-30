import { createServer } from 'node:http';
import handleRequest from './app-handler.mjs';

const port = Number(process.env.PORT || 4173);
createServer(handleRequest).listen(port, () => console.log(`Mintmark running at http://localhost:${port}`));
