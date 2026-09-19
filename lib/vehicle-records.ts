type Field = { label: string; value: string }
export type RecordSection = { title: string; status: string; records: Field[][]; code?: string; premium?: boolean }
export const REPORT_PRICES = ['6.99', '7.99', '8.99', '9.99'] as const
export type ReportPrice = typeof REPORT_PRICES[number]

export function isReportPrice(value: unknown): value is ReportPrice {
  return typeof value === 'string' && REPORT_PRICES.includes(value as ReportPrice)
}

export function quoteForSections(sections: RecordSection[]) {
  const freeSections = sections.filter(section => !section.premium)
  const paidSections = sections.filter(section => section.premium)
  const baseRecordCount = freeSections.reduce((sum, section) => sum + section.records.length, 0)
  const premiumRecordCount = paidSections.reduce((sum, section) => sum + section.records.length, 0)
  const recordCount = baseRecordCount + premiumRecordCount
  const sourceCount = paidSections.filter(section => section.records.length > 0).length
  const price: ReportPrice = premiumRecordCount === 0 ? '6.99'
    : premiumRecordCount <= 2 ? '7.99'
      : premiumRecordCount <= 6 ? '8.99' : '9.99'
  return { price, recordCount, baseRecordCount, premiumRecordCount, sourceCount }
}

function textField(label: string, value: unknown): Field | null {
  if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean') return null
  const text = String(value).trim()
  return text ? { label, value: text.slice(0, 1000) } : null
}

function labelFor(value: string) {
  return value.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').replace(/\b\w/g, character => character.toUpperCase())
}

const hiddenKeys = new Set(['key', 'api_key', 'apikey', 'uid', 'uuid'])

function fieldsFrom(value: unknown, prefix = '', depth = 0): Field[] {
  if (!value || typeof value !== 'object' || depth > 4) return []
  return Object.entries(value as Record<string, unknown>).flatMap(([key, item]) => {
    if (hiddenKeys.has(key.toLowerCase()) || item === null || item === undefined || item === '') return []
    const label = prefix ? `${prefix} · ${labelFor(key)}` : labelFor(key)
    const field = textField(label, item)
    if (field) return [field]
    if (Array.isArray(item)) {
      const simple = item.filter(entry => ['string', 'number', 'boolean'].includes(typeof entry)).slice(0, 20)
      if (simple.length) return [{ label, value: simple.join(', ').slice(0, 1000) }]
      return item.slice(0, 10).flatMap((entry, index) => fieldsFrom(entry, `${label} ${index + 1}`, depth + 1))
    }
    return fieldsFrom(item, label, depth + 1)
  }).slice(0, 80)
}

type CarsXeResult = { ok: boolean; status: number; data: Record<string, unknown> | null; code?: string }

async function fetchCarsXe(endpoint: string, vin: string): Promise<CarsXeResult> {
  const key = process.env.CARSXE_API_KEY
  if (!key) return { ok: false, status: 0, data: null, code: 'not_configured' }
  const url = new URL(`https://api.carsxe.com/${endpoint.replace(/^\//, '')}`)
  url.searchParams.set('key', key)
  url.searchParams.set('vin', vin)
  try {
    const response = await fetch(url, { headers: { Accept: 'application/json' }, next: { revalidate: 86400 }, signal: AbortSignal.timeout(20000) })
    const data = await response.json().catch(() => null)
    const object = data && typeof data === 'object' && !Array.isArray(data) ? data as Record<string, unknown> : null
    const success = object?.success
    const failed = success === false || Boolean(object?.error)
    console.info('[carsxe] provider response', { endpoint, status: response.status, success: success ?? null })
    return { ok: response.ok && !failed, status: response.status, data: object, code: failed ? 'provider_error' : undefined }
  } catch {
    console.warn('[carsxe] network or parsing failure', { endpoint })
    return { ok: false, status: 0, data: null, code: 'network_error' }
  }
}

function unavailableSection(title: string, result: CarsXeResult, premium = true): RecordSection {
  const status = result.code === 'not_configured' ? 'This data source is not configured.'
    : result.status === 401 || result.status === 403 ? 'This data source is not enabled for the current account.'
      : result.status === 429 ? 'The data source request limit has been reached.' : 'No usable records were returned for this VIN.'
  return { title, status, records: [], code: result.code || `http_${result.status}`, premium }
}

