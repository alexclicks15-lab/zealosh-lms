---
name: ai-agents-and-mcp
description: >-
  AI agent architecture, prompt engineering, tool calling, Model Context Protocol (MCP), and RAG pipelines.
  Use this skill when developing AI agent systems, building custom MCP servers/tools, designing structured prompts,
  implementing retrieval-augmented generation (RAG), or managing agent context and memory.
---

# AI Agents & Model Context Protocol (MCP) Runbook

This skill outlines engineering standards for building production-grade autonomous AI agents, tool-calling interfaces, MCP servers, and context management systems.

---

## 1. Autonomous Agent Loop Architecture

```
[ User Request / Goal ]
       │
       ▼
[ Context & Memory Injection ] ── Long-term memory, system prompt, active tools
       │
       ▼
[ Reason & Decide (LLM) ] ── Selects next tool call OR generates final answer
       │
       ├── Tool Call Request ──> Execute Tool (MCP / Sandbox) ──> Observe Output ──┐
       │                                                                           │
       └── Final Output ──> Output Validation & Safety Guardrail ──> Return to User│
                                      ▲                                            │
                                      └────────────────────────────────────────────┘
```

---

## 2. Model Context Protocol (MCP) Server Development

When creating custom MCP servers, define clear tool schemas and JSON-RPC 2.0 handlers:

```typescript
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';

const server = new Server(
  { name: 'caketohome-ops', version: '1.0.0' },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'get_daily_production_schedule',
      description: 'Fetches cake production orders scheduled for a specific delivery date',
      inputSchema: {
        type: 'object',
        properties: {
          deliveryDate: { type: 'string', description: 'ISO date string (YYYY-MM-DD)' },
          city: { type: 'string', description: 'Target delivery city filter' },
        },
        required: ['deliveryDate'],
      },
    },
  ],
}));
```

---

## 3. Prompt Engineering & Context Management

1. **Structured Directives**: Use Markdown sections (`## Role`, `## Instructions`, `## Constraints`, `## Output Schema`).
2. **Few-Shot Examples**: Include 2-3 realistic input/output pairs for complex formatting or reasoning tasks.
3. **Context Trimming**: Keep system context concise. Store reference documentation in skills or RAG stores rather than flooding the active prompt.
4. **Structured JSON Output**: Always enforce JSON schemas using Zod or response schema parameters to guarantee parseable outputs.
5. **Guardrails & Hallucination Defense**: Instruct models to explicitly state when data is unavailable rather than speculating.
