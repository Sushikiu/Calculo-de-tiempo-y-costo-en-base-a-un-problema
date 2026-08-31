const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const Alumno = require('./Alumno');

const app = express();
app.use(express.json());
app.use(cors());

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ Conectado a MongoDB Atlas'))
  .catch(err => console.error('❌ Error de conexión:', err));

app.post('/api/alumnos', async (req, res) => {
  try {
    const nuevoAlumno = new Alumno(req.body);
    await nuevoAlumno.save();
    res.status(201).json({
      mensaje: 'Alumno registrado con éxito',
      alumno: nuevoAlumno
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor REST corriendo en http://localhost:${PORT}`);
});