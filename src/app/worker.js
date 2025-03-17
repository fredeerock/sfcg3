import { pipeline, env } from "@huggingface/transformers";

env.allowLocalModels = false;
env.USE_CACHE = true;
env.backends.onnx.wasm.numThreads = 1;
env.debug = false;

const CONFIG = {
    MAX_NEW_TOKENS: 128,
    TEMPERATURE: 0.7,
    TOP_P: 0.8,
    FALLBACK_ENABLED: true
};

class PipelineSingleton {
    static task = 'text-generation';
    static model = 'onnx-community/gemma-3-1b-it-ONNX';
    static instance = null;

    static async getInstance(progress_callback) {
        if (this.instance) return this.instance;
        
        try {
            this.instance = await pipeline(
                this.task,
                this.model,
                { 
                    progress_callback,
                    model_file: "model_q4f16.onnx"
                }
            );
            return this.instance;
        } catch (error) {
            try {
                this.instance = await pipeline(
                    this.task,
                    this.model,
                    { progress_callback }
                );
                return this.instance;
            } catch (fallbackError) {
                throw fallbackError;
            }
        }
    }
}

const progressTracker = {
    files: new Map(),
    
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
    if (event.data.type === 'heartbeat') {
        self.postMessage({ type: 'heartbeat' });
        return;
    }

    let timeoutId = null;
    
    try {
        timeoutId = setTimeout(() => {
            self.postMessage({ 
                status: 'error', 
                message: 'Operation timed out after 60 seconds' 
            });
        }, 70000);
        
        progressTracker.files.clear();
        
        self.postMessage({ 
            status: 'initiate', 
            file: 'model', 
            progress: 0, 
            overall: 0
        });
        
        const generator = await PipelineSingleton.getInstance(progress => {
            if (typeof progress === 'number') {
                const progressPercentage = Math.min(Math.max(progress * 100, 0), 100);
                const overallPercent = progressTracker.updateProgress('model', progressPercentage);
                
                self.postMessage({ 
                    status: 'progress', 
                    file: 'model', 
                    progress: progressPercentage, 
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
        
        self.postMessage({ 
            status: 'done', 
            file: 'model',
            overall: 100
        });
        self.postMessage({ status: 'ready' });
        
        const maxTokens = CONFIG.MAX_NEW_TOKENS;
        const userInput = event.data.text;
        
        const chatPrompt = [
            { role: 'user', content: userInput }
        ];
        
        const output = await generator(chatPrompt, {
            max_new_tokens: maxTokens,
            temperature: CONFIG.TEMPERATURE,
            top_p: CONFIG.TOP_P,
            do_sample: true
        });

        let responseText = '';
        
        if (Array.isArray(output) && output.length > 0) {
            if (output[0].generated_text && typeof output[0].generated_text === 'string') {
                responseText = output[0].generated_text;
            } else if (Array.isArray(output[0].generated_text)) {
                responseText = output[0].generated_text.at(-1)?.content || 'No response generated';
            } else {
                responseText = 'Received response in unexpected format';
            }
        } else {
            responseText = 'No output generated';
        }
        
        self.postMessage({ 
            status: 'complete', 
            output: [{ generated_text: responseText }] 
        });
    } catch (error) {
        self.postMessage({ 
            status: 'error', 
            message: `Error: ${error.message || error}`
        });
    } finally {
        if (timeoutId) clearTimeout(timeoutId);
    }
});
