---
name: nodejs-backend-architecture
description: >-
  Node.js runtime internals, Event Loop optimization, Fastify/Express/NestJS servers, Stream processing, and Worker Threads.
  Use this skill when building scalable Node.js backend services, optimizing event-loop latency, processing large streams,
  implementing graceful shutdown, or configuring NestJS/Fastify applications.
---

# Node.js Backend Architecture & Runtime Optimization Runbook

This skill establishes server-side Node.js engineering standards, Event Loop performance optimization, memory-safe stream pipelines, and robust lifecycle management.

---

## 1. Node.js Event Loop Architecture

```
┌────────────────────────────────────────────────────────┐
│                      MICROTASK QUEUE                   │
│   (process.nextTick() -> Promises / queueMicrotask())  │
│   * Executed immediately after every synchronous tick  │
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│                    EVENT LOOP PHASES                   │
│  1. Timers: setTimeout(), setInterval() callbacks      │
│  2. Pending Callbacks: Deferred I/O callbacks          │
│  3. Idle / Prepare: Internal libuv processing          │
│  4. Poll: Retrieve new I/O events, execute handlers    │
│  5. Check: setImmediate() callbacks                    │
│  6. Close Callbacks: socket.on('close')                │
└────────────────────────────────────────────────────────┘
```

> **Golden Rule of Node.js**: **Never Block the Event Loop.** Offload CPU-heavy tasks (cryptography, image compression, large JSON parsing) to Worker Threads or native add-ons.

---

## 2. Memory-Safe Stream Processing & Backpressure

Always use `stream.pipeline` (or `pipeline` from `node:stream/promises`) instead of raw `.pipe()` to prevent memory leaks on error:

```typescript
import { pipeline } from 'node:stream/promises';
import { createReadStream, createWriteStream } from 'node:fs';
import { createGzip } from 'node:zlib';
import { Transform } from 'node:stream';

export async function compressLargeFile(sourcePath: string, destPath: string): Promise<void> {
  const upperCaseTransformer = new Transform({
    transform(chunk, encoding, callback) {
      this.push(chunk.toString().toUpperCase());
      callback();
    },
  });

  await pipeline(
    createReadStream(sourcePath),
    upperCaseTransformer,
    createGzip(),
    createWriteStream(destPath)
  );
}
```

---

## 3. High-Performance Web Frameworks (Fastify / NestJS)

### A. Fastify Route Optimization with JSON Schemas
```typescript
import Fastify from 'fastify';

const fastify = Fastify({ logger: true });

const userResponseSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    email: { type: 'string' },
    role: { type: 'string' },
  },
  required: ['id', 'email', 'role'],
};

fastify.get('/api/users/:id', {
  schema: {
    params: {
      type: 'object',
      properties: { id: { type: 'string', format: 'uuid' } },
      required: ['id'],
    },
    response: {
      200: userResponseSchema,
    },
  },
  handler: async (req, reply) => {
    const { id } = req.params as { id: string };
    const user = await findUserById(id);
    return user; // Fast-json-stringify compiles schema for 2x faster serialization
  },
});
```

---

## 4. Graceful Shutdown & Process Lifecycle

Prevent dropped in-flight requests during rolling deployments:

```typescript
import http from 'node:http';

export function setupGracefulShutdown(server: http.Server, cleanupTasks: Array<() => Promise<void>>) {
  const shutdown = async (signal: string) => {
    console.log(`\nReceived ${signal}. Starting graceful shutdown...`);

    // 1. Stop accepting new connections
    server.close(async () => {
      console.log('HTTP server closed.');

      // 2. Run cleanup tasks (close DB pools, drain queues, flush logs)
      try {
        await Promise.all(cleanupTasks.map(task => task()));
        console.log('All cleanup tasks completed successfully.');
        process.exit(0);
      } catch (err) {
        console.error('Error during cleanup:', err);
        process.exit(1);
      }
    });

    // 3. Force exit if cleanup takes longer than timeout
    setTimeout(() => {
      console.error('Graceful shutdown timed out. Forcing termination.');
      process.exit(1);
    }, 10000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}
```

---

## 5. Node.js Production Checklist

- [ ] `node_env=production` set for optimal performance and disabled dev assertions.
- [ ] Process monitors or clustering (PM2 / Kubernetes replica pods) configured.
- [ ] Streams utilized for all I/O operations handling data larger than 10MB.
- [ ] Proper error handlers attached to `unhandledRejection` and `uncaughtException`.
- [ ] Secrets and configs loaded from environment variables, not hardcoded strings.
