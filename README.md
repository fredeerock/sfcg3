# Local Gemma 3 Demo

A simple web application that demonstrates running Gemma 3 LLM directly in the browser using ONNX runtime.

![Demo Screenshot](public/screenshot.png)

## Features

- Run Gemma 3 (1B) directly in your browser - no API keys needed
- Complete privacy - all processing happens locally
- Simple chat interface with markdown support
- Persists conversations between sessions

## Quick Start

1. Install dependencies:
   ```bash
   npm install https://github.com/huggingface/transformers.js/archive/new-model.tar.gz
   cd node_modules/@huggingface/transformers
   npm install
   npm run build
   cd ../../..
   npm install
   ```

2. Run the development server:
   ```bash
   npm run dev
   ```

3. Open [http://localhost:3000](http://localhost:3000) in your browser

## Requirements

- Modern web browser with WebAssembly support
- Recommended: At least 4GB of available RAM for model loading

## How It Works

This demo uses Next.js and the Hugging Face Transformers.js library to load and run the quantized ONNX version of Gemma 3 directly in your browser through WebAssembly.

## Technologies

- Next.js
- React
- Tailwind CSS
- Hugging Face Transformers.js
- ONNX Runtime Web
