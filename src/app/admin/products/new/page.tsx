import { ProductForm } from "@/components/widgets";
import { sellerContext } from "@/lib/session";

export default async function NewProductPage() {
  await sellerContext("products.write");
  return (
    <div>
      <h1 style={{ fontSize: "2rem" }}>New saree</h1>
      <p className="muted">Photos can come from the camera. They are resized on this phone before upload.</p>
      <ProductForm defaults={{ status: "active", blouseIncluded: true, dispatch: "ready" }} />
    </div>
  );
}
