import { PrismaService } from '../../src/prisma/prisma.service';
import * as dotenv from 'dotenv';

// Load test environment variables
dotenv.config({ path: '.env.test' });

// Performance test configuration
jest.setTimeout(120000); // 2 minutes for performance tests

// Global performance metrics
global.performanceMetrics = {
  testResults: [],
  currentTest: null,
  startTime: null,
  concurrentUsers: parseInt(process.env.PERFORMANCE_TEST_CONCURRENCY || '10'),
  testDuration: parseInt(process.env.PERFORMANCE_TEST_DURATION || '30000'), // 30 seconds
  rampUpTime: parseInt(process.env.PERFORMANCE_TEST_RAMP_UP || '5000') // 5 seconds
};

// Setup performance monitoring
beforeAll(async () => {
  console.log('Setting up performance test environment...');
  
  // Ensure test environment is properly configured
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL must be set for performance tests');
  }
  
  // Set performance test environment variables
  process.env.NODE_ENV = 'test';
  process.env.LOG_LEVEL = 'error'; // Reduce logging overhead
  process.env.ENABLE_TEST_LOGS = 'false';
  
  console.log(`Performance test configuration:`);
  console.log(`- Concurrent users: ${global.performanceMetrics.concurrentUsers}`);
  console.log(`- Test duration: ${global.performanceMetrics.testDuration}ms`);
  console.log(`- Ramp-up time: ${global.performanceMetrics.rampUpTime}ms`);
});

// Before each performance test
beforeEach(() => {
  global.performanceMetrics.startTime = Date.now();
  
  // Clear any previous test results for this specific test
  if (global.performanceMetrics.currentTest) {
    global.performanceMetrics.testResults = global.performanceMetrics.testResults.filter(
      result => result.testName !== global.performanceMetrics.currentTest
    );
  }
});

// After each performance test
afterEach(() => {
  if (global.performanceMetrics.startTime) {
    const duration = Date.now() - global.performanceMetrics.startTime;
    console.log(`Test completed in ${duration}ms`);
  }
});

// Cleanup after all performance tests
afterAll(async () => {
  console.log('Performance test summary:');
  
  if (global.performanceMetrics.testResults.length > 0) {
    global.performanceMetrics.testResults.forEach(result => {
      console.log(`- ${result.testName}:`);
      console.log(`  Average response time: ${result.averageResponseTime}ms`);
      console.log(`  Success rate: ${result.successRate}%`);
      console.log(`  Throughput: ${result.throughput} req/sec`);
      
      if (result.errors && result.errors.length > 0) {
        console.log(`  Errors: ${result.errors.length}`);
      }
    });
  }
  
  console.log('Performance tests completed.');
});

// Utility functions for performance testing
export const performanceUtils = {
  /**
   * Records a performance test result
   */
  recordTestResult: (testName: string, result: {
    averageResponseTime: number;
    successRate: number;
    throughput: number;
    errors?: any[];
  }) => {
    global.performanceMetrics.testResults.push({
      testName,
      ...result,
      timestamp: new Date().toISOString()
    });
  },

  /**
   * Measures execution time of an async function
   */
  measureExecutionTime: async <T>(fn: () => Promise<T>): Promise<{ result: T; duration: number }> => {
    const startTime = process.hrtime.bigint();
    const result = await fn();
    const endTime = process.hrtime.bigint();
    const duration = Number(endTime - startTime) / 1_000_000; // Convert to milliseconds
    
    return { result, duration };
  },

  /**
   * Runs concurrent requests for load testing
   */
  runConcurrentRequests: async <T>(
    requestFn: () => Promise<T>,
    concurrency: number = global.performanceMetrics.concurrentUsers,
    duration: number = global.performanceMetrics.testDuration
  ): Promise<{
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    averageResponseTime: number;
    throughput: number;
    errors: any[];
  }> => {
    const startTime = Date.now();
    const results: Array<{ success: boolean; duration: number; error?: any }> = [];
    const errors: any[] = [];
    
    // Function to make a single request and record result
    const makeRequest = async (): Promise<void> => {
      try {
        const { duration } = await performanceUtils.measureExecutionTime(requestFn);
        results.push({ success: true, duration });
      } catch (error) {
        results.push({ success: false, duration: 0, error });
        errors.push(error);
      }
    };

    // Start making requests with ramp-up
    const promises: Promise<void>[] = [];
    let requestCount = 0;
    
    while (Date.now() - startTime < duration) {
      // Ramp up users gradually
      if (requestCount < concurrency) {
        const rampUpDelay = (global.performanceMetrics.rampUpTime / concurrency) * requestCount;
        setTimeout(() => {
          promises.push(makeRequest());
        }, rampUpDelay);
        requestCount++;
      }
      
      // Wait a bit before checking again
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // Wait for all requests to complete
    await Promise.all(promises);
    
    // Calculate metrics
    const totalRequests = results.length;
    const successfulRequests = results.filter(r => r.success).length;
    const failedRequests = totalRequests - successfulRequests;
    const totalDuration = Date.now() - startTime;
    
    const successfulDurations = results
      .filter(r => r.success)
      .map(r => r.duration);
    
    const averageResponseTime = successfulDurations.length > 0
      ? successfulDurations.reduce((sum, duration) => sum + duration, 0) / successfulDurations.length
      : 0;
    
    const throughput = totalRequests / (totalDuration / 1000); // requests per second
    
    return {
      totalRequests,
      successfulRequests,
      failedRequests,
      averageResponseTime,
      throughput,
      errors
    };
  },

  /**
   * Creates a delay for throttling requests
   */
  delay: (ms: number): Promise<void> => {
    return new Promise(resolve => setTimeout(resolve, ms));
  },

  /**
   * Generates load test data
   */
  generateLoadTestData: (count: number) => {
    return Array.from({ length: count }, (_, index) => ({
      id: `load-test-${index}`,
      timestamp: new Date().toISOString(),
      data: {
        venueId: `venue-${index % 10}`, // Distribute across 10 venues
        userId: `user-${index % 100}`, // Distribute across 100 users
        startTs: new Date(Date.now() + (index * 3600000)).toISOString(), // Spread over hours
        endTs: new Date(Date.now() + ((index + 8) * 3600000)).toISOString(),
        totalAmountCents: 10000 + (index * 100) // Varying amounts
      }
    }));
  }
};

// Global error handler for performance tests
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection in performance test:', promise, 'reason:', reason);
});

export {};
