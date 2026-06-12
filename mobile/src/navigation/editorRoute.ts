import { useRouter } from 'expo-router';

type Router = ReturnType<typeof useRouter>;

/** Pop the editor modal and return to the existing tab screen. */
export function closeEditor(router: Router) {
  if (router.canGoBack()) {
    router.back();
    return;
  }
  router.replace('/(tabs)/(library)');
}

/** Push the editor once; skip if it is already on screen. */
export function openEditor(router: Router, pathname: string) {
  if (pathname === '/editor') return;
  router.push('/editor');
}
