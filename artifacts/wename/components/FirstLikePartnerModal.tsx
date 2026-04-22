import { Feather } from "@expo/vector-icons";
import React from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

import { fonts } from "@/constants/fonts";
import { useColors } from "@/hooks/useColors";

export function FirstLikePartnerModal({
  open,
  hasPartner,
  onPrimary,
  onClose,
}: {
  open: boolean;
  hasPartner: boolean;
  onPrimary: () => void;
  onClose: () => void;
}) {
  const colors = useColors();
  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable onPress={(e) => e.stopPropagation()} style={styles.cardWrap}>
          <View style={[styles.card, { backgroundColor: "#fdf6ef" }]}>
            <View style={styles.heartBadge}>
              <Feather name="heart" size={28} color={colors.heart} />
            </View>
            <Text style={[styles.title, { color: colors.foreground }]}>
              Find names together
            </Text>
            <Text style={[styles.body, { color: colors.mutedForeground }]}>
              Invite your partner to swipe on names and discover the ones you both love.
            </Text>
            <Pressable
              onPress={onPrimary}
              style={({ pressed }) => [
                styles.primary,
                { backgroundColor: colors.heart, opacity: pressed ? 0.9 : 1 },
              ]}
            >
              <Feather name="heart" size={16} color="#fff" />
              <Text style={styles.primaryText}>
                {hasPartner ? "Keep Swiping" : "Invite Partner"}
              </Text>
            </Pressable>
            <Pressable onPress={onClose} style={styles.maybe}>
              <Text style={[styles.maybeText, { color: colors.mutedForeground }]}>
                Maybe later
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  cardWrap: { width: "100%", maxWidth: 344 },
  card: {
    borderRadius: 24,
    paddingHorizontal: 32,
    paddingVertical: 32,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 12,
  },
  heartBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  title: {
    fontSize: 24,
    fontFamily: fonts.hand,
    textAlign: "center",
    marginBottom: 12,
  },
  body: {
    fontSize: 14,
    fontFamily: fonts.display,
    lineHeight: 22,
    textAlign: "center",
    marginBottom: 24,
  },
  primary: {
    width: "100%",
    height: 56,
    borderRadius: 16,
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryText: { color: "#fff", fontFamily: fonts.displayBold, fontSize: 14 },
  maybe: { marginTop: 12, paddingVertical: 10 },
  maybeText: { fontFamily: fonts.display, fontSize: 14 },
});
