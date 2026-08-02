import axios from 'axios'

const getApiBaseUrl = () => {
  // VITE_API_URL is set per-environment:
  //   .env.local       → /api   (Vite dev proxy → localhost:5001)
  //   .env.production  → https://unirank-2.onrender.com/api
  // Fallback to /api so local dev without any env file still works via proxy.
  return import.meta.env.VITE_API_URL || '/api';
};

const api = axios.create({
  baseURL: getApiBaseUrl(),
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000, // 15 s — prevents skeleton hanging forever on cold Render starts
});

// Attach JWT token to every request
api.interceptors.request.use(config => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Handle 401 globally — clear token and redirect to login
api.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('auth_user')
      window.dispatchEvent(new Event('auth-expired'))
    }
    return Promise.reject(err)
  }
)

export default api
