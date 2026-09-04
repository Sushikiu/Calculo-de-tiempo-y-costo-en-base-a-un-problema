# Servicio GraphQL — Inscripción de Alumnos (Academia de Idiomas)

API GraphQL del proyecto *"Cálculo de tiempo y costo en base a un problema (RUP)"*, a cargo de **Luis** (Backend & Deploy). Implementa el registro y la consulta de alumnos de una academia de idiomas sobre una base de datos **MongoDB Atlas**, y expone además un **cliente web** para probar todo el flujo sin salir del navegador.

Fue creada a partir del esquema de datos ya definido en el servicio REST, con la intención de poder **desplegar ambos servicios sobre la misma base de datos**.

---

## 1. Stack tecnológico

| Componente        | Versión   | Uso                                                        |
|-------------------|-----------|------------------------------------------------------------|
| Node.js           | `>= 20`   | Runtime. Proyecto 100 % ESM (`"type": "module"`)           |
| `graphql`         | `^16.9.0` | Núcleo del motor GraphQL (parser, validación, ejecución)   |
| `graphql-yoga`    | `^5.10.4` | Servidor HTTP de GraphQL: endpoint, GraphiQL y CORS        |
| `mongoose`        | `^9.9.4`  | ODM contra MongoDB Atlas                                   |
| `dotenv`          | `^17.4.2` | Carga de credenciales desde el `.env` de la raíz del repo  |

GraphQL Yoga corre sobre el servidor HTTP nativo de Node (`node:http`), lo que deja la dependencia mínima y el arranque en un solo proceso.

---

## 2. Estructura del servicio

```text
services/graphql/
├── server.js            # Arranque: HTTP server + Yoga + cliente web + conexión a BD
├── schema.js            # SDL (tipos/inputs/queries/mutations) + resolvers + lógica de filtrado
├── db.js                # Conexión a MongoDB Atlas (con workaround de DNS)
├── models/
│   └── Alumno.js        # Esquema Mongoose de la colección `alumnos`
├── public/
│   └── index.html       # Cliente web: formulario de registro + buscador con filtros
└── package.json         # Scripts y dependencias
```

---

## 3. Esquema GraphQL (`schema.js`)

El contrato se definió primero en SDL (Schema Definition Language) y luego se resolvió contra Mongoose. Se separan claramente los **tipos de salida** (`type`) de los **inputs de entrada** (`input`), siguiendo las convenciones del estándar GraphQL.

### 3.1 Tipos de salida

**`Alumno`**

| Campo              | Tipo        | Descripción                                    |
|--------------------|-------------|------------------------------------------------|
| `id`               | `ID!`       | Se mapea desde el `_id` de Mongo (ver §4)      |
| `nombre`           | `String!`   | Nombre completo del alumno                     |
| `email`            | `String!`   | Correo, único en la BD                         |
| `telefono`         | `String!`   | Teléfono de contacto                           |
| `quienRecomendo`   | `String`    | Referente que recomendó la academia (opcional) |
| `familiarInscrito` | `Boolean!`  | ¿Tiene un familiar ya inscrito? (descuento 5%) |
| `matriculaFamiliar`| `String`    | Matrícula del familiar (opcional)              |
| `idiomaNativo`     | `String!`   | Idioma materno                                 |
| `idiomaAprender`   | `String!`   | Idioma que cursará                             |
| `nivel`            | `Int!`      | Nivel de ingreso (default 1)                   |
| `medioPagoDefault` | `MedioPago!`| Medio de pago registrado                       |
| `fechaRegistro`    | `String!`   | Fecha ISO 8601 (serializada desde `Date`)      |

**`MedioPago`** (subdocumento embebido)

| Campo          | Tipo      |
|----------------|-----------|
| `numeroTarjeta`| `String!` |
| `titular`      | `String!` |

### 3.2 Inputs

