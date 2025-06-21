// Example mobile app client demonstrating JWT authentication with Kenx
// This would typically be used in a React Native, Flutter, or native mobile app

class KenxMobileClient {
  private baseUrl: string;
  private token: string | null = null;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
    this.loadToken();
  }

  // Load token from secure storage (AsyncStorage, SecureStore, etc.)
  private loadToken() {
    // In a real app, you'd load from secure storage
    this.token = localStorage.getItem('kenx_token'); // Browser example
  }

  // Save token to secure storage
  private saveToken(token: string) {
    this.token = token;
    localStorage.setItem('kenx_token', token); // Browser example
  }

  // Clear token from storage
  private clearToken() {
    this.token = null;
    localStorage.removeItem('kenx_token');
  }

  // Make authenticated API request
  private async request(endpoint: string, options: RequestInit = {}) {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...options.headers,
    };

    // Add JWT token to headers if available
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Network error' }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    return response.json();
  }

  // Authentication methods
  async login(email: string, password: string) {
    try {
      const result = await this.request('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ 
          email, 
          password, 
          platform: 'mobile' // Important: tells server this is mobile
        }),
      });

      if (result.success && result.token) {
        this.saveToken(result.token);
        return result;
      }

      throw new Error('Login failed');
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  }

  async register(email: string, password: string, firstName: string, lastName?: string) {
    try {
      const result = await this.request('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ 
          email, 
          password, 
          firstName,
          lastName,
          platform: 'mobile' 
        }),
      });

      if (result.success && result.token) {
        this.saveToken(result.token);
        return result;
      }

      throw new Error('Registration failed');
    } catch (error) {
      console.error('Registration error:', error);
      throw error;
    }
  }

  async logout() {
    try {
      await this.request('/auth/logout', { method: 'POST' });
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      this.clearToken();
    }
  }

  async refreshToken() {
    try {
      const result = await this.request('/api/auth/refresh', {
        method: 'POST',
      });

      if (result.success && result.token) {
        this.saveToken(result.token);
        return result.token;
      }

      throw new Error('Token refresh failed');
    } catch (error) {
      console.error('Token refresh error:', error);
      this.clearToken(); // Clear invalid token
      throw error;
    }
  }

  // API methods
  async getProfile() {
    return this.request('/api/profile');
  }

  async updateProfile(firstName: string, lastName?: string) {
    return this.request('/api/profile', {
      method: 'PUT',
      body: JSON.stringify({ firstName, lastName }),
    });
  }

  // Check if user is authenticated
  isAuthenticated(): boolean {
    return !!this.token;
  }

  // Get current token
  getToken(): string | null {
    return this.token;
  }
}

// Usage example
async function mobileAppExample() {
  const client = new KenxMobileClient('http://localhost:3000');

  try {
    // Register new user
    console.log('Registering user...');
    const registerResult = await client.register(
      'test@example.com',
      'password123',
      'John',
      'Doe'
    );
    console.log('Registration successful:', registerResult);

    // Get user profile
    console.log('Getting profile...');
    const profile = await client.getProfile();
    console.log('Profile:', profile);

    // Update profile
    console.log('Updating profile...');
    const updateResult = await client.updateProfile('John', 'Smith');
    console.log('Update successful:', updateResult);

    // Refresh token (typically done automatically before expiration)
    console.log('Refreshing token...');
    const newToken = await client.refreshToken();
    console.log('New token received:', !!newToken);

    // Logout
    console.log('Logging out...');
    await client.logout();
    console.log('Logged out successfully');

  } catch (error) {
    console.error('Mobile app error:', error);
  }
}

// React Native example component
const ReactNativeExample = `
import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Button, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const client = new KenxMobileClient('https://your-kenx-app.com');

  const handleLogin = async () => {
    setLoading(true);
    try {
      const result = await client.login(email, password);
      Alert.alert('Success', 'Logged in successfully!');
      // Navigate to main app screen
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ padding: 20 }}>
      <Text>Email:</Text>
      <TextInput
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
      />
      
      <Text>Password:</Text>
      <TextInput
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />
      
      <Button
        title={loading ? "Logging in..." : "Login"}
        onPress={handleLogin}
        disabled={loading}
      />
    </View>
  );
}
`;

// Flutter example
const FlutterExample = `
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';

class KenxFlutterClient {
  final String baseUrl;
  String? _token;

  KenxFlutterClient(this.baseUrl) {
    _loadToken();
  }

  Future<void> _loadToken() async {
    final prefs = await SharedPreferences.getInstance();
    _token = prefs.getString('kenx_token');
  }

  Future<void> _saveToken(String token) async {
    _token = token;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('kenx_token', token);
  }

  Future<Map<String, dynamic>> login(String email, String password) async {
    final response = await http.post(
      Uri.parse('\$baseUrl/auth/login'),
      headers: {'Content-Type': 'application/json'},
      body: json.encode({
        'email': email,
        'password': password,
        'platform': 'mobile',
      }),
    );

    final data = json.decode(response.body);
    
    if (response.statusCode == 200 && data['success']) {
      await _saveToken(data['token']);
      return data;
    }
    
    throw Exception(data['error'] ?? 'Login failed');
  }

  Future<Map<String, dynamic>> getProfile() async {
    final response = await http.get(
      Uri.parse('\$baseUrl/api/profile'),
      headers: {
        'Authorization': 'Bearer \$_token',
        'Content-Type': 'application/json',
      },
    );

    if (response.statusCode == 200) {
      return json.decode(response.body);
    }
    
    throw Exception('Failed to get profile');
  }
}
`;

export { KenxMobileClient, mobileAppExample, ReactNativeExample, FlutterExample };
