<script setup lang="ts">
import { ref, toRaw, watch } from "vue";
import { useTournamentsStore } from "@renderer/stores/useTournamentsStore";
import { useCurrentTournament } from "@renderer/stores/useCurrentTournament";
import { useExtrasStore, type ExtrasRecord } from "@renderer/stores/useExtrasStore";
import type { StepperItem } from "@nuxt/ui";
import type { TournamentFormData } from "@zhenhai/csgogsi/types";
import { rendererLogger } from "@renderer/utils/logger";

const open = defineModel<boolean>("open", { default: false });

const tournamentsStore = useTournamentsStore();
const currentTournament = useCurrentTournament();
const extrasStore = useExtrasStore();
const toast = useToast();

const currentStep = ref(0);
const isProcessing = ref(false);

const items: StepperItem[] = [
  { title: "Locate CS2", description: "Find game directory", icon: "i-lucide-folder-search" },
  { title: "Create Tournament", description: "Setup your first event", icon: "i-lucide-trophy" },
  { title: "Install CFG", description: "Configure GSI integration", icon: "i-lucide-settings" },
  { title: "Finish", description: "All set!", icon: "i-lucide-check-circle" },
];

// ==================== Step 1: Locate CS2 ====================
const cs2Path = ref("");

async function autoDetectCs2() {
  isProcessing.value = true;
  try {
    const res = await window.api.app.getCs2Path();
    if (res.success && res.data) {
      cs2Path.value = res.data;
      rendererLogger.info("StartWizard", "CS2 path auto detected", { cs2Path: res.data });
      toast.add({
        title: "CS2 Found",
        description: res.data,
        icon: "i-lucide-check",
        color: "success",
      });
    } else {
      toast.add({
        title: "Not Found",
        description: "Please select the folder manually.",
        color: "warning",
        icon: "i-lucide-alert-triangle",
      });
    }
  } catch (e) {
    rendererLogger.error("StartWizard", "Auto detect CS2 failed", e);
    toast.add({ title: "Error", description: "Failed to detect CS2 path.", color: "error" });
  } finally {
    isProcessing.value = false;
  }
}

async function browseCs2() {
  try {
    const res = await window.api.app.selectDirectory();
    if (res.success && res.data) {
      cs2Path.value = res.data;
      rendererLogger.info("StartWizard", "CS2 path selected manually", { cs2Path: res.data });
    }
  } catch (e) {
    rendererLogger.error("StartWizard", "Browse CS2 directory failed", e);
  }
}

// ==================== Step 2: Create Tournament ====================
const tournamentName = ref("");
const tournamentDesc = ref("");

async function createTournament(): Promise<boolean> {
  if (!tournamentName.value.trim()) {
    toast.add({
      title: "Validation Error",
      description: "Tournament name is required.",
      color: "warning",
    });
    return false;
  }

  isProcessing.value = true;
  try {
    const tournamentData: TournamentFormData = {
      tournamentName: tournamentName.value,
      tournamentDescription: tournamentDesc.value,
      tournamentLogo: "",
    };

    const result = await tournamentsStore.create(tournamentData);

    if (result.success && result.data?.id) {
      currentTournament.setCurrent(result.data.id);
      rendererLogger.info("StartWizard", "Initial tournament created", {
        tournamentId: result.data.id,
        tournamentName: tournamentName.value,
      });
      return true;
    } else {
      rendererLogger.warn("StartWizard", "Create initial tournament failed", result.error);
      toast.add({ title: "Failed", description: result.error, color: "error" });
      return false;
    }
  } finally {
    isProcessing.value = false;
  }
}

// ==================== Step 3: Install CFG ====================
const cfgInstalled = ref(false);

async function installCfg() {
  if (!cs2Path.value) return;
  isProcessing.value = true;
  try {
    const res = await window.api.app.installCfg(cs2Path.value);
    if (res.success) {
      cfgInstalled.value = true;
      rendererLogger.info("StartWizard", "GSI CFG installed", { cs2Path: cs2Path.value });
      toast.add({
        title: "CFG Installed",
        description: "GSI configured successfully.",
        icon: "i-lucide-check",
        color: "success",
      });
    } else {
      rendererLogger.error("StartWizard", "GSI CFG install failed", res.error);
      toast.add({ title: "Install Failed", description: res.error, color: "error" });
    }
  } finally {
    rendererLogger.debug("StartWizard", "CFG install processing finished");
    isProcessing.value = false;
  }
}

// ==================== Step 4: Finish ====================
async function finishWizard() {
  isProcessing.value = true;
  try {
    const existing = extrasStore.items.find((i) => i.configType === "app-settings") as
      | ExtrasRecord
      | undefined;
    const settings = existing?.settings ? JSON.parse(JSON.stringify(toRaw(existing.settings))) : {};
    settings.firstStartFinished = true;
    settings.cs2Path = cs2Path.value;

    const payload = { configType: "app-settings", settings };
    if (existing?.id) {
      await window.api.db.update("extras", existing.id, payload);
    } else {
      await window.api.db.create("extras", payload);
    }
    await extrasStore.init();
    open.value = false;
    rendererLogger.info("StartWizard", "Wizard finished", {
      cs2Path: cs2Path.value,
      tournamentName: tournamentName.value,
    });
  } finally {
    isProcessing.value = false;
  }
}

