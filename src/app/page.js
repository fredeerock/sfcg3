'use client'

import { useState, useEffect, useRef } from 'react'
import Progress from './components/Progress'

export default function Home() {
  const [conversation, setConversation] = useState([]);
  const [error, setError] = useState(null);
  const [status, setStatus] = useState(null);
  const [progressItems, setProgressItems] = useState([]);
  const [overallProgress, setOverallProgress] = useState(0);
  const worker = useRef(null);
  const progressUpdatesRef = useRef(0); // To track if we're getting progress updates

  useEffect(() => {
    if (!worker.current) {
      worker.current = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
    }

    const onMessageReceived = (e) => {
      const { status, output, message, file, progress, total, overall } = e.data;

      // Update overall progress whenever it's included
      if (overall !== undefined) {
        setOverallProgress(Number(overall));
      }

      switch (status) {
        case 'initiate':
          setProgressItems(prev => [...prev, {
            ...e.data,
            timestamp: Date.now() // Add timestamp for debugging
          }]);
          setStatus('loading');
          break;
        case 'progress':
          // Count progress updates for debugging
          progressUpdatesRef.current += 1;
          
          setProgressItems(prevItems => {
            // Check if this file already exists in our items
            const fileExists = prevItems.some(item => item.file === file);
            
            if (fileExists) {
              // Update the existing item
              return prevItems.map(item => 
                item.file === file ? { 
                  ...item, 
                  progress: Number(progress), // Ensure it's a number
                  total,
                  timestamp: Date.now() // Update timestamp
                } : item
              );
            } else {
              // Add a new progress item
              return [...prevItems, { 
                file, 
                progress: Number(progress), // Ensure it's a number
                total,
                timestamp: Date.now()
              }];
            }
          });
          break;
        case 'fileLoaded':
          // Mark individual file as loaded but don't remove yet
          setProgressItems(prev => 
            prev.map(item => 
              item.file === file ? { 
                ...item, 
                progress: 100, 
                loaded: true,
                timestamp: Date.now()
              } : item
            )
          );
          break;
        case 'done':
          // Remove progress item when completely done
          setProgressItems(prev => 
            prev.filter(item => item.file !== file)
          );
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

      {/* Show only overall progress while loading */}
      {status === 'loading' && (
        <div className="w-full max-w-xs mb-4">
          {/* Overall progress bar */}
          <div className="mb-2">
            <Progress 
              text="Loading Model" 
              percentage={overallProgress} 
              total=""
              isOverall={true}
            />
          </div>
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