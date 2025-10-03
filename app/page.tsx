'use client';

import { useEffect, useState } from 'react';

type AsciiOutput = {
  id: string;
  model: string;
  ascii_art: string;
  prompt_id: string;
};

type Prompt = {
  id: string;
  prompt_text: string;
};

export default function Home() {
  const [outputA, setOutputA] = useState<AsciiOutput | null>(null);
  const [outputB, setOutputB] = useState<AsciiOutput | null>(null);
  const [prompt, setPrompt] = useState<Prompt | null>(null);
  const [loading, setLoading] = useState(true);

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

  const handleVote = async (winnerId: string) => {
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
          winner_id: winnerId,
        }),
      });

      if (!response.ok) {
        console.error('Error recording vote');
        return;
      }

      // Load next pair
      fetchRandomPair();
    } catch (error) {
      console.error('Error recording vote:', error);
    }
  };

  useEffect(() => {
    fetchRandomPair();
  }, []);

  if (loading) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-6">
        <p className="text-xl text-gray-600">Loading...</p>
      </main>
    );
  }

  if (!outputA || !outputB || !prompt) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-6">
        <p className="text-xl text-gray-600">No outputs available</p>
      </main>
    );
  }

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
            <p className="text-xl font-semibold text-gray-700">{prompt.prompt_text}</p>
          </div>
        </div>

        {/* Two option boxes side by side */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* Option A */}
          <div className="flex flex-col gap-4">
            <div className="border-2 border-gray-300 rounded-lg p-8 h-[400px] flex items-center justify-center bg-white hover:border-blue-400 transition-colors cursor-pointer overflow-hidden">
              <pre className="leading-tight" style={{ fontSize: calculateFontSize(outputA.ascii_art) }}>
{outputA.ascii_art}
              </pre>
            </div>
            <div className="flex justify-center">
              <button
                onClick={() => handleVote(outputA.id)}
                className="w-auto px-8 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
              >
                Vote A
              </button>
            </div>
          </div>

          {/* Option B */}
          <div className="flex flex-col gap-4">
            <div className="border-2 border-gray-300 rounded-lg p-8 h-[400px] flex items-center justify-center bg-white hover:border-blue-400 transition-colors cursor-pointer overflow-hidden">
              <pre className="leading-tight" style={{ fontSize: calculateFontSize(outputB.ascii_art) }}>
{outputB.ascii_art}
              </pre>
            </div>
            <div className="flex justify-center">
              <button
                onClick={() => handleVote(outputB.id)}
                className="w-auto px-8 py-3 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition-colors"
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
            className="w-full sm:w-auto px-8 py-3 bg-gray-500 text-white font-semibold rounded-lg hover:bg-gray-600 transition-colors"
          >
            Skip
          </button>
        </div>
      </div>
    </main>
  );
}
