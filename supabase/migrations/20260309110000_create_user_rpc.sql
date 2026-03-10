
-- Enable pgcrypto for password hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Function to create a new user (admin only)
CREATE OR REPLACE FUNCTION public.create_user_by_admin(
    p_email TEXT,
    p_password TEXT,
    p_full_name TEXT,
    p_role TEXT,
    p_branch_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth -- Secure search path
AS $$
DECLARE
    new_user_id UUID;
    encrypted_pw TEXT;
BEGIN
    -- Check if requestor is admin
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN
        RAISE EXCEPTION 'Access denied. Only admins can create users.';
    END IF;
    
    -- Generate UUID
    new_user_id := gen_random_uuid();
    
    -- Encrypt password (using bcrypt)
    encrypted_pw := crypt(p_password, gen_salt('bf'));
    
    -- Insert into auth.users
    -- We use a safe insert that mimics Supabase's internal logic
    INSERT INTO auth.users (
        instance_id,
        id,
        aud,
        role,
        email,
        encrypted_password,
        email_confirmed_at,
        raw_app_meta_data,
        raw_user_meta_data,
        created_at,
        updated_at,
        is_super_admin,
        is_sso_user
    ) VALUES (
        '00000000-0000-0000-0000-000000000000',
        new_user_id,
        'authenticated',
        'authenticated',
        p_email,
        encrypted_pw,
        NOW(), -- Auto confirm
        '{"provider": "email", "providers": ["email"]}'::jsonb,
        jsonb_build_object('full_name', p_full_name, 'role', p_role),
        NOW(),
        NOW(),
        FALSE,
        FALSE
    );

    -- The trigger 'on_auth_user_created' on auth.users should fire and create the profile.
    -- However, it doesn't set branch_id. We update it here.
    
    -- Update the profile with branch_id if provided
    IF p_branch_id IS NOT NULL THEN
        UPDATE public.profiles
        SET branch_id = p_branch_id
        WHERE id = new_user_id;
    END IF;
    
    -- Ensure profile role matches if trigger didn't set it correctly (though it should)
    UPDATE public.profiles
    SET role = p_role
    WHERE id = new_user_id;

    RETURN new_user_id;
END;
$$;
