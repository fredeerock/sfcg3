import { pipeline, env } from "@huggingface/transformers";

env.allowLocalModels = false;

class PipelineSingleton {
    static task = 'text2text-generation';
    static model = 'Xenova/LaMini-Flan-T5-783M';
    static instance = null;

    static async getInstance(progress_callback) {
        if (!this.instance) {
            this.instance = await pipeline(this.task, this.model, { progress_callback });
        }
        return this.instance;
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
    try {
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
        
        const output = await generator(event.data.text, { max_length: 100 });

        console.log('Model execution complete');
        self.postMessage({ status: 'complete', output });
    } catch (error) {
        console.error("An error occurred during model execution:", error);
        self.postMessage({ status: 'error', message: error.message });
    }
});
