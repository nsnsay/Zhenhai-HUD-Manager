<script setup lang="ts">
import { ref, watch, computed } from "vue";
import { usePlayersStore } from "@renderer/stores/usePlayersStore";
import type { PlayerRecord } from "@renderer/stores/usePlayersStore";
import { countryFlags } from "@renderer/utils/country-flags";
import { useCurrentTournament } from "@renderer/stores/useCurrentTournament";
import { getAssetUrl } from "@renderer/utils/assets-url";
import { PlayerFormData } from "@zhenhai/csgogsi/types";
import { rendererLogger } from "@renderer/utils/logger";

const currentTournament = useCurrentTournament();
const playersStore = usePlayersStore();
const toast = useToast();

interface OptionItem {
  label: string;
  value: string;
  avatar?: { src: string; alt?: string };
}

const countryItems: OptionItem[] = [
  { label: "China", value: "CN", avatar: { src: countryFlags.CN, alt: "CN" } },
  { label: "Mongolia", value: "MN", avatar: { src: countryFlags.MN, alt: "MN" } },
  { label: "Russia", value: "RU", avatar: { src: countryFlags.RU, alt: "RU" } },
  { label: "USA", value: "US", avatar: { src: countryFlags.US, alt: "US" } },
  { label: "France", value: "FR", avatar: { src: countryFlags.FR, alt: "FR" } },
  { label: "Denmark", value: "DK", avatar: { src: countryFlags.DK, alt: "DK" } },
  { label: "Ukraine", value: "UA", avatar: { src: countryFlags.UA, alt: "UA" } },
  { label: "Brazil", value: "BR", avatar: { src: countryFlags.BR, alt: "BR" } },
  { label: "Germany", value: "DE", avatar: { src: countryFlags.DE, alt: "DE" } },
  { label: "Poland", value: "PL", avatar: { src: countryFlags.PL, alt: "PL" } },
  { label: "Sweden", value: "SE", avatar: { src: countryFlags.SE, alt: "SE" } },
  { label: "Finland", value: "FI", avatar: { src: countryFlags.FI, alt: "FI" } },
  { label: "Kazakhstan", value: "KZ", avatar: { src: countryFlags.KZ, alt: "KZ" } },
  { label: "Australia", value: "AU", avatar: { src: countryFlags.AU, alt: "AU" } },
  { label: "Canada", value: "CA", avatar: { src: countryFlags.CA, alt: "CA" } },
  { label: "UK", value: "GB", avatar: { src: countryFlags.GB, alt: "GB" } },
  { label: "Europe (Mixed)", value: "EU", avatar: { src: countryFlags.EU, alt: "EU" } },
  { label: "International", value: "INT", avatar: { src: countryFlags.INT, alt: "INT" } },
];

function createDefaultPlayerData(): PlayerFormData {
  return {
    playerName: "",
    playerRealName: "",
    playerAvatar: "",
    playerSteamID: "",
    playerCountry: "",
    playerCameraURL: "",
  };
}

const playerData = ref<PlayerFormData>(createDefaultPlayerData());

const editId = ref<string | null>(null);

function openEdit(player: PlayerRecord) {
  editId.value = player.id;
  playerData.value = {
    playerName: player.playerName ?? "",
    playerRealName: player.playerRealName ?? "",
    playerAvatar: player.playerAvatar ?? "",
    playerSteamID: player.playerSteamID ? String(player.playerSteamID) : "",
    playerCountry: player.playerCountry ?? "",
    playerCameraURL: player.playerCameraURL ?? "",
  };
  avatarFile.value = null;
  if (previewUrl.value) {
    URL.revokeObjectURL(previewUrl.value);
    previewUrl.value = "";
  }
  open.value = true;
}

defineExpose({ openEdit });

const avatarFile = ref<File | null>(null);
const previewUrl = ref("");
const MAX_AVATAR_SIZE = 16 * 1024 * 1024;

watch(avatarFile, (file) => {
  if (previewUrl.value) {
    URL.revokeObjectURL(previewUrl.value);
    previewUrl.value = "";
  }
  if (!file) return;
  if (!file.type || !file.type.startsWith("image/")) {
    toast.add({
      title: "Invalid File",
      description: "Please select an image file.",
      icon: "i-lucide-alert-triangle",
      color: "warning",
    });
    avatarFile.value = null;
    return;
  }
  if (file.size > MAX_AVATAR_SIZE) {
    toast.add({
      title: "File Too Large",
      description: "Avatar must be less than 16 MB.",
      icon: "i-lucide-alert-triangle",
      color: "warning",
    });
    avatarFile.value = null;
    return;
  }
  previewUrl.value = URL.createObjectURL(file);
});

const displayPreview = computed(() => {
  if (previewUrl.value) return previewUrl.value;
  if (playerData.value.playerAvatar) return getAssetUrl(playerData.value.playerAvatar);
  return "";
});

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve((e.target?.result as string) ?? "");
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function isValidSteamID(value: string): boolean {
  if (!value) return true;
  return /^\d{15,17}$/.test(value);
}

const open = ref(false);
const isSubmitting = ref(false);

watch(open, (newVal) => {
  if (!newVal) resetForm();
});

