import { getUncachableRevenueCatClient } from "./revenueCatClient";

async function main() {
  const client = await getUncachableRevenueCatClient();
  const pid = "proj2e7cb62d";
  const pkgId = "pkgeefec874174";

  // List products attached to the package
  const { data, error } = await client.get({
    url: "/projects/{project_id}/packages/{package_id}/products",
    path: { project_id: pid, package_id: pkgId },
  });
  console.log("PACKAGE PRODUCTS:", JSON.stringify(data, null, 2));
  if (error) console.log("ERROR:", JSON.stringify(error, null, 2));

  // Also fetch test-store prices for both test products
  for (const productId of ["prod0d686f84fa", "prod5a47084ad6"]) {
    const r = await client.get({
      url: "/projects/{project_id}/products/{product_id}/test_store_prices",
      path: { project_id: pid, product_id: productId },
    });
    console.log(`PRICES for ${productId}:`, JSON.stringify(r.data, null, 2));
    if (r.error) console.log(`PRICES ERROR for ${productId}:`, JSON.stringify(r.error, null, 2));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
