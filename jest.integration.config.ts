import type { Config } from 'jest';

const config: Config = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testMatch: ['**/test/integration/**/*.integration.spec.ts'],
  transform: { '^.+\\.(t|j)s$': 'ts-jest' },
  testEnvironment: 'node',
  transformIgnorePatterns: ['node_modules/(?!(jwks-rsa|jose)/)'],
};

export default config;
