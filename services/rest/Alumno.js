const mongoose = require('mongoose');

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

module.exports = mongoose.model('Alumno', AlumnoSchema);