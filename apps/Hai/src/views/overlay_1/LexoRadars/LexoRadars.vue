<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import type {
  Bomb,
  CSGO,
  FragOrFireBombOrFlashbandGrenade,
  Grenade,
  Player,
  Side,
} from '@zhenhai/csgogsi/types'
import maps, { type MapConfig, type ZoomAreas } from './utils/maps'
import config from './utils/config'
import {
  EXPLODE_TIME_FRAG,
  explosionPlaces,
  extendGrenade,
  extendPlayer,
  grenadesStates,
  parsePosition,
  playersStates,
  resetStates,
  updateDeadLocations,
} from './utils/utils'
import type { RadarGrenadeObject, RadarPlayerObject } from './utils/interface'
import { useHaiSettings } from '@/utils/useHaiSettings'
const { teamAttrs } = useHaiSettings()

const props = defineProps({
  data: {
    type: Object as () => CSGO,
    default: () => ({}) as CSGO,
  },
  size: {
    type: Number,
    default: 420,
  },
})

const DESCALE_ON_ZOOM = true
const FOLLOW_PLAYERS_ON_ZOOM = true
const ZOOM_ENTER_FRAMES = 2
const ZOOM_EXIT_FRAMES = 2

const zoomFrames = ref(0)
const zoomOn = ref(false)
const smOrigin = ref<[number, number]>([512, 512])
const smZoom = ref(1)

const lastData = ref<CSGO | null>(null)

onUnmounted(() => {
  resetStates()
})

watch(
  () => props.data,
  (data) => {
    const currentGrenades: Grenade[] = data?.grenades || []
    grenadesStates.unshift(currentGrenades)
    grenadesStates.splice(5)

    const currentPlayers: Player[] = data?.players || []
    playersStates.unshift(currentPlayers)
    playersStates.splice(5)

    updateDeadLocations(currentPlayers)

    if (lastData.value) {
      const prev = lastData.value

      for (const grenade of currentGrenades.filter(
        (g): g is FragOrFireBombOrFlashbandGrenade => g.type === 'frag',
      )) {
        const old = (prev.grenades || []).find(
          (og): og is FragOrFireBombOrFlashbandGrenade => og.id === grenade.id,
        )

        if (!old) continue

        if (grenade.lifetime >= EXPLODE_TIME_FRAG && old.lifetime < EXPLODE_TIME_FRAG) {
          explosionPlaces[grenade.id] = grenade.position
        }
      }

      for (const grenadeId of Object.keys(explosionPlaces)) {
        const exists = currentGrenades.some((g) => g.id === grenadeId)
        if (!exists) delete explosionPlaces[grenadeId]
      }
    }

    lastData.value = data
  },
  { immediate: true },
)

const offset = computed(() => (props.size - (props.size * props.size) / 1024) / 2)

const containerStyle = computed(() => ({
  width: `${props.size}px`,
  height: `${props.size}px`,
  transform: `scale(${(props.size / 1024).toFixed(4)})`,
  top: `-${offset.value}px`,
  left: `-${offset.value}px`,
}))

const mapName = computed(() => props.data?.map?.name || '')

watch(mapName, () => {
  resetStates()
})

const safeMaps = maps as Record<string, MapConfig>

const isSupportedMap = computed(
  () => !!mapName.value && Object.prototype.hasOwnProperty.call(safeMaps, mapName.value),
)

const mapConfig = computed<MapConfig | null>(() =>
  isSupportedMap.value ? safeMaps[mapName.value]! : null,
)

const playersExtended = computed<RadarPlayerObject[]>(() => {
  const raw = props.data?.players || []

  return raw.flatMap((player) => {
    return extendPlayer({ player, mapName: mapName.value }) ?? []
  })
})

const grenadesExtended = computed<RadarGrenadeObject[]>(() => {
  const raw = props.data?.grenades || []

  const ownerSideMap = new Map<string, Side>(
    playersExtended.value.map((p) => [p.steamid, p.side] as [string, Side]),
  )

  return raw.flatMap((grenade) => {
    const side = ownerSideMap.get(grenade.owner) ?? 'CT'

    return (
      extendGrenade({
        grenade,
        side,
        mapName: mapName.value,
      }) ?? []
    )
  })
})

