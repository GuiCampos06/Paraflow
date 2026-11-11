// apaga o banco inteiro (só para desenvolvimento)
// uso: npm run resetar-banco -- --sim
import 'dotenv/config';
import mongoose from 'mongoose';

if (!process.argv.includes('--sim')) {
  console.log('Isto APAGA todo o banco. Para confirmar, rode:  npm run resetar-banco -- --sim');
  process.exit(0);
}

await mongoose.connect(process.env.MONGO_URI);
const nome = mongoose.connection.name;
await mongoose.connection.dropDatabase();
console.log(`[banco] "${nome}" apagado.`);
await mongoose.disconnect();
