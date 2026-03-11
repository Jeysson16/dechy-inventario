import { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import AppLayout from '../components/layout/AppLayout';
import { supabase } from '../config/supabaseClient';

const ROLE_CONFIG = {
  admin: { label: 'Administrador', color: 'bg-violet-100 text-violet-700 border-violet-200' },
  manager: { label: 'Gerente', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  employee: { label: 'Empleado', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
};

const defaultFormData = {
  name: '',
  email: '',
  password: '',
  role: 'employee',
  branchId: '',
  branchName: '',
  status: 'Activo',
};

const EmployeeManager = () => {
  const [employees, setEmployees] = useState([]);
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [formData, setFormData] = useState(defaultFormData);
  const [showPassword, setShowPassword] = useState(false);

  // Delete Confirmation State
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [employeeToDelete, setEmployeeToDelete] = useState(null);

  const fetchEmployees = async () => {
    try {
      setLoading(true);
      // Fetch current user to know filtering context
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      const { data: currentUserProfile } = await supabase.from('profiles').select('*').eq('id', user.id).single();

      let query = supabase
        .from('profiles')
        .select('*, branches!profiles_branch_id_fkey(name)') 
        .order('full_name', { ascending: true });

      // If user is manager/admin, filter by their company
      // REMOVED company_id filtering as user requested to remove company logic
      // if (currentUserProfile?.company_id) {
      //    query = query.eq('company_id', currentUserProfile.company_id);
      // }
      
      const { data, error } = await query;

      if (error) throw error;

      const formatted = data.map(p => ({
        id: p.id,
        name: p.full_name,
        email: p.email,
        role: p.role,
        branchId: p.branch_id,
        branchName: p.branches?.name || '',
        status: p.status || 'Activo',
        avatarUrl: p.avatar_url
      }));
      setEmployees(formatted);
    } catch (error) {
      console.error('Error fetching employees:', error);
      toast.error('Error al cargar empleados');
    } finally {
      setLoading(false);
    }
  };

  const fetchBranches = async () => {
    try {
      let query = supabase.from('branches').select('*');
      
      // Filter by company if current user is tied to one
      // REMOVED company filtering
      /* if (user) {
          const { data: profile } = await supabase.from('profiles').select('company_id').eq('id', user.id).single();
          if (profile?.company_id) {
              query = query.eq('company_id', profile.company_id);
          }
      } */

      const { data, error } = await query;
      if (error) throw error;
      if (data) setBranches(data);
    } catch (err) {
      console.error('Error fetching branches for manager:', err);
    }
  };

  useEffect(() => {
    fetchEmployees();
    fetchBranches();
  }, []);

  const openAddModal = () => {
    setEditingEmployee(null);
    setFormData(defaultFormData);
    setShowPassword(false);
    setIsModalOpen(true);
  };

  const openEditModal = (emp) => {
    setEditingEmployee(emp);
    setFormData({
      name: emp.name || '',
      email: emp.email || '',
      password: '', // Password usually not editable directly here for security or needs special flow
      role: emp.role || 'employee',
      branchId: emp.branchId || '',
      branchName: emp.branchName || '',
      status: emp.status || 'Activo',
    });
    setShowPassword(false);
    setIsModalOpen(true);
  };

  const handleBranchChange = (branchId) => {
    const branch = branches.find(b => b.id === branchId);
    setFormData(f => ({
      ...f,
      branchId: branchId,
      branchName: branch?.name || '',
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (saving) return; // Prevent double submission
    
    setSaving(true);
    try {
      if (editingEmployee) {
        // Update Profile
        const { error } = await supabase
          .from('profiles')
          .update({
            full_name: formData.name,
            role: formData.role,
            branch_id: formData.branchId || null,
            status: formData.status
          })
          .eq('id', editingEmployee.id);

        if (error) throw error;
        toast.success('Empleado actualizado correctamente.');
        await fetchEmployees(); // Refresh list
        setIsModalOpen(false); // Close modal only on success
      } else {
        // Create User via RPC
        // Ensure NO p_status is passed, and we handle potential RPC errors
        const { data, error } = await supabase.rpc('create_user_by_admin', {
          p_email: formData.email,
          p_password: formData.password,
          p_full_name: formData.name,
          p_role: formData.role,
          p_branch_id: formData.branchId || null
        });

        if (error) {
          console.error('RPC Error:', error);
          throw new Error(error.message || 'Error desconocido al crear usuario');
        }
        
        console.log('User created:', data);
        toast.success('Empleado creado correctamente.');
        await fetchEmployees(); 
        setIsModalOpen(false);
      }
    } catch (error) {
      console.error('Error saving employee:', error);
      toast.error('Error al guardar el empleado: ' + error.message);
      // Do NOT close modal on error, so user can fix inputs
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (emp) => {
    const newStatus = emp.status === 'Activo' ? 'Inactivo' : 'Activo';
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ status: newStatus })
        .eq('id', emp.id);

      if (error) throw error;
      toast.success(`Empleado ${newStatus === 'Activo' ? 'activado' : 'desactivado'}.`);
      setEmployees(prev => prev.map(e => e.id === emp.id ? { ...e, status: newStatus } : e));
    } catch (error) {
      console.error('Error toggling status:', error);
      toast.error('Error al cambiar el estado.');
    }
  };

  const handleDelete = (emp) => {
    setEmployeeToDelete(emp);
    setDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!employeeToDelete) return;
    try {
      // Deleting profile might not delete Auth user without a Trigger/Function.
      // But RLS usually handles profile.
      const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('id', employeeToDelete.id);

      if (error) throw error;
      
      toast.success('Empleado eliminado del sistema.');
      setDeleteModalOpen(false);
      setEmployeeToDelete(null);
      fetchEmployees();
    } catch (error) {
      console.error('Error deleting employee:', error);
      toast.error('Error al eliminar el empleado.');
    }
  };

  const filtered = employees.filter(emp => {
    const matchSearch = !searchTerm ||
      emp.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.branchName?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchRole = roleFilter === 'all' || emp.role === roleFilter;
    return matchSearch && matchRole;
  });

  const stats = {
    total: employees.length,
    active: employees.filter(e => e.status === 'Activo').length,
    admins: employees.filter(e => e.role === 'admin').length,
    managers: employees.filter(e => e.role === 'manager').length,
    employees_count: employees.filter(e => e.role === 'employee').length,
  };


  return (
    <AppLayout>
      <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950">
        {/* Header */}
        <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 lg:px-10 py-6 shrink-0">
          <div className="max-w-screen-xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Gestión de Empleados</h1>
              <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Administre usuarios, roles y accesos del sistema.</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative hidden sm:block">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xl">search</span>
                <input
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-64 pl-10 pr-4 py-2.5 border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-900 focus:ring-2 focus:ring-primary outline-none transition-all text-sm"
                  placeholder="Buscar por nombre, email..."
                />
              </div>
              <select
                value={roleFilter}
                onChange={e => setRoleFilter(e.target.value)}
                className="py-2.5 px-3 border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-900 focus:ring-2 focus:ring-primary outline-none transition-all text-sm font-medium text-slate-600 dark:text-slate-300"
              >
                <option value="all">Todos los roles</option>
                <option value="admin">Administrador</option>
                <option value="manager">Gerente</option>
                <option value="employee">Empleado</option>
              </select>
              <button
                onClick={openAddModal}
                className="inline-flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-lg font-semibold hover:bg-primary/90 transition-colors shadow-sm shadow-primary/25 whitespace-nowrap"
              >
                <span className="material-symbols-outlined text-lg">person_add</span>
                <span className="hidden sm:inline">Nuevo Empleado</span>
                <span className="sm:hidden">Nuevo</span>
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 lg:px-10 py-8">
          <div className="max-w-screen-xl mx-auto">
            {/* Stats Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
              {[
                { label: 'Total', value: stats.total, icon: 'group', color: 'text-slate-900 dark:text-white', bg: 'bg-slate-100 dark:bg-slate-800' },
                { label: 'Activos', value: stats.active, icon: 'check_circle', color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-100 dark:bg-emerald-900/30' },
                { label: 'Gerentes', value: stats.managers, icon: 'manage_accounts', color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-100 dark:bg-blue-900/30' },
                { label: 'Empleados', value: stats.employees_count, icon: 'badge', color: 'text-violet-600 dark:text-violet-400', bg: 'bg-violet-100 dark:bg-violet-900/30' },
              ].map(stat => (
                <div key={stat.label} className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 flex items-center gap-3 shadow-sm">
                  <div className={`${stat.bg} p-2.5 rounded-lg`}>
                    <span className={`material-symbols-outlined ${stat.color}`}>{stat.icon}</span>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-slate-900 dark:text-white">{stat.value}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">{stat.label}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Table */}
            {loading ? (
              <div className="flex justify-center py-20">
                <span className="material-symbols-outlined animate-spin text-4xl text-primary">progress_activity</span>
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-20 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                <span className="material-symbols-outlined text-5xl text-slate-300 mb-3 block">group_off</span>
                <p className="text-slate-500 dark:text-slate-400 font-medium">
                  {employees.length === 0 ? 'No hay empleados registrados.' : 'No se encontraron coincidencias.'}
                </p>
                {employees.length === 0 && (
                  <button onClick={openAddModal} className="mt-4 inline-flex items-center gap-2 text-primary font-semibold text-sm hover:underline">
                    <span className="material-symbols-outlined text-sm">person_add</span> Crear primer empleado
                  </button>
                )}
              </div>
            ) : (
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                {/* Desktop Table */}
                <table className="w-full hidden md:table">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                      <th className="text-left py-3.5 px-6 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Empleado</th>
                      <th className="text-left py-3.5 px-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Rol</th>
                      <th className="text-left py-3.5 px-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Sucursal</th>
                      <th className="text-left py-3.5 px-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Estado</th>
                      <th className="text-right py-3.5 px-6 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filtered.map(emp => {
                      const role = ROLE_CONFIG[emp.role] || ROLE_CONFIG.employee;
                      const isActive = emp.status === 'Activo';
                      const initials = (emp.name || 'U').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
                      return (
                        <tr key={emp.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                          <td className="py-4 px-6">
                            <div className="flex items-center gap-3">
                              <div className="size-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm flex-shrink-0">
                                {initials}
                              </div>
                              <div>
                                <p className="font-semibold text-slate-900 dark:text-white text-sm">{emp.name}</p>
                                <p className="text-xs text-slate-400">{emp.email}</p>
                              </div>
                            </div>
                          </td>
                          <td className="py-4 px-4">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border ${role.color}`}>
                              {role.label}
                            </span>
                          </td>
                          <td className="py-4 px-4">
                            <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300 text-sm">
                              {emp.branchName ? (
                                <>
                                  <span className="material-symbols-outlined text-[16px] text-slate-400">store</span>
                                  <span>{emp.branchName}</span>
                                </>
                              ) : (
                                <span className="text-slate-300 italic text-xs">Sin asignar</span>
                              )}
                            </div>
                          </td>
                          <td className="py-4 px-4">
                            <button
                              onClick={() => handleToggleStatus(emp)}
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border transition-all hover:scale-105 ${
                                isActive
                                  ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/30'
                                  : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700'
                              }`}
                              title={isActive ? 'Clic para desactivar' : 'Clic para activar'}
                            >
                              <span className="material-symbols-outlined text-[14px]">{isActive ? 'check_circle' : 'cancel'}</span>
                              {isActive ? 'Activo' : 'Inactivo'}
                            </button>
                          </td>
                          <td className="py-4 px-6">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => openEditModal(emp)}
                                className="p-1.5 text-slate-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-all"
                                title="Editar"
                              >
                                <span className="material-symbols-outlined text-[18px]">edit</span>
                              </button>
                              <button
                                onClick={() => handleDelete(emp)}
                                className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-all"
                                title="Eliminar"
                              >
                                <span className="material-symbols-outlined text-[18px]">delete</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {/* Mobile Cards */}
                <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800">
                  {filtered.map(emp => {
                    const role = ROLE_CONFIG[emp.role] || ROLE_CONFIG.employee;
                    const isActive = emp.status === 'Activo';
                    const initials = (emp.name || 'U').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
                    return (
                      <div key={emp.id} className="p-4 flex flex-col gap-3">
                        <div className="flex items-center gap-3">
                          <div className="size-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                            {initials}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-slate-900 dark:text-white truncate">{emp.name}</p>
                            <p className="text-xs text-slate-400 truncate">{emp.email}</p>
                          </div>
                          <div className="flex items-center gap-1">
                            <button onClick={() => openEditModal(emp)} className="p-1.5 text-slate-400 hover:text-primary rounded-lg transition-all">
                              <span className="material-symbols-outlined text-[18px]">edit</span>
                            </button>
                            <button onClick={() => handleDelete(emp)} className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg transition-all">
                              <span className="material-symbols-outlined text-[18px]">delete</span>
                            </button>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${role.color}`}>{role.label}</span>
                          <button
                            onClick={() => handleToggleStatus(emp)}
                            className={`px-2.5 py-1 rounded-full text-xs font-bold border ${isActive ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700'}`}
                          >
                            {isActive ? 'Activo' : 'Inactivo'}
                          </button>
                          {emp.branchName && (
                            <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                              <span className="material-symbols-outlined text-[14px]">store</span> {emp.branchName}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Add/Edit Modal */}
        {isModalOpen && (
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn"
            onClick={() => setIsModalOpen(false)}
          >
            <div
              className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200 dark:border-slate-800 animate-slideUp"
              onClick={e => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="flex justify-between items-center p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                <h3 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">
                    {editingEmployee ? 'manage_accounts' : 'person_add'}
                  </span>
                  {editingEmployee ? 'Editar Empleado' : 'Nuevo Empleado'}
                </h3>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors p-1 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700"
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>

              {/* Modal Form */}
              <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[calc(100vh-200px)] overflow-y-auto">

                {/* Name */}
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Nombre completo</label>
                  <input
                    required
                    type="text"
                    value={formData.name}
                    onChange={e => setFormData(f => ({ ...f, name: e.target.value }))}
                    className="w-full p-3 rounded-lg border border-slate-200 dark:border-slate-700 dark:bg-slate-800 focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
                    placeholder="Ej. Juan Pérez"
                  />
                </div>

                {/* Email — only editable on create */}
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Correo electrónico {editingEmployee && <span className="text-slate-400 font-normal">(no editable)</span>}
                  </label>
                  <input
                    required
                    type="email"
                    value={formData.email}
                    onChange={e => setFormData(f => ({ ...f, email: e.target.value }))}
                    disabled={!!editingEmployee}
                    className="w-full p-3 rounded-lg border border-slate-200 dark:border-slate-700 dark:bg-slate-800 focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all disabled:bg-slate-50 dark:disabled:bg-slate-800/50 disabled:text-slate-400 disabled:cursor-not-allowed"
                    placeholder="correo@ejemplo.com"
                  />
                </div>

                {/* Password — only on create */}
                {!editingEmployee && (
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Contraseña temporal</label>
                    <div className="relative">
                      <input
                        required
                        type={showPassword ? 'text' : 'password'}
                        value={formData.password}
                        onChange={e => setFormData(f => ({ ...f, password: e.target.value }))}
                        className="w-full p-3 pr-12 rounded-lg border border-slate-200 dark:border-slate-700 dark:bg-slate-800 focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
                        placeholder="Mínimo 6 caracteres"
                        minLength={6}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(v => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                      >
                        <span className="material-symbols-outlined text-xl">
                          {showPassword ? 'visibility_off' : 'visibility'}
                        </span>
                      </button>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">El empleado podrá cambiarla después de ingresar.</p>
                  </div>
                )}

                {/* Role */}
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Rol del sistema</label>
                  <select
                    value={formData.role}
                    onChange={e => setFormData(f => ({ ...f, role: e.target.value }))}
                    className="w-full p-3 rounded-lg border border-slate-200 dark:border-slate-700 dark:bg-slate-800 focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all bg-white dark:bg-slate-900"
                  >
                    <option value="employee">Empleado — Inventario de su sucursal</option>
                    <option value="manager">Gerente — Inventario, reportes y sucursal asignada</option>
                    <option value="admin">Administrador — Acceso total al sistema</option>
                  </select>
                  <div className="mt-2 flex items-start gap-2 bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3 border border-slate-100 dark:border-slate-800">
                    <span className="material-symbols-outlined text-slate-400 text-[16px] mt-0.5">info</span>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {formData.role === 'admin' && 'Acceso completo: sucursales, empleados, inventario global y reportes.'}
                      {formData.role === 'manager' && 'Acceso a inventario, reportes y sucursal asignada. No puede gestionar empleados.'}
                      {formData.role === 'employee' && 'Solo puede ver y registrar movimientos de inventario en su sucursal.'}
                    </p>
                  </div>
                </div>

                {/* Branch — shown for non-admin roles */}
                {/* Fix: Admins can also be assigned to a branch (Branch Admin), so allow it for them too if needed */}
                {/* But typically "Global Admin" has no branch. Let's make it optional for admin. */}
                <div>
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Sucursal asignada {formData.role === 'admin' && <span className="text-slate-400 font-normal">(Opcional para Admin Global)</span>}
                    </label>
                    <select
                      required={formData.role !== 'admin'}
                      value={formData.branchId}
                      onChange={e => handleBranchChange(e.target.value)}
                      className="w-full p-3 rounded-lg border border-slate-200 dark:border-slate-700 dark:bg-slate-800 focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all bg-white dark:bg-slate-900"
                    >
                      <option value="">{formData.role === 'admin' ? 'Sin asignar (Admin Global)' : 'Seleccionar sucursal...'}</option>
                      {branches.map(b => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                    </select>
                    {branches.length === 0 && (
                      <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                        <span className="material-symbols-outlined text-xs">warning</span>
                        No hay sucursales registradas. Crea una primero.
                      </p>
                    )}
                </div>

                {/* Status */}
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Estado</label>
                  <div className="flex gap-3">
                    {['Activo', 'Inactivo'].map(s => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setFormData(f => ({ ...f, status: s }))}
                        className={`flex-1 py-3 rounded-lg font-semibold text-sm border-2 transition-all ${
                          formData.status === s
                            ? s === 'Activo'
                              ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400'
                              : 'border-slate-400 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                            : 'border-slate-200 dark:border-slate-700 text-slate-400 hover:border-slate-300 dark:hover:border-slate-600'
                        }`}
                      >
                        {s === 'Activo' ? '✓ Activo' : '✕ Inactivo'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-5 py-2.5 text-slate-600 dark:text-slate-400 font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-6 py-2.5 bg-primary text-white font-bold rounded-lg hover:bg-primary/90 transition-colors shadow-md flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {saving ? (
                      <span className="material-symbols-outlined animate-spin text-sm">progress_activity</span>
                    ) : (
                      <span className="material-symbols-outlined text-sm">save</span>
                    )}
                    {saving ? 'Guardando...' : editingEmployee ? 'Guardar Cambios' : 'Crear Empleado'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {deleteModalOpen && employeeToDelete && (
          <div
            className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn"
            onClick={() => setDeleteModalOpen(false)}
          >
            <div
              className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 dark:border-slate-800 animate-scaleUp"
              onClick={e => e.stopPropagation()}
            >
              <div className="p-6 text-center">
                <div className="size-16 bg-rose-100 dark:bg-rose-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="material-symbols-outlined text-3xl text-rose-600 dark:text-rose-400">warning</span>
                </div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">¿Eliminar empleado?</h3>
                <p className="text-slate-600 dark:text-slate-400 mb-6">
                  Estás a punto de eliminar a <span className="font-bold text-slate-900 dark:text-white">"{employeeToDelete.name}"</span>. 
                  Esta acción no se puede deshacer.
                </p>
                
                <div className="flex gap-3 justify-center">
                  <button
                    onClick={() => setDeleteModalOpen(false)}
                    className="px-5 py-2.5 text-slate-600 dark:text-slate-400 font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={confirmDelete}
                    className="px-6 py-2.5 bg-rose-600 text-white font-bold rounded-xl hover:bg-rose-700 transition-colors shadow-lg shadow-rose-600/20 flex items-center gap-2"
                  >
                    <span className="material-symbols-outlined text-sm">delete</span>
                    Eliminar
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default EmployeeManager;
