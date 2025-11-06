import React, { useEffect, useRef, useState, useCallback } from 'react';
import { conversationsAPI } from '../services/api';
import LabelManager from './LabelManager';
import offlineQueue from '../utils/offlineQueue';

const ChatWindow = ({ conversation, onSendMessage, quickReplies }) => {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [showQuickReplies, setShowQuickReplies] = useState(false);
  const [translatedPreview, setTranslatedPreview] = useState('');
  const [translating, setTranslating] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [filePreview, setFilePreview] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [showLabelManager, setShowLabelManager] = useState(false);
  const [showTranslatePreview, setShowTranslatePreview] = useState(false);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const loadingRef = useRef(false);
  const lastMessageCountRef = useRef(0);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Load messages function với useCallback
  const loadMessages = useCallback(async () => {
    if (!conversation || loadingRef.current) return;
    
    loadingRef.current = true;
    setLoading(true);
    try {
      const response = await conversationsAPI.getMessages(conversation.id);
      const newMessages = response.data.data || [];
      setMessages(newMessages);
      console.log('✓ Loaded', newMessages.length, 'messages');
    } catch (error) {
      console.error('Error loading messages:', error);
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  }, [conversation?.id]);
 const appendNewMessage = useCallback((newMessage) => {
    setMessages(prev => {
      // Kiểm tra tin nhắn đã tồn tại chưa
      const exists = prev.some(m => 
        m.id === newMessage.id || 
        (m.content === newMessage.content && 
         m.created_at === newMessage.created_at)
      );
      
      if (exists) return prev;
      
      // Thêm tin nhắn mới vào cuối
      return [...prev, newMessage];
    });
    
    // Cuộn xuống tin nhắn mới
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  }, []);
  // Load messages khi conversation thay đổi
  useEffect(() => {
    if (conversation?.id) {
      console.log('📂 Loading messages for conversation:', conversation.id);
      loadMessages();
    }
  }, [conversation?.id, loadMessages]);

    // Listen to window event for new messages
  useEffect(() => {
    if (!conversation?.id) return;
    
    const handleNewMessage = (event) => {
      const data = event.detail;
      console.log('🎯 ChatWindow received event:', data);
      
      if (data && data.customerId === conversation.id) {
        // THAY ĐỔI: Thêm tin mới thay vì reload
        if (data.message || data.content) {
          
          appendNewMessage({
            id: data.messageId || Date.now(),
            content: data.message || data.content,
            sender_type: data.senderType || 'customer',
            created_at: data.timestamp || new Date().toISOString(),
            translated_text: data.translatedText,
            media_type: data.mediaType,
            media_url: data.mediaUrl
          });
          console.log('✅ Tin nhắn mới đã được thêm');
        } else {
          // Nếu không có data, reload như cũ
          console.log('🔄 Reloading messages (no message data)');
          loadMessages();
        }
      }
    };
    
    window.addEventListener('newMessageReceived', handleNewMessage);
    
    return () => {
      window.removeEventListener('newMessageReceived', handleNewMessage);
    };
  }, [conversation?.id, appendNewMessage, loadMessages]);


  // Auto scroll khi có tin mới
  useEffect(() => {
    if (messages.length > lastMessageCountRef.current) {
      scrollToBottom();
      lastMessageCountRef.current = messages.length;
    }
  }, [messages]);

  const handleSend = async () => {
  if (selectedFile) {
    handleSendWithFile();
    return;
  }
  
  if (!inputText.trim() || sending) return;

  setSending(true);
  
  // KHAI BÁO BIẾN Ở ĐÂY
  const tinNhanGuiDi = inputText;
  const thoiGianGui = new Date().toISOString();
  
  try {
    // Check if online
    if (!navigator.onLine) {
      // Save to offline queue
      await offlineQueue.savePendingMessage(conversation.id, tinNhanGuiDi, false);
      
      // Show offline message
      appendNewMessage({
        id: `offline-${Date.now()}`,
        content: tinNhanGuiDi,
        sender_type: 'admin',
        created_at: thoiGianGui,
        status: 'pending',
        offline: true
      });
      
      alert('📴 Offline - Tin nhắn sẽ được gửi khi có mạng');
      
      setInputText('');
      setSending(false);
      return;
    }
    
    // Online - send normally
    await onSendMessage(conversation.id, tinNhanGuiDi, false);
    
    setInputText('');
    setTranslatedPreview('');
    
    appendNewMessage({
      id: `temp-${Date.now()}`,
      content: tinNhanGuiDi,
      sender_type: 'admin',
      created_at: thoiGianGui,
      media_type: null,
      media_url: null
    });
    
  } catch (error) {
    console.error('Error sending message:', error);
    
    // If failed, save to offline queue
    if (error.message.includes('Network') || error.message.includes('fetch')) {
      await offlineQueue.savePendingMessage(conversation.id, tinNhanGuiDi, false);
      alert('📴 Lỗi mạng - Tin nhắn đã được lưu để gửi sau');
    } else {
      alert('Lỗi gửi tin nhắn: ' + error.message);
    }
  } finally {
    setSending(false);
  }
};



  const handleTranslate = async () => {
  if (!inputText.trim() || translating) return;
  
  setTranslating(true);
  try {
    const response = await fetch(`${process.env.REACT_APP_API_URL}/api/translate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: inputText, to: 'en' })
    });
    
    const data = await response.json();
    if (data.success) {
      setTranslatedPreview(data.data.translated);
      setShowTranslatePreview(true); // HIỆN PREVIEW VỚI NÚT OK
    } else {
      alert('Lỗi dịch: ' + data.error);
    }
  } catch (error) {
    console.error('Translation error:', error);
    alert('Lỗi kết nối dịch thuật');
  } finally {
    setTranslating(false);
  }
};
  // THÊM 2 FUNCTION NÀY:
const handleApplyTranslation = () => {
  if (translatedPreview) {
    setInputText(translatedPreview); // Thay text gốc bằng bản dịch
    setTranslatedPreview('');
    setShowTranslatePreview(false);
  }
};

const handleCancelTranslation = () => {
  setTranslatedPreview('');
  setShowTranslatePreview(false);
};


  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    if (file.size > 25 * 1024 * 1024) {
      alert('File quá lớn! Tối đa 25MB');
      return;
    }
    
    setSelectedFile(file);
    
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFilePreview(reader.result);
      };
      reader.readAsDataURL(file);
    } else if (file.type.startsWith('video/')) {
      setFilePreview(URL.createObjectURL(file));
    } else {
      setFilePreview(null);
    }
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    setFilePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSendWithFile = async () => {
    if (!selectedFile) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('message', inputText);
      
      const response = await fetch(
        `${process.env.REACT_APP_API_URL}/api/conversations/${conversation.id}/send-media`,
        {
          method: 'POST',
          body: formData
        }
      );
      
      const data = await response.json();
      
      if (data.success) {
        setInputText('');
        handleRemoveFile();
        setTimeout(loadMessages, 500);
      } else {
        alert('Lỗi gửi file: ' + data.error);
      }
    } catch (error) {
      console.error('Error uploading file:', error);
      alert('Lỗi upload file');
    } finally {
      setUploading(false);
    }
    if (!navigator.onLine) {
    // Queue for background sync
    const queued = await offlineQueue.savePendingMessage(
      conversation.id,
      inputText,
      false
    );
    
    if (queued) {
      alert('📤 Tin nhắn sẽ được gửi khi có mạng');
      setInputText('');
      return;
    }
  }
  };

  const handleQuickReply = (qr) => {
    const text = qr.text_vi;
    setInputText(text);
    setShowQuickReplies(false);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!conversation) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50">
        <div className="text-center text-gray-500">
          <div className="text-6xl mb-4">💬</div>
          <p className="text-lg">Chọn một cuộc hội thoại để bắt đầu</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-white">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 bg-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {conversation.avatar ? (
  <img 
    src={conversation.avatar} 
    alt={conversation.name}
    className="w-10 h-10 rounded-full object-cover"
    onError={(e) => {
      e.target.outerHTML = `
        <div class="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center font-bold">
          ${conversation.name?.[0]?.toUpperCase() || '?'}
        </div>
      `;
    }}
  />
) : (
  <div className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center font-bold">
    {conversation.name?.[0]?.toUpperCase() || '?'}
  </div>
)}
            <div>
              <h2 className="font-semibold text-gray-800">{conversation.name || 'Unknown'}</h2>
              <p className="text-xs text-gray-500">#{conversation.fb_id?.slice(-6)}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {conversation.labels && conversation.labels.length > 0 && (
              <div className="flex gap-1">
                {conversation.labels.map((label, idx) => (
                  <span
                    key={idx}
                    className="text-xs px-2 py-1 rounded"
                    style={{ backgroundColor: label.color || '#999', color: '#fff' }}
                  >
                    {label.emoji} {label.name}
                  </span>
                ))}
              </div>
            )}
            
            <button
              onClick={() => setShowLabelManager(!showLabelManager)}
              className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded text-sm transition"
            >
              {showLabelManager ? '✕ Đóng' : '🏷️ Nhãn'}
            </button>
          </div>
        </div>
      </div>

      {showLabelManager && (
        <LabelManager 
  conversation={conversation}
  onLabelsChange={() => {
    // Bỏ window.location.reload()
    // Emit event để Dashboard biết và update
    window.dispatchEvent(new CustomEvent('labelsUpdated', {
      detail: { conversationId: conversation.id }
    }));
  }}
/>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
        {loading ? (
          <div className="text-center text-gray-500 py-8">
            Đang tải tin nhắn...
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            Chưa có tin nhắn nào
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex ${msg.sender_type === 'admin' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-xs md:max-w-md lg:max-w-lg px-4 py-2 rounded-lg ${
                    msg.sender_type === 'admin'
                      ? 'bg-primary text-white'
                      : 'bg-white border border-gray-200 text-gray-800'
                  }`}
                >
                  {msg.media_type && msg.media_url && (
                    <div className="mb-2">
                      {msg.media_type === 'image' && (
                        <img 
                          src={msg.media_url} 
                          alt="Attachment" 
                          className="max-w-full rounded"
                          style={{ maxHeight: '300px' }}
                        />
                      )}
                      {msg.media_type === 'video' && (
                        <video 
                          src={msg.media_url} 
                          controls 
                          className="max-w-full rounded"
                          style={{ maxHeight: '300px' }}
                        />
                      )}
                      {msg.media_type === 'audio' && (
                        <audio src={msg.media_url} controls className="w-full" />
                      )}
                      {msg.media_type === 'file' && (
                        <div className="flex items-center gap-2 p-2 bg-gray-100 rounded">
                          <span className="text-2xl">📎</span>
                          <span className="text-sm">{msg.content || 'File đính kèm'}</span>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {msg.content && !msg.media_type && (
                    <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                  )}
                  
                  {msg.translated_text && msg.sender_type === 'customer' && (
                    <p className="text-xs mt-1 opacity-75 border-t border-gray-200 pt-1">
                      🇻🇳 {msg.translated_text}
                    </p>
                  )}
                  
                  <p className="text-xs mt-1 opacity-75">
                    {new Date(msg.created_at).toLocaleTimeString('vi-VN', {
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {showQuickReplies && quickReplies && quickReplies.length > 0 && (
        <div className="border-t border-gray-200 bg-white p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-gray-700">⚡ Trả lời nhanh:</span>
            <button
              onClick={() => setShowQuickReplies(false)}
              className="text-gray-500 hover:text-gray-700"
            >
              ✕
            </button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {quickReplies.map(qr => (
              <button
                key={qr.id}
                onClick={() => handleQuickReply(qr)}
                className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded text-sm text-left transition"
              >
                {qr.emoji} {qr.key}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="p-4 border-t border-gray-200 bg-white">
        <div className="flex items-center gap-2 mb-2">
          <button
            onClick={() => setShowQuickReplies(!showQuickReplies)}
            className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded text-sm transition"
          >
            ⚡ Trả lời nhanh
          </button>
          
          <button
            onClick={handleTranslate}
            disabled={!inputText.trim() || translating}
            className="px-3 py-1.5 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded text-sm transition disabled:opacity-50"
          >
            {translating ? '⏳ Đang dịch...' : '🌐 Dịch sang EN'}
          </button>
          
        </div>

        {showTranslatePreview && translatedPreview && (
  <div className="mb-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
    <div className="flex items-start justify-between mb-1">
      <span className="text-xs font-semibold text-blue-700">🇬🇧 Bản dịch:</span>
    </div>
    <p className="text-sm text-gray-800 font-medium mb-2">{translatedPreview}</p>
    
    {/* NÚT OK VÀ XÓA */}
    <div className="flex gap-2">
      <button
        onClick={handleApplyTranslation}
        className="px-3 py-1 bg-green-500 text-white rounded text-sm hover:bg-green-600"
      >
        ✓ OK (Dùng bản dịch)
      </button>
      <button
        onClick={handleCancelTranslation}
        className="px-3 py-1 bg-gray-300 text-gray-700 rounded text-sm hover:bg-gray-400"
      >
        ✕ Xóa bản dịch
      </button>
    </div>
  </div>
)}

        {selectedFile && (
          <div className="mb-2 p-3 bg-gray-50 border border-gray-200 rounded-lg">
            <div className="flex items-start justify-between mb-2">
              <span className="text-xs font-semibold text-gray-700">📎 File đính kèm:</span>
              <button
                onClick={handleRemoveFile}
                className="text-red-500 hover:text-red-700 text-sm"
              >
                ✕
              </button>
            </div>
            
            {filePreview && selectedFile.type.startsWith('image/') && (
              <img 
                src={filePreview} 
                alt="Preview" 
                className="max-w-full rounded mb-2"
                style={{ maxHeight: '200px' }}
              />
            )}
            
            {filePreview && selectedFile.type.startsWith('video/') && (
              <video 
                src={filePreview} 
                controls 
                className="max-w-full rounded mb-2"
                style={{ maxHeight: '200px' }}
              />
            )}
            
            <p className="text-sm text-gray-600">
              {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
            </p>
          </div>
        )}

        <div className="flex gap-2">
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFileSelect}
            accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx"
            style={{ display: 'none' }}
          />
          
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={sending || uploading}
            className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition disabled:opacity-50"
            title="Đính kèm file"
          >
            📎
          </button>
          
          <textarea
            value={inputText}
            onChange={(e) => {
              setInputText(e.target.value);
          
            }}
            onKeyPress={handleKeyPress}
            placeholder="Nhập tin nhắn... (Enter để gửi)"
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-primary resize-none"
            rows="2"
            disabled={sending || uploading}
          />
          <button
            onClick={handleSend}
            disabled={(!inputText.trim() && !selectedFile) || sending || uploading}
            className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition font-medium"
          >
            {uploading ? '⏳' : sending ? '⏳' : '📤'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatWindow;
