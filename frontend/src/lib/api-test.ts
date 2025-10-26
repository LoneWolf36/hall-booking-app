/**
 * Simple test file to verify that the API imports and exports work correctly
 * This file can be removed after verifying the fix
 */

import { api } from './api';

// Test that api.get exists and is a function
const testApiGetExists = () => {
  console.log('Testing api.get existence...');
  console.log('typeof api:', typeof api);
  console.log('typeof api.get:', typeof api.get);
  
  if (typeof api.get !== 'function') {
    throw new Error('api.get is not a function');
  }
  
  console.log('✅ api.get is available and is a function');
  return true;
};

// Test that all expected API methods exist
const testApiMethodsExist = () => {
  const expectedMethods = [
    'get', 'post', 'patch', 'put', 'delete',
    'getVenues', 'getVenue', 'getBookings', 'getBooking',
    'createBooking', 'updateBooking', 'healthCheck'
  ];
  
  const missingMethods: string[] = [];
  
  expectedMethods.forEach(method => {
    if (typeof (api as any)[method] !== 'function') {
      missingMethods.push(method);
    }
  });
  
  if (missingMethods.length > 0) {
    throw new Error(`Missing API methods: ${missingMethods.join(', ')}`);
  }
  
  console.log('✅ All expected API methods are available');
  return true;
};

// Export test functions for use in components or other files
export { testApiGetExists, testApiMethodsExist };

// Auto-run tests when this file is imported (can be removed later)
if (typeof window !== 'undefined') {
  try {
    testApiGetExists();
    testApiMethodsExist();
    console.log('🎉 All API tests passed!');
  } catch (error) {
    console.error('❌ API test failed:', error);
  }
}
