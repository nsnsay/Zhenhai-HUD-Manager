<script setup lang="ts">
import { computed } from "vue";
import { storeToRefs } from "pinia";
import { useTournamentsStore } from "@renderer/stores/useTournamentsStore";
import { useTeamsStore } from "@renderer/stores/useTeamsStore";
import { usePlayersStore } from "@renderer/stores/usePlayersStore";
import { useMatchsStore } from "@renderer/stores/useMatchsStore";
import { useCurrentTournament } from "@renderer/stores/useCurrentTournament";
import { useGsiStore } from "@zhenhai/csgogsi/gsi-vue";
import { getAssetUrl } from "@renderer/utils/assets-url";
import type { MapPickDecider, MapPickVeto, MapVeto } from "@zhenhai/csgogsi/types";

const mapBackgrounds = import.meta.glob("../../assets/background/*.png", {
  eager: true,
  import: "default",
  query: "?url",
}) as Record<string, string>;

const tournamentsStore = useTournamentsStore();
const teamsStore = useTeamsStore();
const playersStore = usePlayersStore();
const matchsStore = useMatchsStore();
const currentTournament = useCurrentTournament();
const gsi = useGsiStore();

const { items: tournamentItems } = storeToRefs(tournamentsStore);
const { items: teamItems } = storeToRefs(teamsStore);
const { items: playerItems } = storeToRefs(playersStore);
const { items: matchItems } = storeToRefs(matchsStore);
const { currentId } = storeToRefs(currentTournament);
const { data: gsiData } = storeToRefs(gsi);

const overviewStats = computed(() => {
  const currentPlayers = playerItems.value.filter(
    (player) => player.tournamentId === currentId.value,
  );
  const currentTeams = teamItems.value.filter((team) => team.tournamentId === currentId.value);
  const currentMatchs = matchItems.value.filter((match) => match.tournamentId === currentId.value);

  return [
    {
      key: "tournaments",
      label: "Tournaments",
      value: tournamentItems.value.length,
      icon: "i-lucide-trophy",
      hint: "All events",
    },
    {
      key: "teams",
      label: "Teams",
      value: currentTeams.length,
      icon: "i-lucide-users",
      hint: currentId.value ? "Current event" : "All events",
    },
    {
      key: "players",
      label: "Players",
      value: currentPlayers.length,
      icon: "i-lucide-circle-user-round",
      hint: currentId.value ? "Current event" : "All events",
    },
    {
      key: "matches",
      label: "Matches",
      value: currentMatchs.length,
      icon: "i-lucide-swords",
      hint: currentId.value ? "Current event" : "All events",
    },
  ];
});

const liveMatch = computed(() => matchItems.value.find((match) => match.isLive === true));

const liveMatchId = computed(() => liveMatch.value?.id ?? "");

function teamName(teamId?: string): string {
  if (!teamId) return "Unknown team";
  return teamItems.value.find((team) => team.id === teamId)?.teamName ?? "Unknown team";
}

function teamLogo(teamId?: string): string {
  if (!teamId) return "";
  const logo = teamItems.value.find((team) => team.id === teamId)?.teamLogo;
  return logo ? getAssetUrl(logo) : "";
}

function isSelectedMap(veto: MapVeto): veto is MapPickVeto | MapPickDecider {
  return veto.mapVetoType === "pick" || veto.mapVetoType === "decider";
}

const selectedMaps = computed<(MapPickVeto | MapPickDecider)[]>(
  () => liveMatch.value?.matchVeto.filter(isSelectedMap) ?? [],
);

function extractMapName(value: string): string {
  const match = value.toLowerCase().match(/(de_[a-z0-9_]+)/);
  return match?.[1] ?? value;
}

function getMapBackground(mapName: string): string {
  const name = extractMapName(mapName);
  const entry = Object.entries(mapBackgrounds).find(([path]) => path.includes(`${name}.png`));
  return entry?.[1] ?? "";
}

const gsiMapName = computed(() => {
  const gsiName = gsiData.value?.map?.name;
  if (gsiName) return gsiName;
  return selectedMaps.value[0]?.mapName ?? liveMatch.value?.matchVeto[0]?.mapName ?? "";
});

const heroMapName = computed(() =>
  extractMapName(gsiMapName.value).replace(/^de_/, "").replace(/_/g, " "),
);

const heroBackground = computed(() => getMapBackground(gsiMapName.value));

const phaseLabels: Record<string, string> = {
  warmup: "Warmup",
  live: "Live",
  intermission: "Half Time",
  gameover: "Game Over",
  freezetime: "Freeze Time",
  paused: "Paused",
  timeout_ct: "CT Timeout",
  timeout_t: "T Timeout",
  bomb: "Bomb",
  defuse: "Defuse",
};

const gsiPhase = computed(() => {
  const phase = gsiData.value?.phase_countdowns?.phase;
  return phase ? (phaseLabels[phase] ?? phase) : "No GSI";
});

