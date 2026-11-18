// Adjuntos en Firebase Storage (WHIDER_CONFIG.storage): la misma prueba que adjuntos-nube.js, con los archivos
// enteros en Storage y sus reglas (storage.rules) en el emulador
process.env.WHIDER_ADJUNTOS = 'storage';
require('./adjuntos-nube.js');
