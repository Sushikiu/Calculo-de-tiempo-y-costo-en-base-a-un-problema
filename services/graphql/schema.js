import { GraphQLError } from 'graphql';
import { createSchema } from 'graphql-yoga';
import Alumno from './models/Alumno.js';

export const typeDefs = /* GraphQL */ `
  type MedioPago {
    numeroTarjeta: String!
    titular: String!
  }

  type Alumno {
    id: ID!
    nombre: String!
    email: String!
    telefono: String!
    quienRecomendo: String
    familiarInscrito: Boolean!
    matriculaFamiliar: String
    idiomaNativo: String!
    idiomaAprender: String!
    nivel: Int!
    medioPagoDefault: MedioPago!
    fechaRegistro: String!
  }

  input MedioPagoInput {
    numeroTarjeta: String!
    titular: String!
  }

  input AlumnoInput {
    nombre: String!
    email: String!
    telefono: String!
    quienRecomendo: String
    familiarInscrito: Boolean
    matriculaFamiliar: String
    idiomaNativo: String!
    idiomaAprender: String!
    nivel: Int
    medioPagoDefault: MedioPagoInput!
  }

  input AlumnoFiltro {
    nombre: String
    email: String
    telefono: String
    quienRecomendo: String
    familiarInscrito: Boolean
    matriculaFamiliar: String
    idiomaNativo: String
    idiomaAprender: String
    nivel: Int
    numeroTarjeta: String
    titular: String
    fechaDesde: String
    fechaHasta: String
  }

  type Query {
    alumnos(filtro: AlumnoFiltro): [Alumno!]!
    alumno(email: String!): Alumno
  }

  type Mutation {
    registrarAlumno(input: AlumnoInput!): Alumno!
  }
`;

const ACCENT_GROUPS = { a: 'aá', e: 'eé', i: 'ií', o: 'oó', u: 'uú', n: 'nñ' };
const CLASS_BY_CHAR = {};
for (const group of Object.values(ACCENT_GROUPS)) {
  for (const ch of group) CLASS_BY_CHAR[ch] = group;
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function insensiblePattern(value) {
  let out = '';
  for (const ch of value.trim().toLowerCase()) {
    out += CLASS_BY_CHAR[ch] ? `[${CLASS_BY_CHAR[ch]}]` : escapeRegex(ch);
  }
  return out;
}

function partialRegex(value) {
  return { $regex: insensiblePattern(value), $options: 'i' };
}

function exactRegex(value) {
  return { $regex: `^${insensiblePattern(value)}$`, $options: 'i' };
}

function onlyDigits(value) {
  return value.replace(/\D/g, '');
}

function buildFilterQuery(filtro) {
  const q = {};
  filtro = filtro || {};

  for (const field of ['nombre', 'quienRecomendo', 'idiomaNativo', 'idiomaAprender', 'matriculaFamiliar', 'titular']) {
    if (filtro[field]) q[field === 'titular' ? 'medioPagoDefault.titular' : field] = partialRegex(filtro[field]);
  }

  if (filtro.email) q.email = exactRegex(filtro.email);
  if (filtro.telefono) q.telefono = { $regex: onlyDigits(filtro.telefono) };
  if (filtro.numeroTarjeta) q['medioPagoDefault.numeroTarjeta'] = { $regex: onlyDigits(filtro.numeroTarjeta) };
  if (filtro.familiarInscrito != null) q.familiarInscrito = filtro.familiarInscrito;
  if (filtro.nivel != null) q.nivel = filtro.nivel;

  const rango = {};
  if (filtro.fechaDesde) rango.$gte = new Date(`${filtro.fechaDesde}T00:00:00Z`);
  if (filtro.fechaHasta) rango.$lte = new Date(`${filtro.fechaHasta}T23:59:59.999Z`);
  if (Object.keys(rango).length) q.fechaRegistro = rango;

  return q;
}

export const resolvers = {
  Alumno: {
    id: (alumno) => alumno._id.toString(),
    fechaRegistro: (alumno) => alumno.fechaRegistro?.toISOString() ?? null
  },
  Query: {
    alumnos: async (_root, { filtro }) => {
      return Alumno.find(buildFilterQuery(filtro)).sort({ fechaRegistro: -1 });
    },
    alumno: async (_root, { email }) => {
      return Alumno.findOne({ email: exactRegex(email) });
    }
  },
  Mutation: {
    registrarAlumno: async (_root, { input }) => {
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
    }
  }
};

export const schema = createSchema({ typeDefs, resolvers });
