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
  "Account Problem",
  "Technical Issue",
  "Payment Concern",
  "Other",
];

const CLOUD_NAME = process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME;
const UPLOAD_PRESET = process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET;
const EMAILJS_SERVICE_ID = process.env.EXPO_PUBLIC_EMAILJS_SERVICE_ID;
const EMAILJS_TEMPLATE_ID = process.env.EXPO_PUBLIC_EMAILJS_TEMPLATE_ID;
const EMAILJS_PUBLIC_KEY = process.env.EXPO_PUBLIC_EMAILJS_PUBLIC_KEY;
const SUPPORT_EMAIL = process.env.EXPO_PUBLIC_SUPPORT_EMAIL;

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
              to_email: SUPPORT_EMAIL,
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
      <StatusBar style="dark" />
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        {!HAS_KEYS && (
          <Text style={styles.banner}>
          
          </Text>
        )}

        <Text style={styles.title}>Contact support</Text>
        <Text style={styles.subtitle}>
          Tell us what went wrong and attach a screenshot.
        </Text>

        <Text style={styles.label}>Name</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="Your full name"
          editable={!loading}
        />

        <Text style={styles.label}>Email address</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
          editable={!loading}
        />

        <Text style={styles.label}>Issue category</Text>
        <View style={styles.chips}>
          {CATEGORIES.map((c) => (
            <TouchableOpacity
              key={c}
              style={[styles.chip, category === c && styles.chipActive]}
              onPress={() => setCategory(c)}
              disabled={loading}
            >
              <Text
                style={[
                  styles.chipText,
                  category === c && styles.chipTextActive,
                ]}
              >
                {c}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Message</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={message}
          onChangeText={setMessage}
          placeholder="Describe the problem"
          multiline
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
              >
                <Text style={styles.secondaryText}>Change</Text>
              </TouchableOpacity>
              <View style={styles.gap} />
              <TouchableOpacity
                style={[styles.secondaryBtn, styles.flex]}
                onPress={removeImage}
                disabled={loading}
              >
                <Text style={styles.secondaryText}>Remove</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={pickImage}
            disabled={loading}
          >
            <Text style={styles.secondaryText}>Upload screenshot</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[styles.submitBtn, loading && styles.submitDisabled]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitText}>Send request</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { padding: 20, paddingTop: 60, backgroundColor: "#f7f8fa" },
  banner: { color: "#b45309", marginBottom: 8, fontSize: 13 },
  title: { fontSize: 26, fontWeight: "700", color: "#14213d" },
  subtitle: { fontSize: 14, color: "#5c677d", marginBottom: 18, marginTop: 4 },
  label: { fontSize: 14, fontWeight: "600", color: "#14213d", marginTop: 14, marginBottom: 6 },
  input: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#d0d5dd",
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
  },
  textArea: { height: 110 },
  chips: { flexDirection: "row", flexWrap: "wrap" },
  chip: {
    borderWidth: 1,
    borderColor: "#d0d5dd",
    backgroundColor: "#fff",
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 14,
    marginRight: 8,
    marginBottom: 8,
  },
  chipActive: { backgroundColor: "#1d4ed8", borderColor: "#1d4ed8" },
  chipText: { color: "#14213d", fontSize: 14 },
  chipTextActive: { color: "#fff" },
  preview: { width: "100%", height: 220, borderRadius: 8, marginBottom: 10, resizeMode: "cover" },
  row: { flexDirection: "row" },
  gap: { width: 10 },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: "#1d4ed8",
    borderRadius: 8,
    padding: 12,
    alignItems: "center",
  },
  secondaryText: { color: "#1d4ed8", fontWeight: "600" },
  submitBtn: {
    backgroundColor: "#1d4ed8",
    borderRadius: 8,
    padding: 15,
    alignItems: "center",
    marginTop: 24,
    marginBottom: 40,
  },
  submitDisabled: { opacity: 0.6 },
  submitText: { color: "#fff", fontWeight: "700", fontSize: 16 },
});