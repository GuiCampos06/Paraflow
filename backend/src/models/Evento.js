import mongoose from 'mongoose';

/** Uma peça processada pelo separador (válida ou rejeitada). */
const eventoSchema = new mongoose.Schema(
  {
    deviceId: { type: String, required: true, index: true },
    comprimentoMm: { type: Number, required: true },
    bitola: { type: String, default: null }, // ex.: "M3" (null quando inválida)
    peso: { type: Number, required: true },
    valido: { type: Boolean, required: true },
    ocorridoEm: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

eventoSchema.index({ ocorridoEm: -1 });
eventoSchema.index({ valido: 1, comprimentoMm: 1, bitola: 1 });

export const Evento = mongoose.model('Evento', eventoSchema);
