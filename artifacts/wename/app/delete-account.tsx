import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/components/AuthContext";
import { fonts } from "@/constants/fonts";

const PARCHMENT    = "hsl(38,45%,93%)";
const CARD_BG      = "hsl(40,40%,93%)";
const FOREGROUND   = "hsl(25,30%,20%)";
const MUTED_FG     = "hsl(25,12%,48%)";
const BORDER       = "hsl(35,22%,80%)";
const BORDER_60    = "rgba(206,197,185,0.60)";
const BORDER_50    = "rgba(206,197,185,0.50)";
const GRASS        = "hsl(145,45%,35%)";
const GRASS_10     = "rgba(49,107,70,0.10)";
const DESTRUCTIVE  = "hsl(0,72%,50%)";
const DESTRUCT_30  = "rgba(200,50,50,0.30)";
const DESTRUCT_05  = "rgba(200,50,50,0.05)";
const DESTRUCT_10  = "rgba(200,50,50,0.10)";
const SKY_BLUE     = "#0284c7";
const GREEN_600    = "#16a34a";
const GREEN_50     = "hsl(138,100%,97%)";

const WHAT_GETS_DELETED = [
  "Your profile and account credentials",
  "All name swipe history (likes and dislikes)",
  "All name matches with your partner",
  "Any custom names you created",
  "Your partner link (your partner's account is not affected)",
];

type AuthStep = "idle" | "confirm" | "deleting" | "deleted";
type UnAuthStep = "form" | "submitting" | "submitted";

export default function DeleteAccountPage() {
  const { isAuthenticated, authUser, deleteAccount } = useAuth();
  const insets = useSafeAreaInsets();

  // Top-level completion flag — once set, it overrides auth branching so the
  // success screen stays visible even after the session is cleared by deleteAccount().
  const [accountDeleted, setAccountDeleted] = useState(false);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: PARCHMENT }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Text style={styles.appName}>WeName</Text>
        <Text style={styles.pageTitle}>Delete Account</Text>
      </View>

      {accountDeleted ? (
        <DeletedConfirmation bottomPad={insets.bottom} />
      ) : isAuthenticated ? (
        <AuthenticatedView
          email={authUser?.email ?? ""}
          onDelete={deleteAccount}
          onDeleted={() => setAccountDeleted(true)}
          bottomPad={insets.bottom}
        />
      ) : (
        <UnauthenticatedView bottomPad={insets.bottom} />
      )}
    </KeyboardAvoidingView>
  );
}

function DeletedConfirmation({ bottomPad }: { bottomPad: number }) {
  const router = useRouter();
  return (
    <View style={[styles.centeredContent, { paddingBottom: bottomPad + 24 }]}>
      <View style={[styles.iconBox, { backgroundColor: GREEN_50, borderColor: GREEN_600 + "33" }]}>
        <Feather name="check-circle" size={32} color={GREEN_600} />
      </View>
      <Text style={[styles.confirmTitle, { color: FOREGROUND }]}>Account Deleted</Text>
      <Text style={[styles.bodyText, { color: MUTED_FG, textAlign: "center" }]}>
        Your account and all associated data have been permanently removed.
      </Text>
      <Pressable
        onPress={() => router.replace("/")}
        style={({ pressed }) => [styles.linkRow, pressed && { opacity: 0.7 }]}
      >
        <Feather name="external-link" size={14} color={SKY_BLUE} />
        <Text style={[styles.linkText, { color: SKY_BLUE }]}>Return to WeName</Text>
      </Pressable>
    </View>
  );
}

