import React, { useState, useEffect } from 'react';
import { SearchSuggestion } from '../services/search/types';
import { searchManager } from '../services/search';

interface SearchBarProps {
  onSearch: (query: string) => void;
  placeholder?: string;
}

export function SearchBar({ onSearch, placeholder = 'Search transactions, tokens...' }: SearchBarProps): JSX.Element {
  const [input, setInput] = useState('');
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  useEffect(() => {
    if (input.length > 1) {
      searchManager.getSuggestions(input, 5).then(setSuggestions);
      setShowSuggestions(true);
    } else {
      setShowSuggestions(false);
    }
  }, [input]);

  const handleSearch = (query: string) => {
    onSearch(query);
    setInput(query);
    setShowSuggestions(false);
  };

  return (
    <div style={{ position: 'relative' }}>
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyPress={(e) => e.key === 'Enter' && handleSearch(input)}
        placeholder={placeholder}
        className="search-input"
        style={{
          width: '100%',
          padding: '8px 12px',
          borderRadius: '4px',
          border: '1px solid var(--color-border)',
          fontSize: '14px',
        }}
      />
      
      {showSuggestions && suggestions.length > 0 && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            backgroundColor: 'var(--color-bg)',
            border: '1px solid var(--color-border)',
            borderTop: 'none',
            borderRadius: '0 0 4px 4px',
            zIndex: 10,
            maxHeight: '200px',
            overflowY: 'auto',
          }}
        >
          {suggestions.map((suggestion) => (
            <div
              key={suggestion.text}
              onClick={() => handleSearch(suggestion.text)}
              style={{
                padding: '8px 12px',
                cursor: 'pointer',
                borderBottom: '1px solid var(--color-border)',
                fontSize: '14px',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-highlight)')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              <span style={{ marginRight: '8px' }}>
                {suggestion.type === 'query' ? '🔍' : suggestion.type === 'filter' ? '⚙️' : '💾'}
              </span>
              {suggestion.text}
              <span style={{ fontSize: '12px', color: 'var(--color-muted)', marginLeft: '8px' }}>
                ({suggestion.frequency})
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
