
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// DEBUG: Check cookies on page load
console.log('=== COOKIE DEBUG ===');
console.log('All cookies:', document.cookie);
console.log('Cookie length:', document.cookie.length);
const authToken = document.cookie.split('; ').find(row => row.startsWith('authToken='));
console.log('authToken cookie:', authToken);
if (authToken) {
  console.log('authToken value:', authToken.split('=')[1]);
} else {
  console.log('❌ No authToken found in cookies');
}
console.log('===================');

async function testBackendConnection() {
  try {
    const response = await fetch(`/api-gtw/auth/ping`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Server returned ${response.status}`);
    }
    
    const data = await response.json();
    if (data.status === "ok") {
      const statusEl = document.getElementById('status');
      if (statusEl) {
        statusEl.textContent = "Server connected!";
        statusEl.style.color = 'green';
      }
      console.log("✅ Server connected successfully");
    } else {
      throw new Error(`Server error: ${data.status}`);
    }
  } catch (error: any) {
    const statusEl = document.getElementById('status');
    if (statusEl) {
      statusEl.textContent = `Connection failed: ${error.message}`;
      statusEl.style.color = 'red';
    }
    console.error("❌ Connection test failed:", error);
  }
}

// Test backend connection before rendering app
testBackendConnection();

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
