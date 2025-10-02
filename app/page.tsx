'use client';

export default function Home() {
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
            <p className="text-xl font-semibold text-gray-700">ASCII art of Spongebob</p>
          </div>
        </div>

        {/* Two option boxes side by side */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* Option A */}
          <div className="flex flex-col gap-4">
            <div className="border-2 border-gray-300 rounded-lg p-8 h-[400px] flex items-center justify-center bg-white hover:border-blue-400 transition-colors cursor-pointer overflow-auto">
              <pre className="text-xs leading-tight">
{`                    ___
                  /     \\
                 |  O O  |
                 |   <   |
                 |  \\_/  |
                  \\_____/
                     |
         \\O/         |
          |      ____|____
         / \\    |         |
                |  [ ] [ ]|
                |         |
                |  [ ] [ ]|
                |_________|
                 |       |
                 |       |
                _|       |_
                |_|     |_|`}
              </pre>
            </div>
            <div className="flex justify-center">
              <button className="w-auto px-8 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors">
                Vote A
              </button>
            </div>
          </div>

          {/* Option B */}
          <div className="flex flex-col gap-4">
            <div className="border-2 border-gray-300 rounded-lg p-8 h-[400px] flex items-center justify-center bg-white hover:border-blue-400 transition-colors cursor-pointer overflow-auto">
              <pre className="text-xs leading-tight">
{`          ____________
         /            \\
        /   O      O   \\
       |                |
       |       <        |
       |    \\_____/     |
       |     \\___/      |
        \\______________/
            ||  ||
       ____ || _||___
      |    |||        \\O
      |    ||||         |
      |____||||         |
        |  ||||        / \\
        |  ||||
       /_\\||||/_\\
      /___||||___\\`}
              </pre>
            </div>
            <div className="flex justify-center">
              <button className="w-auto px-8 py-3 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition-colors">
                Vote B
              </button>
            </div>
          </div>
        </div>

        {/* Skip button */}
        <div className="flex justify-center">
          <button className="w-full sm:w-auto px-8 py-3 bg-gray-500 text-white font-semibold rounded-lg hover:bg-gray-600 transition-colors">
            Skip
          </button>
        </div>
      </div>
    </main>
  );
}
