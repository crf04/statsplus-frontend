describe('API base URL', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalApiBaseUrl = process.env.REACT_APP_API_BASE_URL;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    process.env.REACT_APP_API_BASE_URL = originalApiBaseUrl;
    jest.resetModules();
  });

  test('keeps production requests relative even when an API origin is configured', () => {
    process.env.NODE_ENV = 'production';
    process.env.REACT_APP_API_BASE_URL = 'https://configured-backend.example.com/';

    let loadedConfig;
    jest.isolateModules(() => {
      loadedConfig = require('./config').default;
    });

    expect(loadedConfig.API_BASE_URL).toBe('');
  });
});
