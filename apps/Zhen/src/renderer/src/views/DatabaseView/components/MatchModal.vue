<script setup lang="ts">
import { computed, ref, watch } from "vue";
import type { MapVeto, MatchsInfo } from "@zhenhai/csgogsi/types";
import { useTeamsStore } from "@renderer/stores/useTeamsStore";
import type { TeamRecord } from "@renderer/stores/useTeamsStore";
import { useMatchsStore } from "@renderer/stores/useMatchsStore";
import type { MatchRecord } from "@renderer/stores/useMatchsStore";
import { useCurrentTournament } from "@renderer/stores/useCurrentTournament";
import { getAssetUrl } from "@renderer/utils/assets-url";
import { rendererLogger } from "@renderer/utils/logger";

const teamsStore = useTeamsStore();
const matchsStore = useMatchsStore();
const toast = useToast();
const currentTournament = useCurrentTournament();

interface OptionItem {
  label: string;
  value: string | number;
  icon?: string;
  avatar?: { src: string; alt?: string };
}

const bestOfItems: OptionItem[] = [
  { label: "BO1", value: 1 },
  { label: "BO2", value: 2 },
  { label: "BO3", value: 3 },
  { label: "BO4", value: 4 },
  { label: "BO5", value: 5 },
];

const matchTypeItems: OptionItem[] = [
  { label: "Swiss Round", value: "Swiss Round" },
  { label: "Playoffs", value: "Playoffs" },
  { label: "Qualifier", value: "Qualifier" },
  { label: "Grand Final", value: "Grand Final" },
  { label: "Group Stage", value: "Group Stage" },
];

const mapItems: OptionItem[] = [
  { label: "Inferno", value: "de_inferno" },
  { label: "Dust II", value: "de_dust2" },
  { label: "Mirage", value: "de_mirage" },
  { label: "Ancient", value: "de_ancient" },
  { label: "Anubis", value: "de_anubis" },
  { label: "Nuke", value: "de_nuke" },
  { label: "Train", value: "de_train" },
  { label: "Overpass", value: "de_overpass" },
];

const vetoTypeItems: OptionItem[] = [
  { label: "Ban", value: "ban" },
  { label: "Pick", value: "pick" },
  { label: "Decider", value: "decider" },
];

const teamItems = computed<OptionItem[]>(() =>
  teamsStore.items
    .filter((team) => team.tournamentId === currentTournament.currentId)
    .map((team: TeamRecord) => {
      return {
        label: team.teamName ?? team.teamGameName ?? team.id,
        value: team.id,
        avatar: team.teamLogo ? { src: getAssetUrl(team.teamLogo), alt: team.teamName } : undefined,
        icon: team.teamLogo ? undefined : "i-lucide-users",
      };
    }),
);

const teamAItems = computed<OptionItem[]>(() =>
  teamItems.value.filter((item) => item.value !== matchData.value.matchTeamB),
);
const teamBItems = computed<OptionItem[]>(() =>
  teamItems.value.filter((item) => item.value !== matchData.value.matchTeamA),
);

const iconTeamA = computed(
  () => teamItems.value.find((item) => item.value === matchData.value.matchTeamA)?.icon,
);
const iconTeamB = computed(
  () => teamItems.value.find((item) => item.value === matchData.value.matchTeamB)?.icon,
);

const DEFAULT_MAPS = [
  "de_inferno",
  "de_mirage",
  "de_dust2",
  "de_ancient",
  "de_anubis",
  "de_nuke",
  "de_train",
];

function normalizeMatchVeto(entries: MapVeto[]): MapVeto[] {
  return entries.map((entry) => {
    const normalized = {
      mapBanTeam: "",
      mapPickTeam: "",
      mapPickEnemySide: "CT" as const,
      mapPickEnemyScore: 0,
      mapPickTeamScore: 0,
      mapTeamAScore: 0,
      mapTeamBScore: 0,
      ...entry,
    };

    return normalized as MapVeto;
  });
}

