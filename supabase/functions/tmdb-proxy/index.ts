import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { endpoint, region } = await req.json()
    
    const TMDB_API_KEY = Deno.env.get('TMDB_API_KEY')
    if (!TMDB_API_KEY) {
      throw new Error('TMDB_API_KEY not found')
    }

    const TMDB_BASE_URL = 'https://api.themoviedb.org/3'
    const url = new URL(`${TMDB_BASE_URL}${endpoint}`)
    url.searchParams.append('api_key', TMDB_API_KEY)
    
    if (region) {
      url.searchParams.append('region', region)
    }

    const response = await fetch(url.toString())
    if (!response.ok) {
      throw new Error('Failed to fetch from TMDB')
    }
    
    const data = await response.json()

    return new Response(
      JSON.stringify(data),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  }
})