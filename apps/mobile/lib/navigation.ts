type RouterLike = {
  canGoBack: () => boolean;
  back: () => void;
  replace: (href: any) => void;
};

export function goBackOrReplace(router: RouterLike, fallback: string) {
  if (router.canGoBack()) {
    router.back();
    return;
  }

  router.replace(fallback as any);
}
