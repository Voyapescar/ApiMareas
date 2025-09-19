import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import axios from 'axios';

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
const stormglassApiKey = process.env.STORMGLASS_API_KEY;

if (!getApps().length) {
  initializeApp({
    credential: cert(serviceAccount)
  });
}
const db = getFirestore();

export default async function handler(req, res) {
  console.log("Iniciando trabajo programado: Actualización de mareas...");
  try {
    const zonasSnapshot = await db.collection('zonasMarea').get();
    const zonas = zonasSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    const updatePromises = zonas.slice(0, 9).map(async (zona) => {
      const { id, lat, lng } = zona;
      console.log(`Obteniendo marea para la zona: ${id}`);
      
      const response = await axios.get(
        `https://api.stormglass.io/v2/tide/extremes/point?lat=${lat}&lng=${lng}`,
        { headers: { 'Authorization': stormglassApiKey } }
      );
      
      const mareasDelDia = response.data.data;
      const docRef = db.collection('mareasDiarias').doc(id);
      
      await docRef.set({
        mareas: mareasDelDia,
        ultimaActualizacion: new Date()
      });
    });

    await Promise.all(updatePromises);
    console.log("Trabajo programado completado exitosamente.");
    res.status(200).send('Actualización de mareas completada exitosamente.');

  } catch (error) {
    console.error("Error en el trabajo programado:", error.response ? error.response.data : error.message);
    res.status(500).send('Ocurrió un error durante la actualización de mareas.');
  }
}