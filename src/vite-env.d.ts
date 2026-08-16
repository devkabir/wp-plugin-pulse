/// <reference types="vite/client" />
/// <reference types="bun-types/test.d.ts" />

declare const Bun: {
  file: (path: string) => {
    text: () => Promise<string>;
  };
};

declare module '*vite.config.js' {
  export const COLLECTION_FIELDS: Record<string, number>;
  export const SLUG_FIELDS: Record<string, number>;
  export function localDateKey(date?: Date): string;
  export function cacheFileFor(mode: string, query: string, page?: number): string;
  export function wordpressEndpoint(mode: string, query: string, page?: number): URL;
  export function readCachedResponse(cacheFile: string, mode: string): Promise<any>;
  export function fetchAndCache(mode: string, query: string, page: number, cacheFile: string): Promise<any>;
  export function getPlugins(mode: string, query: string, page: number): Promise<{ data: any; cacheStatus: string }>;
  export function pluginCacheMiddleware(): any;
  export function handlePluginRequest(request: any, response: any): Promise<void>;
}



