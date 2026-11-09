// Zealosh LMS — Commercial Product & Offering Service
// Decouples academic courses from commercial sellable products and packages
// File: src/lib/commerce/product-service.ts

import {
  Product,
  ProductStatus,
  ProductOffering,
  OfferingType,
  OfferingStatus,
  EntitlementFeatureScope,
} from '@/types';
import { supabaseAdapter } from '@/lib/store/supabase-adapter';
import { db } from '@/lib/store/db';

// In-memory registry for development / test isolation
const inMemoryProducts = new Map<string, Product>();
const inMemoryOfferings = new Map<string, ProductOffering>();

let initialized = false;

function ensureDefaultSeed() {
  if (initialized) return;
  initialized = true;

  if (inMemoryProducts.size === 0) {
    const defaultProducts: Product[] = [
      {
        id: 'prod-asp',
        courseId: 'crs-asp-01',
        name: 'Associate Safety Professional (ASP) Exam Prep',
        slug: 'asp-prep',
        description: 'Comprehensive ASP preparation program with expert faculty and high-fidelity exam engine.',
        status: 'PUBLISHED',
        createdAt: '2026-10-23T00:00:00.000Z',
        updatedAt: '2026-10-23T00:00:00.000Z',
      },
      {
        id: 'prod-csp',
        courseId: 'crs-csp-01',
        name: 'Certified Safety Professional (CSP) Exam Prep',
        slug: 'csp-prep',
        description: 'Advanced CSP prep including risk management, industrial hygiene, and ergonomics.',
        status: 'PUBLISHED',
        createdAt: '2026-10-23T00:00:00.000Z',
        updatedAt: '2026-10-23T00:00:00.000Z',
      },
      {
        id: 'prod-crsp',
        courseId: 'crs-crsp-01',
        name: 'Canadian Registered Safety Professional (CRSP)',
        slug: 'crsp-prep',
        description: 'Canadian HSE legislation and standards preparation program.',
        status: 'PUBLISHED',
        createdAt: '2026-10-23T00:00:00.000Z',
        updatedAt: '2026-10-23T00:00:00.000Z',
      },
    ];

    for (const p of defaultProducts) {
      inMemoryProducts.set(p.id, p);
    }

    const defaultOfferings: ProductOffering[] = [
      {
        id: 'offering-asp-complete',
        productId: 'prod-asp',
        courseId: 'crs-asp-01',
        title: 'ASP Complete Certification Package',
        offeringType: 'COMPLETE',
        priceInr: 28000,
        priceUsd: 399,
        currency: 'INR',
        validityDays: 365,
        status: 'PUBLISHED',
        includedEntitlements: ['ALL'],
        requiresAdmissionReview: false,
        featuresList: [
          'Live Interactive Weekend Classes',
          'Full Video Lesson Archive',
          'Downloadable Reference Documents',
          '1,500+ Question Bank & Explanations',
          '10 High-Stakes Proctored Mock Exams',
          'Dedicated Faculty Doubt Clearance',
        ],
        createdAt: '2026-10-23T00:00:00.000Z',
        updatedAt: '2026-10-23T00:00:00.000Z',
      },
      {
        id: 'offering-asp-video',
        productId: 'prod-asp',
        courseId: 'crs-asp-01',
        title: 'ASP Recorded Theory & Lessons Only',
        offeringType: 'VIDEO_ONLY',
        priceInr: 16000,
        priceUsd: 220,
        currency: 'INR',
        validityDays: 180,
        status: 'PUBLISHED',
        includedEntitlements: ['VIDEO_LESSONS'],
        requiresAdmissionReview: false,
        featuresList: [
          'Complete Video Lesson Archive',
          'Module Progress Tracking',
          'Stream on Any Device',
        ],
        createdAt: '2026-10-23T00:00:00.000Z',
        updatedAt: '2026-10-23T00:00:00.000Z',
      },
      {
        id: 'offering-asp-qbank',
        productId: 'prod-asp',
        courseId: 'crs-asp-01',
        title: 'ASP High-Stakes Question Bank & Mocks Only',
        offeringType: 'QUESTION_BANK_ONLY',
        priceInr: 9500,
        priceUsd: 130,
        currency: 'INR',
        validityDays: 120,
        status: 'PUBLISHED',
        includedEntitlements: ['QUESTION_BANK', 'MOCK_EXAMS'],
        requiresAdmissionReview: false,
        featuresList: [
          '1,500+ Domain Questions',
          'Detailed Answer Rationale',
          '10 Timed Mock Exams',
          'Competency Diagnostics',
        ],
        createdAt: '2026-10-23T00:00:00.000Z',
        updatedAt: '2026-10-23T00:00:00.000Z',
      },
      {
        id: 'offering-csp-complete',
        productId: 'prod-csp',
        courseId: 'crs-csp-01',
        title: 'CSP Complete Certification Package',
        offeringType: 'COMPLETE',
        priceInr: 32000,
        priceUsd: 450,
        currency: 'INR',
        validityDays: 365,
        status: 'PUBLISHED',
        includedEntitlements: ['ALL'],
        requiresAdmissionReview: false,
        featuresList: [
          'Live Weekend Workshops',
          'Comprehensive CSP Video Modules',
          'Downloadable Reference Handbook',
          '2,000+ Question Bank',
          '12 Full-Length Mock Exams',
        ],
        createdAt: '2026-10-23T00:00:00.000Z',
        updatedAt: '2026-10-23T00:00:00.000Z',
      },
    ];

    for (const off of defaultOfferings) {
      inMemoryOfferings.set(off.id, off);
    }
  }
}

