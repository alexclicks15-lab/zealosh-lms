---
name: clean-architecture
description: >-
  Clean Architecture, Hexagonal / Ports & Adapters, Domain-Driven Design (DDD), and SOLID design principles.
  Use this skill when designing architectural boundaries, separating domain logic from UI and infrastructure,
  defining repository interfaces, inverting dependencies, or refactoring fullstack applications.
---

# Clean Architecture & Domain-Driven Design Runbook

This skill establishes proven clean architecture patterns for modern fullstack applications (TypeScript, JavaScript, Python, Go), synthesizing principles from Clean Architecture, Hexagonal / Ports & Adapters, and Domain-Driven Design (DDD).

---

## 1. Architectural Layers & Dependency Rule

```
┌────────────────────────────────────────────────────────┐
│                   INFRASTRUCTURE LAYER                  │
│  (HTTP Frameworks, UI Components, ORM/DB Clients,     │
│   External APIs, Payment Gateways, Cache, File System)  │
└───────────────────────────┬────────────────────────────┘
                            │ depends on
┌───────────────────────────▼────────────────────────────┐
│                    APPLICATION LAYER                    │
│   (Use Cases, Application Services, DTOs, Workflows,   │
│    Repository Interfaces, Port Definitions)            │
└───────────────────────────┬────────────────────────────┘
                            │ depends on
┌───────────────────────────▼────────────────────────────┐
│                      DOMAIN LAYER                      │
│   (Pure Entities, Value Objects, Domain Services,      │
│    Business Invariants, Pure Calculation Functions)    │
└────────────────────────────────────────────────────────┘
```

> **The Fundamental Dependency Rule**: Dependencies point **inward only**. The Domain layer never imports from Application or Infrastructure (no React, no Next.js headers, no SQL drivers, no external HTTP clients). The Application layer never imports from Infrastructure directly.

---

## 2. Layer Definitions & Boundaries

### A. Domain Layer (`domain/` or `core/domain/`)
- **Purity**: Zero external runtime dependencies. Zero framework code. Pure business logic.
- **Entities**: Business objects with unique identity and lifecycle rules (e.g., `Order`, `Customer`, `Product`, `Subscription`).
- **Value Objects**: Immutable objects defined strictly by their attributes (e.g., `PostalCode`, `Money`, `EmailAddress`, `DateRange`).
- **Invariants**: Business rules enforced at instantiation (e.g., `Money.amount >= 0`, `DateRange.start <= DateRange.end`).

```typescript
// domain/value-objects/money.vo.ts
export class Money {
  private constructor(
    public readonly amount: number,
    public readonly currency: string
  ) {
    if (!Number.isFinite(amount) || amount < 0) {
      throw new Error(`Invalid money amount: ${amount}. Must be a non-negative finite number.`);
    }
    if (!currency || currency.length !== 3) {
      throw new Error(`Invalid currency code: "${currency}". Must be a 3-letter ISO code.`);
    }
  }

  public static of(amount: number, currency = 'USD'): Money {
    return new Money(Math.round(amount * 100) / 100, currency.toUpperCase());
  }

  public add(other: Money): Money {
    if (this.currency !== other.currency) {
      throw new Error(`Cannot add money in ${this.currency} to ${other.currency}`);
    }
    return new Money(this.amount + other.amount, this.currency);
  }
}
```

### B. Application Layer (`application/` or `core/use-cases/`)
- **Use Cases / Interactors**: Orchestrate domain objects to fulfill specific business operations (e.g., `CreateOrderUseCase`, `ProcessRefundUseCase`).
- **Ports / Interfaces**: Abstract contracts for secondary actors (e.g., `IOrderRepository`, `IPaymentGateway`, `INotificationService`).
- **DTOs**: Data Transfer Objects for input/output across boundaries without leaking domain entities.

```typescript
// application/ports/order-repository.port.ts
import { Order } from '../../domain/entities/order.entity';

export interface IOrderRepository {
  findById(id: string): Promise<Order | null>;
  save(order: Order): Promise<void>;
  findByCustomerId(customerId: string): Promise<Order[]>;
}
```

```typescript
// application/use-cases/create-order.use-case.ts
import { IOrderRepository } from '../ports/order-repository.port';
import { IPaymentGateway } from '../ports/payment-gateway.port';
import { Order } from '../../domain/entities/order.entity';

export interface CreateOrderInput {
  customerId: string;
  items: Array<{ productId: string; quantity: number; unitPrice: number }>;
}

export class CreateOrderUseCase {
  constructor(
    private readonly orderRepo: IOrderRepository,
    private readonly paymentGateway: IPaymentGateway
  ) {}

  async execute(input: CreateOrderInput): Promise<{ orderId: string; status: string }> {
    const order = Order.create(input.customerId, input.items);
    await this.orderRepo.save(order);
    return { orderId: order.id, status: order.status };
  }
}
```

### C. Infrastructure Layer (`infrastructure/` or `adapters/`)
- **Adapters**: Implementations of ports defined in the Application layer (e.g., `PostgresOrderRepository`, `StripePaymentAdapter`, `SendGridNotificationAdapter`).
- **Framework Drivers**: Web framework controllers, route handlers, CLI commands, ORM models.

```typescript
// infrastructure/repositories/postgres-order.repository.ts
import { IOrderRepository } from '../../application/ports/order-repository.port';
import { Order } from '../../domain/entities/order.entity';
import { DatabaseClient } from '../database/client';

export class PostgresOrderRepository implements IOrderRepository {
  constructor(private readonly db: DatabaseClient) {}

  async findById(id: string): Promise<Order | null> {
    const record = await this.db.query('SELECT * FROM orders WHERE id = $1', [id]);
    if (!record) return null;
    return Order.hydrate(record);
  }

  async save(order: Order): Promise<void> {
    await this.db.query(
      'INSERT INTO orders (id, customer_id, total, status) VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO UPDATE SET status = $4',
      [order.id, order.customerId, order.total.amount, order.status]
    );
  }

  async findByCustomerId(customerId: string): Promise<Order[]> {
    const records = await this.db.query('SELECT * FROM orders WHERE customer_id = $1', [customerId]);
    return records.map(Order.hydrate);
  }
}
```

---

## 3. Dependency Inversion Principle (DIP)

1. High-level modules (Use Cases) must not import low-level modules (DB queries, API calls). Both depend on abstractions (Ports).
2. Abstractions must not depend on details. Details depend on abstractions.
3. Use Dependency Injection (DI) containers or factory functions to compose the object graph at application startup (Composition Root).

---

## 4. Architectural Rules & Anti-Patterns

| Correct Pattern | Anti-Pattern |
| :--- | :--- |
| Use cases return DTOs or View Models | Use cases leak ORM active records or raw SQL rows to UI |
| Domain entities enforce business invariants | Anemic domain models (entities are just dumb bags of getters/setters) |
| Repositories return domain entities | Repositories leak framework-specific database schemas |
| Infrastructure implements domain/app ports | Domain imports database drivers, Next.js headers, or React hooks |
