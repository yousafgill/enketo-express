/**  
 * The version, resources and fallback variables above are dynamically prepended by the offline-controller.
 */
const CACHES = [ `enketo-common_${version}` ];

self.addEventListener( 'install', event => {
    self.skipWaiting();
    // Perform install steps
    event.waitUntil(
        caches.open( CACHES[ 0 ] )
        .then( cache => {
            console.log( 'Opened cache' );
            return cache.addAll( resources.concat( fallback ) );
        } )
        .catch( e => {
            console.log( 'Service worker install error', e );
        } )
        .catch( e => {
            console.error( 'Error posting service worker install message to client', e );
        } )
    );
} );

self.addEventListener( 'activate', event => {
    console.log( 'activated!' );
    // Delete old resource caches
    event.waitUntil(
        caches.keys().then( keys => Promise.all(
            keys.map( key => {
                if ( !CACHES.includes( key ) ) {
                    console.log( 'deleting cache', key );
                    return caches.delete( key );
                }
            } )
        ) ).then( () => {
            console.log( `${version} now ready to handle fetches!` );
        } )
    );
} );

self.addEventListener( 'fetch', event => {
    event.respondWith(
        caches.match( event.request )
        .then( response => {
            if ( response ) {
                console.log( 'returning cached response for', event.request.url );
                return response;
            }

            return fetch( event.request, { credentials: 'include' } )
                .then( response => {
                    const isScopedResource = event.request.url.includes( '/x/' );
                    const isTranslation = event.request.url.includes( '/locales/build/' );
                    const isServiceWorkerScript = event.request.url === event.target.serviceWorker.scriptURL;

                    // The second clause prevents confusing logging when opening the service worker directly in a separate tab.
                    if ( isScopedResource && !isServiceWorkerScript && !isTranslation ) {
                        console.error( 'Resource missing from cache?', event.request.url );
                    }

                    // Check if we received a valid response
                    if ( !response || response.status !== 200 || response.type !== 'basic' || !isTranslation ) {
                        return response;
                    }

                    // Cache any additional loaded languages
                    const responseToCache = response.clone();

                    // Cache any non-English language files that are requested
                    caches.open( CACHES[ 0 ] )
                        .then( cache => {
                            cache.put( event.request, responseToCache );
                        } );

                    return response;
                } )
                .catch( e => {
                    // Let fail silently
                    console.log( 'Failed to fetch resource', event.request, e );
                } );
        } )
    );
} );