const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const path = require('path');


const app = express();
const port = 3000; // Your server will listen on http://localhost:3000

// 1. Configure the connection to your local PostGIS database
const pool = new Pool({
    host: 'localhost',
    database: 'camden', 
    user: 'camden',
    port: 5432,
    password: '' // Postgres.app has no password by default
});

// 2. Enable CORS so your frontend map can securely request data from this server
app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
});
app.use(express.static('.'));
app.use('/reports', express.static(path.join(__dirname, 'reports')));
app.use('/about-images', express.static(path.join(__dirname, 'about-images')));

// GET endpoint to fetch all adventure pins formatted as clean GeoJSON
app.get('/api/pins', async (req, res) => {
    try {
        const queryText = `
            SELECT 
                ogc_fid,
                name,
                to_char(date_completed, 'YYYY-MM-DD') as date_completed,
                climbing_class,
                yds_grade,
                wilderness_score,
                character_score,
                beauty_score,
                distance_miles,
                elevation_gain_ft,
                min_duration_hours,
                max_duration_hours,
                route_type,
                ST_AsGeoJSON(geom)::json as geometry
            FROM adventure_pins;
        `;

        const result = await pool.query(queryText);

        // Map the flat SQL rows directly into structured GeoJSON Features
        const features = result.rows.map(row => ({
            type: 'Feature',
            geometry: row.geometry,
            properties: {
                id: row.ogc_fid,
                name: row.name,
                dateCompleted: row.date_completed,
                climbingClass: row.climbing_class,
                ydsGrade: row.yds_grade,
                wildernessScore: row.wilderness_score,
                characterScore: row.character_score,
                beautyScore: row.beauty_score,
                distanceMiles: parseFloat(row.distance_miles), // Keeps numeric format clean
                elevationGainFt: row.elevation_gain_ft,
                estHoursMin: row.min_duration_hours,
                estHoursMax: row.max_duration_hours,
                routeType: row.route_type
            }
        }));

        // Send out the complete GeoJSON Feature Collection
        res.json({
            type: 'FeatureCollection',
            features: features
        });

    } catch (error) {
        console.error('Error fetching spatial pins from PostGIS:', error);
        res.status(500).json({ error: 'Database pipeline hiccup' });
    }
});

// New Endpoint: Fetch a single adventure pin by its ID
app.get('/api/pins/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const queryText = `
            SELECT 
                ogc_fid, name,
                to_char(date_completed, 'YYYY-MM-DD') as date_completed,
                climbing_class, yds_grade, route_type,
                wilderness_score, character_score, beauty_score,
                distance_miles, elevation_gain_ft, 
                min_duration_hours, max_duration_hours, report_file, summits
            FROM adventure_pins
            WHERE ogc_fid = $1;
        `;
        
        const result = await pool.query(queryText, [id]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Adventure not found" });
        }
        
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error fetching single pin:', error);
        res.status(500).json({ error: 'Database pipeline hiccup' });
    }
});

// 4. Start the server engine and keep it running
app.listen(port, () => {
    console.log(`🚀 Adventure backend API is awake and running at http://localhost:${port}/api/pins`);
});