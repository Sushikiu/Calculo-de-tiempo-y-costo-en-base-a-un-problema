# Servicio GraphQL y despliegue 

**Responsable:** Luis  
**Rama:** `graphql-RestApi-Despliegue`  
**Producción:** [https://graphql.mango-ataulfo.com/](https://graphql.mango-ataulfo.com/)

### Funcionalidades
* Consultas: (`alumnos`, `alumnoPorEmail`) que consumen en tiempo real la misma base de datos de MongoDB Atlas compartida con el servicio REST.
* Filtrado: Búsqueda por idioma a cursar, nivel y estatus de familiar inscrito.
* Mutaciones: Operación `registrarAlumno` para alta complementaria vía GraphQL.
* Infraestructura: Configuración de dominios, proxy inverso y despliegue público en la nube para ambos servicios.

### Ejecución Local
```bash
cd services/graphql
npm install
npm run dev
# Sandbox disponible en http://localhost:4000/graphql
