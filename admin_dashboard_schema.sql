-- SQL Schema for Budget Rent PH Admin Dashboard & Landlord App

-- 1. Create Properties Table
-- This table stores all the listings and landlord subscription/verification data
CREATE TABLE IF NOT EXISTS properties (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT,
    owner_name TEXT,
    
    -- Verification and Subscription
    is_verified BOOLEAN DEFAULT false,
    subscription_status TEXT DEFAULT 'Regular', -- e.g., 'Regular', 'Active', 'Expired'
    subscription_date TIMESTAMPTZ,
    subscription_expiry TIMESTAMPTZ,
    
    -- Analytics & Extra
    login_count INT DEFAULT 0,
    last_login TIMESTAMPTZ,
    
    -- Additional property details typically present
    title TEXT,
    description TEXT,
    price DECIMAL(10, 2),
    location TEXT,
    address TEXT,
    owner_avatar TEXT, -- Profile picture URL
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create Verification Requests Table
-- Handles requests from Landlords trying to get a verified badge/subscription
CREATE TABLE IF NOT EXISTS verification_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    property_name TEXT NOT NULL,
    status TEXT DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Note: 
-- 1. In Supabase, the user authentication is handled by the built-in `auth.users` table. 
-- 2. The admin dashboard queries the `properties` table to generate the unique list of landlords, count the total properties (listings), and manage their active subscriptions.
-- 3. It queries `verification_requests` to show pending approvals.
