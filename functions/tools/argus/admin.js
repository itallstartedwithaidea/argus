// Gate for ARGUS admin dashboard.
// Page is served to anyone (OAuth check happens client-side after load),
// but we add security headers and prevent caching/indexing.

export async function onRequest(context) {
  const response = await context.next();
  const newResponse = new Response(response.body, response);
  newResponse.headers.set('Cache-Control', 'no-store, private');
  newResponse.headers.set('X-Robots-Tag', 'noindex, nofollow');
  return newResponse;
}
