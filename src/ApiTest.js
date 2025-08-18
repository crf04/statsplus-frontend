import React, { useState } from 'react';
import { apiClient, getApiUrl } from './config';

const ApiTest = () => {
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);

  const testApi = async () => {
    setLoading(true);
    setResult('Testing...');
    
    console.log('Testing API call to:', getApiUrl('PLAYERS'));
    
    try {
      const response = await apiClient.get(getApiUrl('PLAYERS'));
      const data = response.data;
      
      setResult(`✅ Success! Got ${data.length} players. First 3: ${data.slice(0, 3).join(', ')}`);
      console.log('API test successful:', data.slice(0, 5));
    } catch (error) {
      setResult(`❌ Error: ${error.message}`);
      console.error('API test failed:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ 
      position: 'fixed', 
      top: '10px', 
      right: '10px', 
      background: 'white', 
      border: '2px solid red', 
      padding: '10px', 
      zIndex: 9999 
    }}>
      <button onClick={testApi} disabled={loading}>
        {loading ? 'Testing...' : 'Test API'}
      </button>
      <div style={{ marginTop: '10px', fontSize: '12px', maxWidth: '300px' }}>
        {result}
      </div>
    </div>
  );
};

export default ApiTest;