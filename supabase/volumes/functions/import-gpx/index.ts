// Minimal placeholder edge function for local dev.
// Your backend invokes this as SUPABASE_IMPORT_GPX_FUNCTION.

Deno.serve(async () => {
  return new Response(
    JSON.stringify({
      error: 'import-gpx not implemented in local dev stack',
    }),
    { status: 501, headers: { 'Content-Type': 'application/json' } }
  )
})
