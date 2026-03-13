import { AsyncLocalStorage } from "async_hooks";
import { NextFunction, Request, Response } from "express";
import { config } from "@/config";

type QueryMetricRecord = {
  model: string;
  action: string;
  durationMs: number;
};

type RequestMetricStore = {
  method: string;
  path: string;
  traceId: string;
  startedAt: number;
  queryCount: number;
  totalQueryDurationMs: number;
  maxQueryDurationMs: number;
  slowQueries: QueryMetricRecord[];
  responseSizeBytes: number;
};

const store = new AsyncLocalStorage<RequestMetricStore>();
const SLOW_QUERY_THRESHOLD_MS = 200;

const formatKib = (bytes: number): string => (bytes / 1024).toFixed(2);

export const recordQueryMetric = (query: QueryMetricRecord): void => {
  const current = store.getStore();
  if (!current) {
    return;
  }

  current.queryCount += 1;
  current.totalQueryDurationMs += query.durationMs;
  current.maxQueryDurationMs = Math.max(
    current.maxQueryDurationMs,
    query.durationMs
  );

  if (query.durationMs >= SLOW_QUERY_THRESHOLD_MS) {
    current.slowQueries.push(query);
  }
};

export const createRequestMetricsMiddleware = () => {
  return (req: Request, res: Response, next: NextFunction): void => {

    const metricStore: RequestMetricStore = {
      method: req.method,
      path: req.originalUrl || req.url,
      traceId: req.traceId || "no-trace-id",
      startedAt: Date.now(),
      queryCount: 0,
      totalQueryDurationMs: 0,
      maxQueryDurationMs: 0,
      slowQueries: [],
      responseSizeBytes: 0,
    };

    const originalJson = res.json.bind(res);
    res.json = ((body: unknown) => {
      try {
        metricStore.responseSizeBytes = Buffer.byteLength(
          JSON.stringify(body ?? {})
        );
      } catch {
        metricStore.responseSizeBytes = 0;
      }
      return originalJson(body);
    }) as Response["json"];

    const originalSend = res.send.bind(res);
    res.send = ((body?: unknown) => {
      if (!metricStore.responseSizeBytes) {
        if (typeof body === "string") {
          metricStore.responseSizeBytes = Buffer.byteLength(body);
        } else if (Buffer.isBuffer(body)) {
          metricStore.responseSizeBytes = body.length;
        } else if (body !== undefined && body !== null) {
          try {
            metricStore.responseSizeBytes = Buffer.byteLength(
              JSON.stringify(body)
            );
          } catch {
            metricStore.responseSizeBytes = 0;
          }
        }
      }
      return originalSend(body as any);
    }) as Response["send"];

    res.on("finish", () => {
      const durationMs = Date.now() - metricStore.startedAt;
      const sizeHeader = Number(res.getHeader("content-length") || 0);
      const responseSizeBytes = sizeHeader || metricStore.responseSizeBytes;

      const summary = {
        traceId: metricStore.traceId,
        method: metricStore.method,
        path: metricStore.path,
        statusCode: res.statusCode,
        durationMs,
        dbQueryCount: metricStore.queryCount,
        dbTotalDurationMs: Number(metricStore.totalQueryDurationMs.toFixed(2)),
        dbMaxQueryDurationMs: Number(metricStore.maxQueryDurationMs.toFixed(2)),
        responseSizeKb: Number(formatKib(responseSizeBytes)),
      };

      // In development: human-readable console output.
      // In production: structured JSON picked up by your log aggregator.
      if (config.isDevelopment) {
        console.log(`[perf] request-summary ${JSON.stringify(summary)}`);
      } else {
        // Emit as a single JSON line so log drains (Datadog, Loki, etc.) parse it.
        process.stdout.write(JSON.stringify({ level: "info", event: "request-summary", ...summary }) + "\n");
      }

      // Slow queries are always surfaced — they indicate DB problems in production too.
      if (metricStore.slowQueries.length > 0) {
        metricStore.slowQueries.forEach((query) => {
          const slowEntry = {
            traceId: metricStore.traceId,
            method: metricStore.method,
            path: metricStore.path,
            model: query.model,
            action: query.action,
            durationMs: Number(query.durationMs.toFixed(2)),
            thresholdMs: SLOW_QUERY_THRESHOLD_MS,
          };
          if (config.isDevelopment) {
            console.warn(`[perf] slow-query ${JSON.stringify(slowEntry)}`);
          } else {
            process.stdout.write(JSON.stringify({ level: "warn", event: "slow-query", ...slowEntry }) + "\n");
          }
        });
      }
    });

    store.run(metricStore, () => next());
  };
};

export const getCurrentRequestMetricStore = (): RequestMetricStore | undefined =>
  store.getStore();