export class ProductService {
  /**
   * Reset store (useful for clean unit tests)
   */
  public static resetForTesting() {
    inMemoryProducts.clear();
    inMemoryOfferings.clear();
    initialized = false;
    ensureDefaultSeed();
  }

  // --------------------------------------------------------------------------
  // Product Operations
  // --------------------------------------------------------------------------

  public static async getProducts(filter?: {
    courseId?: string;
    status?: ProductStatus;
  }): Promise<Product[]> {
    ensureDefaultSeed();

    // Check Supabase if live
    const client = db.getStorageMode() === 'supabase' ? supabaseAdapter.getClient() : null;
    if (client) {
      try {
        let query = client.from('products').select('*');
        if (filter?.courseId) query = query.eq('course_id', filter.courseId);
        if (filter?.status) query = query.eq('status', filter.status);
        const { data, error } = await query;
        if (!error && data && data.length > 0) {
          return data.map((d: any) => ({
            id: d.id,
            courseId: d.course_id,
            name: d.name,
            slug: d.slug,
            description: d.description || '',
            status: d.status,
            createdAt: d.created_at,
            updatedAt: d.updated_at,
          }));
        }
      } catch {
        // Fallback to in-memory
      }
    }

    let list = Array.from(inMemoryProducts.values());
    if (filter?.courseId) {
      list = list.filter((p) => p.courseId === filter.courseId);
    }
    if (filter?.status) {
      list = list.filter((p) => p.status === filter.status);
    }
    return list;
  }

  public static async getProductById(id: string): Promise<Product | null> {
    ensureDefaultSeed();

    const client = db.getStorageMode() === 'supabase' ? supabaseAdapter.getClient() : null;
    if (client) {
      try {
        const { data, error } = await client.from('products').select('*').eq('id', id).maybeSingle();
        if (!error && data) {
          return {
            id: data.id,
            courseId: data.course_id,
            name: data.name,
            slug: data.slug,
            description: data.description || '',
            status: data.status,
            createdAt: data.created_at,
            updatedAt: data.updated_at,
          };
        }
      } catch {
        // Fallback
      }
    }

    return inMemoryProducts.get(id) || null;
  }

  public static async getProductBySlug(slug: string): Promise<Product | null> {
    ensureDefaultSeed();

    const client = db.getStorageMode() === 'supabase' ? supabaseAdapter.getClient() : null;
    if (client) {
      try {
        const { data, error } = await client.from('products').select('*').eq('slug', slug).maybeSingle();
        if (!error && data) {
          return {
            id: data.id,
            courseId: data.course_id,
            name: data.name,
            slug: data.slug,
            description: data.description || '',
            status: data.status,
            createdAt: data.created_at,
            updatedAt: data.updated_at,
          };
        }
      } catch {
        // Fallback
      }
    }

    return Array.from(inMemoryProducts.values()).find((p) => p.slug === slug) || null;
  }

