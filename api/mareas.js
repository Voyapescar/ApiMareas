const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const app = express();

// Caché en memoria para ser respetuosos con el servidor del SHOA.
const cache = {};

app.get('/api/mareas', async (req, res) => {
    // El puerto se pasará como parámetro, ej: /api/mareas?puerto=valparaiso
    const { puerto } = req.query;
    if (!puerto) {
        return res.status(400).json({ error: 'El parámetro "puerto" es requerido.' });
    }

    const hoy = new Date().toISOString().split('T')[0];
    const cacheKey = `${puerto}-${hoy}`;

    // Si ya tenemos los datos de hoy para este puerto, los devolvemos desde el caché.
    if (cache[cacheKey]) {
        console.log(`[Cache] Devolviendo datos para ${puerto}`);
        return res.json(cache[cacheKey]);
    }

    try {
        // Debes encontrar la URL correcta para cada puerto en el sitio del SHOA.
        const SHOA_URL = `https://www.shoa.cl/nuestros-servicios/tablas-de-marea/${puerto}`;
        
        const { data: html } = await axios.get(SHOA_URL, {
            headers: { 'User-Agent': 'MiAppDePesca/1.0 (+http://mi-app.com)' }
        });

        const $ = cheerio.load(html);
        const mareas = [];

        // IMPORTANTE: Este es el paso clave.
        // 1. Ve al sitio del SHOA en tu navegador.
        // 2. Haz clic derecho sobre la tabla de mareas y selecciona "Inspeccionar".
        // 3. Busca el selector único de la tabla (ej: 'table.table-bordered').
        // 4. Reemplaza el selector de abajo con el que encontraste.
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
            throw new Error(`No se encontraron mareas para el selector '${selectorTabla}'. Revisa si el selector es correcto o si la estructura de la página del SHOA cambió.`);
        }

        const respuesta = { fuente: 'SHOA', puerto, fecha: hoy, mareas };

        // Guardamos la respuesta en el caché antes de enviarla.
        cache[cacheKey] = respuesta;
        console.log(`[API] Nuevos datos para ${puerto} guardados en caché.`);

        return res.json(respuesta);

    } catch (error) {
        console.error(error.message);
        return res.status(500).json({ error: 'No se pudieron obtener los datos de las mareas.', detalle: error.message });
    }
});

module.exports = app;