function generateVetoStructure(bo: number): MapVeto[] {
  let types: Array<"ban" | "pick" | "decider">;
  switch (bo) {
    case 1:
      types = ["ban", "ban", "ban", "ban", "ban", "ban", "decider"];
      break;
    case 2:
      types = ["ban", "ban", "ban", "ban", "ban", "pick", "pick"];
      break;
    case 3:
      types = ["ban", "ban", "pick", "pick", "ban", "ban", "decider"];
      break;
    case 4:
      types = ["ban", "ban", "ban", "pick", "pick", "pick", "decider"];
      break;
    case 5:
      types = ["ban", "ban", "pick", "pick", "pick", "pick", "decider"];
      break;
    default:
      types = ["ban", "ban", "pick", "pick", "ban", "ban", "decider"];
  }
  const entries = types.map((type, i) => {
    const base = { mapName: DEFAULT_MAPS[i % DEFAULT_MAPS.length] };
    switch (type) {
      case "ban":
        return { ...base, mapVetoType: "ban" as const, mapBanTeam: "" };
      case "pick":
        return {
          ...base,
          mapVetoType: "pick" as const,
          mapPickTeam: "",
          mapPickEnemySide: "CT",
          mapPickEnemyScore: 0,
          mapPickTeamScore: 0,
        };
      case "decider":
        return { ...base, mapVetoType: "decider" as const, mapTeamAScore: 0, mapTeamBScore: 0 };
    }
  }) as MapVeto[];

  return normalizeMatchVeto(entries);
}

function createDefaultMatchData(): MatchsInfo {
  return {
    matchType: matchTypeItems[0]?.value as string,
    matchLength: bestOfItems[2]?.value as number,
    matchVeto: generateVetoStructure(3) as MatchsInfo["matchVeto"],
    matchTeamA: "",
    matchTeamB: "",
    matchTeamAScore: 0,
    matchTeamBScore: 0,
    isLive: false,
  };
}

const matchData = ref<MatchsInfo>(createDefaultMatchData());
const editId = ref<string | null>(null);

watch(
  () => matchData.value.matchLength,
  (newBO) => {
    if (newBO)
      matchData.value.matchVeto = generateVetoStructure(newBO as number) as MatchsInfo["matchVeto"];
  },
);

function openEdit(match: MatchRecord) {
  editId.value = match.id;
  matchData.value = {
    matchType: match.matchType,
    matchLength: match.matchLength,
    matchVeto: match.matchVeto
      ? normalizeMatchVeto(
        JSON.parse(JSON.stringify(match.matchVeto)) as MatchsInfo["matchVeto"],
      )
      : generateVetoStructure(match.matchLength as number),
    matchTeamA: match.matchTeamA,
    matchTeamB: match.matchTeamB,
    matchTeamAScore: match.matchTeamAScore ?? 0,
    matchTeamBScore: match.matchTeamBScore ?? 0,
    isLive: match.isLive ?? false,
  };
  open.value = true;
}

defineExpose({ openEdit });

const open = ref(false);
const isSubmitting = ref(false);

watch(open, (newVal) => {
  if (!newVal) resetForm();
});

function resetForm() {
  editId.value = null;
  matchData.value = createDefaultMatchData();
}

