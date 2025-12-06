// @ts-nocheck
// This file is meant to run in Deno/Supabase Edge Functions environment

// Import required dependencies
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'



// CORS headers for cross-origin requests
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Define request body interface
interface CreateTaskRequest {
  application_id: string
  task_type: string
  due_at: string
}

// Define response interfaces
interface SuccessResponse {
  success: true
  task_id: string
}

interface ErrorResponse {
  success: false
  error: string
  details?: string
}

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // ============================================
    // STEP 1: Only allow POST requests
    // ============================================
    if (req.method !== 'POST') {
      const errorResponse: ErrorResponse = {
        success: false,
        error: 'Method not allowed',
        details: 'Only POST requests are allowed'
      }
      return new Response(
        JSON.stringify(errorResponse),
        { 
          status: 405, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // ============================================
    // STEP 2: Parse request body
    // ============================================
    let body: CreateTaskRequest
    try {
      body = await req.json()
    } catch (parseError) {
      const errorResponse: ErrorResponse = {
        success: false,
        error: 'Invalid JSON',
        details: 'Request body must be valid JSON'
      }
      return new Response(
        JSON.stringify(errorResponse),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    const { application_id, task_type, due_at } = body

    // ============================================
    // STEP 3: Validate required fields
    // ============================================
    if (!application_id || !task_type || !due_at) {
      const errorResponse: ErrorResponse = {
        success: false,
        error: 'Missing required fields',
        details: 'application_id, task_type, and due_at are all required'
      }
      return new Response(
        JSON.stringify(errorResponse),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // ============================================
    // STEP 4: Validate task_type
    // ============================================
    const validTaskTypes = ['call', 'email', 'review']
    if (!validTaskTypes.includes(task_type)) {
      const errorResponse: ErrorResponse = {
        success: false,
        error: 'Invalid task_type',
        details: `task_type must be one of: ${validTaskTypes.join(', ')}`
      }
      return new Response(
        JSON.stringify(errorResponse),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // ============================================
    // STEP 5: Validate due_at (must be future timestamp)
    // ============================================
    const dueAtDate = new Date(due_at)
    const now = new Date()
    
    // Check if date is valid
    if (isNaN(dueAtDate.getTime())) {
      const errorResponse: ErrorResponse = {
        success: false,
        error: 'Invalid due_at format',
        details: 'due_at must be a valid ISO 8601 timestamp (e.g., 2025-01-01T12:00:00Z)'
      }
      return new Response(
        JSON.stringify(errorResponse),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Check if date is in the future
    if (dueAtDate <= now) {
      const errorResponse: ErrorResponse = {
        success: false,
        error: 'Invalid due_at',
        details: 'due_at must be a future timestamp'
      }
      return new Response(
        JSON.stringify(errorResponse),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // ============================================
    // STEP 6: Initialize Supabase client with service role
    // ============================================
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    
    if (!supabaseUrl || !supabaseServiceKey) {
      const errorResponse: ErrorResponse = {
        success: false,
        error: 'Server configuration error',
        details: 'Supabase credentials not configured'
      }
      return new Response(
        JSON.stringify(errorResponse),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // ============================================
    // STEP 7: Verify application exists and get tenant_id
    // ============================================
    const { data: application, error: appError } = await supabase
      .from('applications')
      .select('tenant_id')
      .eq('id', application_id)
      .single()

    if (appError || !application) {
      const errorResponse: ErrorResponse = {
        success: false,
        error: 'Application not found',
        details: `No application found with id: ${application_id}`
      }
      return new Response(
        JSON.stringify(errorResponse),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // ============================================
    // STEP 8: Insert task into database
    // ============================================
    const { data: task, error: insertError } = await supabase
      .from('tasks')
      .insert({
        related_id: application_id,  // Using related_id as per schema
        tenant_id: application.tenant_id,
        type: task_type,
        due_at: dueAtDate.toISOString(),
        status: 'pending'
      })
      .select('id')
      .single()

    if (insertError) {
      console.error('Database insert error:', insertError)
      const errorResponse: ErrorResponse = {
        success: false,
        error: 'Failed to create task',
        details: insertError.message
      }
      return new Response(
        JSON.stringify(errorResponse),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // ============================================
    // STEP 9: Emit Realtime broadcast event
    // ============================================
    try {
      const channel = supabase.channel('tasks')
      await channel.send({
        type: 'broadcast',
        event: 'task.created',
        payload: {
          task_id: task.id,
          application_id: application_id,
          task_type: task_type,
          due_at: dueAtDate.toISOString(),
          created_at: new Date().toISOString()
        }
      })
      
      // Clean up channel
      supabase.removeChannel(channel)
    } catch (broadcastError) {
      // Log error but don't fail the request
      // Task was created successfully
      console.error('Realtime broadcast error:', broadcastError)
    }

    // ============================================
    // STEP 10: Return success response
    // ============================================
    const successResponse: SuccessResponse = {
      success: true,
      task_id: task.id
    }

    return new Response(
      JSON.stringify(successResponse),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    // ============================================
    // CATCH-ALL ERROR HANDLER
    // ============================================
    console.error('Unexpected error:', error)
    
    const errorResponse: ErrorResponse = {
      success: false,
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'An unexpected error occurred'
    }
    
    return new Response(
      JSON.stringify(errorResponse),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})