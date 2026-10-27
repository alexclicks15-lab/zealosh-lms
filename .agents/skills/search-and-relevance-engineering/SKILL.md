---
name: search-and-relevance-engineering
description: >-
  Search engines, PostgreSQL full-text search (tsvector/GIN), BM25 ranking, typo tolerance, autocomplete typeahead, and vector hybrid search.
  Use this skill when designing search architectures, optimizing query relevance, implementing fast autocomplete,
  configuring Meilisearch/Elasticsearch/Algolia, or building PostgreSQL trigram and vector search pipelines.
---

# Search Architecture & Relevance Engineering Runbook

This skill establishes search indexing strategies, relevance ranking algorithms, query normalization, typo tolerance, and fast autocomplete architectures.

---

## 1. Search Technology Matrix

| Engine | Ideal Workload | Query Latency | Index Overhead |
| :--- | :--- | :--- | :--- |
| **PostgreSQL (`tsvector` + GIN)** | Built-in full-text search up to 1M documents | 5ms – 25ms | Low (in-database) |
| **PostgreSQL (`pg_trgm`)** | Fuzzy matching, substring search, typo tolerance | 10ms – 40ms | Moderate (trigram index) |
| **PostgreSQL (`pgvector`)** | Semantic vector search, RAG, hybrid similarity | 15ms – 50ms | Moderate (HNSW index) |
| **Meilisearch** | Instant typo-tolerant search, storefronts, catalog | < 10ms | Dedicated memory index |
| **Elasticsearch / OpenSearch** | Complex multi-tenant log analytics, large-scale search | 10ms – 50ms | High (JVM / cluster) |

---

## 2. PostgreSQL Full-Text Search with Weighted Relevance

Create a generated `tsvector` column with field weights (`'A'` = high priority, `'B'` = medium, `'C'` = standard):

```sql
-- 1. Add generated search vector column
ALTER TABLE products 
ADD COLUMN search_vector tsvector 
GENERATED ALWAYS AS (
  setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
  setweight(to_tsvector('english', coalesce(sku, '')), 'A') ||
  setweight(to_tsvector('english', coalesce(category, '')), 'B') ||
  setweight(to_tsvector('english', coalesce(description, '')), 'C')
) STORED;

-- 2. Create GIN index for rapid lookup
CREATE INDEX idx_products_search_vector ON products USING GIN (search_vector);

-- 3. Execute weighted rank search with prefix matching
SELECT 
  id, 
  title, 
  price,
  ts_rank_cd(search_vector, query) AS rank_score
FROM products, 
     to_tsquery('english', 'sourdough:* & organic:*') query
WHERE search_vector @@ query
ORDER BY rank_score DESC, created_at DESC
LIMIT 20;
```

---

## 3. Typo Tolerance & Trigram Similarity (`pg_trgm`)

Handle misspellings gracefully (e.g., `"choclate"` $\to$ `"chocolate"`):

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Create GIN trigram index on title
CREATE INDEX idx_products_title_trgm ON products USING gin (title gin_trgm_ops);

-- Query with similarity score threshold
SELECT 
  id, 
  title, 
  similarity(title, 'choclate cake') AS sim_score
FROM products
WHERE title % 'choclate cake' OR similarity(title, 'choclate cake') > 0.3
ORDER BY sim_score DESC
LIMIT 10;
```

---

## 4. High-Speed Autocomplete / Typeahead Pipeline

```typescript
// services/search.service.ts
import { db } from '@/lib/db';

export interface SearchSuggestion {
  text: string;
  category: string;
  url: string;
}

export async function getSearchSuggestions(rawQuery: string): Promise<SearchSuggestion[]> {
  const query = rawQuery.trim().toLowerCase();
  if (query.length < 2) return [];

  // Prefix matching query with fast limit
  const results = await db.query(
    `SELECT title, handle, category 
     FROM products 
     WHERE title ILIKE $1 
     ORDER BY popularity_score DESC 
     LIMIT 8`,
    [`${query}%`]
  );

  return results.map(row => ({
    text: row.title,
    category: row.category,
    url: `/products/${row.handle}`,
  }));
}
```

---

## 5. Search Quality Checklist

- [ ] Multi-word search terms combined with `&` (AND) by default for precision, with fallback to `|` (OR) if zero results.
- [ ] Field boosting applied so exact title/SKU matches outrank deep description matches.
- [ ] Typo tolerance / fuzzy matching activated for queries yielding low lexical matches.
- [ ] Facet counts (categories, price ranges, ratings) returned in parallel with search results.
- [ ] Zero-result queries logged to analytics to identify catalog gaps and missing synonyms.
