import React from 'react';
import { Input } from '../ui/input';
import { Search } from 'lucide-react';

interface ClientFiltersProps {
  searchTerm: string;
  setSearchTerm: (term: string) => void;
}

const ClientFilters: React.FC<ClientFiltersProps> = ({ searchTerm, setSearchTerm }) => {
  return (
    <div className="flex gap-4">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
        <Input
          placeholder="Search by name, email, company..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-9"
        />
      </div>
    </div>
  );
};

export default ClientFilters;