const axios = require('axios');
const cheerio = require('cheerio');

// El caché sigue siendo una buena idea.
const cache = {};

// Esta es la forma nativa en que Vercel maneja las funciones serverless.
module.exports = async (req, res) => {
    // 1. Solo permitir peticiones GET
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { puerto } = req.query;
    if (!puerto) {
        return res.status(400).json({ error: 'El parámetro "puerto" es requerido.' });
    }

    const hoy = new Date().toISOString().split('T')[0];
    const cacheKey = `${puerto}-${hoy}`;

    if (cache[cacheKey]) {
        console.log(`[Cache] Devolviendo datos para ${puerto}`);
        return res.status(200).json(cache[cacheKey]);
    }

    try {
        const SHOA_URL = `https://www.shoa.cl/nuestros-servicios/tablas-de-marea/${puerto}`;
        
        const { data: html } = await axios.get(SHOA_URL, {
            headers: { 'User-Agent': 'MiAppDePesca/1.0' }
        });

        const $ = cheerio.load(html);
        const mareas = [];
        const selectorTabla = 'table.table-bordered';
        
        $(selectorTabla).find('tbody tr').each((i, fila) => {
            const celdas = $(fila).find('td');
            if (celdas.length >= 3) {
                const tipo = $(celdas[0]).text().trim();
                const hora = $(celdas[1]).text().trim();
                const altura = $(celdas[2]).text().trim();
                
                mareas.push({
                    tipo: tipo.toLowerCase().includes('baja') ? 'Bajamar' : 'Pleamar',
                    hora,
                    altura
                });
            }
        });

        if (mareas.length === 0) {
            throw new Error(`No se encontraron mareas para el selector '${selectorTabla}'.`);
        }

        const respuesta = { fuente: 'SHOA', puerto, fecha: hoy, mareas };
        cache[cacheKey] = respuesta;
        console.log(`[API] Nuevos datos para ${puerto} guardados en caché.`);

        // Enviamos la respuesta exitosa
        return res.status(200).json(respuesta);

    } catch (error) {
        console.error(error.message);
        return res.status(500).json({ error: 'No se pudieron obtener los datos de las mareas.', detalle: error.message });
    }
};