const zooms = computed<ZoomAreas[]>(() => mapConfig.value?.zooms ?? [])

const activeZoom = computed<ZoomAreas | undefined>(() =>
  zooms.value.find((z) => z.threshold(playersExtended.value)),
)

const reverseZoom = computed(() => {
  const rz = 1 / smZoom.value
  return DESCALE_ON_ZOOM ? rz.toFixed(2) : '1'
})

watch([playersExtended, activeZoom], () => {
  const alive = playersExtended.value.filter((p) => p.isAlive && p.visible)

  let targetOrigin: [number, number] = activeZoom.value
    ? (activeZoom.value.origin as [number, number])
    : smOrigin.value

  if (FOLLOW_PLAYERS_ON_ZOOM && alive.length > 0) {
    let sx = 0
    let sy = 0

    for (const p of alive) {
      sx += p.position[0] ?? 0
      sy += p.position[1] ?? 0
    }

    const cx = Math.min(1024, Math.max(0, sx / alive.length))
    const cy = Math.min(1024, Math.max(0, sy / alive.length))

    targetOrigin = [Number(cx.toFixed(2)), Number(cy.toFixed(2))]
  }

  if (activeZoom.value) {
    zoomFrames.value = Math.min(ZOOM_ENTER_FRAMES, zoomFrames.value + 1)
  } else {
    zoomFrames.value = Math.max(0, zoomFrames.value - 1)
  }

  if (!zoomOn.value && zoomFrames.value >= ZOOM_ENTER_FRAMES) {
    zoomOn.value = true
  }

  if (zoomOn.value && zoomFrames.value <= ZOOM_EXIT_FRAMES - 1 && !activeZoom.value) {
    zoomOn.value = false
  }

  const targetZoom = zoomOn.value && activeZoom.value ? activeZoom.value.zoom : 1

  smOrigin.value = [
    smOrigin.value[0] + (targetOrigin[0] - smOrigin.value[0]) * 0.25,
    smOrigin.value[1] + (targetOrigin[1] - smOrigin.value[1]) * 0.25,
  ]

  smZoom.value = Number((smZoom.value + (targetZoom - smZoom.value) * 0.25).toFixed(3))
})

const mapStyle = computed(() => {
  if (!mapConfig.value) return {}

  const bg = {
    backgroundImage: `url(${mapConfig.value.file})`,
  }

  return {
    ...bg,
    transform: `scale(${smZoom.value})`,
    transformOrigin: `${smOrigin.value[0]}px ${smOrigin.value[1]}px`,
  }
})

const isShootingNow = (lastShoot: number) => Date.now() - lastShoot <= 250

const playerClasses = (player: RadarPlayerObject) => {
  return [
    'player',
    player.isShooting ? 'shooting' : '',
    player.isFlashed ? 'flashed' : '',
    player.side,
    player.hasBomb ? 'hasBomb' : '',
    player.isActive ? 'active' : '',
    !player.isAlive ? 'dead' : '',
    player.visible ? 'visible' : 'hidden',
  ]
    .filter(Boolean)
    .join(' ')
}

const playerStyle = (player: RadarPlayerObject) => ({
  transform: `translateX(${(player.position[0] ?? 0).toFixed(
    2,
  )}px) translateY(${(player.position[1] ?? 0).toFixed(2)}px) translateZ(10px) scale(1)`,
})

const playerContentStyle = (player: RadarPlayerObject) => ({
  width: `${config.playerSize * player.scale}px`,
  height: `${config.playerSize * player.scale}px`,
})

const grenadesRenderable = computed(() => grenadesExtended.value)

const grenadeClasses = (grenade: RadarGrenadeObject) => {
  return [
    'grenade',
    grenade.type,
    grenade.state,
    grenade.side || '',
    grenade.visible ? 'visible' : 'hidden',
  ]
    .filter(Boolean)
    .join(' ')
}

const grenadeStyle = (grenade: RadarGrenadeObject) => ({
  transform: `translateX(${(grenade.position[0] ?? 0).toFixed(2)}px) translateY(${(
    grenade.position[1] ?? 0
  ).toFixed(2)}px) translateZ(10px) scale(${reverseZoom.value})`,
})

const bombRenderable = computed(() => {
  const bomb = props.data?.bomb

  if (!bomb) return false

  return !(bomb.state === 'carried' || bomb.state === 'planting')
})

