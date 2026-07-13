import axios from 'axios';
import { handleRequest } from './localRouter';

let apiBaseURL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

if (typeof window !== 'undefined' && window.location.protocol.startsWith('http')) {
  const host = window.location.hostname;
  if (host && host !== 'localhost' && host !== '127.0.0.1') {
    apiBaseURL = `${window.location.protocol}//${window.location.host}/api`;
  }
}

const api = axios.create({
  baseURL: apiBaseURL,
});

// Configure Axios Custom Adapter for standalone mobile offline usage
api.defaults.adapter = async function(config) {
  try {
    let url = config.url || '';
    
    // Resolve relative URL
    if (url.startsWith('http://') || url.startsWith('https://')) {
      const match = url.match(/\/api(\/.*)$/);
      if (match) {
        url = match[1];
      }
    } else {
      if (url.startsWith('/api')) {
        url = url.substring(4);
      }
      if (config.baseURL && url.startsWith(config.baseURL)) {
        url = url.substring(config.baseURL.length);
      }
    }
    
    // Strip trailing/leading slashes to match router
    if (!url.startsWith('/')) {
      url = '/' + url;
    }

    let data = config.data;
    if (data && typeof data === 'string') {
      try {
        data = JSON.parse(data);
      } catch (e) {}
    }

    const response = await handleRequest(config.method || 'get', url, data, config.headers);

    // Resolve successfully if status code is in 2xx range
    if (response.status >= 200 && response.status < 300) {
      return {
        data: response.data,
        status: response.status,
        statusText: 'OK',
        headers: {},
        config
      };
    } else {
      const err = new Error(response.data?.message || 'API Error');
      err.response = {
        status: response.status,
        data: response.data,
        headers: {},
        config
      };
      throw err;
    }
  } catch (err) {
    if (err.response) {
      return Promise.reject(err);
    }
    return Promise.reject({
      response: {
        status: 500,
        data: { message: 'Local router crash', error: err.message },
        config
      }
    });
  }
};

// Add token to each request if it exists
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 Unauthorized errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      if (window.location.protocol === 'file:' || window.location.href.includes('#')) {
        window.location.hash = '#/login';
      } else {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
