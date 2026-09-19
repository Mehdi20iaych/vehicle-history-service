import { NextResponse } from 'next/server'
import { fetchCarsXePreview } from '@/lib/vehicle-records'

function isVin(value: string) {
  return /^[A-HJ-NPR-Z0-9]{17}$/.test(value)
}

type VehiclePreview = {
  year: string | null
  make: string | null
  model: string | null
  trim: string | null
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function firstText(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim()
    if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  }
  return null
}

function vehiclePreviewFrom(data: unknown): VehiclePreview {
  const root = asRecord(data) || {}
  const nested = [root.data, root.vehicle, root.result, root.results, root.Results]
    .flatMap((value) => Array.isArray(value) ? value : [value])
    .map(asRecord)
    .find(Boolean) || root

  return {
    year: firstText(nested.year, nested.model_year, nested.modelYear, nested.ModelYear, root.year, root.model_year),
    make: firstText(nested.make, nested.manufacturer, nested.Make, root.make, root.manufacturer),
    model: firstText(nested.model, nested.Model, root.model),
    trim: firstText(nested.trim, nested.series, nested.Trim, root.trim, root.series),
  }
}

async function enrichPreviewFromVin(vin: string, preview: VehiclePreview): Promise<VehiclePreview> {
  if (preview.year && preview.make && preview.model) return preview

  try {
    const response = await fetch(
      `https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValuesExtended/${encodeURIComponent(vin)}?format=json`,
      { cache: 'no-store' },
    )
    const data = await response.json().catch(() => null)
    const decoded = asRecord(data)?.Results
    const result = Array.isArray(decoded) ? asRecord(decoded[0]) : null
    if (!result) return preview

    return {
      year: preview.year || firstText(result.ModelYear),
      make: preview.make || firstText(result.Make),
      model: preview.model || firstText(result.Model),
      trim: preview.trim || firstText(result.Trim, result.Series),
    }
  } catch {
    return preview
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const vin = typeof body?.vin === 'string' ? body.vin.replace(/\s/g, '').toUpperCase() : ''

    if (!isVin(vin)) {
      return NextResponse.json(
        { valid: false, message: 'Please enter a valid 17-character VIN.' },
        { status: 400 },
      )
    }

    const carsXeVehicle = await fetchCarsXePreview(vin)
    const vehicle = await enrichPreviewFromVin(vin, carsXeVehicle || vehiclePreviewFrom(null))

    return NextResponse.json({
      valid: true,
      verification: carsXeVehicle ? 'carsxe' : 'nhtsa',
      vehicle,
    })
  } catch {
    return NextResponse.json(
      { valid: false, message: 'We could not verify that VIN right now. Please try again.' },
      { status: 500 },
    )
  }
}
