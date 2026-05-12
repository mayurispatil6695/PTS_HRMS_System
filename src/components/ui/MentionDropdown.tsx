import React, { useEffect, useRef } from 'react';
import { Avatar, AvatarFallback } from './avatar';

interface MentionDropdownProps {
  isOpen: boolean;
  position: { top: number; left: number };
  users: { id: string; name: string; email?: string }[];
  filter: string;
  onSelect: (userName: string) => void;
}

const MentionDropdown: React.FC<MentionDropdownProps> = ({ isOpen, position, users, filter, onSelect }) => {
  const ref = useRef<HTMLDivElement>(null);
  const filtered = users.filter(u => u.name.toLowerCase().includes(filter.toLowerCase()));

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        // Optionally close dropdown; the parent will close via state.
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!isOpen || filtered.length === 0) return null;

  return (
    <div
      ref={ref}
      className="absolute z-50 bg-white border rounded-md shadow-lg w-64 max-h-48 overflow-y-auto"
      style={{ top: position.top, left: position.left }}
    >
      {filtered.map(user => (
        <div
          key={user.id}
          className="flex items-center gap-2 px-3 py-2 hover:bg-gray-100 cursor-pointer"
          onClick={() => onSelect(user.name)}
        >
          <Avatar className="h-6 w-6">
            <AvatarFallback className="text-xs">{user.name.charAt(0)}</AvatarFallback>
          </Avatar>
          <div>
            <p className="text-sm font-medium">{user.name}</p>
            <p className="text-xs text-gray-500">{user.email || user.id}</p>
          </div>
        </div>
      ))}
    </div>
  );
};

export default MentionDropdown;