# Changelog

## 0.2.0 — 2026-05-26

### Behavioural change

- `captureBodies` now defaults to `false`. Earlier versions sent the full
  `rawRequest` and `rawResponse` to the Cost ingestion endpoint by default.
  Existing callers using verify-downgrade should explicitly pass
  `captureBodies: true` for each route they want bodies captured on. Routes
  without that flag will continue to ship metadata only and will not appear in
  verify-downgrade samples.

### Why

The previous default contradicted public copy on cost.botzone.ai promising
metadata-only behaviour, and turned every wrapped call into a body capture
unless the caller knew to opt out. Reversing the default makes "metadata only"
literally true and limits raw-body capture to routes the caller has explicitly
flagged for the verify-downgrade replay.

### Other

- Cost server enforces 30-day (free plan) / 90-day (paid plans) automatic
  retention of `rawRequest` / `rawResponse`. Older bodies are nulled by a
  daily worker. The SDK API surface is unchanged for this; mentioned here so
  callers know what happens to captured bodies once they reach the dashboard.

## 0.1.1 — earlier

- Initial public release.
