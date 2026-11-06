/**
 * Simula o ESP32 publicando peças no MQTT (sem hardware).
 * Uso:  npm run simular            → 1 peça por segundo, até Ctrl+C
 *       npm run simular -- 20 300  → 20 peças, a cada 300 ms
 */
import 'dotenv/config';
import mqtt from 'mqtt';

const url = process.env.MQTT_URL;
if (!url) {
  console.error('Defina MQTT_URL no .env');
  process.exit(1);
}
const prefixo = process.env.MQTT_TOPIC_PREFIX || 'paraflow';
const deviceId = process.env.DEFAULT_DEVICE_ID || 'esp32-01';
const total = Number(process.argv[2]) || Infinity;
const intervalo = Number(process.argv[3]) || 1000;

const comprimentos = [5, 10, 15, 20];
const bitolas = { M2: 0.3, M3: 0.55, M4: 0.85 }; // peso base em 5 mm
const escolher = (a) => a[Math.floor(Math.random() * a.length)];

const client = mqtt.connect(url, { username: process.env.MQTT_USERNAME, password: process.env.MQTT_PASSWORD });

client.on('connect', () => {
  console.log(`Simulando ${deviceId} em ${url}`);
  client.publish(`${prefixo}/${deviceId}/status`, JSON.stringify({ online: true, ligado: true }), { retain: true });

  let n = 0;
  const t = setInterval(() => {
    const comp = escolher(comprimentos);
    const bitola = escolher(Object.keys(bitolas));
    const valido = Math.random() > 0.1; // ~10% rejeitadas
    const peso = valido ? +(bitolas[bitola] * (comp / 5) * (1 + (Math.random() - 0.5) * 0.1)).toFixed(2) : 9.9;
    const payload = { comp, bitola: valido ? bitola : null, peso, valido };
    client.publish(`${prefixo}/${deviceId}/evento`, JSON.stringify(payload));
    console.log(++n, payload);
    if (n >= total) {
      clearInterval(t);
      client.end();
    }
  }, intervalo);
});

client.on('error', (e) => console.error('MQTT:', e.message));
