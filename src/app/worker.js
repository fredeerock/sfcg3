import { pipeline, env } from "@huggingface/transformers";

// Skip local model check
env.allowLocalModels = false;

// Use the Singleton pattern to enable lazy construction of the pipeline.
class PipelineSingleton {
    static task = 'text2text-generation';
    static model = 'Xenova/LaMini-Flan-T5-783M';
    static instance = null;

    static async getInstance(progress_callback = null) {
        if (this.instance === null) {
            this.instance = await pipeline(this.task, this.model, { progress_callback });
        }
        return this.instance;
    }
}

// Listen for messages from the main thread
self.addEventListener('message', async (event) => {
    // Retrieve the text generation pipeline. When called for the first time,
    // this will load the pipeline and save it for future use.
    let generator = await PipelineSingleton.getInstance(x => {
        // We also add a progress callback to the pipeline so that we can
        // track model loading.
        self.postMessage({ status: 'progress', progress: x });
    });

    // Generate a response based on the input text
    let output = await generator(event.data.text, { max_length: 100 });

    // Send the output back to the main thread
    self.postMessage({
        status: 'complete',
        output: output,
    });
});