export async function fetchVehicleProfile(vin: string): Promise<RecordSection> {
  const title = 'Vehicle identity'
  const empty = (status: string, code = 'unavailable'): RecordSection => ({ title, status, records: [], code, premium: false })
  try {
    const response = await fetch(`https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValuesExtended/${encodeURIComponent(vin)}?format=json`, { next: { revalidate: 86400 }, signal: AbortSignal.timeout(15000) })
    if (!response.ok) return empty('Vehicle identity data is temporarily unavailable.', `http_${response.status}`)
    const payload = await response.json()
    const row = Array.isArray(payload?.Results) ? payload.Results[0] : null
    if (!row || typeof row !== 'object') return empty('No vehicle identity data was returned.', 'no_records')
    const record = [
      textField('VIN', vin), textField('Year', row.ModelYear), textField('Make', row.Make), textField('Model', row.Model),
      textField('Trim', row.Trim || row.Series), textField('Body class', row.BodyClass), textField('Vehicle type', row.VehicleType),
      textField('Engine', row.DisplacementL ? `${row.DisplacementL} L` : ''), textField('Fuel', row.FuelTypePrimary),
      textField('Drive type', row.DriveType), textField('Transmission', row.TransmissionStyle),
      textField('Manufacturer', row.Manufacturer), textField('Plant country', row.PlantCountry),
    ].filter((field): field is Field => field !== null)
    const hasIdentity = Boolean(String(row.ModelYear || '').trim() || String(row.Make || '').trim() || String(row.Model || '').trim())
    if (!hasIdentity) return empty('The VIN could not be decoded into vehicle identity data.', 'no_records')
    return { title, status: 'Vehicle identity data returned for this VIN.', records: [record], premium: false }
  } catch {
    return empty('Vehicle identity data is temporarily unavailable. Please retry.', 'network_error')
  }
}

async function fetchCarsXeSpecifications(vin: string): Promise<RecordSection> {
  const title = 'Vehicle specifications'
  const result = await fetchCarsXe('specs', vin)
  if (!result.ok || !result.data) return unavailableSection(title, result, false)
  const record = fieldsFrom(result.data.attributes)
  return record.length ? { title, status: 'Detailed vehicle specifications returned.', records: [record], premium: false }
    : { title, status: 'No specifications were returned.', records: [], code: 'no_records', premium: false }
}

function arrayRecords(value: unknown) {
  if (!Array.isArray(value)) return []
  return value.map(item => fieldsFrom(item)).filter(record => record.length)
}

async function fetchCarsXeHistory(vin: string): Promise<RecordSection[]> {
  const result = await fetchCarsXe('history', vin)
  const definitions = [
    ['Title and brand history', 'currentTitleInformation', 'brandsInformation'],
    ['Junk, salvage and insurance records', 'junkAndSalvageInformation', 'insuranceInformation'],
    ['Odometer and ownership history', 'historyInformation'],
  ] as const
  if (!result.ok || !result.data) return definitions.map(([title]) => unavailableSection(title, result))
  return definitions.map(([title, ...keys]) => {
    const records = keys.flatMap(key => arrayRecords(result.data?.[key]))
    return records.length ? { title, status: `${records.length} record${records.length === 1 ? '' : 's'} returned.`, records, premium: true }
      : { title, status: 'No records were returned in this category. This does not prove a clean history.', records: [], code: 'no_records', premium: true }
  })
}

async function fetchCarsXeRecalls(vin: string): Promise<RecordSection> {
  const title = 'Safety recalls'
  const result = await fetchCarsXe('v1/recalls', vin)
  if (!result.ok || !result.data) return unavailableSection(title, result)
  const data = result.data.data as Record<string, unknown> | undefined
  const records = arrayRecords(data?.recalls)
  return records.length ? { title, status: `${records.length} safety recall${records.length === 1 ? '' : 's'} returned.`, records, premium: true }
    : { title, status: 'No recall records were returned for this VIN.', records: [], code: 'no_records', premium: true }
}

async function fetchCarsXeMarketValue(vin: string): Promise<RecordSection> {
  const title = 'Market value estimates'
  const result = await fetchCarsXe('v2/marketvalue', vin)
  if (!result.ok || !result.data) return unavailableSection(title, result)
  const record = fieldsFrom(result.data).filter(field => !['Input · Vin', 'Vin'].includes(field.label))
  return record.length ? { title, status: 'Market value estimates returned for this vehicle.', records: [record], premium: true }
    : { title, status: 'No market value estimate was returned.', records: [], code: 'no_records', premium: true }
}

async function fetchCarsXeLienTheft(vin: string): Promise<RecordSection> {
  const title = 'Lien and theft records'
  const result = await fetchCarsXe('v1/lien-theft', vin)
  if (!result.ok || !result.data) return unavailableSection(title, result)
  const records = arrayRecords(result.data.events)
  return records.length ? { title, status: `${records.length} lien or theft event${records.length === 1 ? '' : 's'} returned.`, records, premium: true }
    : { title, status: 'No lien or theft events were returned for this VIN.', records: [], code: 'no_records', premium: true }
}

export async function fetchCarsXePreview(vin: string) {
  const result = await fetchCarsXe('specs', vin)
  const attributes = result.data?.attributes as Record<string, unknown> | undefined
  if (!result.ok || !attributes) return null
  const value = (key: string) => typeof attributes[key] === 'string' && attributes[key].trim() ? attributes[key].trim() : null
  return { year: value('year'), make: value('make'), model: value('model'), trim: value('trim') }
}

export async function availableRecords(vin: string) {
  const [identity, specifications, history, recalls, marketValue, lienTheft] = await Promise.all([
    fetchVehicleProfile(vin), fetchCarsXeSpecifications(vin), fetchCarsXeHistory(vin), fetchCarsXeRecalls(vin),
    fetchCarsXeMarketValue(vin), fetchCarsXeLienTheft(vin),
  ])
  const sections = [identity, specifications, ...history, recalls, marketValue, lienTheft]
  const quote = quoteForSections(sections)
  return { available: quote.baseRecordCount > 0 || quote.premiumRecordCount > 0, sections, quote }
}
