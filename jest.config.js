module.exports = {
  preset: '@react-native/jest-preset',
  testMatch: ['<rootDir>/__tests__/**/*.test.[jt]s?(x)'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  transformIgnorePatterns: [
    'node_modules/(?!(@react-native/|react-native[^/]*|@react-navigation/))',
  ],
};
