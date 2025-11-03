#!/usr/bin/env node
/**
 * Database Fix Script
 * Fixes the Prisma migration error and sets up the database properly
 */

const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

async function runCommand(command, description) {
  console.log(`\n🔄 ${description}...`);
  console.log(`   Command: ${command}`);
  
  try {
    const { stdout, stderr } = await execAsync(command, { cwd: __dirname });
    
    if (stdout) {
      console.log(`✅ ${description} completed`);
      if (stdout.trim()) {
        console.log(`   Output: ${stdout.trim().split('\n').slice(-3).join('\n   ')}`);
      }
    }
    
    if (stderr && !stderr.includes('warn')) {
      console.log(`⚠️  Warnings: ${stderr}`);
    }
    
    return true;
  } catch (error) {
    console.error(`❌ ${description} failed:`);
    console.error(`   Error: ${error.message}`);
    return false;
  }
}

async function checkPrerequisites() {
  console.log('🔍 Checking prerequisites...');
  
  // Check if .env exists
  const fs = require('fs');
  if (!fs.existsSync('.env')) {
    console.log('⚠️  .env file not found. Creating from .env.example...');
    if (fs.existsSync('.env.example')) {
      fs.copyFileSync('.env.example', '.env');
      console.log('✅ .env file created. Please update with your database credentials.');
      console.log('   You need to set DATABASE_URL to your Supabase connection string.');
      return false;
    } else {
      console.error('❌ .env.example file not found. Please create .env manually.');
      return false;
    }
  }
  
  return true;
}

async function fixDatabase() {
  console.log('🚀 Starting database fix process...');
  
  // Check prerequisites
  const prereqsOk = await checkPrerequisites();
  if (!prereqsOk) {
    console.log('\n⏸️  Please update your .env file and run this script again.');
    return;
  }
  
  const steps = [
    {
      command: 'npm install',
      description: 'Installing dependencies',
    },
    {
      command: 'npx prisma migrate reset --force',
      description: 'Resetting database and clearing migrations',
    },
    {
      command: 'npx prisma db push',
      description: 'Pushing schema to database',
    },
    {
      command: 'npx prisma generate',
      description: 'Generating Prisma client',
    }
  ];
  
  let allSuccessful = true;
  
  for (const step of steps) {
    const success = await runCommand(step.command, step.description);
    if (!success) {
      allSuccessful = false;
      break;
    }
  }
  
  if (allSuccessful) {
    console.log('\n🎉 Database fix completed successfully!');
    console.log('\nNext steps:');
    console.log('1. Run: npm run db:seed (optional - adds sample data)');
    console.log('2. Run: npm run start:dev (starts the backend server)');
    console.log('3. Frontend should now connect successfully!');
    
    // Try to seed the database
    console.log('\n🌱 Attempting to seed database with sample data...');
    const seedSuccess = await runCommand('npm run db:seed', 'Seeding database');
    
    if (seedSuccess) {
      console.log('\n✅ Sample data added successfully!');
    } else {
      console.log('\n⚠️  Seeding failed, but database is ready. You can add data manually.');
    }
  } else {
    console.log('\n❌ Database fix failed. Please check the errors above.');
    console.log('\nCommon issues:');
    console.log('- DATABASE_URL not set correctly in .env');
    console.log('- Database server not accessible');
    console.log('- PostgreSQL version compatibility issues');
  }
}

// Run the fix
fixDatabase().catch(console.error);