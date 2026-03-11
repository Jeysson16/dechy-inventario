import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../config/supabaseClient';

const AuthContext = createContext({});

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null); // Supabase profile
  const [authLoading, setAuthLoading] = useState(true);
  const [currentBranch, setCurrentBranch] = useState(() => {
    const saved = localStorage.getItem('inventory_current_branch');
    return saved ? JSON.parse(saved) : null;
  });

  useEffect(() => {
    let profileSubscription = null;

    const fetchProfile = async (userId) => {
      try {
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .single();

        if (error) {
          console.error('Error fetching profile:', error);
          setUserProfile(null);
          return;
        }

        setUserProfile(profile);

        // Auto-assign branch for non-admins
        if (profile.role !== 'admin' && profile.branch_id) {
            // Fetch branch name if needed, or store it in profile view
            const { data: branch } = await supabase.from('branches').select('name').eq('id', profile.branch_id).single();
            const branchName = branch ? branch.name : 'Sucursal';
            
            const autoB = { id: profile.branch_id, name: branchName };
            setCurrentBranch(autoB);
            localStorage.setItem('inventory_current_branch', JSON.stringify(autoB));
        } else if (profile.role === 'admin' && profile.branch_id) {
             // If admin has a specific branch assigned, also auto-set it for convenience.
             const { data: branch } = await supabase.from('branches').select('name').eq('id', profile.branch_id).single();
             if (branch) {
                const branchName = branch.name;
                const autoB = { id: profile.branch_id, name: branchName };
                setCurrentBranch(autoB);
                localStorage.setItem('inventory_current_branch', JSON.stringify(autoB));
             }
        }
      } catch (err) {
        console.error('Unexpected error fetching profile:', err);
      }
    };

    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      const user = session?.user ?? null;
      setCurrentUser(user);

      if (user) {
        await fetchProfile(user.id);
        
        // Subscribe to profile changes
        profileSubscription = supabase
          .channel('public:profiles')
          .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${user.id}` }, payload => {
            setUserProfile(payload.new);
          })
          .subscribe();

      } else {
        setUserProfile(null);
        setCurrentBranch(null);
        if (profileSubscription) supabase.removeChannel(profileSubscription);
      }
      setAuthLoading(false);
    });

    return () => {
      authListener.subscription.unsubscribe();
      if (profileSubscription) supabase.removeChannel(profileSubscription);
    };
  }, []);

  const login = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    
    // Explicitly fetch profile immediately to ensure role is ready
    if (data.user) {
        // First try to get profile
        let { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', data.user.id)
          .single();
          
        // If profile not found, maybe create it? (Fallback for legacy users or errors)
        if (profileError && profileError.code === 'PGRST116') {
             console.log("Profile not found, creating one...");
             // Insert default profile
             const { data: newProfile, error: createError } = await supabase
                .from('profiles')
                .insert({
                    id: data.user.id,
                    email: email,
                    full_name: email.split('@')[0],
                    // Role defaults to 'customer' via database default
                })
                .select()
                .single();
             
             if (!createError) profile = newProfile;
        }

        if (profile) {
            setUserProfile(profile);
            
            // Auto-assign branch if present
            if (profile.branch_id) {
                const { data: branch } = await supabase.from('branches').select('name').eq('id', profile.branch_id).single();
                if (branch) {
                    const autoB = { id: profile.branch_id, name: branch.name };
                    setCurrentBranch(autoB);
                    localStorage.setItem('inventory_current_branch', JSON.stringify(autoB));
                }
            } 
        }
    }

    return { data, error };
  };

  const register = async (email, password, fullName, avatarFile = null) => {
    // 1. Sign Up
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
      },
    });
    
    if (error) throw error;
    
    // 2. Upload Avatar if provided
    if (avatarFile && data.user) {
        const fileExt = avatarFile.name.split('.').pop();
        const fileName = `${data.user.id}/avatar.${fileExt}`;
        const { error: uploadError } = await supabase.storage
            .from('avatars')
            .upload(fileName, avatarFile);
            
        if (!uploadError) {
            const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(fileName);
            // Update profile with avatar_url
            await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', data.user.id);
        }
    }
    
    return data;
  };

  const logout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    setCurrentBranch(null);
    setUserProfile(null);
    localStorage.removeItem('inventory_current_branch');
  };

  const selectBranch = (branch) => {
    // Only admins can manually switch branches
    // if (userProfile && userProfile.role !== 'admin') return; // REMOVED: Allow anyone who can see the branch to select it
    setCurrentBranch(branch);
    localStorage.setItem('inventory_current_branch', JSON.stringify(branch));
  };

  // Derived helpers
  const isAdmin = userProfile?.role === 'admin';
  const userRole = userProfile?.role || 'customer'; // Default role
  const displayName = userProfile?.full_name || currentUser?.email?.split('@')[0] || 'Usuario';
  const avatarUrl = userProfile?.avatar_url;

  const value = {
    currentUser,
    userProfile,
    userRole,
    isAdmin,
    displayName,
    avatarUrl,
    currentBranch,
    authLoading,
    login,
    register,
    logout,
    selectBranch,
  };

  return (
    <AuthContext.Provider value={value}>
      {!authLoading ? children : <div className="h-screen w-full flex items-center justify-center">Cargando...</div>}
    </AuthContext.Provider>
  );
};
