import React, { useState, useEffect, useCallback } from 'react';
import Sidebar from '../components/Sidebar';
import ChatWindow from '../components/ChatWindow';
import QuickReplyManager from '../components/QuickReplyManager';
import { conversationsAPI, labelsAPI, quickRepliesAPI } from '../services/api';
import socketService from '../services/socket';
import notificationService from '../utils/notification';
import pushManager from '../utils/pushNotifications';

const Dashboard = () => {
  console.log('🔄 Dashboard rendered');
  
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [labels, setLabels] = useState([]);
  const [quickReplies, setQuickReplies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showQRManager, setShowQRManager] = useState(false);
  const [unreadConversations, setUnreadConversations] = useState(new Set());
  const [messageReloadTriggers, setMessageReloadTriggers] = useState({});
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);
  const [touchStartY, setTouchStartY] = useState(null);

  useEffect(() => {
  loadInitialData();
  connectSocket();
  
  // THÊM: Listen labels update
  const handleLabelsUpdate = () => {
    loadConversations(); // Reload conversations để update labels ở sidebar
  };
  window.addEventListener('labelsUpdated', handleLabelsUpdate);
  // THÊM: Listen socket reconnect
  const handleSocketReconnect = () => {
    console.log('🔄 Socket reconnected, reloading data...');
    loadConversations(); // Reload conversations
  };
  window.addEventListener('socketReconnected', handleSocketReconnect);
  // Init push notifications
  pushManager.init().then(success => {
    if (success) {
      console.log('✅ Push notifications enabled');
    }
  }).catch(err => {
    console.error('Push init error', err);
  });

  // Listen for SW messages
  const swMessageHandler = (event) => {
    const data = event.data || {};

    if (data.type === 'notification-click') {
      // Handle notification click
      const customerId = data.customerId;
      if (customerId) {
        const conv = conversations.find(c => c.id === customerId);
        if (conv) {
          handleSelectConversation(conv);
        }
      }
    }

    if (data.type === 'sync-complete') {
      // Reload data after sync
      loadConversations();
    }
  };

  navigator.serviceWorker?.addEventListener('message', swMessageHandler);

  return () => {
    socketService.disconnect();
    window.removeEventListener('labelsUpdated', handleLabelsUpdate);
    window.removeEventListener('socketReconnected', handleSocketReconnect);
    navigator.serviceWorker?.removeEventListener('message', swMessageHandler);
  };
}, []);
  const loadInitialData = async () => {
    setLoading(true);
    try {
      const [convRes, labelsRes, qrRes] = await Promise.all([
        conversationsAPI.getAll(),
        labelsAPI.getAll(),
        quickRepliesAPI.getAll()
      ]);

      setConversations(convRes.data.data || []);
      setLabels(labelsRes.data.data || []);
      setQuickReplies(qrRes.data.data || []);
    } catch (error) {
      console.error('Error loading initial data:', error);
      alert('Lỗi kết nối server. Vui lòng kiểm tra backend đang chạy.');
    } finally {
      setLoading(false);
    }
  };

  const connectSocket = () => {
    socketService.connect();

    socketService.on('new_message', (data) => {
  console.log('📨 Dashboard received new_message:', data);
  console.log('📱 Sidebar open:', sidebarOpen);
  console.log('👁️ Current conversation:', selectedConversation?.id);
  
  const isViewingConversation = selectedConversation?.id === data.customerId;

      // Play notification (chỉ khi không xem conversation đó)
      if (!isViewingConversation || document.hidden) {
        notificationService.notify(
          data.customerName || 'Khách hàng',
          data.message || 'Gửi media'
        );
      }
      
      // Mark unread
      if (!isViewingConversation) {
        setUnreadConversations(prev => new Set([...prev, data.customerId]));
      }
      
      // Reload conversations - QUAN TRỌNG
console.log('🔄 Reloading conversations...');
loadConversations();

      
      // Emit custom event để ChatWindow reload
      window.dispatchEvent(new CustomEvent('newMessageReceived', { 
        detail: data 
      }));
    });

    socketService.on('message_sent', (data) => {
      console.log('✅ Message sent:', data);
      loadConversations();
      
      window.dispatchEvent(new CustomEvent('newMessageReceived', { 
        detail: data 
      }));
    });
  };

  const loadConversations = async () => {
    try {
      const response = await conversationsAPI.getAll();
      const convs = response.data.data || [];
      
      // Sort: unread first, then by last message time
      const sorted = convs.sort((a, b) => {
        const aUnread = unreadConversations.has(a.id);
        const bUnread = unreadConversations.has(b.id);
        
        if (aUnread && !bUnread) return -1;
        if (!aUnread && bUnread) return 1;
        
        // Both same unread status, sort by time
        const aTime = new Date(a.last_message_at || 0);
        const bTime = new Date(b.last_message_at || 0);
        return bTime - aTime;
      });
      
      setConversations(sorted);
    } catch (error) {
      console.error('Error loading conversations:', error);
    }
  };

  const handleSelectConversation = (conv) => {
    setSelectedConversation(conv);
    
    // Mark as read
    setUnreadConversations(prev => {
      const newSet = new Set(prev);
      newSet.delete(conv.id);
      return newSet;
    });
    
    // On mobile, close sidebar
    if (window.innerWidth < 768) {
      setSidebarOpen(false);
    }
  };

  const handleSendMessage = async (customerId, message, translate) => {
    try {
      await conversationsAPI.sendMessage(customerId, {
        message,
        translate
      });
      
      // Reload conversations
      loadConversations();
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    }
  };

  // Callback to trigger message reload in ChatWindow
  const handleNewMessageForConversation = useCallback((callback) => {
    const trigger = messageReloadTriggers[selectedConversation?.id];
    if (trigger) {
      callback(selectedConversation.id);
    }
  }, [messageReloadTriggers, selectedConversation]);

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="text-6xl mb-4">⏳</div>
          <p className="text-lg text-gray-600">Đang tải dữ liệu...</p>
        </div>
      </div>
    );
  }
