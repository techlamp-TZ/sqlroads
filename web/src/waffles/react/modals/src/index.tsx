// Trigger re-release

export { default as AlertDialog } from './AlertDialog';
export { default as Dialog } from './Dialog';
export { default as Panel } from './Panel';

// react-modal needed the app element to hide it from screen readers; the native <dialog> makes the page inert
// itself, so this is kept only so existing calls still work.
export const setAppElement = (_element?: string | HTMLElement): void => undefined;
