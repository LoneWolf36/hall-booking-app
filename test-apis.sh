#!/bin/bash

# Test script for hall-booking-app backend APIs
# Run after: cd backend && npm run start:dev

API_URL="http://localhost:3000/api/v1"

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== Hall Booking App - API Integration Tests ===${NC}\n"

# Test 1: Health check
echo -e "${YELLOW}Test 1: Health Check${NC}"
curl -s "${API_URL}/health" | jq '.' || echo -e "${RED}Failed to reach backend${NC}"
echo ""

# Test 2: Get venues
echo -e "${YELLOW}Test 2: List Venues${NC}"
curl -s "${API_URL}/venues" -H "Authorization: Bearer test-token" | jq '.data[0]' || echo -e "${RED}Failed${NC}"
echo ""

# Test 3: Get venue pricing
echo -e "${YELLOW}Test 3: Get Venue Pricing (requires venue ID)${NC}"
VENUE_ID=$(curl -s "${API_URL}/venues?limit=1" -H "Authorization: Bearer test-token" | jq -r '.data[0].id' 2>/dev/null)
if [ ! -z "$VENUE_ID" ] && [ "$VENUE_ID" != "null" ]; then
  echo "Found venue: $VENUE_ID"
  curl -s "${API_URL}/venues/${VENUE_ID}/pricing" -H "Authorization: Bearer test-token" | jq '.' || echo -e "${RED}Failed${NC}"
else
  echo -e "${YELLOW}Skipped: No venues found${NC}"
fi
echo ""

# Test 4: Calculate pricing
echo -e "${YELLOW}Test 4: Calculate Pricing${NC}"
curl -s -X POST "${API_URL}/venues/calculate-pricing" \
  -H "Authorization: Bearer test-token" \
  -H "Content-Type: application/json" \
  -d '{
    "venueId": "test-venue-id",
    "selectedDates": ["2025-11-05", "2025-11-06"],
    "guestCount": 100,
    "eventType": "wedding"
  }' | jq '.' || echo -e "${RED}Failed${NC}"
echo ""

# Test 5: Database connectivity
echo -e "${YELLOW}Test 5: Check Database Connection${NC}"
echo "Note: If backend is running, database should be connected"
curl -s "${API_URL}/health" | jq '.data.database' || echo -e "${RED}Database check unavailable${NC}"
echo ""

echo -e "${BLUE}=== Tests Complete ===${NC}"
echo -e "${YELLOW}To test booking creation, you need:${NC}"
echo "1. Valid JWT token (get from auth/login endpoint)"
echo "2. Valid venue ID from database"
echo "3. Idempotency key (uuid format)"
