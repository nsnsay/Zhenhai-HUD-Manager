<script setup lang="ts">
/**
 * 雷达外壳：负责把 GSI 数据换算成 1024 坐标系的雷达对象，再交给画布渲染器。
 */
import { computed, onUnmounted, ref, watch } from 'vue'
import type {
  Bomb,
  FragOrFireBombOrFlashbangGrenade,
  GameState,
  Grenade,
  Player,
  Side,
} from '@zhenhai/csgogsi/types'
import { useGsiEvent } from '@zhenhai/csgogsi/gsi-vue'
import maps, { type MapConfig, type ZoomAreas } from './utils/maps'
import RadarCanvas from './RadarCanvas.vue'
import {
  EXPLODE_TIME_FRAG,
  beginTrailFrame,
  clearTrails,
  explosionPlaces,
  extendFire,
  extendGrenade,
  extendPlayer,
  grenadesStates,
  parsePosition,
  playersStates,
  pruneTrails,
  resetStates,
  updateDeadLocations,
} from './utils/utils'
import type {
  RadarBombObject,
  RadarFireObject,
  RadarGrenadeObject,
  RadarPlayerObject,
} from './utils/interface'
import { clearFires } from './utils/fire'
import { clearEffects, clearGrenadeSnapshots } from './canvas/scene'

const props = defineProps({
  data: {
    type: Object as () => GameState,
    default: () => ({}) as GameState,
  },
  size: {
    type: Number,
    default: 420,
  },
})

const FOLLOW_PLAYERS_ON_ZOOM = true
const ZOOM_ENTER_FRAMES = 2
const ZOOM_EXIT_FRAMES = 2

const zoomFrames = ref(0)
const zoomOn = ref(false)
const smOrigin = ref<[number, number]>([512, 512])
const smZoom = ref(1)

const lastData = ref<GameState | null>(null)

onUnmounted(() => {
  resetStates()
})

watch(
  () => props.data,
  (data) => {
    beginTrailFrame(data)
    pruneTrails()

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
        (g): g is FragOrFireBombOrFlashbangGrenade => g.type === 'frag',
      )) {
        const old = (prev.grenades || []).find(
          (og): og is FragOrFireBombOrFlashbangGrenade => og.id === grenade.id,
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

/**
 * 新回合直接清空轨迹与火焰：grenade id 会在下一回合复用，
 * 残留的点位会把两颗不同的道具连成一条线或一块火区。
 */
useGsiEvent('roundStart', () => {
  clearTrails()
  clearFires()
  clearEffects()
  clearGrenadeSnapshots()
})

/**
 * 画布按显示尺寸直接铺开，不再让 1024 的层先被缩放再回缩：
 * 那层变换会让画布纹理被反复重采样，观感发糊。
 */
const containerStyle = computed(() => ({
  width: `${props.size}px`,
  height: `${props.size}px`,
}))

const mapName = computed(() => props.data?.map?.name || '')

watch(mapName, () => {
  resetStates()
  clearEffects()
  clearGrenadeSnapshots()
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

/** 火焰区域：每个图层一份，两个渲染器都读同一份数据。 */
const firesExtended = computed<RadarFireObject[]>(() => {
  const grenades = props.data?.grenades || []

  return grenades.flatMap((grenade) =>
    grenade.type === 'inferno' ? (extendFire({ grenade, mapName: mapName.value }) ?? []) : [],
  )
})

/** 炸弹：carried / planting 阶段不渲染；多层地图按图层各出一份。 */
const bombObjects = computed<RadarBombObject[]>(() => {
  const bomb = props.data?.bomb as Bomb | null

  if (!bomb || bomb.state === 'carried' || bomb.state === 'planting') return []

  const map = mapConfig.value

  if (!map) return []

  if ('config' in map) {
    const position = parsePosition(bomb.position, map.config)

    return position
      ? [{ id: 'bomb', state: bomb.state, position, visible: true }]
      : ([] as RadarBombObject[])
  }

  return map.configs.flatMap((layer) => {
    const position = parsePosition(bomb.position, layer.config)

    if (!position) return []

    return [
      {
        id: `bomb_${layer.id}`,
        state: bomb.state,
        position,
        visible: layer.isVisible(bomb.position[2] ?? 0),
      },
    ]
  })
})

const zooms = computed<ZoomAreas[]>(() => mapConfig.value?.zooms ?? [])

const activeZoom = computed<ZoomAreas | undefined>(() =>
  zooms.value.find((z) => z.threshold(playersExtended.value)),
)

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
</script>

<template>
  <div :class="['radar-container shadow-pri/20 shadow-sm ring ring-sec/40']">
    <div class="map-containers">
      <div class="map-container" :style="containerStyle">
        <template v-if="isSupportedMap">
          <RadarCanvas
            :map-config="mapConfig"
            :size="size"
            :zoom="smZoom"
            :zoom-origin="smOrigin"
            :players="playersExtended"
            :grenades="grenadesExtended"
            :bomb-objects="bombObjects"
            :fires="firesExtended"
          />
        </template>

        <template v-else>
          <div
            class="map"
            :style="{
              width: `${size}px`,
              height: `${size}px`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }"
          >
            Unsupported map
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<style lang="scss">
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

  .map-container {
    width: 100%;
    height: 100%;
    margin: 0;
    position: relative;
  }
}
</style>