  public static async createProduct(params: {
    courseId: string;
    name: string;
    slug: string;
    description?: string;
    status?: ProductStatus;
  }): Promise<Product> {
    ensureDefaultSeed();

    if (!params.courseId || !params.name || !params.slug) {
      throw new Error('Course ID, name, and slug are required');
    }

    const existing = Array.from(inMemoryProducts.values()).find((p) => p.slug === params.slug);
    if (existing) {
      throw new Error(`Product with slug '${params.slug}' already exists`);
    }

    const now = new Date().toISOString();
    const product: Product = {
      id: `prod-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
      courseId: params.courseId,
      name: params.name.trim(),
      slug: params.slug.trim().toLowerCase(),
      description: params.description || '',
      status: params.status || 'DRAFT',
      createdAt: now,
      updatedAt: now,
    };

    inMemoryProducts.set(product.id, product);

    const client = db.getStorageMode() === 'supabase' ? supabaseAdapter.getClient() : null;
    if (client) {
      try {
        await client.from('products').insert({
          id: product.id,
          course_id: product.courseId,
          name: product.name,
          slug: product.slug,
          description: product.description,
          status: product.status,
          created_at: product.createdAt,
          updated_at: product.updatedAt,
        });
      } catch {
        // Fallback
      }
    }

    return product;
  }

  public static async updateProduct(
    id: string,
    updates: Partial<Omit<Product, 'id' | 'createdAt'>>
  ): Promise<Product> {
    ensureDefaultSeed();

    const product = inMemoryProducts.get(id);
    if (!product) {
      throw new Error(`Product ${id} not found`);
    }

    if (updates.slug && updates.slug !== product.slug) {
      const existing = Array.from(inMemoryProducts.values()).find(
        (p) => p.slug === updates.slug && p.id !== id
      );
      if (existing) {
        throw new Error(`Product with slug '${updates.slug}' already exists`);
      }
    }

    const updated: Product = {
      ...product,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    inMemoryProducts.set(id, updated);

    const client = db.getStorageMode() === 'supabase' ? supabaseAdapter.getClient() : null;
    if (client) {
      try {
        await client
          .from('products')
          .update({
            name: updated.name,
            slug: updated.slug,
            description: updated.description,
            status: updated.status,
            updated_at: updated.updatedAt,
          })
          .eq('id', id);
      } catch {
        // Fallback
      }
    }

    return updated;
  }

  // --------------------------------------------------------------------------
  // Offering Operations
  // --------------------------------------------------------------------------

  public static async getOfferings(filter?: {
    productId?: string;
    courseId?: string;
    status?: OfferingStatus;
  }): Promise<ProductOffering[]> {
    ensureDefaultSeed();

    const client = db.getStorageMode() === 'supabase' ? supabaseAdapter.getClient() : null;
    if (client) {
      try {
        let query = client.from('product_offerings').select('*');
        if (filter?.productId) query = query.eq('product_id', filter.productId);
        if (filter?.courseId) query = query.eq('course_id', filter.courseId);
        if (filter?.status) query = query.eq('status', filter.status);
        const { data, error } = await query;
        if (!error && data && data.length > 0) {
          return data.map((d: any) => ({
            id: d.id,
            productId: d.product_id,
            courseId: d.course_id,
            title: d.title,
            offeringType: d.offering_type,
            priceInr: Number(d.price_inr),
            priceUsd: d.price_usd ? Number(d.price_usd) : undefined,
            currency: d.currency || 'INR',
            validityDays: d.validity_days,
            status: d.status,
            includedEntitlements: d.included_entitlements || ['ALL'],
            requiresAdmissionReview: Boolean(d.requires_admission_review),
            featuresList: d.features_list || [],
            metadata: d.metadata || {},
            createdAt: d.created_at,
            updatedAt: d.updated_at,
          }));
        }
      } catch {
        // Fallback
      }
    }

    let list = Array.from(inMemoryOfferings.values());
    if (filter?.productId) {
      list = list.filter((o) => o.productId === filter.productId);
    }
    if (filter?.courseId) {
      list = list.filter((o) => o.courseId === filter.courseId);
    }
    if (filter?.status) {
      list = list.filter((o) => o.status === filter.status);
    }
    return list;
  }

  public static async getOfferingById(id: string): Promise<ProductOffering | null> {
    ensureDefaultSeed();

    const client = db.getStorageMode() === 'supabase' ? supabaseAdapter.getClient() : null;
    if (client) {
      try {
        const { data, error } = await client
          .from('product_offerings')
          .select('*')
          .eq('id', id)
          .maybeSingle();
        if (!error && data) {
          return {
            id: data.id,
            productId: data.product_id,
            courseId: data.course_id,
            title: data.title,
            offeringType: data.offering_type,
            priceInr: Number(data.price_inr),
            priceUsd: data.price_usd ? Number(data.price_usd) : undefined,
            currency: data.currency || 'INR',
            validityDays: data.validity_days,
            status: data.status,
            includedEntitlements: data.included_entitlements || ['ALL'],
            requiresAdmissionReview: Boolean(data.requires_admission_review),
            featuresList: data.features_list || [],
            metadata: data.metadata || {},
            createdAt: data.created_at,
            updatedAt: data.updated_at,
          };
        }
      } catch {
        // Fallback
      }
    }

    return inMemoryOfferings.get(id) || null;
  }

  public static async createOffering(params: {
    productId: string;
    courseId?: string;
    title: string;
    offeringType: OfferingType;
    priceInr: number;
    priceUsd?: number;
    currency?: 'INR' | 'USD';
    validityDays?: number;
    status?: OfferingStatus;
    includedEntitlements?: EntitlementFeatureScope[];
    requiresAdmissionReview?: boolean;
    featuresList?: string[];
    metadata?: Record<string, any>;
  }): Promise<ProductOffering> {
    ensureDefaultSeed();

    if (!params.productId || !params.title || params.priceInr === undefined) {
      throw new Error('Product ID, title, and price are required');
    }

    if (params.priceInr < 0) {
      throw new Error('Price cannot be negative');
    }

    const product = inMemoryProducts.get(params.productId);
    const courseId = params.courseId || product?.courseId;
    if (!courseId) {
      throw new Error(`Product ${params.productId} not found to resolve courseId`);
    }

    // Default entitlements based on offering type if not provided
    let entitlements = params.includedEntitlements;
    if (!entitlements || entitlements.length === 0) {
      switch (params.offeringType) {
        case 'COMPLETE':
        case 'HYBRID':
          entitlements = ['ALL'];
          break;
        case 'VIDEO_ONLY':
          entitlements = ['VIDEO_LESSONS'];
          break;
        case 'DOCUMENT_ONLY':
          entitlements = ['DOCUMENT_LIBRARY'];
          break;
        case 'QUESTION_BANK_ONLY':
          entitlements = ['QUESTION_BANK'];
          break;
        case 'MOCK_EXAM_ONLY':
          entitlements = ['MOCK_EXAMS'];
          break;
        case 'LIVE_ONLY':
          entitlements = ['LIVE_CLASSROOM'];
          break;
        default:
          entitlements = ['ALL'];
      }
    }

    const now = new Date().toISOString();
    const offering: ProductOffering = {
      id: `offering-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
      productId: params.productId,
      courseId,
      title: params.title.trim(),
      offeringType: params.offeringType,
      priceInr: Number(params.priceInr),
      priceUsd: params.priceUsd ? Number(params.priceUsd) : undefined,
      currency: params.currency || 'INR',
      validityDays: params.validityDays !== undefined ? params.validityDays : 365,
      status: params.status || 'PUBLISHED',
      includedEntitlements: entitlements,
      requiresAdmissionReview: Boolean(params.requiresAdmissionReview),
      featuresList: params.featuresList || [],
      metadata: params.metadata || {},
      createdAt: now,
      updatedAt: now,
    };

    inMemoryOfferings.set(offering.id, offering);

    const client = db.getStorageMode() === 'supabase' ? supabaseAdapter.getClient() : null;
    if (client) {
      try {
        await client.from('product_offerings').insert({
          id: offering.id,
          product_id: offering.productId,
          course_id: offering.courseId,
          title: offering.title,
          offering_type: offering.offeringType,
          price_inr: offering.priceInr,
          price_usd: offering.priceUsd,
          currency: offering.currency,
          validity_days: offering.validityDays,
          status: offering.status,
          included_entitlements: offering.includedEntitlements,
          requires_admission_review: offering.requiresAdmissionReview,
          features_list: offering.featuresList,
          metadata: offering.metadata,
          created_at: offering.createdAt,
          updated_at: offering.updatedAt,
        });
      } catch {
        // Fallback
      }
    }

    return offering;
  }

