const { Client } = require('pg');
require('dotenv').config();

async function updateUrls() {
  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASS || 'sahil1903',
    database: process.env.DB_NAME || 'nagarkot_os',
  });

  try {
    await client.connect();
    console.log('Connected to pg database');

    // Update Trainings
    const res1 = await client.query(
      "UPDATE applications SET url = $1 WHERE slug = $2",
      ['http://192.168.1.23:5173', 'trainings']
    );
    console.log(`Updated Trainings URL: ${res1.rowCount} rows changed`);

    // Update OS Dashboard if exists
    const res2 = await client.query(
      "UPDATE applications SET url = $1 WHERE slug = $2",
      ['http://192.168.1.23:3000', 'os-dashboard']
    );
    console.log(`Updated OS Dashboard URL: ${res2.rowCount} rows changed`);

    console.log('Database update complete');
  } catch (err) {
    console.error('Error updating database:', err);
  } finally {
    await client.end();
  }
}

updateUrls();
