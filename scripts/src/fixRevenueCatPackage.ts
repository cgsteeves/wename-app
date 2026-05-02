import { getUncachableRevenueCatClient } from "./revenueCatClient";
import {
  attachProductsToPackage,
  detachProductsFromPackage,
} from "@replit/revenuecat-sdk";

const PROJECT_ID = "proj2e7cb62d";
const PACKAGE_ID = "pkgeefec874174";

const WRONG_PRODUCT_ID = "prod0d686f84fa";
const TEST_STORE_LIFETIME_ID = "prod5a47084ad6";
const PLAY_STORE_LIFETIME_ID = "prodd48375178d";
const APP_STORE_LIFETIME_ID = "proda9605a4cdf";

async function main() {
  const client = await getUncachableRevenueCatClient();

  console.log("Detaching wrong (subscription) product from $rc_lifetime package...");
  const { error: detachErr } = await detachProductsFromPackage({
    client,
    path: { project_id: PROJECT_ID, package_id: PACKAGE_ID },
    body: { product_ids: [WRONG_PRODUCT_ID] },
  });
  if (detachErr) {
    const msg = (detachErr as { message?: string }).message ?? "";
    if (msg.includes("not currently attached")) {
      console.log("  already detached — skipping");
    } else {
      console.error("Detach failed:", detachErr);
      throw new Error("Failed to detach product");
    }
  } else {
    console.log("  detached:", WRONG_PRODUCT_ID);
  }

  for (const productId of [
    TEST_STORE_LIFETIME_ID,
    PLAY_STORE_LIFETIME_ID,
    APP_STORE_LIFETIME_ID,
  ]) {
    console.log("Attaching " + productId + "...");
    const { error } = await attachProductsToPackage({
      client,
      path: { project_id: PROJECT_ID, package_id: PACKAGE_ID },
      body: {
        products: [{ product_id: productId, eligibility_criteria: "all" }],
      },
    });
    if (error) {
      const msg = (error as { message?: string }).message ?? "";
      if (msg.toLowerCase().includes("already")) {
        console.log("  already attached — skipping");
      } else {
        console.error("  Attach failed:", JSON.stringify(error, null, 2));
      }
    } else {
      console.log("  attached.");
    }
  }

  console.log("\nVerifying final package contents...");
  const { data: verify } = await client.get({
    url: "/projects/{project_id}/packages/{package_id}/products",
    path: { project_id: PROJECT_ID, package_id: PACKAGE_ID },
  });
  console.log(JSON.stringify(verify, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
