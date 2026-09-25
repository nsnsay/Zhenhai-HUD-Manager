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
import maps, { type MapConfig } from './utils/maps'
import RadarCanvas from './RadarCanvas.vue'
import { RADAR_SETTING_DEFAULTS, type RadarDock } from '@zhenhai/csgogsi/radar-settings'
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
import {
  clearEffects,
  clearGrenadeSnapshots,
  containFocusView,
  radarFocusBox,
  type RadarFocusBounds,
  type RadarFocusBox,
} from './canvas/scene'

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

/**
 * 自动取景的平滑系数：每收到一个 GSI 包向目标走 25%。
 * GSI 心跳是 0.1s，因此约 0.9s 收敛。
 */
const ZOOM_SMOOTHING = 0.25
/** 关闭自动放大时的取景：全景；zoom = 1 时 origin 不参与变换。 */
const FULL_VIEW_ORIGIN: [number, number] = [512, 512]

const smOrigin = ref<[number, number]>([...FULL_VIEW_ORIGIN])
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
  width: `${radarSize.value}px`,
  height: `${radarSize.value}px`,
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

/**
 * 自动取景的输入点：只取当前图层可见、且还活着的选手。
 *
 * `visible` 不能省：Nuke / Vertigo 这类双层地图上同一选手会有多个图层副本，
 * 不筛的话包围盒会横跨上下层，取景会落到两个图层之间。
 */
const focusPoints = computed<[number, number][]>(() =>
  playersExtended.value
    .filter((player) => player.isAlive && player.visible)
    .map((player) => [player.position[0] ?? 0, player.position[1] ?? 0]),
)

const autoZoomEnabled = computed(() => props.data?.settings?.overlayRadarAutoZoom === true)

/**
 * 设置面板里可调的雷达观感参数。
 *
 * 全部以共享默认值兜底：旧数据包或第三方 Overlay 缺字段时，行为与从前完全一致。
 */
const radarSize = computed(() => props.data?.settings?.overlayRadarSize ?? props.size)
const radarDock = computed<RadarDock>(
  () => props.data?.settings?.overlayRadarDock ?? RADAR_SETTING_DEFAULTS.overlayRadarDock,
)
const radarZoomMax = computed(
  () => props.data?.settings?.overlayRadarZoomMax ?? RADAR_SETTING_DEFAULTS.overlayRadarZoomMax,
)
const radarFocusPadding = computed(
  () =>
    props.data?.settings?.overlayRadarFocusPadding ??
    RADAR_SETTING_DEFAULTS.overlayRadarFocusPadding,
)

type FocusTarget = {
  origin: [number, number]
  zoom: number
  /** null = 不做包含性夹取（关闭自动放大时视野恒为全景，夹取没有意义）。 */
  bounds: RadarFocusBounds | null
}

/**
 * 目标取景。
 *
 * - 开关关闭：固定全景；
 * - 开关打开但没有可跟目标（全死 / 无数据）：返回 null，保持当前取景不跳变。
 */
const focusTarget = computed<FocusTarget | null>(() =>
  autoZoomEnabled.value
    ? radarFocusBox(focusPoints.value, {
        padding: radarFocusPadding.value,
        maxZoom: radarZoomMax.value,
      })
    : { origin: [...FULL_VIEW_ORIGIN], zoom: 1, bounds: null },
)

/**
 * 注意 watch 必须同时依赖 `playersExtended`：平滑是「每个 GSI 包走一步」，
 * 只盯目标的话过渡只会跑一帧就停在半路。
 */
watch([focusTarget, playersExtended], () => {
  const target = focusTarget.value

  if (!target) return

  const eased: { origin: [number, number]; zoom: number } = {
    origin: [
      smOrigin.value[0] + (target.origin[0] - smOrigin.value[0]) * ZOOM_SMOOTHING,
      smOrigin.value[1] + (target.origin[1] - smOrigin.value[1]) * ZOOM_SMOOTHING,
    ],
    zoom: smZoom.value + (target.zoom - smZoom.value) * ZOOM_SMOOTHING,
  }

  /**
   * 平滑会让相机落后于目标：倍率先缩下去、中心还在半路时，视野会小于包围盒，
   * 聚在地图角落的选手就被切到画面外。夹取保证任何一帧关注点都完整可见。
   */
  const next = target.bounds ? containFocusView(eased, target.bounds) : eased

  smOrigin.value = next.origin

  smZoom.value = Number(next.zoom.toFixed(3))
})
</script>

<template>
  <div
    :class="[
      'radar-container shadow-pri/20 shadow-sm ring ring-sec/40',
      `radar-dock-${radarDock}`,
    ]"
  >
    <div class="map-containers">
      <div class="map-container" :style="containerStyle">
        <template v-if="isSupportedMap">
          <RadarCanvas
            :map-config="mapConfig"
            :size="radarSize"
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
              width: `${radarSize}px`,
              height: `${radarSize}px`,
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

  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  background: var(--pr-30);
  border-radius: var(--hai-radius);

  /**
   * 停靠位置：横向用 --hai-safe-x、纵向用 --hai-safe-y，与选手侧栏的约定一致。
   * （原先这里把 top 绑到了 safe-x、left 绑到了 safe-y，安全区不对称时就会错轴。）
   */
  &.radar-dock-top-left {
    top: var(--hai-safe-y);
    left: var(--hai-safe-x);
  }

  &.radar-dock-top-right {
    top: var(--hai-safe-y);
    right: var(--hai-safe-x);
  }

  &.radar-dock-bottom-left {
    bottom: var(--hai-safe-y);
    left: var(--hai-safe-x);
  }

  &.radar-dock-bottom-right {
    bottom: var(--hai-safe-y);
    right: var(--hai-safe-x);
  }

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
