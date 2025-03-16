'use client'

import { useState, useEffect, useRef } from 'react'
import Progress from './components/Progress'

export default function Home() {
  const [conversation, setConversation] = useState([]);
  const [error, setError] = useState(null);
  const [status, setStatus] = useState(null);
  const [overallProgress, setOverallProgress] = useState(0);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const worker = useRef(null);

  useEffect(() => {
    if (!worker.current) {
      worker.current = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
    }

    const onMessageReceived = (e) => {
      const { status, output, message, overall } = e.data;
      console.log("Received message from worker:", e.data);

      // Update overall progress whenever it's included
      if (overall !== undefined) {
        setOverallProgress(Number(overall));
      }

      switch (status) {
        case 'initiate':
          setStatus('loading');
          setIsLoading(true);
          break;
        case 'ready':
          setStatus('ready');
          break;
        case 'complete':
          setIsLoading(false);
          if (output && output[0] && output[0].generated_text) {
            setConversation(prev => [...prev, { type: 'bot', text: output[0].generated_text }]);
          } else {
            setError("Received empty response from model");
          }
          break;
        case 'error':
          setIsLoading(false);
          setError(message);
          break;
      }
    };

    worker.current.addEventListener('message', onMessageReceived);
    return () => worker.current.removeEventListener('message', onMessageReceived);
  }, []);

  const sendMessage = (text) => {
    if (worker.current && text.trim()) {
      setIsLoading(true);
      setError(null);
      setConversation(prev => [...prev, { type: 'user', text }]);
      worker.current.postMessage({ text });
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-12">
      <h1 className="text-5xl font-bold mb-2 text-center">Chatbot</h1>
      <h2 className="text-2xl mb-4 text-center">Next.js template</h2>

      <div className="w-full max-w-md p-4 border border-gray-300 rounded mb-4 h-64 overflow-y-auto">
        {conversation.map((msg, index) => (
          <div key={index} className={`p-2 mb-2 ${msg.type === 'user' ? 'text-right bg-gray-100 rounded-lg' : 'text-left bg-blue-100 rounded-lg'}`}>
            <strong>{msg.type === 'user' ? 'You' : 'Bot'}:</strong> {msg.text}
          </div>
        ))}
        {isLoading && status === 'ready' && (
          <div className="text-left bg-blue-50 rounded-lg p-2 mb-2">
            <em>Bot is typing...</em>
          </div>
        )}
      </div>

      <div className="w-full max-w-md flex">
        <input
          className="flex-grow p-2 border border-gray-300 rounded-l"
          type="text"
          placeholder="Enter your message"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !isLoading) {
              sendMessage(inputText);
              setInputText('');
            }
          }}
          disabled={isLoading && status === 'loading'}
        />
        <button 
          className="bg-blue-500 text-white px-4 py-2 rounded-r disabled:bg-gray-300"
          onClick={() => {
            sendMessage(inputText);
            setInputText('');
          }}
          disabled={isLoading || !inputText.trim()}
        >
          Send
        </button>
      </div>

      {/* Show overall progress while loading */}
      {status === 'loading' && (
        <div className="w-full max-w-md mt-4">
          <Progress 
            text="Loading Model" 
            percentage={overallProgress} 
          />
        </div>
      )}

      {error && (
        <div className="w-full max-w-md p-2 bg-red-100 text-red-700 rounded mt-4">
          Error: {error}
        </div>
      )}
    </main>
  )
}