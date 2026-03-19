import { NextResponse } from "next/server";
import {
  listDecoratorProducts,
  listDecoratorTemplates,
} from "@/lib/data-repository";

export async function GET() {
  const [products, templates] = await Promise.all([
    listDecoratorProducts(),
    listDecoratorTemplates(),
  ]);

  return NextResponse.json({
    data: {
      products,
      templates,
    },
    generatedAt: new Date().toISOString(),
  });
}
