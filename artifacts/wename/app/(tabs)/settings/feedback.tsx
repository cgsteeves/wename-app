import { Feather } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
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
import Constants from "expo-constants";

import { SubPageHeader } from "@/components/SubPageHeader";
import { useUser } from "@/components/UserContext";
import { fonts } from "@/constants/fonts";
import { useColors } from "@/hooks/useColors";
import { supabase } from "@/lib/supabase";

const MAX_IMAGES = 4;
const MAX_MESSAGE_CHARS = 2000;

type LocalImage = {
  uri: string;
  mimeType: string;
  fileName: string;
};

export default function FeedbackScreen() {
  const router = useRouter();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useUser();
  const [message, setMessage] = useState("");
  const [images, setImages] = useState<LocalImage[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [picking, setPicking] = useState(false);

  async function pickImages() {
    if (images.length >= MAX_IMAGES) return;
    setPicking(true);
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(
          "Permission needed",
          "Please allow photo library access to attach images.",
        );
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        selectionLimit: MAX_IMAGES - images.length,
        quality: 0.8,
      });
      if (result.canceled) return;
      const picked: LocalImage[] = result.assets.map((a, i) => ({
        uri: a.uri,
        mimeType: a.mimeType ?? "image/jpeg",
        fileName: a.fileName ?? `feedback-${Date.now()}-${i}.jpg`,
      }));
      setImages((prev) => [...prev, ...picked].slice(0, MAX_IMAGES));
    } catch (e) {
      console.error("[Feedback] image pick error", e);
      Alert.alert("Could not open photo library", "Please try again.");
    } finally {
      setPicking(false);
    }
  }

  function removeImage(idx: number) {
    setImages((prev) => prev.filter((_, i) => i !== idx));
  }

  async function uploadImages(): Promise<string[]> {
    if (!user || images.length === 0) return [];
    const paths: string[] = [];
    for (let i = 0; i < images.length; i++) {
      const img = images[i];
      const ext = (img.fileName.split(".").pop() ?? "jpg").toLowerCase();
      const path = `${user.id}/${Date.now()}-${i}.${ext}`;
      const response = await fetch(img.uri);
      const arrayBuffer = await response.arrayBuffer();
      const { error } = await supabase.storage
        .from("feedback-images")
        .upload(path, arrayBuffer, {
          contentType: img.mimeType,
          upsert: false,
        });
      if (error) {
        throw new Error(`Image upload failed: ${error.message}`);
      }
      paths.push(path);
    }
    return paths;
  }

  async function handleSubmit() {
    if (!user) return;
    const trimmed = message.trim();
    if (!trimmed) {
      Alert.alert("Empty feedback", "Please share what's on your mind.");
      return;
    }
    setSubmitting(true);
    try {
      const imagePaths = await uploadImages();
      const appVersion =
        Constants.expoConfig?.version ?? Constants.nativeAppVersion ?? null;
      const { error } = await supabase.from("feedback").insert({
        user_id: user.id,
        email: user.email,
        display_name: user.display_name,
        message: trimmed,
        image_paths: imagePaths,
        app_version: appVersion,
        user_agent: Platform.OS,
      });
      if (error) throw error;
      Alert.alert(
        "Thank you!",
        "Your feedback has been received. We read every message.",
        [{ text: "OK", onPress: () => router.back() }],
      );
    } catch (e) {
      console.error("[Feedback] submit error", e);
      const msg =
        e instanceof Error
          ? e.message
          : (e as { message?: string })?.message ?? "Something went wrong.";
      Alert.alert("Could not send feedback", msg);
    } finally {
      setSubmitting(false);
    }
  }

  if (!user) return null;
  const charsLeft = MAX_MESSAGE_CHARS - message.length;
  const canSubmit = message.trim().length > 0 && !submitting;

  return (
    <View style={{ flex: 1, backgroundColor: colors.parchment }}>
      <SubPageHeader title="Leave Feedback" subtitle="We'd love to hear from you" />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
      >
        <ScrollView
          contentContainerStyle={{
            padding: 16,
            paddingBottom: insets.bottom + 32,
            gap: 14,
          }}
          keyboardShouldPersistTaps="handled"
        >
          <Text
            style={{
              fontFamily: fonts.display,
              fontSize: 14,
              color: colors.mutedForeground,
              textAlign: "center",
              lineHeight: 22,
            }}
          >
            Tell us what's working, what isn't, or what you'd love to see next.
          </Text>

          <View
            style={[
              styles.card,
              { backgroundColor: colors.card, borderColor: colors.border + "99" },
            ]}
          >
            <TextInput
              value={message}
              onChangeText={(t) => setMessage(t.slice(0, MAX_MESSAGE_CHARS))}
              placeholder="Share your thoughts, ideas, or any issues you've run into..."
              placeholderTextColor={colors.mutedForeground}
              multiline
              textAlignVertical="top"
              style={[
                styles.input,
                {
                  color: colors.foreground,
                  fontFamily: fonts.display,
                },
              ]}
            />
            <View style={styles.charCountRow}>
              <Text
                style={{
                  fontFamily: fonts.display,
                  fontSize: 11,
                  color: colors.mutedForeground,
                }}
              >
                {charsLeft} characters left
              </Text>
            </View>
          </View>

          <View
            style={[
              styles.card,
              { backgroundColor: colors.card, borderColor: colors.border + "99", padding: 14, gap: 12 },
            ]}
          >
            <View style={styles.attachHeader}>
              <Feather name="image" size={16} color={colors.foreground} />
              <Text
                style={{
                  fontFamily: fonts.displaySemibold,
                  fontSize: 14,
                  color: colors.foreground,
                  flex: 1,
                }}
              >
                Attach screenshots
              </Text>
              <Text
                style={{
                  fontFamily: fonts.display,
                  fontSize: 11,
                  color: colors.mutedForeground,
                }}
              >
                {images.length}/{MAX_IMAGES}
              </Text>
            </View>

            {images.length > 0 && (
              <View style={styles.thumbRow}>
                {images.map((img, i) => (
                  <View key={`${img.uri}-${i}`} style={styles.thumbWrap}>
                    <Image source={{ uri: img.uri }} style={styles.thumb} />
                    <Pressable
                      onPress={() => removeImage(i)}
                      style={styles.thumbRemove}
                      hitSlop={6}
                    >
                      <Feather name="x" size={12} color="#fff" />
                    </Pressable>
                  </View>
                ))}
              </View>
            )}

            {images.length < MAX_IMAGES && (
              <Pressable
                onPress={pickImages}
                disabled={picking}
                style={({ pressed }) => [
                  styles.addBtn,
                  {
                    borderColor: colors.border,
                    backgroundColor: pressed ? colors.muted + "55" : "transparent",
                    opacity: picking ? 0.6 : 1,
                  },
                ]}
              >
                {picking ? (
                  <ActivityIndicator color={colors.mutedForeground} size="small" />
                ) : (
                  <>
                    <Feather name="plus" size={16} color={colors.mutedForeground} />
                    <Text
                      style={{
                        fontFamily: fonts.displayMedium,
                        fontSize: 13,
                        color: colors.mutedForeground,
                      }}
                    >
                      {images.length === 0 ? "Add images" : "Add another"}
                    </Text>
                  </>
                )}
              </Pressable>
            )}
          </View>

          <Pressable
            onPress={handleSubmit}
            disabled={!canSubmit}
            style={({ pressed }) => [
              styles.submitBtn,
              {
                backgroundColor: colors.grass,
                opacity: !canSubmit ? 0.5 : pressed ? 0.9 : 1,
              },
            ]}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Feather name="send" size={16} color="#fff" />
                <Text
                  style={{
                    fontFamily: fonts.displaySemibold,
                    fontSize: 15,
                    color: "#fff",
                  }}
                >
                  Send Feedback
                </Text>
              </>
            )}
          </Pressable>

          <Text
            style={{
              fontFamily: fonts.display,
              fontSize: 11,
              color: colors.mutedForeground,
              textAlign: "center",
              lineHeight: 16,
              marginTop: 4,
            }}
          >
            Your name and email will be sent along with your feedback so we can follow up if needed.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
  },
  input: {
    fontSize: 15,
    lineHeight: 22,
    minHeight: 160,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 6,
  },
  charCountRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingHorizontal: 14,
    paddingBottom: 10,
  },
  attachHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  thumbRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  thumbWrap: {
    width: 72,
    height: 72,
    borderRadius: 12,
    overflow: "hidden",
    position: "relative",
  },
  thumb: {
    width: "100%",
    height: "100%",
  },
  thumbRemove: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "rgba(0,0,0,0.65)",
    alignItems: "center",
    justifyContent: "center",
  },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: "dashed",
  },
  submitBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 4,
  },
});
