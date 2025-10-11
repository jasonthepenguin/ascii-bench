'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

type LeaderboardEntry = {
  id: string;
  model_name: string;
  model_config: string;
  elo_rating: number;
  vote_count: number;
  metadata?: {
    reasoning_config?: {
      max_tokens?: number;
    };
    max_tokens?: number;
    provider?: string;
    [key: string]: any;
  };
};

export default function LeaderboardPage() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchLeaderboard();
  }, []);

  const fetchLeaderboard = async () => {
    try {
      setLoading(true);
      const { data, error: fetchError } = await supabase
        .from('models')
        .select('id, model_name, model_config, elo_rating, vote_count, metadata')
        .order('elo_rating', { ascending: false });

      if (fetchError) {
        setError('Failed to load leaderboard');
        console.error('Error fetching leaderboard:', fetchError);
        return;
      }

      setEntries(data || []);
    } catch (err) {
      setError('Failed to load leaderboard');
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const getRankColor = (rank: number) => {
    if (rank === 1) return 'text-yellow-600 font-bold'; // Gold
    if (rank === 2) return 'text-gray-400 font-bold'; // Silver
    if (rank === 3) return 'text-amber-700 font-bold'; // Bronze
    return 'text-gray-600';
  };

  const getRankMedal = (rank: number) => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return `#${rank}`;
  };

  return (
    <main className="flex min-h-screen flex-col items-center p-6 pt-12">
      <div className="w-full max-w-5xl">
        <div className="mb-8 text-center">
          <h1 className="text-5xl font-bold mb-2">Leaderboard</h1>
          <p className="text-gray-600 text-lg">Model rankings by ELO rating</p>
        </div>

        {loading ? (
          <div className="flex justify-center items-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : error ? (
          <div className="text-center py-20">
            <p className="text-red-600 text-lg">{error}</p>
            <button
              onClick={fetchLeaderboard}
              className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Retry
            </button>
          </div>
        ) : entries.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-gray-600 text-lg">No entries yet. Start voting to build the leaderboard!</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-lg overflow-hidden">
            {/* Header */}
            <div className="hidden sm:block bg-gray-100 border-b border-gray-200 px-6 py-4">
              <div className="grid grid-cols-12 gap-4 font-semibold text-gray-700">
                <div className="col-span-1 text-center">Rank</div>
                <div className="col-span-4">Model</div>
                <div className="col-span-2 text-center">Config</div>
                <div className="col-span-2 text-center">ELO Rating</div>
                <div className="col-span-2 text-center">Votes</div>
                <div className="col-span-1 text-center">Info</div>
              </div>
            </div>

            {/* Entries */}
            <div className="divide-y divide-gray-200">
              {entries.map((entry, index) => {
                const rank = index + 1;
                return (
                  <div
                    key={entry.id}
                    className={`px-6 py-4 hover:bg-gray-50 transition-colors ${
                      rank <= 3 ? 'bg-amber-50/30' : ''
                    }`}
                  >
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-12 sm:gap-4 sm:items-center">
                      {/* Rank */}
                      <div
                        className={`flex items-center text-lg ${getRankColor(rank)} sm:col-span-1 sm:block sm:text-center`}
                      >
                        {getRankMedal(rank)}
                      </div>

                      {/* Model Name */}
                      <div className="sm:col-span-4">
                        <p className="font-semibold text-gray-900">{entry.model_name}</p>
                        {entry.metadata?.provider && (
                          <p className="text-xs text-gray-500">
                            via {entry.metadata.provider}
                          </p>
                        )}
                      </div>

                      {/* Desktop Config */}
                      <div className="hidden sm:flex sm:col-span-2 sm:justify-center">
                        <span className="inline-block px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm">
                          {entry.model_config || 'default'}
                        </span>
                      </div>

                      {/* Desktop ELO Rating */}
                      <div className="hidden sm:flex sm:col-span-2 sm:justify-center">
                        <p className="text-xl font-bold text-blue-600">{entry.elo_rating}</p>
                      </div>

                      {/* Desktop Vote Count */}
                      <div className="hidden sm:flex sm:col-span-2 sm:justify-center">
                        <p className="text-gray-700">{entry.vote_count}</p>
                      </div>

                      {/* Desktop Extended Thinking Badge */}
                      <div className="hidden sm:flex sm:col-span-1 sm:justify-center">
                        {entry.metadata?.reasoning_config && (
                          <span
                            className="inline-block text-xs"
                            title={`Extended Thinking (${entry.metadata.reasoning_config.max_tokens || 'N/A'} tokens)`}
                          >
                            🧠
                          </span>
                        )}
                      </div>

                      {/* Mobile Stats */}
                      <div className="grid grid-cols-2 gap-3 sm:hidden">
                        <div className="flex flex-col">
                          <span className="text-xs uppercase tracking-wide text-gray-500">Config</span>
                          <span className="mt-1 inline-block w-fit px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm">
                            {entry.model_config || 'default'}
                          </span>
                        </div>
                        <div className="flex flex-col items-end">
                          <span className="text-xs uppercase tracking-wide text-gray-500">ELO</span>
                          <span className="mt-1 text-base font-semibold text-blue-600">{entry.elo_rating}</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-xs uppercase tracking-wide text-gray-500">Votes</span>
                          <span className="mt-1 text-base font-semibold text-gray-700">{entry.vote_count}</span>
                        </div>
                        <div className="flex flex-col items-end">
                          <span className="text-xs uppercase tracking-wide text-gray-500">Info</span>
                          <span className="mt-1 text-base">
                            {entry.metadata?.reasoning_config ? '🧠' : '—'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Stats Footer */}
        {!loading && !error && entries.length > 0 && (
          <div className="mt-8 text-center text-gray-600">
            <p className="text-sm">
              Showing {entries.length} model{entries.length !== 1 ? 's' : ''} •{' '}
              Total votes: {entries.reduce((sum, e) => sum + e.vote_count, 0)}
            </p>
            <button
              onClick={fetchLeaderboard}
              className="mt-4 text-blue-600 hover:text-blue-700 text-sm font-medium"
            >
              ↻ Refresh
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
