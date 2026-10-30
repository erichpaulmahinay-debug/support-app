import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  ScrollView,
  Alert,
  ActivityIndicator,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { StatusBar } from "expo-status-bar";

const CATEGORIES = [
  { label: "Account Problem", icon: "👤" },
  { label: "Technical Issue", icon: "🛠️" },
  { label: "Payment Concern", icon: "💳" },
  { label: "Other", icon: "💬" },
];

const MAX_MESSAGE = 500;

const CLOUD_NAME = process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME;
const UPLOAD_PRESET = process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET;
const EMAILJS_SERVICE_ID = process.env.EXPO_PUBLIC_EMAILJS_SERVICE_ID;
const EMAILJS_TEMPLATE_ID = process.env.EXPO_PUBLIC_EMAILJS_TEMPLATE_ID;
const EMAILJS_PUBLIC_KEY = process.env.EXPO_PUBLIC_EMAILJS_PUBLIC_KEY;

// Design mode: true when any .env key is missing.
// In design mode the send is simulated, so you can work on the UI without keys.
const HAS_KEYS = !!(
  CLOUD_NAME &&
  UPLOAD_PRESET &&
  EMAILJS_SERVICE_ID &&
  EMAILJS_TEMPLATE_ID &&
  EMAILJS_PUBLIC_KEY
);

// Alert.alert does nothing on web, so use window.alert there
const notify = (title, msg) =>
  Platform.OS === "web"
    ? window.alert(`${title}\n${msg}`)
    : Alert.alert(title, msg);

// Input that highlights its border while focused
function Field({ style, ...props }) {
  const [focused, setFocused] = useState(false);
  return (
    <TextInput
      {...props}
      placeholderTextColor="#9aa3b5"
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={[styles.input, focused && styles.inputFocused, style]}
    />
  );
}

