import { pipeline, env } from "@huggingface/transformers";

// Configure environment for better CPU compatibility
env.allowLocalModels = false;
env.USE_CACHE = true;
env.backends.onnx.wasm.numThreads = 1;  // Reduce thread count for better stability
env.debug = true; // Enable debug mode for more detailed errors

class PipelineSingleton {
    static task = 'text-generation';
    static model = 'onnx-community/gemma-3-1b-it-ONNX';
    static instance = null;

    static async getInstance(progress_callback) {
        if (this.instance) return this.instance;
        
        try {
            console.log("Starting to load model...");
            
            // Simplified pipeline creation following official examples
            this.instance = await pipeline(
                this.task,
                this.model,
                { progress_callback }
            );
            
            console.log("Model loaded successfully!");
            return this.instance;
        } catch (error) {
            console.error("Error initializing model:", error);
            if (error.stack) console.error("Error stack:", error.stack);
            throw error;
        }
    }
}

// Simplified progress tracking
const progressTracker = {
    files: new Map(), // Track progress of individual files
    
    updateProgress: function(file, progress) {
        this.files.set(file, Math.min(Math.max(progress, 0), 100));
        return this.getOverallProgress();
    },
    
    fileCompleted: function(file) {
        this.files.set(file, 100);
        return this.getOverallProgress();
    },
    
    getOverallProgress: function() {
        if (this.files.size === 0) return 0;
        
        let totalProgress = 0;
        this.files.forEach(progress => {
            totalProgress += progress;
        });
        
        return totalProgress / this.files.size;
    }
};

self.addEventListener('message', async (event) => {
    let timeoutId = null;
    
    try {
        // Set a global timeout to prevent hanging
        timeoutId = setTimeout(() => {
            self.postMessage({ 
                status: 'error', 
                message: 'Operation timed out after 60 seconds' 
            });
        }, 60000); // 60 second timeout
        
        // Reset progress tracking for new model loading
        progressTracker.files.clear();
        
        // Start loading notification
        self.postMessage({ 
            status: 'initiate', 
            file: 'model', 
            progress: 0, 
            total: 'loading model',
            overall: 0
        });
        
        // Load the model with progress handling
        const generator = await PipelineSingleton.getInstance(progress => {
            // Handle both numeric and object progress updates
            if (typeof progress === 'number') {
                const progressPercentage = Math.min(Math.max(progress * 100, 0), 100);
                const overallPercent = progressTracker.updateProgress('model', progressPercentage);
                
                self.postMessage({ 
                    status: 'progress', 
                    file: 'model', 
                    progress: progressPercentage, 
                    total: 'loading model',
                    overall: overallPercent
                });
            } else if (typeof progress === 'object' && progress !== null) {
                if (progress.status === 'progress' && typeof progress.progress === 'number') {
                    const progressPercentage = Math.min(Math.max(progress.progress, 0), 100);
                    const overallPercent = progressTracker.updateProgress(
                        progress.file || 'unknown', 
                        progressPercentage
                    );
                    
                    self.postMessage({
                        status: 'progress',
                        file: progress.file || 'model',
                        progress: progressPercentage,
                        total: `${progress.loaded ? (progress.loaded / 1024 / 1024).toFixed(1) + 'MB' : 'loading'}`,
                        overall: overallPercent
                    });
                } else if (progress.status === 'done') {
                    const overallPercent = progressTracker.fileCompleted(progress.file || 'unknown');
                    
                    self.postMessage({
                        status: 'fileLoaded',
                        file: progress.file || 'file',
                        overall: overallPercent
                    });
                }
            }
        });
        
        // Model is fully loaded
        self.postMessage({ 
            status: 'done', 
            file: 'model',
            overall: 100
        });
        self.postMessage({ status: 'ready' });
        
        console.log("Preparing to generate text...");
        
        // Prepare prompt for generation
        const userInput = event.data.text;
        
        // Create chat format that Gemma models expect
        const chatPrompt = [
            { role: 'user', content: userInput }
        ];
        
        console.log("Using generation with prompt:", chatPrompt);
        
        // Generate text with simpler parameters
        const output = await generator(chatPrompt, {
            max_new_tokens: 256
        });

        console.log('Model execution complete, raw output:', output);
        
        // Extract text from the response
        let responseText = '';
        
        if (Array.isArray(output) && output.length > 0) {
            if (output[0].generated_text && typeof output[0].generated_text === 'string') {
                // Direct string output
                responseText = output[0].generated_text;
            } else if (Array.isArray(output[0].generated_text)) {
                // Array format - get last message
                responseText = output[0].generated_text.at(-1)?.content || 'No response generated';
            } else {
                // Fallback with JSON stringify for debugging
                responseText = 'Received response in unexpected format: ' + JSON.stringify(output);
            }
        } else {
            responseText = 'No output generated';
        }
        
        console.log('Extracted response text:', responseText);
        
        self.postMessage({ 
            status: 'complete', 
            output: [{ generated_text: responseText }] 
        });
    } catch (error) {
        console.error("An error occurred during model execution:", error);
        if (error.stack) console.error("Error stack:", error.stack);
        self.postMessage({ 
            status: 'error', 
            message: `Error: ${error.message || error}. Check console for details.` 
        });
    } finally {
        // Clear the timeout if it exists
        if (timeoutId) clearTimeout(timeoutId);
    }
});
