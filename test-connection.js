// Test Supabase Connection
// Run with: node test-connection.js

require('dotenv').config({ path: '.env.local' });
const postgres = require('postgres');

async function testConnection() {
  console.log('🔄 Testing Supabase connection...\n');
  
  const connectionString = process.env.DATABASE_URL;
  
  if (!connectionString) {
    console.error('❌ DATABASE_URL not found in .env.local');
    process.exit(1);
  }
  
  console.log('📡 Connecting to:', connectionString.replace(/:[^:@]+@/, ':****@'));
  
  try {
    const sql = postgres(connectionString, { max: 1 });
    
    // Test query
    const result = await sql`SELECT version(), current_database(), current_user`;
    
    console.log('\n✅ Connection successful!\n');
    console.log('Database:', result[0].current_database);
    console.log('User:', result[0].current_user);
    console.log('PostgreSQL Version:', result[0].version.split(' ')[0] + ' ' + result[0].version.split(' ')[1]);
    
    // Check if tables exist
    const tables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('suppliers', 'price_rules', 'products', 'carts', 'cart_items', 'orders', 'order_items')
      ORDER BY table_name
    `;
    
    console.log('\n📊 Tables found:', tables.length === 7 ? '✅ All 7 tables' : `⚠️  ${tables.length}/7 tables`);
    tables.forEach(t => console.log('  -', t.table_name));
    
    if (tables.length < 7) {
      console.log('\n⚠️  Missing tables! Run the SQL script from supabase-schema.sql');
      console.log('   Or run: npm run db:push');
    } else {
      console.log('\n🎉 Database is fully configured and ready!');
    }
    
    await sql.end();
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ Connection failed:', error.message);
    console.log('\n💡 Possible reasons:');
    console.log('   1. Supabase project is paused - Go unpause it in dashboard');
    console.log('   2. Wrong credentials - Check .env.local');
    console.log('   3. Network/firewall issue');
    console.log('\n📖 See SUPABASE_SETUP.md for detailed instructions');
    process.exit(1);
  }
}

testConnection();

