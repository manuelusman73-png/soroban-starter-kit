import { CachedTransaction, Balance, EscrowData } from '../storage/types';
import {
  SearchQuery,
  SearchResult,
  FilterCriteria,
  Facet,
  FacetOption,
} from './types';

type SearchableItem = CachedTransaction | Balance | EscrowData;

/**
 * Full-text search and filtering engine
 */
class SearchEngine {
  private tokenizeText(text: string): string[] {
    return text.toLowerCase().split(/\s+/).filter(t => t.length > 0);
  }

  private calculateRelevance(item: SearchableItem, tokens: string[]): number {
    const itemText = this.itemToText(item).toLowerCase();
    let score = 0;

    tokens.forEach(token => {
      const regex = new RegExp(`\\b${token}`, 'g');
      const matches = itemText.match(regex);
      score += (matches?.length || 0) * 10;
    });

    return score;
  }

  private itemToText(item: SearchableItem): string {
    if ('type' in item && 'method' in item) {
      // CachedTransaction
      const tx = item as CachedTransaction;
      return `${tx.type} ${tx.method} ${tx.contractId} ${JSON.stringify(tx.params)}`;
    }
    if ('tokenSymbol' in item) {
      // Balance
      const bal = item as Balance;
      return `${bal.tokenSymbol} ${bal.address} ${bal.amount}`;
    }
    if ('buyer' in item) {
      // EscrowData
      const escrow = item as EscrowData;
      return `${escrow.buyer} ${escrow.seller} ${escrow.status} ${escrow.amount}`;
    }
    return '';
  }

  private matchesFilters(item: SearchableItem, filters: FilterCriteria): boolean {
    // Type filter
    if (filters.type && filters.type.length > 0) {
      const itemType = ('type' in item) ? (item as CachedTransaction).type : 'unknown';
      if (!filters.type.includes(itemType)) return false;
    }

    // Status filter
    if (filters.status && filters.status.length > 0) {
      const itemStatus = ('status' in item) ? (item as CachedTransaction | EscrowData).status : 'unknown';
      if (!filters.status.includes(itemStatus)) return false;
    }

    // Date range filter
    if (filters.dateRange) {
      const itemDate = ('createdAt' in item) ? (item as CachedTransaction | EscrowData).createdAt : 0;
      if (itemDate < filters.dateRange.start || itemDate > filters.dateRange.end) return false;
    }

    // Amount range filter
    if (filters.amountRange) {
      const itemAmount = parseFloat(
        ('amount' in item) ? (item as Balance | EscrowData).amount : '0'
      );
      if (itemAmount < filters.amountRange.min || itemAmount > filters.amountRange.max) {
        return false;
      }
    }

    // Contract ID filter
    if (filters.contractId && filters.contractId.length > 0) {
      const itemContractId = ('contractId' in item) ? (item as CachedTransaction | Balance | EscrowData).contractId : '';
      if (!filters.contractId.includes(itemContractId)) return false;
    }

    return true;
  }

  search<T extends SearchableItem>(
    items: T[],
    query: SearchQuery
  ): SearchResult<T> {
    const startTime = performance.now();

    let results = items.filter(item => this.matchesFilters(item, query.filters));

    // Full-text search
    if (query.text) {
      const tokens = this.tokenizeText(query.text);
      results = results
        .map(item => ({
          item,
          relevance: this.calculateRelevance(item, tokens),
        }))
        .filter(r => r.relevance > 0)
        .sort((a, b) => b.relevance - a.relevance)
        .map(r => r.item);
    }

    // Sorting
    if (query.sortBy) {
      results = this.sortResults(results, query.sortBy, query.sortOrder || 'asc');
    }

    const executionTime = performance.now() - startTime;

    return {
      items: results,
      total: results.length,
      query,
      executionTime,
    };
  }

  private sortResults<T extends SearchableItem>(
    items: T[],
    sortBy: string,
    order: 'asc' | 'desc'
  ): T[] {
    const sorted = [...items].sort((a, b) => {
      let aVal: number | string = 0;
      let bVal: number | string = 0;

      if (sortBy === 'date') {
        aVal = ('createdAt' in a) ? (a as CachedTransaction | EscrowData).createdAt : 0;
        bVal = ('createdAt' in b) ? (b as CachedTransaction | EscrowData).createdAt : 0;
      } else if (sortBy === 'amount') {
        aVal = parseFloat(('amount' in a) ? (a as Balance | EscrowData).amount : '0');
        bVal = parseFloat(('amount' in b) ? (b as Balance | EscrowData).amount : '0');
      }

      return order === 'asc' ? (aVal > bVal ? 1 : -1) : (aVal < bVal ? 1 : -1);
    });

    return sorted;
  }

  getFacets<T extends SearchableItem>(
    items: T[],
    filters: FilterCriteria
  ): Facet[] {
    const facets: Facet[] = [];

    // Type facet
    const typeMap = new Map<string, number>();
    items.forEach(item => {
      if ('type' in item) {
        const type = (item as CachedTransaction).type;
        typeMap.set(type, (typeMap.get(type) || 0) + 1);
      }
    });

    if (typeMap.size > 0) {
      facets.push({
        name: 'type',
        options: Array.from(typeMap.entries()).map(([value, count]) => ({
          value,
          label: value.charAt(0).toUpperCase() + value.slice(1),
          count,
        })),
      });
    }

    // Status facet
    const statusMap = new Map<string, number>();
    items.forEach(item => {
      if ('status' in item) {
        const status = (item as CachedTransaction | EscrowData).status;
        statusMap.set(status, (statusMap.get(status) || 0) + 1);
      }
    });

    if (statusMap.size > 0) {
      facets.push({
        name: 'status',
        options: Array.from(statusMap.entries()).map(([value, count]) => ({
          value,
          label: value.charAt(0).toUpperCase() + value.slice(1),
          count,
        })),
      });
    }

    // Contract ID facet
    const contractMap = new Map<string, number>();
    items.forEach(item => {
      if ('contractId' in item) {
        const contractId = (item as CachedTransaction | Balance | EscrowData).contractId;
        contractMap.set(contractId, (contractMap.get(contractId) || 0) + 1);
      }
    });

    if (contractMap.size > 0) {
      facets.push({
        name: 'contractId',
        options: Array.from(contractMap.entries()).map(([value, count]) => ({
          value,
          label: value.substring(0, 8) + '...',
          count,
        })),
      });
    }

    return facets;
  }
}

export const searchEngine = new SearchEngine();
