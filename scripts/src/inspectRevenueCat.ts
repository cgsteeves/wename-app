import { getUncachableRevenueCatClient } from "./revenueCatClient";
import {
  listProjects,
  listApps,
  listProducts,
  listOfferings,
  listPackages,
  listEntitlements,
  listAppPublicApiKeys,
} from "@replit/revenuecat-sdk";

async function main() {
  const client = await getUncachableRevenueCatClient();
  const projects = await listProjects({ client, query: { limit: 20 } });
  const project =
    projects.data?.items?.find((p) => p.name === "WeName") ??
    projects.data?.items?.[0];
  console.log("PROJECT:", project?.id, project?.name);
  if (!project) {
    console.log("all:", projects.data?.items?.map((p) => ({ id: p.id, name: p.name })));
    return;
  }

  const apps = await listApps({
    client,
    path: { project_id: project.id },
    query: { limit: 20 },
  });
  console.log(
    "APPS:",
    apps.data?.items?.map((a) => ({ id: a.id, type: a.type, name: a.name })),
  );

  const products = await listProducts({
    client,
    path: { project_id: project.id },
    query: { limit: 50 },
  });
  console.log(
    "PRODUCTS:",
    products.data?.items?.map((p) => ({
      id: p.id,
      app_id: p.app_id,
      store_id: p.store_identifier,
      type: p.type,
    })),
  );

  const ents = await listEntitlements({
    client,
    path: { project_id: project.id },
    query: { limit: 20 },
  });
  console.log(
    "ENTITLEMENTS:",
    ents.data?.items?.map((e) => ({ id: e.id, lookup_key: e.lookup_key })),
  );

  const offs = await listOfferings({
    client,
    path: { project_id: project.id },
    query: { limit: 20 },
  });
  console.log(
    "OFFERINGS:",
    offs.data?.items?.map((o) => ({
      id: o.id,
      lookup_key: o.lookup_key,
      is_current: o.is_current,
    })),
  );
  for (const o of offs.data?.items || []) {
    const pkgs = await listPackages({
      client,
      path: { project_id: project.id, offering_id: o.id },
      query: { limit: 20 },
    });
    console.log(
      "  PACKAGES of " + o.lookup_key + ":",
      pkgs.data?.items?.map((p) => ({ id: p.id, lookup_key: p.lookup_key })),
    );
  }

  const testApp = apps.data?.items?.find((a) => a.type === "test_store");
  if (testApp) {
    const keys = await listAppPublicApiKeys({
      client,
      path: { project_id: project.id, app_id: testApp.id },
    });
    console.log(
      "TEST_STORE_KEYS:",
      keys.data?.items?.map((k) => k.key),
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
