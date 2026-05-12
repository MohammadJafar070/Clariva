import { pipeline, FeatureExtractionPipeline } from "@xenova/transformers";

let embedder: FeatureExtractionPipeline | null = null;

async function getEmbedder(): Promise<FeatureExtractionPipeline> {
  if (!embedder) {
    embedder = (await pipeline(
      "feature-extraction",
      "Xenova/all-MiniLM-L6-v2",
    )) as FeatureExtractionPipeline;
  }
  return embedder;
}

export async function generateEmbedding(text: string): Promise<number[]> {
  const embedder = await getEmbedder();

  const output = await embedder(text, {
    pooling: "mean",
    normalize: true,
  });

  return Array.from(output.data as Float32Array);
}