  public static async updateOffering(
    id: string,
    updates: Partial<Omit<ProductOffering, 'id' | 'createdAt'>>
  ): Promise<ProductOffering> {
    ensureDefaultSeed();

    const offering = inMemoryOfferings.get(id);
    if (!offering) {
      throw new Error(`Offering ${id} not found`);
    }

    if (updates.priceInr !== undefined && updates.priceInr < 0) {
      throw new Error('Price cannot be negative');
    }

    const updated: ProductOffering = {
      ...offering,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    inMemoryOfferings.set(id, updated);

    const client = db.getStorageMode() === 'supabase' ? supabaseAdapter.getClient() : null;
    if (client) {
      try {
        await client
          .from('product_offerings')
          .update({
            title: updated.title,
            offering_type: updated.offeringType,
            price_inr: updated.priceInr,
            price_usd: updated.priceUsd,
            currency: updated.currency,
            validity_days: updated.validityDays,
            status: updated.status,
            included_entitlements: updated.includedEntitlements,
            requires_admission_review: updated.requiresAdmissionReview,
            features_list: updated.featuresList,
            metadata: updated.metadata,
            updated_at: updated.updatedAt,
          })
          .eq('id', id);
      } catch {
        // Fallback
      }
    }

    return updated;
  }

  public static async deleteOffering(id: string): Promise<boolean> {
    ensureDefaultSeed();

    const offering = inMemoryOfferings.get(id);
    if (!offering) return false;

    // Archive rather than delete to preserve purchase records
    offering.status = 'ARCHIVED';
    offering.updatedAt = new Date().toISOString();
    inMemoryOfferings.set(id, offering);

    const client = db.getStorageMode() === 'supabase' ? supabaseAdapter.getClient() : null;
    if (client) {
      try {
        await client
          .from('product_offerings')
          .update({ status: 'ARCHIVED', updated_at: offering.updatedAt })
          .eq('id', id);
      } catch {
        // Fallback
      }
    }

    return true;
  }
}
