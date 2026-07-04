// Vite (usado por @angular/build:dev-server) espera que `rewrite` sea una
// función; proxy.conf.json solo puede expresar strings, lo que hacía
// crashear el proceso entero de ng serve en la primera request a /api
// (TypeError: opts.rewrite is not a function).
// El backend monta sus rutas bajo /api/v1/... directamente (confirmado vía
// /openapi.json), así que no hay que reescribir el path — solo reenviarlo.
// Target correcto: el backend PROPIO de este designer (docker-compose.yml de
// este proyecto lo nombra "authentik-login-designer-backend"), NO
// "casmarts-login-backend" (ese es el contenedor del backend de
// authentik-login-manager — apuntar ahí fue un error de una verificación
// anterior en esta misma sesión, que "funcionaba" solo porque ambos backends
// comparten la misma base de datos y una API parecida para /themes).
module.exports = {
  '/api': {
    target: 'http://authentik-login-designer-backend:8000',
    changeOrigin: true,
  },
};
