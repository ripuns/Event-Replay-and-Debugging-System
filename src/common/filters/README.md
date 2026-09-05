# src/common/filters

Global exception handling — normalizes every error thrown anywhere in the app into one consistent JSON shape.

## Files

| File | Purpose | Why |
|---|---|---|
| `all-exceptions.filter.ts` | `@Catch()` filter registered globally in `main.ts` (`app.useGlobalFilters`). Maps any `HttpException` to its real status/message; anything else (unexpected runtime errors) becomes a `500` with a generic message. Always responds with `{ statusCode, message, timestamp, path }`. Any non-`HttpException` (i.e. an actual bug, not an expected 4xx) is also logged server-side via Nest's `Logger` (method, URL, stack trace) before the generic response is sent. | Callers get a predictable error envelope regardless of which layer threw (guard, DTO validation, service, unhandled bug) — matches the API design rule in `CONTEXT_SUMMARY.md` to "return predictable JSON" and avoid leaking internal structure (stack traces, raw driver errors) to clients. The server-side logging exists because, without it, an unexpected 500 is completely silent — found the hard way while debugging a `BigInt` JSON-serialization bug in the events append flow that produced no trace anywhere until logging was added. Full structured logging/observability is still Phase 8 work; this is the minimum needed so bugs aren't invisible in the meantime. |