- **`MedioPagoInput`** — espejo de entrada de `MedioPago`.
- **`AlumnoInput`** — datos para `registrarAlumno`. Los opcionales (`quienRecomendo`, `familiarInscrito`, `matriculaFamiliar`, `nivel`) tienen defaults en el modelo; los obligatorios replican las restricciones de Mongo.
- **`AlumnoFiltro`** — 13 criterios combinables para la query `alumnos`: `nombre`, `email`, `telefono`, `quienRecomendo`, `familiarInscrito`, `matriculaFamiliar`, `idiomaNativo`, `idiomaAprender`, `nivel`, `numeroTarjeta`, `titular`, `fechaDesde`, `fechaHasta`. Todos son opcionales: un filtro vacío (o nulo) devuelve el listado completo.

### 3.3 Operaciones

```graphql
type Query {
  alumnos(filtro: AlumnoFiltro): [Alumno!]!   # listado con filtros combinables
  alumno(email: String!): Alumno              # búsqueda exacta por correo
}

type Mutation {
  registrarAlumno(input: AlumnoInput!): Alumno!  # alta de alumno
}
```

Decisión de diseño: **no se expusieron mutaciones de actualización ni borrado** porque el caso de uso del problema (inscripción) solo requiere registro y consulta. Mantener la superficie del API mínima reduce la complejidad del esquema y coincide con los requisitos de RUP definidos por el equipo.

---

## 4. Resolutores

El resolver `Alumno` adapta el documento de Mongo a la forma del contrato GraphQL:

```js
id: (alumno) => alumno._id.toString(),
fechaRegistro: (alumno) => alumno.fechaRegistro?.toISOString() ?? null
```

- `alumnos` → `Alumno.find(buildFilterQuery(filtro)).sort({ fechaRegistro: -1 })`: siempre ordena del registro más reciente al más antiguo, sin que el cliente lo pida.
- `alumno` → `findOne` con coincidencia exacta de correo (case/acento-insensitive).
- `registrarAlumno` → instancia el modelo, guarda, y traduce los errores de BD a mensajes legibles (§6).

---

## 5. Búsqueda insensible a acentos y mayúsculas

Este es el aporte técnico más interesante del servicio. En español, un alumno registrado como *"José Ángel Núñez"* debería encontrarse buscando `"jose angel"`, `"JOSE ANGEL NUNEZ"` o `"ñuñez"`. Mongo solo ofrece `$options: 'i'` (mayúsculas/minúsculas), pero **nada** para vocales acentuadas ni la ñ, así que se construyó un sistema de normalización propio:

### 5.1 Clases de equivalencia por caracteres

```js
const ACCENT_GROUPS = { a: 'aá', e: 'eé', i: 'ií', o: 'oó', u: 'uú', n: 'nñ' };
```

Se recorre cada grupo para armar un mapa `CLASS_BY_CHAR` que, dado cualquier carácter, devuelve su grupo de equivalencia (`'á' → 'aá'`, `'ñ' → 'nñ'`). Al construir el patrón, **cada carácter del texto buscado se reemplaza por una clase de caracteres**: la `"a"` del input coincide con `"a"` o `"á"` en la BD, y la `"n"` con `"n"` o `"ñ"`. Todo se aplica sobre el valor ya convertido a minúsculas, por lo que basta `'i'` para cubrir mayúsculas.

### 5.2 Funciones de construcción del patrón

| Función             | Rol                                                                  |
|---------------------|----------------------------------------------------------------------|
| `escapeRegex`       | Escapa metacaracteres regex (`.*+?^${}()\|[]\\`) para que un carácter especial en el input no rompa ni inyecte el patrón |
| `insensiblePattern` | Normaliza el texto (trim + minúsculas) y expande carácter por carácter a clases `[aá]` |
| `partialRegex`      | `{ $regex: patrón, $options: 'i' }` → coincidencia **parcial** (substring, anclaje libre) |
| `exactRegex`        | `{ $regex: '^...$', $options: 'i' }` → coincidencia **exacta** anclada |

### 5.3 Composición del filtro (`buildFilterQuery`)

Cada criterio se aplica con la semántica más adecuada a su naturaleza:

