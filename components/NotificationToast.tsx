import React from 'react';

interface NotificationToastProps {
  msg: string;
  type: 'success' | 'info' | 'error';
  onClose: () => void;
}

const NotificationToast: React.FC<NotificationToastProps> = ({ msg, type, onClose }) => {
  return (
    <div className="fixed top-4 left-4 right-4 z-[100] animate-bounce-in pt-[env(safe-area-inset-top)]">
      <div className={`${type === 'error' ? 'bg-red-600' : (type === 'success' ? 'bg-emerald-600' : 'bg-blue-600')} text-white p-4 rounded-xl shadow-2xl flex items-center justify-between border border-white/20`}>
        <span className="text-sm font-bold pr-2">{msg}</span>
        <button onClick={onClose} className="text-white/80 hover:text-white font-bold">✕</button>
      </div>
    </div>
  );
};

export default NotificationToast;