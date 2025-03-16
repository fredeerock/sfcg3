'use client'

import { useState, useEffect, useRef } from 'react'
import Progress from './components/Progress'

export default function Home() {
  const [conversation, setConversation] = useState([]);
  const [error, setError] = useState(null);
  const [status, setStatus] = useState(null);
  const [overallProgress, setOverallProgress] = useState(0);
  const worker = useRef(null);

  useEffect(() => {
    if (!worker.current) {
      worker.current = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
    }

    const onMessageReceived = (e) => {
      const { status, output, message, overall } = e.data;

      // Update overall progress whenever it's included
      if (overall !== undefined) {
        setOverallProgress(Number(overall));
      }

      switch (status) {
        case 'initiate':
          setStatus('loading');
          break;
        case 'ready':
          setStatus('ready');
          break;
        case 'complete':
          setConversation(prev => [...prev, { type: 'bot', text: output[0].generated_text }]);
          break;
        case 'error':
          setError(message);
          break;
      }
    };

    worker.current.addEventListener('message', onMessageReceived);
    return () => worker.current.removeEventListener('message', onMessageReceived);
  }, []);

  const sendMessage = (text) => {
    if (worker.current) {
      setConversation(prev => [...prev, { type: 'user', text }]);
      worker.current.postMessage({ text });
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-12">
      <h1 className="text-5xl font-bold mb-2 text-center">Chatbot</h1>
      <h2 className="text-2xl mb-4 text-center">Next.js template</h2>

      <div className="w-full max-w-xs p-2 border border-gray-300 rounded mb-4">
        {conversation.map((msg, index) => (
          <div key={index} className={`p-2 ${msg.type === 'user' ? 'text-right' : 'text-left'}`}>
            <strong>{msg.type === 'user' ? 'You' : 'Bot'}:</strong> {msg.text}
          </div>
        ))}
      </div>

      <input
        className="w-full max-w-xs p-2 border border-gray-300 rounded mb-4"
        type="text"
        placeholder="Enter your message"
        onKeyDown={e => {
          if (e.key === 'Enter') {
            sendMessage(e.target.value);
            e.target.value = '';
          }
        }}
      />

      {/* Show overall progress while loading */}
      {status === 'loading' && (
        <div className="w-full max-w-xs mb-4">
          <Progress 
            text="Loading Model" 
            percentage={overallProgress} 
          />
        </div>
      )}

      {error && (
        <div className="w-full max-w-xs p-2 bg-red-100 text-red-700 rounded mb-4">
          Error: {error}
        </div>
      )}
    </main>
  )
}