// ==================== Navigation ====================
async function handleNext() {
  if (currentStep.value === 1) {
    const success = await createTournament();
    if (!success) return;
  }
  if (currentStep.value === 2) {
    if (!cfgInstalled.value) {
      await installCfg();
      if (!cfgInstalled.value) return;
    }
  }

  if (currentStep.value < items.length - 1) {
    currentStep.value++;
  }
}

function handleBack() {
  if (currentStep.value > 0) {
    currentStep.value--;
  }
}

// Reset state when modal opens
watch(open, (val) => {
  if (val) {
    currentStep.value = 0;
    cs2Path.value = "";
    tournamentName.value = "";
    cfgInstalled.value = false;
  }
});
</script>

<template>
  <UModal
    v-model:open="open"
    :close="false"
    :dismissible="false"
    title="Welcome to Zhenhai HUD Manager"
    description="Let's set up your environment in a few quick steps."
    :ui="{ content: 'max-w-2xl', footer: 'justify-between' }"
  >
    <template #body>
      <!-- 注意：这里去掉了 index，只保留 item -->
      <UStepper v-model:step="currentStep" :items="items" class="w-full">
        <template #content>
          <div class="min-h-[240px] flex flex-col justify-center py-6">
            <!-- 使用外部的 currentStep 变量进行判断 -->
            <div v-if="currentStep === 0" class="space-y-4">
              <p class="text-sm text-muted">
                We need to locate your Counter-Strike 2 installation to configure Game State
                Integration (GSI).
              </p>
              <UFormField label="CS2 Root Directory" required>
                <div class="flex gap-2 w-full">
                  <UInput
                    v-model="cs2Path"
                    placeholder="e.g., C:\Program Files (x86)\Steam\steamapps\common\Counter-Strike Global Offensive"
                    class="flex-1"
                    readonly
                  />
                  <UButton label="Browse" color="neutral" variant="outline" @click="browseCs2" />
                </div>
              </UFormField>
              <UButton
                label="Auto Detect via Steam"
                icon="i-lucide-radar"
                :loading="isProcessing"
                @click="autoDetectCs2"
                class="w-fit"
              />
            </div>

            <div v-else-if="currentStep === 1" class="space-y-4">
              <p class="text-sm text-muted">
                Create your first tournament to start managing teams, players, and matches.
              </p>
              <UFormField label="Tournament Name" required>
                <UInput
                  v-model="tournamentName"
                  placeholder="e.g., ESL Pro League Season 20"
                  class="w-full"
                />
              </UFormField>
              <UFormField label="Description (Optional)">
                <UTextarea
                  v-model="tournamentDesc"
                  placeholder="Brief description..."
                  class="w-full"
                  :rows="3"
                />
              </UFormField>
            </div>

            <div v-else-if="currentStep === 2" class="space-y-4">
              <p class="text-sm text-muted">
                Install the GSI configuration file to your CS2 directory so the game can send data
                to this app.
              </p>
              <div
                class="p-4 bg-elevated/50 rounded-lg border border-default/50 text-xs font-mono break-all"
              >
                {{ cs2Path }}/game/csgo/cfg/gamestate_integration_zhenhai.cfg
              </div>
              <div class="flex items-center gap-3">
                <UButton
                  v-if="!cfgInstalled"
                  label="Install CFG File"
                  icon="i-lucide-download"
                  :loading="isProcessing"
                  @click="installCfg"
                />
                <UBadge
                  v-else
                  label="Installed Successfully"
                  color="success"
                  variant="subtle"
                  icon="i-lucide-check-circle-2"
                  size="lg"
                />
              </div>
            </div>

            <div v-else-if="currentStep === 3" class="text-center space-y-6 py-8">
              <UIcon name="i-lucide-party-popper" class="h-16 w-16 text-primary mx-auto" />
              <div>
                <h3 class="text-xl font-bold mb-2">You are ready to go!</h3>
                <p class="text-muted text-sm">Your HUD Manager is fully configured.</p>
              </div>
              <div class="pt-4">
                <a
                  href="https://github.com/nsnsay/Zhenhai-HUD-Manager"
                  target="_blank"
                  class="text-primary hover:underline text-sm flex items-center justify-center gap-2"
                >
                  <UIcon name="i-lucide-github" class="h-4 w-4" />
                  Star us on GitHub / Report Issues
                </a>
              </div>
            </div>
          </div>
        </template>
      </UStepper>
    </template>

    <template #footer>
      <UButton
        v-if="currentStep > 0"
        label="Back"
        color="neutral"
        variant="ghost"
        @click="handleBack"
      />
      <div v-else />

      <div class="flex gap-2">
        <UButton
          v-if="currentStep < items.length - 1"
          label="Next"
          color="primary"
          :disabled="
            isProcessing ||
            (currentStep === 0 && !cs2Path) ||
            (currentStep === 1 && !tournamentName.trim())
          "
          @click="handleNext"
        />
        <UButton
          v-else
          label="Finish & Close"
          color="primary"
          :loading="isProcessing"
          @click="finishWizard"
        />
      </div>
    </template>
  </UModal>
</template>
