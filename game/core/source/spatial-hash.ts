/**
 * Spatial hash grid for efficient broad-phase collision detection.
 * Uses prime number hashing on cell coordinates.
 */

interface SpatialEntry {
  id: number;
  x: number;
  z: number;
  radius: number;
}

export class SpatialHash {
  private readonly cellSize: number;
  private readonly invCellSize: number;
  private readonly buckets: Map<number, SpatialEntry[]>;
  // Pre-allocated array for query results to avoid allocations during tick
  private readonly queryResults: number[];

  constructor(cellSize: number = 4) {
    this.cellSize = cellSize;
    this.invCellSize = 1 / cellSize;
    this.buckets = new Map();
    this.queryResults = [];
  }

  clear(): void {
    this.buckets.clear();
  }

  insert(id: number, x: number, z: number, radius: number): void {
    const minCellX = Math.floor((x - radius) * this.invCellSize);
    const maxCellX = Math.floor((x + radius) * this.invCellSize);
    const minCellZ = Math.floor((z - radius) * this.invCellSize);
    const maxCellZ = Math.floor((z + radius) * this.invCellSize);

    const entry: SpatialEntry = { id, x, z, radius };

    for (let cx = minCellX; cx <= maxCellX; cx++) {
      for (let cz = minCellZ; cz <= maxCellZ; cz++) {
        const hash = this.hashCell(cx, cz);
        let bucket = this.buckets.get(hash);
        if (!bucket) {
          bucket = [];
          this.buckets.set(hash, bucket);
        }
        bucket.push(entry);
      }
    }
  }

  query(x: number, z: number, radius: number): number[] {
    this.queryResults.length = 0;

    const minCellX = Math.floor((x - radius) * this.invCellSize);
    const maxCellX = Math.floor((x + radius) * this.invCellSize);
    const minCellZ = Math.floor((z - radius) * this.invCellSize);
    const maxCellZ = Math.floor((z + radius) * this.invCellSize);

    const seen = new Set<number>();
    const radiusSq = radius * radius;

    for (let cx = minCellX; cx <= maxCellX; cx++) {
      for (let cz = minCellZ; cz <= maxCellZ; cz++) {
        const hash = this.hashCell(cx, cz);
        const bucket = this.buckets.get(hash);
        if (!bucket) continue;

        for (let i = 0; i < bucket.length; i++) {
          const entry = bucket[i];
          if (seen.has(entry.id)) continue;
          seen.add(entry.id);

          // Check actual distance (circle vs circle)
          const dx = entry.x - x;
          const dz = entry.z - z;
          const distSq = dx * dx + dz * dz;
          const combinedRadius = radius + entry.radius;

          if (distSq <= combinedRadius * combinedRadius) {
            this.queryResults.push(entry.id);
          }
        }
      }
    }

    return this.queryResults;
  }

  private hashCell(cx: number, cz: number): number {
    // Use prime number hashing for good distribution
    return ((cx * 73856093) ^ (cz * 19349663)) | 0;
  }
}
