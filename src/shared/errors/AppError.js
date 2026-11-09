export class AppError extends Error {
  constructor(message, { status = 500, code = "INTERNAL_ERROR", details } = {}) {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

/** Anything that goes wrong talking to the MCP server / SAP. Surfaces as 502. */
export class McpError extends AppError {
  constructor(message, opts = {}) {
    super(message, { status: 502, code: "MCP_ERROR", ...opts });
    this.name = "McpError";
  }
}

export class ValidationError extends AppError {
  constructor(message, details) {
    super(message, { status: 400, code: "VALIDATION_ERROR", details });
    this.name = "ValidationError";
  }
}
