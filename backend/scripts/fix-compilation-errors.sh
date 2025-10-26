#!/bin/bash

# Compilation Error Fix Script
# Run this script from the backend directory

echo "🔧 Starting compilation error fixes..."

# Step 1: Regenerate Prisma Client
echo "📦 Regenerating Prisma client..."
npx prisma generate

# Step 2: Fix cache service method calls
echo "🔄 Fixing cache service method calls..."

# Replace cacheService.del with cacheService.delete in payments.service.ts
sed -i.bak 's/cacheService\.del(/cacheService.delete(/g' src/payments/payments.service.ts

# Replace cacheService.del with cacheService.delete in flexible-payment.service.ts
sed -i.bak 's/cacheService\.del(/cacheService.delete(/g' src/payments/services/flexible-payment.service.ts

echo "✅ Cache service method calls fixed"

# Step 3: Run type check to verify fixes
echo "🔍 Running type check..."
npm run type-check

if [ $? -eq 0 ]; then
    echo "✅ All compilation errors fixed successfully!"
else
    echo "❌ Some errors remain. Please check the manual fixes needed."
fi

echo "🎉 Script completed. Check the manual fixes documentation for remaining issues."