| Campo                                                       | Semántica            | Motivo                                                            |
|-------------------------------------------------------------|----------------------|-------------------------------------------------------------------|
| `nombre`, `quienRecomendo`, `idiomaNativo`, `idiomaAprender`, `matriculaFamiliar`, `titular` | Parcial insensible | El usuario escribe fragmentos ("Sop", "Ingles")                   |
| `email`                                                     | Exacto insensible    | Un correo identifica una sola cuenta; un parcial traería falsos positivos |
| `telefono`                                                  | `onlyDigits` + `$regex` | Se quitan espacios, guiones y paréntesis de **ambos lados**: `"55 1234 5678"` = `"(55)1234-5678"` |
| `numeroTarjeta`                                             | `onlyDigits` sobre `medioPagoDefault.numeroTarjeta` | Mismo principio: `"4111 1111 1111 1111"` coincide con lo almacenado sin importar el formato |
| `familiarInscrito`, `nivel`                                 | Igualdad directa     | Booleano y entero no necesitan normalización (`!= null` para aceptar `false`/`0`) |
| `fechaDesde` / `fechaHasta`                                 | Rango `$gte`/`$lte`  | `fechaDesde` ancla a `T00:00:00Z` y `fechaHasta` a `T23:59:59.999Z`, de modo que el rango es **inclusivo de días completos** |

Los campos de subdocumentos se consultan con **dot notation** de Mongo (`medioPagoDefault.titular`), filtrando sin necesidad de `$lookup` ni poblar documentos completos.

---

## 6. Modelo de datos (`models/Alumno.js`)

```js
const AlumnoSchema = new mongoose.Schema({
  nombre: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  telefono: { type: String, required: true },
  quienRecomendo: { type: String, default: null },
  familiarInscrito: { type: Boolean, default: false },
  matriculaFamiliar: { type: String, default: null },
  idiomaNativo: { type: String, required: true },
  idiomaAprender: { type: String, required: true },
  nivel: { type: Number, default: 1 },
  medioPagoDefault: {
    numeroTarjeta: { type: String, required: true },
    titular: { type: String, required: true }
  },
  fechaRegistro: { type: Date, default: Date.now }
});
```

Puntos clave:

- **`email` con `unique: true`**: Mongo crea un índice único que garantiza la integridad a nivel de BD (no solo en la aplicación). Este índice es el que dispara el error `11000` que se captura en la mutación.
- **Defaults server-side**: `familiarInscrito: false`, `nivel: 1` y `fechaRegistro: Date.now` se aplican en el modelo, no en el front, por lo que el API es robusta aunque el cliente omita campos.
- **Subdocumento embebido** `medioPagoDefault`: un alumno tiene un solo medio de pago predeterminado, y esta relación 1:1 sin ciclo de vida independiente se modela embutido (mejor rendimiento de lectura, sin `$lookup`), no referenciado.
- La validación de requeridos corre en Mongoose en el `save()`, y sus fallos (`ValidationError`) se traducen a mensajes amigables (§7).

---

## 7. Manejo de errores amigable

Los errores de Mongoose son técnicos y en inglés; la API los traduce con `GraphQLError` para que el cliente reciba mensajes útiles en español:

```js
try {
  const nuevoAlumno = new Alumno(input);
  await nuevoAlumno.save();
  return nuevoAlumno;
} catch (error) {
  if (error.code === 11000) {
    throw new GraphQLError('Ya existe un alumno registrado con ese correo electrónico');
  }
  if (error.name === 'ValidationError') {
    const campos = Object.keys(error.errors).join(', ');
    throw new GraphQLError(`Datos inválidos. Campos con problema: ${campos}`);
  }
  throw new GraphQLError('Error al registrar el alumno: ' + error.message);
}
```

| Condición                      | Mensaje devuelto                                             |
|--------------------------------|--------------------------------------------------------------|
| `error.code === 11000` (violación del índice único de email) | *"Ya existe un alumno registrado con ese correo electrónico"* |
| `ValidationError` de Mongoose  | *"Datos inválidos. Campos con problema: nombre, email, ..."* (lista de campos en conflicto) |
| Cualquier otro error           | *"Error al registrar el alumno: \<detalle\>"*                 |

---

## 8. Conexión a MongoDB Atlas (`db.js`)

```js
import dns from 'node:dns';
dns.setServers(['8.8.8.8', '8.8.4.4']);
```

