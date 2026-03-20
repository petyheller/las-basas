# 🂡 Las Basas — Online

Juego de cartas online con salas privadas, multijugador en tiempo real y bots opcionales.

---

## Estructura del proyecto

```
las-basas/
  server.js          ← Servidor Node.js (lógica del juego + WebSockets)
  package.json       ← Dependencias del servidor
  client/
    src/App.jsx      ← App React (interfaz del juego)
    package.json     ← Dependencias del cliente
    vite.config.js   ← Config de Vite
    index.html
```

---

## Deploy en Railway (recomendado — gratis)

### 1. Subir a GitHub

1. Andá a [github.com](https://github.com) → **New repository**
2. Nombre: `las-basas` → **Create repository**
3. En la página del repo vacío, elegí **"uploading an existing file"**
4. Subí **todos los archivos** manteniendo la estructura de carpetas
   - Subí primero los archivos raíz: `server.js`, `package.json`, `.gitignore`
   - Creá la carpeta `client/` y subí los archivos adentro
   - Creá `client/src/` y subí `App.jsx` y `main.jsx`
5. **Commit changes**

### 2. Hacer el build del cliente antes de subir

Antes de subir a GitHub, necesitás buildear el cliente. En tu máquina:

```bash
cd client
npm install
npm run build
```

Esto genera la carpeta `client/dist/` — **subí esa carpeta también a GitHub**.

> Si no tenés Node instalado, podés usar [stackblitz.com](https://stackblitz.com) o [codesandbox.io](https://codesandbox.io) para hacer el build.

### 3. Deploy en Railway

1. Andá a [railway.app](https://railway.app) → **Login with GitHub**
2. **New Project** → **Deploy from GitHub repo**
3. Elegí el repo `las-basas`
4. Railway lo detecta automáticamente como Node.js
5. En **Settings → Environment**, agregá esta variable:
   ```
   PORT = 3001
   ```
6. En **Settings → Deploy**, el start command es: `npm start`
7. Dale **Deploy** — en ~2 minutos tenés una URL tipo `las-basas.up.railway.app`

¡Listo! Compartí esa URL con tus amigos y a jugar.

---

## Deploy alternativo: Render (también gratis)

1. [render.com](https://render.com) → **New Web Service**
2. Conectá el repo de GitHub
3. Configuración:
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Environment:** `PORT = 10000` (Render usa el 10000 por defecto)
4. **Create Web Service**

---

## Desarrollo local

```bash
# Terminal 1 — servidor
npm install
npm run dev

# Terminal 2 — cliente
cd client
npm install
npm run dev
```

El cliente corre en `http://localhost:5173` y se conecta automáticamente al servidor en `localhost:3001`.

---

## Cómo jugar

1. El **host** crea una sala y elige cantidad de jugadores y sistema de puntos
2. Comparte el **código de 4 letras** con los demás
3. Los demás entran a la URL del juego y usan **Unirse a sala**
4. El host puede agregar **bots** para completar los lugares vacíos
5. Cuando están todos, el host presiona **¡Arrancar!**

### Sistemas de puntos

- **A lo Pablo:** Acertar = 10 + apuesta² | Fallar = −10 × diferencia
- **A lo Fer:** Acertar 0 = 5pts | Acertar N = 10×N | Fallar = −10 × diferencia
