// Vite (usado por @angular/build:dev-server) espera que `rewrite` sea una
// función; proxy.conf.json solo puede expresar strings, lo que hacía
// crashear el proceso entero de ng serve en la primera request a /api
// (TypeError: opts.rewrite is not a function).
// El backend monta sus rutas bajo /api/v1/... directamente (confirmado vía
// /openapi.json), así que no hay que reescribir el path — solo reenviarlo.
module.exports = {
  '/api': {
    target: 'http://casmarts-login-backend:8000',
    changeOrigin: true,
  },
};
