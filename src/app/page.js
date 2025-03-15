'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

export default function Home() {
  // Keep track of the conversation, model loading status, and progress.
  const [conversation, setConversation] = useState([]);
  const [ready, setReady] = useState(null);
  const [progress, setProgress] = useState(0);

  // Create a reference to the worker object.
  const worker = useRef(null);

  // We use the `useEffect` hook to set up the worker as soon as the `App` component is mounted.
  useEffect(() => {
    if (!worker.current) {
      // Create the worker if it does not yet exist.
      worker.current = new Worker(new URL('./worker.js', import.meta.url), {
        type: 'module'
      });
    }

    // Create a callback function for messages from the worker thread.
    const onMessageReceived = (e) => {
      switch (e.data.status) {
        case 'initiate':
          setReady(false);
          break;
        case 'progress':
          setProgress(e.data.progress);
          break;
        case 'ready':
          setReady(true);
          setProgress(100);
          break;
        case 'complete':
          setConversation(prev => [...prev, { type: 'bot', text: e.data.output[0].generated_text }]);
          break;
      }
    };

    // Attach the callback function as an event listener.
    worker.current.addEventListener('message', onMessageReceived);

    // Define a cleanup function for when the component is unmounted.
    return () => worker.current.removeEventListener('message', onMessageReceived);
  });

  const sendMessage = useCallback((text) => {
    if (worker.current) {
      setConversation(prev => [...prev, { type: 'user', text }]);
      worker.current.postMessage({ text });
    }
  }, []);

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

      {ready !== null && (
        <pre className="bg-gray-100 p-2 rounded">
          { !ready ? `Loading... ${progress}%` : 'Ready to chat!' }
        </pre>
      )}
    </main>
  )
}