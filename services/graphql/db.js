import dns from 'node:dns'
import mongoose from 'mongoose';
dns.setServers(['8.8.8.8', '8.8.4.4']);

export async function connectDB() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error('Falta la variable de entorno MONGO_URI');
    return;
  }
  try {
    await mongoose.connect(uri);
    console.log('Conectado a MongoDB');
  } catch (err) {
    console.error('Error de conexión a MongoDB:', err.message);
  }
}
