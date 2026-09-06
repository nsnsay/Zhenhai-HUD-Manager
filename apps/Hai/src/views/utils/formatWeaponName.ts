export function formatWeaponName(weapon: string): string {
  const prefixes = ['weapon_', 'item_', 'equipment_']
  for (const prefix of prefixes) {
    if (weapon.startsWith(prefix)) {
      return weapon.slice(prefix.length)
    }
  }
  return weapon
}
