#!/bin/bash

# Backend Health Check Script
# This script checks if the backend server is running and healthy

set -e

BACKEND_URL="http://localhost:3000"
API_URL="$BACKEND_URL/api/v1"
HEALTH_ENDPOINT="$API_URL/health"

echo "🔍 Checking backend health..."
echo "Backend URL: $BACKEND_URL"
echo "API URL: $API_URL"
echo "Health Endpoint: $HEALTH_ENDPOINT"
echo ""

# Function to check if backend is running
check_backend() {
    echo "⏳ Testing connection to backend..."
    
    # Check if port 3000 is open
    if ! nc -z localhost 3000 2>/dev/null; then
        echo "❌ Backend server is not running on port 3000"
        echo "💡 To start the backend:"
        echo "   cd backend && npm run start:dev"
        return 1
    fi
    
    echo "✅ Backend server is running on port 3000"
    
    # Check health endpoint
    echo "⏳ Checking health endpoint..."
    
    HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$HEALTH_ENDPOINT" || echo "000")
    
    if [[ "$HTTP_STATUS" == "200" ]]; then
        echo "✅ Health endpoint is responding (HTTP $HTTP_STATUS)"
        
        # Get health response
        HEALTH_RESPONSE=$(curl -s "$HEALTH_ENDPOINT" || echo "{}")
        echo "📊 Health Response: $HEALTH_RESPONSE"
        
        return 0
    else
        echo "❌ Health endpoint failed (HTTP $HTTP_STATUS)"
        return 1
    fi
}

# Function to check venues endpoint
check_venues() {
    echo "⏳ Testing venues endpoint..."
    
    HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/venues" || echo "000")
    
    if [[ "$HTTP_STATUS" == "200" ]]; then
        echo "✅ Venues endpoint is working (HTTP $HTTP_STATUS)"
        return 0
    else
        echo "⚠️  Venues endpoint returned HTTP $HTTP_STATUS"
        if [[ "$HTTP_STATUS" == "000" ]]; then
            echo "💡 This might be a connection error"
        fi
        return 1
    fi
}

# Function to test CORS
check_cors() {
    echo "⏳ Testing CORS configuration..."
    
    CORS_RESPONSE=$(curl -s -I -X OPTIONS "$API_URL/venues" \
        -H "Origin: http://localhost:3001" \
        -H "Access-Control-Request-Method: GET" \
        -H "Access-Control-Request-Headers: Content-Type" || echo "")
    
    if echo "$CORS_RESPONSE" | grep -q "Access-Control-Allow-Origin"; then
        echo "✅ CORS is configured"
        return 0
    else
        echo "⚠️  CORS might not be properly configured"
        echo "💡 Check backend CORS settings"
        return 1
    fi
}

# Main execution
main() {
    echo "🚀 Hall Booking App - Backend Health Check"
    echo "==========================================="
    echo ""
    
    local all_good=true
    
    # Check backend
    if ! check_backend; then
        all_good=false
    fi
    echo ""
    
    # Check venues endpoint if backend is running
    if nc -z localhost 3000 2>/dev/null; then
        if ! check_venues; then
            all_good=false
        fi
        echo ""
        
        if ! check_cors; then
            all_good=false
        fi
        echo ""
    fi
    
    # Summary
    echo "📋 Summary"
    echo "=========="
    
    if [[ "$all_good" == "true" ]]; then
        echo "✅ All checks passed! Backend is healthy."
        echo "🎉 Frontend should be able to connect successfully."
        echo ""
        echo "🌐 You can now start the frontend:"
        echo "   cd frontend && npm run dev"
        return 0
    else
        echo "❌ Some checks failed. Please address the issues above."
        echo ""
        echo "🔧 Common solutions:"
        echo "   1. Start the backend: cd backend && npm run start:dev"
        echo "   2. Check backend logs for errors"
        echo "   3. Verify database connection"
        echo "   4. Check environment variables"
        echo "   5. Ensure all dependencies are installed: npm install"
        return 1
    fi
}

# Run main function
main "$@"