const gsiRound = computed(() => {
  const data = gsiData.value;
  if (!data?.map) return 0;
  return data.map.phase === "gameover" ? data.map.round : data.map.round + 1;
});

const gsiTeamScore = computed(() => {
  const data = gsiData.value;
  if (!data?.map) return null;
  return {
    ct: data.map.team_ct?.score ?? 0,
    t: data.map.team_t?.score ?? 0,
  };
});

const gsiTeamLabel = (side: "CT" | "T"): string => {
  const data = gsiData.value;
  const team = side === "CT" ? data?.map?.team_ct : data?.map?.team_t;
  return team?._db?.teamShortName || team?._db?.teamName || team?.name || side;
};

const gsiPlayerCount = computed(() => gsiData.value?.players?.length ?? 0);

function mapVetoLabel(veto: MapPickVeto | MapPickDecider): string {
  if (veto.mapVetoType === "pick") {
    return `Pick · ${teamName(veto.mapPickTeam)}`;
  }
  return "Decider";
}
</script>

<template>
  <div class="overview-root flex flex-col gap-6">
    <header class="flex items-end justify-between gap-6">
      <div>
        <h1 class="text-2xl font-semibold leading-tight">Database Overview</h1>
        <p class="mt-1 text-sm text-muted">
          Tournament data, live matches and current Game State at a glance.
        </p>
      </div>

      <UBadge v-if="liveMatch" color="error" variant="subtle" icon="i-lucide-radio">
        {{ liveMatchId ? "Live" : "No live match" }}
      </UBadge>
    </header>

    <TransitionGroup tag="div" name="overview-stat" class="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <UCard
        v-for="(stat, index) in overviewStats"
        :key="stat.key"
        :style="{ '--stat-index': index }"
        :ui="{
          root: 'rounded-lg border border-default/40 bg-elevated/30 shadow-sm backdrop-blur-xl',
          body: 'p-0 sm:p-0',
        }"
      >
        <div class="flex items-center justify-between gap-3 p-4">
          <div class="min-w-0">
            <div class="truncate text-[13px] font-medium text-muted">{{ stat.label }}</div>
            <div class="mt-1 text-2xl font-semibold tabular-nums">{{ stat.value }}</div>
            <div class="mt-1 text-xs text-dimmed">{{ stat.hint }}</div>
          </div>
          <div
            class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-elevated/70 text-primary ring-1 ring-white/5"
          >
            <UIcon :name="stat.icon" class="h-5 w-5" />
          </div>
        </div>
      </UCard>
    </TransitionGroup>

    <section
      class="relative overflow-hidden rounded-lg border border-white/5 bg-elevated/25 shadow-lg backdrop-blur-2xl"
    >
      <div
        class="map-hero absolute inset-0 bg-cover bg-center transition-[transform,filter,opacity] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]"
        :style="heroBackground ? { backgroundImage: `url(${heroBackground})` } : {}"
      />
      <div class="absolute inset-0 bg-gradient-to-r from-black/70 via-black/40 to-black/15" />

      <div class="relative grid min-h-64 gap-5 p-5 lg:grid-cols-[1.35fr_1fr] lg:p-7">
        <div class="flex min-w-0 flex-col justify-between gap-5">
          <div>
            <div class="flex items-center gap-2 text-[11px] font-medium uppercase text-white/60">
              <UIcon name="i-lucide-map" class="h-3.5 w-3.5" />
              <span>Current live match</span>
            </div>

            <div v-if="liveMatch" class="mt-3 space-y-3">
              <div class="flex flex-wrap items-center gap-x-6 gap-y-2">
                <div class="flex min-w-0 items-center gap-2.5">
                  <UAvatar
                    :src="teamLogo(liveMatch.matchTeamA)"
                    size="md"
                    class="bg-black/20 ring-1 ring-white/20"
                  />
                  <span class="truncate text-lg font-semibold text-white">
                    {{ teamName(liveMatch.matchTeamA) }}
                  </span>
                </div>
                <span class="text-xl font-semibold text-white/70">
                  {{ liveMatch.matchTeamAScore }} &nbsp; &nbsp;&nbsp;&nbsp;{{
                    liveMatch.matchTeamBScore
                  }}
                </span>
                <div class="flex min-w-0 items-center gap-2.5">
                  <span class="truncate text-lg font-semibold text-white">
                    {{ teamName(liveMatch.matchTeamB) }}
                  </span>
                  <UAvatar
                    :src="teamLogo(liveMatch.matchTeamB)"
                    size="md"
                    class="bg-black/20 ring-1 ring-white/20"
                  />
                </div>
              </div>

              <div class="flex flex-wrap gap-2">
                <UBadge
                  v-if="liveMatch.matchType"
                  color="neutral"
                  variant="outline"
                  icon="i-lucide-flag"
                  :label="liveMatch.matchType"
                />
                <UBadge
                  color="neutral"
                  variant="outline"
                  icon="i-lucide-shuffle"
                  :label="`BO${liveMatch.matchLength}`"
                />
              </div>
            </div>

            <div v-else class="mt-4">
              <p class="text-base font-medium text-white">No live match is active.</p>
              <p class="mt-1 text-sm text-white/60">
                Start a match from the Matchs view to see its veto and live state here.
              </p>
            </div>
          </div>

          <div v-if="heroBackground || gsiData" class="flex flex-wrap items-end gap-3">
            <div class="rounded-lg bg-white/10 px-3 py-2 ring-1 ring-white/15 backdrop-blur-xl">
              <div class="text-[11px] uppercase tracking-normal text-white/50">Map</div>
              <div class="text-base font-semibold capitalize text-white">
                {{ heroMapName || "Unknown map" }}
              </div>
            </div>
            <UBadge v-if="gsiData" color="success" variant="solid" icon="i-lucide-activity">
              {{ gsiPhase }}
            </UBadge>
            <UBadge v-if="gsiData && gsiRound > 0" color="neutral" variant="outline">
              Round {{ gsiRound }}
            </UBadge>
          </div>
        </div>

        <div class="flex flex-col justify-between gap-4">
          <div
            v-if="gsiTeamScore"
            class="rounded-lg bg-white/10 p-4 ring-1 ring-white/15 backdrop-blur-xl"
          >
            <div class="flex items-center justify-between">
              <div class="text-sm font-semibold text-white">{{ gsiTeamLabel("CT") }}</div>
              <span class="font-mono text-2xl font-semibold text-white">{{ gsiTeamScore.ct }}</span>
            </div>
            <div class="my-3 h-px bg-white/15" />
            <div class="flex items-center justify-between">
              <div class="text-sm font-semibold text-white">{{ gsiTeamLabel("T") }}</div>
              <span class="font-mono text-2xl font-semibold text-white">{{ gsiTeamScore.t }}</span>
            </div>
          </div>

          <div
            v-if="gsiData"
            class="rounded-lg bg-white/10 p-4 ring-1 ring-white/15 backdrop-blur-xl"
          >
            <div class="flex items-center justify-between text-sm">
              <span class="text-white/70">Players</span>
              <span class="font-semibold text-white">{{ gsiPlayerCount }}</span>
            </div>
            <div class="mt-3 flex items-center justify-between text-sm">
              <span class="text-white/70">Mode</span>
              <span class="font-semibold capitalize text-white">
                {{ gsiData.map?.mode || "Competitive" }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section class="flex flex-col gap-3">
      <div class="flex items-center gap-2">
        <UIcon name="i-lucide-route" class="h-4 w-4 text-primary" />
        <h2 class="text-base font-semibold">Selected maps</h2>
      </div>

      <div
        v-if="selectedMaps.length > 0"
        class="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-4"
      >
        <div
          v-for="(map, index) in selectedMaps"
          :key="`${map.mapName}-${index}`"
          class="group relative min-h-24 overflow-hidden rounded-lg border border-white/5 shadow-sm"
        >
          <div
            class="absolute inset-0 scale-105 bg-cover bg-center transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-110"
            :style="
              getMapBackground(map.mapName)
                ? { backgroundImage: `url(${getMapBackground(map.mapName)})` }
                : {}
            "
          />
          <div class="absolute inset-0 bg-black/45" />
          <div class="relative flex h-full min-h-24 flex-col justify-end p-3">
            <div class="truncate text-sm font-semibold capitalize text-white">
              {{ map.mapName.replace(/^de_/, "").replace(/_/g, " ") }}
            </div>
            <div class="mt-1 text-xs text-white/65">{{ mapVetoLabel(map) }}</div>
          </div>
        </div>
      </div>

      <div
        v-else
        class="rounded-lg border border-dashed border-default/40 bg-elevated/20 px-5 py-8 text-center text-sm text-muted"
      >
        {{ liveMatch ? "No Decider map" : "Start a live match to preview its selected maps." }}
      </div>
    </section>
  </div>
</template>

<style scoped lang="scss">
.overview-stat-enter-active {
  transition:
    opacity 220ms ease,
    transform 260ms cubic-bezier(0.22, 1, 0.36, 1),
    filter 220ms ease;
  transition-delay: calc(var(--stat-index, 0) * 35ms);
  will-change: opacity, transform, filter;
}

.overview-stat-enter-from {
  opacity: 0;
  transform: translateY(8px);
  filter: blur(2px);
}

@media (prefers-reduced-motion: reduce) {
  .overview-stat-enter-active {
    transition: opacity 120ms ease;
    transition-delay: 0ms;
    will-change: auto;
  }

  .overview-stat-enter-from {
    opacity: 0;
    transform: none;
    filter: none;
  }

  .map-hero {
    transition: none;
  }
}
</style>
