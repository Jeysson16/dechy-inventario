import { useEffect } from 'react';

/**
 * Custom hook to dynamically update document title and favicon
 * @param {Object} branch - The current branch object containing name and image
 */
export const useDynamicMeta = (branch) => {
  useEffect(() => {
    // Default values
    const DEFAULT_TITLE = 'Inventario';
    const DEFAULT_ICON = '/inventario_logo.png';

    // Update Title
    const newTitle = branch?.name ? `${branch.name} - ${DEFAULT_TITLE}` : DEFAULT_TITLE;
    document.title = newTitle;

    // Update Favicon
    const updateFavicon = (href) => {
      let link = document.querySelector("link[rel~='icon']");
      if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.head.appendChild(link);
      }
      link.href = href;
    };

    const newIcon = branch?.image || DEFAULT_ICON;
    updateFavicon(newIcon);

    // Optional: Cleanup on unmount (revert to defaults if needed)
    // However, since AppLayout stays mounted across routes, we rely on props changing.
    // Pages like Login will call this with null to reset.
  }, [branch]);
};
