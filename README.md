# Calendario Compartido

Backend en Node.js + Express, con los datos guardados en **Postgres** (usando el free tier permanente de [Neon](https://neon.tech), que no expira). Todas las personas que abran la URL ven y editan los mismos eventos y notas. No hay login: quien tenga el enlace puede entrar y usarlo.

## Estructura
```
calendar-app/
  server.js          API (events, notes, calendar/day|week|month), guarda en Postgres
  package.json
  public/index.html  Frontend
  .env.example        Ejemplo de la variable de conexión a la base de datos
```

## 1. Crea tu base de datos gratis en Neon
1. Ve a https://neon.tech y crea una cuenta gratis (puedes entrar con GitHub).
2. Crea un proyecto nuevo (te da una base de datos Postgres al instante, sin tarjeta).
3. En el dashboard del proyecto, copia la **Connection string** (empieza con `postgres://...`).

## 2. Pruébalo en tu computadora
1. Copia `.env.example` y renómbralo a `.env`.
2. Pega tu connection string de Neon en la línea `DATABASE_URL=...` de ese archivo.
3. Instala y arranca:
   ```
   npm install
   npm start
   ```
4. Abre http://localhost:3000 — debería aparecer con los eventos de ejemplo. Ciérralo y vuelve a abrirlo: los datos siguen ahí porque ya viven en Neon, no en tu computadora.

## 3. Despliega en Render
1. Sube el proyecto a GitHub (como ya hiciste antes) — el archivo `.env` **no** se sube porque está en `.gitignore`, así tu contraseña de la base de datos no queda pública.
2. En Render, crea el Web Service igual que antes: Build command `npm install`, Start command `npm start`, plan Free.
3. Antes de darle a "Deploy", ve a la sección **Environment** del servicio y agrega una variable:
   - Key: `DATABASE_URL`
   - Value: la misma connection string de Neon
4. Despliega. Cuando esté "Live", abre la URL — va a usar la misma base de datos de Neon, así que los datos **no se pierden** aunque Render reinicie o vuelvas a desplegar.

## Límites del plan gratis de Neon
- 0.5 GB de almacenamiento — de sobra para un calendario personal o de un grupo pequeño.
- La base de datos puede "dormir" tras un rato sin uso y despertar en 1-2 segundos con la siguiente petición; no se borra nada, solo tarda un poco la primera carga.

## API disponible
```
GET    /api/events
GET    /api/events/:id
POST   /api/events
PUT    /api/events/:id
DELETE /api/events/:id

GET    /api/calendar/day/:date        (YYYY-MM-DD)
GET    /api/calendar/week/:date       (cualquier fecha de esa semana)
GET    /api/calendar/month/:year/:month

GET    /api/notes
POST   /api/notes
PUT    /api/notes/:id
DELETE /api/notes/:id
```

## Seguridad
Como no hay login, cualquiera con la URL puede ver y editar el calendario. Si quieres restringirlo con un PIN de acceso compartido, dime y te lo agrego.
