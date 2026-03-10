import {
    AlertTriangle,
    DollarSign,
    Edit,
    History,
    LayoutGrid,
    List as ListIcon,
    Loader2,
    MapPin,
    MoreVertical,
    Package,
    Plus,
    RefreshCw,
    Search,
    Tags,
    Trash2,
    X
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import DraggableContainer from '../components/common/DraggableContainer';
import LayoutPreview from '../components/inventory/LayoutPreview';
import AppLayout from '../components/layout/AppLayout';
import { supabase } from '../config/supabaseClient';
import { useAuth } from '../context/AuthContext';

// Componentes UI reutilizables para mantener consistencia con el diseño legacy
const Card = ({ children, className = '' }) => (
  <div className={`bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 shadow-sm ${className}`}>
    {children}
  </div>
);

const CardContent = ({ children, className = '' }) => (
  <div className={`p-6 ${className}`}>
    {children}
  </div>
);

const Badge = ({ children, variant = 'default', className = '' }) => {
  const variants = {
    default: 'bg-gray-100 text-gray-800 dark:bg-slate-700 dark:text-slate-200',
    success: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
    warning: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
    destructive: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
    outline: 'border border-gray-200 text-gray-600 dark:border-slate-600 dark:text-slate-400'
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${variants[variant]} ${className}`}>
      {children}
    </span>
  );
};

const Button = ({ children, variant = 'default', size = 'default', className = '', ...props }) => {
  const baseStyles = "inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50";
  const variants = {
    default: "bg-blue-600 text-white hover:bg-blue-700 shadow-sm dark:bg-blue-600 dark:hover:bg-blue-500",
    outline: "border border-gray-200 bg-white hover:bg-gray-100 text-gray-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700",
    ghost: "hover:bg-gray-100 hover:text-gray-900 dark:hover:bg-slate-800 dark:text-slate-300 dark:hover:text-white",
    destructive: "bg-red-600 text-white hover:bg-red-700 dark:bg-red-600 dark:hover:bg-red-500",
  };
  const sizes = {
    default: "h-10 px-4 py-2",
    sm: "h-9 rounded-md px-3",
    icon: "h-10 w-10",
  };
  return (
    <button className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`} {...props}>
      {children}
    </button>
  );
};

const formatCurrency = (value) => {
  return new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(value);
};

