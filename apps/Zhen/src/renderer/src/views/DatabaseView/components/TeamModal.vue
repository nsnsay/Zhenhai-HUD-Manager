<script setup lang="ts">
import { ref, watch, computed } from "vue";
import { useTeamsStore } from "@renderer/stores/useTeamsStore";
import type { TeamRecord } from "@renderer/stores/useTeamsStore";
import { usePlayersStore, type PlayerRecord } from "@renderer/stores/usePlayersStore";
import { countryFlags } from "@renderer/utils/country-flags";
import { useCurrentTournament } from "@renderer/stores/useCurrentTournament";
import { getAssetUrl } from "@renderer/utils/assets-url";
import { TeamFormData } from "@zhenhai/csgogsi/types";
import { rendererLogger } from "@renderer/utils/logger";

const currentTournament = useCurrentTournament();
const teamsStore = useTeamsStore();
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

const playerOptions = computed<OptionItem[]>(() =>
  playersStore.items
    .filter((p: PlayerRecord) => p.tournamentId === currentTournament.currentId)
    .map((p: PlayerRecord) => ({
      label: p.playerName ?? p.id,
      value: p.id,
      avatar: p.playerAvatar ? { src: getAssetUrl(p.playerAvatar), alt: p.playerName } : undefined,
    })),
);

function createDefaultTeamData(): TeamFormData {
  return {
    teamName: "",
    teamShortName: "",
    teamLogo: "",
    teamCountry: "",
    teamGameName: "",
    playerIds: [],
  };
}

const teamData = ref<TeamFormData>(createDefaultTeamData());
const editId = ref<string | null>(null);

function openEdit(team: TeamRecord) {
  editId.value = team.id;
  teamData.value = {
    teamName: team.teamName ?? "",
    teamShortName: team.teamShortName ?? "",
    teamLogo: team.teamLogo ?? "",
    teamCountry: team.teamCountry ?? "",
    teamGameName: team.teamGameName ?? "",
    playerIds: Array.isArray(team.playerIds) ? [...team.playerIds] : [],
  };
  logoFile.value = null;
  if (previewUrl.value) {
    URL.revokeObjectURL(previewUrl.value);
    previewUrl.value = "";
  }
  open.value = true;
}

defineExpose({ openEdit });

const logoFile = ref<File | null>(null);
const previewUrl = ref("");
const MAX_LOGO_SIZE = 16 * 1024 * 1024;

watch(logoFile, (file) => {
  if (previewUrl.value) {
    URL.revokeObjectURL(previewUrl.value);
    previewUrl.value = "";
  }
  if (!file) {
    if (!editId.value) teamData.value.teamLogo = "";
    return;
  }
  if (!file.type || !file.type.startsWith("image/")) {
    toast.add({
      title: "Invalid File",
      description: "Please select an image file.",
      icon: "i-lucide-alert-triangle",
      color: "warning",
    });
    logoFile.value = null;
    return;
  }
  if (file.size > MAX_LOGO_SIZE) {
    toast.add({
      title: "File Too Large",
      description: "Logo must be less than 16 MB.",
      icon: "i-lucide-alert-triangle",
      color: "warning",
    });
    logoFile.value = null;
    return;
  }
  previewUrl.value = URL.createObjectURL(file);
});

