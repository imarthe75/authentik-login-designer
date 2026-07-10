# Manual Técnico y de Arquitectura - Authentik Login Designer

## 1. Introducción y Propósito
**Authentik Login Designer** es una herramienta visual e interactiva construida con **Angular (v17+)** y un backend en **FastAPI (Python)**. Permite diseñar y personalizar en tiempo real las pantallas de inicio de sesión de Authentik para múltiples aplicaciones de forma independiente (ej. *Starter*, *Plane*, *Centinela-AI*).

---

## 2. Arquitectura de Software

```mermaid
graph TD
    A[Cliente: Angular Frontend] -->|REST API + X-Admin-Key| B[Nginx Reverse Proxy]
    B -->|Puerto 8000| C[FastAPI Backend]
    C -->|SQLAlchemy Asyncpg| D[PostgreSQL 16 DB]
    C -->|Redis Protocol| E[Valkey Cache]
    C -->|API/HTTPS| F[Authentik Server]
```

### 2.1. Frontend (Angular)
El frontend es una Single Page Application (SPA) construida sobre **Angular** con arquitectura moderna:
* **Standalone Components:** Minimiza el acoplamiento y elimina la necesidad de `NgModule` tradicionales.
* **Angular Signals:** Gestión del estado de configuración reactivo en tiempo real para reflejar cambios visuales de forma instantánea.
* **Tailwind CSS 3.4:** Utilizado para estructurar y maquetar el panel de administración rápida y dinámicamente.
* **TipTap Editor:** Editor WYSIWYG headless configurado de forma personalizada para soportar variables Jinja2 de Authentik (`{{ url }}`) sin alterar el marcado HTML original.

### 2.2. Backend (FastAPI)
* **FastAPI:** Framework asíncrono de alto rendimiento.
* **PostgreSQL:** Persistencia del modelo relacional de temas y configuraciones por aplicación/flujo.
* **Valkey:** Fork open-source de Redis utilizado para el almacenamiento en caché de los temas cargados dinámicamente, garantizando tiempos de respuesta ultrarrápidos en el portal de login.

---

## 3. Flujos de Trabajo Clave

### 3.1. Intercepción del Shadow DOM en Authentik (`ECSS`)
Authentik renderiza sus formularios de identificación mediante Web Components encapsulados en el **Shadow DOM**, lo que impide que las hojas de estilos normales del navegador afecten su apariencia.
* **Solución técnica:** El Designer inyecta dinámicamente un array de estilos CSS directos (`ECSS`) en la cabecera de la plantilla base `flow.html` de Authentik.
* Al renderizarse la página de login, un `MutationObserver` detecta los elementos Lit (`ak-stage-identification`, `ak-flow-input-password`) e inyecta dinámicamente los estilos calculados en la raíz de su Shadow DOM.

### 3.2. Sincronización de Temas a Authentik
Cuando un administrador guarda y hace clic en "Desplegar", el backend:
1. Compila los estilos y las imágenes subidas en variables CSS nativas.
2. Actualiza los valores en la base de datos de PostgreSQL.
3. Invalida la caché de Valkey.
4. Llama a la API interna de Authentik para sincronizar la marca (Branding) correspondiente.

---

## 4. Configuración y Variables de Entorno
El backend utiliza las siguientes variables en el archivo `.env`:

```ini
# Conexión a Base de Datos
DATABASE_URL=postgresql+asyncpg://designer_user:YourPassword@postgres:5432/authentik_login_designer

# Caché / Valkey
VALKEY_URL=redis://valkey:6379/1

# Seguridad
ADMIN_API_KEY=super_secure_hex_key_here
CORS_ORIGINS=http://localhost:3000,http://localhost:80,https://auth.casmart.internal

# Configuración de Servidor
PUBLIC_API_BASE_URL=https://auth.casmart.internal
```
