import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        // Reuse catalogue data across tab switches; older data is refreshed in the background.
        staleTime: 60_000,
        gcTime: 30 * 60_000,
        refetchOnWindowFocus: false,
        retry: 1,
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    // Start loading a page's code and data when a link is hovered or touched.
    defaultPreload: "intent",
    defaultPreloadDelay: 40,
    // React Query owns caching, so the router always asks it (it answers from cache when fresh).
    defaultPreloadStaleTime: 0,
  });

  return router;
};
