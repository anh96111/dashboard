import React from 'react';

const Sidebar = ({ conversations, selectedId, onSelect, labels, unreadConversations = new Set() }) => {
  const [search, setSearch] = React.useState('');
  const [selectedLabel, setSelectedLabel] = React.useState(null);

  const filteredConversations = conversations.filter(conv => {
    const matchSearch = conv.name?.toLowerCase().includes(search.toLowerCase());
    const matchLabel = !selectedLabel || 
      conv.labels?.some(l => l.name === selectedLabel);
    return matchSearch && matchLabel;
  });

  const handleLabelFilter = (labelName) => {
    setSelectedLabel(selectedLabel === labelName ? null : labelName);
  };

  return (
    <div className="w-full md:w-80 bg-white border-r border-gray-200 flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <h1 className="text-xl font-bold text-gray-800 mb-3">💬 Dashboard</h1>
        
        {/* Search */}
        <input
          type="text"
          placeholder="🔍 Tìm kiếm..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-primary"
        />
      </div>

      {/* Label Filters */}
      {labels && labels.length > 0 && (
        <div className="p-3 border-b border-gray-200">
          <div className="flex flex-wrap gap-2">
            {labels.map(label => (
              <button
                key={label.id}
                onClick={() => handleLabelFilter(label.name)}
                className={`px-2 py-1 rounded text-xs font-medium transition ${
                  selectedLabel === label.name
                    ? 'bg-primary text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
                style={selectedLabel === label.name ? { backgroundColor: label.color } : {}}
              >
                {label.emoji} {label.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Conversations List */}
      <div className="flex-1 overflow-y-auto">
        {filteredConversations.length === 0 ? (
          <div className="p-4 text-center text-gray-500">
            Không có cuộc hội thoại nào
          </div>
        ) : (
          filteredConversations.map(conv => {
            const isUnread = unreadConversations.has(conv.id);
            
            return (
              <div
                key={conv.id}
                onClick={() => onSelect(conv)}
                className={`p-4 border-b border-gray-100 cursor-pointer hover:bg-gray-50 transition ${
                  selectedId === conv.id 
                    ? 'bg-blue-50 border-l-4 border-l-primary' 
                    : isUnread 
                      ? 'bg-yellow-50 font-semibold'
                      : ''
                }`}
              >
                <div className="flex items-start gap-3">
                  {/* Avatar with unread badge */}
                  <div className="relative flex-shrink-0">
                    <div className="w-12 h-12 rounded-full overflow-hidden bg-primary text-white flex items-center justify-center font-bold text-lg">
                      {conv.avatar ? (
                        <img 
                          src={conv.avatar} 
                          alt={conv.name}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            // Nếu load ảnh lỗi, hiển thị chữ cái
                            e.target.style.display = 'none';
                            e.target.nextSibling.style.display = 'flex';
                          }}
                        />
                      ) : null}
                      <div 
                        className="w-full h-full flex items-center justify-center"
                        style={{ display: conv.avatar ? 'none' : 'flex' }}
                      >
                        {conv.name?.[0]?.toUpperCase() || '?'}
                      </div>
                    </div>

                    {isUnread && (
                      <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center">
                        <span className="text-white text-xs font-bold">●</span>
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className={`truncate ${isUnread ? 'font-bold text-gray-900' : 'font-semibold text-gray-800'}`}>
                        {conv.name || 'Unknown'}
                        {isUnread && <span className="ml-2 text-red-500">●</span>}
                      </h3>
                      <span className="text-xs text-gray-500">
                        {conv.last_message_at ? new Date(conv.last_message_at).toLocaleTimeString('vi-VN', {
                          hour: '2-digit',
                          minute: '2-digit'
                        }) : ''}
                      </span>
                    </div>

                    {/* Labels */}
                    {conv.labels && conv.labels.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-1">
                        {conv.labels.map((label, idx) => (
                          <span
                            key={idx}
                            className="text-xs px-1.5 py-0.5 rounded"
                            style={{ backgroundColor: label.color || '#999', color: '#fff' }}
                          >
                            {label.emoji} {label.name}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Last Message */}
                    <p className={`text-sm truncate ${isUnread ? 'font-semibold text-gray-900' : 'text-gray-600'}`}>
                      {conv.last_sender === 'admin' && '🤖 '}
                      {conv.last_message || 'Chưa có tin nhắn'}
                    </p>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Stats */}
      <div className="p-3 border-t border-gray-200 bg-gray-50">
        <div className="text-xs text-gray-600">
          📊 {filteredConversations.length} cuộc hội thoại
          {unreadConversations.size > 0 && (
            <span className="ml-2 text-red-500 font-semibold">
              ({unreadConversations.size} chưa đọc)
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
