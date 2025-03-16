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

// Function to ensure we send periodic updates even at the beginning
function ensureInitialProgress() {
    let initialProgressSent = false;
    
    // Send a 1% progress after a short delay if no other progress has been sent
    setTimeout(() => {
        if (!initialProgressSent) {
            self.postMessage({ 
                status: 'progress', 
                file: 'model', 
                progress: 1, 
                total: 'loading model' 
            });
        }
    }, 1000);
    
    return () => { initialProgressSent = true; };
}

// Track the overall loading state
const overallProgress = {
    totalFiles: 0,
    loadedFiles: 0,
    filesInProgress: new Map(), // Map to track individual file progress
    getProgress: function() {
        // If no files, return 0
        if (this.totalFiles === 0) return 0;
        
        // If all files are loaded, return 100%
        if (this.loadedFiles === this.totalFiles) return 100;
        
        // Otherwise calculate weighted progress of all files
        let totalProgress = 0;
        
        // Add progress from files in progress
        this.filesInProgress.forEach((progress) => {
            totalProgress += progress;
        });
        
        // Add 100% for each fully loaded file
        totalProgress += (this.loadedFiles * 100);
        
        // Calculate average progress
        return totalProgress / Math.max(this.totalFiles, 1);
    },
    updateFileProgress: function(file, progress) {
        this.filesInProgress.set(file, progress);
        return this.getProgress();
    },
    fileCompleted: function(file) {
        this.filesInProgress.delete(file);
        this.loadedFiles++;
        return this.getProgress();
    },
    newFile: function() {
        this.totalFiles++;
    }
};

self.addEventListener('message', async (event) => {
    try {
        // Reset progress tracking for new model loading
        overallProgress.totalFiles = 0;
        overallProgress.loadedFiles = 0;
        overallProgress.filesInProgress.clear();
        
        // First, send a message that we're starting to load
        self.postMessage({ 
            status: 'initiate', 
            file: 'model', 
            progress: 0, 
            total: 'loading model',
            overall: 0
        });
        
        // Setup a function to mark when we've sent initial progress
        const markProgressSent = ensureInitialProgress();
        
        // Load the model with proper progress handling
        const generator = await PipelineSingleton.getInstance(progress => {
            // Mark that we've sent a progress update
            markProgressSent();
            
            // Handle both numeric and object progress updates
            if (typeof progress === 'number') {
                const progressPercentage = Math.min(Math.max(progress * 100, 0), 100);
                
                const overallPercent = overallProgress.updateFileProgress('model', progressPercentage);
                
                // Send progress update to main thread
                self.postMessage({ 
                    status: 'progress', 
                    file: 'model', 
                    progress: progressPercentage, 
                    total: 'loading model',
                    overall: overallPercent
                });
            } else if (typeof progress === 'object' && progress !== null) {
                // Process object progress updates
                if (progress.status === 'progress' && typeof progress.progress === 'number') {
                    const progressPercentage = Math.min(Math.max(progress.progress, 0), 100);
                    
                    // Track this file in overall progress
                    if (!overallProgress.filesInProgress.has(progress.file)) {
                        overallProgress.newFile();
                    }
                    
                    // Update overall progress
                    const overallPercent = overallProgress.updateFileProgress(progress.file, progressPercentage);
                    
                    // Send the actual file progress to the main thread
                    self.postMessage({
                        status: 'progress',
                        file: progress.file || 'model',
                        progress: progressPercentage,
                        total: `${progress.loaded ? (progress.loaded / 1024 / 1024).toFixed(1) + 'MB' : 'loading'}`,
                        overall: overallPercent
                    });
                } else if (progress.status === 'done') {
                    
                    // Update overall progress for completed file
                    const overallPercent = overallProgress.fileCompleted(progress.file);
                    
                    // File is done loading
                    self.postMessage({
                        status: 'fileLoaded',
                        file: progress.file || 'file',
                        overall: overallPercent
                    });
                }
            }
        });
        
        // Model is fully loaded - set progress to 100%
        self.postMessage({ 
            status: 'progress', 
            file: 'model', 
            progress: 100, 
            total: 'loading model',
            overall: 100
        });
        
        // Model is loaded
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
