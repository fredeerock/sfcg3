import { pipeline, env } from "@huggingface/transformers";

env.allowLocalModels = false;

class PipelineSingleton {
    static task = 'text2text-generation';
    static model = 'Xenova/LaMini-Flan-T5-783M';
    static instance = null;

    static async getInstance() {
        if (!this.instance) {
            this.instance = await pipeline(this.task, this.model);
        }
        return this.instance;
    }
}

self.addEventListener('message', async (event) => {
    try {
        const generator = await PipelineSingleton.getInstance();

        const output = await generator(event.data.text, { max_length: 100 });

        self.postMessage({ status: 'complete', output });
    } catch (error) {
        self.postMessage({ status: 'error', message: error.message });
    }
});
