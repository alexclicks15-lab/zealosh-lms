---
name: crm-and-workflow-automation
description: >-
  CRM systems, workflow engines, event-driven automations, notifications, calendar/sheets integrations, and webhooks.
  Use this skill when building customer relationship pipelines, lead management, booking/appointment workflows,
  automated email/SMS/WhatsApp dispatchers, webhook integrations, or rule-based triggers.
---

# CRM & Workflow Automation Runbook

This skill outlines design patterns and operational procedures for customer relationship management (CRM), automation engines, and event-driven communication pipelines.

---

## 1. CRM Architecture & Pipeline Lifecycle

```
[ Customer Interaction / Lead Ingestion ]
       │
       ▼
[ Lead Scoring & Contact Enrichment ] ── Tracks interaction history, tags, VIP status
       │
       ▼
[ Lifecycle Stages ]
  ├── 1. Lead / Inquirer
  ├── 2. First-Time Buyer
  ├── 3. Repeat Customer
  ├── 4. VIP / High LTV Customer
  └── 5. At-Risk / Churned (Triggers re-engagement flow)
```

---

## 2. Event-Driven Workflow Automation Engine

Structure automations with Trigger-Condition-Action (TCA) primitives:

```typescript
export interface AutomationRule {
  id: string;
  name: string;
  trigger: 'order.placed' | 'order.delivered' | 'customer.birthday' | 'cart.abandoned';
  conditions: Array<{
    field: string;
    operator: 'equals' | 'greater_than' | 'contains' | 'in';
    value: any;
  }>;
  actions: Array<{
    type: 'send_email' | 'send_whatsapp' | 'create_task' | 'sync_calendar' | 'emit_webhook';
    params: Record<string, any>;
  }>;
}
```

### Execution Flow:
1. **Trigger Reception**: Ingest domain event into the automation dispatcher.
2. **Condition Evaluation**: Evaluate rule criteria against event context and customer record.
3. **Action Queueing**: Push concrete action tasks into background worker queues with idempotency keys.
4. **Execution & Delivery**: Worker executes third-party API dispatch (e.g., WhatsApp Business API, Twilio, SendGrid, Google Calendar).

---

## 3. Communication Channel Best Practices

- **Transactional vs Promotional**: Keep critical transactional messages (order confirmation, OTP, delivery dispatch) isolated from marketing campaigns to ensure high deliverability and low latency.
- **Opt-In & Compliance**: Respect user notification preferences and unsubscribe tokens across email, SMS, and messaging channels.
- **Rate-Limiting Third-Party APIs**: Implement client-side token bucket limiters to respect external API quotas (e.g., WhatsApp Cloud API, Google Calendar API).
- **Template Parameterization**: Use pre-approved message templates with typed variable replacement.