async function handleSubmit(close: () => void) {
  if (isSubmitting.value) return;

  if (!matchData.value.matchTeamA || !matchData.value.matchTeamB) {
    toast.add({
      title: "Validation Error",
      description: "Both teams are required.",
      icon: "i-lucide-alert-triangle",
      color: "warning",
    });
    return;
  }

  if (matchData.value.matchTeamA === matchData.value.matchTeamB) {
    toast.add({
      title: "Validation Error",
      description: "Team A and Team B cannot be the same team.",
      icon: "i-lucide-alert-triangle",
      color: "warning",
    });
    return;
  }

  isSubmitting.value = true;

  try {
    const submitData: MatchsInfo = { ...matchData.value };

    let result;
    if (editId.value) {
      const { isLive, ...updateData } = submitData;
      result = await matchsStore.update(editId.value, updateData);
    } else {
      result = await matchsStore.create({
        ...submitData,
        tournamentId: currentTournament.currentId,
        isLive: false,
      });
    }

    if (result.success) {
      rendererLogger.info("MatchModal", editId.value ? "Match updated" : "Match created", {
        id: result.data?.id ?? editId.value,
        teamA: matchData.value.matchTeamA,
        teamB: matchData.value.matchTeamB,
      });
      toast.add({
        title: editId.value ? "Match Updated" : "Match Created",
        description: `The match has been saved.`,
        icon: "i-lucide-check-circle",
      });
      close();
    } else {
      rendererLogger.error("MatchModal", "Match save failed", result.error);
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
  <UModal v-model:open="open" :title="editId ? 'Edit Match' : 'Create Match'"
    :description="editId ? 'Update match information' : 'Match Veto, Match Versus, Match Info'"
    :ui="{ footer: 'justify-end', content: 'min-w-184', body: 'scrollbar-none', header: 'py-6' }">
    <UButton icon="i-lucide-plus" label="Create Match" color="primary" />
    <template #body>
      <div class="flex justify-between w-full">
        <UFormField label="Team A" name="Team A">
          <USelect v-model="matchData.matchTeamA" :items="teamAItems" value-key="value" :icon="iconTeamA" class="w-48"
            :ui="{
              trailingIcon: 'group-data-[state=open]:rotate-180 transition-transform duration-200',
            }" />
        </UFormField>
        <UFormField label="Team B" name="Team B">
          <USelect v-model="matchData.matchTeamB" :items="teamBItems" value-key="value" :icon="iconTeamB" class="w-48"
            :ui="{
              trailingIcon: 'group-data-[state=open]:rotate-180 transition-transform duration-200',
            }" />
        </UFormField>
      </div>
      <div class="flex justify-between w-full">
        <UFormField label="Team A Score (Series)" name="matchTeamAScore">
          <UInputNumber v-model="matchData.matchTeamAScore" :min="0" :max="99" class="w-48" />
        </UFormField>
        <UFormField label="Team B Score (Series)" name="matchTeamBScore">
          <UInputNumber v-model="matchData.matchTeamBScore" :min="0" :max="99" class="w-48" />
        </UFormField>
      </div>
      <div class="flex justify-between w-full">
        <UFormField label="Best Of" name="Best Of">
          <USelect v-model="matchData.matchLength as number" :items="bestOfItems" value-key="value" class="w-48" :ui="{
            trailingIcon: 'group-data-[state=open]:rotate-180 transition-transform duration-200',
          }" />
        </UFormField>
        <UFormField label="Match Phase/Stage" name="Match Phase">
          <USelect v-model="matchData.matchType" :items="matchTypeItems" value-key="value" class="w-48" :ui="{
            trailingIcon: 'group-data-[state=open]:rotate-180 transition-transform duration-200',
          }" />
        </UFormField>
      </div>
      <USeparator class="text-[13px]">Map Vetos</USeparator>
      <div class="flex justify-between w-full rounded flex-col mt-2 gap-2">
        <div v-for="(map, index) in matchData.matchVeto" :key="`${open}-${editId ?? 'create'}-${index}`"
          class="flex w-full gap-1 py-2 rounded border-muted">
          <UFormField :label="`Map ${index + 1}`" name="Match Phase">
            <USelect v-model="map.mapName" :items="mapItems" value-key="value" class="w-38" :ui="{
              trailingIcon:
                'group-data-[state=open]:rotate-180 transition-transform duration-200',
            }" />
          </UFormField>
          <UFormField label="Veto Type" name="Match Phase">
            <USelect v-model="map.mapVetoType" :items="vetoTypeItems" class="w-38" :ui="{
              trailingIcon:
                'group-data-[state=open]:rotate-180 transition-transform duration-200',
            }" />
          </UFormField>
          <template v-if="map.mapVetoType === 'pick'">
            <UFormField label="Pick Team" name="Match Phase">
              <USelect v-model="map.mapPickTeam" :default-value="map.mapPickTeam" :items="teamItems" value-key="value"
                class="w-36" :ui="{
                  trailingIcon:
                    'group-data-[state=open]:rotate-180 transition-transform duration-200',
                }" />
            </UFormField>
            <UFormField label="Pick Team Score" name="Match Phase">
              <UInputNumber class="w-24" v-model="map.mapPickTeamScore as number" />
            </UFormField>
            <UFormField label="Enemys Scores" name="Match Phase">
              <UInputNumber class="w-24" v-model="map.mapPickEnemyScore as number" />
            </UFormField>
          </template>
          <template v-if="map.mapVetoType === 'decider'">
            <UFormField label="Team A Score" name="Team A Score">
              <UInputNumber class="w-24" v-model="map.mapTeamAScore as number" />
            </UFormField>
            <UFormField label="Team B Score" name="Team B Score">
              <UInputNumber class="w-24" v-model="map.mapTeamBScore as number" />
            </UFormField>
          </template>
        </div>
      </div>
    </template>
    <template #footer="{ close }">
      <UButton label="Cancel" color="neutral" variant="outline" @click="close" />
      <UButton :label="editId ? 'Update' : 'Submit'" color="neutral" :loading="isSubmitting"
        @click="handleSubmit(close)" />
    </template>
  </UModal>
</template>