**Workaround implementado**: en el entorno de despliegue la resolución DNS del hostname del cluster de Atlas fallaba con los servidores DNS por defecto del sistema (típico en redes con DNS restricción o en contenedores), y el `mongoose.connect()` colgaba o devolvía `getaddrinfo ENOTFOUND`. Forzar los resolutores públicos de Google (`8.8.8.8` / `8.8.4.4`) a nivel de proceso estabiliza la conexión sin tocar la configuración de red.

La función `connectDB()`:

- Lee `MONGO_URI` del entorno; si falta, avisa por consola en lugar de crashear el proceso (el servidor puede subir aunque la BD esté caída, y los resolvers devolverán el error de conexión traducido).
- Registra en consola el resultado del intento de conexión (`Conectado a MongoDB` / detalle del error).

**Variables de entorno** (leídas del `.env` en la **raíz del repositorio**, compartido entre ambos servicios):

| Variable    | Descripción                                   |
|-------------|-----------------------------------------------|
| `MONGO_URI` | Cadena de conexión al cluster de Atlas        |
| `PORT`      | Puerto HTTP (fallback: `4000`)                |

El arranque es **secuencial**: `await connectDB()` antes de `server.listen()`, para que la primera solicitud posible encuentre la conexión ya establecida y no haya condiciones de carrera.

---

## 9. Servidor HTTP y endpoints (`server.js`)

```js
const yoga = createYoga({ schema, graphqlEndpoint: '/graphql', cors: { origin: '*' } });
```

El `node:http` server decide por ruta:

| Ruta                     | Respuesta                                                       |
|--------------------------|------------------------------------------------------------------|
| `/` o `/index.html`      | Sirve el cliente web desde `public/` (con `404` amable si falta) |
| `/graphql` y demás rutas | Delega a GraphQL Yoga                                            |

Endpoints disponibles al arrancar:

```text
http://localhost:PORT/            → cliente web de registro y consulta
http://localhost:PORT/graphql     → endpoint GraphQL (POST) + GraphiQL (GET)
```

- **GraphiQL** viene integrado en Yoga: al abrir `/graphql` en el navegador se obtiene el IDE oficial con explorador de esquema, autocompletado y historial de queries, sin configurar nada.
- **CORS `origin: *`**: el endpoint puede consumirse desde cualquier origen (necesario para la fase de pruebas/despliegue).
- El `.env` se carga con `dotenv.config()` apuntando a la raíz del repo (`../../`), con logs de diagnóstico (`Ruta del .env`, `MONGO_URI cargada: sí/NO`) que facilitaron depurar el despliegue.

---

## 10. Cliente web (`public/index.html`)

Página autocontenida (HTML + CSS + JS puro, sin frameworks ni build) que consume el API sobre `fetch` con GraphQL-over-HTTP (`POST /graphql`). Cumple dos funciones: **demo del servicio** y **herramienta de prueba para el plan de pruebas de Ana (QA)**.

### 10.1 Panel izquierdo — formulario de inscripción

- Agrupado en secciones: *Información personal*, *Programa académico*, *Beneficios & Pago*.
- `idiomaAprender` como `<select>` (Inglés/Francés/Alemán/Italiano) para estandarizar valores.
- **Lógica condicional**: el campo "Matrícula del familiar" solo se muestra y envía si el checkbox "Familiar previamente inscrito" (descuento del 5%) está activo; al desmarcarlo se limpia.
- El titular de la tarjeta se autocompleta con el nombre capturado.
- `quienRecomendo` vacío se normaliza a `null` para respetar la semántica de opcionales.
- Al enviar: deshabilita el botón ("Guardando…"), ejecuta la mutation `registrarAlumno` con variables, muestra alerta de éxito/error con el mensaje que devolvió el servidor (§7), y si hubo éxito **recarga el listado** para reflejar el nuevo registro.

### 10.2 Panel derecho — listado y búsqueda

