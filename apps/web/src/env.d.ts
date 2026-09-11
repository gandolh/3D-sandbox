/** Injected by vite `define`. Empty means no API is configured — see vite.config.ts. */
declare const __API_BASE__: string;

/**
 * File System Access, which TypeScript's DOM lib does not yet declare.
 *
 * Only the sliver a render queue needs: pick a directory once, write a file per
 * shot. Declared `| undefined` on `Window` rather than assumed present, because
 * the fallback path is the whole point — see `saveRenders` in `Viewport.tsx`.
 */
interface FileSystemWritableFileStream {
  write(data: Blob): Promise<void>;
  close(): Promise<void>;
}
interface FileSystemFileHandle {
  createWritable(): Promise<FileSystemWritableFileStream>;
}
interface FileSystemDirectoryHandle {
  readonly name: string;
  getFileHandle(name: string, options?: { create?: boolean }): Promise<FileSystemFileHandle>;
}
interface Window {
  showDirectoryPicker?: (options?: {
    id?: string;
    mode?: "read" | "readwrite";
  }) => Promise<FileSystemDirectoryHandle>;
}
