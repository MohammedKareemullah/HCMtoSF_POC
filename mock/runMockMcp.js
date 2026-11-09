// `npm run mock:mcp` - run the app WITHOUT SAP: start this, then set in .env
//   MCP_URL=http://127.0.0.1:8000/hypercare-mcp
//   MCP_JWT_SECRET=mock-secret
import { startMockMcp } from "./mockMcpServer.js";

const mock = await startMockMcp({ port: Number(process.env.MOCK_PORT ?? 8000), secret: "mock-secret" });
console.log(`Mock MCP listening at ${mock.url} (JWT secret: mock-secret)`);
