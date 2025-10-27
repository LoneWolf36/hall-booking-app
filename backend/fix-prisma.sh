#!/bin/bash

# Fix Prisma Client Initialization with Custom Output Path
# This script resolves the "@prisma/client did not initialize yet" error
# when using a custom generator output path

echo "🔧 Fixing Prisma Client with Custom Output Path..."

# Stop any running servers
echo "⏹️  Stopping any running servers..."
pkill -f "nest start" 2>/dev/null || true
pkill -f "node dist/main" 2>/dev/null || true

# Navigate to backend directory
cd "$(dirname "$0")"

# Clean up existing generated files
echo "🧹 Cleaning up existing generated files..."
rm -rf ../generated/prisma 2>/dev/null || true
rm -rf node_modules/.prisma 2>/dev/null || true

# Regenerate Prisma client with custom output
echo "⚙️  Regenerating Prisma client..."
npx prisma generate

# Verify the generated client exists
if [ -d "../generated/prisma" ]; then
    echo "✅ Prisma client generated successfully at ../generated/prisma"
    echo "📁 Generated files:"
    ls -la ../generated/prisma/
else
    echo "❌ Prisma client generation failed!"
    echo "💡 Make sure your schema.prisma has:"
    echo "   generator client {"
    echo "     provider = \"prisma-client-js\""
    echo "     output   = \"../generated/prisma\""
    echo "   }"
    exit 1
fi

# Verify TypeScript path mapping
echo "🔍 Checking TypeScript configuration..."
if grep -q '"@prisma/client".*"../generated/prisma"' tsconfig.json; then
    echo "✅ TypeScript path mapping configured correctly"
else
    echo "⚠️  TypeScript path mapping might be missing"
    echo "💡 Ensure tsconfig.json has:"
    echo '   "paths": {'
    echo '     "@prisma/client": ["../generated/prisma"]'
    echo '   }'
fi

# Build the application
echo "🏗️  Building application..."
npm run build

if [ $? -eq 0 ]; then
    echo "✅ Build completed successfully"
    echo "🚀 You can now start the server with: npm run start:dev"
    echo ""
    echo "📋 Quick verification steps:"
    echo "   1. Start server: npm run start:dev"
    echo "   2. Check health: curl http://localhost:3000/api/v1/health"
    echo "   3. Look for: ✅ Database connection established"
else
    echo "❌ Build failed!"
    echo "💡 Check the error messages above and fix any TypeScript errors"
    exit 1
fi

echo ""
echo "🎉 Prisma client fix completed!"
echo "💡 If you still see the error, restart your IDE/editor and try again"
