const Sequencer = require('@jest/test-sequencer').default;

class CustomSequencer extends Sequencer {
  /**
   * Sort test files to run unit tests first, then integration tests, then e2e tests
   * This ensures faster feedback and optimal CI pipeline performance
   */
  sort(tests) {
    // Define test priorities (lower number = higher priority)
    const getPriority = (testPath) => {
      if (testPath.includes('.spec.ts') && !testPath.includes('/test/')) {
        return 1; // Unit tests - highest priority
      }
      if (testPath.includes('.integration.spec.ts')) {
        return 2; // Integration tests - medium priority
      }
      if (testPath.includes('payment-integration.e2e-spec.ts')) {
        return 3; // Payment integration tests - lower priority (more complex)
      }
      if (testPath.includes('.e2e-spec.ts')) {
        return 4; // E2E tests - lowest priority
      }
      if (testPath.includes('.performance.spec.ts')) {
        return 5; // Performance tests - run last
      }
      return 3; // Default priority
    };

    // Sort by priority, then by test name for deterministic order
    return tests.sort((a, b) => {
      const priorityA = getPriority(a.path);
      const priorityB = getPriority(b.path);
      
      if (priorityA !== priorityB) {
        return priorityA - priorityB;
      }
      
      // If same priority, sort alphabetically for deterministic results
      return a.path.localeCompare(b.path);
    });
  }

  /**
   * Shard tests across workers for parallel execution
   * Keep related tests on same worker to avoid database conflicts
   */
  shard(tests, { shardIndex, shardCount }) {
    // Group tests by type to avoid cross-contamination
    const testGroups = {
      unit: [],
      integration: [],
      payments: [],
      e2e: [],
      performance: []
    };

    tests.forEach(test => {
      if (test.path.includes('.spec.ts') && !test.path.includes('/test/')) {
        testGroups.unit.push(test);
      } else if (test.path.includes('payment-integration.e2e-spec.ts')) {
        testGroups.payments.push(test);
      } else if (test.path.includes('.integration.spec.ts')) {
        testGroups.integration.push(test);
      } else if (test.path.includes('.e2e-spec.ts')) {
        testGroups.e2e.push(test);
      } else if (test.path.includes('.performance.spec.ts')) {
        testGroups.performance.push(test);
      }
    });

    // Distribute test groups evenly across shards
    const allTests = [
      ...testGroups.unit,
      ...testGroups.integration,
      ...testGroups.payments,
      ...testGroups.e2e,
      ...testGroups.performance
    ];

    const testsPerShard = Math.ceil(allTests.length / shardCount);
    const startIndex = shardIndex * testsPerShard;
    const endIndex = Math.min(startIndex + testsPerShard, allTests.length);

    return allTests.slice(startIndex, endIndex);
  }
}

module.exports = CustomSequencer;