const displayPreview = computed(() => {
  if (previewUrl.value) return previewUrl.value;
  if (teamData.value.teamLogo) return getAssetUrl(teamData.value.teamLogo);
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

const open = ref(false);
const isSubmitting = ref(false);

watch(open, (newVal) => {
  if (!newVal) resetForm();
});

function resetForm() {
  editId.value = null;
  teamData.value = createDefaultTeamData();
  logoFile.value = null;
  if (previewUrl.value) {
    URL.revokeObjectURL(previewUrl.value);
    previewUrl.value = "";
  }
}

async function handleSubmit(close: () => void) {
  if (isSubmitting.value) return;
  if (!teamData.value.teamName.trim()) {
    toast.add({
      title: "Validation Error",
      description: "Team name is required.",
      icon: "i-lucide-alert-triangle",
      color: "warning",
    });
    return;
  }

  isSubmitting.value = true;
  try {
    let logoPath = teamData.value.teamLogo;
    const file = logoFile.value;

    if (file) {
      const base64 = await fileToBase64(file);
      const ext = file.name.split(".").pop() || "png";
      const prefix = teamData.value.teamName || crypto.randomUUID().slice(0, 8);
      const fileName = `${prefix}-${Date.now()}.${ext}`;
      const saveResult = await window.api.file.save(base64, fileName, "team-logos");
      if (saveResult.success) {
        logoPath = saveResult.data ?? logoPath;
        rendererLogger.info("TeamModal", "Team logo uploaded", { path: logoPath });
      }
    }

    const submitData = <TeamFormData>{
      teamName: teamData.value.teamName,
      teamShortName: teamData.value.teamShortName,
      teamLogo: logoPath,
      teamCountry: teamData.value.teamCountry,
      teamGameName: teamData.value.teamGameName,
      playerIds: teamData.value.playerIds,
    };

    let result;
    if (editId.value) {
      result = await teamsStore.update(editId.value, submitData);
    } else {
      result = await teamsStore.create({
        ...submitData,
        tournamentId: currentTournament.currentId,
      });
    }

    if (result.success) {
      rendererLogger.info("TeamModal", editId.value ? "Team updated" : "Team created", {
        id: result.data?.id ?? editId.value,
        name: teamData.value.teamName,
      });
      toast.add({
        title: editId.value ? "Team Updated" : "Team Created",
        description: `"${teamData.value.teamName}" saved.`,
        icon: "i-lucide-check-circle",
      });
      close();
    } else {
      rendererLogger.error("TeamModal", "Team save failed", result.error);
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
  <UModal
    v-model:open="open"
    :title="editId ? 'Edit Team' : 'Create Team'"
    :description="editId ? 'Update team information' : 'Team Name, Team Logo, Team Info'"
    :ui="{ footer: 'justify-end', content: 'min-w-120' }"
  >
    <UButton icon="i-lucide-plus" label="Create Team" color="primary" />
    <template #body>
      <div class="flex justify-between w-full">
        <UFormField label="Team Name" name="teamName" required>
          <UInput v-model="teamData.teamName" placeholder="e.g. TYLOO" class="w-48" />
        </UFormField>
        <UFormField label="Game Name" name="teamGameName" required>
          <UInput v-model="teamData.teamGameName" placeholder="e.g. TYLOO CLAN" class="w-48" />
        </UFormField>
      </div>
      <div class="flex justify-between w-full">
        <UFormField label="Team Short Name" name="teamShortName" required>
          <UInput v-model="teamData.teamShortName" placeholder="e.g. TYL" class="w-48" />
        </UFormField>
        <UFormField label="Country / Region" name="teamCountry" hint="Optional">
          <USelect
            v-model="teamData.teamCountry"
            :items="countryItems"
            value-key="value"
            class="w-48"
            :ui="{
              trailingIcon: 'group-data-[state=open]:rotate-180 transition-transform duration-200',
            }"
          />
        </UFormField>
      </div>
      <div class="flex justify-between w-full">
        <UFormField
          label="Players"
          name="playerIds"
          :hint="`${teamData?.playerIds.length}/10 Optional`"
        >
          <USelectMenu
            v-model="teamData.playerIds"
            :items="playerOptions"
            value-key="value"
            multiple
            :max-items="10"
            placeholder="Select players..."
            class="w-48"
            :ui="{
              trailingIcon: 'group-data-[state=open]:rotate-180 transition-transform duration-200',
            }"
          />
        </UFormField>
      </div>
      <UFormField label="Team Logo" name="teamLogo">
        <UFileUpload
          v-model="logoFile"
          accept="image/*"
          label="Drop your image here"
          description="SVG, PNG, JPG, WEBP (max. 16MB)"
          class="w-full"
        />
      </UFormField>
      <div v-if="displayPreview" class="flex items-center gap-3 mt-2">
        <img
          :src="displayPreview"
          alt="Team Logo"
          class="h-12 w-12 rounded object-contain border border-default"
        />
        <span class="text-xs text-muted">Logo preview</span>
      </div>
    </template>
    <template #footer="{ close }">
      <UButton label="Cancel" color="neutral" variant="outline" @click="close" />
      <UButton
        :label="editId ? 'Update' : 'Submit'"
        color="neutral"
        :loading="isSubmitting"
        @click="handleSubmit(close)"
      />
    </template>
  </UModal>
</template>