function AuthenticatedView({
  email,
  onDelete,
  onDeleted,
  bottomPad,
}: {
  email: string;
  onDelete: () => Promise<void>;
  onDeleted: () => void;
  bottomPad: number;
}) {
  const [step, setStep] = useState<Exclude<AuthStep, "deleted">>("idle");
  const [deleteError, setDeleteError] = useState("");

  async function handleConfirmDelete() {
    setStep("deleting");
    setDeleteError("");
    try {
      await onDelete();
      // Signal parent BEFORE auth state clears so success screen is shown
      onDeleted();
    } catch (e) {
      setDeleteError(
        e instanceof Error ? e.message : "Deletion failed. Please try again.",
      );
      setStep("idle");
    }
  }

  return (
    <ScrollView
      contentContainerStyle={{
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: bottomPad + 80,
        gap: 16,
      }}
      showsVerticalScrollIndicator={false}
    >
      {/* Signed-in status */}
      <View style={[styles.card, { borderColor: BORDER_60 }]}>
        <View style={styles.cardHeaderRow}>
          <View style={[styles.avatarCircle, { backgroundColor: GRASS_10 }]}>
            <Feather name="check-circle" size={18} color={GRASS} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.cardTitle, { color: FOREGROUND }]}>Signed in as</Text>
            <Text style={[styles.cardSubtitle, { color: MUTED_FG }]} numberOfLines={1}>
              {email}
            </Text>
          </View>
        </View>
      </View>

      {/* What gets deleted */}
      <View style={[styles.card, { borderColor: BORDER_60, gap: 12 }]}>
        <Text style={[styles.cardTitle, { color: FOREGROUND }]}>What gets deleted</Text>
        {WHAT_GETS_DELETED.map((item) => (
          <View key={item} style={styles.bulletRow}>
            <Feather name="x-circle" size={14} color={DESTRUCTIVE} style={{ marginTop: 1 }} />
            <Text style={[styles.bodyText, { color: MUTED_FG, flex: 1 }]}>{item}</Text>
          </View>
        ))}
      </View>

      {/* Deletion actions */}
      {step === "idle" && (
        <View style={{ gap: 8 }}>
          <Pressable
            onPress={() => setStep("confirm")}
            style={({ pressed }) => [
              styles.dangerBtn,
              { borderColor: DESTRUCT_30, backgroundColor: DESTRUCT_05 },
              pressed && { transform: [{ scale: 0.95 }] },
            ]}
          >
            <Feather name="trash-2" size={15} color={DESTRUCTIVE} />
            <Text style={[styles.actionLabel, { color: DESTRUCTIVE }]}>Delete My Account</Text>
          </Pressable>
          {!!deleteError && (
            <Text style={[styles.microText, { color: MUTED_FG, textAlign: "center" }]}>
              {deleteError}
            </Text>
          )}
        </View>
      )}

      {step === "confirm" && (
        <View style={[styles.card, { borderColor: DESTRUCT_30, backgroundColor: DESTRUCT_10, gap: 12 }]}>
          <View style={styles.bulletRow}>
            <Feather name="alert-triangle" size={18} color={DESTRUCTIVE} />
            <Text style={[styles.cardTitle, { color: DESTRUCTIVE, flex: 1 }]}>
              This cannot be undone
            </Text>
          </View>
          <Text style={[styles.bodyText, { color: FOREGROUND }]}>
            Your account, all name swipes, matches, and partner link will be permanently deleted.
          </Text>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <Pressable
              onPress={() => setStep("idle")}
              style={({ pressed }) => [
                styles.cancelBtn,
                { borderColor: BORDER_60, backgroundColor: CARD_BG },
                pressed && { opacity: 0.7 },
              ]}
            >
              <Text style={[styles.actionLabel, { color: MUTED_FG }]}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={handleConfirmDelete}
              style={({ pressed }) => [
                styles.deleteConfirmBtn,
                { backgroundColor: DESTRUCTIVE },
                pressed && { transform: [{ scale: 0.95 }] },
              ]}
            >
              <Text style={[styles.actionLabel, { color: "#fff" }]}>Yes, Delete</Text>
            </Pressable>
          </View>
        </View>
      )}

      {step === "deleting" && (
        <View style={{ alignItems: "center", paddingVertical: 16, gap: 12 }}>
          <ActivityIndicator size="small" color={DESTRUCTIVE} />
          <Text style={[styles.bodyText, { color: MUTED_FG }]}>Deleting your account…</Text>
        </View>
      )}
    </ScrollView>
  );
}

