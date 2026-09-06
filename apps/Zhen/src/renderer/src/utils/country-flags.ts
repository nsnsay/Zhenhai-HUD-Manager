import cn from 'flag-icons/flags/1x1/cn.svg'
import mn from 'flag-icons/flags/1x1/mn.svg'
import ru from 'flag-icons/flags/1x1/ru.svg'
import us from 'flag-icons/flags/1x1/us.svg'
import fr from 'flag-icons/flags/1x1/fr.svg'
import dk from 'flag-icons/flags/1x1/dk.svg'
import ua from 'flag-icons/flags/1x1/ua.svg'
import br from 'flag-icons/flags/1x1/br.svg'
import de from 'flag-icons/flags/1x1/de.svg'
import pl from 'flag-icons/flags/1x1/pl.svg'
import se from 'flag-icons/flags/1x1/se.svg'
import fi from 'flag-icons/flags/1x1/fi.svg'
import kz from 'flag-icons/flags/1x1/kz.svg'
import au from 'flag-icons/flags/1x1/au.svg'
import ca from 'flag-icons/flags/1x1/ca.svg'
import gb from 'flag-icons/flags/1x1/gb.svg'
import eu from 'flag-icons/flags/1x1/eu.svg'
import un from 'flag-icons/flags/1x1/un.svg'

export const countryFlags: Record<string, string> = {
  CN: cn,
  MN: mn,
  RU: ru,
  US: us,
  FR: fr,
  DK: dk,
  UA: ua,
  BR: br,
  DE: de,
  PL: pl,
  SE: se,
  FI: fi,
  KZ: kz,
  AU: au,
  CA: ca,
  GB: gb,
  EU: eu,
  INT: un
}

export function getFlagUrl(code: string): string {
  return countryFlags[code.toUpperCase()] ?? ''
}
