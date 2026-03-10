
-- Ensure pgcrypto is available in extensions schema
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- Update the function to include 'extensions' in search_path
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
SET search_path = public, auth, extensions -- Added extensions to path
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
    -- Now gen_salt and crypt should be found in extensions schema
    encrypted_pw := crypt(p_password, gen_salt('bf'));
    
    -- Insert into auth.users
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

    -- Update the profile with branch_id if provided
    -- The trigger on auth.users creates the profile, but we need to update extra fields
    IF p_branch_id IS NOT NULL THEN
        UPDATE public.profiles
        SET branch_id = p_branch_id
        WHERE id = new_user_id;
    END IF;
    
    -- Ensure profile role matches
    UPDATE public.profiles
    SET role = p_role
    WHERE id = new_user_id;

    RETURN new_user_id;
END;
$$;
