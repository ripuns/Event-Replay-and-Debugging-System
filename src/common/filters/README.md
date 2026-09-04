# src/common/filters

Global exception handling — normalizes every error thrown anywhere in the app into one consistent JSON shape.

## Files

| File | Purpose | Why |
|---|---|---|
| `all-exceptions.filter.ts` | `@Catch()` filter registered globally in `main.ts` (`app.useGlobalFilters`). Maps any `HttpException` to its real status/message; anything else (unexpected runtime errors) becomes a `500` with a generic message. Always responds with `{ statusCode, message, timestamp, path }`. | Callers get a predictable error envelope regardless of which layer threw (guard, DTO validation, service, unhandled bug) — matches the API design rule in `CONTEXT_SUMMARY.md` to "return predictable JSON" and avoid leaking internal structure (stack traces, raw driver errors) to clients. |
