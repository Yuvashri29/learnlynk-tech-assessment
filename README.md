# LearnLynk Tech Assessment

Technical assessment for the LearnLynk internship position. This project implements a basic admissions CRM MVP with database schema, security policies, backend functions, and a frontend dashboard.

## 📋 Project Overview

This assessment demonstrates:
- PostgreSQL database design with proper relationships and constraints
- Row Level Security (RLS) policies for multi-tenant data access
- Supabase Edge Function for task creation with validation
- Next.js frontend dashboard for displaying and managing tasks
- Understanding of Stripe payment integration

## 🗂️ Project Structure
```
learnlynk-tech-assessment/
├── backend/
│   ├── schema.sql                    # Database tables, constraints, and indexes
│   ├── rls_policies.sql              # Row Level Security policies for leads table
│   └── edge-functions/
│       └── create-task/
│           └── index.ts              # Edge Function for creating tasks
├── frontend/
│   └── pages/
│       └── dashboard/
│           └── today.tsx             # Dashboard page showing today's tasks
└── README.md                         # This file
```

## 🚀 Setup Instructions

### Prerequisites

- Supabase account (free tier works)
- Node.js 18+ (for local testing, optional)
- Git

### Database Setup

1. **Create a Supabase Project**
   - Go to https://supabase.com
   - Create a new project
   - Wait for provisioning (~2 minutes)

2. **Run Schema**
   - Go to SQL Editor in Supabase Dashboard
   - Copy contents of `backend/schema.sql`
   - Run the query
   - Verify tables created: `leads`, `applications`, `tasks`

3. **Apply RLS Policies**
   - In SQL Editor, create a new query
   - Copy contents of `backend/rls_policies.sql`
   - Run the query
   - Verify RLS is enabled on `leads` table

### Edge Function Deployment

**Via Supabase Dashboard (Recommended)**
- Go to Edge Functions section
- Click "Create a new function"
- Name: `create-task`
- Paste contents of `backend/edge-functions/create-task/index.ts`
- Click Deploy

**Via CLI (Alternative)**
```bash
# Install Supabase CLI
npm install -g supabase

# Login
supabase login

# Link project
supabase link --project-ref YOUR_PROJECT_REF

# Deploy function
supabase functions deploy create-task
```

### Frontend Setup

The frontend is a Next.js page component that requires a Next.js environment.

1. **Environment Variables**
   
   Create a `.env.local` file in your Next.js project:
```env
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

2. **Integration**
   - Copy `frontend/pages/dashboard/today.tsx` to your Next.js project
   - Install required dependencies:
```bash
     npm install @supabase/supabase-js react
```

3. **Run Development Server**
```bash
   npm run dev
```
   
   Visit: `http://localhost:3000/dashboard/today`

## 🧪 Testing the Edge Function

### Create Test Data

Run this in Supabase SQL Editor:
```sql
-- Insert test lead
INSERT INTO leads (id, tenant_id, owner_id, stage, name, email)
VALUES (
  'aaaaaaaa-bbbb-cccc-dddd-111111111111',
  '11111111-2222-3333-4444-555555555555',
  '66666666-7777-8888-9999-000000000000',
  'new',
  'John Smith',
  'john@example.com'
);

-- Insert test application
INSERT INTO applications (id, tenant_id, lead_id, status, program)
VALUES (
  'bbbbbbbb-cccc-dddd-eeee-222222222222',
  '11111111-2222-3333-4444-555555555555',
  'aaaaaaaa-bbbb-cccc-dddd-111111111111',
  'pending',
  'Computer Science'
);
```

### Test with cURL
```bash
curl -X POST https://YOUR_PROJECT_REF.supabase.co/functions/v1/create-task \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "application_id": "bbbbbbbb-cccc-dddd-eeee-222222222222",
    "task_type": "call",
    "due_at": "2025-12-15T10:00:00Z"
  }'
```

### Expected Responses

**Success (200):**
```json
{
  "success": true,
  "task_id": "generated-uuid-here"
}
```

**Validation Error (400):**
```json
{
  "success": false,
  "error": "Invalid task_type",
  "details": "task_type must be one of: call, email, review"
}
```

**Application Not Found (400):**
```json
{
  "success": false,
  "error": "Application not found",
  "details": "No application found with id: ..."
}
```

## 📊 Database Schema

