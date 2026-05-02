type Listener = () => void;
const _listeners: Set<Listener> = new Set();

export function onMergeComplete(fn: Listener): () => void {
  _listeners.add(fn);
  return () => {
    _listeners.delete(fn);
  };
}

export function emitMergeComplete(): void {
  _listeners.forEach((fn) => fn());
}
