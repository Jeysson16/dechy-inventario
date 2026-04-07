import React, { createContext, useContext, useState } from "react";

const LayoutContext = createContext();

export const LayoutProvider = ({ children }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const handleNavItemClick = () => {
    if (window.matchMedia("(max-width: 767px)").matches) {
      setIsMobileMenuOpen(false);
    }
    if (isSidebarCollapsed) {
      setIsSidebarCollapsed(false);
    }
  };

  return (
    <LayoutContext.Provider
      value={{
        isMobileMenuOpen,
        setIsMobileMenuOpen,
        isSidebarCollapsed,
        setIsSidebarCollapsed,
        handleNavItemClick,
      }}
    >
      {children}
    </LayoutContext.Provider>
  );
};

export const useLayout = () => {
  const context = useContext(LayoutContext);
  if (!context) {
    throw new Error("useLayout must be used within LayoutProvider");
  }
  return context;
};
