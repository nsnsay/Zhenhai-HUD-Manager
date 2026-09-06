<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { useTournamentsStore } from "@renderer/stores/useTournamentsStore";
import type { TournamentRecord } from "@renderer/stores/useTournamentsStore";
import { useCurrentTournament } from "@renderer/stores/useCurrentTournament";
import { getAssetUrl } from "@renderer/utils/assets-url";
import type { TournamentFormData } from "@zhenhai/csgogsi/types";
import { rendererLogger } from "@renderer/utils/logger";

const open = defineModel<boolean>("open", { default: false });

const tournamentsStore = useTournamentsStore();
const currentTournament = useCurrentTournament();
const toast = useToast();

function createDefaultTournamentData(): TournamentFormData {
  return {
    tournamentName: "",
    tournamentLogo: "",
    tournamentDescription: "",
  };
}

const tournamentData = ref<TournamentFormData>(createDefaultTournamentData());

const editId = ref<string | null>(null);
const logoFile = ref<File | null>(null);
const previewUrl = ref("");
const isSubmitting = ref(false);

const MAX_LOGO_SIZE = 16 * 1024 * 1024;

const displayPreview = computed(() => {
  if (previewUrl.value) return previewUrl.value;
  if (tournamentData.value.tournamentLogo) {
    return getAssetUrl(tournamentData.value.tournamentLogo);
  }
  return "";
});

watch(logoFile, (file) => {
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

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve((e.target?.result as string) ?? "");
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function openEdit(tournament: TournamentRecord) {
  editId.value = tournament.id;

  tournamentData.value = {
    tournamentName: tournament.tournamentName ?? "",
    tournamentLogo: tournament.tournamentLogo ?? "",
    tournamentDescription: tournament.tournamentDescription ?? "",
  };

  logoFile.value = null;

  if (previewUrl.value) {
    URL.revokeObjectURL(previewUrl.value);
    previewUrl.value = "";
  }

  open.value = true;
}

defineExpose({
  openEdit,
});

function resetForm() {
  editId.value = null;
  tournamentData.value = createDefaultTournamentData();
  logoFile.value = null;

  if (previewUrl.value) {
    URL.revokeObjectURL(previewUrl.value);
    previewUrl.value = "";
  }
}

watch(open, (val) => {
  if (!val) resetForm();
});

function removeLogo() {
  logoFile.value = null;
  tournamentData.value.tournamentLogo = "";

  if (previewUrl.value) {
    URL.revokeObjectURL(previewUrl.value);
    previewUrl.value = "";
  }
}

async function handleSubmit(close: () => void) {
  if (isSubmitting.value) return;

  if (!tournamentData.value.tournamentName.trim()) {
    toast.add({
      title: "Validation Error",
      description: "Tournament name is required.",
      icon: "i-lucide-alert-triangle",
      color: "warning",
    });
    return;
  }

  isSubmitting.value = true;

  try {
    let logoPath = tournamentData.value.tournamentLogo;

    const file = logoFile.value;

    if (file) {
      const base64 = await fileToBase64(file);
      const ext = file.name.split(".").pop() || "png";
      const fileName = `${crypto.randomUUID()}-${Date.now()}.${ext}`;

      const saveResult = await window.api.file.save(base64, fileName, "tournament-logos");

      if (saveResult.success) {
        logoPath = saveResult.data ?? logoPath;
        rendererLogger.info("TournamentModal", "Tournament logo uploaded", {
          path: logoPath,
        });
      }
    }

    const submitData: TournamentFormData = {
      tournamentName: tournamentData.value.tournamentName,
      tournamentLogo: logoPath ?? "",
      tournamentDescription: tournamentData.value.tournamentDescription,
    };

    let result;

    if (editId.value) {
      result = await tournamentsStore.update(editId.value, submitData);
    } else {
      result = await tournamentsStore.create(submitData);
    }

    if (result.success) {
      rendererLogger.info(
        "TournamentModal",
        editId.value ? "Tournament updated" : "Tournament created",
        {
          id: result.data?.id ?? editId.value,
          name: tournamentData.value.tournamentName,
        },
      );
      toast.add({
        title: editId.value ? "Tournament Updated" : "Tournament Created",
        description: `"${tournamentData.value.tournamentName}" has been saved successfully.`,
        icon: "i-lucide-check-circle",
      });

      if (!editId.value && result.data?.id) {
        currentTournament.setCurrent(result.data.id);
      }

      close();
    } else {
      rendererLogger.error("TournamentModal", "Tournament save failed", result.error);
      toast.add({
        title: editId.value ? "Update Failed" : "Create Failed",
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
    :title="editId ? 'Edit Tournament' : 'Create Tournament'"
    :description="editId ? 'Update tournament information' : 'Tournament Name, Logo, Info'"
    :ui="{ footer: 'justify-end', content: 'min-w-120' }"
  >
    <template #body>
      <UFormField label="Tournament Name" name="tournamentName" required>
        <UInput
          v-model="tournamentData.tournamentName"
          placeholder="e.g. ESL Pro League Season 20"
          class="w-full"
        />
      </UFormField>

      <UFormField label="Description" name="tournamentDescription" hint="Optional">
        <UTextarea
          v-model="tournamentData.tournamentDescription"
          placeholder="Tournament description..."
          class="w-full"
          :rows="3"
        />
      </UFormField>

      <UFormField label="Tournament Logo" name="tournamentLogo">
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
          alt="Tournament Logo"
          class="h-16 w-16 rounded object-cover border border-default"
        />

        <UButton
          label="Remove Logo"
          color="neutral"
          variant="outline"
          size="xs"
          icon="i-lucide-trash-2"
          @click="removeLogo"
        />
      </div>
    </template>

    <template #footer="{ close }">
      <UButton label="Cancel" color="neutral" variant="outline" @click="close" />
      <UButton
        :label="editId ? 'Update' : 'Submit'"
        color="primary"
        :loading="isSubmitting"
        @click="handleSubmit(close)"
      />
    </template>
  </UModal>
</template>
