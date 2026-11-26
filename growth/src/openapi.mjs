const server = [{ url: "https://growth.loopkit.site" }];
const response = (description, example, schema = { type: "object" }) => ({
  description,
  content: { "application/json": { schema, example } },
});
const errors = Object.fromEntries([
  [400, "invalid_filter"], [401, "invalid_credentials"], [403, "insufficient_scope"],
  [404, "opportunity_not_found"], [409, "review_conflict"], [429, "rate_limit"], [503, "service_unavailable"],
].map(([status, code]) => [status, response(code, { error: code }, { $ref: "#/components/schemas/Error" })]));
const errorSchema = { type: "object", required: ["error"], properties: { error: { type: "string" } } };
const errorResponses = (...statuses) => Object.fromEntries(statuses.map((status) => [status, errors[status]]));
const op = (summary, scope, responses, parameters) => ({
  summary, ...(scope ? { "x-required-scope": scope } : {}), responses,
  ...(parameters ? { parameters } : {}),
});
const pathId = [{ name: "id", in: "path", required: true, schema: { type: "string", pattern: "^[a-f0-9]{24}$" } }];
const pageFilters = [
  { name: "status", in: "query", schema: { type: "string", enum: ["all", "new", "approved", "dismissed", "archived"] } },
  { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 50, default: 20 } },
  { name: "cursor", in: "query", schema: { type: "string", pattern: "^\\d{13}:[a-f0-9]{24}$" } },
];
const page = response("Opportunity page", { items: [], next_cursor: null }, {
  type: "object", required: ["items", "next_cursor"], properties: {
    items: { type: "array", items: { $ref: "#/components/schemas/Opportunity" } },
    next_cursor: { type: ["string", "null"] },
  },
});
const statuses = (action) => ({
  200: response("Review state recorded", { id: "0053cca1ddb2859a4bb73e62", status: action }),
  ...errorResponses(401, 403, 404, 409, 429, 503),
});

export const growthOpenApi = {
  openapi: "3.1.0",
  info: { title: "LoopKit Growth API for Meta Muse", version: "1.0.0", description: "Private API. Up to 60 requests per minute per Cloudflare location and IP, 600 daily per credential, 1,200 daily across credentials, and eight manual scans daily shared by API and dashboard. Approvals record review decisions." },
  servers: server,
  security: [{ MetaMuseToken: [] }],
  components: {
    securitySchemes: { MetaMuseToken: { type: "http", scheme: "bearer", bearerFormat: "id.secret" } },
    schemas: {
      Error: errorSchema,
      Opportunity: {
        type: "object",
        required: ["id", "source", "original_url", "title", "problem", "tool_slug", "tool", "score", "draft", "published_at", "discovered_at", "high_intent", "status", "reviewed_at"],
        properties: {
          id: { type: "string" }, source: { type: "string" }, original_url: { type: "string", format: "uri" },
          title: { type: "string" }, problem: { type: "string" }, tool_slug: { type: "string" }, tool: { type: "string" },
          score: { type: "integer", minimum: 0, maximum: 100 }, draft: { type: "string" },
          published_at: { type: "string", format: "date-time" }, discovered_at: { type: "string", format: "date-time" },
          high_intent: { type: "boolean" }, status: { type: "string", enum: ["new", "approved", "dismissed", "archived"] },
          reviewed_at: { type: ["string", "null"], format: "date-time" },
        },
      },
    },
  },
  paths: {
    "/api/growth/status": { get: op("Read automation and source status", "read", {
      200: response("Automation status", { automation_enabled: true, interval_minutes: 15, running: false, launched_at: null,
        launch_mode: false, last_successful_scan: null, last_scan: null, counts: {total: 0, pending: 0, high_intent: 0},
        manual_scans: {used: 0, limit: 8}, sources: [] }),
      ...errorResponses(401, 403, 429, 503),
    }) },
    "/api/growth/opportunities": { get: op("List opportunities", "read", { 200: page, ...errorResponses(400, 401, 403, 429, 503) }, pageFilters) },
    "/api/growth/opportunities/high-intent": { get: op("List opportunities scoring 78+ published in the last 48 hours", "read", { 200: page, ...errorResponses(400, 401, 403, 429, 503) }, pageFilters) },
    "/api/growth/report": { get: op("Read the latest 12-hour report snapshot", "read", {
      200: response("Report may be null until the first scan", { report: null }), ...errorResponses(401, 403, 429, 503),
    }) },
    "/api/growth/scan": { post: op("Queue one discovery batch and return its identifier", "scan", {
      202: response("Scan queued", { status: "started", scan_id: "a942a2a2-c545-4ae8-8f26-fce04d05b5ca" }),
      ...errorResponses(401, 403, 429, 503), 409: response("Scan busy or disabled", { status: "busy" }),
    }) },
    ...Object.fromEntries(Object.entries({ approve: "approved", dismiss: "dismissed", archive: "archived" }).map(([action, state]) =>
      ["/api/growth/opportunities/{id}/" + action, { post: op("Mark opportunity " + state, "review", statuses(state), pathId) }])),
  },
};

const numeric = (name, minimum, maximum) => ({ name, in: "query", required: true, schema: { type: "integer", minimum, maximum } });
export const publicOpenApi = {
  openapi: "3.1.0",
  info: { title: "LoopKit Public Tools API", version: "1.0.0", description: "Use numeric parameters. Up to 20 requests per minute per edge location and client IP, and 1,500 shared UTC daily." },
  servers: server,
  components: { schemas: { Error: errorSchema } },
  paths: {
    "/api/v1/discord-timestamp": { get: op("Create all nine Discord timestamp formats", null, {
      200: response("Formatted Discord timestamps", { unix: 1735689600, formats: { t: "<t:1735689600:t>", T: "<t:1735689600:T>", d: "<t:1735689600:d>", D: "<t:1735689600:D>", f: "<t:1735689600:f>", F: "<t:1735689600:F>", s: "<t:1735689600:s>", S: "<t:1735689600:S>", R: "<t:1735689600:R>" } }),
      ...errorResponses(400, 429, 503),
    }, [numeric("unix", 0, 4102444800)]) },
    "/api/v1/random-teams": { get: op("Split numbered slots into random, size-balanced teams", null, {
      200: response("Teams by slot number", { teams: [[1, 4], [3, 2]] }), ...errorResponses(400, 429, 503),
    }, [numeric("players", 2, 64), numeric("teams", 2, 32)]) },
  },
};