### Core Tables

**leads**
- Primary table for potential students
- Fields: `id`, `tenant_id`, `owner_id`, `stage`, `name`, `email`, `phone`, `source`, `created_at`, `updated_at`
- Indexes: `tenant_id`, `owner_id`, `stage`, `created_at`
- Auto-updating `updated_at` via trigger

**applications**
- Links leads to specific programs
- Fields: `id`, `tenant_id`, `lead_id` (FK), `status`, `program`, `notes`, `created_at`, `updated_at`
- Foreign Key: `lead_id` → `leads(id)` ON DELETE CASCADE
- Indexes: `tenant_id`, `lead_id`, `status`

**tasks**
- Action items for counselors
- Fields: `id`, `tenant_id`, `related_id` (FK), `type`, `due_at`, `status`, `title`, `description`, `created_at`, `updated_at`
- Foreign Key: `related_id` → `applications(id)` ON DELETE CASCADE
- Constraints: 
  - `type` IN ('call', 'email', 'review')
  - `due_at` >= `created_at`
- Indexes: `tenant_id`, `due_at`, `status`, `related_id`

### Supporting Tables (for RLS)

**users**
- Fields: `id`, `tenant_id`, `role`, `email`, `name`
- Role: 'admin' or 'counselor'

**teams**
- Fields: `team_id`, `tenant_id`, `name`

**user_teams**
- Junction table: `user_id`, `team_id`

**lead_teams**
- Junction table: `lead_id`, `team_id`

### Database Features

✅ Foreign key relationships with CASCADE delete  
✅ CHECK constraints for data validation  
✅ Strategic indexes for query performance  
✅ Auto-updating `updated_at` timestamps via triggers  
✅ UUID primary keys for scalability  

## 🔒 Security (RLS Policies)

### Access Control Rules

**SELECT Policy:**
- **Counselors** can see:
  - Leads they own (`owner_id` = their `user_id`)
  - Leads assigned to teams they belong to
- **Admins** can see all leads in their tenant

**INSERT Policy:**
- Both counselors and admins can create leads under their tenant
- Must match user's `tenant_id`

**UPDATE Policy:**
- Counselors can update leads they own or leads in their teams
- Admins can update all leads in their tenant

**DELETE Policy:**
- Only admins can delete leads in their tenant

### Implementation Details

- JWT tokens contain: `user_id`, `role`, `tenant_id`
- Policies use `auth.jwt()` to extract user information
- Team-based access uses junction table queries
- All policies enforce strict tenant isolation

## ⚡ Edge Function

### Endpoint
`POST /functions/v1/create-task`

### Features

✅ Input validation (required fields, task_type, due_at format)  
✅ Future date validation (due_at must be > now)  
✅ Application existence check  
✅ Automatic tenant_id extraction from application  
✅ Database insertion with service role key  
✅ Realtime broadcast event: `task.created`  
✅ Proper error handling (400, 500 status codes)  
✅ CORS support for browser requests  

### Request Body
```json
{
  "application_id": "uuid",
  "task_type": "call|email|review",
  "due_at": "2025-12-15T10:00:00Z"
}
```

### Response Format

**Success:**
```json
{
  "success": true,
  "task_id": "uuid"
}
```

**Error:**
```json
{
  "success": false,
  "error": "Error message",
  "details": "Detailed explanation"
}
```

### Validation Rules

- `application_id`: Must be a valid UUID of an existing application
- `task_type`: Must be one of: `call`, `email`, `review`
- `due_at`: Must be valid ISO 8601 timestamp in the future

## 🎨 Frontend Dashboard

### Features

✅ Displays tasks due today (status ≠ 'completed')  
✅ Real-time data fetching from Supabase  
✅ Displays: task type, application ID, due time, status  
✅ "Mark Complete" button with instant Supabase update  
✅ Loading state with spinner animation  
✅ Error handling with user-friendly messages  
✅ Empty state when no tasks ("All caught up!")  
✅ Responsive design with Tailwind CSS  
✅ Color-coded task type badges (blue for calls, green for emails, purple for reviews)  

### Technologies

- **React** with Hooks (useState, useEffect)
- **Supabase JS Client** for data fetching
- **TypeScript** for type safety
- **Tailwind CSS** for styling

