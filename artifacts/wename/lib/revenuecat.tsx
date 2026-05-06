import React, { createContext, useContext, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Platform } from "react-native";
import Purchases, { PurchasesPackage } from "react-native-purchases";
import { useMutation, useQuery } from "@tanstack/react-query";
import Constants from "expo-constants";

import { fonts } from "@/constants/fonts";
import { useColors } from "@/hooks/useColors";

const REVENUECAT_TEST_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_TEST_API_KEY;
const REVENUECAT_IOS_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY;
const REVENUECAT_ANDROID_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY;

export const REVENUECAT_ENTITLEMENT_IDENTIFIER = "premium";

function getRevenueCatApiKey() {
  if (!REVENUECAT_TEST_API_KEY || !REVENUECAT_IOS_API_KEY || !REVENUECAT_ANDROID_API_KEY) {
    throw new Error("RevenueCat Public API Keys not found");
  }

  if (__DEV__ || Platform.OS === "web" || Constants.executionEnvironment === "storeClient") {
    return REVENUECAT_TEST_API_KEY;
  }

  if (Platform.OS === "ios") {
    return REVENUECAT_IOS_API_KEY;
  }

  if (Platform.OS === "android") {
    return REVENUECAT_ANDROID_API_KEY;
  }

  return REVENUECAT_TEST_API_KEY;
}

export function initializeRevenueCat() {
  const apiKey = getRevenueCatApiKey();
  if (!apiKey) throw new Error("RevenueCat Public API Key not found");
  Purchases.setLogLevel(Purchases.LOG_LEVEL.DEBUG);
  Purchases.configure({ apiKey });
  console.log("[RevenueCat] Configured");
}

