import { describe, it, expect, beforeEach } from 'vitest';
import { ProductService } from '@/lib/commerce/product-service';

describe('ZM-IMPL-08C: Commercial Products & Product Offerings Decoupling', () => {
  beforeEach(() => {
    ProductService.resetForTesting();
  });

  it('correctly seeds default products decoupled from courses', async () => {
    const products = await ProductService.getProducts();
    expect(products.length).toBeGreaterThanOrEqual(3);

    const aspProduct = products.find((p) => p.slug === 'asp-prep');
    expect(aspProduct).toBeDefined();
    expect(aspProduct?.courseId).toBe('crs-asp-01');
    expect(aspProduct?.status).toBe('PUBLISHED');
  });

  it('creates a new commercial product linked to a course', async () => {
    const newProduct = await ProductService.createProduct({
      courseId: 'crs-asp-001',
      name: 'ASP Fast-Track Weekend Bootcamp',
      slug: 'asp-bootcamp',
      description: 'Intensive 6-week certification sprint.',
      status: 'PUBLISHED',
    });

    expect(newProduct.id).toMatch(/^prod-/);
    expect(newProduct.slug).toBe('asp-bootcamp');
    expect(newProduct.status).toBe('PUBLISHED');

    const retrieved = await ProductService.getProductById(newProduct.id);
    expect(retrieved?.name).toBe('ASP Fast-Track Weekend Bootcamp');
  });

  it('rejects duplicate product slugs', async () => {
    await expect(
      ProductService.createProduct({
        courseId: 'crs-asp-001',
        name: 'ASP Duplicate Slug Test',
        slug: 'asp-prep', // Existing slug
      })
    ).rejects.toThrow(/already exists/i);
  });

  it('manages distinct product offerings under a product with custom pricing and validity', async () => {
    const aspProduct = await ProductService.getProductBySlug('asp-prep');
    expect(aspProduct).toBeDefined();

    const offerings = await ProductService.getOfferings({ productId: aspProduct!.id });
    expect(offerings.length).toBeGreaterThanOrEqual(3);

    // Verify Complete, Video-only, and Question Bank offerings
    const completeOff = offerings.find((o) => o.offeringType === 'COMPLETE');
    const videoOff = offerings.find((o) => o.offeringType === 'VIDEO_ONLY');
    const qbankOff = offerings.find((o) => o.offeringType === 'QUESTION_BANK_ONLY');

    expect(completeOff?.priceInr).toBe(28000);
    expect(completeOff?.validityDays).toBe(365);
    expect(completeOff?.includedEntitlements).toContain('ALL');

    expect(videoOff?.priceInr).toBe(16000);
    expect(videoOff?.validityDays).toBe(180);
    expect(videoOff?.includedEntitlements).toContain('VIDEO_LESSONS');

    expect(qbankOff?.priceInr).toBe(9500);
    expect(qbankOff?.validityDays).toBe(120);
    expect(qbankOff?.includedEntitlements).toContain('QUESTION_BANK');
  });

  it('creates custom product offerings with negative price validation', async () => {
    const aspProduct = await ProductService.getProductBySlug('asp-prep');

    // Reject negative price
    await expect(
      ProductService.createOffering({
        productId: aspProduct!.id,
        title: 'Invalid Offering',
        offeringType: 'MOCK_EXAM_ONLY',
        priceInr: -500,
      })
    ).rejects.toThrow(/cannot be negative/i);

    // Create valid offering
    const newOffering = await ProductService.createOffering({
      productId: aspProduct!.id,
      title: 'ASP Formula Sheet & Quick Reference Only',
      offeringType: 'DOCUMENT_ONLY',
      priceInr: 3500,
      validityDays: 90,
      includedEntitlements: ['DOCUMENT_LIBRARY'],
      featuresList: ['Full PDF formula card access', 'Downloadable flashcards'],
    });

    expect(newOffering.id).toMatch(/^offering-/);
    expect(newOffering.includedEntitlements).toEqual(['DOCUMENT_LIBRARY']);
    expect(newOffering.priceInr).toBe(3500);
  });

  it('archives an offering rather than hard-deleting to preserve purchase references', async () => {
    const offerings = await ProductService.getOfferings();
    const target = offerings[0];

    const deleted = await ProductService.deleteOffering(target.id);
    expect(deleted).toBe(true);

    const reloaded = await ProductService.getOfferingById(target.id);
    expect(reloaded?.status).toBe('ARCHIVED');
  });
});
