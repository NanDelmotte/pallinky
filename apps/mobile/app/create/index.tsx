// apps/mobile/app/create/index.tsx

import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, Stack } from "expo-router";
import { StyledText } from "@pallinky/ui";
import { Ionicons } from "@expo/vector-icons";
import { useSession } from "@pallinky/core";
import { useI18n } from "@pallinky/i18n/client";
import type { TranslationKey } from "@pallinky/i18n/types";

type QuickStart = {
  labelKey: TranslationKey;
  icon: keyof typeof Ionicons.glyphMap;
  route: "/create/vibe" | "/create/formal";
  params: { prefill_title: TranslationKey; prefill_desc: TranslationKey };
  featured?: boolean;
};

type CustomQuickStart = {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
};

const COLORS = {
  background: "#EEF2EC",
  surface: "#FFFFFF",
  text: "#162014",
  textMuted: "#4F5B4A",
  primary: "#355a16",
  secondary: "#5E3F86",
  secondaryBg: "#e9e0f3",
  border: "#d7e0d0",
  borderStrong: "#97aa86",
  danger: "#c62828",
  dangerBorder: "#f6d9d9",
  iconBg: "#e9efe3",
  overlay: "rgba(22, 32, 20, 0.34)",
};

const CUSTOM_CARDS_KEY = "pallinky:create:custom-cards";
const MAX_CUSTOM_CARDS = 3;

const CUSTOM_ICON_OPTIONS: Array<keyof typeof Ionicons.glyphMap> = [
  "book-outline",
  "school-outline",
  "brush-outline",
  "musical-notes-outline",
  "fitness-outline",
  "paw-outline",
  "leaf-outline",
  "heart-outline",
  "bicycle-outline",
];

const AMBIENT_LINE_KEYS: TranslationKey[] = [
  "create_ambient_1",
  "create_ambient_2",
  "create_ambient_3",
  "create_ambient_4",
  "create_ambient_5",
  "create_ambient_6",
  "create_ambient_7",
];

const QUICK_STARTS: QuickStart[] = [
  {
    labelKey: "create_quick_start",
    icon: "add-outline",
    route: "/create/vibe",
    params: {
      prefill_title: "create_prefill_event",
      prefill_desc: "create_prefill_details",
    },
  },
  {
    labelKey: "create_quick_coffee",
    icon: "cafe-outline",
    route: "/create/vibe",
    params: {
      prefill_title: "create_prefill_coffee_title",
      prefill_desc: "create_prefill_coffee_desc",
    },
  },
  {
    labelKey: "create_trendy_dinner",
    icon: "restaurant-outline",
    route: "/create/formal",
    params: {
      prefill_title: "create_prefill_dinner_title",
      prefill_desc: "create_prefill_dinner_desc",
    },
  },
  {
    labelKey: "create_casual_drinks",
    icon: "wine-outline",
    route: "/create/vibe",
    params: {
      prefill_title: "create_prefill_drinks_title",
      prefill_desc: "create_prefill_drinks_desc",
    },
  },
  {
    labelKey: "create_take_walk",
    icon: "walk-outline",
    route: "/create/vibe",
    params: {
      prefill_title: "create_prefill_walk_title",
      prefill_desc: "create_prefill_walk_desc",
    },
  },
  {
    labelKey: "create_visit_museum",
    icon: "business-outline",
    route: "/create/vibe",
    params: {
      prefill_title: "create_prefill_museum_title",
      prefill_desc: "create_prefill_museum_desc",
    },
  },
];

