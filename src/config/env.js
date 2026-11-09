import "dotenv/config";

const str = (name, def) => {
  const v = process.env[name];
  return v !== undefined && v !== "" ? v : def;
};

const num = (name, def) => {
  const v = Number(str(name, String(def)));
  if (!Number.isFinite(v)) throw new Error(`Env ${name} must be a number`);
  return v;
};

const list = (name, def = "") =>
  str(name, def)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

function dbConfig() {
  const ssl = str("PGSSL", "false") === "true" ? { rejectUnauthorized: false } : false;
  const adminDatabase = str("PG_ADMIN_DATABASE", "postgres");
  const url = process.env.DATABASE_URL;

  if (url) {
    const u = new URL(url);
    return {
      host: u.hostname,
      port: Number(u.port || 5432),
      user: decodeURIComponent(u.username),
      password: decodeURIComponent(u.password),
      database: u.pathname.replace(/^\//, ""),
      ssl,
      adminDatabase,
    };
  }
  return {
    host: str("PGHOST", "localhost"),
    port: num("PGPORT", 5432),
    user: str("PGUSER", "postgres"),
    password: str("PGPASSWORD", ""),
    database: str("PGDATABASE", "hr_kpi"),
    ssl,
    adminDatabase,
  };
}

function sapConfig() {
  const sap = {
    ashost: str("SAP_ASHOST", "127.0.0.1"),
    sysnr: str("SAP_SYSNR", "00"),
    client: str("SAP_CLIENT", "100"),
    user: str("SAP_USER", "PLACEHOLDER_USER"),
    passwd: str("SAP_PASSWD", "PLACEHOLDER_PASSWD"),
    lang: str("SAP_LANG", "EN"),
  };
  const httpBaseUrl = process.env.SAP_HTTP_BASE_URL;
  if (httpBaseUrl) {
    sap.http = {
      baseUrl: httpBaseUrl,
      client: str("SAP_HTTP_CLIENT", sap.client),
      user: str("SAP_HTTP_USER", sap.user),
      passwd: str("SAP_HTTP_PASSWD", sap.passwd),
    };
  }
  return sap;
}

export const env = {
  nodeEnv: str("NODE_ENV", "development"),
  port: num("PORT", 4000),
  corsOrigin: str("CORS_ORIGIN", "*"),

  mcp: {
    url: str("MCP_URL", "https://localhost:8000/hypercare-mcp"),
    jwtSecret: str("MCP_JWT_SECRET", "placeholder-secret-change-me"),
    tokenTtlSeconds: num("MCP_TOKEN_TTL_SECONDS", 3600),
    timeoutMs: num("MCP_TIMEOUT_MS", 180000),
  },
  sap: sapConfig(),
  db: dbConfig(),

  sync: {
    pageSize: num("SAP_PAGE_SIZE", 5000),
    maxPages: num("SAP_MAX_PAGES", 2000),
    concurrency: num("SAP_FETCH_CONCURRENCY", 2),
    retryCooldownMs: num("SYNC_RETRY_COOLDOWN_MS", 60000),
  },

  headcount: {
    hireMassnCodes: list("HIRE_MASSN_CODES", "01"),
    payrollSrtzaFilter: list("PAYROLL_SRTZA_FILTER", ""),
  },
};
