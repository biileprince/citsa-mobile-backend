const https = require('https');

async function getCurrentIP() {
  console.log('🔍 Checking your current IP addresses...\n');
  
  // Check IPv4
  return new Promise((resolve) => {
    https.get('https://api.ipify.org?format=json', (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const ipv4 = JSON.parse(data).ip;
          console.log('📍 Your IPv4 Address:', ipv4);
          console.log('   → Add this to Remote MySQL in your hosting panel\n');
          
          // Check IPv6
          https.get('https://api64.ipify.org?format=json', (res2) => {
            let data2 = '';
            res2.on('data', chunk => data2 += chunk);
            res2.on('end', () => {
              try {
                const ipv6 = JSON.parse(data2).ip;
                if (ipv6 !== ipv4) {
                  console.log('📍 Your IPv6 Address:', ipv6);
                  console.log('   → Also add this if using IPv6\n');
                }
              } catch (e) {
                // IPv6 might not be available
              }
              resolve(ipv4);
            });
          }).on('error', () => resolve(ipv4));
          
        } catch (e) {
          console.error('❌ Could not determine IP');
          resolve(null);
        }
      });
    }).on('error', (err) => {
      console.error('❌ Error checking IP:', err.message);
      resolve(null);
    });
  });
}

async function testConnection(ip) {
  console.log('━'.repeat(60));
  console.log('🧪 Testing Database Connection...\n');
  
  const mysql = require('mysql2/promise');
  
  try {
    const connection = await mysql.createConnection({
      host: 'sdb-58.hosting.stackcp.net',
      port: 3306,
      user: 'citsa_ucc_mobile',
      password: 'peSc!WQyquP3',
      database: 'citsa_ucc_Mobile-35303137feab',
      connectTimeout: 10000
    });

    console.log('✅ Database connection successful!\n');

    const [rows] = await connection.execute('SELECT VERSION() as version');
    console.log('📊 MySQL Version:', rows[0].version);

    const [tables] = await connection.execute('SHOW TABLES');
    console.log('📋 Tables in database:', tables.length);

    await connection.end();
    console.log('\n✅ Connection test passed!\n');
    return true;
    
  } catch (error) {
    console.error('❌ Connection failed:', error.message);
    console.error('━'.repeat(60));
    console.error('\n🔧 TROUBLESHOOTING:\n');
    
    if (error.code === 'ETIMEDOUT' || error.code === 'ECONNREFUSED') {
      console.error('❌ REMOTE ACCESS NOT CONFIGURED\n');
      console.error('Your current IP needs to be whitelisted!\n');
      console.error('STEPS TO FIX:');
      console.error('1. Go to: https://app.plugnom.com/');
      console.error('2. Navigate to: Database → Remote MySQL');
      console.error('3. Click "Add Access Host"');
      console.error('4. Add your IPv4 address:', ip || '[Check above]');
      console.error('5. Wait 30 minutes for changes to take effect\n');
      console.error('IMPORTANT: IP addresses in panel currently:');
      console.error('   - 2a09:bac5:38c3:26d2::3de:35 (IPv6)');
      console.error('   → You need to add your IPv4 address too!\n');
    } else if (error.code === 'ENOTFOUND') {
      console.error('❌ HOSTNAME NOT FOUND');
      console.error('   - Check: sdb-58.hosting.stackcp.net');
      console.error('   - Verify your internet connection\n');
    } else if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      console.error('❌ ACCESS DENIED');
      console.error('   - User: citsa_ucc_mobile');
      console.error('   - Database: citsa_ucc_Mobile-35303137feab');
      console.error('   - Verify credentials in hosting panel\n');
    }
    
    return false;
  }
}

async function main() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║     CITSA DATABASE CONNECTION DIAGNOSTICS                  ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');
  
  const ip = await getCurrentIP();
  const success = await testConnection(ip);
  
  if (!success) {
    console.log('━'.repeat(60));
    console.log('\n📝 SOLUTION FOR DYNAMIC IP ADDRESSES:\n');
    console.log('Your IP can change, which will break the connection.');
    console.log('Here are your options:\n');
    console.log('OPTION 1: Add Wildcard (DEVELOPMENT ONLY)');
    console.log('   - In Remote MySQL, add: %');
    console.log('   - This allows ANY IP (INSECURE - remove in production!)\n');
    console.log('OPTION 2: Use a VPN with Static IP');
    console.log('   - Get a VPN service with static IP');
    console.log('   - Whitelist the VPN IP\n');
    console.log('OPTION 3: Deploy to a Server with Static IP');
    console.log('   - Deploy your backend to a server (AWS, DigitalOcean, etc.)');
    console.log('   - Whitelist the server\'s IP\n');
    console.log('OPTION 4: SSH Tunnel (Advanced)');
    console.log('   - Connect via SSH if your hosting provides it');
    console.log('   - Tunnel MySQL through SSH\n');
    console.log('━'.repeat(60));
  }
  
  console.log('\n');
}

main();
