---
name: ecommerce-and-medusa
description: >-
  Headless e-commerce architecture, Medusa.js v2, catalog modeling, inventory management, pricing engines, cart/checkout pipelines, and order fulfillment.
  Use this skill when designing e-commerce systems, building Medusa modules/workflows, configuring product variants/options,
  implementing multi-currency pricing, securing checkout flows, or integrating payment and shipping providers.
---

# E-Commerce Architecture & Medusa.js Runbook

This skill establishes production-grade architectures, data models, workflows, and security patterns for modern headless e-commerce platforms, with deep specialization in Medusa.js v2 and general composable commerce systems.

---

## 1. Core E-Commerce Architectural Model

```
┌────────────────────────────────────────────────────────────────────────┐
│                        STOREFRONT LAYER (NEXT.JS / REACT)              │
│   (Catalog Browsing, Product Details, Cart Drawer, Checkout, Account) │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ HTTPS / REST / GraphQL
┌───────────────────────────────────▼────────────────────────────────────┐
│                    COMMERCE ENGINE & MODULES (MEDUSA.JS)               │
│  ┌─────────────────┐  ┌──────────────────┐  ┌───────────────────────┐  │
│  │ Product Catalog │  │ Pricing & Promos │  │ Inventory & Locations │  │
│  └─────────────────┘  └──────────────────┘  └───────────────────────┘  │
│  ┌─────────────────┐  ┌──────────────────┐  ┌───────────────────────┐  │
│  │ Cart & Checkout │  │ Orders & Returns │  │ Customer & Auth       │  │
│  └─────────────────┘  └──────────────────┘  └───────────────────────┘  │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
┌───────────────────────────────────▼────────────────────────────────────┐
│                  INFRASTRUCTURE & THIRD-PARTY SERVICES                 │
│   (PostgreSQL, Redis Cache/Queues, Stripe/Payment Gateways, Shipping) │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Catalog & Variant Data Modeling

### A. Products, Options, and Variants
- **Product**: Conceptual entity (e.g., `"Artisan Sourdough Loaf"`, `"Men's Merino Wool T-Shirt"`). Contains title, handle/slug, description, collection, category, and tags.
- **Product Option**: Dimension of variation (e.g., `Size`, `Color`, `Weight`, `Flavor`).
- **Product Variant**: Purchasable SKU combining options (e.g., `Size: Large + Color: Navy`). Holds distinct SKU, barcode/UPC, weight, dimensions, prices, and inventory links.

```typescript
// Example Medusa v2 / E-commerce Product Schema Model
export interface ProductVariantDTO {
  id: string;
  sku: string;
  barcode?: string;
  title: string;
  prices: Array<{
    amount: number;
    currency_code: string;
    min_quantity?: number;
    max_quantity?: number;
    price_list_id?: string;
  }>;
  options: Array<{
    option_id: string;
    value: string;
  }>;
  manage_inventory: boolean;
  allow_backorder: boolean;
  inventory_quantity?: number;
}
```

---

## 3. Inventory & Concurrency Safety

### A. Multi-Location Stock & Reservation
- Track inventory across distinct stock locations / warehouses.
- **Reservation Phase**: During checkout initiation or payment authorization, create a temporary stock reservation with an expiration TTL (e.g., 15 minutes).
- **Commit Phase**: On successful payment confirmation, commit the reservation into permanent inventory deduction.
- **Release Phase**: On payment failure or cart abandonment timeout, automatically release reserved units.

### B. Concurrency Row-Locks (`SELECT ... FOR UPDATE`)
Prevent overselling under high concurrency:
```sql
-- Atomic stock deduction with row lock
BEGIN;
SELECT quantity FROM inventory_levels 
WHERE inventory_item_id = $1 AND location_id = $2 
FOR UPDATE;

-- Check if quantity >= requested_quantity, then:
UPDATE inventory_levels 
SET quantity = quantity - $3 
WHERE inventory_item_id = $1 AND location_id = $2;
COMMIT;
```

---

## 4. Pricing Matrix & Tax Engine

1. **Multi-Currency**: Support base currency plus automated or explicit regional price lists.
2. **Tax Inclusive vs. Exclusive**:
   - European/UK/B2C models often require tax-inclusive display (`unit_price` includes VAT).
   - US/North American models require tax-exclusive display (`tax_amount` calculated at checkout based on destination postal address).
3. **Price Lists & Tier Pricing**:
   - Support customer group pricing (e.g., VIP, Wholesale B2B, Retail).
   - Support volume quantity discounts (e.g., 1–4 units: $20/ea, 5+ units: $16/ea).

---

## 5. Cart & Robust Checkout Pipeline

Follow an idempotent, state-machine checkout pipeline:

```
[ Active Cart ] 
      │ 1. Set Shipping Address & Contact
      ▼
[ Address Validated ] 
      │ 2. Select Shipping Method & Compute Freight
      ▼
[ Shipping Computed ] 
      │ 3. Compute Taxes & Apply Validated Discounts
      ▼
[ Payment Session Initialized ] 
      │ 4. Reserve Inventory Items (with TTL)
      │ 5. Authorize Payment (3D Secure / SCA)
      ▼
[ Order Placed ] 
      │ 6. Deduct Inventory & Clear Cart
      │ 7. Emit 'order.placed' Event to Queue
      ▼
[ Post-Purchase Notifications & Fulfillment Queue ]
```

### Idempotency Protection:
- All payment authorization and order placement requests **must** require an `Idempotency-Key` header.
- If a network retry occurs, return the existing order record without double-charging or duplicate inventory deduction.

---

## 6. Orders, Returns & Fulfillment Lifecycle

```
               ┌───────────────┐
               │    Pending    │
               └───────┬───────┘
                       │ Payment Authorized
                       ▼
               ┌───────────────┐
               │  Processing   ├──────────────────┐
               └───────┬───────┘                  │
                       │ Create Fulfillment       │ Cancel / Refund
                       ▼                          ▼
               ┌───────────────┐          ┌───────────────┐
               │   Shipped     │          │   Canceled    │
               └───────┬───────┘          └───────────────┘
                       │ Delivery Confirmed
                       ▼
               ┌───────────────┐
               │   Delivered   │
               └───────┬───────┘
                       │ Return Requested
                       ▼
               ┌───────────────┐
               │   Returned    │
               └───────────────┘
```

---

## 7. Production Checklist for E-Commerce Systems

- [ ] Variant SKUs, barcodes, and pricing constraints validated.
- [ ] Concurrency locks applied to prevent overselling on flash sales.
- [ ] Checkout steps protected with idempotency keys.
- [ ] Sensitive payment card data handled via client-side tokenization (Stripe Elements / SDK).
- [ ] Webhook signatures verified cryptographically for asynchronous payment confirmations.
- [ ] Structured metadata (`JSON-LD` Product and Offer schema) embedded on product detail pages.