const InventoryList = () => {
  const { currentBranch, userProfile } = useAuth();
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Layout states for visualization
  const [branchLayouts, setBranchLayouts] = useState([]);
  const [currentLayoutId, setCurrentLayoutId] = useState(null);
  const [locationModalOpen, setLocationModalOpen] = useState(false);
  const [selectedProductForLocation, setSelectedProductForLocation] = useState(null);
  const [tempLocations, setTempLocations] = useState({});
  const [isSavingLocation, setIsSavingLocation] = useState(false);
  const [zoom, setZoom] = useState(1);
  
  // View states
  const [viewMode, setViewMode] = useState('list'); // 'list' | 'grid'
  const [selectedCategory, setSelectedCategory] = useState('Todos');
  const [categories, setCategories] = useState(['Todos']);

  // History states
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [selectedProductForHistory, setSelectedProductForHistory] = useState(null);
  const [productHistory, setProductHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Helper to parse JSON safely
  const tryParseJSON = (jsonString) => {
    try {
      if (typeof jsonString === 'object' && jsonString !== null) return jsonString;
      const o = JSON.parse(jsonString);
      if (o && typeof o === "object") {
        return o;
      }
    }
    catch { /* empty */ }
    return {};
  };

  const fetchProducts = useCallback(async () => {
    if (!currentBranch) return;
    setLoading(true);
    try {
      // 1. Fetch Inventory joined with Products and Categories
      const { data, error } = await supabase
        .from('inventory')
        .select(`
            id,
            stock_current,
            stock_min,
            location_code,
            products!inventory_product_id_fkey (
                id,
                sku,
                name,
                unit_price,
                box_price,
                units_per_box,
                image_url,
                categories!products_category_id_fkey ( name )
            )
        `)
        .eq('branch_id', currentBranch.id);

      if (error) throw error;

      const productsData = [];
      const uniqueCategories = new Set(['Todos']);

      (data || []).forEach((item) => {
        const prod = item.products;
        if (!prod) return;

        const currentStock = item.stock_current || 0;
        const minStock = item.stock_min || 0;
        
        let status = 'Disponible';
        if (currentStock < minStock && currentStock > 0) {
          status = 'Stock Bajo';
        } else if (currentStock === 0) {
          status = 'Agotado';
        }

        const categoryName = prod.categories?.name || 'Sin Categoría';
        uniqueCategories.add(categoryName);

        // Parse locations safely
        const locations = tryParseJSON(item.location_code);

        productsData.push({ 
          id: prod.id, // Global Product ID
          inventoryId: item.id, // Inventory Record ID
          sku: prod.sku || 'S/N',
          name: prod.name,
          category: categoryName,
          unitPrice: prod.unit_price || 0,
          boxPrice: prod.box_price || 0,
          unitsPerBox: prod.units_per_box || 1,
          imageUrl: prod.image_url,
          
          currentStock,
          minStock,
          status,
          
          // Mapped for UI
          stock: currentStock, 
          image: prod.image_url, 
          price: prod.unit_price || 0, 
          location: locations, 
          locations: locations 
        });
      });

      setProducts(productsData);
      setCategories(Array.from(uniqueCategories));
    } catch (error) {
      console.error("Error fetching products:", error);
      toast.error("Error al cargar los productos.");
    } finally {
      setLoading(false);
    }
  }, [currentBranch]);

  useEffect(() => {
    if (!currentBranch) return;

    fetchProducts();

    // Fetch Branch Layouts
    const fetchLayouts = async () => {
        try {
            const { data } = await supabase
                .from('branches')
                .select('settings')
                .eq('id', currentBranch.id)
                .single();
            
            const settings = data?.settings || {};
            if (settings.layouts && Array.isArray(settings.layouts)) {
                setBranchLayouts(settings.layouts);
                if (settings.layouts.length > 0 && !currentLayoutId) {
                    setCurrentLayoutId(settings.layouts[0].id);
                }
            }
        } catch (e) {
            console.error("Error fetching layouts:", e);
        }
    };
    fetchLayouts();

    // Realtime subscription for Inventory
    const channel = supabase
      .channel('public:inventory')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'inventory', 
        filter: `branch_id=eq.${currentBranch.id}` 
      }, () => {
        fetchProducts(); 
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentBranch, fetchProducts]);

  // Computed active layout
  const activeLayout = useMemo(() => {
    if (!branchLayouts.length) return null;
    if (currentLayoutId) {
        return branchLayouts.find(l => l.id === currentLayoutId) || branchLayouts[0];
    }
    return branchLayouts[0];
  }, [branchLayouts, currentLayoutId]);

  const filteredProducts = useMemo(() => {
    return products.filter(product => {
      const matchesSearch = 
        product.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.sku?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesCategory = selectedCategory === 'Todos' || product.category === selectedCategory;
      
      return matchesSearch && matchesCategory;
    });
  }, [products, searchTerm, selectedCategory]);

  // Computed KPIs
  const kpis = useMemo(() => {
    let totalProducts = 0;
    let totalValue = 0;
    let lowStock = 0;
    let totalCategories = categories.length - 1; // Exclude 'Todos'

    filteredProducts.forEach(p => {
        totalProducts += p.stock;
        totalValue += p.stock * p.price;
        if (p.stock <= p.minStock) lowStock++;
    });

    return { totalProducts, totalValue, lowStock, totalCategories };
  }, [filteredProducts, categories]);

  // --- Handlers ---

  const handleDelete = async (product) => {
    if (window.confirm('¿Está seguro de eliminar este producto del inventario?')) {
      try {
        if (product && product.inventoryId) {
             const { error } = await supabase.from('inventory').delete().eq('id', product.inventoryId);
             if (error) throw error;
             toast.success("Producto eliminado del inventario.");
             fetchProducts();
        }
      } catch (error) {
        console.error("Error deleting product: ", error);
        toast.error("Hubo un error al eliminar el producto.");
      }
    }
  };

  const openLocationModal = (product) => {
      setSelectedProductForLocation(product);
      setTempLocations(product.locations || {});
      setLocationModalOpen(true);
  };

  const toggleLocation = (areaId) => {
      setTempLocations(prev => {
          const next = { ...prev };
          if (next[areaId] !== undefined) {
              delete next[areaId];
          } else {
              next[areaId] = 0; // Initialize with 0
          }
          return next;
      });
  };

  const updateLocationQuantity = (areaId, qty) => {
      setTempLocations(prev => ({
          ...prev,
          [areaId]: Number(qty)
      }));
  };

  const saveLocations = async () => {
    if (!selectedProductForLocation) return;
    
    // Calculate total in locations
    const totalInLocations = Object.values(tempLocations).reduce((a, b) => a + Number(b), 0);
    
    setIsSavingLocation(true);
    try {
        const { error } = await supabase
            .from('inventory')
            .update({ location_code: tempLocations }) // Save as JSONB
            .eq('id', selectedProductForLocation.inventoryId);

        if (error) throw error;

        toast.success("Ubicaciones actualizadas");
        setLocationModalOpen(false);
        fetchProducts();
    } catch (e) {
        console.error("Error saving locations:", e);
        toast.error("Error al guardar ubicaciones");
    } finally {
        setIsSavingLocation(false);
    }
  };

  const openHistoryModal = async (product) => {
    setSelectedProductForHistory(product);
    setHistoryModalOpen(true);
    setHistoryLoading(true);
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select(`
            *,
            profiles!transactions_user_id_fkey ( full_name, email )
        `)
        .eq('product_id', product.id)
        .eq('branch_id', currentBranch.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Map to frontend structure
      const txs = data.map(t => ({
          id: t.id,
          type: t.type,
          quantity: t.quantity, 
          date: new Date(t.created_at), 
          userEmail: t.profiles?.email || 'Desconocido', 
          userName: t.profiles?.full_name || 'Usuario',
          details: t.details
      }));
      
      setProductHistory(txs);
    } catch (error) {
      console.error("Error fetching history:", error);
      toast.error('Error al cargar el historial.');
    } finally {
      setHistoryLoading(false);
    }
  };

  // --- Render Functions (Legacy Style) ---

  const renderKPIs = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <Card>
        <CardContent className="flex items-center justify-between p-6">
          <div>
            <p className="text-sm font-medium text-gray-500 dark:text-slate-400">Total Productos</p>
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{kpis.totalProducts}</h3>
            <p className="text-xs text-gray-500 dark:text-slate-500 mt-1">
              {kpis.lowStock > 0 ? `${kpis.lowStock} con stock bajo` : 'Inventario saludable'}
            </p>
          </div>
          <div className="h-12 w-12 bg-blue-50 dark:bg-blue-900/20 rounded-full flex items-center justify-center">
            <Package className="h-6 w-6 text-blue-600 dark:text-blue-400" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex items-center justify-between p-6">
          <div>
            <p className="text-sm font-medium text-gray-500 dark:text-slate-400">Valor Total</p>
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{formatCurrency(kpis.totalValue)}</h3>
            <p className="text-xs text-green-600 dark:text-green-400 mt-1 flex items-center">
              +2.5% <span className="text-gray-500 dark:text-slate-500 ml-1">vs mes anterior</span>
            </p>
          </div>
          <div className="h-12 w-12 bg-green-50 dark:bg-green-900/20 rounded-full flex items-center justify-center">
            <DollarSign className="h-6 w-6 text-green-600 dark:text-green-400" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex items-center justify-between p-6">
          <div>
            <p className="text-sm font-medium text-gray-500 dark:text-slate-400">Stock Bajo</p>
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{kpis.lowStock}</h3>
            <p className="text-xs text-red-600 dark:text-red-400 mt-1">Requieren atención</p>
          </div>
          <div className="h-12 w-12 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center">
            <AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-400" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex items-center justify-between p-6">
          <div>
            <p className="text-sm font-medium text-gray-500 dark:text-slate-400">Categorías</p>
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{kpis.totalCategories}</h3>
            <p className="text-xs text-gray-500 dark:text-slate-500 mt-1">Activas en catálogo</p>
          </div>
          <div className="h-12 w-12 bg-purple-50 dark:bg-purple-900/20 rounded-full flex items-center justify-center">
            <Tags className="h-6 w-6 text-purple-600 dark:text-purple-400" />
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderProductCard = (item) => {
    const isLowStock = item.stock <= item.minStock;
    
    return (
      <div key={item.id} className="group bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 hover:shadow-lg transition-all duration-200 overflow-hidden flex flex-col h-full">
        {/* Imagen del Producto */}
        <div className="aspect-video w-full bg-gray-100 dark:bg-slate-700 relative overflow-hidden">
          {item.imageUrl ? (
            <img 
              src={item.imageUrl} 
              alt={item.name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gray-50 dark:bg-slate-800">
              <Package className="h-12 w-12 text-gray-300 dark:text-slate-600" />
            </div>
          )}
          
          {/* Badges Flotantes */}
          <div className="absolute top-2 left-2 flex flex-col gap-2">
            <Badge variant="outline" className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm shadow-sm font-mono">
              {item.sku}
            </Badge>
          </div>
          
          <div className="absolute top-2 right-2">
            <Badge variant={isLowStock ? "destructive" : "success"} className="shadow-sm">
              {isLowStock ? 'Stock Bajo' : 'En Stock'}
            </Badge>
          </div>
        </div>

        {/* Contenido de la Tarjeta */}
        <div className="p-4 flex-1 flex flex-col">
          <div className="flex items-start justify-between gap-2 mb-2">
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white line-clamp-1" title={item.name}>
                {item.name}
              </h3>
              <p className="text-sm text-gray-500 dark:text-slate-400 flex items-center gap-1 mt-1">
                <Tags className="h-3 w-3" />
                {item.category}
              </p>
            </div>
            
            <div className="relative group/menu">
              <button className="p-1 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-full text-gray-400 hover:text-gray-600 dark:text-slate-500 dark:hover:text-slate-300 transition-colors">
                <MoreVertical className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 py-3 my-2 border-y border-gray-50 dark:border-slate-700">
            <div>
              <p className="text-xs text-gray-500 dark:text-slate-400 mb-0.5">Precio Unit.</p>
              <p className="font-semibold text-gray-900 dark:text-white">{formatCurrency(item.unitPrice)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-slate-400 mb-0.5">Stock Actual</p>
              <div className={`flex items-center gap-1.5 font-medium ${isLowStock ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                <Package className="h-3.5 w-3.5" />
                {item.stock}
              </div>
            </div>
          </div>

          <div className="mt-auto space-y-3">
            <div className="flex items-center justify-between text-xs text-gray-500 dark:text-slate-400">
              <div className="flex items-center gap-1.5 truncate max-w-[70%]">
                <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
                <button 
                  onClick={() => openLocationModal(item)}
                  className="hover:text-blue-600 dark:hover:text-blue-400 truncate text-left"
                >
                  {Object.keys(item.locations || {}).length > 0
                    ? `${Object.keys(item.locations).length} ubicaciones`
                    : 'Sin ubicación'}
                </button>
              </div>
              <span>Min: {item.minStock}</span>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2">
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full text-xs h-8"
                onClick={() => openLocationModal(item)}
              >
                <Edit className="h-3.5 w-3.5 mr-1.5" />
                Ubicación
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full text-xs h-8"
                onClick={() => openHistoryModal(item)}
              >
                <History className="h-3.5 w-3.5 mr-1.5" />
                Historial
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderProductList = () => (
    <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-slate-700/50 border-b border-gray-200 dark:border-slate-700">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">Producto</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">SKU / Categoría</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">Stock</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">Precios</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">Ubicación</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">Acciones</th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-slate-800 divide-y divide-gray-200 dark:divide-slate-700">
            {filteredProducts.map((item) => {
              const isLowStock = item.stock <= item.minStock;
              return (
                <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="h-10 w-10 flex-shrink-0 rounded-lg bg-gray-100 dark:bg-slate-700 flex items-center justify-center overflow-hidden border border-gray-200 dark:border-slate-600">
                        {item.imageUrl ? (
                          <img src={item.imageUrl} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <Package className="h-5 w-5 text-gray-400 dark:text-slate-500" />
                        )}
                      </div>
                      <div className="ml-4">
                        <div className="font-medium text-gray-900 dark:text-white">{item.name}</div>
                        {isLowStock && (
                          <span className="inline-flex items-center text-xs text-red-600 dark:text-red-400 mt-0.5">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            Stock Bajo
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900 dark:text-white font-mono">{item.sku}</div>
                    <div className="text-xs text-gray-500 dark:text-slate-400 flex items-center mt-1">
                      <Tags className="h-3 w-3 mr-1" />
                      {item.category}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className={`text-sm font-medium ${isLowStock ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                        {item.stock} unid.
                      </div>
                    </div>
                    <div className="text-xs text-gray-500 dark:text-slate-400 mt-1">Min: {item.minStock}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900 dark:text-white">{formatCurrency(item.unitPrice)}</div>
                    <div className="text-xs text-gray-500 dark:text-slate-400 mt-1">Caja: {formatCurrency(item.boxPrice)}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center text-sm text-gray-500 dark:text-slate-400">
                      <MapPin className="h-4 w-4 mr-1.5 text-gray-400 dark:text-slate-500" />
                      <button onClick={() => openLocationModal(item)} className="hover:text-blue-600 dark:hover:text-blue-400">
                        {Object.keys(item.locations || {}).length > 0 
                          ? `${Object.keys(item.locations).length} zonas`
                          : 'Asignar'}
                      </button>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end gap-2">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8"
                        onClick={() => openHistoryModal(item)}
                        title="Historial"
                      >
                        <History className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                        onClick={() => handleDelete(item)}
                        title="Eliminar"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header Principal */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Inventario</h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">Gestiona tus productos y existencias</p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" className="hidden sm:flex" onClick={() => fetchProducts()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Sincronizar
            </Button>
            <Button onClick={() => navigate('/stock-entry')}>
              <Plus className="h-4 w-4 mr-2" />
              Nuevo Movimiento
            </Button>
          </div>
        </div>

        {/* KPIs */}
        {renderKPIs()}

        {/* Barra de Herramientas y Filtros */}
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 shadow-sm p-4 mb-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            {/* Búsqueda */}
            <div className="relative flex-1 min-w-0 max-w-lg">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-gray-400 dark:text-slate-500" />
              </div>
              <input
                type="text"
                placeholder="Buscar por nombre, SKU o categoría..."
                className="block w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-blue-500 focus:border-blue-500 text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-400"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            {/* Filtros y Vistas */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center border border-gray-300 dark:border-slate-600 rounded-lg overflow-hidden">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-2 ${viewMode === 'grid' ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400' : 'bg-white dark:bg-slate-700 text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-600'}`}
                  title="Vista Cuadrícula"
                >
                  <LayoutGrid className="h-5 w-5" />
                </button>
                <div className="w-px h-9 bg-gray-300 dark:bg-slate-600" />
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2 ${viewMode === 'list' ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400' : 'bg-white dark:bg-slate-700 text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-600'}`}
                  title="Vista Lista"
                >
                  <ListIcon className="h-5 w-5" />
                </button>
              </div>

              <select
                className="block w-40 pl-3 pr-10 py-2 text-sm border border-gray-300 dark:border-slate-600 focus:outline-none focus:ring-blue-500 focus:border-blue-500 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
              >
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Contenido Principal */}
        {loading ? (
          <div className="flex flex-col items-center justify-center h-64">
            <Loader2 className="h-8 w-8 text-blue-600 animate-spin mb-4" />
            <p className="text-gray-500 dark:text-slate-400">Cargando inventario...</p>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-96 bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 border-dashed">
            <div className="h-16 w-16 bg-gray-50 dark:bg-slate-700 rounded-full flex items-center justify-center mb-4">
              <Search className="h-8 w-8 text-gray-400 dark:text-slate-500" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">No se encontraron productos</h3>
            <p className="text-gray-500 dark:text-slate-400 mt-1 max-w-sm text-center">
              Intenta ajustar los términos de búsqueda o los filtros aplicados.
            </p>
            <Button variant="outline" className="mt-4" onClick={() => {
              setSearchTerm('');
              setSelectedCategory('Todos');
            }}>
              Limpiar filtros
            </Button>
          </div>
        ) : (
          viewMode === 'grid' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredProducts.map(renderProductCard)}
            </div>
          ) : (
            renderProductList()
          )
        )}
      </div>

      {/* Location Modal */}
      {locationModalOpen && selectedProductForLocation && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
              <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
                  <div className="p-4 border-b border-gray-200 dark:border-slate-800 flex justify-between items-center bg-gray-50 dark:bg-slate-800/50">
                      <div>
                          <h3 className="font-bold text-lg text-gray-900 dark:text-white">Gestionar Ubicación</h3>
                          <p className="text-sm text-gray-500 dark:text-slate-400">Asigna donde se encuentra <b>{selectedProductForLocation.name}</b></p>
                      </div>
                      <button onClick={() => setLocationModalOpen(false)} className="p-2 hover:bg-gray-200 dark:hover:bg-slate-700 rounded-full transition-colors text-gray-500 dark:text-slate-400">
                          <X className="h-6 w-6" />
                      </button>
                  </div>
                  
                  <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
                      {/* Map View */}
                      <div className="flex-1 bg-gray-100 dark:bg-slate-950 relative overflow-hidden flex items-center justify-center p-4">
                            {/* Controls */}
                            <div className="absolute top-4 right-4 flex flex-col gap-2 z-10">
                              <button onClick={() => setZoom(z => Math.min(z + 0.1, 3))} className="p-2 bg-white dark:bg-slate-800 shadow rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 text-slate-700 dark:text-white"><Plus className="h-4 w-4" /></button>
                              <button onClick={() => setZoom(z => Math.max(z - 0.1, 0.5))} className="p-2 bg-white dark:bg-slate-800 shadow rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 text-slate-700 dark:text-white"><span className="text-xl leading-none">-</span></button>
                            </div>

                            {/* Layout Preview */}
                            <div className="w-full h-full overflow-auto">
                              <DraggableContainer>
                                  <div style={{ transform: `scale(${zoom})`, transformOrigin: 'center' }}>
                                      <LayoutPreview 
                                          layout={activeLayout} 
                                          activeLocations={tempLocations}
                                          onLocationClick={toggleLocation}
                                          readOnly={false}
                                      />
                                  </div>
                              </DraggableContainer>
                            </div>
                      </div>

                      {/* Sidebar List */}
                      <div className="w-full md:w-80 bg-white dark:bg-slate-900 border-l border-gray-200 dark:border-slate-800 flex flex-col">
                          <div className="p-4 border-b border-gray-200 dark:border-slate-800">
                              <h4 className="font-bold text-sm uppercase text-gray-500 dark:text-slate-400 mb-2">Ubicaciones Seleccionadas</h4>
                              <div className="text-xs text-gray-400 dark:text-slate-500">
                                  Total en stock: <span className="text-blue-600 dark:text-blue-400 font-bold">{selectedProductForLocation.stock}</span>
                              </div>
                          </div>
                          <div className="flex-1 overflow-y-auto p-4 space-y-3">
                              {Object.keys(tempLocations).length === 0 ? (
                                  <div className="text-center py-10 text-gray-400 dark:text-slate-500">
                                      <MapPin className="h-10 w-10 mx-auto mb-2 opacity-50" />
                                      <p className="text-sm">Selecciona zonas en el mapa para asignar stock.</p>
                                  </div>
                              ) : (
                                  Object.entries(tempLocations).map(([areaId, qty]) => (
                                      <div key={areaId} className="flex items-center gap-3 bg-gray-50 dark:bg-slate-800/50 p-3 rounded-lg border border-gray-100 dark:border-slate-700">
                                          <div className="size-8 bg-blue-100 dark:bg-blue-900/30 rounded-md flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold text-xs">
                                              {areaId.split('-')[1] || areaId}
                                          </div>
                                          <div className="flex-1">
                                              <div className="text-xs font-bold text-gray-700 dark:text-slate-300">Estante {areaId}</div>
                                          </div>
                                          <input 
                                              type="number" 
                                              min="0"
                                              value={qty}
                                              onChange={(e) => updateLocationQuantity(areaId, e.target.value)}
                                              className="w-16 p-1 text-center text-sm border border-gray-200 dark:border-slate-700 rounded bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                                          />
                                          <button onClick={() => toggleLocation(areaId)} className="text-gray-400 hover:text-red-500 dark:text-slate-500 dark:hover:text-red-400">
                                              <X className="h-4 w-4" />
                                          </button>
                                      </div>
                                  ))
                              )}
                          </div>
                          <div className="p-4 border-t border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-800/50">
                              <button 
                                  onClick={saveLocations}
                                  disabled={isSavingLocation}
                                  className="w-full py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex justify-center items-center gap-2"
                              >
                                  {isSavingLocation && <Loader2 className="h-4 w-4 animate-spin" />}
                                  Guardar Cambios
                              </button>
                          </div>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* History Modal */}
      {historyModalOpen && selectedProductForHistory && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
              <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
                  <div className="p-6 border-b border-gray-200 dark:border-slate-800 flex justify-between items-center">
                        <div>
                          <h3 className="font-bold text-xl text-gray-900 dark:text-white">Historial de Movimientos</h3>
                          <p className="text-sm text-gray-500 dark:text-slate-400">{selectedProductForHistory.name}</p>
                      </div>
                      <button onClick={() => setHistoryModalOpen(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full transition-colors text-gray-500 dark:text-slate-400">
                          <X className="h-6 w-6" />
                      </button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-6">
                      {historyLoading ? (
                          <div className="flex justify-center py-10">
                              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                          </div>
                      ) : productHistory.length === 0 ? (
                          <div className="text-center py-10 text-gray-400 dark:text-slate-500">
                              <History className="h-10 w-10 mx-auto mb-2 opacity-50" />
                              <p>No hay movimientos registrados.</p>
                          </div>
                      ) : (
                          <div className="space-y-4">
                              {productHistory.map(tx => (
                                  <div key={tx.id} className="flex items-start gap-4 p-4 bg-gray-50 dark:bg-slate-800/50 rounded-xl border border-gray-100 dark:border-slate-700">
                                      <div className={`p-2 rounded-lg ${tx.type === 'ENTRY' ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400' : tx.type === 'SALE' ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' : 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'}`}>
                                          {tx.type === 'ENTRY' ? <Plus className="h-5 w-5" /> : tx.type === 'SALE' ? <DollarSign className="h-5 w-5" /> : <RefreshCw className="h-5 w-5" />}
                                      </div>
                                      <div className="flex-1">
                                          <div className="flex justify-between items-start">
                                              <div>
                                                  <p className="font-bold text-gray-900 dark:text-white">
                                                      {tx.type === 'ENTRY' ? 'Ingreso de Stock' : tx.type === 'SALE' ? 'Venta Realizada' : 'Salida / Ajuste'}
                                                  </p>
                                                  <p className="text-xs text-gray-500 dark:text-slate-400">
                                                      {tx.date.toLocaleDateString()} - {tx.date.toLocaleTimeString()}
                                                  </p>
                                              </div>
                                              <span className={`font-mono font-bold ${tx.type === 'ENTRY' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                                  {tx.type === 'ENTRY' ? '+' : '-'}{tx.quantity}
                                              </span>
                                          </div>
                                          <div className="mt-2 text-xs text-gray-400 dark:text-slate-500 flex items-center gap-2">
                                              <span>{tx.userName} ({tx.userEmail})</span>
                                          </div>
                                          {tx.details && (
                                              <div className="mt-2 text-xs bg-white dark:bg-slate-800 p-2 rounded border border-gray-200 dark:border-slate-700 text-gray-500 dark:text-slate-400">
                                                  {JSON.stringify(tx.details)}
                                              </div>
                                          )}
                                      </div>
                                  </div>
                              ))}
                          </div>
                      )}
                  </div>
              </div>
          </div>
      )}
    </AppLayout>
  );
};

export default InventoryList;
