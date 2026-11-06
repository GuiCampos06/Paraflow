import mongoose from 'mongoose';

const dispositivoSchema = new mongoose.Schema(
  {
    deviceId: { type: String, required: true, unique: true, trim: true },
    nome: { type: String, default: 'Separador de parafusos' },
    ligado: { type: Boolean, default: true },
    online: { type: Boolean, default: false },
    ultimoContato: { type: Date },
  },
  { timestamps: true }
);

export const Dispositivo = mongoose.model('Dispositivo', dispositivoSchema);