### Component Structure
```
TodayTasksPage
├── Header (Today's date)
├── Loading State (spinner)
├── Error State (error message)
└── Tasks List
    ├── Empty State (no tasks)
    └── Task Cards
        ├── Task Type Badge
        ├── Due Time
        ├── Status Badge
        ├── Application ID
        └── Mark Complete Button
```

## 💳 Stripe Integration

### How to Implement Stripe Checkout for Application Fee

To implement a Stripe Checkout flow for application fees, I would follow these steps:

1. **Create Payment Request**: When a user initiates payment for an application, insert a row into the `payment_requests` table with details like `application_id`, `amount`, `currency`, and `status: 'pending'`. Store the generated `payment_request_id` for tracking.

2. **Create Stripe Checkout Session**: Call `stripe.checkout.sessions.create()` with the payment amount, success/cancel URLs, and metadata containing `application_id` and `payment_request_id`. This returns a checkout session URL and session ID.

3. **Store Checkout Session**: Save the Stripe `session_id` and `checkout_url` in the `payment_requests` table, linking it to the application. Redirect the user to the checkout URL.

4. **Handle Stripe Webhook**: Set up a webhook endpoint to listen for `checkout.session.completed` events. Verify the webhook signature using Stripe's library to ensure authenticity and prevent tampering.

5. **Update Payment Status**: When the webhook confirms successful payment, update the `payment_requests` table to set `status: 'completed'`, store the `stripe_payment_intent_id`, and record the `paid_at` timestamp.

6. **Update Application Stage**: After confirming payment, update the related `applications` table to change the stage from `pending_payment` to `under_review`, and create a timeline entry or task for the counselor to begin reviewing the application.

7. **Handle Failed Payments**: If the webhook receives a `checkout.session.expired` or payment failure event, update the payment request status to `failed` and optionally send a notification to the user to retry payment.

8. **Idempotency**: Use the Stripe `event.id` or `session_id` as an idempotency key to ensure webhook events are processed only once, even if Stripe retries the webhook delivery.

This approach ensures secure payment processing, accurate status tracking, and seamless integration between Stripe and the application workflow.

## 📝 Assumptions Made

1. **Multi-tenancy**: All queries filter by `tenant_id` for complete data isolation between organizations
2. **Authentication**: JWT tokens contain `user_id`, `role`, and `tenant_id` claims
3. **Team Structure**: The `lead_teams` junction table enables flexible team-based access control
4. **Task Types**: Restricted to three types (call, email, review) as per business requirements
5. **Date Handling**: All timestamps use ISO 8601 format with timezone information
6. **Frontend Environment**: Dashboard page assumes Next.js 13+ environment with proper routing
7. **Error Handling**: User-facing errors are friendly; detailed errors logged server-side for debugging
8. **Service Role**: Edge Function uses service role key to bypass RLS for task creation
9. **Realtime Events**: Broadcast events notify connected clients of new tasks in real-time
10. **Data Validation**: Both client-side and server-side validation for robust error handling

## 🛠️ Technologies Used

- **Database**: PostgreSQL 15+ (via Supabase)
- **Backend Runtime**: Deno (Supabase Edge Functions)
- **Frontend Framework**: Next.js 13+, React 18+
- **Language**: TypeScript
- **Styling**: Tailwind CSS 3+
- **Authentication**: Supabase Auth (JWT-based)
- **Realtime**: Supabase Realtime (WebSocket broadcast)
- **API Client**: Supabase JS Client Library v2

## 📧 Submission Details

**Name**: R. Yuvashri  
**Position**: Backend Development Internship - LearnLynk  
**Deadline**: December 7, 2025, 6:00 PM IST  

---

## ✅ Completion Checklist

- ✅ **Section 1**: Database Schema with tables, constraints, and indexes
- ✅ **Section 2**: RLS Policies for secure multi-tenant data access
- ✅ **Section 3**: Edge Function with validation and realtime events
- ✅ **Section 4**: Frontend dashboard with task management UI
- ✅ **Section 5**: Stripe payment integration explanation
- ✅ **Documentation**: Complete README with setup and testing instructions
- ✅ **Code Quality**: Clear naming conventions, proper structure, detailed comments

## 🔗 Repository

**GitHub**: https://github.com/Yuvashri29/learnlynk-tech-assessment

---

Thank you for reviewing my submission! I look forward to discussing the implementation details and technical decisions in our follow-up discussion.

