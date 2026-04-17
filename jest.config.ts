import type { Config } from 'jest';

const config: Config = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testRegex: '.*\\.spec\\.ts$',
  transform: { '^.+\\.(t|j)s$': 'ts-jest' },
  collectCoverageFrom: ['src/**/*.ts', '!src/db/migrate.ts'],
  coverageDirectory: 'coverage',
  testEnvironment: 'node',
  testPathIgnorePatterns: ['/node_modules/', '\\.integration\\.spec\\.ts$', '\\.e2e\\.spec\\.ts$'],
  transformIgnorePatterns: ['node_modules/(?!(jwks-rsa|jose)/)'],
};

export default config;
