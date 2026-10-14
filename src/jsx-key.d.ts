// React 19 ships without type definitions and @types/react is not installed,
// so JSX has no IntrinsicAttributes. This lets list items pass `key` to
// function components.
declare global {
  namespace JSX {
    interface IntrinsicAttributes {
      key?: string | number | bigint | null;
    }
  }
}
export {};
