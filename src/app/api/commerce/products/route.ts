import { NextResponse } from 'next/server';
import { ProductService } from '@/lib/commerce/product-service';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const courseId = searchParams.get('courseId') || undefined;
    const status = (searchParams.get('status') as any) || undefined;

    const products = await ProductService.getProducts({ courseId, status });

    // Fetch offerings for each product
    const productsWithOfferings = await Promise.all(
      products.map(async (p) => {
        const offerings = await ProductService.getOfferings({ productId: p.id, status: 'PUBLISHED' });
        return {
          ...p,
          offerings,
        };
      })
    );

    return NextResponse.json({
      success: true,
      products: productsWithOfferings,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

