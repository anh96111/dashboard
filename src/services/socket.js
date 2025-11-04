import { io } from 'socket.io-client';

// Lấy URL từ environment hoặc dùng default
const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || 
                   process.env.REACT_APP_API_URL || 
                   'http://localhost:3000';

console.log('🔌 Connecting to Socket.io:', SOCKET_URL);

const socket = io(SOCKET_URL, {
  // Force dùng polling thay vì websocket
  transports: ['polling'],
  
  // Credentials cho CORS
  withCredentials: true,
  
  // Auto reconnect settings
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  
  // Timeout settings
  timeout: 20000,
  
  // Path mặc định
  path: '/socket.io/'
});

// Debug events
socket.on('connect', () => {
  console.log('✅ Socket connected!', socket.id);
});

socket.on('disconnect', (reason) => {
  console.log('❌ Socket disconnected:', reason);
});

socket.on('connect_error', (error) => {
  console.log('⚠️ Socket connection error:', error.message);
  // Không log full error để tránh spam console
});

socket.on('reconnect', (attemptNumber) => {
  console.log('🔄 Socket reconnected after', attemptNumber, 'attempts');
});

// Listen for new messages
socket.on('new_message', (data) => {
  console.log('📨 New message via socket:', data);
});

socket.on('message_sent', (data) => {
  console.log('📤 Message sent via socket:', data);
});

export default socket;