function resetForm() {
  editId.value = null;
  playerData.value = createDefaultPlayerData();
  avatarFile.value = null;
  if (previewUrl.value) {
    URL.revokeObjectURL(previewUrl.value);
    previewUrl.value = "";
  }
}

async function handleSubmit(close: () => void) {
  if (isSubmitting.value) return;
  if (!playerData.value.playerName.trim()) {
    toast.add({
      title: "Validation Error",
      description: "Player name is required.",
      icon: "i-lucide-alert-triangle",
      color: "warning",
    });
    return;
  }
  if (!isValidSteamID(playerData.value.playerSteamID)) {
    toast.add({
      title: "Validation Error",
      description: "Steam ID must be a 15-17 digit number.",
      icon: "i-lucide-alert-triangle",
      color: "warning",
    });
    return;
  }

  isSubmitting.value = true;
  try {
    let avatarPath = playerData.value.playerAvatar;
    const file = avatarFile.value;

    if (file) {
      const base64 = await fileToBase64(file);
      const ext = file.name.split(".").pop() || "png";
      const prefix =
        playerData.value.playerSteamID ||
        playerData.value.playerName ||
        crypto.randomUUID().slice(0, 8);
      const fileName = `${prefix}-${Date.now()}.${ext}`;
      const saveResult = await window.api.file.save(base64, fileName, "player-avatars");
      if (saveResult.success) {
        avatarPath = saveResult.data ?? avatarPath;
        rendererLogger.info("PlayerModal", "Player avatar uploaded", { path: avatarPath });
      }
    }

    const submitData: PlayerFormData = {
      playerName: playerData.value.playerName,
      playerRealName: playerData.value.playerRealName,
      playerAvatar: avatarPath,
      playerSteamID: playerData.value.playerSteamID,
      playerCountry: playerData.value.playerCountry,
      playerCameraURL: playerData.value.playerCameraURL,
    };

    let result;
    if (editId.value) {
      result = await playersStore.update(editId.value, submitData);
    } else {
      result = await playersStore.create({
        ...submitData,
        tournamentId: currentTournament.currentId,
      });
    }

    if (result.success) {
      rendererLogger.info("PlayerModal", editId.value ? "Player updated" : "Player created", {
        id: result.data?.id ?? editId.value,
        name: playerData.value.playerName,
      });
      toast.add({
        title: editId.value ? "Player Updated" : "Player Created",
        description: `"${playerData.value.playerName}" saved.`,
        icon: "i-lucide-check-circle",
      });
      close();
    } else {
      rendererLogger.error("PlayerModal", "Player save failed", result.error);
      toast.add({
        title: "Failed",
        description: result.error ?? "Unknown error",
        icon: "i-lucide-x-circle",
        color: "error",
      });
    }
  } finally {
    isSubmitting.value = false;
  }
}
</script>

<template>
  <UModal v-model:open="open" :title="editId ? 'Edit Player' : 'Create Player'"
    :description="editId ? 'Update player information' : 'Player Name, Avatar, Steam ID'"
    :ui="{ footer: 'justify-end', content: 'min-w-120', body: 'flex flex-col gap-2' }">
    <UButton icon="i-lucide-plus" label="Create Player" color="primary" />
    <template #body>
      <div class="flex justify-between w-full">
        <UFormField label="Player Name" name="playerName" required>
          <UInput v-model="playerData.playerName" placeholder="e.g. ZywOo" class="w-48" />
        </UFormField>
        <UFormField label="Real Name" name="playerRealName" hint="Optional">
          <UInput v-model="playerData.playerRealName" placeholder="e.g. Mathieu Herbaut" class="w-48" />
        </UFormField>
      </div>
      <div class="flex justify-between w-full">
        <UFormField label="Steam ID (64)" name="playerSteamID" required>
          <UInput v-model="playerData.playerSteamID" placeholder="e.g. 76561198012345678" class="w-48" />
        </UFormField>
        <UFormField label="Country / Region" name="playerCountry" hint="Optional">
          <USelect v-model="playerData.playerCountry" :items="countryItems" value-key="value" class="w-48" :ui="{
            trailingIcon: 'group-data-[state=open]:rotate-180 transition-transform duration-200',
          }" />
        </UFormField>
      </div>
      <div class="flex justify-between w-full">
        <UFormField label="Camera URL" name="cameraURL" hint="Optional">
          <UInput v-model="playerData.playerCameraURL" placeholder="e.g. http://localhost:3000/1000.flv" class="w-48" />
        </UFormField>
      </div>
      <UFormField label="Avatar" name="Player Avatar" hint="Optional">
        <UFileUpload v-model="avatarFile" accept="image/*" class="w-full h-32" label="Drop your image here"
          description="SVG, PNG, JPG, WEBP (max. 16MB)" />
      </UFormField>
      <div v-if="displayPreview" class="flex items-center gap-3 mt-2">
        <img :src="displayPreview" alt="Avatar" class="h-16 w-16 rounded-full object-cover border border-default" />
      </div>
    </template>
    <template #footer="{ close }">
      <UButton label="Cancel" color="neutral" variant="outline" @click="close" />
      <UButton :label="editId ? 'Update' : 'Submit'" color="neutral" :loading="isSubmitting"
        @click="handleSubmit(close)" />
    </template>
  </UModal>
</template>