function TestStorePurchaseModal({
  visible,
  priceString,
  onConfirm,
  onCancel,
}: {
  visible: boolean;
  priceString: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const colors = useColors();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <View style={[styles.dialog, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.dialogTitle, { color: colors.foreground }]}>
            Simulate Purchase?
          </Text>
          <Text style={[styles.dialogBody, { color: colors.mutedForeground }]}>
            This is a test store purchase ({priceString}/month). No real charge will be made.
          </Text>
          <View style={styles.dialogButtons}>
            <Pressable
              style={[styles.dialogBtn, { backgroundColor: colors.border + "66" }]}
              onPress={onCancel}
            >
              <Text style={{ fontFamily: fonts.displaySemibold, color: colors.mutedForeground }}>
                Cancel
              </Text>
            </Pressable>
            <Pressable
              style={[styles.dialogBtn, { backgroundColor: "#f59e0b" }]}
              onPress={onConfirm}
            >
              <Text style={{ fontFamily: fonts.displayBold, color: "#fff" }}>
                Confirm
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function useSubscriptionContext() {
  const [confirmPkg, setConfirmPkg] = useState<PurchasesPackage | null>(null);
  const [pendingResolve, setPendingResolve] = useState<((confirmed: boolean) => void) | null>(null);

  const customerInfoQuery = useQuery({
    queryKey: ["revenuecat", "customer-info"],
    queryFn: async () => {
      console.log("[RevenueCat] customer-info fetch: start");
      const info = await Purchases.getCustomerInfo();
      const hasPremium =
        info.entitlements.active?.[REVENUECAT_ENTITLEMENT_IDENTIFIER] !== undefined;
      console.log("[RevenueCat] customer-info fetch: complete", {
        hasPremiumEntitlement: hasPremium,
        activeEntitlements: Object.keys(info.entitlements.active),
        originalAppUserId: info.originalAppUserId,
      });
      return info;
    },
    staleTime: 60 * 1000,
  });

  const offeringsQuery = useQuery({
    queryKey: ["revenuecat", "offerings"],
    queryFn: async () => {
      console.log("[RevenueCat] offerings fetch: start");
      const offerings = await Purchases.getOfferings();
      const pkgCount = offerings.current?.availablePackages?.length ?? 0;
      console.log("[RevenueCat] offerings fetch: complete", {
        currentOfferingId: offerings.current?.identifier ?? null,
        availablePackages: pkgCount,
      });
      return offerings;
    },
    staleTime: 300 * 1000,
  });

  const purchaseMutation = useMutation({
    mutationFn: async (pkg: PurchasesPackage) => {
      console.log("[RevenueCat] purchasePackage: called", {
        packageId: pkg.identifier,
        productId: pkg.product.identifier,
        price: pkg.product.priceString,
      });
      const { customerInfo } = await Purchases.purchasePackage(pkg);
      const hasPremium =
        customerInfo.entitlements.active?.[REVENUECAT_ENTITLEMENT_IDENTIFIER] !== undefined;
      console.log("[RevenueCat] purchasePackage: complete", {
        hasPremiumEntitlement: hasPremium,
        activeEntitlements: Object.keys(customerInfo.entitlements.active),
      });
      return customerInfo;
    },
    onSuccess: () => customerInfoQuery.refetch(),
  });

  const restoreMutation = useMutation({
    mutationFn: async () => {
      console.log("[RevenueCat] restorePurchases: called");
      const info = await Purchases.restorePurchases();
      const hasPremium =
        info.entitlements.active?.[REVENUECAT_ENTITLEMENT_IDENTIFIER] !== undefined;
      console.log("[RevenueCat] restorePurchases: complete", {
        hasPremiumEntitlement: hasPremium,
        activeEntitlements: Object.keys(info.entitlements.active),
      });
      return info;
    },
    onSuccess: () => customerInfoQuery.refetch(),
  });

  // The ONLY source of truth for premium feature access.
  // true iff RevenueCat has confirmed an active "premium" entitlement.
  // false while loading (customerInfoQuery.isLoading) or when there is no entitlement.
  // Must NOT be replaced by user.plan_tier, isSubscribed, AsyncStorage, or any Supabase field.
  const hasPremiumEntitlement =
    customerInfoQuery.data?.entitlements.active?.[REVENUECAT_ENTITLEMENT_IDENTIFIER] !== undefined;

  // True while RevenueCat customer-info is still being fetched.
  // Callers must default premium access to false while this is true.
  const isSubscriptionLoading = customerInfoQuery.isLoading;

  const offeringsError = offeringsQuery.error;
  const customerInfoError = customerInfoQuery.error;

  async function purchase(pkg: PurchasesPackage) {
    if (__DEV__) {
      const confirmed = await new Promise<boolean>((resolve) => {
        setConfirmPkg(pkg);
        setPendingResolve(() => resolve);
      });
      if (!confirmed) return;
    }
    return purchaseMutation.mutateAsync(pkg);
  }

  function handleConfirm() {
    setConfirmPkg(null);
    pendingResolve?.(true);
    setPendingResolve(null);
  }

  function handleCancel() {
    setConfirmPkg(null);
    pendingResolve?.(false);
    setPendingResolve(null);
  }

  return {
    customerInfo: customerInfoQuery.data,
    offerings: offeringsQuery.data,
    hasPremiumEntitlement,
    isSubscriptionLoading,
    isLoading: customerInfoQuery.isLoading || offeringsQuery.isLoading,
    offeringsError,
    customerInfoError,
    purchase,
    restore: restoreMutation.mutateAsync,
    isPurchasing: purchaseMutation.isPending,
    isRestoring: restoreMutation.isPending,
    refetchCustomerInfo: customerInfoQuery.refetch,
    confirmPkg,
    handleConfirm,
    handleCancel,
  };
}

type SubscriptionContextValue = ReturnType<typeof useSubscriptionContext>;
const Context = createContext<SubscriptionContextValue | null>(null);

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const value = useSubscriptionContext();
  return (
    <Context.Provider value={value}>
      {children}
      {value.confirmPkg && (
        <TestStorePurchaseModal
          visible={!!value.confirmPkg}
          priceString={value.confirmPkg.product.priceString}
          onConfirm={value.handleConfirm}
          onCancel={value.handleCancel}
        />
      )}
    </Context.Provider>
  );
}

export function useSubscription() {
  const ctx = useContext(Context);
  if (!ctx) {
    throw new Error("useSubscription must be used within a SubscriptionProvider");
  }
  return ctx;
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  dialog: {
    width: "100%",
    maxWidth: 340,
    borderRadius: 20,
    borderWidth: 1,
    padding: 24,
    gap: 12,
  },
  dialogTitle: {
    fontFamily: fonts.displayBold,
    fontSize: 18,
    textAlign: "center",
  },
  dialogBody: {
    fontFamily: fonts.display,
    fontSize: 14,
    textAlign: "center",
    lineHeight: 21,
  },
  dialogButtons: {
    flexDirection: "row",
    gap: 10,
    marginTop: 4,
  },
  dialogBtn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
});
