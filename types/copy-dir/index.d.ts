declare function CopyDir(from: string, to: string, callback?: () => {}): void

declare module CopyDir {
  function sync(from: string, to: string): void
}

declare module "copy-dir" {
  export = CopyDir;
}