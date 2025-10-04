'use client';

import { useEffect, useState } from 'react';

type AsciiOutput = {
  id: string;
  model: string;
  ascii_art: string;
  prompt_id: string;
  model_config?: string;
  metadata?: {
    reasoning_config?: {
      max_tokens?: number;
    };
    max_tokens?: number;
    provider?: string;
    [key: string]: any;
  };
};

type Prompt = {
  id: string;
  prompt_text: string;
};

export default function Home() {
  const [outputA, setOutputA] = useState<AsciiOutput | null>(null);
  const [outputB, setOutputB] = useState<AsciiOutput | null>(null);
  const [prompt, setPrompt] = useState<Prompt | null>(null);
  const [loading, setLoading] = useState(false);
  const [showingResults, setShowingResults] = useState(false);
  const [winnerId, setWinnerId] = useState<string | null>(null);

  // Calculate appropriate font size based on ASCII art dimensions
  const calculateFontSize = (ascii: string) => {
    const lines = ascii.split('\n').filter(line => line.trim().length > 0);
    const lineCount = lines.length;
    const maxLineLength = Math.max(...lines.map(line => line.length), 1);

    // Container dimensions (accounting for padding)
    const containerHeight = 400 - 64; // 400px - (p-8 = 32px top + 32px bottom)
    const containerWidth = 500 - 64; // Approximate width - padding

    // Calculate what font size would fit
    // For monospace, char width ≈ 0.6 * font size, line height ≈ 1.2 * font size
    const maxFontFromHeight = containerHeight / (lineCount * 1.2);
    const maxFontFromWidth = containerWidth / (maxLineLength * 0.6);

    const fontSize = Math.min(maxFontFromHeight, maxFontFromWidth, 12); // Cap at 12px max

    return `${Math.max(4, fontSize)}px`;
  };

  const fetchRandomPair = async () => {
    setLoading(true);
    setOutputA(null);
    setOutputB(null);
    setPrompt(null);

    try {
      const response = await fetch('/api/random-pair');
      if (!response.ok) {
        console.error('Error fetching random pair');
        setLoading(false);
        return;
      }

      const data = await response.json();
      setPrompt(data.prompt);
      setOutputA(data.outputA);
      setOutputB(data.outputB);
    } catch (error) {
      console.error('Error fetching random pair:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleVote = async (selectedWinnerId: string) => {
    if (!outputA || !outputB) return;

    try {
      const response = await fetch('/api/vote', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          output_a_id: outputA.id,
          output_b_id: outputB.id,
          winner_id: selectedWinnerId,
        }),
      });

      if (!response.ok) {
        console.error('Error recording vote');
        return;
      }

      // Show results for 4 seconds before loading next pair
      setWinnerId(selectedWinnerId);
      setShowingResults(true);

      setTimeout(() => {
        setShowingResults(false);
        setWinnerId(null);
        fetchRandomPair();
      }, 4000);
    } catch (error) {
      console.error('Error recording vote:', error);
    }
  };

  useEffect(() => {
    fetchRandomPair();
  }, []);

  return (
    <main className="flex min-h-screen flex-col items-center pt-12 p-6">
      <div className="mb-12 text-center">
        <h1 className="text-6xl font-bold mb-4">ASCII Bench</h1>
        <pre className="text-4xl font-bold text-gray-800">
{`( ͡° ͜ʖ ͡°) `}
        </pre>
      </div>

      <div className="w-full max-w-6xl">
        {/* Prompt box */}
        <div className="mb-8 text-center">
          <p className="mb-4 text-lg text-gray-600">Which model did it better?</p>
          <div className="inline-block bg-gray-100 border-2 border-gray-300 rounded-lg px-8 py-4">
            {loading || !prompt ? (
              <div className="w-64 h-8 flex items-center justify-center">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-700"></div>
              </div>
            ) : (
              <p className="text-xl font-semibold text-gray-700">{prompt.prompt_text}</p>
            )}
          </div>
        </div>

        {/* Two option boxes side by side */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* Option A */}
          <div className="flex flex-col gap-4">
            {showingResults && outputA && (
              <div className="text-center py-2">
                <p className="font-bold text-lg">{outputA.model}</p>
                <p className="text-sm text-gray-600">Config: {outputA.model_config || 'default'}</p>
                {outputA.metadata?.reasoning_config && (
                  <p className="text-sm text-blue-600 font-semibold">
                    ⚡ Extended Thinking (max: {outputA.metadata.reasoning_config.max_tokens || 'N/A'} tokens)
                  </p>
                )}
                {outputA.metadata?.max_tokens && (
                  <p className="text-xs text-gray-500">Max tokens: {outputA.metadata.max_tokens}</p>
                )}
              </div>
            )}
            <div className={`border-2 rounded-lg p-8 h-[400px] flex items-center justify-center bg-white transition-colors overflow-hidden ${
              showingResults
                ? winnerId === outputA?.id
                  ? 'border-green-500 border-4'
                  : 'border-red-400 border-4'
                : 'border-gray-300 hover:border-blue-400 cursor-pointer'
            }`}>
              {loading || !outputA ? (
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              ) : (
                <pre className="leading-tight" style={{ fontSize: calculateFontSize(outputA.ascii_art) }}>
{outputA.ascii_art}
                </pre>
              )}
            </div>
            <div className="flex justify-center">
              <button
                onClick={() => outputA && handleVote(outputA.id)}
                disabled={loading || !outputA || showingResults}
                className="w-auto px-8 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Vote A
              </button>
            </div>
          </div>

          {/* Option B */}
          <div className="flex flex-col gap-4">
            {showingResults && outputB && (
              <div className="text-center py-2">
                <p className="font-bold text-lg">{outputB.model}</p>
                <p className="text-sm text-gray-600">Config: {outputB.model_config || 'default'}</p>
                {outputB.metadata?.reasoning_config && (
                  <p className="text-sm text-blue-600 font-semibold">
                    ⚡ Extended Thinking (max: {outputB.metadata.reasoning_config.max_tokens || 'N/A'} tokens)
                  </p>
                )}
                {outputB.metadata?.max_tokens && (
                  <p className="text-xs text-gray-500">Max tokens: {outputB.metadata.max_tokens}</p>
                )}
              </div>
            )}
            <div className={`border-2 rounded-lg p-8 h-[400px] flex items-center justify-center bg-white transition-colors overflow-hidden ${
              showingResults
                ? winnerId === outputB?.id
                  ? 'border-green-500 border-4'
                  : 'border-red-400 border-4'
                : 'border-gray-300 hover:border-blue-400 cursor-pointer'
            }`}>
              {loading || !outputB ? (
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
              ) : (
                <pre className="leading-tight" style={{ fontSize: calculateFontSize(outputB.ascii_art) }}>
{outputB.ascii_art}
                </pre>
              )}
            </div>
            <div className="flex justify-center">
              <button
                onClick={() => outputB && handleVote(outputB.id)}
                disabled={loading || !outputB || showingResults}
                className="w-auto px-8 py-3 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Vote B
              </button>
            </div>
          </div>
        </div>

        {/* Skip button */}
        <div className="flex justify-center">
          <button
            onClick={() => fetchRandomPair()}
            disabled={loading || showingResults}
            className="w-full sm:w-auto px-8 py-3 bg-gray-500 text-white font-semibold rounded-lg hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Skip
          </button>
        </div>
      </div>
    </main>
  );
}
