**Alcance y reglas de negocio implementadas**

Este servicio implementa el caso de uso **CU-01: Inscribir alumno**:
* Captura de datos generales, idioma nativo e idioma a aprender.
* Lógica condicional de **descuento familiar del 5%** en caso de contar con un familiar matriculado (`familiarInscrito: true` y formato estricto de matrícula `ALUM-XXXX`).
* Manejo seguro de método de pago predeterminado (registro de tarjeta asociada al alumno).
* Retorno de identificador único (`ObjectId`), matrícula asignada y credenciales de acceso temporal al portal.

---

* **Entorno de ejecución:** Node.js (v18+)
* **Framework Web:** Express.js
* **Base de Datos:** Mongoose sobre MongoDB Atlas
* **Frontend:** HTML5, CSS3 y JavaScript

---

## Especificación técnica

### `POST /api/alumnos`
Registra un nuevo alumno en la base de datos de la academia.

* **URL local:** `http://localhost:3000/api/alumnos`
* **URL en producción:** `https://rest.mango-ataulfo.com/api/alumnos`
* **Headers:** `Content-Type: application/json`

#### Ejemplo de petición (Payload JSON):
```json
{
  "nombre": "Xavier Lopez Chabelo",
  "email": "chabelo@mueblesdico.com",
  "telefono": "5255000000",
  "quienRecomendo": "Pepito",
  "familiarInscrito": true,
  "matriculaFamiliar": "ALUM-1950",
  "idiomaNativo": "Espanol",
  "idiomaAprender": "Italiano",
  "nivel": 1,
  "medioPagoDefault": {
    "numeroTarjeta": "4152336699881122",
    "titular": "Xavier Lopez Chabelo"
  }
}
