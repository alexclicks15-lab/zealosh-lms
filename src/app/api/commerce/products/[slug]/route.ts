import { NextResponse } from 'next/server';
import { ProductService } from '@/lib/commerce/product-service';
import { db } from '@/lib/store/db';

export async function GET(
  request: Request,
  { params }: { params: { slug: string } }
) {
  try {
    const { slug } = params;
    let product = await ProductService.getProductBySlug(slug);

    if (!product) {
      // Check if slug is actually a courseId or productId
      product = await ProductService.getProductById(slug);
      if (!product) {
        const byCourse = await ProductService.getProducts({ courseId: slug });
        if (byCourse.length > 0) {
          product = byCourse[0];
        } else {
          // Check by course slug in db
          const course = await db.getCourseBySlug(slug);
          if (course) {
            const byCourseId = await ProductService.getProducts({ courseId: course.id });
            if (byCourseId.length > 0) product = byCourseId[0];
          }
        }
      }
    }

    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    const offerings = await ProductService.getOfferings({
      productId: product.id,
      status: 'PUBLISHED',
    });

    return NextResponse.json({
      success: true,
      product: {
        ...product,
        offerings,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
