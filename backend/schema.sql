-- ============================================
-- LearnLynk CRM Database Schema
-- ============================================

-- Drop tables if they exist (for clean testing)
DROP TABLE IF EXISTS tasks CASCADE;
DROP TABLE IF EXISTS applications CASCADE;
DROP TABLE IF EXISTS leads CASCADE;

-- ============================================
-- TABLE 1: leads
-- ============================================
CREATE TABLE leads (
    -- Required fields
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    
    -- Business fields
    owner_id UUID NOT NULL,
    stage VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(50),
    source VARCHAR(100)
);

-- ============================================
-- TABLE 2: applications
-- ============================================
CREATE TABLE applications (
    -- Required fields
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    
    -- Foreign key relationship
    lead_id UUID NOT NULL,
    
    -- Business fields
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    program VARCHAR(255),
    notes TEXT,
    
    -- Foreign key constraint
    CONSTRAINT fk_applications_lead
        FOREIGN KEY (lead_id) 
        REFERENCES leads(id) 
        ON DELETE CASCADE
);

-- ============================================
-- TABLE 3: tasks
-- ============================================
CREATE TABLE tasks (
    -- Required fields
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    
    -- Foreign key relationship (related_id points to applications)
    related_id UUID NOT NULL,
    
    -- Business fields
    type VARCHAR(20) NOT NULL,
    due_at TIMESTAMPTZ NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    title VARCHAR(255),
    description TEXT,
    
    -- Foreign key constraint
    CONSTRAINT fk_tasks_application
        FOREIGN KEY (related_id) 
        REFERENCES applications(id) 
        ON DELETE CASCADE,
    
    -- Check constraint: type must be call, email, or review
    CONSTRAINT chk_task_type 
        CHECK (type IN ('call', 'email', 'review')),
    
    -- Check constraint: due_at must be >= created_at
    CONSTRAINT chk_due_at_after_created 
        CHECK (due_at >= created_at)
);

-- ============================================
-- INDEXES for common queries
-- ============================================

-- Indexes for leads table
-- For fetching leads by owner
CREATE INDEX idx_leads_owner_id ON leads(owner_id);

-- For fetching leads by stage
CREATE INDEX idx_leads_stage ON leads(stage);

-- For fetching leads by created_at (sorting/filtering by date)
CREATE INDEX idx_leads_created_at ON leads(created_at);

-- For multi-tenant queries (tenant_id is always filtered)
CREATE INDEX idx_leads_tenant_id ON leads(tenant_id);

-- Composite index for common query patterns
CREATE INDEX idx_leads_tenant_owner ON leads(tenant_id, owner_id);

-- Indexes for applications table
-- For fetching applications by lead
CREATE INDEX idx_applications_lead_id ON applications(lead_id);

-- For multi-tenant queries
CREATE INDEX idx_applications_tenant_id ON applications(tenant_id);

-- For filtering by status
CREATE INDEX idx_applications_status ON applications(status);

-- Indexes for tasks table
-- For fetching tasks due today (most important query)
CREATE INDEX idx_tasks_due_at ON tasks(due_at);

-- For filtering by status (e.g., pending tasks)
CREATE INDEX idx_tasks_status ON tasks(status);

-- For multi-tenant queries
CREATE INDEX idx_tasks_tenant_id ON tasks(tenant_id);

-- For fetching tasks by application
CREATE INDEX idx_tasks_related_id ON tasks(related_id);

-- Composite index for "tasks due today that are pending"
CREATE INDEX idx_tasks_due_status ON tasks(due_at, status);

-- ============================================
-- TRIGGERS for automatic updated_at
-- ============================================

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to leads table
CREATE TRIGGER trigger_leads_updated_at
    BEFORE UPDATE ON leads
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Apply trigger to applications table
CREATE TRIGGER trigger_applications_updated_at
    BEFORE UPDATE ON applications
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Apply trigger to tasks table
CREATE TRIGGER trigger_tasks_updated_at
    BEFORE UPDATE ON tasks
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- SCHEMA COMPLETE
-- ============================================