function UnauthenticatedView({ bottomPad }: { bottomPad: number }) {
  const router = useRouter();
  const [email, setEmail]       = useState("");
  const [reason, setReason]     = useState("");
  const [emailError, setEmailError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [step, setStep]         = useState<UnAuthStep>("form");

  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
  const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";

  async function handleSubmit() {
    const trimmedEmail = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setEmailError("Please enter a valid email address.");
      return;
    }
    setEmailError("");
    setSubmitError("");
    setStep("submitting");

    try {
      const res = await fetch(
        `${supabaseUrl}/functions/v1/submit-deletion-request`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: supabaseAnonKey,
            Authorization: `Bearer ${supabaseAnonKey}`,
          },
          body: JSON.stringify({ email: trimmedEmail, reason: reason.trim() }),
        },
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.success) {
        throw new Error(body.error || "Failed to submit request. Please try again.");
      }
      setStep("submitted");
    } catch (e) {
      setSubmitError(
        e instanceof Error ? e.message : "Failed to submit. Please try again.",
      );
      setStep("form");
    }
  }

  if (step === "submitted") {
    return (
      <View style={[styles.centeredContent, { paddingBottom: bottomPad + 24 }]}>
        <View style={[styles.iconBox, { backgroundColor: GREEN_50, borderColor: GREEN_600 + "33" }]}>
          <Feather name="check-circle" size={32} color={GREEN_600} />
        </View>
        <Text style={[styles.confirmTitle, { color: FOREGROUND }]}>Request Received</Text>
        <Text style={[styles.bodyText, { color: MUTED_FG, textAlign: "center" }]}>
          We'll process your deletion request within 30 days and send a confirmation to{" "}
          <Text style={{ fontFamily: fonts.displayBold, color: FOREGROUND }}>{email}</Text>.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={{
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: bottomPad + 80,
        gap: 16,
      }}
      showsVerticalScrollIndicator={false}
    >
      {/* Sign-in prompt */}
      <View style={[styles.card, { borderColor: BORDER_60 }]}>
        <View style={styles.bulletRow}>
          <Feather name="info" size={16} color={MUTED_FG} />
          <Text style={[styles.bodyText, { color: MUTED_FG, flex: 1 }]}>
            Already have an account?{" "}
            <Text
              style={{ color: SKY_BLUE, textDecorationLine: "underline" }}
              onPress={() => router.replace("/")}
            >
              Sign in to delete instantly
            </Text>
          </Text>
        </View>
      </View>

      {/* What gets deleted */}
      <View style={[styles.card, { borderColor: BORDER_60, gap: 12 }]}>
        <Text style={[styles.cardTitle, { color: FOREGROUND }]}>What gets deleted</Text>
        {WHAT_GETS_DELETED.map((item) => (
          <View key={item} style={styles.bulletRow}>
            <Feather name="x-circle" size={14} color={DESTRUCTIVE} style={{ marginTop: 1 }} />
            <Text style={[styles.bodyText, { color: MUTED_FG, flex: 1 }]}>{item}</Text>
          </View>
        ))}
      </View>

      {/* Deletion request form */}
      <View style={[styles.card, { borderColor: BORDER_60, gap: 14 }]}>
        <Text style={[styles.cardTitle, { color: FOREGROUND }]}>Submit a deletion request</Text>
        <Text style={[styles.bodyText, { color: MUTED_FG }]}>
          We'll process your request within 30 days and send you a confirmation email.
        </Text>

        {/* Email */}
        <View style={{ gap: 6 }}>
          <Text style={styles.fieldLabel}>EMAIL ADDRESS</Text>
          <View style={{ position: "relative" }}>
            <View style={styles.inputIconWrap}>
              <Feather name="mail" size={15} color={MUTED_FG} />
            </View>
            <TextInput
              value={email}
              onChangeText={(v) => { setEmail(v); setEmailError(""); }}
              placeholder="your@email.com"
              placeholderTextColor={MUTED_FG + "99"}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              editable={step === "form"}
              style={[
                styles.textInput,
                {
                  color: FOREGROUND,
                  borderColor: emailError ? DESTRUCTIVE + "80" : BORDER,
                  backgroundColor: CARD_BG,
                },
              ]}
            />
          </View>
          {!!emailError && (
            <View style={styles.errorRow}>
              <Feather name="alert-circle" size={12} color={DESTRUCTIVE} />
              <Text style={[styles.microText, { color: DESTRUCTIVE }]}>{emailError}</Text>
            </View>
          )}
        </View>

        {/* Reason */}
        <View style={{ gap: 6 }}>
          <Text style={styles.fieldLabel}>REASON (OPTIONAL)</Text>
          <TextInput
            value={reason}
            onChangeText={setReason}
            placeholder="Tell us why you'd like to delete your account…"
            placeholderTextColor={MUTED_FG + "99"}
            multiline
            numberOfLines={3}
            maxLength={1000}
            editable={step === "form"}
            style={[
              styles.textInput,
              {
                color: FOREGROUND,
                borderColor: BORDER,
                backgroundColor: CARD_BG,
                paddingLeft: 14,
                paddingTop: 12,
                height: 88,
                textAlignVertical: "top",
              },
            ]}
          />
          <Text style={[styles.microText, { color: MUTED_FG, textAlign: "right" }]}>
            {reason.length}/1000
          </Text>
        </View>

        {!!submitError && (
          <View style={styles.errorRow}>
            <Feather name="alert-circle" size={12} color={DESTRUCTIVE} />
            <Text style={[styles.microText, { color: DESTRUCTIVE, flex: 1 }]}>{submitError}</Text>
          </View>
        )}

        <Pressable
          onPress={handleSubmit}
          disabled={step === "submitting"}
          style={({ pressed }) => [
            styles.submitBtn,
            { backgroundColor: DESTRUCTIVE },
            step === "submitting" && { opacity: 0.6 },
            pressed && step === "form" && { transform: [{ scale: 0.95 }] },
          ]}
        >
          {step === "submitting" ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Feather name="trash-2" size={15} color="#fff" />
              <Text style={[styles.actionLabel, { color: "#fff" }]}>
                Submit Deletion Request
              </Text>
            </>
          )}
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: BORDER_50,
    backgroundColor: PARCHMENT,
  },
  appName: {
    fontFamily: fonts.displayBold,
    fontSize: 18,
    color: GRASS,
  },
  pageTitle: {
    fontFamily: fonts.display,
    fontSize: 13,
    color: MUTED_FG,
    marginTop: 2,
  },
  centeredContent: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    gap: 16,
  },
  iconBox: {
    width: 72,
    height: 72,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  confirmTitle: {
    fontFamily: fonts.displayBold,
    fontSize: 18,
    textAlign: "center",
  },
  card: {
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  avatarCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  cardTitle: {
    fontFamily: fonts.displayBold,
    fontSize: 14,
  },
  cardSubtitle: {
    fontFamily: fonts.display,
    fontSize: 10,
    marginTop: 2,
  },
  bodyText: {
    fontFamily: fonts.display,
    fontSize: 14,
    lineHeight: 21,
  },
  bulletRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  linkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  linkText: {
    fontFamily: fonts.displaySemibold,
    fontSize: 14,
    textDecorationLine: "underline",
  },
  dangerBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
  },
  deleteConfirmBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  submitBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  actionLabel: {
    fontFamily: fonts.displaySemibold,
    fontSize: 14,
  },
  fieldLabel: {
    fontFamily: fonts.displaySemibold,
    fontSize: 10,
    color: MUTED_FG,
    letterSpacing: 1.2,
  },
  inputIconWrap: {
    position: "absolute",
    left: 14,
    top: 0,
    bottom: 0,
    justifyContent: "center",
    zIndex: 1,
  },
  textInput: {
    paddingLeft: 40,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    fontFamily: fonts.display,
    fontSize: 14,
  },
  errorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  microText: {
    fontFamily: fonts.display,
    fontSize: 10,
    lineHeight: 16,
  },
});
