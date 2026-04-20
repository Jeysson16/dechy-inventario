import React, { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { collection, doc, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../../config/firebase";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import { useLayout } from "../../context/LayoutContext";
import { useDynamicMeta } from "../../hooks/useDynamicMeta";

const ROLE_LABELS = {
  admin: { label: "Admin", color: "bg-violet-100 text-violet-700" },
  manager: { label: "Gerente", color: "bg-indigo-100 text-indigo-700" },
  employee: { label: "Vendedor", color: "bg-emerald-100 text-emerald-700" },
  cajera: { label: "Cajera", color: "bg-amber-100 text-amber-700" },
};

const AppLayout = ({ children }) => {
  const { userRole, isAdmin, displayName, logout, currentBranch, userProfile } =
    useAuth();
  const { theme, toggleTheme } = useTheme();
  const [pendingPaymentsCount, setPendingPaymentsCount] = useState(0);
  const [pendingDeliveryCount, setPendingDeliveryCount] = useState(0);
  const [branchDetails, setBranchDetails] = useState(null);

  useEffect(() => {
    const paymentsQuery = query(
      collection(db, "sales"),
      where("status", "==", "pending_payment"),
    );
    const deliveryQuery = query(
      collection(db, "sales"),
      where("status", "==", "pending_delivery"),
    );

    const unsubscribePayments = onSnapshot(paymentsQuery, (snapshot) => {
      setPendingPaymentsCount(snapshot.size);
    });

    const unsubscribeDelivery = onSnapshot(deliveryQuery, (snapshot) => {
      setPendingDeliveryCount(snapshot.size);
    });

    return () => {
      unsubscribePayments();
      unsubscribeDelivery();
    };
  }, []);

  useEffect(() => {
    if (!currentBranch?.id) {
      setBranchDetails(null);
      return;
    }

    const branchRef = doc(db, "branches", currentBranch.id);
    const unsubBranch = onSnapshot(branchRef, (snap) => {
      if (!snap.exists()) {
        setBranchDetails(null);
        return;
      }
      setBranchDetails({ id: snap.id, ...snap.data() });
    });

    return () => unsubBranch();
  }, [currentBranch?.id]);

  const activeBranch = branchDetails || currentBranch;

  // Update document title and favicon
  useDynamicMeta(activeBranch);
  const location = useLocation();
  const {
    isMobileMenuOpen,
    setIsMobileMenuOpen,
    isSidebarCollapsed,
    setIsSidebarCollapsed,
    handleNavItemClick,
  } = useLayout();
  const [isSupportModalOpen, setIsSupportModalOpen] = useState(false);
  const isActive = (path) => location.pathname === path;
  const roleInfo = ROLE_LABELS[userRole] || ROLE_LABELS.employee;

  // Nav sections with role visibility
  const navSections = [
    {
      title: "General",
      items: [
        { to: "/panel", label: "Inicio", icon: "dashboard", show: true },
        {
          to: "/sucursales",
          label: "Empresas",
          icon: "store",
          show: userRole === "admin",
        },
      ],
    },
    {
      title: "Operaciones",
      items: [
        {
          to: "/ingresos",
          label: "Ingresos",
          icon: "move_to_inbox",
          show: true,
        },
        { to: "/ventas", label: "Ventas", icon: "point_of_sale", show: true },
        {
          to: "/caja",
          label: "Caja",
          icon: "payments",
          show:
            userRole === "admin" ||
            userRole === "manager" ||
            userRole === "cajera",
        },
        {
          to: "/despacho",
          label: "Despacho",
          icon: "local_shipping",
          show: true,
        },
        {
          to: "/envios",
          label: "Pedidos",
          icon: "package_2",
          show: isAdmin,
        },
      ],
    },
    {
      title: "Catálogo",
      items: [
        {
          to: "/inventario",
          label: "Inventario",
          icon: "inventory_2",
          show: true,
        },
        {
          to: "/categorias",
          label: "Categorías",
          icon: "category",
          show: true,
        },
        { to: "/clientes", label: "Clientes", icon: "groups", show: true },
      ],
    },
    {
      title: "Administración",
      items: [
        { to: "/empleados", label: "Empleados", icon: "group", show: isAdmin },
      ],
    },
  ]
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => item.show),
    }))
    .filter((section) => section.items.length > 0);

  return (
    <div
      className="flex h-screen overflow-hidden bg-slate-50 dark:bg-slate-950 font-display transition-all duration-300"
      style={
        activeBranch
          ? {
              "--color-primary": activeBranch.primaryColor || "#7553e1",
              "--color-primary-light": activeBranch.secondaryColor || "#8d65f7",
            }
          : {}
      }
    >
      {/* Sidebar for Desktop & Mobile Overlay */}
      <>
        {/* Mobile Overlay */}
        {isMobileMenuOpen && (
          <div
            className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm md:hidden transition-opacity"
            onClick={() => setIsMobileMenuOpen(false)}
          />
        )}

        {/* Floating Toggle Button (Visible when collapsed) */}
        {isSidebarCollapsed && (
          <button
            onClick={() => setIsSidebarCollapsed(false)}
            className="fixed left-0 top-6 z-50 py-3 pr-3 pl-1 bg-white dark:bg-slate-900 rounded-r-full shadow-lg border-y border-r border-slate-200 dark:border-slate-800 text-slate-500 hover:text-primary transition-all hidden md:flex items-center justify-center hover:pr-4 active:scale-95 group"
            title="Expandir menú"
          >
            <span className="material-symbols-outlined group-hover:animate-pulse">
              chevron_right
            </span>
          </button>
        )}

        {/* Sidebar */}
        <aside
          className={`fixed inset-y-0 left-0 z-50 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 transform transition-all duration-300 ease-in-out flex flex-col w-72 ${
            isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
          } ${isSidebarCollapsed ? "md:-translate-x-full" : "md:translate-x-0"}`}
        >
          {/* Logo Section */}
          <div className="h-20 flex items-center justify-between px-6 border-b border-slate-100 dark:border-slate-800 shrink-0">
            <Link
              to="/panel"
              className="flex items-center gap-3 group overflow-hidden"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              {activeBranch?.image ? (
                <img
                  src={activeBranch.image}
                  alt={activeBranch.name}
                  className="size-10 rounded-xl object-contain bg-white shrink-0"
                />
              ) : (
                <img
                  src="/inventario_logo.png"
                  alt="Logo"
                  className="size-10 object-contain shrink-0"
                />
              )}
              <div className="flex flex-col min-w-0">
                <h2 className="text-slate-900 dark:text-white text-xl font-black leading-none tracking-tight truncate">
                  {activeBranch?.name || "INVENTARIO"}
                </h2>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest truncate">
                  Inventario
                </span>
              </div>
            </Link>

            {/* Collapse Button */}
            <button
              onClick={() => setIsSidebarCollapsed(true)}
              className="hidden md:flex p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              title="Colapsar menú"
            >
              <span className="material-symbols-outlined text-xl">
                chevron_left
              </span>
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto py-6 px-4 space-y-5 custom-scrollbar">
            {navSections.map((section) => (
              <div key={section.title}>
                <div className="mb-2 px-4">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    {section.title}
                  </span>
                </div>
                <div className="space-y-1">
                  {section.items.map((item) => (
                    <Link
                      key={item.to}
                      to={item.to}
                      onClick={handleNavItemClick}
                      className={`flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-bold transition-all group relative overflow-hidden whitespace-nowrap ${
                        isActive(item.to)
                          ? "text-primary bg-primary/5 dark:bg-primary/10 shadow-sm"
                          : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800"
                      }`}
                    >
                      {isActive(item.to) && (
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-primary rounded-r-full"></div>
                      )}
                      <span
                        className={`material-symbols-outlined text-[22px] transition-colors shrink-0 ${
                          isActive(item.to)
                            ? "text-primary"
                            : "text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300"
                        }`}
                      >
                        {item.icon}
                      </span>
                      <span className="truncate">{item.label}</span>
                      {item.to === "/caja" && pendingPaymentsCount > 0 && (
                        <span className="ml-auto inline-flex items-center gap-2 rounded-full bg-rose-500 px-2.5 py-1 text-[11px] font-black uppercase text-white tracking-[0.1em]">
                          <span className="material-symbols-outlined text-[16px]">
                            notifications
                          </span>
                          {pendingPaymentsCount}
                        </span>
                      )}
                      {item.to === "/despacho" && pendingDeliveryCount > 0 && (
                        <span className="ml-auto inline-flex items-center gap-2 rounded-full bg-emerald-500 px-2.5 py-1 text-[11px] font-black uppercase text-white tracking-[0.1em]">
                          <span className="material-symbols-outlined text-[16px]">
                            notifications
                          </span>
                          {pendingDeliveryCount}
                        </span>
                      )}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </nav>

          {/* User Profile Section (Bottom) */}
          <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 shrink-0">
            <div className="flex items-center gap-3 p-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
              <div className="size-10 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden flex items-center justify-center text-slate-500 font-bold text-sm border-2 border-white dark:border-slate-600 shadow-sm shrink-0">
                {userProfile?.avatarUrl ? (
                  <img
                    src={userProfile.avatarUrl}
                    alt={displayName}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  displayName?.charAt(0).toUpperCase()
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
                  {displayName}
                </p>
                <div className="flex items-center gap-1.5">
                  <span
                    className={`text-[9px] font-black px-1.5 py-0.5 rounded-md uppercase tracking-wider truncate ${roleInfo.color}`}
                  >
                    {roleInfo.label}
                  </span>
                </div>
              </div>
              <button
                onClick={toggleTheme}
                className="size-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-all shrink-0"
                title={
                  theme === "dark"
                    ? "Cambiar a modo claro"
                    : "Cambiar a modo oscuro"
                }
              >
                <span className="material-symbols-outlined text-[20px]">
                  {theme === "dark" ? "light_mode" : "dark_mode"}
                </span>
              </button>
              <button
                onClick={() => logout()}
                className="size-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-all shrink-0"
                title="Cerrar sesión"
              >
                <span className="material-symbols-outlined text-[20px]">
                  logout
                </span>
              </button>
            </div>
            <div className="mt-3 flex justify-center">
              <p className="text-[10px] text-slate-400 font-medium truncate">
                © {new Date().getFullYear()} JIEDA S.A.C. v1.0
              </p>
            </div>
          </div>
        </aside>
      </>

      {/* Main Content Wrapper */}
      <div
        className={`flex-1 flex flex-col transition-all duration-300 h-full overflow-hidden ${
          isSidebarCollapsed ? "md:ml-0" : "md:ml-72"
        }`}
      >
        {/* Mobile Header */}
        <header className="md:hidden h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-4 sticky top-0 z-30">
          <button
            onClick={() => setIsMobileMenuOpen(true)}
            className="p-2 -ml-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            <span className="material-symbols-outlined">menu</span>
          </button>
          <div className="flex items-center gap-2">
            {activeBranch?.image ? (
              <img
                src={activeBranch.image}
                alt={activeBranch.name || "Logo"}
                className="size-8 object-contain"
              />
            ) : (
              <img
                src="/inventario_logo.png"
                alt="Logo"
                className="size-8 object-contain"
              />
            )}
            <span className="font-black text-slate-900 dark:text-white truncate max-w-[130px]">
              {activeBranch?.name || "INVENTARIO"}
            </span>
          </div>
          <div className="size-8"></div> {/* Spacer for centering */}
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
      {/* Support Easter Egg Modal */}
      {isSupportModalOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn"
          onClick={() => setIsSupportModalOpen(false)}
        >
          <div
            className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl p-8 max-w-sm w-full text-center animate-slideUp border border-slate-200 dark:border-slate-800"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="size-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <span className="material-symbols-outlined text-primary text-4xl">
                support_agent
              </span>
            </div>
            <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-2">
              Asistencia Técnica
            </h3>
            <p className="text-slate-600 dark:text-slate-400 font-medium text-lg leading-relaxed mb-8">
              Llama a tu salvador el{" "}
              <span className="text-primary font-bold bg-primary/10 px-2 py-0.5 rounded-lg">
                Jason
              </span>{" "}
              xd
            </p>
            <button
              onClick={() => setIsSupportModalOpen(false)}
              className="w-full py-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-2xl transition-colors"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AppLayout;
