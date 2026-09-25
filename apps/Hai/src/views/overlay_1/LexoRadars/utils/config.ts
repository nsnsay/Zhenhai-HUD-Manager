import { RADAR_SETTING_DEFAULTS } from '@zhenhai/csgogsi/radar-settings'

/**
 * 雷达的区块级渲染常量。
 *
 * 玩家标记 / 烟雾 / 火焰描边现在可以在设置面板里调；这里保留的是缺省回退值，
 * 与实际设置默认值同源（`@zhenhai/csgogsi/radar-settings`），两处不会漂移。
 */
const config = {
  playerSize: RADAR_SETTING_DEFAULTS.overlayRadarPlayerSize,
  smokeSize: RADAR_SETTING_DEFAULTS.overlayRadarSmokeSize,
  /** 火焰区域轮廓的描边宽度，单位是 1024 雷达坐标系里的像素。 */
  fireStrokeWidth: RADAR_SETTING_DEFAULTS.overlayRadarFireStroke,
}

export default config
