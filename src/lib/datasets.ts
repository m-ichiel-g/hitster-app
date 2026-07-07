export interface Track {
  id: string
  title: string
  artist: string
  year: number
  cover: string
  rank: number
}

export interface Dataset {
  id: string
  name: string
  source_playlist: string
  tracks: Track[]
}

export interface DatasetInfo {
  id: string
  name: string
  file: string
}

// Register hier elke nieuwe dataset; de UI leest deze lijst en hardcodet geen bestandsnaam.
export const DATASETS: DatasetInfo[] = [
  { id: 'top2000-2025', name: 'NPO Radio 2 Top 2000 (2025)', file: '/data/top2000-2025.json' },
]

export function getDatasetInfo(id: string): DatasetInfo | undefined {
  return DATASETS.find((d) => d.id === id)
}

export async function loadDataset(id: string): Promise<Dataset> {
  const info = getDatasetInfo(id)
  if (!info) {
    throw new Error(`Onbekende dataset: ${id}`)
  }
  const res = await fetch(info.file)
  if (!res.ok) {
    throw new Error(`Kon dataset niet laden (${res.status}): ${info.file}`)
  }
  return res.json()
}
