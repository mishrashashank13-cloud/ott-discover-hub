import React, { useState } from 'react';
import axios from 'axios';

const AuthForm = () => {
  const [identifier, setIdentifier] = useState('');
  const [otp, setOtp] = useState('');
  const [message, setMessage] = useState('');
  
  const handleSignup = async () => {
    try {
      const res = await axios.post('/api/auth/signup', { identifier });
      setMessage(`OTP sent to ${identifier}. (For testing: ${res.data.otp})`);
    } catch (error) {
      setMessage('Signup failed.');
    }
  };

  const handleVerify = async () => {
    try {
      const res = await axios.post('/api/auth/verify', { identifier, otp });
      setMessage(`Verification successful. Token: ${res.data.token}`);
    } catch (error) {
      setMessage('Verification failed.');
    }
  };

  const handleSocialLogin = async (provider) => {
    const token = prompt(`Enter ${provider} token:`);
    if (!token) return;
    try {
      const res = await axios.post('/api/auth/social-login', { provider, token });
      setMessage(`Social login (${provider}) successful. Token: ${res.data.token}`);
    } catch (error) {
      setMessage(`Social login with ${provider} failed.`);
    }
  };

  const handleGdprDelete = async () => {
    const userId = prompt('Enter your user ID for GDPR deletion:');
    if (!userId) return;
    try {
      const res = await axios.post('/api/auth/gdpr-delete', { user_id: userId });
      setMessage(res.data.message);
    } catch (error) {
      setMessage('GDPR deletion failed.');
    }
  };

  return (
    <div>
      <h2>User Authentication</h2>
      
      <div>
        <h3>Signup (Email/Phone + OTP)</h3>
        <input 
          type="text" 
          placeholder="Email or Phone" 
          value={identifier} 
          onChange={(e) => setIdentifier(e.target.value)} 
        />
        <button onClick={handleSignup}>Send OTP</button>
      </div>

      <div>
        <h3>Verify OTP</h3>
        <input 
          type="text" 
          placeholder="Enter OTP" 
          value={otp} 
          onChange={(e) => setOtp(e.target.value)} 
        />
        <button onClick={handleVerify}>Verify OTP</button>
      </div>

      <div>
        <h3>Social Login</h3>
        <button onClick={() => handleSocialLogin('google')}>Login with Google</button>
        <button onClick={() => handleSocialLogin('apple')}>Login with Apple</button>
      </div>
      
      <div>
        <h3>GDPR Data Deletion</h3>
        <button onClick={handleGdprDelete}>Delete My Data</button>
      </div>

      {message && <p>{message}</p>}
    </div>
  );
};

export default AuthForm;
