declare module "zustand" {
  export type StateCreator<T> = (
    set: (
      partial: Partial<T> | ((state: T) => Partial<T>),
      replace?: boolean
    ) => void,
    get: () => T
  ) => T

  export function create<T>(initializer: StateCreator<T>): () => T
}

