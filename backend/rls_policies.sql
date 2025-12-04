-- ============================================
-- LearnLynk CRM - Row Level Security Policies
-- ============================================

-- ============================================
-- SUPPORTING TABLES
-- ============================================
-- These tables support the RLS policies
-- (In production, these would already exist)

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('admin', 'counselor')),
    email VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Teams table
CREATE TABLE IF NOT EXISTS teams (
    team_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- User-Teams junction table (many-to-many relationship)
CREATE TABLE IF NOT EXISTS user_teams (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    team_id UUID NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (user_id, team_id),
    CONSTRAINT fk_user_teams_team
        FOREIGN KEY (team_id) 
        REFERENCES teams(team_id) 
        ON DELETE CASCADE
);

-- Lead-Teams junction table (leads can be assigned to teams)
CREATE TABLE IF NOT EXISTS lead_teams (
    lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    team_id UUID NOT NULL,
    assigned_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (lead_id, team_id),
    CONSTRAINT fk_lead_teams_team
        FOREIGN KEY (team_id) 
        REFERENCES teams(team_id) 
        ON DELETE CASCADE
);

-- ============================================
-- ENABLE ROW LEVEL SECURITY
-- ============================================

ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

-- ============================================
-- DROP EXISTING POLICIES (for clean testing)
-- ============================================

DROP POLICY IF EXISTS "leads_select_policy" ON leads;
DROP POLICY IF EXISTS "leads_insert_policy" ON leads;

-- ============================================
-- SELECT POLICY
-- ============================================
-- Counselors can read leads that are:
--   1. Assigned to them (owner_id matches their user_id), OR
--   2. Assigned to a team they belong to
-- Admins can read ALL leads in their tenant

CREATE POLICY "leads_select_policy" 
ON leads
FOR SELECT
USING (
    -- Must belong to the same tenant
    tenant_id = (auth.jwt() ->> 'tenant_id')::UUID
    AND
    (
        -- ADMIN: Can see all leads in their tenant
        (auth.jwt() ->> 'role') = 'admin'
        
        OR
        
        -- COUNSELOR: Can see leads assigned to them
        (
            (auth.jwt() ->> 'role') = 'counselor'
            AND owner_id = (auth.jwt() ->> 'user_id')::UUID
        )
        
        OR
        
        -- COUNSELOR: Can see leads assigned to their teams
        (
            (auth.jwt() ->> 'role') = 'counselor'
            AND id IN (
                SELECT lt.lead_id
                FROM lead_teams lt
                INNER JOIN user_teams ut ON lt.team_id = ut.team_id
                WHERE ut.user_id = (auth.jwt() ->> 'user_id')::UUID
            )
        )
    )
);

-- ============================================
-- INSERT POLICY
-- ============================================
-- Both counselors and admins can create leads
-- But only under their own tenant

CREATE POLICY "leads_insert_policy" 
ON leads
FOR INSERT
WITH CHECK (
    -- Must belong to the same tenant as the user
    tenant_id = (auth.jwt() ->> 'tenant_id')::UUID
    AND
    -- User must be either admin or counselor
    (auth.jwt() ->> 'role') IN ('admin', 'counselor')
);

-- ============================================
-- OPTIONAL: UPDATE POLICY
-- ============================================
-- Counselors can only update leads they own or are in their teams
-- Admins can update any lead in their tenant

CREATE POLICY "leads_update_policy" 
ON leads
FOR UPDATE
USING (
    -- Must belong to the same tenant
    tenant_id = (auth.jwt() ->> 'tenant_id')::UUID
    AND
    (
        -- ADMIN: Can update all leads in their tenant
        (auth.jwt() ->> 'role') = 'admin'
        
        OR
        
        -- COUNSELOR: Can only update leads they own
        (
            (auth.jwt() ->> 'role') = 'counselor'
            AND owner_id = (auth.jwt() ->> 'user_id')::UUID
        )
        
        OR
        
        -- COUNSELOR: Can update leads in their teams
        (
            (auth.jwt() ->> 'role') = 'counselor'
            AND id IN (
                SELECT lt.lead_id
                FROM lead_teams lt
                INNER JOIN user_teams ut ON lt.team_id = ut.team_id
                WHERE ut.user_id = (auth.jwt() ->> 'user_id')::UUID
            )
        )
    )
);

-- ============================================
-- OPTIONAL: DELETE POLICY
-- ============================================
-- Only admins can delete leads

CREATE POLICY "leads_delete_policy" 
ON leads
FOR DELETE
USING (
    tenant_id = (auth.jwt() ->> 'tenant_id')::UUID
    AND
    (auth.jwt() ->> 'role') = 'admin'
);

-- ============================================
-- INDEXES FOR RLS PERFORMANCE
-- ============================================
-- These indexes help speed up RLS policy checks

CREATE INDEX IF NOT EXISTS idx_user_teams_user_id ON user_teams(user_id);
CREATE INDEX IF NOT EXISTS idx_user_teams_team_id ON user_teams(team_id);
CREATE INDEX IF NOT EXISTS idx_lead_teams_lead_id ON lead_teams(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_teams_team_id ON lead_teams(team_id);

-- ============================================
-- RLS POLICIES COMPLETE
-- ============================================

-- To verify RLS is enabled, run:
-- SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' AND tablename = 'leads';