// Swipe gesture handlers
const minSwipeDistance = 50; // Khoảng cách tối thiểu để coi là swipe
const edgeThreshold = 50; // Chỉ detect swipe từ 50px cạnh trái

const onTouchStart = (e) => {
  // Chỉ detect khi touch ở cạnh trái màn hình
  if (e.targetTouches[0].clientX <= edgeThreshold) {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
    setTouchStartY(e.targetTouches[0].clientY);
  }
};


const onTouchMove = (e) => {
  if (touchStart !== null && touchStartY !== null) {
    const currentX = e.targetTouches[0].clientX;
    const currentY = e.targetTouches[0].clientY;
    setTouchEnd(currentX);
    
    // Tính khoảng cách di chuyển
    const deltaX = Math.abs(currentX - touchStart);
    const deltaY = Math.abs(currentY - touchStartY);
    
    // Chỉ preventDefault khi vuốt NGANG nhiều hơn DỌC
    if (deltaX > deltaY && deltaX > 15) {
      e.preventDefault();
    }
  }
};



const onTouchEnd = () => {
  if (!touchStart || !touchEnd) {
    // Reset nếu không có gesture hợp lệ
    setTouchStart(null);
    setTouchEnd(null);
    setTouchStartY(null);
    return;
  }
  
  const distance = touchEnd - touchStart;
  const isRightSwipe = distance > minSwipeDistance;
  
  // Chỉ xử lý swipe phải (mở sidebar)
  if (isRightSwipe && !sidebarOpen) {
    console.log('👉 Swipe right detected, opening sidebar');
    setSidebarOpen(true);
  }
  
  // Reset tất cả
  setTouchStart(null);
  setTouchEnd(null);
  setTouchStartY(null);
};


  return (
    <div className="h-screen flex flex-col bg-gray-100">
      {/* Header - Fixed Top */}
      <div className="bg-primary text-white p-4 flex items-center justify-between shadow-md z-10">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold">💬 Dashboard</h1>
          
          {/* Mobile Menu Toggle */}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="md:hidden text-white text-2xl"
          >
            {sidebarOpen ? '✕' : '☰'}
          </button>
        </div>

        {/* Quick Reply Manager Button */}
        <button
          onClick={() => setShowQRManager(true)}
          className="px-4 py-2 bg-white bg-opacity-20 hover:bg-opacity-30 rounded transition"
        >
          ⚡ Quản lý Trả lời nhanh
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Overlay khi sidebar mở (mobile) */}
          {sidebarOpen && (
            <div 
              className="fixed inset-0 bg-black bg-opacity-50 z-10 md:hidden"
              onClick={() => setSidebarOpen(false)}
            />
          )}
        {/* Sidebar - Luôn mount, chỉ ẩn bằng transform */}
          <div className={`
            fixed md:relative
            top-0 left-0
            w-full md:w-80 
            h-full
            bg-white
            z-20
            transition-transform duration-300
            ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
          `}>
            <Sidebar
              conversations={conversations}
              selectedId={selectedConversation?.id}
              onSelect={handleSelectConversation}
              labels={labels}
              unreadConversations={unreadConversations}
            />
          </div>


        {/* Chat Window */}
        <div className="flex-1 h-full relative md:flex">
          {/* Swipe Zone - Chỉ active ở cạnh trái */}
          <div
            className="absolute left-0 top-0 bottom-0 w-16 z-50 md:hidden"
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
            style={{ 
              pointerEvents: sidebarOpen ? 'none' : 'auto',
              touchAction: 'pan-y' // Cho phép scroll dọc
            }}
          />



          {/* Back Button on Mobile */}
          {selectedConversation && (
            <button
              onClick={() => setSidebarOpen(true)}
              className="md:hidden absolute top-4 left-4 bg-white rounded-full p-2 shadow-lg z-10"
            >
              ← Quay lại
            </button>
          )}
          
          <ChatWindow
            key={`${selectedConversation?.id}_${messageReloadTriggers[selectedConversation?.id]}`}
            conversation={selectedConversation}
            onSendMessage={handleSendMessage}
            quickReplies={quickReplies}
          />
        </div>
      </div>

      {/* Notification Settings */}

      {/* Quick Reply Manager Modal */}
      {showQRManager && (
        <QuickReplyManager
          onClose={() => setShowQRManager(false)}
          onUpdate={() => {
            loadInitialData();
          }}
        />
      )}
    </div>
  );
};

export default Dashboard;