- Carga automática de todos los alumnos al abrir (ordenados por fecha de registro descendente).
- Rejilla de 6 filtros combinables (nombre, email, teléfono, idioma, nivel, familiar inscrito) que mapean 1:1 a `AlumnoFiltro`; Enter dispara la búsqueda.
- Botón "Ver todos" que limpia los filtros.
- Validación UX: exige al menos un criterio antes de buscar.
- **Tabla con formato**:
  - Pastilla verde `5% · ALUM-xxxx` para alumnos con descuento familiar.
  - **Tarjeta enmascarada**: `•••• 1234` (solo últimos 4 dígitos), para no exponer PANs completos en pantalla.
  - Fecha en formato local `es-MX`.
- **Anti-XSS**: toda cadena de la BD se interpola vía `escapeHtml()` (crea el nodo con `textContent` y lee `innerHTML`), nunca con concatenación directa al DOM.

---

## 11. Cómo ejecutarlo

```bash
cd services/graphql
npm install

# crear/llenar el .env en la RAÍZ del repositorio con:
#   MONGO_URI=mongodb+srv://<user>:<pass>@<cluster>.mongodb.net/<db>
#   PORT=4000            (opcional)

npm start        # producción: node server.js
npm run dev      # desarrollo: node --watch server.js (reinicia al guardar)
```

Al arrancar imprime por consola las tres URLs disponibles (§9).

---

## 12. Ejemplos de uso

### 12.1 Registrar un alumno

```graphql
mutation RegistrarAlumno($input: AlumnoInput!) {
  registrarAlumno(input: $input) {
    id
    nombre
    email
    fechaRegistro
  }
}
```

Variables:

```json
{
  "input": {
    "nombre": "Sopas Mango Ataulfo",
    "email": "sopas@ejemplo.com",
    "telefono": "55 1234 5678",
    "idiomaNativo": "Español",
    "idiomaAprender": "Ingles",
    "quienRecomendo": "Ana Pérez",
    "familiarInscrito": true,
    "matriculaFamiliar": "ALUM-2026-004",
    "nivel": 1,
    "medioPagoDefault": {
      "numeroTarjeta": "4111 1111 1111 1111",
      "titular": "Sopas Mango Ataulfo"
    }
  }
}
```

Respuesta:

```json
{
  "data": {
    "registrarAlumno": {
      "id": "664f1c2e8a9b3f4d5e6f7a8b",
      "nombre": "Sopas Mango Ataulfo",
      "email": "sopas@ejemplo.com",
      "fechaRegistro": "2026-09-04T18:32:11.204Z"
    }
  }
}
```

Si el correo ya existe, la respuesta devuelve (en lugar de `data`):

```json
{ "errors": [{ "message": "Ya existe un alumno registrado con ese correo electrónico" }] }
```

### 12.2 Consultar con filtros

```graphql
query Alumnos($filtro: AlumnoFiltro) {
  alumnos(filtro: $filtro) {
    nombre
    email
    nivel
    idiomaAprender
    familiarInscrito
    medioPagoDefault { titular }
    fechaRegistro
  }
}
```

Variables — tres criterios a la vez, **sin acentos ni exactitud de tamaño**:

```json
{
  "filtro": {
    "nombre": "sopas man",
    "idiomaAprender": "ingles",
    "fechaDesde": "2026-09-01",
    "fechaHasta": "2026-09-04"
  }
}
```

Encontrará a *"Sopas Mango Ataulfo"* registrado ese rango de fechas, aunque su nombre lleve acentos o mayúsculas.

### 12.3 Buscar un alumno exacto por correo

```graphql
query {
  alumno(email: "SOPAS@ejemplo.com") {
    nombre
    telefono
    quienRecomendo
  }
}
```

---

## 13. Integración con el servicio REST

El modelo de datos (`models/Alumno.js`) es **idéntico al del servicio REST**, por lo que ambas APIs escriben y leen la **misma colección `alumnos`** de la misma base de datos (el `.env` es compartido en la raíz del repo). Un alumno registrado desde GraphQL es visible de inmediato desde REST y viceversa. Esta unificación se realizó en el commit *"creación de graphql y unión con servicio REST con la intención de prepararlo para desplegar ambos servicios juntos"* y es la base del diagrama de despliegue público.
