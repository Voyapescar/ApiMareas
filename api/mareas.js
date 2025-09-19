const axios = require('axios');
const cheerio = require('cheerio');

const cache = {};

module.exports = async (req, res) => {
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
        return res.status(200).json(cache[cacheKey]);
    }

    try {
        const SHOA_URL = `https://www.shoa.cl/nuestros-servicios/tablas-de-marea/${puerto}`;
        
        // ¡ESTE ES EL CAMBIO IMPORTANTE!
        // Usamos un User-Agent que simula ser un navegador Chrome en Windows.
        const headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.36',
        };
        
        const { data: html } = await axios.get(SHOA_URL, { headers });

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
        
        return res.status(200).json(respuesta);

    } catch (error) {
        // En Vercel, podemos ver los logs de este console.error para más detalles.
        console.error(error); 
        return res.status(500).json({ error: 'No se pudieron obtener los datos de las mareas.', detalle: error.message });
    }
};