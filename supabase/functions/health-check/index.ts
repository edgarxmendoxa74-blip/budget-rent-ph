import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// This is a cron-triggered Edge Function
// Configure in supabase/functions/health-check/config.toml

export default async (req: Request) => {
  try {
    // Get environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    // Check for required environment variables
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Missing required environment variables')
      return new Response(
        JSON.stringify({
          status: 'error',
          message: 'Missing required environment variables',
          timestamp: new Date().toISOString()
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        }
      )
    }

    // Create Supabase client with service role key
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Perform lightweight database check
    const { data, error } = await supabase
      .from('properties')
      .select('id')
      .limit(1)

    if (error) {
      console.error('Database health check failed:', error)
      return new Response(
        JSON.stringify({
          status: 'error',
          message: 'Database connection failed',
          timestamp: new Date().toISOString(),
          error: error.message
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        }
      )
    }

    console.log(`Health check successful at ${new Date().toISOString()}`)
    
    // Return success response
    return new Response(
      JSON.stringify({
        status: 'ok',
        timestamp: new Date().toISOString(),
        message: 'Database connection verified'
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Health check error:', error)
    return new Response(
      JSON.stringify({
        status: 'error',
        message: 'Internal server error',
        timestamp: new Date().toISOString(),
        error: error.message
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  }
}