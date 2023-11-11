// This declares a global type that can be used anywhere in your project
declare global {
  type Nullable<T> = T | null
}

// This line is necessary to treat this file as a module and avoid global conflicts
export {}
