import { Server } from 'socket.io'

const PORT = 1469

function weapon(name, state = 'holstered') {
  return { name, paintkit: '', state, id: `${name}-${state}` }
}

function makePlayer(slot, name, side, kills, deaths, money, primary, grenades) {
  return {
    steamid: `7656119${String(slot).padStart(10, '0')}`,
    name,
    defaultName: name,
    observer_slot: slot,
    team: { side, name: side === 'CT' ? 'Team CT' : 'Team T', score: 0 },
    stats: { kills, assists: 0, deaths, mvps: 0, score: 0 },
    weapons: [primary],
    state: {
      health: 100,
      armor: 100,
      helmet: true,
      money,
      round_kills: 0,
      round_totaldmg: 0,
    },
    position: [],
    forward: [],
    avatar: null,
    country: null,
    realName: null,
    extra: {},
    isFocused: slot === 1,
    isDead: slot === 9,
    isBomb: false,
    isArmorHelmet: true,
    isArmor: true,
    grenades,
    primaryweapon: primary,
    secondaryweapon: weapon('weapon_deagle'),
    knifeweapon: weapon('weapon_knife'),
    activeweapon: primary,
    _db: { playerName: name, playerAvatar: '' },
  }
}

const ctNames = ['ZywOo', 'apEX', 'Spinx', 'ropz', 'flameZ']
const tNames = ['donk', 'sh1ro', 'magixx', 'chopper', 'zont1x']

const grenadeKit = [
  weapon('weapon_hegrenade'),
  weapon('weapon_flashbang'),
  weapon('weapon_smokegrenade'),
  weapon('weapon_molotov'),
]

const players = [
  ...ctNames.map((name, index) =>
    makePlayer(index + 1, name, 'CT', 14 - index, 8 + index, 4300 - index * 350, weapon('weapon_ak47'), grenadeKit),
  ),
  ...tNames.map((name, index) =>
    makePlayer(index + 6, name, 'T', 17 - index, 11 + index, 1200 + index * 420, weapon('weapon_awp'), grenadeKit),
  ),
]

const gameState = {
  provider: {
    name: 'fake',
    appid: 730,
    version: 1,
    steamid: '0',
    timestamp: 0,
  },
  map: {
    mode: 'competitive',
    name: 'de_mirage',
    phase: 'live',
    round: 12,
    team_ct: {
      score: 9,
      name: 'Team CT',
      side: 'CT',
      consecutive_round_losses: 0,
      timeouts_remaining: 0,
      matches_won_this_series: 0,
      _db: { teamShortName: 'ZH·CT', teamLogo: '' },
    },
    team_t: {
      score: 6,
      name: 'Team T',
      side: 'T',
      consecutive_round_losses: 0,
      timeouts_remaining: 0,
      matches_won_this_series: 0,
      _db: { teamShortName: 'ZH·T', teamLogo: '' },
    },
    num_matches_to_win_series: 2,
    current_spectators: 0,
    souvenirs_total: 0,
    round_wins: {},
    rounds: [],
    regularMR: 12,
    overtimeMR: 3,
  },
  round: { phase: 'live' },
  observer: {},
  player: players[0],
  players,
  bomb: null,
  grenades: [],
  phase_countdowns: { phase: 'live', phase_ends_in: 47 },
  settings: {
    ctDefaultColor: '#5b7bd5',
    tDefaultColor: '#c9a227',
    primaryDefaultColor: '#1e293b',
    secondaryDefaultColor: '#f4f4f5',
    overlayBorderRadius: 8,
    overlaySafeZoneX: 16,
    overlaySafeZoneY: 16,
  },
  matchinfo: {
    matchType: 'BO3 · 半决赛',
    matchLength: 3,
    tournament: { tournamentName: 'Zhenhai Masters 2026', tournamentLogo: '' },
  },
}

const io = new Server(PORT, { cors: { origin: '*' } })

io.on('connection', (socket) => {
  console.log('client connected')
  socket.emit('gsi:data', gameState)
})

setInterval(() => {
  io.emit('gsi:data', { ...gameState, provider: { ...gameState.provider, timestamp: Date.now() } })
}, 500)

console.log(`fake gsi server listening on ${PORT}`)
