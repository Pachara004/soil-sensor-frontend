const { Pool } = require('pg');

// Database configuration
const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'soil_sensor_db',
    password: '123456',
    port: 5432,
});

async function testDatabase() {
    try {
        console.log('🔍 Testing database connection...');

        // Test connection
        const client = await pool.connect();
        console.log('✅ Database connected successfully!');

        // Check if tables exist
        console.log('\n🔍 Checking tables...');
        const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('areas', 'measurement', 'device', 'users')
      ORDER BY table_name;
    `);

        console.log('📊 Available tables:');
        tablesResult.rows.forEach(row => {
            console.log(`  - ${row.table_name}`);
        });

        // Check areas table structure
        console.log('\n🔍 Checking areas table structure...');
        const areasStructure = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'areas' 
      ORDER BY ordinal_position;
    `);

        console.log('📊 Areas table columns:');
        areasStructure.rows.forEach(row => {
            console.log(`  - ${row.column_name}: ${row.data_type} (${row.is_nullable === 'YES' ? 'nullable' : 'not null'})`);
        });

        // Check measurement table structure
        console.log('\n🔍 Checking measurement table structure...');
        const measurementStructure = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'measurement' 
      ORDER BY ordinal_position;
    `);

        console.log('📊 Measurement table columns:');
        measurementStructure.rows.forEach(row => {
            console.log(`  - ${row.column_name}: ${row.data_type} (${row.is_nullable === 'YES' ? 'nullable' : 'not null'})`);
        });

        // Check existing data
        console.log('\n🔍 Checking existing data...');

        const areasCount = await client.query('SELECT COUNT(*) FROM areas');
        console.log(`📊 Areas count: ${areasCount.rows[0].count}`);

        const measurementCount = await client.query('SELECT COUNT(*) FROM measurement');
        console.log(`📊 Measurements count: ${measurementCount.rows[0].count}`);

        const deviceCount = await client.query('SELECT COUNT(*) FROM device');
        console.log(`📊 Devices count: ${deviceCount.rows[0].count}`);

        const usersCount = await client.query('SELECT COUNT(*) FROM users');
        console.log(`📊 Users count: ${usersCount.rows[0].count}`);

        // If no data, create test data
        if (areasCount.rows[0].count === '0' || measurementCount.rows[0].count === '0') {
            console.log('\n🔧 Creating test data...');

            // Create test user
            console.log('  - Creating test user...');
            const userResult = await client.query(`
        INSERT INTO users (user_name, user_email, user_phone, created_at)
        VALUES ($1, $2, $3, NOW())
        ON CONFLICT (user_email) DO NOTHING
        RETURNING userid;
      `, ['Test User', 'test@example.com', '0123456789']);

            let userId = userResult.rows[0]?.userid;
            if (!userId) {
                const existingUser = await client.query('SELECT userid FROM users WHERE user_email = $1', ['test@example.com']);
                userId = existingUser.rows[0].userid;
            }
            console.log(`  ✅ User created/found with ID: ${userId}`);

            // Create test device
            console.log('  - Creating test device...');
            const deviceResult = await client.query(`
        INSERT INTO device (device_name, device_id, userid, created_at)
        VALUES ($1, $2, $3, NOW())
        ON CONFLICT (device_id) DO NOTHING
        RETURNING deviceid;
      `, ['Test Device', 'TEST001', userId]);

            let deviceId = deviceResult.rows[0]?.deviceid;
            if (!deviceId) {
                const existingDevice = await client.query('SELECT deviceid FROM device WHERE device_id = $1', ['TEST001']);
                deviceId = existingDevice.rows[0].deviceid;
            }
            console.log(`  ✅ Device created/found with ID: ${deviceId}`);

            // Create test area
            console.log('  - Creating test area...');
            const areaResult = await client.query(`
        INSERT INTO areas (area_name, temperature_avg, moisture_avg, ph_avg, phosphorus_avg, potassium_avg, nitrogen_avg, totalmeasurement, userid, deviceid, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
        RETURNING areasid;
      `, ['Test Area', 0, 0, 0, 0, 0, 0, 0, userId, deviceId]);

            const areaId = areaResult.rows[0].areasid;
            console.log(`  ✅ Area created with ID: ${areaId}`);

            // Create test measurements with smaller values to avoid overflow
            console.log('  - Creating test measurements...');
            const measurements = [
                { temp: 25.5, moisture: 65.2, ph: 6.8, phosphorus: 12.4, potassium: 18.6, nitrogen: 15.7 },
                { temp: 26.1, moisture: 64.8, ph: 6.9, phosphorus: 11.8, potassium: 19.2, nitrogen: 16.1 },
                { temp: 25.8, moisture: 65.0, ph: 6.7, phosphorus: 13.1, potassium: 17.9, nitrogen: 15.3 },
                { temp: 26.3, moisture: 64.5, ph: 6.6, phosphorus: 12.7, potassium: 18.8, nitrogen: 15.9 },
                { temp: 25.9, moisture: 65.3, ph: 6.8, phosphorus: 12.9, potassium: 18.2, nitrogen: 15.5 }
            ];

            for (let i = 0; i < measurements.length; i++) {
                const m = measurements[i];
                await client.query(`
          INSERT INTO measurement (
            deviceid, measurement_date, measurement_time, temperature, moisture, ph, 
            phosphorus, potassium_avg, nitrogen, lng, lat, areasid, is_epoch, is_uptime, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW())
        `, [
                    deviceId,
                    '2024-01-15',
                    '10:30:00',
                    m.temp,
                    m.moisture,
                    m.ph,
                    m.phosphorus,
                    m.potassium,
                    m.nitrogen,
                    103.25 + (i * 0.001), // Small longitude variation
                    16.24 + (i * 0.001),  // Small latitude variation
                    areaId,
                    false,
                    false
                ]);
            }

            console.log(`  ✅ Created ${measurements.length} test measurements`);

            // Test the calculate averages API
            console.log('\n🧮 Testing calculate averages API...');

            // Calculate averages manually
            const avgTemp = measurements.reduce((sum, m) => sum + m.temp, 0) / measurements.length;
            const avgMoisture = measurements.reduce((sum, m) => sum + m.moisture, 0) / measurements.length;
            const avgPh = measurements.reduce((sum, m) => sum + m.ph, 0) / measurements.length;
            const avgPhosphorus = measurements.reduce((sum, m) => sum + m.phosphorus, 0) / measurements.length;
            const avgPotassium = measurements.reduce((sum, m) => sum + m.potassium, 0) / measurements.length;
            const avgNitrogen = measurements.reduce((sum, m) => sum + m.nitrogen, 0) / measurements.length;

            console.log('📊 Expected averages:');
            console.log(`  - Temperature: ${avgTemp.toFixed(2)}°C`);
            console.log(`  - Moisture: ${avgMoisture.toFixed(2)}%`);
            console.log(`  - pH: ${avgPh.toFixed(2)}`);
            console.log(`  - Phosphorus: ${avgPhosphorus.toFixed(2)}`);
            console.log(`  - Potassium: ${avgPotassium.toFixed(2)}`);
            console.log(`  - Nitrogen: ${avgNitrogen.toFixed(2)}`);

            // Update area with calculated averages
            await client.query(`
        UPDATE areas SET 
          temperature_avg = $1,
          moisture_avg = $2,
          ph_avg = $3,
          phosphorus_avg = $4,
          potassium_avg = $5,
          nitrogen_avg = $6,
          totalmeasurement = $7,
          textupdated = NOW()
        WHERE areasid = $8
      `, [
                avgTemp,
                avgMoisture,
                avgPh,
                avgPhosphorus,
                avgPotassium,
                avgNitrogen,
                measurements.length,
                areaId
            ]);

            console.log('✅ Area updated with calculated averages');

            // Verify the update
            const updatedArea = await client.query('SELECT * FROM areas WHERE areasid = $1', [areaId]);
            console.log('\n📊 Updated area data:');
            console.log(`  - Area ID: ${updatedArea.rows[0].areasid}`);
            console.log(`  - Area Name: ${updatedArea.rows[0].area_name}`);
            console.log(`  - Temperature Avg: ${updatedArea.rows[0].temperature_avg}`);
            console.log(`  - Moisture Avg: ${updatedArea.rows[0].moisture_avg}`);
            console.log(`  - pH Avg: ${updatedArea.rows[0].ph_avg}`);
            console.log(`  - Phosphorus Avg: ${updatedArea.rows[0].phosphorus_avg}`);
            console.log(`  - Potassium Avg: ${updatedArea.rows[0].potassium_avg}`);
            console.log(`  - Nitrogen Avg: ${updatedArea.rows[0].nitrogen_avg}`);
            console.log(`  - Total Measurements: ${updatedArea.rows[0].totalmeasurement}`);
        }

        client.release();
        console.log('\n✅ Database test completed successfully!');

    } catch (error) {
        console.error('❌ Database test failed:', error.message);
        console.error('Stack trace:', error.stack);
    } finally {
        await pool.end();
    }
}

// Run the test
testDatabase();