type BombElement = {
  key: string
  class: string
  style: {
    transform: string
  }
}

const bombElements = computed<BombElement[]>(() => {
  const bomb = props.data?.bomb as Bomb | null

  if (!bombRenderable.value || !bomb || !mapConfig.value) {
    return [] as BombElement[]
  }

  if ('config' in mapConfig.value) {
    const pos = parsePosition(bomb.position, mapConfig.value.config)

    if (!pos) return []

    return [
      {
        key: 'bomb_single',
        class: `bomb ${bomb.state} visible`,
        style: {
          transform: `translateX(${(pos[0] ?? 0).toFixed(2)}px) translateY(${(pos[1] ?? 0).toFixed(
            2,
          )}px) translateZ(10px) scale(${reverseZoom.value})`,
        },
      },
    ]
  }

  const elements = mapConfig.value.configs.map((cfg) => {
    const pos = parsePosition(bomb.position, cfg.config)

    if (!pos) return null

    return {
      key: `bomb_${cfg.id}`,
      class: `bomb ${bomb.state} ${cfg.isVisible(bomb.position[2] ?? 0) ? 'visible' : 'hidden'}`,
      style: {
        transform: `translateX(${(pos[0] ?? 0).toFixed(2)}px) translateY(${(pos[1] ?? 0).toFixed(
          2,
        )}px) translateZ(10px) scale(${reverseZoom.value})`,
      },
    } as BombElement
  })

  return elements.filter((b): b is BombElement => b !== null)
})
</script>

<template>
  <div :class="['radar-container']">
    <div class="map-containers">
      <div class="map-container" :style="containerStyle">
        <template v-if="isSupportedMap">
          <div class="map" :style="mapStyle">
            <!-- Players -->
            <div
              v-for="player in playersExtended"
              :key="player.id"
              :class="playerClasses(player)"
              :style="playerStyle(player)"
              v-bind="teamAttrs(player.team.side)"
            >
              <div class="content" :style="playerContentStyle(player)">
                <div
                  class="background-fire"
                  :style="{
                    transform: `rotate(${-90 + (player.position[2] ?? 0)}deg)`,
                    opacity: isShootingNow(player.lastShoot) ? 1 : 0,
                  }"
                >
                  <div class="bg" />
                </div>

                <div
                  class="background"
                  :style="
                    !player.isAlive
                      ? {}
                      : {
                          transform: `rotate(${0 + (player.position[2] ?? 0)}deg) scale(${player.isActive ? 2.6 : 2.2}) translate(0)`,
                        }
                  "
                />

                <div class="label">
                  {{ player.observer_slot }}
                </div>
              </div>
            </div>

            <!-- Grenades -->
            <div
              v-for="grenade in grenadesRenderable"
              :key="grenade.id"
              :class="grenadeClasses(grenade)"
              :style="grenadeStyle(grenade)"
            >
              <div
                class="content"
                :style="
                  grenade.type === 'smoke' &&
                  (grenade.state === 'landed' || grenade.state === 'exploded')
                    ? {
                        width: `${config.smokeSize}px`,
                        height: `${config.smokeSize}px`,
                      }
                    : {}
                "
              >
                <div class="explode-point" />
                <div class="background" />
              </div>
            </div>

            <!-- Bomb -->
            <template v-if="bombRenderable">
              <div
                v-for="bombEl in bombElements"
                :key="bombEl.key"
                :class="bombEl.class"
                :style="bombEl.style"
              >
                <div class="content">
                  <div class="explode-point" />
                  <div class="background" />
                </div>
              </div>
            </template>
          </div>
        </template>

        <template v-else>
          <div
            class="map"
            style="
              width: 1024px;
              height: 1024px;
              display: flex;
              align-items: center;
              justify-content: center;
            "
          >
            Unsupported map
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<style lang="scss">
@use './utils/index.scss';

.fade-enter-active,
.fade-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(-20px);
}

.radar-container {
  position: absolute;
  top: var(--hai-safe-x);
  left: var(--hai-safe-y);

  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  background: var(--pr-30);
  border-radius: var(--hai-radius);

  .map-containers {
    overflow: hidden;
    transform: scale(1);
  }
}
</style>