export default function App() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [category, setCategory] = useState("");
  const [message, setMessage] = useState("");
  const [imageUri, setImageUri] = useState(null);
  const [loading, setLoading] = useState(false);

  // ---------- Image picker ----------
  const pickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      notify(
        "Permission needed",
        "Allow photo access in your phone settings to attach a screenshot."
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.8,
    });

    if (result.canceled) return; // user cancelled, keep current image
    setImageUri(result.assets[0].uri);
  };

  const removeImage = () => setImageUri(null);

  // ---------- Validation ----------
  const validate = () => {
    if (!name.trim()) return "Please enter your name.";
    if (!/^\S+@\S+\.\S+$/.test(email.trim()))
      return "Please enter a valid email address.";
    if (!category) return "Please choose an issue category.";
    if (!message.trim()) return "Please describe your issue.";
    if (!imageUri) return "Please attach a screenshot.";
    return null;
  };

  // ---------- Submit ----------
  const handleSubmit = async () => {
    if (loading) return; // block duplicate submissions

    const error = validate();
    if (error) {
      notify("Missing information", error);
      return;
    }

    setLoading(true);
    try {
      // Design mode: no .env keys, so fake the send
      if (!HAS_KEYS) {
        await new Promise((r) => setTimeout(r, 1500));
        notify(
          "Design mode",
          "No .env keys found, so nothing was actually sent."
        );
        return;
      }

      // 1. Upload screenshot to Cloudinary
      const formData = new FormData();
      if (Platform.OS === "web") {
        // Browsers need a real Blob/File, not the {uri, type, name} object
        const blob = await (await fetch(imageUri)).blob();
        formData.append("file", blob, "screenshot.jpg");
      } else {
        formData.append("file", {
          uri: imageUri,
          type: "image/jpeg",
          name: "screenshot.jpg",
        });
      }
      formData.append("upload_preset", UPLOAD_PRESET);

      const uploadRes = await fetch(
        `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
        { method: "POST", body: formData }
      );
      const uploadData = await uploadRes.json();

      // If upload fails, stop here: the email is NOT sent
      if (!uploadRes.ok || !uploadData.secure_url) {
        throw new Error(
          uploadData?.error?.message || "Screenshot upload failed."
        );
      }

      // 2. Send email with EmailJS using the returned image URL
      const emailRes = await fetch(
        "https://api.emailjs.com/api/v1.0/email/send",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            service_id: EMAILJS_SERVICE_ID,
            template_id: EMAILJS_TEMPLATE_ID,
            user_id: EMAILJS_PUBLIC_KEY,
            template_params: {
              name: name.trim(),
              reply_to: email.trim(),
              issue_category: category,
              message: message.trim(),
              image_url: uploadData.secure_url,
            },
          }),
        }
      );

      if (!emailRes.ok) {
        const text = await emailRes.text();
        throw new Error(text || "Email failed to send.");
      }

      notify("Success", "Your support request was sent.");
      setName("");
      setEmail("");
      setCategory("");
      setMessage("");
      setImageUri(null);
    } catch (e) {
      console.log("SUBMIT ERROR:", e);
      notify("Error", e.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <StatusBar style="light" />
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* ---------- Hero header ---------- */}
        <View style={styles.hero}>
          <View style={styles.heroCircleBig} />
          <View style={styles.heroCircleSmall} />
          <View style={styles.heroBadge}>
            <Text style={styles.heroBadgeText}>🎧 Support Center</Text>
          </View>
          <Text style={styles.title}>How can we help?</Text>
          <Text style={styles.subtitle}>
            Tell us what went wrong and attach a screenshot. We usually reply
            within a day.
          </Text>
        </View>

        {/* ---------- Form card ---------- */}
        <View style={styles.card}>
          {!HAS_KEYS && (
            <View style={styles.banner}>
              <Text style={styles.bannerText}>
                🎨 Design mode: no .env found, sending is simulated.
              </Text>
            </View>
          )}

          <Text style={styles.label}>Name</Text>
          <Field
            value={name}
            onChangeText={setName}
            placeholder="Your full name"
            editable={!loading}
          />

          <Text style={styles.label}>Email address</Text>
          <Field
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            editable={!loading}
          />

          <Text style={styles.label}>Issue category</Text>
          <View style={styles.chips}>
            {CATEGORIES.map((c) => {
              const active = category === c.label;
              return (
                <TouchableOpacity
                  key={c.label}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => setCategory(c.label)}
                  disabled={loading}
                  activeOpacity={0.8}
                >
                  <Text style={styles.chipIcon}>{c.icon}</Text>
                  <Text
                    style={[styles.chipText, active && styles.chipTextActive]}
                  >
                    {c.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.labelRow}>
            <Text style={[styles.label, styles.labelInRow]}>Message</Text>
            <Text style={styles.counter}>
              {message.length}/{MAX_MESSAGE}
            </Text>
          </View>
          <Field
            style={styles.textArea}
            value={message}
            onChangeText={setMessage}
            placeholder="Describe the problem"
            multiline
            maxLength={MAX_MESSAGE}
            textAlignVertical="top"
            editable={!loading}
          />

          <Text style={styles.label}>Screenshot</Text>
          {imageUri ? (
            <View>
              <Image source={{ uri: imageUri }} style={styles.preview} />
              <View style={styles.row}>
                <TouchableOpacity
                  style={[styles.secondaryBtn, styles.flex]}
                  onPress={pickImage}
                  disabled={loading}
                  activeOpacity={0.8}
                >
                  <Text style={styles.secondaryText}>🔄 Change</Text>
                </TouchableOpacity>
                <View style={styles.gap} />
                <TouchableOpacity
                  style={[styles.dangerBtn, styles.flex]}
                  onPress={removeImage}
                  disabled={loading}
                  activeOpacity={0.8}
                >
                  <Text style={styles.dangerText}>🗑️ Remove</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.dropzone}
              onPress={pickImage}
              disabled={loading}
              activeOpacity={0.8}
            >
              <Text style={styles.dropIcon}>📷</Text>
              <Text style={styles.dropTitle}>Upload screenshot</Text>
              <Text style={styles.dropHint}>Tap to choose an image</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.submitBtn, loading && styles.submitDisabled]}
            onPress={handleSubmit}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitText}>Send request  ➤</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const PRIMARY = "#6d28d9"; // violet
const PRIMARY_DARK = "#4c1d95";
const PRIMARY_SOFT = "#ede9fe";
const INK = "#1e1b4b";
const MUTED = "#6b7280";
const BORDER = "#e5e7eb";

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: { backgroundColor: "#f5f3ff" },
  scrollContent: { paddingBottom: 40 },

  // Hero
  hero: {
    backgroundColor: PRIMARY_DARK,
    paddingTop: 70,
    paddingHorizontal: 24,
    paddingBottom: 90,
    borderBottomLeftRadius: 36,
    borderBottomRightRadius: 36,
    overflow: "hidden",
  },
  heroCircleBig: {
    position: "absolute",
    top: -60,
    right: -50,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: PRIMARY,
    opacity: 0.55,
  },
  heroCircleSmall: {
    position: "absolute",
    bottom: -30,
    left: -30,
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: "#a78bfa",
    opacity: 0.25,
  },
  heroBadge: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,255,255,0.18)",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    marginBottom: 14,
  },
  heroBadgeText: { color: "#fff", fontSize: 13, fontWeight: "600" },
  title: { fontSize: 32, fontWeight: "800", color: "#fff" },
  subtitle: { fontSize: 15, color: "#ddd6fe", marginTop: 8, lineHeight: 22 },

  // Card
  card: {
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginTop: -56,
    borderRadius: 24,
    padding: 20,
    shadowColor: "#4c1d95",
    shadowOpacity: 0.15,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  banner: {
    backgroundColor: "#fef3c7",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 6,
  },
  bannerText: { color: "#92400e", fontSize: 13, fontWeight: "600" },

  // Labels and inputs
  label: {
    fontSize: 13,
    fontWeight: "700",
    color: INK,
    marginTop: 18,
    marginBottom: 8,
    letterSpacing: 0.3,
    textTransform: "uppercase",
  },
  labelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  labelInRow: { marginBottom: 8 },
  counter: { fontSize: 12, color: MUTED, marginBottom: 8 },
  input: {
    backgroundColor: "#faf9ff",
    borderWidth: 1.5,
    borderColor: BORDER,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 15,
    color: INK,
  },
  inputFocused: { borderColor: PRIMARY, backgroundColor: "#fff" },
  textArea: { height: 120 },

  // Category chips
  chips: { flexDirection: "row", flexWrap: "wrap" },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: BORDER,
    backgroundColor: "#fff",
    borderRadius: 24,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginRight: 8,
    marginBottom: 8,
  },
  chipActive: { backgroundColor: PRIMARY, borderColor: PRIMARY },
  chipIcon: { fontSize: 14, marginRight: 6 },
  chipText: { color: INK, fontSize: 14, fontWeight: "600" },
  chipTextActive: { color: "#fff" },

  // Screenshot
  dropzone: {
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: "#c4b5fd",
    backgroundColor: PRIMARY_SOFT,
    borderRadius: 16,
    paddingVertical: 28,
    alignItems: "center",
  },
  dropIcon: { fontSize: 32, marginBottom: 6 },
  dropTitle: { color: PRIMARY, fontSize: 16, fontWeight: "700" },
  dropHint: { color: MUTED, fontSize: 13, marginTop: 2 },
  preview: {
    width: "100%",
    height: 220,
    borderRadius: 16,
    marginBottom: 12,
    resizeMode: "cover",
  },
  row: { flexDirection: "row" },
  gap: { width: 10 },
  secondaryBtn: {
    backgroundColor: PRIMARY_SOFT,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: "center",
  },
  secondaryText: { color: PRIMARY, fontWeight: "700" },
  dangerBtn: {
    backgroundColor: "#fee2e2",
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: "center",
  },
  dangerText: { color: "#b91c1c", fontWeight: "700" },

  // Submit
  submitBtn: {
    backgroundColor: PRIMARY,
    borderRadius: 16,
    paddingVertical: 17,
    alignItems: "center",
    marginTop: 28,
    shadowColor: PRIMARY,
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  submitDisabled: { opacity: 0.6 },
  submitText: { color: "#fff", fontWeight: "800", fontSize: 17, letterSpacing: 0.3 },
});