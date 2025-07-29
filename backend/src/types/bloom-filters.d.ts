declare module 'bloom-filters' {
  export class BloomFilter {
    constructor(size: number, hashFunctions: number);
    add(item: string): void;
    has(item: string): boolean;
    clear(): void;
  }
}

declare module 'parallelize' {
  export function parallelize<T>(
    fn: () => T[],
    options?: {
      maxConcurrency?: number
    }
  ): T[];
} 