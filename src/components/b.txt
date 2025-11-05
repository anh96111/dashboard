import React, { useState, useEffect } from 'react';
import { labelsAPI } from '../services/api';
import api from '../services/api';

const LabelManager = ({ conversation, onLabelsChange }) => {
  const [allLabels, setAllLabels] = useState([]);
  const [customerLabels, setCustomerLabels] = useState([]);
  const [showAddNew, setShowAddNew] = useState(false);
  const [newLabel, setNewLabel] = useState({ name: '', emoji: '🏷️', color: '#0084ff' });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (conversation) {
      loadLabels();
    }
  }, [conversation]);

  const loadLabels = async () => {
    try {
      const [allRes, customerRes] = await Promise.all([
        labelsAPI.getAll(),
        api.get(`/customers/${conversation.id}/labels`)
      ]);
      
      setAllLabels(allRes.data.data || []);
      setCustomerLabels(customerRes.data.data || []);
    } catch (error) {
      console.error('Error loading labels:', error);
      console.error('Error details:', error.response); 
    }
  };

  const handleAddLabel = async (labelId) => {
    setLoading(true);
    try {
      await labelsAPI.addToCustomer(conversation.id, labelId);
      await loadLabels();
      if (onLabelsChange) onLabelsChange();
    } catch (error) {
      console.error('Error adding label:', error);
      alert('Lỗi thêm nhãn');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveLabel = async (labelId) => {
    setLoading(true);
    try {
      await api.delete(`/customers/${conversation.id}/labels/${labelId}`);
      await loadLabels();
      if (onLabelsChange) onLabelsChange();
    } catch (error) {
      console.error('Error removing label:', error);
      alert('Lỗi xóa nhãn');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateLabel = async () => {
    if (!newLabel.name.trim()) {
      alert('Vui lòng nhập tên nhãn');
      return;
    }

    setLoading(true);
    try {
      const response = await api.post('/labels', newLabel);
      const createdLabel = response.data.data;
      
      // Add to customer immediately
      await handleAddLabel(createdLabel.id);
      
      setNewLabel({ name: '', emoji: '🏷️', color: '#0084ff' });
      setShowAddNew(false);
    } catch (error) {
      console.error('Error creating label:', error);
      console.error('Error response:', error.response?.data); // THÊM DÒNG NÀY
    console.error('Error status:', error.response?.status);
      alert(error.response?.data?.error || 'Lỗi tạo nhãn');
    } finally {
      setLoading(false);
    }
  };

  const availableLabels = allLabels.filter(
    label => !customerLabels.find(cl => cl.id === label.id)
  );

  return (
    <div className="p-4 border-t border-gray-200 bg-white">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-gray-700 mb-2">🏷️ Nhãn hiện tại:</h3>
        
        {customerLabels.length === 0 ? (
          <p className="text-xs text-gray-500 italic">Chưa có nhãn nào</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {customerLabels.map(label => (
              <div
                key={label.id}
                className="flex items-center gap-1 px-2 py-1 rounded text-xs text-white"
                style={{ backgroundColor: label.color }}
              >
                <span>{label.emoji} {label.name}</span>
                <button
                  onClick={() => handleRemoveLabel(label.id)}
                  disabled={loading}
                  className="ml-1 hover:opacity-75"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {availableLabels.length > 0 && (
        <div className="mb-3">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">➕ Thêm nhãn:</h3>
          <div className="flex flex-wrap gap-2">
            {availableLabels.map(label => (
              <button
                key={label.id}
                onClick={() => handleAddLabel(label.id)}
                disabled={loading}
                className="px-2 py-1 rounded text-xs bg-gray-100 hover:bg-gray-200 transition disabled:opacity-50"
              >
                {label.emoji} {label.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {showAddNew ? (
        <div className="p-3 bg-gray-50 rounded border border-gray-200">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Tạo nhãn mới:</h3>
          
          <div className="space-y-2">
            <div>
              <label className="text-xs text-gray-600">Tên nhãn:</label>
              <input
                type="text"
                value={newLabel.name}
                onChange={(e) => setNewLabel({...newLabel, name: e.target.value})}
                placeholder="vip, khieu-nai..."
                className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
              />
            </div>

            <div className="flex gap-2">
              <div className="flex-1">
                <label className="text-xs text-gray-600">Emoji:</label>
                <input
                  type="text"
                  value={newLabel.emoji}
                  onChange={(e) => setNewLabel({...newLabel, emoji: e.target.value})}
                  placeholder="⭐"
                  className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                  maxLength="2"
                />
              </div>

              <div className="flex-1">
                <label className="text-xs text-gray-600">Màu:</label>
                <input
                  type="color"
                  value={newLabel.color}
                  onChange={(e) => setNewLabel({...newLabel, color: e.target.value})}
                  className="w-full h-8 border border-gray-300 rounded"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleCreateLabel}
                disabled={loading}
                className="flex-1 px-3 py-1.5 bg-primary text-white rounded text-sm hover:bg-blue-600 disabled:opacity-50"
              >
                {loading ? '⏳' : '✓ Tạo'}
              </button>
              <button
                onClick={() => setShowAddNew(false)}
                disabled={loading}
                className="flex-1 px-3 py-1.5 bg-gray-200 text-gray-700 rounded text-sm hover:bg-gray-300"
              >
                Hủy
              </button>
            </div>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowAddNew(true)}
          className="w-full px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded text-sm text-gray-700 transition"
        >
          ➕ Tạo nhãn mới
        </button>
      )}
    </div>
  );
};

export default LabelManager;