export default function CreateLaunchpad() {
  const { session } = useSession();
  const { t } = useI18n();
  const [customCards, setCustomCards] = useState<CustomQuickStart[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [customLabel, setCustomLabel] = useState("");
  const [selectedIcon, setSelectedIcon] =
    useState<keyof typeof Ionicons.glyphMap>("book-outline");

  const ambientLine = useMemo(() => {
    return t(
      AMBIENT_LINE_KEYS[Math.floor(Math.random() * AMBIENT_LINE_KEYS.length)],
    );
  }, [t]);

  useEffect(() => {
    AsyncStorage.getItem(CUSTOM_CARDS_KEY).then((raw) => {
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed))
        setCustomCards(parsed.slice(0, MAX_CUSTOM_CARDS));
    });
  }, []);

  const featuredCards = QUICK_STARTS.filter((i) => i.featured);
  const activityCards = QUICK_STARTS.filter((i) => !i.featured);

  const openQuickStart = (item: QuickStart) => {
    router.push({
      pathname: item.route,
      params: {
        prefill_title: t(item.params.prefill_title),
        prefill_desc: t(item.params.prefill_desc),
        prefill_nonce: String(Date.now()),
      },
    });
  };

  const openCustomCard = (item: CustomQuickStart) => {
    router.push({
      pathname: "/create/vibe",
      params: { prefill_title: `${item.label}?`, prefill_desc: "" },
    });
  };

  const handleClose = () => {
    router.replace("/(tabs)" as any);
  };
  const saveCustomCards = async (next: CustomQuickStart[]) => {
    setCustomCards(next);
    await AsyncStorage.setItem(CUSTOM_CARDS_KEY, JSON.stringify(next));
  };

  const handleDeleteCustomCard = (label: string) => {
    Alert.alert(
      t("create_delete_card_title"),
      t("create_delete_card_body", { label }),
      [
        { text: t("common_cancel"), style: "cancel" },
        {
          text: t("common_delete"),
          style: "destructive",
          onPress: () =>
            saveCustomCards(customCards.filter((c) => c.label !== label)),
        },
      ],
    );
  };

  const handleAddCustomCard = async () => {
    const trimmed = customLabel.trim();
    if (!trimmed)
      return Alert.alert(
        t("create_missing_title"),
        t("create_missing_title_body"),
      );
    if (customCards.length >= MAX_CUSTOM_CARDS)
      return Alert.alert(t("create_limit_reached"));

    await saveCustomCards([
      ...customCards,
      { label: trimmed, icon: selectedIcon },
    ]);
    setCustomLabel("");
    setShowAddModal(false);
  };

  return (
    <View style={styles.wrapper}>
      <Stack.Screen options={{ headerShown: false }} />

      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topRow}>
          <TouchableOpacity onPress={handleClose}>
            <Ionicons name="close" size={30} color={COLORS.primary} />
          </TouchableOpacity>

          {!session ? (
            <TouchableOpacity
              onPress={() => router.push("/auth/verify")}
              style={styles.signInButton}
            >
              <StyledText style={styles.signInText}>
                {t("common_sign_in")}
              </StyledText>
            </TouchableOpacity>
          ) : (
            <View />
          )}
        </View>

        <StyledText style={styles.title}>{t("create_title")}</StyledText>
        <StyledText style={styles.ambientLine}>{ambientLine}</StyledText>

        <View style={styles.grid}>
          {customCards.map((item) => (
            <TouchableOpacity
              key={item.label}
              style={styles.gridCard}
              onPress={() => openCustomCard(item)}
            >
              <TouchableOpacity
                style={styles.deleteBadge}
                onPress={() => handleDeleteCustomCard(item.label)}
              >
                <Ionicons name="close" size={14} color={COLORS.danger} />
              </TouchableOpacity>

              <View style={styles.gridIconCircle}>
                <Ionicons name={item.icon} size={24} color={COLORS.primary} />
              </View>
              <StyledText style={styles.gridLabel} numberOfLines={2}>
                {item.label}
              </StyledText>
            </TouchableOpacity>
          ))}

          {activityCards.map((item) => (
            <TouchableOpacity
              key={item.labelKey}
              style={styles.gridCard}
              onPress={() => openQuickStart(item)}
            >
              <View style={styles.gridIconCircle}>
                <Ionicons name={item.icon} size={24} color={COLORS.primary} />
              </View>
              <StyledText style={styles.gridLabel} numberOfLines={2}>
                {t(item.labelKey)}
              </StyledText>
            </TouchableOpacity>
          ))}
        </View>
        <View style={styles.featuredWrap}>
          {featuredCards.map((item) => (
            <TouchableOpacity
              key={item.labelKey}
              style={styles.featuredCard}
              onPress={() => openQuickStart(item)}
            >
              <View style={styles.featuredIconCircle}>
                <Ionicons name={item.icon} size={24} color={COLORS.secondary} />
              </View>
              <View style={{ flex: 1 }}>
                <StyledText style={styles.featuredTitle}>
                  {t(item.labelKey)}
                </StyledText>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#7A6A95" />
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      <Modal visible={showAddModal} transparent animationType="fade">
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View style={styles.modalCard}>
            <StyledText style={styles.modalTitle}>
              {t("create_add_card")}
            </StyledText>

            <TextInput
              value={customLabel}
              onChangeText={setCustomLabel}
              placeholder={t("create_card_placeholder")}
              placeholderTextColor={COLORS.textMuted}
              style={styles.modalInput}
            />

            <View style={styles.iconPickerRow}>
              {CUSTOM_ICON_OPTIONS.map((icon) => (
                <TouchableOpacity
                  key={icon}
                  style={[
                    styles.iconOption,
                    selectedIcon === icon && styles.iconOptionSelected,
                  ]}
                  onPress={() => setSelectedIcon(icon)}
                >
                  <Ionicons name={icon} size={20} color={COLORS.text} />
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.modalActions}>
              <StyledText
                style={styles.modalCancel}
                onPress={() => setShowAddModal(false)}
              >
                {t("common_cancel")}
              </StyledText>
              <TouchableOpacity
                style={styles.modalSaveBtn}
                onPress={handleAddCustomCard}
              >
                <StyledText style={styles.modalSaveText}>
                  {t("create_save_card")}
                </StyledText>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: COLORS.background },
  container: { padding: 20, paddingTop: 80 },

  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },

  signInButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#F3F5F2",
    borderWidth: 1,
    borderColor: "#C9D5BE",
  },

  signInText: {
    color: "#5F6B59",
    fontSize: 12,
    fontWeight: "700",
  },

  title: { fontSize: 34, fontWeight: "900", color: COLORS.text },
  ambientLine: {
    color: COLORS.textMuted,
    marginBottom: 18,
    fontSize: 15,
    lineHeight: 21,
  },

  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },

  gridCard: {
    width: "31.5%",
    backgroundColor: "#F7FAF4",
    borderRadius: 20,
    paddingVertical: 16,
    paddingHorizontal: 10,
    alignItems: "center",
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#A8B997",
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },

  gridIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#DEE7D6",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
  },

  gridLabel: {
    fontWeight: "700",
    color: COLORS.text,
    textAlign: "center",
    width: "100%",
    fontSize: 13,
    lineHeight: 16,
  },

  addOwnCard: {
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: "#A8B997",
    backgroundColor: "#F7FAF4",
  },

  deleteBadge: {
    position: "absolute",
    top: 6,
    right: 6,
    backgroundColor: COLORS.dangerBorder,
    borderColor: COLORS.danger,
    borderWidth: 1,
    borderRadius: 10,
    padding: 2,
  },

  featuredWrap: { gap: 12 },

  modalCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  featuredIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#E8DEF1",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },

  featuredTitle: { fontSize: 16, fontWeight: "700", color: COLORS.text },

  modalOverlay: {
    flex: 1,
    backgroundColor: COLORS.overlay,
    justifyContent: "center",
    padding: 24,
  },

  modalTitle: { fontSize: 22, fontWeight: "900", color: COLORS.text },

  modalInput: {
    backgroundColor: "#FFFFFF",
    borderColor: COLORS.borderStrong,
    borderWidth: 1.5,
    borderRadius: 14,
    padding: 14,
    marginTop: 12,
    color: COLORS.text,
  },

  iconPickerRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginVertical: 16,
  },

  iconOption: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.iconBg,
    justifyContent: "center",
    alignItems: "center",
  },
  featuredCard: {
    backgroundColor: "#F8FAF7",
    borderRadius: 20,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#A8B997",
  },
  iconOptionSelected: {
    borderWidth: 2,
    borderColor: COLORS.primary,
    backgroundColor: "#eef4e8",
  },

  modalActions: { flexDirection: "row", justifyContent: "space-between" },

  modalCancel: { color: COLORS.text, fontWeight: "700" },

  modalSaveBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },

  modalSaveText: { color: "#fff", fontWeight: "800" },
});
