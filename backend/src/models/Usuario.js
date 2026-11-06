import mongoose from 'mongoose';

const usuarioSchema = new mongoose.Schema(
  {
    nome: { type: String, required: true, trim: true, maxlength: 100 },
    usuario: { type: String, required: true, unique: true, lowercase: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    senhaHash: { type: String, required: true, select: false },
    papel: { type: String, enum: ['admin', 'operador'], default: 'operador' },
  },
  { timestamps: true }
);

usuarioSchema.methods.paraJSON = function () {
  return { id: this._id.toString(), nome: this.nome, usuario: this.usuario, email: this.email, papel: this.papel };
};

export const Usuario = mongoose.model('Usuario', usuarioSchema);
